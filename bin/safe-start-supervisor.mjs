#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { diagnoseApp } from "../src/diagnose-app.mjs";
import { openRescueTerminal, requestApplicationQuit, runningApplicationPids } from "../src/restart-platform.mjs";
import { loadRescueFile, rescueConfiguration, rescuePrompt, waitForReadiness } from "../src/safe-start.mjs";

const [mode, argument, rescueFileArgument, promptArgument] = process.argv.slice(2);
if (mode === "launch") {
  launch(argument, rescueFileArgument, promptArgument);
} else if (mode === "supervise") {
  await supervise(argument);
} else {
  fail("usage: safe-start-supervisor.mjs launch APPLICATION_ROOT RESCUE_JSON [PROMPT] | supervise STATE_FILE", 2);
}

function launch(applicationRoot, rescueFilePath, invocationPrompt) {
  const userHome = os.homedir();
  let configuration;
  try {
    const rescueFile = loadRescueFile(rescueFilePath);
    configuration = rescueConfiguration(process.env, applicationRoot, {
      rescueFile,
      userHome,
      invocationPrompt
    });
  } catch (error) {
    fail(`tmtk-restart: ${error.message}`, 2);
  }
  const rescueRoot = path.join(userHome, ".codex/tmtk-rescue");
  fs.mkdirSync(rescueRoot, {recursive: true, mode: 0o700});
  fs.chmodSync(rescueRoot, 0o700);
  const token = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}`;
  const incidentDirectory = path.join(rescueRoot, token);
  fs.mkdirSync(incidentDirectory, {mode: 0o700});
  const stateFile = path.join(incidentDirectory, "state.json");
  const latestFile = path.join(rescueRoot, "latest.json");
  const state = {
    schemaVersion: 1,
    token,
    phase: "supervisor-started",
    startedAt: new Date().toISOString(),
    app: configuration.app,
    marker: path.join(incidentDirectory, "renderer.ready"),
    incidentDirectory,
    rescueFile: rescueFilePath,
    configuration
  };
  writeJson(stateFile, state);
  writeJson(latestFile, state);
  const log = fs.openSync(path.join(incidentDirectory, "supervisor.log"), "a", 0o600);
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "supervise", stateFile], {
    detached: true,
    stdio: ["ignore", log, log],
    env: process.env
  });
  child.unref();
  fs.closeSync(log);
  process.stdout.write(`TMTK safe-start supervisor armed: ${displayPath(incidentDirectory, userHome)}\n`);
}

async function supervise(stateFile) {
  let state = readJson(stateFile);
  const configuration = state.configuration;
  const latestFile = path.join(path.dirname(path.dirname(stateFile)), "latest.json");
  const save = updates => {
    state = {...state, ...updates, updatedAt: new Date().toISOString()};
    writeJson(stateFile, state);
    writeJson(latestFile, state);
  };
  try {
    save({phase: "quitting-existing-app"});
    requestApplicationQuit(configuration.executable);
    const stopped = await waitUntil(() => !runningApplicationPids(configuration.executable).length, 30_000);
    if (!stopped) return rescue("existing Codex process did not quit within 30 seconds", state, save);

    try { fs.rmSync(state.marker, {force: true}); } catch {}
    save({phase: "launching"});
    const appLog = fs.openSync(path.join(state.incidentDirectory, "app-stdio.log"), "a", 0o600);
    const child = spawn(configuration.executable, [], {
      detached: true,
      stdio: ["ignore", appLog, appLog],
      env: {...process.env, CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH: state.marker}
    });
    child.unref();
    fs.closeSync(appLog);
    save({phase: "waiting-for-renderer", pid: child.pid, launchedAt: new Date().toISOString()});
    const result = await waitForReadiness({
      child,
      marker: state.marker,
      timeoutMs: configuration.timeoutSeconds * 1_000
    });
    if (result.kind === "ready") {
      save({phase: "ready", readyAt: new Date().toISOString()});
      return;
    }
    if (result.kind === "exited") {
      return rescue(`Codex exited before renderer readiness (code=${result.code ?? "null"}, signal=${result.signal ?? "null"})`, state, save);
    }
    if (result.kind === "launch-failed") {
      return rescue(`Codex could not be launched (${result.error.message})`, state, save);
    }
    return rescue(`Codex remained alive without renderer readiness for ${configuration.timeoutSeconds} seconds`, state, save);
  } catch (error) {
    return rescue(`safe-start supervisor failed: ${error.message}`, state, save);
  }
}

function rescue(reason, currentState, save) {
  const diagnosticFile = path.join(currentState.incidentDirectory, "diagnostic.json");
  try {
    writeJson(diagnosticFile, diagnoseApp({
      app: currentState.configuration.app,
      platform: currentState.configuration.platform
    }));
  } catch (error) {
    writeJson(diagnosticFile, {state: "diagnostic-failed", error: error.message});
  }
  const promptFile = path.join(currentState.incidentDirectory, "rescue-prompt.txt");
  fs.writeFileSync(promptFile, rescuePrompt({
    reason,
    diagnosticFile,
    supervisorLog: path.join(currentState.incidentDirectory, "supervisor.log"),
    appStdioLog: path.join(currentState.incidentDirectory, "app-stdio.log"),
    requestedPrompt: currentState.configuration.prompt
  }), {encoding: "utf8", mode: 0o600});
  const commandFile = path.join(currentState.incidentDirectory, "open-rescue.command");
  const stateFile = path.join(currentState.incidentDirectory, "state.json");
  fs.writeFileSync(commandFile, rescueLauncher(stateFile), {encoding: "utf8", mode: 0o700});
  fs.chmodSync(commandFile, 0o700);
  save({
    phase: "failed",
    failedAt: new Date().toISOString(),
    failure: reason,
    diagnosticFile,
    promptFile,
    rescueCommandFile: commandFile,
    rescueTerminalOpened: null,
    rescueTerminalError: null
  });
  const opened = openRescueTerminal({terminalApp: currentState.configuration.terminalApp, commandFile});
  save({
    rescueTerminalOpened: opened.opened,
    rescueTerminalError: opened.error
  });
}

function rescueLauncher(stateFile) {
  const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), "rescue-agent.mjs");
  return "#!/usr/bin/env node\n" +
    "const {spawnSync}=require('node:child_process');\n" +
    `const result=spawnSync(process.execPath,[${JSON.stringify(runner)},${JSON.stringify(stateFile)}],{stdio:'inherit'});\n` +
    "if(result.error)throw result.error;process.exit(result.status??1);\n";
}

async function waitUntil(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return predicate();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {encoding: "utf8", mode: 0o600, flag: "wx"});
  fs.renameSync(temporary, file);
}

function displayPath(value, userHome) {
  return value.startsWith(`${userHome}${path.sep}`) ? `~${value.slice(userHome.length)}` : value;
}

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
