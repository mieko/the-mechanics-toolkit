#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { diagnoseApp } from "../src/diagnose-app.mjs";
import {
  ancestorProcessPid,
  applicationIsRunning,
  confirmApplicationRestart,
  confirmTaskHandoff,
  launchApplication,
  openRescueTerminal,
  releaseApplicationLaunch,
  replaceApplicationWithVerifiedSource,
  requestApplicationQuit
} from "../src/restart-platform.mjs";
import {
  loadRescueFile,
  prepareCandidateAdoption,
  pruneSupersededKnownGoodApps,
  rescueConfiguration,
  rescuePrompt,
  waitForCodexStateQuiescence,
  waitForReadiness
} from "../src/safe-start.mjs";

const [mode, argument, auxiliaryArgument, promptArgument, candidateArgument,
  candidateSourceArgument, knownGoodArgument] = process.argv.slice(2);
if (mode === "launch") {
  launch(argument, auxiliaryArgument, promptArgument, candidateArgument, candidateSourceArgument,
    knownGoodArgument);
} else if (mode === "supervise") {
  process.exitCode = await supervise(argument, {
    confirmRestart: true,
    openTerminalOnFailure: true
  }) ? 0 : 1;
} else if (mode === "retry") {
  process.exitCode = await supervise(argument, {
    confirmRestart: false,
    openTerminalOnFailure: true,
    rescuePid: requiredPid(auxiliaryArgument)
  }) ? 0 : 1;
} else {
  fail("usage: safe-start-supervisor.mjs launch APPLICATION_ROOT RESCUE_JSON [PROMPT] " +
    "[CANDIDATE] [CANDIDATE_SOURCE] [KNOWN_GOOD] | supervise STATE_FILE | " +
    "retry STATE_FILE RESCUE_PID", 2);
}

function launch(applicationRoot, rescueFilePath, invocationPrompt, candidatePath,
  candidateSourcePath, knownGoodPath) {
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
  try {
    if (typeof candidatePath === "string" && candidatePath.trim() !== "") {
      const {candidate, knownGood} = prepareCandidateAdoption({
        candidatePath,
        candidateSourcePath,
        knownGoodPath,
        configuration,
        incidentDirectory
      });
      configuration = {...configuration, candidate, knownGood};
    } else if ([candidateSourcePath, knownGoodPath].some(value =>
      typeof value === "string" && value.trim() !== "")) {
      throw new Error("--candidate-source and --known-good require --candidate");
    }
  } catch (error) {
    fs.rmSync(incidentDirectory, {recursive: true, force: true});
    fail(`tmtk-restart: could not prepare candidate adoption: ${error.message}`, 2);
  }
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
    invokingCliPid: ancestorProcessPid(configuration.cli, {platform: configuration.platform}),
    configuration
  };
  if ((process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID) && state.invokingCliPid == null) {
    fs.rmSync(incidentDirectory, {recursive: true, force: true});
    fail("tmtk-restart: could not identify the exact invoking Codex CLI process", 2);
  }
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
  process.stdout.write("A restart confirmation dialog is waiting. Do not poll or wait: finish this agent turn now.\n");
}

