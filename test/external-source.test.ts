import assert from "node:assert/strict";
import test from "node:test";
import { fetchExternalTasks, normalizeExternalRecord, validateSourceUrl } from "../server/external-source";

const projects = [{ id: "prj_1", name: "Website", createdAt: "2026-01-01T00:00:00.000Z" }];
const stages = ["Todo", "In progress", "Done"];

test("source URLs must be explicit http(s) endpoints", () => {
  assert.equal(validateSourceUrl("https://example.com/tasks.json"), "https://example.com/tasks.json");
  assert.equal(validateSourceUrl("file:///etc/passwd"), null);
  assert.equal(validateSourceUrl("https://user:secret@example.com/tasks.json"), null);
  assert.equal(validateSourceUrl(""), null);
  assert.equal(validateSourceUrl(undefined), null);
});

test("records map onto configured projects and stages", () => {
  const warnings = new Map<string, number>();
  const task = normalizeExternalRecord(
    {
      id: "rec-1",
      title: "Refresh the landing page",
      project: "website",
      stage: "In progress",
      link: "https://example.com/brief",
    },
    { stages, projects, fallbackProjectId: "prj_1" },
    warnings,
  );

  assert.equal(task?.projectId, "prj_1");
  assert.equal(task?.stage, "In progress");
  assert.equal(task?.id, "ext_rec-1");
  assert.equal(warnings.size, 0);
});

test("an unknown stage is reported and parked in the first stage", () => {
  const warnings = new Map<string, number>();
  const task = normalizeExternalRecord(
    { id: "rec-2", title: "Legacy item", stage: "Escalated" },
    { stages, projects, fallbackProjectId: "prj_1" },
    warnings,
  );

  assert.equal(task?.stage, "Todo");
  assert.equal(warnings.get("Escalated"), 1);
});

test("a record for an unknown project uses the assigned project", () => {
  const warnings = new Map<string, number>();
  const task = normalizeExternalRecord(
    { id: "rec-3", title: "Other team work", project: "Somewhere else" },
    { stages, projects, fallbackProjectId: "prj_1" },
    warnings,
  );
  assert.equal(task?.projectId, "prj_1");
});

test("records without an id or title are dropped", () => {
  const warnings = new Map<string, number>();
  const context = { stages, projects, fallbackProjectId: "prj_1" };
  assert.equal(normalizeExternalRecord({ title: "No id" }, context, warnings), null);
  assert.equal(normalizeExternalRecord({ id: "rec-4" }, context, warnings), null);
});

test("fetching follows pagination and reports an HTTP failure without throwing", async () => {
  const pages: Record<string, unknown> = {
    "0": {
      records: [{ id: "a", title: "First" }],
      nextCursor: "page-2",
    },
    "page-2": {
      records: [{ id: "b", title: "Second" }],
      nextCursor: null,
    },
  };

  const ok = await fetchExternalTasks("https://example.com/tasks.json", {
    stages,
    projects,
    fallbackProjectId: "prj_1",
    fetchImpl: async (input: string | URL | Request) => {
      const cursor = new URL(String(input)).searchParams.get("cursor") ?? "0";
      return new Response(JSON.stringify(pages[cursor]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.deepEqual(
    ok.tasks.map((task) => task.id),
    ["ext_a", "ext_b"],
  );
  assert.deepEqual(ok.warnings, []);

  const failing = await fetchExternalTasks("https://example.com/tasks.json", {
    stages,
    projects,
    fallbackProjectId: "prj_1",
    fetchImpl: async () => new Response("nope", { status: 503 }),
  });

  assert.deepEqual(failing.tasks, []);
  assert.equal(failing.warnings.length, 1);
  assert.match(failing.warnings[0], /HTTP 503/);
});

test("a network failure is reported as a warning, never as a fallback fetch", async () => {
  const calls: string[] = [];
  const result = await fetchExternalTasks("https://example.com/tasks.json", {
    stages,
    projects,
    fallbackProjectId: "prj_1",
    fetchImpl: async (input: string | URL | Request) => {
      calls.push(String(input));
      throw new Error("connection refused");
    },
  });

  assert.deepEqual(result.tasks, []);
  assert.equal(calls.length, 1);
  assert.match(result.warnings[0], /could not be reached/);
});

test("an invalid configured URL never reaches the network", async () => {
  let called = false;
  const result = await fetchExternalTasks("ftp://example.com/tasks.json", {
    stages,
    projects,
    fallbackProjectId: "prj_1",
    fetchImpl: async () => {
      called = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(called, false);
  assert.match(result.warnings[0], /not a valid http\(s\) URL/);
});
