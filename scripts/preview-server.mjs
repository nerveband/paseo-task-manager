import { build } from "esbuild";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const plugin = root;
export async function startPreview(port = 0) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "paseo-surface-preview-"));
  const oldHome = process.env.PASEO_HOME;
  const oldData = process.env.PASEO_TASK_MANAGER_DATA_DIR;
  process.env.PASEO_HOME = temporary;
  process.env.PASEO_TASK_MANAGER_DATA_DIR = path.join(temporary, "board");
  const handlers = new Map();
  const context = { paseo: { agents: { list: async () => ({ entries: [] }) } } };
  let server;
  async function close() {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    if (oldHome === undefined) delete process.env.PASEO_HOME; else process.env.PASEO_HOME = oldHome;
    if (oldData === undefined) delete process.env.PASEO_TASK_MANAGER_DATA_DIR; else process.env.PASEO_TASK_MANAGER_DATA_DIR = oldData;
    await rm(temporary, { recursive: true, force: true });
  }
  try {
    const serverBundle = path.join(temporary, "server.mjs");
    await build({ entryPoints: [path.join(plugin, "index.server.ts")], bundle: true, platform: "node", format: "esm", outfile: serverBundle });
    const contribution = (await import(pathToFileURL(serverBundle).href)).default;
    contribution({ handle: (contract, handler) => handlers.set(contract.name, { contract, handler }) });
    async function invoke(method, input) {
      const entry = handlers.get(method);
      if (!entry) throw new Error("Unknown preview RPC");
      return entry.contract.output.parse(await entry.handler(entry.contract.input.parse(input), context));
    }
      const result = await invoke("task-manager.create-project", { name: "Website" });
      const projectId = result.snapshot.projects[0].id;
      await invoke("task-manager.create-project", { name: "Documentation" });
      for (const task of [
        { title: "Review navigation", stage: "Todo", priority: 1, spec: "Check labels and keyboard navigation." },
        { title: "Build the settings page", stage: "In progress", priority: 2, spec: "Add account preferences and a clear save state." },
        { title: "Document installation", stage: "Done", priority: 3, spec: "Explain installation and data storage." }
      ]) await invoke("task-manager.create-task", { projectId, category: "General", ...task });
    const browserBundle = await build({
      entryPoints: [path.join(root, "scripts/preview-client.tsx")], bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"development"', __DEV__: "true", global: "globalThis" },
      alias: { "react-native": require.resolve("react-native-web"), "react": path.dirname(require.resolve("react/package.json")), "@getpaseo/plugin/client": path.join(root, "scripts/preview-sdk.ts") }
    });
    const bundle = browserBundle.outputFiles[0].contents;
    server = createServer(async (req, res) => {
      try {
        if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(bundle); }
        if (req.url === "/rpc" && req.method === "POST") {
          if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new Error("Origin rejected");
          let body = "";
          for await (const chunk of req) { body += chunk; if (body.length > 65536) throw new Error("Request too large"); }
          const { method, input } = JSON.parse(body);
          if (/activate|archiveAgent|renameWorkspace/.test(method) || (method === "task-manager.set-source" && input.url)) throw new Error("External actions are disabled in the screenshot preview.");
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify(await invoke(method, input)));
        }
        res.setHeader("Content-Type", "text/html");
        res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated component preview</title><style>html,body,#surface{margin:0;width:100%;height:100%;}#surface{display:flex;flex-direction:column;}</style></head><body><main id="surface"></main><script src="/bundle.js"></script></body></html>');
      } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); }
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
    return { url: `http://127.0.0.1:${server.address().port}`, close };
  } catch (error) { await close(); throw error; }
}
if (process.argv.includes("--serve")) {
  const preview = await startPreview(Number(process.env.PREVIEW_PORT || 0));
  console.log(`Preview ready: ${preview.url}`);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await preview.close(); process.exit(0); });
}
