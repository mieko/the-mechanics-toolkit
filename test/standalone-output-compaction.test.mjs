import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const app = path.resolve(process.argv[2] ?? "");
const binary = path.join(app, "Contents/Resources/codex");
assert.ok(fs.statSync(binary).isFile(), "Codex replacement is a file");
fs.accessSync(binary, fs.constants.X_OK);
const result = spawnSync(binary, ["--version"], {encoding: "utf8"});
assert.equal(result.status, 0, "Codex replacement starts and reports its version");
assert.match(result.stdout.trim(), /^codex-cli \d+\.\d+\.\d+$/);

process.stdout.write(`${JSON.stringify({
  patch: "standalone-output-compaction",
  binaryExecutable: true,
  version: result.stdout.trim()
}, null, 2)}\n`);
