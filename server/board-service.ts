import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import {
  BoardFile,
  Task,
  createProjectRecord,
  createTaskRecord,
  doneStageOf,
  filterTasks,
  sanitizeLink,
  sanitizeProjectName,
  sanitizeText,
  sortTasks,
  summarizeBoard,
} from "../shared/board-model";
import type { BoardSnapshot, MutationResult, SourceState } from "../shared/board-rpc";
import {
  SourceConfig,
  applyStages,
  findProject,
  readPluginState,
  resolveDataDir,
  writeBoard,
  writePreferences,
  writeSourceConfig,
} from "./board-store";
import { fetchExternalTasks, validateSourceUrl } from "./external-source";

/**
 * Server-side board service. Every mutation validates its input against the
 * stored board, then writes the whole document back atomically.
 */

function isExistingProject(board: BoardFile, projectId: unknown): projectId is string {
  return typeof projectId === "string" && board.projects.some((project) => project.id === projectId);
}

function failure(error: string): MutationResult {
  return { success: false, error };
}

async function collectExternalTasks(
  source: SourceConfig,
  board: BoardFile,
): Promise<{ tasks: Task[]; warnings: string[] }> {
  if (!source.url) return { tasks: [], warnings: [] };
  if (!isExistingProject(board, source.projectId)) {
    return {
      tasks: [],
      warnings: ["The external source is not assigned to an existing project."],
    };
  }
  const result = await fetchExternalTasks(source.url, {
    stages: board.stages,
    projects: board.projects,
    fallbackProjectId: source.projectId,
  });
  const localIds = new Set(board.tasks.map((task) => task.id));
  const seen = new Set<string>();
  const tasks: Task[] = [];
  for (const task of result.tasks) {
    if (localIds.has(task.id) || seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push(task);
  }
  return { tasks, warnings: result.warnings };
}

function describeSource(source: SourceConfig, warnings: string[]): SourceState {
  return {
    mode: source.url ? "external" : "local",
    url: source.url,
    projectId: source.projectId,
    warnings,
  };
}

/**
 * Reads agent labels so a task can show whether an agent already belongs to it.
 * Failures are ignored: agent metadata is decoration, never board state.
 */
async function readAgentIndex(
  context: PluginHandlerContext,
): Promise<Record<string, { agentId: string; status: "running" | "idle" }>> {
  const index: Record<string, { agentId: string; status: "running" | "idle" }> = {};
  try {
    const result = await context.paseo.agents.list({ page: { limit: 200 } });
    for (const entry of result.entries ?? []) {
      const agent = entry?.agent;
      const taskId = agent?.labels?.["task-id"];
      if (!taskId || !agent) continue;
      const status = agent.status === "running" ? "running" : agent.status === "idle" ? "idle" : null;
      if (!status) continue;
      index[taskId] = { agentId: agent.id, status };
    }
  } catch {
    // Ignore: the board renders without agent decoration.
  }
  return index;
}

export async function buildSnapshot(
  input: { projectId?: string; includeArchived?: boolean },
  context: PluginHandlerContext,
): Promise<BoardSnapshot> {
  const dataDir = resolveDataDir();
  const { board, source } = readPluginState(dataDir);
  const external = await collectExternalTasks(source, board);

  const merged = sortTasks([...board.tasks, ...external.tasks], board.stages);
  const agentIndex = await readAgentIndex(context);

  const visible = filterTasks(merged, {
    projectId: input.projectId,
    includeArchived: input.includeArchived === true,
  });

  return {
    tasks: visible,
    agents: Object.entries(agentIndex).map(([taskId, info]) => ({
      taskId,
      agentId: info.agentId,
      status: info.status,
    })),
    projects: board.projects,
    stages: board.stages,
    summary: summarizeBoard(merged, board.projects, board.stages),
    source: describeSource(source, external.warnings),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getBoardHandler(
  input: { projectId?: string; includeArchived?: boolean },
  context: PluginHandlerContext,
): Promise<BoardSnapshot> {
  return buildSnapshot(input, context);
}

async function finishMutation(
  dataDir: string,
  board: BoardFile,
  context: PluginHandlerContext,
): Promise<MutationResult> {
  writeBoard(dataDir, board);
  return { success: true, snapshot: await buildSnapshot({ includeArchived: true }, context) };
}

export async function createTaskHandler(
  input: {
    projectId: string;
    title: string;
    category: string;
    stage?: string;
    owner?: string;
    due?: string;
    spec?: string;
    notes?: string;
    link?: string;
    priority?: 0 | 1 | 2 | 3;
    prominent?: boolean;
  },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);

  if (!isExistingProject(board, input.projectId)) {
    return failure("Create the project before adding a task to it.");
  }
  if (input.link && !sanitizeLink(input.link)) {
    return failure("The link must be an http or https URL.");
  }
  const stage = input.stage && board.stages.includes(input.stage) ? input.stage : board.stages[0];

  const task = createTaskRecord({
    projectId: input.projectId,
    title: input.title.trim(),
    category: input.category.trim(),
    stage,
    owner: input.owner,
    due: input.due,
    spec: input.spec,
    notes: input.notes,
    link: input.link,
    priority: input.priority,
    prominent: input.prominent,
  });

  const nextBoard: BoardFile = {
    ...board,
    tasks: [task, ...board.tasks],
  };
  return finishMutation(dataDir, nextBoard, context);
}

export async function updateTaskHandler(
  input: {
    taskId: string;
    title?: string;
    category?: string;
    stage?: string;
    owner?: string;
    due?: string;
    spec?: string;
    notes?: string;
    link?: string;
    priority?: 0 | 1 | 2 | 3;
    prominent?: boolean;
    archived?: boolean;
  },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);

  const index = board.tasks.findIndex((task) => task.id === input.taskId);
  if (index === -1) {
    return failure("That task is not on this board. External tasks are read-only.");
  }
  if (input.stage && !board.stages.includes(input.stage)) {
    return failure(`"${input.stage}" is not one of the configured stages.`);
  }
  if (input.link && !sanitizeLink(input.link)) {
    return failure("The link must be an http or https URL.");
  }

  const current = board.tasks[index];
  const updated: Task = {
    ...current,
    title: input.title?.trim() || current.title,
    category: input.category?.trim() || current.category,
    stage: input.stage ?? current.stage,
    owner: input.owner === undefined ? current.owner : sanitizeText(input.owner, 120),
    due: input.due === undefined ? current.due : sanitizeText(input.due, 40),
    spec: input.spec === undefined ? current.spec : sanitizeText(input.spec),
    notes: input.notes === undefined ? current.notes : sanitizeText(input.notes),
    link: input.link === undefined ? current.link : sanitizeLink(input.link),
    priority: input.priority ?? current.priority,
    prominent: input.prominent ?? current.prominent,
    archived: input.archived ?? current.archived,
    updatedAt: new Date().toISOString(),
  };

  const tasks = [...board.tasks];
  tasks[index] = updated;
  return finishMutation(dataDir, { ...board, tasks }, context);
}

export async function deleteTaskHandler(
  input: { taskId: string },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);

  if (!board.tasks.some((task) => task.id === input.taskId)) {
    return failure("That task is not on this board. External tasks are read-only.");
  }
  const tasks = board.tasks.filter((task) => task.id !== input.taskId);
  return finishMutation(dataDir, { ...board, tasks }, context);
}

