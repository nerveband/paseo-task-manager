import { z } from "zod";

/**
 * Neutral board model. Projects and stages are user data, never fixed enums.
 * The only fixed behavior is that the last configured stage counts as done.
 */

export const DEFAULT_STAGES = ["Todo", "In progress", "Done"] as const;

export const MAX_STAGES = 12;
export const MAX_STAGE_LENGTH = 40;
export const MAX_PROJECT_NAME_LENGTH = 60;
export const MAX_TEXT_LENGTH = 4000;

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const PrioritySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export type Priority = z.infer<typeof PrioritySchema>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string(),
  title: z.string(),
  category: z.string(),
  stage: z.string(),
  owner: z.string().nullable(),
  due: z.string().nullable(),
  spec: z.string().nullable(),
  notes: z.string().nullable(),
  link: z.string().nullable(),
  priority: PrioritySchema,
  sort: z.number(),
  archived: z.boolean(),
  prominent: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

export const BoardFileSchema = z.object({
  version: z.number(),
  projects: z.array(ProjectSchema),
  stages: z.array(z.string()),
  tasks: z.array(TaskSchema),
});

export type BoardFile = z.infer<typeof BoardFileSchema>;

export const BOARD_VERSION = 1;

export function emptyBoard(): BoardFile {
  return {
    version: BOARD_VERSION,
    projects: [],
    stages: [...DEFAULT_STAGES],
    tasks: [],
  };
}

/**
 * Normalizes a user-supplied stage list: trims, drops blanks, removes
 * duplicates case-insensitively, and caps length and count. An empty result
 * falls back to the default list so the board can never lose every stage.
 */
export function normalizeStages(input: unknown): string[] {
  if (!Array.isArray(input)) return [...DEFAULT_STAGES];
  const seen = new Set<string>();
  const stages: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, MAX_STAGE_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    stages.push(trimmed);
    if (stages.length >= MAX_STAGES) break;
  }
  return stages.length > 0 ? stages : [...DEFAULT_STAGES];
}

/** The last configured stage is the done stage. */
export function doneStageOf(stages: readonly string[]): string {
  return stages[stages.length - 1] ?? DEFAULT_STAGES[DEFAULT_STAGES.length - 1];
}

export function isDone(task: Pick<Task, "stage">, stages: readonly string[]): boolean {
  return task.stage === doneStageOf(stages);
}

export function isKnownStage(stage: unknown, stages: readonly string[]): stage is string {
  return typeof stage === "string" && stages.includes(stage);
}

