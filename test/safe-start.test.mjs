#!/usr/bin/env node
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  applicationLayout,
  defaultTerminal,
  diagnosticLocations,
  resolveApplication,
  runningApplicationPids
} from "../src/restart-platform.mjs";
import {
  launchStatus,
  loadRescueFile,
  lookupThread,
  rescuePrompt,
  rescueConfiguration,
  waitForReadiness
} from "../src/safe-start.mjs";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-safe-start-test-"));
try {
  const app = path.join(scratch, "Applications/ChatGPT.app");
  fs.mkdirSync(path.join(app, "Contents/MacOS"), {recursive: true});
  fs.mkdirSync(path.join(app, "Contents/Resources"), {recursive: true});
  fs.writeFileSync(path.join(app, "Contents/MacOS/ChatGPT"), "");
  fs.writeFileSync(path.join(app, "Contents/Resources/codex"), "");
  const catalogCwd = path.join(scratch, "catalog-project");
  const fallbackCwd = path.join(scratch, "fallback-project");
  fs.mkdirSync(catalogCwd);
  fs.mkdirSync(fallbackCwd);
  const taskId = "01900000-0000-7000-8000-000000000001";

  const configured = rescueConfiguration({
    CODEX_THREAD_ID: taskId,
    CODEX_SESSION_ID: taskId,
    PWD: "/wrong/on/purpose"
  }, path.dirname(app), {
    threadLookup: () => ({cwd: catalogCwd, title: "The Mechanic"}),
    rescueFile: {cwd: fallbackCwd, readyTimeoutSeconds: 45},
    userHome: scratch,
    platform: "darwin"
  });
  assert.equal(configured.cwd, catalogCwd, "catalog cwd outranks fallback configuration and PWD");
  assert.equal(configured.taskId, taskId);
  assert.equal(configured.title, "The Mechanic");
  assert.equal(configured.timeoutSeconds, 45);
  assert.equal(configured.app, app);

  const prompted = rescueConfiguration({CODEX_THREAD_ID: taskId}, app, {
    threadLookup: () => ({cwd: catalogCwd, title: "The Mechanic"}),
    rescueFile: {prompt: "JSON fallback prompt"},
    invocationPrompt: "CLI prompt",
    userHome: scratch,
    platform: "darwin"
  });
  assert.equal(prompted.prompt, "CLI prompt", "--prompt outranks the fallback JSON prompt");

  const fallback = rescueConfiguration({}, app, {
    threadLookup: () => null,
    rescueFile: {taskId, cwd: fallbackCwd},
    userHome: scratch,
    platform: "darwin"
  });
  assert.equal(fallback.cwd, fallbackCwd);

  assert.throws(() => rescueConfiguration({}, app, {threadLookup: () => null, userHome: scratch, platform: "darwin"}), error => {
    assert.match(error.message, /taskId \(CODEX_THREAD_ID\/CODEX_SESSION_ID unavailable/);
    assert.match(error.message, /cwd \(thread catalog had no usable directory/);
    return true;
  });
  assert.throws(() => rescueConfiguration({
    CODEX_THREAD_ID: taskId,
    CODEX_SESSION_ID: "01900000-0000-7000-8000-000000000002"
  }, app, {userHome: scratch, platform: "darwin"}), /disagree/);
  assert.equal(resolveApplication(path.dirname(app), "darwin"), app);
  assert.equal(resolveApplication(app, "darwin"), app);
  assert.deepEqual(applicationLayout(app, "darwin"), {
    executable: path.join(app, "Contents/MacOS/ChatGPT"),
    cli: path.join(app, "Contents/Resources/codex")
  });
  assert.equal(defaultTerminal("darwin"), "Terminal");
  assert.deepEqual(diagnosticLocations(scratch, "darwin"), {
    desktopLogs: path.join(scratch, "Library/Logs/com.openai.codex"),
    rendererScope: path.join(scratch, "Library/Application Support/Codex/sentry/scope_v3.json")
  });
  assert.throws(() => resolveApplication(app, "linux"), /not yet qualified for linux/);

  const rescueFile = path.join(scratch, "RESCUE-AGENT.json");
  fs.writeFileSync(rescueFile, `${JSON.stringify({taskId, cwd: fallbackCwd, readyTimeoutSeconds: 90})}\n`);
  assert.deepEqual(loadRescueFile(rescueFile), {taskId, cwd: fallbackCwd, readyTimeoutSeconds: 90});
  fs.writeFileSync(rescueFile, '{"taskID":"typo"}\n');
  assert.throws(() => loadRescueFile(rescueFile), /unknown keys: taskID/);
  fs.writeFileSync(rescueFile, '{oops\n');
  assert.throws(() => loadRescueFile(rescueFile), /cannot parse/);
  fs.rmSync(rescueFile);
  assert.deepEqual(loadRescueFile(rescueFile), {});
  const publicExample = loadRescueFile(path.join(repository, "rescue-agent.example.json"));
  assert.equal(publicExample.readyTimeoutSeconds, 300);
  assert.match(publicExample.taskId, /^[0-9a-f-]{36}$/);

  const codexHome = path.join(scratch, ".codex");
  fs.mkdirSync(path.join(codexHome, "sqlite"), {recursive: true});
  const primaryDatabase = path.join(codexHome, "state_5.sqlite");
  runSql(primaryDatabase, [
    "create table threads(id text primary key, cwd text, name text)",
    `insert into threads values('${taskId}','${catalogCwd}','Catalog title')`
  ]);
  assert.deepEqual(lookupThread(taskId, scratch), {cwd: catalogCwd, title: "Catalog title"});
  fs.rmSync(primaryDatabase);
  const fallbackDatabase = path.join(codexHome, "sqlite/codex-dev.db");
  runSql(fallbackDatabase, [
    "create table local_thread_catalog(host_id text, thread_id text, cwd text, display_title text)",
    `insert into local_thread_catalog values('local','${taskId}','${fallbackCwd}','Fallback title')`
  ]);
  assert.deepEqual(lookupThread(taskId, scratch), {cwd: fallbackCwd, title: "Fallback title"});

  const marker = path.join(scratch, "ready");
  const readyChild = new EventEmitter();
  setTimeout(() => fs.writeFileSync(marker, "123\n"), 5);
  assert.deepEqual(await waitForReadiness({child: readyChild, marker, timeoutMs: 100, intervalMs: 2}), {kind: "ready"});
  fs.rmSync(marker);
  const exitedChild = new EventEmitter();
  setTimeout(() => exitedChild.emit("exit", 1, null), 5);
  assert.deepEqual(await waitForReadiness({child: exitedChild, marker, timeoutMs: 100, intervalMs: 2}),
    {kind: "exited", code: 1, signal: null});
  const failedChild = new EventEmitter();
  const launchError = new Error("spawn denied");
  setTimeout(() => failedChild.emit("error", launchError), 5);
  assert.deepEqual(await waitForReadiness({child: failedChild, marker, timeoutMs: 100, intervalMs: 2}),
    {kind: "launch-failed", error: launchError});
  const waitingChild = new EventEmitter();
  assert.deepEqual(await waitForReadiness({child: waitingChild, marker, timeoutMs: 5, intervalMs: 2}), {kind: "timed-out"});

  const briefing = rescuePrompt({
    reason: "renderer timed out",
    diagnosticFile: "/private/incident/diagnostic.json",
    supervisorLog: "/private/incident/supervisor.log",
    appStdioLog: "/private/incident/app-stdio.log",
    requestedPrompt: "Keep the current repair narrow."
  });
  assert.match(briefing, /^Keep the current repair narrow\.\n\nCodex Desktop failed/);
  assert.match(briefing, /Codex CLI escape line/);
  assert.match(briefing, /task-to-task messaging and app tools are not available here/);
  for (const evidence of ["diagnostic.json", "supervisor.log", "app-stdio.log"]) {
    assert.match(briefing, new RegExp(evidence.replace(".", "\\.")));
  }

  fs.writeFileSync(marker, "123\n");
  assert.equal(launchStatus({phase: "ready", marker}).launched, true);
  assert.equal(launchStatus({phase: "waiting-for-renderer", marker}).launched, false);
  assert.equal(launchStatus(null).launched, false);

  assert.throws(() => runningApplicationPids("/some/Codex", {platform: "linux"}),
    /not yet qualified for linux/);
  const coreSource = fs.readFileSync(path.join(repository, "src/safe-start.mjs"), "utf8");
  for (const macOnlyValue of ["Contents/MacOS", "Contents/Resources", "/Applications", "darwin"]) {
    assert.equal(coreSource.includes(macOnlyValue), false, `safe-start core does not own ${macOnlyValue}`);
  }
  for (const file of ["bin/tmtk-restart", "bin/rescue-agent.mjs", "src/safe-start.mjs"]) {
    const source = fs.readFileSync(path.join(repository, file), "utf8");
    assert.equal(source.includes("#!/bin/zsh"), false, `${file} does not require zsh`);
    assert.equal(source.includes("/usr/bin/sqlite3"), false, `${file} does not require a system SQLite CLI`);
  }

  const fakeCli = path.join(scratch, "fake-codex.mjs");
  const rescueResult = path.join(scratch, "rescue-result.json");
  const promptFile = path.join(scratch, "prompt.txt");
  const stateFile = path.join(scratch, "state.json");
  fs.writeFileSync(fakeCli, "#!/usr/bin/env node\nimport fs from 'node:fs';fs.writeFileSync(process.env.RESCUE_RESULT,JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));\n");
  fs.chmodSync(fakeCli, 0o700);
  fs.writeFileSync(promptFile, "Please inspect the failed launch.\n");
  fs.writeFileSync(stateFile, JSON.stringify({
    promptFile,
    configuration: {cli: fakeCli, cwd: fallbackCwd, taskId, title: "Recovery"}
  }));
  const resumed = spawnSync(process.execPath, [path.join(repository, "bin/rescue-agent.mjs"), stateFile], {
    encoding: "utf8",
    env: {...process.env, RESCUE_RESULT: rescueResult}
  });
  assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
  const invocation = JSON.parse(fs.readFileSync(rescueResult, "utf8"));
  assert.deepEqual(invocation.args, [
    "--dangerously-bypass-approvals-and-sandbox",
    "resume",
    taskId,
    "Please inspect the failed launch.\n"
  ]);
  assert.equal(fs.realpathSync(invocation.cwd), fs.realpathSync(fallbackCwd),
    "rescue starts directly in the catalog cwd without shell cd");
  process.stdout.write("safe-start behavior probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function runSql(database, statements) {
  const connection = new DatabaseSync(database);
  try {
    connection.exec(statements.join(";"));
  } finally {
    connection.close();
  }
}