/**
 * Archives every completed local task, optionally within one project, in one
 * board write. Archiving is reversible through updateTaskHandler.
 */
export async function archiveDoneHandler(
  input: { projectId?: string },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);

  if (input.projectId !== undefined && !isExistingProject(board, input.projectId)) {
    return failure("That project is not on this board.");
  }
  const done = doneStageOf(board.stages);
  const now = new Date().toISOString();
  let archivedCount = 0;
  const tasks = board.tasks.map((task) => {
    if (task.archived || task.stage !== done) return task;
    if (input.projectId !== undefined && task.projectId !== input.projectId) return task;
    archivedCount += 1;
    return { ...task, archived: true, updatedAt: now };
  });
  if (archivedCount === 0) return failure("There are no completed tasks to archive.");
  return finishMutation(dataDir, { ...board, tasks }, context);
}

export async function searchTasksHandler(
  input: { query: string },
): Promise<{
  items: Array<{
    id: string;
    identifier: string;
    title: string;
    subtitle?: string;
    url: string;
    text: string;
    resourceType: string;
  }>;
}> {
  const dataDir = resolveDataDir();
  const { board, source } = readPluginState(dataDir);
  const external = await collectExternalTasks(source, board);
  const all = sortTasks([...board.tasks, ...external.tasks], board.stages);
  const needle = input.query.trim().toLowerCase();

  const matches = all.filter((task) => {
    if (task.archived) return false;
    if (!needle) return true;
    return [task.title, task.category, task.stage, task.owner ?? "", task.spec ?? "", task.notes ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  const projectName = (projectId: string) =>
    findProject(board, projectId)?.name ?? "Unassigned";

  return {
    items: matches.slice(0, 50).map((task) => ({
      id: task.id,
      identifier: task.id,
      title: task.title,
      subtitle: `${projectName(task.projectId)} · ${task.category} · ${task.stage}`,
      url: task.link ?? `https://task-manager.invalid/task/${encodeURIComponent(task.id)}`,
      text: [
        `# ${task.title}`,
        `- Project: ${projectName(task.projectId)}`,
        `- Stage: ${task.stage}`,
        `- Category: ${task.category}`,
        task.spec ? `- Specification: ${task.spec}` : "",
        task.notes ?? "",
      ]
        .filter(Boolean)
        .join("\n"),
      resourceType: "task",
    })),
  };
}

export async function createProjectHandler(
  input: { name: string },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);
  const name = sanitizeProjectName(input.name);
  if (!name) return failure("A project name is required.");
  if (board.projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) {
    return failure(`A project named "${name}" already exists.`);
  }

  const project = createProjectRecord(name);
  const nextBoard: BoardFile = { ...board, projects: [...board.projects, project] };
  return finishMutation(dataDir, nextBoard, context);
}

export async function renameProjectHandler(
  input: { projectId: string; name: string },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);
  const project = findProject(board, input.projectId);
  if (!project) return failure("That project does not exist.");

  const name = sanitizeProjectName(input.name);
  if (!name) return failure("A project name is required.");
  if (
    board.projects.some(
      (candidate) => candidate.id !== project.id && candidate.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return failure(`A project named "${name}" already exists.`);
  }

  const projects = board.projects.map((candidate) =>
    candidate.id === project.id ? { ...candidate, name } : candidate,
  );
  return finishMutation(dataDir, { ...board, projects }, context);
}

export async function deleteProjectHandler(
  input: { projectId: string; deleteTasks: boolean },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);
  const project = findProject(board, input.projectId);
  if (!project) return failure("That project does not exist.");

  const owned = board.tasks.filter((task) => task.projectId === project.id);
  if (owned.length > 0 && !input.deleteTasks) {
    return failure(
      `"${project.name}" still holds ${owned.length} task${owned.length === 1 ? "" : "s"}. Confirm deletion to remove them.`,
    );
  }

  const nextBoard: BoardFile = {
    ...board,
    projects: board.projects.filter((candidate) => candidate.id !== project.id),
    tasks: board.tasks.filter((task) => task.projectId !== project.id),
  };
  return finishMutation(dataDir, nextBoard, context);
}

export async function setStagesHandler(
  input: { stages: string[] },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);
  const { board: nextBoard, renamed } = applyStages(board, input.stages);

  if (nextBoard.stages.length === 0) {
    return failure("At least one stage is required.");
  }
  const result = await finishMutation(dataDir, nextBoard, context);
  if (result.success && renamed.size > 0 && result.snapshot) {
    const moves = Array.from(renamed, ([from, to]) => `${from} to ${to}`).join(", ");
    return { ...result, error: `Removed stages reassigned: ${moves}.` };
  }
  return result;
}