export function sanitizeText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function sanitizeLink(value: unknown): string | null {
  const candidate = sanitizeText(value, 2048);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function sanitizeProjectName(value: unknown): string | null {
  const name = sanitizeText(value, MAX_PROJECT_NAME_LENGTH);
  if (!name) return null;
  return name.replace(/\s+/g, " ");
}

/** Time-ordered identifier with a random tail, unique across restarts. */
export function createId(prefix: string, now = new Date()): string {
  return `${prefix}_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createProjectRecord(name: string, now = new Date()): Project {
  return {
    id: createId("prj", now),
    name,
    createdAt: now.toISOString(),
  };
}

export function createTaskRecord(
  input: {
    projectId: string;
    title: string;
    category: string;
    stage: string;
    owner?: string | null;
    due?: string | null;
    spec?: string | null;
    notes?: string | null;
    link?: string | null;
    priority?: Priority;
    prominent?: boolean;
    archived?: boolean;
  },
  now = new Date(),
): Task {
  const timestamp = now.toISOString();
  const priority = input.priority ?? 1;
  return {
    id: createId("tsk", now),
    projectId: input.projectId,
    title: sanitizeText(input.title, 200) ?? input.title,
    category: sanitizeText(input.category, 60) ?? input.category,
    stage: input.stage,
    owner: sanitizeText(input.owner, 120),
    due: sanitizeText(input.due, 40),
    spec: sanitizeText(input.spec),
    notes: sanitizeText(input.notes),
    link: sanitizeLink(input.link),
    priority,
    sort: 0,
    archived: input.archived === true,
    prominent: input.prominent === true || priority === 3,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Sorts open, prominent, high-priority tasks first and completed tasks last.
 * Identical inputs always produce the same order.
 */
export function sortTasks(tasks: readonly Task[], stages: readonly string[]): Task[] {
  const done = doneStageOf(stages);
  return [...tasks].sort((a, b) => {
    const aProminent = a.prominent && a.stage !== done ? 1 : 0;
    const bProminent = b.prominent && b.stage !== done ? 1 : 0;
    if (aProminent !== bProminent) return bProminent - aProminent;

    const aDone = a.stage === done ? 1 : 0;
    const bDone = b.stage === done ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.title.localeCompare(b.title);
  });
}

export interface TaskFilter {
  projectId?: string;
  stage?: string;
  includeArchived?: boolean;
  query?: string;
}

export function filterTasks(tasks: readonly Task[], options: TaskFilter = {}): Task[] {
  const { projectId, stage, includeArchived = false, query = "" } = options;
  const needle = query.trim().toLowerCase();

  return tasks.filter((task) => {
    if (!includeArchived && task.archived) return false;
    if (projectId && projectId !== "all" && task.projectId !== projectId) return false;
    if (stage && stage !== "all" && task.stage !== stage) return false;
    if (!needle) return true;
    const haystack = [
      task.title,
      task.category,
      task.stage,
      task.owner ?? "",
      task.spec ?? "",
      task.notes ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export interface BoardSummary {
  total: number;
  open: number;
  done: number;
  archived: number;
  byStage: Array<{ stage: string; count: number }>;
  byProject: Array<{ projectId: string; total: number; open: number }>;
}

export function summarizeBoard(
  tasks: readonly Task[],
  projects: readonly Project[],
  stages: readonly string[],
): BoardSummary {
  const done = doneStageOf(stages);
  const active = tasks.filter((task) => !task.archived);
  const byStage = stages.map((stage) => ({
    stage,
    count: active.filter((task) => task.stage === stage).length,
  }));
  const byProject = projects.map((project) => {
    const owned = active.filter((task) => task.projectId === project.id);
    return {
      projectId: project.id,
      total: owned.length,
      open: owned.filter((task) => task.stage !== done).length,
    };
  });
  return {
    total: active.length,
    open: active.filter((task) => task.stage !== done).length,
    done: active.filter((task) => task.stage === done).length,
    archived: tasks.length - active.length,
    byStage,
    byProject,
  };
}

/**
 * Reads any stored board document into the current shape. Unknown fields are
 * dropped and unreadable records are skipped rather than throwing, so a
 * damaged or older file never prevents the board from loading.
 */
export function parseBoardDocument(raw: unknown): BoardFile {
  const fallback = emptyBoard();
  if (!raw || typeof raw !== "object") return fallback;
  const source = raw as Record<string, unknown>;

  const stages = normalizeStages(source.stages);

  const projects: Project[] = [];
  if (Array.isArray(source.projects)) {
    for (const entry of source.projects) {
      const parsed = ProjectSchema.safeParse(entry);
      if (parsed.success) projects.push(parsed.data);
    }
  }

  const projectIds = new Set(projects.map((project) => project.id));
  const tasks: Task[] = [];
  if (Array.isArray(source.tasks)) {
    for (const entry of source.tasks) {
      const normalized = normalizeStoredTask(entry, stages, projectIds);
      if (normalized) tasks.push(normalized);
    }
  }

  return {
    version: typeof source.version === "number" ? source.version : BOARD_VERSION,
    projects,
    stages,
    tasks,
  };
}

/**
 * Accepts one stored task record. Records that cannot identify a task are
 * dropped; unknown stages fall back to the first configured stage, and tasks
 * without a surviving project are dropped with their project.
 */
export function normalizeStoredTask(
  raw: unknown,
  stages: readonly string[],
  projectIds?: ReadonlySet<string>,
): Task | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;

  const id = sanitizeText(source.id, 120);
  const title = sanitizeText(source.title, 200);
  if (!id || !title) return null;

  const projectId = sanitizeText(source.projectId, 120) ?? "";
  if (projectIds && projectId && !projectIds.has(projectId)) return null;

  const rawStage = sanitizeText(source.stage, MAX_STAGE_LENGTH);
  const stage = isKnownStage(rawStage, stages) ? rawStage : stages[0];

  const rawPriority = source.priority;
  const priority: Priority =
    typeof rawPriority === "number" && [0, 1, 2, 3].includes(rawPriority)
      ? (rawPriority as Priority)
      : 1;

  const createdAt = sanitizeText(source.createdAt, 40) ?? new Date().toISOString();

  return {
    id,
    projectId,
    title,
    category: sanitizeText(source.category, 60) ?? "General",
    stage,
    owner: sanitizeText(source.owner, 120),
    due: sanitizeText(source.due, 40),
    spec: sanitizeText(source.spec),
    notes: sanitizeText(source.notes),
    link: sanitizeLink(source.link),
    priority,
    sort: typeof source.sort === "number" && Number.isFinite(source.sort) ? source.sort : 0,
    archived: source.archived === true,
    prominent: source.prominent === true || priority === 3,
    createdAt,
    updatedAt: sanitizeText(source.updatedAt, 40) ?? createdAt,
  };
}

export function formatTaskText(task: Task, projectName: string): string {
  const lines = [
    `# ${task.title}`,
    `- Project: ${projectName}`,
    `- Stage: ${task.stage}`,
    `- Category: ${task.category}`,
    `- Priority: ${task.priority === 3 ? "Critical" : task.priority === 2 ? "High" : "Normal"}`,
  ];
  if (task.owner) lines.push(`- Owner: ${task.owner}`);
  if (task.due) lines.push(`- Due: ${task.due}`);
  if (task.spec) lines.push(`- Specification: ${task.spec}`);
  if (task.link) lines.push(`- Link: ${task.link}`);
  if (task.notes) lines.push("", task.notes);
  return lines.join("\n");
}
