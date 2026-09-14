import type { PaseoApi } from "@getpaseo/client";
import type { Task } from "../shared/board-model";

/**
 * Agent launching is explicit twice over: the user picks the workspace and the
 * provider/model, and nothing is created until the launch button is pressed.
 * There is no built-in provider default and no workspace guessing.
 */

export interface WorkspaceOption {
  id: string;
  label: string;
  directory: string | null;
}

export interface ProviderOption {
  /** Provider and model in the `provider/model` format Paseo expects. */
  value: string;
  label: string;
}

interface WorkspaceLike {
  id?: unknown;
  workspaceId?: unknown;
  title?: unknown;
  name?: unknown;
  directory?: unknown;
  workspaceDirectory?: unknown;
  projectRootPath?: unknown;
}

export async function listWorkspaceOptions(paseo: PaseoApi): Promise<WorkspaceOption[]> {
  const result = await paseo.workspaces.list();
  const entries = (result.entries ?? []) as WorkspaceLike[];
  return entries
    .map((entry) => {
      const id = typeof entry.id === "string" ? entry.id : typeof entry.workspaceId === "string" ? entry.workspaceId : "";
      if (!id) return null;
      const directory =
        typeof entry.directory === "string"
          ? entry.directory
          : typeof entry.workspaceDirectory === "string"
            ? entry.workspaceDirectory
            : typeof entry.projectRootPath === "string"
              ? entry.projectRootPath
              : null;
      const title = typeof entry.title === "string" ? entry.title.trim() : "";
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const label = title || name || (directory ? directory.split("/").filter(Boolean).pop() ?? directory : id);
      return { id, label, directory };
    })
    .filter((entry): entry is WorkspaceOption => entry !== null);
}

export async function listProviderOptions(paseo: PaseoApi): Promise<ProviderOption[]> {
  const snapshot = await paseo.providers.snapshot();
  const options: ProviderOption[] = [];
  for (const entry of snapshot.entries ?? []) {
    if (entry.enabled === false) continue;
    const providerLabel =
      typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : entry.provider;
    for (const model of entry.models ?? []) {
      if (model.isSelectable === false) continue;
      options.push({
        value: `${entry.provider}/${model.id}`,
        label: `${providerLabel} · ${model.label || model.id}`,
      });
    }
  }
  return options;
}

export function buildTaskPrompt(task: Task, projectName: string): string {
  const lines = [
    `Task: ${task.title}`,
    "",
    `Project: ${projectName}`,
    `Stage: ${task.stage}`,
    `Category: ${task.category}`,
  ];
  if (task.owner) lines.push(`Owner: ${task.owner}`);
  if (task.due) lines.push(`Due: ${task.due}`);
  if (task.spec) lines.push(`Specification: ${task.spec}`);
  if (task.link) lines.push(`Reference: ${task.link}`);
  if (task.notes) lines.push("", "Notes:", task.notes);
  lines.push(
    "",
    "Work in this workspace until the task is complete.",
    "Read the existing project files and conventions before changing anything.",
    "Run the checks that apply to the changed files.",
    "Finish with a short summary of what changed and how it was verified.",
  );
  return lines.join("\n");
}

export interface LaunchAgentInput {
  task: Task;
  projectName: string;
  workspaceId: string;
  provider: string;
}

export interface LaunchedAgent {
  agentId: string;
  workspaceId: string;
  title: string;
}

export async function launchAgentForTask(
  paseo: PaseoApi,
  input: LaunchAgentInput,
): Promise<LaunchedAgent> {
  if (!input.workspaceId) throw new Error("Choose a workspace before starting an agent.");
  if (!input.provider) throw new Error("Choose a provider and model before starting an agent.");

  const title = input.task.title.slice(0, 80);
  const handle = paseo.workspaces.ref(input.workspaceId);
  const agent = await handle.agents.create({
    config: { provider: input.provider },
    title,
    prompt: buildTaskPrompt(input.task, input.projectName),
    labels: {
      "task-id": input.task.id,
      source: "paseo-task-manager",
    },
  });

  return { agentId: agent.id, workspaceId: input.workspaceId, title };
}
