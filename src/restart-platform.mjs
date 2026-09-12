import fs from "node:fs";
import {spawn} from "node:child_process";
import {inspectAppBundle} from "./app-bundle.mjs";
import * as macos from "./platforms/macos.mjs";
import * as linux from "./platforms/linux.mjs";
import * as windows from "./platforms/windows.mjs";

const implementations = new Map([
  ["darwin", macos],
  ["linux", linux],
  ["win32", windows]
]);

export function resolveApplication(argument, platform = process.platform) {
  return implementation(platform).resolveApplication(argument);
}

export function resolveApplicationSource(argument, {
  platform = process.platform,
  fileSystem = undefined
} = {}) {
  const selected = implementation(platform);
  return typeof selected.resolveApplicationSource === "function"
    ? selected.resolveApplicationSource(argument, {fileSystem})
    : selected.resolveApplication(argument);
}

export function applicationLayout(app, platform = process.platform) {
  return implementation(platform).applicationLayout(app);
}

export function resolveCli(executable, {
  platform = process.platform,
  startPid = process.ppid,
  processRunner = undefined
} = {}) {
  const selected = implementation(platform);
  return typeof selected.resolveCli === "function"
    ? selected.resolveCli(executable, {startPid, processRunner})
    : executable;
}

export function inspectApplication(app, {
  platform = process.platform,
  ...options
} = {}) {
  const selected = implementation(platform);
  return typeof selected.inspectApplication === "function"
    ? selected.inspectApplication(app, options)
    : inspectAppBundle(app, {platform, ...options});
}

export function inspectApplicationSource(app, {
  platform = process.platform,
  ...options
} = {}) {
  const selected = implementation(platform);
  const inspector = typeof selected.inspectApplicationSource === "function"
    ? selected.inspectApplicationSource
    : selected.inspectApplication ?? inspectAppBundle;
  return inspector(app, {platform, ...options});
}

export function defaultTerminal(platform = process.platform, options = {}) {
  return implementation(platform).defaultTerminal(options);
}

export function confirmApplicationRestart({
  platform = process.platform,
  processRunner = undefined,
  iconFile = undefined,
  environment = undefined
} = {}) {
  return implementation(platform).confirmApplicationRestart({processRunner, iconFile, environment});
}

export function confirmRepairFallback({
  platform = process.platform,
  processRunner = undefined,
  iconFile = undefined,
  environment = undefined
} = {}) {
  return implementation(platform).confirmRepairFallback({processRunner, iconFile, environment});
}

export function confirmTaskHandoff({
  platform = process.platform,
  processRunner = undefined,
  iconFile = undefined,
  environment = undefined
} = {}) {
  return implementation(platform).confirmTaskHandoff({processRunner, iconFile, environment});
}

export function diagnosticLocations(home, platform = process.platform, app = undefined) {
  return implementation(platform).diagnosticLocations(home, {app});
}

export function launchApplication({
  app,
  marker,
  appLog,
  taskId,
  platform = process.platform,
  processRunner = undefined,
  processLauncher = undefined,
  environment = undefined
}) {
  return implementation(platform).launchApplication({
    app, marker, appLog, taskId, processRunner, processLauncher, environment
  });
}

export function launchSupervisor({
  nodeExecutable,
  supervisorScript,
  stateFile,
  logFile,
  platform = process.platform,
  processRunner = undefined,
  processLauncher = undefined
}) {
  const selected = implementation(platform);
  if (typeof selected.launchSupervisor === "function") {
    return selected.launchSupervisor({
      nodeExecutable, supervisorScript, stateFile, logFile, processRunner, processLauncher
    });
  }
  const launch = processLauncher ?? spawn;
  const log = fs.openSync(logFile, "a", 0o600);
  let child;
  try {
    child = launch(nodeExecutable, [supervisorScript, "supervise", stateFile], {
      detached: true,
      stdio: ["ignore", log, log],
      env: process.env
    });
  } finally {
    fs.closeSync(log);
  }
  child.unref();
  return child;
}

export function releaseApplicationLaunch(child, platform = process.platform) {
  return implementation(platform).releaseApplicationLaunch(child);
}

export function requestApplicationQuit(executable, {
  platform = process.platform,
  processRunner = undefined,
  processRoot = undefined,
  fileSystem = undefined,
  processKiller = undefined
} = {}) {
  return implementation(platform).requestApplicationQuit(executable, {
    processRunner,
    processRoot,
    fileSystem,
    processKiller
  });
}

export function applicationIsRunning(executable, {
  platform = process.platform,
  processRunner,
  processRoot = undefined,
  fileSystem = undefined
} = {}) {
  return implementation(platform).applicationIsRunning(executable, {processRunner, processRoot, fileSystem});
}

export function ancestorProcessPid(executable, {
  platform = process.platform,
  startPid = process.ppid,
  processRunner,
  processRoot = undefined,
  fileSystem = undefined
} = {}) {
  return implementation(platform).ancestorProcessPid(executable, {
    startPid,
    processRunner,
    processRoot,
    fileSystem
  });
}

export function openRescueTerminal({
  terminalApp,
  commandFile,
  processRunner = undefined,
  processLauncher = undefined
}, {
  platform = process.platform
} = {}) {
  return implementation(platform).openRescueTerminal({
    terminalApp,
    commandFile,
    processRunner,
    processLauncher
  });
}

export function rescueStopHookOverride(options, {platform = process.platform} = {}) {
  return implementation(platform).rescueStopHookOverride(options);
}

export function rescueTerminalClosureRequired(options, {platform = process.platform} = {}) {
  return implementation(platform).rescueTerminalClosureRequired(options);
}

export function prepareCandidateAdoption(options, {platform = process.platform} = {}) {
  return implementation(platform).prepareCandidateAdoption(options);
}

export function closeOwnedRescueTerminal({
  terminalApp,
  applicationOwned = false,
  completionFile = null,
  environment = process.env,
  processRunner = undefined,
  processLauncher = undefined
}, {
  platform = process.platform
} = {}) {
  return implementation(platform).closeOwnedRescueTerminal({
    terminalApp,
    applicationOwned,
    completionFile,
    environment,
    processRunner,
    processLauncher
  });
}

export function finishRescueTerminalClosure({
  completionFile,
  processRunner = undefined
}, {
  platform = process.platform
} = {}) {
  const selected = implementation(platform);
  return typeof selected.finishRescueTerminalClosure === "function"
    ? selected.finishRescueTerminalClosure({completionFile, processRunner})
    : true;
}

export function replaceApplicationWithVerifiedSource({
  targetApp,
  source,
  processRunner = undefined,
  appInspector = undefined,
  sourceInspector = undefined,
  effectiveUserId = undefined,
  token = undefined
}, {
  platform = process.platform
} = {}) {
  return implementation(platform).replaceApplicationWithVerifiedSource({
    targetApp,
    source,
    processRunner,
    appInspector,
    sourceInspector,
    effectiveUserId,
    token
  });
}

function implementation(platform) {
  const value = implementations.get(platform);
  if (value == null) throw new Error(`Codex desktop restart lifecycle is not yet qualified for ${platform}`);
  return value;
}
