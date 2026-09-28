import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  BoardFile,
  Project,
  createProjectRecord,
  emptyBoard,
  normalizeStages,
  parseBoardDocument,
  sanitizeProjectName,
} from "../shared/board-model";

/**
 * On-disk state owned by this plugin. Nothing here is repository content, and
 * nothing here is shared with another plugin.
 */

export const RUNTIME_ID = "paseo-task-manager";
export const DATA_DIR_ENV = "PASEO_TASK_MANAGER_DATA_DIR";

export const BOARD_FILE = "board.json";
export const SOURCE_FILE = "source.json";
export const PREFERENCES_FILE = "preferences.json";

export interface SourceConfig {
  /** Explicit user setting. Never defaulted to a remote endpoint. */
  url: string | null;
  /** Project that receives records from the external source. */
  projectId: string | null;
}

export interface Preferences {
  workspaceId: string | null;
  provider: string | null;
}

export interface PluginState {
  board: BoardFile;
  source: SourceConfig;
  preferences: Preferences;
}

/**
 * Default location follows the Paseo plugin data convention. The environment
 * override exists so tests and disposable runtimes never touch user data.
 */
export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = typeof env[DATA_DIR_ENV] === "string" ? env[DATA_DIR_ENV].trim() : "";
  if (override) return path.resolve(override);
  return path.join(env.PASEO_HOME || path.join(os.homedir(), ".paseo"), "plugin-data", RUNTIME_ID);
}

function readJsonFile(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  chmodSync(path.dirname(filePath), 0o700);
  chmodSync(filePath, 0o600);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  const directory = path.dirname(filePath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporaryPath, filePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

/**
 * Reads the board. A file that cannot be parsed is moved aside instead of
 * overwritten, so a damaged board stays recoverable by hand.
 */
export function readBoard(dataDir: string): BoardFile {
  const filePath = path.join(dataDir, BOARD_FILE);
  if (!existsSync(filePath)) return emptyBoard();

  chmodSync(dataDir, 0o700);
  chmodSync(filePath, 0o600);
  const raw = readFileSync(filePath, "utf8");

  try {
    return parseBoardDocument(JSON.parse(raw));
  } catch {
    const quarantine = path.join(dataDir, `board.corrupt-${Date.now()}-${randomUUID()}.json`);
    // Do not allow an empty board to replace a file that could not be preserved.
    renameSync(filePath, quarantine);
    return emptyBoard();
  }
}

export function writeBoard(dataDir: string, board: BoardFile): void {
  writeJsonFile(path.join(dataDir, BOARD_FILE), board);
}

export function readSourceConfig(dataDir: string): SourceConfig {
  const raw = readJsonFile(path.join(dataDir, SOURCE_FILE));
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const url = record.url;
  const projectId = record.projectId;
  return {
    url: typeof url === "string" && url.trim() ? url.trim() : null,
    projectId: typeof projectId === "string" && projectId.trim() ? projectId.trim() : null,
  };
}

export function writeSourceConfig(dataDir: string, config: SourceConfig): void {
  writeJsonFile(path.join(dataDir, SOURCE_FILE), config);
}

export function readPreferences(dataDir: string): Preferences {
  const raw = readJsonFile(path.join(dataDir, PREFERENCES_FILE));
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const workspaceId = typeof record.workspaceId === "string" ? record.workspaceId.trim() : "";
  const provider = typeof record.provider === "string" ? record.provider.trim() : "";
  return {
    workspaceId: workspaceId || null,
    provider: provider || null,
  };
}

export function writePreferences(dataDir: string, preferences: Preferences): void {
  writeJsonFile(path.join(dataDir, PREFERENCES_FILE), preferences);
}

export function readPluginState(dataDir: string): PluginState {
  return {
    board: readBoard(dataDir),
    source: readSourceConfig(dataDir),
    preferences: readPreferences(dataDir),
  };
}

export function findProject(board: BoardFile, projectId: string): Project | undefined {
  return board.projects.find((project) => project.id === projectId);
}

export function findProjectByName(board: BoardFile, name: string): Project | undefined {
  const normalized = name.trim().toLowerCase();
  return board.projects.find((project) => project.name.toLowerCase() === normalized);
}

/** Adds a project, or returns the existing project when the name is taken. */
export function ensureProject(board: BoardFile, name: string): Project {
  const existing = findProjectByName(board, name);
  if (existing) return existing;
  const project = createProjectRecord(sanitizeProjectName(name) ?? "Project");
  board.projects = [...board.projects, project];
  return project;
}

/**
 * Applies a new stage list. Tasks whose stage disappears move to the nearest
 * surviving stage by the previous ordering, preferring the earlier stage on a
 * tie, so completed columns do not silently collapse into the first stage.
 * Returns the reassignment map for reporting.
 */
export function applyStages(
  board: BoardFile,
  stages: readonly string[],
): { board: BoardFile; renamed: Map<string, string> } {
  const normalized = normalizeStages(stages);
  const previousOrder = board.stages;
  const renamed = new Map<string, string>();

  const nearestSurvivor = (stage: string): string => {
    const index = previousOrder.indexOf(stage);
    if (index === -1) return normalized[0];
    let bestStage = normalized[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of normalized) {
      const candidateIndex = previousOrder.indexOf(candidate);
      if (candidateIndex === -1) continue;
      const distance = Math.abs(candidateIndex - index) * 2 + (candidateIndex > index ? 1 : 0);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestStage = candidate;
      }
    }
    return bestStage;
  };

  const nextTasks = board.tasks.map((task) => {
    if (normalized.includes(task.stage)) return task;
    const replacement = nearestSurvivor(task.stage);
    renamed.set(task.stage, replacement);
    return { ...task, stage: replacement, updatedAt: new Date().toISOString() };
  });

  return {
    board: { ...board, stages: normalized, tasks: nextTasks },
    renamed,
  };
}