async function supervise(stateFile, {
  confirmRestart,
  openTerminalOnFailure,
  rescuePid = null
}) {
  let state = readJson(stateFile);
  const configuration = state.configuration;
  const latestFile = path.join(path.dirname(path.dirname(stateFile)), "latest.json");
  const save = updates => {
    state = {...state, ...updates, updatedAt: new Date().toISOString()};
    writeJson(stateFile, state);
    writeJson(latestFile, state);
  };
  try {
    if (rescuePid != null) {
      save({phase: "waiting-for-rescue-exit", rescuePid});
      if (!await waitUntil(() => !processExists(rescuePid), 30_000)) {
        const failure = `rescue process ${rescuePid} did not exit; refusing to launch a second copy of the task`;
        process.stderr.write(`TMTK return handoff stopped: ${failure}.\n`);
        save({phase: "return-handoff-blocked", failedAt: new Date().toISOString(), failure});
        return false;
      }
      if (state.rescueTerminalClosureRequired === true) {
        const completionFile = state.rescueTerminalClosureMarker;
        if (typeof completionFile !== "string" ||
            !await waitUntil(() => fs.existsSync(completionFile), 30_000)) {
          const failure = "rescue Terminal did not confirm closure; refusing to launch Desktop";
          process.stderr.write(`TMTK return handoff stopped: ${failure}.\n`);
          save({phase: "return-handoff-blocked", failedAt: new Date().toISOString(), failure});
          return false;
        }
      }
      save({phase: "rescue-closed"});
    }
    if (confirmRestart) {
      save({phase: "waiting-for-restart-confirmation"});
      let confirmed;
      try {
        confirmed = confirmApplicationRestart({platform: configuration.platform});
      } catch (error) {
        discardUnusedKnownGood(configuration, state);
        process.stderr.write(`TMTK restart confirmation failed: ${error.message}\n`);
        save({
          phase: "restart-confirmation-failed",
          failedAt: new Date().toISOString(),
          failure: error.message
        });
        return false;
      }
      if (!confirmed) {
        discardUnusedKnownGood(configuration, state);
        save({phase: "cancelled", cancelledAt: new Date().toISOString()});
        return true;
      }
    }
    if (configuration.candidate != null && state.candidateInstalled !== true &&
        state.candidateAdoptionDisabled !== true) {
      try {
        const removed = pruneSupersededKnownGoodApps(
          path.dirname(state.incidentDirectory),
          state.incidentDirectory
        );
        save({supersededKnownGoodAppsRemoved: removed});
      } catch (error) {
        discardUnusedKnownGood(configuration, state);
        const failure = `could not prune superseded known-working applications: ${error.message}`;
        process.stderr.write(`TMTK restart stopped: ${failure}.\n`);
        save({phase: "rollback-retention-failed", failedAt: new Date().toISOString(), failure});
        return false;
      }
    }
    save({phase: "quitting-existing-app"});
    if (!requestApplicationQuit(configuration.executable)) {
      discardUnusedKnownGood(configuration, state);
      save({phase: "cancelled", cancelledAt: new Date().toISOString(), cancellation: "codex-quit-dialog"});
      return true;
    }
    const stopped = await waitUntil(() => !applicationIsRunning(configuration.executable, {
      platform: configuration.platform
    }), 30_000);
    if (!stopped) {
      discardUnusedKnownGood(configuration, state);
      const failure = "existing Codex process did not quit after its shutdown dialog completed";
      process.stderr.write(`TMTK restart stopped: ${failure}.\n`);
      save({phase: "quit-not-completed", failedAt: new Date().toISOString(), failure});
      return false;
    }

    if (state.invokingCliPid != null && state.invokingCliExitObserved !== true) {
      save({phase: "waiting-for-invoking-cli-exit", invokingCliPid: state.invokingCliPid});
      while (!await waitUntil(() => !processExists(state.invokingCliPid), 30_000)) {
        if (!confirmTaskHandoff({platform: configuration.platform})) {
          discardUnusedKnownGood(configuration, state);
          save({
            phase: "cancelled",
            cancelledAt: new Date().toISOString(),
            cancellation: "invoking-cli-remained-active"
          });
          return true;
        }
      }
      save({
        phase: "invoking-cli-closed",
        invokingCliExitObserved: true,
        invokingCliExitedAt: new Date().toISOString()
      });
    }

    save({phase: "waiting-for-codex-state-quiescence"});
    if (!await waitForCodexStateQuiescence({
      codexHome: configuration.codexHome,
      timeoutMs: 30_000
    })) {
      return rescue(
        "Codex state databases did not become writable after Desktop and the invoking task runtime exited",
        state,
        save,
        {openTerminal: openTerminalOnFailure}
      );
    }

    if (configuration.candidate != null && state.candidateInstalled !== true &&
        state.candidateAdoptionDisabled !== true) {
      save({phase: "installing-candidate"});
      const installed = replaceApplicationWithVerifiedSource({
        targetApp: configuration.app,
        source: configuration.candidate
      }, {platform: configuration.platform});
      save({
        phase: "candidate-installed",
        candidateInstalled: true,
        installedCandidate: installed
      });
    }

    try { fs.rmSync(state.marker, {force: true}); } catch {}
    save({phase: "launching"});
    const child = launchApplication({
      app: configuration.app,
      marker: state.marker,
      appLog: path.join(state.incidentDirectory, "app-stdio.log"),
      platform: configuration.platform
    });
    save({phase: "waiting-for-renderer", pid: child.pid, launchedAt: new Date().toISOString()});
    const restoredFallback = state.knownGoodRestoreAttempted === true &&
      state.candidateAdoptionDisabled === true;
    const result = await waitForReadiness({
      child,
      marker: state.marker,
      timeoutMs: restoredFallback
        ? Math.min(configuration.timeoutSeconds, 10) * 1_000
        : configuration.timeoutSeconds * 1_000
    });
    if (result.kind === "ready") {
      // Release only the platform's launch waiter. Linux owns the exact app
      // process directly, while macOS owns a LaunchServices lifetime proxy.
      releaseApplicationLaunch(child, configuration.platform);
      save({phase: "ready", readyAt: new Date().toISOString()});
      return true;
    }
    if (result.kind === "exited") {
      return rescue(`Codex exited before renderer readiness (code=${result.code ?? "null"}, signal=${result.signal ?? "null"})`, state, save, {openTerminal: openTerminalOnFailure});
    }
    if (result.kind === "launch-failed") {
      return rescue(`Codex could not be launched (${result.error.message})`, state, save, {openTerminal: openTerminalOnFailure});
    }
    if (restoredFallback) {
      // The app captured before adoption may predate TMTK's renderer marker.
      // It was already running successfully when captured, so after a clean
      // restore an alive LaunchServices child is the honest fallback boundary.
      releaseApplicationLaunch(child, configuration.platform);
      save({
        phase: "known-good-restored-running",
        knownGoodRunningAt: new Date().toISOString(),
        rendererReadinessObserved: false
      });
      return true;
    }
    let timeoutReason = `Codex remained alive without renderer readiness for ${configuration.timeoutSeconds} seconds`;
    try {
      if (!requestApplicationQuit(configuration.executable)) {
        timeoutReason += "; Codex shutdown was cancelled";
        return rescue(timeoutReason, state, save, {openTerminal: false});
      }
      const stoppedAfterTimeout = await waitUntil(() => !applicationIsRunning(configuration.executable, {
        platform: configuration.platform
      }), 30_000);
      if (!stoppedAfterTimeout) {
        timeoutReason += "; the exact application process remained alive after its shutdown dialog completed";
        return rescue(timeoutReason, state, save, {openTerminal: false});
      }
    } catch (error) {
      timeoutReason += `; stopping the exact application process failed (${error.message})`;
      return rescue(timeoutReason, state, save, {openTerminal: false});
    }
    return rescue(timeoutReason, state, save, {openTerminal: openTerminalOnFailure});
  } catch (error) {
    return rescue(`safe-start supervisor failed: ${error.message}`, state, save, {openTerminal: openTerminalOnFailure});
  }
}

