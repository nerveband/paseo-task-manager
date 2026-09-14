#!/usr/bin/env node
/**
 * Synthetic screenshot generator for paseo-task-manager.
 * Renders isolated, reproducible mock states of the Task Manager surface
 * across desktop, compact, light, and dark viewports, plus task creation
 * and explicit agent launch dialogs.
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const puppeteerModule = process.env.PUPPETEER_MODULE || require.resolve("puppeteer", {
  paths: [path.join(ROOT_DIR, "..", "paseo-stoplight-dashboard", "node_modules")]
});
const { default: puppeteer } = await import(puppeteerModule);
const ASSETS_DIR = path.join(ROOT_DIR, "assets");
fs.mkdirSync(ASSETS_DIR, { recursive: true });

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Task Manager Preview</title>
  <style>
    :root {
      --bg: #0f1117;
      --surface: #181b24;
      --surface-card: #202431;
      --border: rgba(255, 255, 255, 0.1);
      --border-accent: rgba(99, 102, 241, 0.4);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-text: #ffffff;
      --danger: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
      --tag-bg: rgba(99, 102, 241, 0.15);
      --tag-text: #a5b4fc;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    }

    body.light-mode {
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface-card: #f1f5f9;
      --border: rgba(0, 0, 0, 0.1);
      --border-accent: rgba(99, 102, 241, 0.4);
      --text: #0f172a;
      --text-muted: #64748b;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --accent-text: #ffffff;
      --danger: #dc2626;
      --success: #059669;
      --warning: #d97706;
      --tag-bg: rgba(79, 70, 229, 0.1);
      --tag-text: #4338ca;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Top bar */
    .top-bar {
      height: 56px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      background: var(--surface);
      flex-shrink: 0;
    }

    .title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .app-icon {
      width: 24px;
      height: 24px;
      background: var(--accent);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 800;
      font-size: 14px;
    }

    .app-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .project-select {
      background: var(--surface-card);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
      font-weight: 500;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-primary {
      background: var(--accent);
      color: var(--accent-text);
      border: none;
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-secondary {
      background: var(--surface-card);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }

    /* Subheader summary strip */
    .summary-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .kpi-chips {
      display: flex;
      gap: 12px;
    }

    .kpi-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      background: var(--surface);
      border-radius: 4px;
      border: 1px solid var(--border);
      font-weight: 600;
    }

    .kpi-count {
      color: var(--text);
      font-family: var(--font-mono);
    }

    /* Board columns */
    .board-container {
      flex: 1;
      display: flex;
      gap: 16px;
      padding: 16px 20px;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .column {
      flex: 1;
      min-width: 280px;
      max-width: 380px;
      background: var(--surface);
      border-radius: 8px;
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .column-header {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 700;
    }

    .column-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .column-badge {
      font-size: 11px;
      font-family: var(--font-mono);
      background: var(--surface-card);
      padding: 1px 6px;
      border-radius: 10px;
      color: var(--text-muted);
    }

    .column-cards {
      flex: 1;
      padding: 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Task card */
    .card {
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }

    .card.prominent {
      border-left: 3px solid var(--accent);
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .priority-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--font-mono);
    }

    .p-high { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }
    .p-med { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
    .p-low { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }

    .category-pill {
      font-size: 10px;
      font-weight: 600;
      background: var(--tag-bg);
      color: var(--tag-text);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .card-title {
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.35;
      color: var(--text);
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .card-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
      padding-top: 6px;
      border-top: 1px solid var(--border);
    }

    .agent-status-tag {
      font-size: 10px;
      font-weight: 700;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: var(--font-mono);
    }

    .btn-launch-agent {
      background: rgba(99, 102, 241, 0.12);
      color: var(--accent);
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Modal Overlay */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
    }

    .modal-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title { font-size: 15px; font-weight: 700; }
    .modal-close { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      font-size: 13px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .form-input, .form-select, .form-textarea {
      background: var(--surface-card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
    }

    .form-textarea {
      min-height: 70px;
      resize: vertical;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .prompt-preview {
      background: var(--surface-card);
      border: 1px dashed var(--border);
      border-radius: 6px;
      padding: 10px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: var(--text-muted);
      line-height: 1.4;
      white-space: pre-wrap;
    }

    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: var(--bg);
    }
  </style>
</head>
<body>
  <!-- Top Bar -->
  <header class="top-bar">
    <div class="title-wrap">
      <div class="app-icon">✓</div>
      <div class="app-title">Task Manager</div>
      <select class="project-select" id="projectSelect">
        <option value="all">All Projects (3)</option>
        <option value="p1" selected>Sample Project Alpha</option>
        <option value="p2">Portal Redesign</option>
        <option value="p3">Telemetry Stream</option>
      </select>
    </div>
    <div class="top-actions">
      <button class="btn-secondary" id="btnSettings">⚙ Settings</button>
      <button class="btn-secondary" id="btnNewProject">+ New Project</button>
      <button class="btn-primary" id="btnNewTask">+ New Task</button>
    </div>
  </header>

  <!-- Summary Strip -->
  <div class="summary-strip">
    <div class="kpi-chips">
      <div class="kpi-chip"><span>Todo:</span> <span class="kpi-count">2</span></div>
      <div class="kpi-chip"><span>In progress:</span> <span class="kpi-count">1</span></div>
      <div class="kpi-chip"><span>Done:</span> <span class="kpi-count">2</span></div>
    </div>
    <div><span>3 active tasks · 2 archived</span></div>
  </div>

  <!-- Board Columns -->
  <main class="board-container" id="boardContainer">
    <!-- Column: Todo -->
    <div class="column">
      <div class="column-header">
        <div class="column-title-wrap">
          <span>Todo</span>
          <span class="column-badge">2</span>
        </div>
      </div>
      <div class="column-cards">
        <div class="card prominent">
          <div class="card-top">
            <span class="priority-badge p-high">P1 HIGH</span>
            <span class="category-pill">Backend</span>
          </div>
          <div class="card-title">Configure automated database schema verification probes</div>
          <div class="card-meta">
            <span>👤 Alex Rivera</span>
            <span>📅 2026-09-20</span>
          </div>
          <div class="card-actions">
            <span style="font-size:10px;color:var(--text-muted)">ID: tsk_9481a</span>
            <button class="btn-launch-agent" onclick="openAgentModal()">🤖 Launch Agent</button>
          </div>
        </div>

        <div class="card">
          <div class="card-top">
            <span class="priority-badge p-med">P2 MED</span>
            <span class="category-pill">Testing</span>
          </div>
          <div class="card-title">Add idempotency key tests for webhook ingestion</div>
          <div class="card-meta">
            <span>👤 Jordan Lee</span>
            <span>📅 2026-09-24</span>
          </div>
          <div class="card-actions">
            <span style="font-size:10px;color:var(--text-muted)">ID: tsk_9482b</span>
            <button class="btn-launch-agent" onclick="openAgentModal()">🤖 Launch Agent</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Column: In progress -->
    <div class="column">
      <div class="column-header">
        <div class="column-title-wrap">
          <span>In progress</span>
          <span class="column-badge">1</span>
        </div>
      </div>
      <div class="column-cards">
        <div class="card prominent">
          <div class="card-top">
            <span class="priority-badge p-high">P1 HIGH</span>
            <span class="category-pill">Security</span>
          </div>
          <div class="card-title">Migrate token validation to official SDK RPC contracts</div>
          <div class="card-meta">
            <span>👤 Taylor Reed</span>
            <span>📅 2026-09-18</span>
          </div>
          <div class="card-actions">
            <div class="agent-status-tag">● Agent active</div>
            <button class="btn-launch-agent" onclick="openAgentModal()">🤖 Inspect</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Column: Done -->
    <div class="column">
      <div class="column-header">
        <div class="column-title-wrap">
          <span>Done</span>
          <span class="column-badge">2</span>
        </div>
      </div>
      <div class="column-cards">
        <div class="card">
          <div class="card-top">
            <span class="priority-badge p-low">P3 LOW</span>
            <span class="category-pill">Infra</span>
          </div>
          <div class="card-title">Refactor connection pool timeout handling</div>
          <div class="card-meta">
            <span>👤 Sam Patel</span>
            <span>Completed</span>
          </div>
          <div class="card-actions">
            <span style="font-size:10px;color:var(--text-muted)">ID: tsk_8910c</span>
            <span style="font-size:11px;color:var(--success)">✓ Closed</span>
          </div>
        </div>

        <div class="card">
          <div class="card-top">
            <span class="priority-badge p-med">P2 MED</span>
            <span class="category-pill">Docs</span>
          </div>
          <div class="card-title">Document external task source wire specification</div>
          <div class="card-meta">
            <span>👤 Morgan Chen</span>
            <span>Completed</span>
          </div>
          <div class="card-actions">
            <span style="font-size:10px;color:var(--text-muted)">ID: tsk_8911d</span>
            <span style="font-size:11px;color:var(--success)">✓ Closed</span>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Create Task Modal -->
  <div class="modal-overlay" id="createTaskModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">New Task</div>
        <button class="modal-close" onclick="closeModals()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input type="text" class="form-input" value="Implement rate limiter middleware for public endpoints">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project</label>
            <select class="form-select">
              <option selected>Sample Project Alpha</option>
              <option>Portal Redesign</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Stage</label>
            <select class="form-select">
              <option selected>Todo</option>
              <option>In progress</option>
              <option>Done</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <input type="text" class="form-input" value="Security">
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-select">
              <option>P0 Critical</option>
              <option selected>P1 High</option>
              <option>P2 Medium</option>
              <option>P3 Low</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Owner</label>
            <input type="text" class="form-input" value="Alex Rivera">
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-input" value="2026-09-28">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Specification / Notes</label>
          <textarea class="form-textarea">Token bucket algorithm with 60 req/min limit per client IP.</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeModals()">Cancel</button>
        <button class="btn-primary">Create Task</button>
      </div>
    </div>
  </div>

  <!-- Agent Launch Modal -->
  <div class="modal-overlay" id="agentLaunchModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">Launch Agent for Task</div>
        <button class="modal-close" onclick="closeModals()">✕</button>
      </div>
      <div class="modal-body">
        <div style="background:var(--surface-card);padding:10px;border-radius:6px;border:1px solid var(--border);">
          <div style="font-weight:700;font-size:13.5px;">Configure automated database schema verification probes</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Project: Sample Project Alpha · Category: Backend · P1</div>
        </div>

        <div class="form-group">
          <label class="form-label">Workspace *</label>
          <select class="form-select" id="workspaceSelect">
            <option selected>sample-project-alpha (Local /home/user/src/sample-project-alpha)</option>
            <option>portal-redesign (Local /home/user/src/portal-redesign)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Provider & Model *</label>
          <select class="form-select" id="providerSelect">
            <option selected>Anthropic · Claude 3.5 Sonnet</option>
            <option>OpenAI · GPT-4o</option>
            <option>Google · Gemini 2.0 Flash</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Prompt Preview</label>
          <div class="prompt-preview">Task: Configure automated database schema verification probes

Project: Sample Project Alpha
Stage: Todo
Category: Backend
Owner: Alex Rivera
Due: 2026-09-20

Work in this workspace until the task is complete.
Read the existing project files and conventions before changing anything.
Run the checks that apply to the changed files.
Finish with a short summary of what changed and how it was verified.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeModals()">Cancel</button>
        <button class="btn-primary">🤖 Launch Agent</button>
      </div>
    </div>
  </div>

  <script>
    function openCreateModal() {
      closeModals();
      document.getElementById('createTaskModal').style.display = 'flex';
    }
    function openAgentModal() {
      closeModals();
      document.getElementById('agentLaunchModal').style.display = 'flex';
    }
    function closeModals() {
      document.getElementById('createTaskModal').style.display = 'none';
      document.getElementById('agentLaunchModal').style.display = 'none';
    }
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(HTML_CONTENT);
});

server.listen(6897, "127.0.0.1", async () => {
  console.log("Mock Task Manager running on http://127.0.0.1:6897");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // 1. Overview Desktop Dark
    const pageDark = await browser.newPage();
    await pageDark.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await pageDark.goto("http://127.0.0.1:6897", { waitUntil: "networkidle0" });
    await pageDark.waitForSelector(".card", { timeout: 5000 });
    const overviewDarkPath = path.join(ASSETS_DIR, "task-manager-overview-dark.png");
    await pageDark.screenshot({ path: overviewDarkPath, type: "png" });
    fs.copyFileSync(overviewDarkPath, path.join(ASSETS_DIR, "task-manager-overview.png"));
    console.log(`Saved: ${overviewDarkPath}`);

    // 2. Overview Desktop Light
    const pageLight = await browser.newPage();
    await pageLight.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await pageLight.goto("http://127.0.0.1:6897", { waitUntil: "networkidle0" });
    await pageLight.evaluate(() => document.body.classList.add("light-mode"));
    await new Promise((r) => setTimeout(r, 200));
    const overviewLightPath = path.join(ASSETS_DIR, "task-manager-overview-light.png");
    await pageLight.screenshot({ path: overviewLightPath, type: "png" });
    console.log(`Saved: ${overviewLightPath}`);

    // 3. Compact View Dark (540x800)
    const pageCompact = await browser.newPage();
    await pageCompact.setViewport({ width: 540, height: 800, deviceScaleFactor: 2 });
    await pageCompact.goto("http://127.0.0.1:6897", { waitUntil: "networkidle0" });
    await pageCompact.waitForSelector(".card", { timeout: 5000 });
    const compactPath = path.join(ASSETS_DIR, "task-manager-compact.png");
    await pageCompact.screenshot({ path: compactPath, type: "png" });
    console.log(`Saved: ${compactPath}`);

    // 4. Create Task Modal
    const pageCreate = await browser.newPage();
    await pageCreate.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await pageCreate.goto("http://127.0.0.1:6897", { waitUntil: "networkidle0" });
    await pageCreate.evaluate(() => openCreateModal());
    await new Promise((r) => setTimeout(r, 200));
    const createPath = path.join(ASSETS_DIR, "task-manager-create-task.png");
    await pageCreate.screenshot({ path: createPath, type: "png" });
    console.log(`Saved: ${createPath}`);

    // 5. Agent Launch Modal
    const pageAgent = await browser.newPage();
    await pageAgent.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await pageAgent.goto("http://127.0.0.1:6897", { waitUntil: "networkidle0" });
    await pageAgent.evaluate(() => openAgentModal());
    await new Promise((r) => setTimeout(r, 200));
    const agentPath = path.join(ASSETS_DIR, "task-manager-agent-launch.png");
    await pageAgent.screenshot({ path: agentPath, type: "png" });
    console.log(`Saved: ${agentPath}`);
  } catch (err) {
    console.error("Error generating Task Manager screenshots:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
    console.log("Task Manager screenshots generation complete.");
  }
});
