#!/usr/bin/env node
/**
 * Validates documentation files:
 * - Ensures required docs exist.
 * - Rejects em dashes in all markdown files.
 * - Checks relative link targets.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build"]);

const REQUIRED_DOCS = [
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
];

const errors = [];

for (const rel of REQUIRED_DOCS) {
  const full = path.join(ROOT, rel);
  if (!existsSync(full)) {
    errors.push(`missing required document: ${rel}`);
  }
}

function* walkMarkdown(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walkMarkdown(full);
    } else if (st.isFile() && entry.endsWith(".md")) {
      yield full;
    }
  }
}

for (const file of walkMarkdown(ROOT)) {
  const rel = path.relative(ROOT, file);
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  for (const [idx, line] of lines.entries()) {
    const lineNum = idx + 1;
    if (line.includes("—") || line.includes("\u2014")) {
      errors.push(`${rel}:${lineNum}: em dash detected; use commas, colons, parentheses, or separate sentences`);
    }

    // Check relative links
    const linkMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    for (const match of linkMatches) {
      const target = match[2].split("#")[0].split("?")[0].trim();
      if (!target || target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:")) {
        continue;
      }
      const resolved = path.resolve(path.dirname(file), target);
      if (!existsSync(resolved)) {
        errors.push(`${rel}:${lineNum}: broken local link "${target}"`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("check-docs: validation failed");
  for (const err of errors) console.error(`  ${err}`);
  process.exit(1);
}

console.log("check-docs: ok");
