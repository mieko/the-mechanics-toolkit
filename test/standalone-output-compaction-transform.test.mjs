import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const script = path.join(root, "patches/standalone-output-compaction/patch.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tmtk-standalone-output-"));
try {
  const app = path.join(scratch, "ChatGPT.app");
  const bundled = path.join(app, "Contents/Resources/codex");
  const replacement = path.join(scratch, "patched-codex");
  fs.mkdirSync(path.dirname(bundled), {recursive: true});
  writeFakeCodex(bundled, "stock", "codex-cli 0.154.0-alpha.6.2");
  writeFakeCodex(replacement, "patched", "codex-cli 0.154.0-alpha.6.2");
  const config = path.join(scratch, "toolkit.json");
  fs.writeFileSync(config, JSON.stringify({codexBinary: replacement}));

  assert.equal(run("check", app, config).state, "needs-apply");
  assert.equal(run("apply", app, config).state, "applied");
  assert.equal(fs.readFileSync(bundled, "utf8"), fs.readFileSync(replacement, "utf8"));
  assert.equal(run("apply", app, config).state, "applied");

  writeFakeCodex(replacement, "wrong", "codex-cli 0.154.0");
  const mismatch = spawnSync(process.execPath, [script, "check", app, "--config", config], {encoding: "utf8"});
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /does not match bundle version/);
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function run(command, app, config) {
  const result = spawnSync(process.execPath, [script, command, app, "--config", config], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function writeFakeCodex(target, marker, reportedVersion = "codex-cli 0.153.4") {
  fs.writeFileSync(target, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "${reportedVersion}"; else echo "${marker}"; fi\n`, {mode: 0o755});
}
