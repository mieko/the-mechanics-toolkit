#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
assert.equal(process.platform, "darwin", "safe-start Terminal acceptance is currently macOS-only");
const supervisor = path.join(repository, "bin/safe-start-supervisor.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tmtk-safe-start-acceptance-"));
const app = path.join(scratch, "BrokenChatGPT.app");
const executable = path.join(app, "Contents/MacOS/ChatGPT");
const cli = path.join(app, "Contents/Resources/codex");
const project = path.join(scratch, "project");
const rescueFile = path.join(scratch, "RESCUE-AGENT.json");
const receipt = path.join(scratch, "rescue-receipt.jsonl");
const repairCount = path.join(scratch, "repair-count");
const taskId = "01900000-0000-7000-8000-000000000001";
const model = "gpt-5.6-sol";
const reasoningEffort = "high";

fs.mkdirSync(path.dirname(executable), {recursive: true});
fs.mkdirSync(path.dirname(cli), {recursive: true});
fs.mkdirSync(project);
writeExecutable(executable,
  `import fs from "node:fs";\n` +
  `const count=fs.existsSync(${JSON.stringify(repairCount)})?Number(fs.readFileSync(${JSON.stringify(repairCount)},"utf8")):0;\n` +
  `if(count<2)process.exit(73);\n` +
  `fs.writeFileSync(process.env.CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH,"ready\\n");\n` +
  `setTimeout(()=>process.exit(0),1000);\n`
);
fs.copyFileSync(path.join(repository, "test/fixtures/fake-rescue-cli.mjs"), cli);
fs.chmodSync(cli, 0o700);
fs.writeFileSync(rescueFile, `${JSON.stringify({
  taskId,
  cwd: project,
  model,
  reasoningEffort,
  terminalApp: "Terminal",
  readyTimeoutSeconds: 30
}, null, 2)}\n`);

const launch = spawnSync(process.execPath, [
  supervisor,
  "launch",
  app,
  rescueFile,
  "This is a controlled TMTK qualification. Do not repair the disposable fixture."
], {
  encoding: "utf8",
  env: withoutCodexIdentity({
    ...process.env,
    HOME: scratch,
    RESCUE_RESULT: receipt,
    RESCUE_REPAIR_COUNT: repairCount,
    RESCUE_TEST_CODEX_HOME: path.join(scratch, ".codex")
  })
});
assert.equal(launch.status, 0, launch.stderr || launch.stdout);
assert.match(launch.stdout, /TMTK safe-start supervisor armed:/);

const latest = path.join(scratch, ".codex/tmtk-rescue/latest.json");
await waitUntil(() => json(latest)?.phase === "ready", 30_000, "automatic repair and healthy retry");
const state = json(latest);
assert.match(state.failure, /exited before renderer readiness \(code=73, signal=null\)/);
assert.equal(state.rescueTerminalOpened, true, state.rescueTerminalError ?? "Terminal rescue did not open");
for (const file of [state.diagnosticFile, state.promptFile, state.rescueCommandFile]) {
  assert.equal(fs.statSync(file).isFile(), true, `missing rescue artifact ${file}`);
}

const invocations = fs.readFileSync(receipt, "utf8").trim().split("\n").map(JSON.parse);
assert.equal(invocations.length, 2, "the second repair attempt produces a ready Desktop launch");
for (const [index, invocation] of invocations.entries()) {
  assert.equal(fs.realpathSync(invocation.cwd), fs.realpathSync(project));
  assert.deepEqual(invocation.args.slice(0, 8), [
    "resume", "--model", model, "--config", 'model_reasoning_effort="high"',
    "--dangerously-bypass-approvals-and-sandbox", "--dangerously-bypass-hook-trust", "--config"
  ]);
  assert.match(invocation.args[8], /^hooks\.Stop=/);
  assert.equal(invocation.args[9], taskId);
  assert.match(invocation.args[10], new RegExp(`^This is attempt ${index + 1}/3 to repair the failed Codex launch`));
  assert.match(invocation.args[10], /This session is not interactive with the user/);
  assert.match(invocation.args[10], /This is a controlled TMTK qualification\./);
  assert.match(invocation.args[10], /Codex Desktop failed to reach renderer readiness/);
  assert.match(invocation.args[10], /native Codex Desktop task-to-task messaging and app tools are unavailable/);
}
for (const file of ["diagnostic.json", "supervisor.log", "app-stdio.log"]) {
  assert.match(invocations[0].args[10], new RegExp(file.replace(".", "\\.")));
}

const result = {
  state: "passed",
  failure: state.failure,
  rescueTerminalOpened: state.rescueTerminalOpened,
  automaticRepairAttempts: invocations.length,
  taskId,
  cwd: invocations[0].cwd,
  fixtureRemoved: true
};
fs.rmSync(scratch, {recursive: true, force: true});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function writeExecutable(file, body) {
  fs.writeFileSync(file, `#!${process.execPath}\n${body}`, {mode: 0o700});
  fs.chmodSync(file, 0o700);
}

function withoutCodexIdentity(environment) {
  delete environment.CODEX_THREAD_ID;
  delete environment.CODEX_SESSION_ID;
  return environment;
}

function json(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

async function waitUntil(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`timed out waiting for ${label}; fixture retained at ${scratch}`);
}
