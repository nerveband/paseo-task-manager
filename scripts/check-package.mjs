#!/usr/bin/env node
/**
 * Validates package manifest, plugin descriptor, and required runtime entry points.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const pkgPath = path.join(ROOT, "package.json");
if (!existsSync(pkgPath)) {
  console.error("check-package: package.json missing");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
if (pkg.name !== "paseo-task-manager") {
  console.error(`check-package: unexpected package name "${pkg.name}", expected "paseo-task-manager"`);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+/.test(pkg.version)) {
  console.error(`check-package: invalid semver "${pkg.version}"`);
  process.exit(1);
}

const pluginJsonPath = path.join(ROOT, "paseo-plugin.json");
if (!existsSync(pluginJsonPath)) {
  console.error("check-package: paseo-plugin.json missing");
  process.exit(1);
}

const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf8"));
if (pluginJson.id !== "paseo-task-manager") {
  console.error(`check-package: unexpected plugin id "${pluginJson.id}", expected "paseo-task-manager"`);
  process.exit(1);
}

if (!pluginJson.requirements?.paseo) {
  console.error("check-package: missing requirements.paseo in paseo-plugin.json");
  process.exit(1);
}

const requiredEntries = [
  "index.client.tsx",
  "index.server.ts",
  "shared/board-model.ts",
  "shared/board-rpc.ts",
  "server/board-service.ts",
  "server/board-store.ts",
  "client/board-view.tsx",
];

for (const entry of requiredEntries) {
  const fullPath = path.join(ROOT, entry);
  if (!existsSync(fullPath)) {
    console.error(`check-package: required entry missing: ${entry}`);
    process.exit(1);
  }
}

console.log("check-package: ok");
