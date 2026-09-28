import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createTaskRecord, emptyBoard, parseBoardDocument } from "../shared/board-model";
import {
  BOARD_FILE,
  applyStages,
  readBoard,
  readPluginState,
  readPreferences,
  readSourceConfig,
  resolveDataDir,
  writeBoard,
  writePreferences,
  writeSourceConfig,
} from "../server/board-store";

function withTempDataDir(run: (dataDir: string) => void) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "task-manager-store-"));
  try {
    run(dataDir);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test("the data directory is explicit or follows the Paseo convention", () => {
  assert.equal(
    resolveDataDir({ PASEO_TASK_MANAGER_DATA_DIR: "/tmp/explicit" }),
    path.resolve("/tmp/explicit"),
  );
  const fallback = resolveDataDir({});
  assert.ok(fallback.endsWith(path.join(".paseo", "plugin-data", "paseo-task-manager")));
});

test("board, settings and recovery files remain owner-only", { skip: process.platform === "win32" }, () => {
  withTempDataDir((dataDir) => {
    chmodSync(dataDir, 0o755);
    writeBoard(dataDir, emptyBoard());
    writeSourceConfig(dataDir, { url: null, projectId: null });
    writePreferences(dataDir, { workspaceId: null, provider: null });
    assert.equal(statSync(dataDir).mode & 0o777, 0o700);
    for (const name of readdirSync(dataDir)) {
      assert.equal(statSync(path.join(dataDir, name)).mode & 0o777, 0o600);
    }
    const boardPath = path.join(dataDir, BOARD_FILE);
    writeFileSync(boardPath, "{damaged");
    chmodSync(boardPath, 0o644);
    readBoard(dataDir);
    const backup = readdirSync(dataDir).find((name) => name.startsWith("board.corrupt-"))!;
    assert.equal(readFileSync(path.join(dataDir, backup), "utf8"), "{damaged");
    assert.equal(statSync(path.join(dataDir, backup)).mode & 0o777, 0o600);
  });
});

test("a board survives a write and read round trip", () => {
  withTempDataDir((dataDir) => {
    const board = emptyBoard();
    board.projects.push({ id: "prj_1", name: "Website", createdAt: "2026-01-01T00:00:00.000Z" });
    board.tasks.push(
      createTaskRecord(
        { projectId: "prj_1", title: "Draft copy", category: "Writing", stage: "Todo" },
        new Date("2026-01-02T00:00:00.000Z"),
      ),
    );

    writeBoard(dataDir, board);
    const reloaded = readBoard(dataDir);

    assert.equal(reloaded.tasks.length, 1);
    assert.equal(reloaded.tasks[0].title, "Draft copy");
    assert.deepEqual(reloaded.stages, ["Todo", "In progress", "Done"]);
  });
});

test("a damaged board file is moved aside instead of overwritten", () => {
  withTempDataDir((dataDir) => {
    const filePath = path.join(dataDir, BOARD_FILE);
    writeFileSync(filePath, "{ this is not json", "utf8");

    const board = readBoard(dataDir);

    assert.deepEqual(board.tasks, []);
    assert.equal(existsSync(filePath), false);
    const quarantined = readdirSync(dataDir).filter((name) => name.startsWith("board.corrupt-"));
    assert.equal(quarantined.length, 1);
    assert.equal(
      readFileSync(path.join(dataDir, quarantined[0]), "utf8"),
      "{ this is not json",
    );
  });
});

test("removing a stage moves its tasks to the nearest remaining stage", () => {
  const board = parseBoardDocument({
    version: 1,
    projects: [{ id: "p1", name: "Website", createdAt: "2026-01-01T00:00:00.000Z" }],
    stages: ["Todo", "In progress", "Done"],
    tasks: [
      { id: "t1", title: "A", projectId: "p1", stage: "In progress" },
      { id: "t2", title: "B", projectId: "p1", stage: "Done" },
      { id: "t3", title: "C", projectId: "p1", stage: "Todo" },
    ],
  });

  const { board: next, renamed } = applyStages(board, ["Todo", "Done"]);

  assert.deepEqual(next.stages, ["Todo", "Done"]);
  assert.equal(next.tasks.find((task) => task.id === "t1")?.stage, "Todo");
  assert.equal(next.tasks.find((task) => task.id === "t2")?.stage, "Done");
  assert.equal(renamed.get("In progress"), "Todo");
});

test("source and preference files stay independent of board content", () => {
  withTempDataDir((dataDir) => {
    writeSourceConfig(dataDir, { url: "https://example.com/tasks.json", projectId: "prj_1" });
    writePreferences(dataDir, { workspaceId: "wks_1", provider: "sample/quick" });

    const state = readPluginState(dataDir);

    assert.deepEqual(readSourceConfig(dataDir), {
      url: "https://example.com/tasks.json",
      projectId: "prj_1",
    });
    assert.deepEqual(readPreferences(dataDir), { workspaceId: "wks_1", provider: "sample/quick" });
    assert.equal(state.board.tasks.length, 0);
  });
});

test("a cleared external source leaves no endpoint behind", () => {
  withTempDataDir((dataDir) => {
    writeSourceConfig(dataDir, { url: "https://example.com/tasks.json", projectId: "prj_1" });
    writeSourceConfig(dataDir, { url: null, projectId: null });
    assert.deepEqual(readSourceConfig(dataDir), { url: null, projectId: null });
  });
});
