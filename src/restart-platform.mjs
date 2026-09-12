import * as macos from "./platforms/macos.mjs";
import * as linux from "./platforms/linux.mjs";

const implementations = new Map([
  ["darwin", macos],
  ["linux", linux]
]);

export function resolveApplication(argument, platform = process.platform) {
  return implementation(platform).resolveApplication(argument);
}

export function applicationLayout(app, platform = process.platform) {
  return implementation(platform).applicationLayout(app);
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

export function diagnosticLocations(home, platform = process.platform) {
  return implementation(platform).diagnosticLocations(home);
}

export function launchApplication({
  app,
  marker,
  appLog,
  platform = process.platform,
  processLauncher = undefined,
  environment = undefined
}) {
  return implementation(platform).launchApplication({app, marker, appLog, processLauncher, environment});
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
