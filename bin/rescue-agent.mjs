#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const stateFile = process.argv[2];
if (stateFile == null) fail("usage: rescue-agent.mjs STATE_FILE", 2);

let state;
try {
  state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
} catch (error) {
  fail(`TMTK rescue cannot read ${stateFile}: ${error.message}`, 2);
}
const configuration = state.configuration;
if (configuration == null || typeof configuration !== "object") fail("TMTK rescue state has no configuration", 2);
const promptFile = state.promptFile;
if (typeof promptFile !== "string") fail("TMTK rescue state has no prompt file", 2);
let prompt;
try {
  prompt = fs.readFileSync(promptFile, "utf8");
} catch (error) {
  fail(`TMTK rescue cannot read ${promptFile}: ${error.message}`, 2);
}

if (typeof configuration.title === "string" && configuration.title !== "") {
  process.stdout.write(`\u001b]1;${configuration.title.replaceAll("\u0007", "")}\u0007`);
}
process.stdout.write(`TMTK is resuming task ${configuration.taskId} in ${configuration.cwd}\n`);
const result = spawnSync(configuration.cli, [
  "--dangerously-bypass-approvals-and-sandbox",
  "resume",
  configuration.taskId,
  prompt
], {
  cwd: configuration.cwd,
  stdio: "inherit",
  env: process.env
});
if (result.error != null) fail(`TMTK rescue could not start Codex: ${result.error.message}`, 1);
process.exit(result.status ?? 1);

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
