import assert from "node:assert/strict";
import test from "node:test";
import {
  createTaskRecord,
  doneStageOf,
  filterTasks,
  normalizeStages,
  normalizeStoredTask,
  parseBoardDocument,
  sanitizeLink,
  sortTasks,
  summarizeBoard,
} from "../shared/board-model";

test("stages are user data with sane normalization", async (t) => {
  await t.test("an empty or invalid list falls back to the default stages", () => {
    assert.deepEqual(normalizeStages([]), ["Todo", "In progress", "Done"]);
    assert.deepEqual(normalizeStages("Todo"), ["Todo", "In progress", "Done"]);
    assert.deepEqual(normalizeStages(["   ", ""]), ["Todo", "In progress", "Done"]);
  });

  await t.test("duplicates are removed case-insensitively and order is preserved", () => {
    assert.deepEqual(normalizeStages(["Backlog", "Doing", "backlog"]), ["Backlog", "Doing"]);
  });

  await t.test("the last stage is the done stage", () => {
    assert.equal(doneStageOf(["Backlog", "Doing", "Shipped"]), "Shipped");
  });
});

test("stored records are repaired rather than dropped where possible", async (t) => {
  const stages = ["Todo", "In progress", "Done"];

  await t.test("a record without an id or title is dropped", () => {
    assert.equal(normalizeStoredTask({ title: "No id" }, stages), null);
    assert.equal(normalizeStoredTask({ id: "a1" }, stages), null);
  });

  await t.test("an unknown stage falls back to the first stage", () => {
    const task = normalizeStoredTask({ id: "a1", title: "Ship", stage: "Retired" }, stages);
    assert.equal(task?.stage, "Todo");
  });

  await t.test("a task whose project no longer exists is dropped", () => {
    const task = normalizeStoredTask(
      { id: "a1", title: "Ship", projectId: "prj_gone" },
      stages,
      new Set(["prj_alive"]),
    );
    assert.equal(task, null);
  });

  await t.test("non-http links are discarded", () => {
    assert.equal(sanitizeLink("javascript:alert(1)"), null);
    assert.equal(sanitizeLink("not a url"), null);
    assert.equal(sanitizeLink("https://example.com/spec"), "https://example.com/spec");
  });
});

test("a stored document loads forward without losing tasks", () => {
  const parsed = parseBoardDocument({
    version: 1,
    projects: [{ id: "prj_1", name: "Website", createdAt: "2026-01-01T00:00:00.000Z" }],
    stages: ["Backlog", "Doing", "Shipped"],
    tasks: [
      { id: "t1", title: "Draft copy", projectId: "prj_1", stage: "Backlog" },
      { id: "t2", title: "Orphan", projectId: "prj_missing", stage: "Doing" },
      { title: "No id", projectId: "prj_1" },
    ],
  });

  assert.deepEqual(parsed.stages, ["Backlog", "Doing", "Shipped"]);
  assert.equal(parsed.projects.length, 1);
  assert.deepEqual(
    parsed.tasks.map((task) => task.id),
    ["t1"],
  );
  assert.equal(parsed.tasks[0].category, "General");
});

test("filtering selects by project, stage, text, and archive state", () => {
  const stages = ["Todo", "Doing", "Done"];
  const base = {
    category: "General",
    owner: null,
    due: null,
    spec: null,
    notes: null,
    link: null,
    priority: 1 as const,
    sort: 0,
    archived: false,
    prominent: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const tasks = [
    { ...base, id: "t1", title: "Write brief", projectId: "p1", stage: "Todo" },
    { ...base, id: "t2", title: "Design page", projectId: "p1", stage: "Done" },
    { ...base, id: "t3", title: "Ship fix", projectId: "p2", stage: "Doing" },
    { ...base, id: "t4", title: "Old idea", projectId: "p2", stage: "Todo", archived: true },
  ];

  assert.deepEqual(
    filterTasks(tasks, { projectId: "p1" }).map((task) => task.id),
    ["t1", "t2"],
  );
  assert.deepEqual(
    filterTasks(tasks, { stage: "Todo" }).map((task) => task.id),
    ["t1"],
  );
  assert.deepEqual(
    filterTasks(tasks, { query: "design" }).map((task) => task.id),
    ["t2"],
  );
  assert.deepEqual(
    filterTasks(tasks, { includeArchived: true }).map((task) => task.id),
    ["t1", "t2", "t3", "t4"],
  );
  assert.equal(stages.length, 3);
});

test("sorting keeps open and prominent work first and completed work last", () => {
  const stages = ["Todo", "Doing", "Done"];
  const base = {
    category: "General",
    owner: null,
    due: null,
    spec: null,
    notes: null,
    link: null,
    sort: 0,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const tasks = [
    { ...base, id: "done", title: "Finished", projectId: "p1", stage: "Done", priority: 3 as const, prominent: true },
    { ...base, id: "normal", title: "Normal", projectId: "p1", stage: "Todo", priority: 1 as const, prominent: false },
    { ...base, id: "urgent", title: "Urgent", projectId: "p1", stage: "Todo", priority: 2 as const, prominent: true },
  ];

  assert.deepEqual(
    sortTasks(tasks, stages).map((task) => task.id),
    ["urgent", "normal", "done"],
  );
});

test("the summary counts only live tasks per stage", () => {
  const stages = ["Todo", "Done"];
  const project = { id: "p1", name: "Website", createdAt: "2026-01-01T00:00:00.000Z" };
  const base = {
    category: "General",
    owner: null,
    due: null,
    spec: null,
    notes: null,
    link: null,
    priority: 1 as const,
    sort: 0,
    archived: false,
    prominent: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    projectId: "p1",
  };
  const summary = summarizeBoard(
    [
      { ...base, id: "t1", title: "A", stage: "Todo" },
      { ...base, id: "t2", title: "B", stage: "Done" },
      { ...base, id: "t3", title: "C", stage: "Todo", archived: true },
    ],
    [project],
    stages,
  );

  assert.equal(summary.total, 2);
  assert.equal(summary.open, 1);
  assert.equal(summary.done, 1);
  assert.equal(summary.archived, 1);
  assert.deepEqual(summary.byStage, [
    { stage: "Todo", count: 1 },
    { stage: "Done", count: 1 },
  ]);
  assert.deepEqual(summary.byProject, [{ projectId: "p1", total: 2, open: 1 }]);
});

test("created tasks carry user input, not defaults from a host", () => {
  const task = createTaskRecord(
    {
      projectId: "p1",
      title: "  Draft copy  ",
      category: "Writing",
      stage: "Todo",
      link: "https://example.com/brief",
    },
    new Date("2026-02-02T00:00:00.000Z"),
  );

  assert.equal(task.title, "Draft copy");
  assert.equal(task.link, "https://example.com/brief");
  assert.equal(task.owner, null);
  assert.equal(task.prominent, false);
  assert.match(task.id, /^tsk_/);
  assert.equal(task.createdAt, "2026-02-02T00:00:00.000Z");
});
