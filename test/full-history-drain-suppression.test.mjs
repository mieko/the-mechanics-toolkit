#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  throw new Error("usage: test/full-history-drain-suppression.test.mjs EXTRACTED_ASAR_ROOT");
}

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const patch = path.join(repository, "patches/full-history-drain-suppression/patch.mjs");
const result = spawnSync(process.execPath, [patch, "check", root], { encoding: "utf8" });
assert.equal(result.status, 0, result.stderr || result.stdout);
const output = JSON.parse(result.stdout);
assert.ok(new Set(["applied", "upstream-owned"]).has(output.state),
  `history-drain owner must be applied or upstream-owned, got ${output.state}`);
assert.match(output.target, /^webview\/assets\/.+\.js$/);
assert.equal(output.behavior,
  output.state === "upstream-owned" ? "stock-paginated-history" : "local-resume-drain-suppressed");

process.stdout.write(`${JSON.stringify({
  state: "green",
  ownership: output.state,
  target: output.target
}, null, 2)}\n`);
