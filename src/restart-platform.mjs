import * as macos from "./platforms/macos.mjs";

const implementations = new Map([["darwin", macos]]);

export function resolveApplication(argument, platform = process.platform) {
  return implementation(platform).resolveApplication(argument);
}

export function applicationLayout(app, platform = process.platform) {
  return implementation(platform).applicationLayout(app);
}

export function defaultTerminal(platform = process.platform) {
  return implementation(platform).defaultTerminal();
}

export function confirmApplicationRestart({
  platform = process.platform,
  processRunner = undefined,
  iconFile = undefined
} = {}) {
  return implementation(platform).confirmApplicationRestart({processRunner, iconFile});
}

export function confirmRepairFallback({
  platform = process.platform,
  processRunner = undefined,
  iconFile = undefined
} = {}) {
  return implementation(platform).confirmRepairFallback({processRunner, iconFile});
}

export function confirmTaskHandoff({
  platform = process.platform,
  processRunner = undefined,
  iconFile = undefined
} = {}) {
  return implementation(platform).confirmTaskHandoff({processRunner, iconFile});
}

export function diagnosticLocations(home, platform = process.platform) {
  return implementation(platform).diagnosticLocations(home);
}

export function launchApplication({
  app,
  marker,
  appLog,
  platform = process.platform,
  processLauncher = undefined
}) {
  return implementation(platform).launchApplication({app, marker, appLog, processLauncher});
}

export function requestApplicationQuit(executable, {
  platform = process.platform,
  processRunner = undefined
} = {}) {
  return implementation(platform).requestApplicationQuit(executable, {processRunner});
}

export function applicationIsRunning(executable, {
  platform = process.platform,
  processRunner
} = {}) {
  return implementation(platform).applicationIsRunning(executable, {processRunner});
}

export function ancestorProcessPid(executable, {
  platform = process.platform,
  startPid = process.ppid,
  processRunner
} = {}) {
  return implementation(platform).ancestorProcessPid(executable, {startPid, processRunner});
}

export function openRescueTerminal({terminalApp, commandFile, processRunner = undefined}, {platform = process.platform} = {}) {
  return implementation(platform).openRescueTerminal({terminalApp, commandFile, processRunner});
}

export function rescueStopHookOverride(options, {platform = process.platform} = {}) {
  return implementation(platform).rescueStopHookOverride(options);
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
  token = undefined
}, {
  platform = process.platform
} = {}) {
  return implementation(platform).replaceApplicationWithVerifiedSource({
    targetApp,
    source,
    processRunner,
    appInspector,
    token
  });
}

function implementation(platform) {
  const value = implementations.get(platform);
  if (value == null) throw new Error(`Codex desktop restart lifecycle is not yet qualified for ${platform}`);
  return value;
}
