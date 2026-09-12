#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  acquireRescueLease,
  automaticRepairPrompt,
  explicitResumeEnvironment,
  interactiveRescuePrompt,
  resumeModelArguments,
  waitForApplicationQuiescence,
  waitForCodexStateQuiescence,
  waitForRepairTurnCompletion,
  writePrivateJson
} from "../src/safe-start.mjs";
import {
  applicationLayout,
  closeOwnedRescueTerminal,
  confirmRepairFallback,
  replaceApplicationWithVerifiedSource,
  resolveCli,
  rescueStopHookOverride,
  rescueTerminalClosureRequired
} from "../src/restart-platform.mjs";

const stateFile = process.argv[2];
if (stateFile == null) fail("usage: rescue-agent.mjs STATE_FILE", 2);
const maximumAttempts = 3;
const supervisor = path.join(path.dirname(fileURLToPath(import.meta.url)), "safe-start-supervisor.mjs");
const stopHook = path.join(path.dirname(fileURLToPath(import.meta.url)), "rescue-turn-stop.mjs");
const initialState = rescueState();
let lease;
try {
  lease = acquireRescueLease(initialState.incidentDirectory);
} catch (error) {
  fail(`TMTK rescue refused concurrent incident ownership: ${error.message}`, 1);
}
process.once("exit", () => lease.release());
let {configuration} = initialState;

process.stdout.write(`TMTK is repairing task ${configuration.taskId} in ${configuration.cwd}\n`);

const firstAttempt = Number(rescueState().repairAttemptsUsed ?? 0) + 1;
for (let attempt = firstAttempt; attempt <= maximumAttempts; attempt += 1) {
  const state = rescueState();
  configuration = state.configuration;
  saveRescueState({phase: "repairing", repairAttemptsUsed: attempt});
  banner([
    `TMTK automatic repair attempt ${attempt} of ${maximumAttempts}`,
    "No input is needed. Please leave this window open."
  ]);
  await requireApplicationQuiescence(configuration);
  const receiptFile = path.join(state.incidentDirectory, `repair-attempt-${attempt}-stop.json`);
  fs.rmSync(receiptFile, {force: true});
  const hookOverride = rescueStopHookOverride({
    nodeExecutable: process.execPath,
    hookScript: stopHook,
    receiptFile,
    taskId: configuration.taskId,
    codexHome: configuration.codexHome
  }, {platform: configuration.platform});
  const child = spawn(configuration.cli, [
    "resume",
    ...resumeModelArguments(configuration),
    "--dangerously-bypass-approvals-and-sandbox",
    "--dangerously-bypass-hook-trust",
    "--config",
    hookOverride,
    configuration.taskId,
    automaticRepairPrompt(prompt(state), attempt, maximumAttempts)
  ], {
    cwd: configuration.cwd,
    stdio: "inherit",
    env: {...explicitResumeEnvironment(process.env), TMTK_AUTOMATIC_REPAIR: "1"}
  });
  const completion = await waitForRepairTurnCompletion({
    child,
    receiptFile,
    taskId: configuration.taskId,
    codexHome: configuration.codexHome
  });
  if (completion.kind !== "completed") {
    await terminateRepairTui(child);
    process.stderr.write(`TMTK repair attempt ${attempt} did not reach durable turn completion (${completion.kind}).\n`);
    continue;
  }
  if (!await terminateRepairTui(child)) {
    process.stderr.write(`TMTK could not close repair attempt ${attempt} after its turn completed.\n`);
    continue;
  }
  await requireCodexStateQuiescence(configuration);

  returnToDesktop(state, [
    `Repair attempt ${attempt} finished.`,
    "Closing rescue before returning to Desktop…"
  ]);
}

let state = rescueState();
configuration = state.configuration;
await requireApplicationQuiescence(configuration);
if (configuration.knownGood != null && state.knownGoodRestoreAttempted !== true) {
  let fallback = "interactive";
  try {
    fallback = confirmRepairFallback({platform: configuration.platform});
  } catch (error) {
    saveRescueState({
      phase: "repair-fallback-confirmation-failed",
      repairFallbackConfirmationFailure: error.message
    });
    process.stderr.write(`TMTK could not show the recovery choice (${error.message}).\n`);
  }
  if (fallback === "restore") {
    try {
      saveRescueState({phase: "restoring-known-good", knownGoodRestoreAttempted: true});
      const restored = replaceApplicationWithVerifiedSource({
        targetApp: configuration.app,
        source: configuration.knownGood
      }, {platform: configuration.platform});
      configuration = installedConfiguration(configuration, restored);
      state = saveRescueState({
        phase: "known-good-restored",
        knownGoodRestoreAttempted: true,
        candidateInstalled: false,
        candidateAdoptionDisabled: true,
        restoredKnownGood: restored,
        configuration
      });
      returnToDesktop(state, [
        "Known-working Codex restored.",
        "Closing rescue before returning to Desktop…"
      ]);
    } catch (error) {
      state = saveRescueState({
        phase: "known-good-restore-failed",
        knownGoodRestoreAttempted: true,
        knownGoodRestoreFailure: error.message
      });
      process.stderr.write(`TMTK could not restore the known-working application (${error.message}).\n`);
    }
  }
}
banner([
  "All non-interactive attempts failed.",
  "Opening a terminal line with the agent."
]);
const interactive = spawnSync(configuration.cli, [
  "--dangerously-bypass-approvals-and-sandbox",
  "resume",
  ...resumeModelArguments(configuration),
  configuration.taskId,
  interactiveRescuePrompt(prompt(state), maximumAttempts)
], {
  cwd: configuration.cwd,
  stdio: "inherit",
  env: explicitResumeEnvironment(process.env)
});
if (interactive.error != null) fail(`TMTK rescue could not start Codex: ${interactive.error.message}`, 1);
process.exit(interactive.status ?? 1);