export async function setSourceHandler(
  input: { url: string | null; projectId: string | null },
  context: PluginHandlerContext,
): Promise<MutationResult> {
  const dataDir = resolveDataDir();
  const { board } = readPluginState(dataDir);

  if (!input.url) {
    writeSourceConfig(dataDir, { url: null, projectId: null });
    return { success: true, snapshot: await buildSnapshot({ includeArchived: true }, context) };
  }

  const url = validateSourceUrl(input.url);
  if (!url) {
    return failure("Enter an http or https URL without embedded credentials.");
  }
  if (!isExistingProject(board, input.projectId)) {
    return failure("Choose the project that receives tasks from this source.");
  }

  writeSourceConfig(dataDir, { url, projectId: input.projectId });
  return { success: true, snapshot: await buildSnapshot({ includeArchived: true }, context) };
}

export async function getPreferencesHandler(): Promise<{
  workspaceId: string | null;
  provider: string | null;
}> {
  const { preferences } = readPluginState(resolveDataDir());
  return preferences;
}

export async function setPreferencesHandler(input: {
  workspaceId?: string | null;
  provider?: string | null;
}): Promise<{ workspaceId: string | null; provider: string | null }> {
  const dataDir = resolveDataDir();
  const current = readPluginState(dataDir).preferences;
  const next = {
    workspaceId:
      input.workspaceId === undefined
        ? current.workspaceId
        : sanitizeText(input.workspaceId, 120),
    provider:
      input.provider === undefined ? current.provider : sanitizeText(input.provider, 120),
  };
  writePreferences(dataDir, next);
  return next;
}
