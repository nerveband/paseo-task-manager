#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { inc } from "semver";
const root = path.resolve(import.meta.dirname, "..");
const bump = process.argv[2];
const notes = process.env.RELEASE_NOTES?.trim();
if (!["patch", "minor", "major"].includes(bump) || !notes || /^(todo|tbd|placeholder)$/i.test(notes)) {
  throw new Error("Choose patch, minor, or major and provide user-visible RELEASE_NOTES.");
}
execFileSync(process.execPath, ["scripts/check-package.mjs"], { cwd: root, stdio: "inherit" });
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const next = inc(pkg.version, bump);
const directories = existsSync(path.join(root, "plugin/package.json")) ? [root, path.join(root, "plugin")] : [root];
for (const cwd of directories) {
  execFileSync("npm", ["version", next, "--no-git-tag-version", "--ignore-scripts"], { cwd, stdio: "inherit" });
}
const changelogPath = path.join(root, "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
const index = changelog.search(/^## /m);
if (index < 0) throw new Error("CHANGELOG.md has no release section.");
const entry = `## [${next}] - ${new Date().toISOString().slice(0, 10)}

${notes}

`;
writeFileSync(changelogPath, changelog.slice(0, index) + entry + changelog.slice(index));
execFileSync(process.execPath, ["scripts/check-package.mjs"], { cwd: root, stdio: "inherit" });
console.log(`Prepared ${next}; no commit, tag, push, publication, or deployment performed.`);