function rescueState() {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch (error) {
    fail(`TMTK rescue cannot read ${stateFile}: ${error.message}`, 2);
  }
  if (state.configuration == null || typeof state.configuration !== "object") {
    fail("TMTK rescue state has no configuration", 2);
  }
  if (typeof state.incidentDirectory !== "string") fail("TMTK rescue state has no incident directory", 2);
  return state;
}

function prompt(state) {
  if (typeof state.promptFile !== "string") fail("TMTK rescue state has no prompt file", 2);
  try {
    return fs.readFileSync(state.promptFile, "utf8");
  } catch (error) {
    fail(`TMTK rescue cannot read ${state.promptFile}: ${error.message}`, 2);
  }
}

function saveRescueState(updates) {
  const current = rescueState();
  const next = {...current, ...updates, updatedAt: new Date().toISOString()};
  writePrivateJson(stateFile, next);
  const latestFile = path.join(path.dirname(path.dirname(stateFile)), "latest.json");
  writePrivateJson(latestFile, next);
  return next;
}

function launchReturnSupervisor() {
  const logFile = path.join(rescueState().incidentDirectory, "supervisor.log");
  const log = fs.openSync(logFile, "a", 0o600);
  let child;
  try {
    child = spawn(process.execPath, [supervisor, "retry", stateFile, String(process.pid)], {
      cwd: configuration.cwd,
      detached: true,
      stdio: ["ignore", log, log],
      env: process.env,
      windowsHide: configuration.platform === "win32"
    });
  } finally {
    fs.closeSync(log);
  }
  child.once("error", () => {});
  child.unref();
  return child;
}

function returnToDesktop(state, lines) {
  const closureRequired = rescueTerminalClosureRequired({
    terminalApp: configuration.terminalApp,
    environment: process.env
  }, {platform: configuration.platform});
  const closureMarker = path.join(state.incidentDirectory, `return-${crypto.randomUUID()}-terminal-closed`);
  fs.rmSync(closureMarker, {force: true});
  saveRescueState({
    phase: "return-handoff-armed",
    rescueTerminalClosureRequired: closureRequired,
    rescueTerminalClosureMarker: closureRequired ? closureMarker : null
  });
  const handoff = launchReturnSupervisor();
  if (closureRequired) {
    const close = closeOwnedRescueTerminal({
      terminalApp: configuration.terminalApp,
      applicationOwned: state.rescueTerminalApplicationOwned === true,
      completionFile: closureMarker,
      environment: process.env
    }, {platform: configuration.platform});
    if (!close.scheduled) {
      handoff.kill();
      saveRescueState({
        phase: "return-handoff-blocked",
        failedAt: new Date().toISOString(),
        failure: `could not schedule rescue Terminal closure (${close.reason})`
      });
      fail(`TMTK could not close its rescue Terminal (${close.reason}); Desktop remains closed.`, 1);
    }
  }
  banner(lines);
  process.exit(0);
}

function banner(lines) {
  const width = Math.max(...lines.map(line => line.length), 48);
  const rule = "═".repeat(width);
  process.stdout.write(`\n${rule}\n${lines.join("\n")}\n${rule}\n\n`);
}

function installedConfiguration(current, installed) {
  const layout = applicationLayout(installed.app, current.platform);
  return {
    ...current,
    app: installed.app,
    executable: layout.executable,
    cli: resolveCli(layout.cli, {platform: current.platform})
  };
}

async function requireApplicationQuiescence(configuration) {
  const quiet = await waitForApplicationQuiescence({
    executable: configuration.executable,
    platform: configuration.platform,
    timeoutMs: 30_000
  });
  if (!quiet) {
    fail("TMTK rescue refused to resume the task because processes from the failed Codex application are still running.", 1);
  }
  await requireCodexStateQuiescence(configuration);
}

async function requireCodexStateQuiescence(configuration) {
  const codexHome = configuration.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  const stateQuiet = await waitForCodexStateQuiescence({codexHome, timeoutMs: 30_000});
  if (!stateQuiet) {
    fail("TMTK rescue refused to resume the task because Codex database writers did not become quiescent.", 1);
  }
}

async function terminateRepairTui(child) {
  if (child.exitCode != null || child.signalCode != null) return true;
  child.kill("SIGTERM");
  if (await waitForChildExit(child, 5_000)) return true;
  child.kill("SIGKILL");
  return waitForChildExit(child, 5_000);
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode != null || child.signalCode != null) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      resolve(value);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
  });
}

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
