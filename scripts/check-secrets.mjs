#!/usr/bin/env node
/**
 * Checks publication text, including lockfiles, for selected credential formats,
 * real home paths, and private network addresses. This does not replace review.
 * Findings name the pattern only; matched text is never printed.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

const RULES = [
  {
    name: "private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  },
  {
    name: "GitHub token",
    pattern: /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u,
  },
  {
    name: "OpenAI-style API key",
    pattern: /\bsk-[A-Za-z0-9]{24,}\b/u,
  },
  {
    name: "AWS access key id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/u,
  },
  {
    name: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u,
  },
  {
    name: "bearer credential assignment",
    pattern: /\b(api[_-]?key|access[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["'][^"'{<][^"']{7,}["']/iu,
  },
  {
    name: "absolute macOS home path",
    pattern: /\/Users\/(?!you\b|user\b|runner\b|example\b)[A-Za-z0-9._-]+\//u,
  },
  {
    name: "absolute Linux home path",
    pattern: /\/home\/(?!you\b|user\b|runner\b|example\b)[A-Za-z0-9._-]+\//u,
  },
  {
    name: "private IPv4 address",
    pattern: /(?<![\d.])(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?![\d.])/u,
  },
  {
    name: "carrier-grade NAT address",
    pattern: /(?<![\d.])100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}(?![\d.])/u,
  },
  {
    name: "private key file reference",
    pattern: /\b(?:id_rsa|id_ed25519)\b/u,
  },
];

/** Exclude the scanner itself because its detection patterns are intentional. */
const SKIP_FILES = new Set(["check-secrets.mjs"]);

function* walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      yield* walk(fullPath);
    } else if (stats.isFile()) {
      yield fullPath;
    }
  }
}

const findings = [];
for (const filePath of walk(ROOT)) {
  const relative = path.relative(ROOT, filePath);
  if (SKIP_FILES.has(path.basename(filePath))) continue;
  if (/\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf)$/i.test(filePath)) continue;
  let contents;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    continue;
  }
  const lines = contents.split("\n");
  for (const rule of RULES) {
    for (const [index, line] of lines.entries()) {
      if (rule.pattern.test(line)) {
        findings.push(`${relative}:${index + 1}: ${rule.name}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error("check-secrets: refused");
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log("check-secrets: ok");