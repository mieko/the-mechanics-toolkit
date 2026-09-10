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

export function diagnosticLocations(home, platform = process.platform) {
  return implementation(platform).diagnosticLocations(home);
}

export function requestApplicationQuit(executable, {platform = process.platform} = {}) {
  return implementation(platform).requestApplicationQuit(executable);
}

export function runningApplicationPids(executable, {platform = process.platform} = {}) {
  return implementation(platform).runningApplicationPids(executable);
}

export function openRescueTerminal({terminalApp, commandFile}, {platform = process.platform} = {}) {
  return implementation(platform).openRescueTerminal({terminalApp, commandFile});
}

function implementation(platform) {
  const value = implementations.get(platform);
  if (value == null) throw new Error(`Codex desktop restart lifecycle is not yet qualified for ${platform}`);
  return value;
}
