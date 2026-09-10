import path from "node:path";
import { spawnSync } from "node:child_process";

export function resolveApplication(argument) {
  if (typeof argument !== "string" || argument.trim() === "") {
    throw new Error("missing application path after --");
  }
  const resolved = path.resolve(argument);
  return resolved.endsWith(".app") ? resolved : path.join(resolved, "ChatGPT.app");
}

export function applicationLayout(app) {
  return {
    executable: path.join(app, "Contents/MacOS/ChatGPT"),
    cli: path.join(app, "Contents/Resources/codex")
  };
}

export function defaultTerminal() {
  return "Terminal";
}

export function diagnosticLocations(home) {
  return {
    desktopLogs: path.join(home, "Library/Logs/com.openai.codex"),
    rendererScope: path.join(home, "Library/Application Support/Codex/sentry/scope_v3.json")
  };
}

export function requestApplicationQuit(executable) {
  if (runningApplicationPids(executable).length === 0) return;
  const result = spawnSync("/usr/bin/osascript", ["-e", 'tell application id "com.openai.codex" to quit'], {
    encoding: "utf8",
    timeout: 10_000
  });
  if (result.error != null) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim() || "macOS refused to quit Codex");
}

export function runningApplicationPids(executable) {
  const result = spawnSync("/bin/ps", ["-axo", "pid=,command="], {encoding: "utf8"});
  if (result.error != null) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim() || "cannot inspect macOS processes");
  return result.stdout.split("\n").flatMap(line => {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (match == null) return [];
    const command = match[2];
    return command === executable || command.startsWith(`${executable} `) ? [Number(match[1])] : [];
  });
}

export function openRescueTerminal({terminalApp, commandFile}) {
  const result = spawnSync("/usr/bin/open", ["-a", terminalApp, commandFile], {encoding: "utf8"});
  if (result.error != null) return {opened: false, error: result.error.message.slice(0, 1000)};
  return {
    opened: result.status === 0,
    error: result.status === 0 ? null : (result.stderr || result.stdout || "macOS did not open the rescue terminal").trim().slice(0, 1000)
  };
}
