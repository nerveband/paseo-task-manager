import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
// Load the real RPC definitions, including Paseo's method-name validation.
import "../shared/board-rpc";
import {
  archiveDoneHandler,
  createProjectHandler,
  createTaskHandler,
  updateTaskHandler,
  getBoardHandler,
} from "../server/board-service";

test("mutations retain other projects and archived tasks in the returned board", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "task-manager-service-"));
  const previous = process.env.PASEO_TASK_MANAGER_DATA_DIR;
  process.env.PASEO_TASK_MANAGER_DATA_DIR = temporary;
  // This scenario needs no real agents; only the optional agent-decoration query is isolated.
  const context = { paseo: { agents: { list: async () => ({ entries: [] }) } } } as unknown as PluginHandlerContext;
  try {
    const first = await createProjectHandler({ name: "First" }, context);
    assert.ok(first.snapshot);
    const projectId = first.snapshot.projects[0].id;
    const created = await createTaskHandler({ projectId, title: "Keep this task", category: "General" }, context);
    assert.ok(created.snapshot);
    const taskId = created.snapshot.tasks[0].id;
    await updateTaskHandler({ taskId, archived: true }, context);
    const second = await createProjectHandler({ name: "Second" }, context);
    assert.ok(second.snapshot);
    assert.equal(second.snapshot.tasks.find(task => task.id === taskId)?.archived, true);
    const secondProject = second.snapshot.projects.find(project => project.name === "Second");
    assert.ok(secondProject);
    const added = await createTaskHandler({ projectId: secondProject.id, title: "New task", category: "General" }, context);
    assert.ok(added.snapshot);
    assert.deepEqual(added.snapshot.tasks.map(task => task.projectId).sort(), [projectId, secondProject.id].sort());
    const reloaded = await getBoardHandler({ includeArchived: true }, context);
    assert.equal(reloaded.tasks.find(task => task.id === taskId)?.archived, true);
    const active = await getBoardHandler({ includeArchived: false }, context);
    assert.deepEqual(active.tasks.map(task => task.title), ["New task"]);
  } finally {
    if (previous === undefined) delete process.env.PASEO_TASK_MANAGER_DATA_DIR;
    else process.env.PASEO_TASK_MANAGER_DATA_DIR = previous;
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("archiving done tasks touches only completed tasks in the requested project", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "task-manager-service-"));
  const previous = process.env.PASEO_TASK_MANAGER_DATA_DIR;
  process.env.PASEO_TASK_MANAGER_DATA_DIR = temporary;
  const context = { paseo: { agents: { list: async () => ({ entries: [] }) } } } as unknown as PluginHandlerContext;
  try {
    const first = await createProjectHandler({ name: "First" }, context);
    const second = await createProjectHandler({ name: "Second" }, context);
    assert.ok(first.snapshot && second.snapshot);
    const firstId = first.snapshot.projects[0].id;
    const secondId = second.snapshot.projects.find(project => project.name === "Second")!.id;
    const doneStage = second.snapshot.stages[second.snapshot.stages.length - 1];
    await createTaskHandler({ projectId: firstId, title: "First done", category: "General", stage: doneStage }, context);
    await createTaskHandler({ projectId: firstId, title: "First open", category: "General" }, context);
    await createTaskHandler({ projectId: secondId, title: "Second done", category: "General", stage: doneStage }, context);

    const scoped = await archiveDoneHandler({ projectId: firstId }, context);
    assert.equal(scoped.success, true);
    const archivedTitles = (tasks: { title: string; archived: boolean }[]) =>
      tasks.filter(task => task.archived).map(task => task.title).sort();
    assert.deepEqual(archivedTitles(scoped.snapshot!.tasks), ["First done"]);

    const repeat = await archiveDoneHandler({ projectId: firstId }, context);
    assert.equal(repeat.success, false);

    const everywhere = await archiveDoneHandler({}, context);
    assert.deepEqual(archivedTitles(everywhere.snapshot!.tasks), ["First done", "Second done"]);
  } finally {
    if (previous === undefined) delete process.env.PASEO_TASK_MANAGER_DATA_DIR;
    else process.env.PASEO_TASK_MANAGER_DATA_DIR = previous;
    rmSync(temporary, { recursive: true, force: true });
  }
});