function discardUnusedKnownGood(configuration, state) {
  if (state.candidateInstalled === true) return;
  for (const value of [configuration.knownGood?.app, configuration.knownGood?.deb,
    configuration.candidate?.deb]) {
    discardIncidentPayload(value, state.incidentDirectory);
  }
}

function discardIncidentPayload(value, incidentDirectory) {
  if (typeof value !== "string") return;
  const backup = path.resolve(value);
  const incident = path.resolve(incidentDirectory);
  const relative = path.relative(incident, backup);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return;
  fs.rmSync(backup, {recursive: true, force: true});
}

function rescue(reason, currentState, save, {openTerminal}) {
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
  if (openTerminal) {
    fs.writeFileSync(commandFile, rescueLauncher(stateFile), {encoding: "utf8", mode: 0o700});
    fs.chmodSync(commandFile, 0o700);
  }
  save({
    phase: "failed",
    failedAt: new Date().toISOString(),
    failure: reason,
    diagnosticFile,
    promptFile,
    rescueCommandFile: openTerminal ? commandFile : currentState.rescueCommandFile ?? null,
    rescueTerminalOpened: openTerminal ? null : currentState.rescueTerminalOpened ?? null,
    rescueTerminalError: openTerminal ? null : currentState.rescueTerminalError ?? null,
    rescueTerminalApplicationOwned: openTerminal ? null : currentState.rescueTerminalApplicationOwned ?? false
  });
  if (openTerminal) {
    const opened = openRescueTerminal({terminalApp: currentState.configuration.terminalApp, commandFile});
    save({
      rescueTerminalOpened: opened.opened,
      rescueTerminalError: opened.error,
      rescueTerminalApplicationOwned: opened.applicationOwned,
      rescueTerminalPid: opened.terminalPid ?? null
    });
  }
  return false;
}

function rescueLauncher(stateFile) {
  const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), "rescue-agent.mjs");
  return "#!/usr/bin/env node\n" +
    "const {spawnSync}=require('node:child_process');\n" +
    "process.env.TMTK_RESCUE_TERMINAL_OWNED='1';\n" +
    `const result=spawnSync(process.execPath,[${JSON.stringify(runner)},${JSON.stringify(stateFile)}],{stdio:'inherit',env:process.env});\n` +
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

function requiredPid(value) {
  const pid = Number(value);
  if (!Number.isInteger(pid) || pid <= 0) fail("safe-start supervisor retry requires a valid rescue PID", 2);
  return pid;
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
