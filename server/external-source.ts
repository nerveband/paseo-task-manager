import { Project, Task, createTaskRecord, sanitizeLink, sanitizeText } from "../shared/board-model";

/**
 * Optional external task source.
 *
 * The plugin never contacts a remote endpoint unless the user has stored one
 * explicitly. There is no default endpoint and no fallback endpoint: when the
 * configured source fails, the failure is reported and local tasks are still
 * shown.
 *
 * Wire contract (see docs/external-source.md):
 *
 *   GET <url>?limit=100[&cursor=<token>]
 *   200 {
 *     "records": [
 *       {
 *         "id": "string (required)",
 *         "title": "string (required)",
 *         "category": "string",
 *         "stage": "string, matched against the configured stages",
 *         "project": "string, matched against project names",
 *         "owner": "string", "due": "string", "spec": "string",
 *         "notes": "string", "link": "http(s) URL",
 *         "priority": 0 | 1 | 2 | 3,
 *         "archived": boolean, "prominent": boolean
 *       }
 *     ],
 *     "nextCursor": "string or null"
 *   }
 */

export const MAX_PAGES = 10;
export const PAGE_LIMIT = 100;
export const MAX_RECORDS = 1000;
export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_SOURCE_URL_LENGTH = 2048;

/** Accepts only an explicit http(s) URL without embedded credentials. */
export function validateSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_SOURCE_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export interface ExternalSourceContext {
  stages: readonly string[];
  projects: readonly Project[];
  /** Project that receives records whose project name does not exist yet. */
  fallbackProjectId: string | null;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}

export interface ExternalSourceResult {
  tasks: Task[];
  warnings: string[];
}

interface RawExternalRecord {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  stage?: unknown;
  project?: unknown;
  projectId?: unknown;
  owner?: unknown;
  due?: unknown;
  spec?: unknown;
  notes?: unknown;
  link?: unknown;
  priority?: unknown;
  archived?: unknown;
  prominent?: unknown;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "external source";
  }
}

/**
 * Converts one external record. Records without an id or title are dropped.
 * A stage that is not configured is replaced by the first configured stage and
 * reported once per unknown stage name.
 */
export function normalizeExternalRecord(
  raw: unknown,
  context: ExternalSourceContext,
  warnings: Map<string, number>,
): Task | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as RawExternalRecord;

  const id = sanitizeText(record.id, 120);
  const title = sanitizeText(record.title, 200);
  if (!id || !title) return null;

  const rawProjectName = sanitizeText(record.project, 60) ?? sanitizeText(record.projectId, 120);
  const matchedProject = rawProjectName
    ? context.projects.find(
        (project) =>
          project.id === rawProjectName ||
          project.name.toLowerCase() === rawProjectName.toLowerCase(),
      )
    : undefined;
  const projectId = matchedProject?.id ?? context.fallbackProjectId;
  if (!projectId) return null;

  const rawStage = sanitizeText(record.stage, 40);
  let stage = context.stages[0];
  if (rawStage) {
    if (context.stages.includes(rawStage)) {
      stage = rawStage;
    } else {
      warnings.set(rawStage, (warnings.get(rawStage) ?? 0) + 1);
    }
  }

  const rawPriority = record.priority;
  const priority =
    typeof rawPriority === "number" && [0, 1, 2, 3].includes(rawPriority)
      ? (rawPriority as 0 | 1 | 2 | 3)
      : 1;

  const created = createTaskRecord({
    projectId,
    title,
    category: sanitizeText(record.category, 60) ?? "General",
    stage,
    owner: sanitizeText(record.owner, 120),
    due: sanitizeText(record.due, 40),
    spec: sanitizeText(record.spec),
    notes: sanitizeText(record.notes),
    link: sanitizeLink(record.link),
    priority,
    prominent: record.prominent === true,
    archived: record.archived === true,
  });

  // External identity must stay stable across fetches: keep the source id.
  return { ...created, id: `ext_${id}` };
}

export async function fetchExternalTasks(
  url: string,
  context: ExternalSourceContext,
): Promise<ExternalSourceResult> {
  const validated = validateSourceUrl(url);
  if (!validated) {
    return { tasks: [], warnings: ["The configured external source URL is not a valid http(s) URL."] };
  }

  const fetchImpl = context.fetchImpl ?? fetch;
  const maxPages = context.maxPages ?? MAX_PAGES;
  const warnings: string[] = [];
  const stageWarnings = new Map<string, number>();
  const tasks: Task[] = [];

  let cursor: string | null = null;
  let pages = 0;

  try {
    do {
      const requestUrl = new URL(validated);
      requestUrl.searchParams.set("limit", String(PAGE_LIMIT));
      if (cursor) requestUrl.searchParams.set("cursor", cursor);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetchImpl(requestUrl.toString(), {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          warnings.push(`${hostOf(validated)} responded with HTTP ${response.status}.`);
          break;
        }

        const payload = (await response.json()) as { records?: unknown[]; nextCursor?: unknown };
        const records = Array.isArray(payload.records) ? payload.records : [];
        for (const record of records) {
          if (tasks.length >= MAX_RECORDS) break;
          const task = normalizeExternalRecord(record, context, stageWarnings);
          if (task) tasks.push(task);
        }

        cursor = typeof payload.nextCursor === "string" && payload.nextCursor ? payload.nextCursor : null;
        pages += 1;
        if (pages >= maxPages) {
          warnings.push(`Stopped after ${maxPages} pages.`);
          break;
        }
      } finally {
        clearTimeout(timer);
      }
    } while (cursor);
  } catch (error) {
    warnings.push(
      `${hostOf(validated)} could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  for (const [stage, count] of stageWarnings) {
    warnings.push(
      `Stage "${stage}" is not configured. ${count} task${count === 1 ? "" : "s"} moved to "${context.stages[0]}".`,
    );
  }

  return { tasks, warnings };
}
