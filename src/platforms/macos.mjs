import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const toolkitIcon = path.resolve(directory, "../../assets/TheMechanicsToolkit.icns");

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

export function confirmApplicationRestart({processRunner = spawnSync, iconFile = toolkitIcon} = {}) {
  const script = String.raw`
on run arguments
  set dialogMessage to "Codex restart is armed. Wait for the agent to finish its current response, then click Relaunch Codex. Codex may next warn that schedules will not run while it is closed; answer that native prompt too. If you are not ready, click Cancel and the running application will remain open."
try
  if (count of arguments) > 0 then
    set iconFile to POSIX file (item 1 of arguments) as alias
    set answer to display dialog dialogMessage with title "The Mechanic's Toolkit" buttons {"Cancel", "Relaunch Codex"} default button "Relaunch Codex" cancel button "Cancel" with icon iconFile
  else
    set answer to display dialog dialogMessage with title "The Mechanic's Toolkit" buttons {"Cancel", "Relaunch Codex"} default button "Relaunch Codex" cancel button "Cancel" with icon note
  end if
  return button returned of answer
on error number -128
  return "Cancel"
end try
end run`;
  const arguments_ = fs.existsSync(iconFile) ? ["-", iconFile] : ["-"];
  const result = processRunner("/usr/bin/osascript", arguments_, {
    encoding: "utf8",
    input: script
  });
  if (result.error != null) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout).trim() || "macOS restart confirmation failed");
  }
  const choice = result.stdout.trim();
  if (choice === "Relaunch Codex") return true;
  if (choice === "Cancel") return false;
  throw new Error(`macOS restart confirmation returned an unknown choice: ${choice || "<empty>"}`);
}

export function diagnosticLocations(home) {
  return {
    desktopLogs: path.join(home, "Library/Logs/com.openai.codex"),
    rendererScope: path.join(home, "Library/Application Support/Codex/sentry/scope_v3.json")
  };
}

export function launchApplication({app, marker, appLog, processLauncher = spawn}) {
  const child = processLauncher("/usr/bin/open", [
    "-W", "-n",
    "--env", `CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH=${marker}`,
    "--stdout", appLog,
    "--stderr", appLog,
    app
  ], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  return child;
}

export function requestApplicationQuit(executable, {processTable = null, processRunner = spawnSync} = {}) {
  if (primaryApplicationPids(executable, processTable).length === 0) return true;
  const script = String.raw`
with timeout of 86400 seconds
  tell application id "com.openai.codex" to quit
end timeout`;
  const result = processRunner("/usr/bin/osascript", ["-e", script], {encoding: "utf8"});
  if (result.error != null) throw result.error;
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout).trim();
    if (/User canceled|\(-128\)/i.test(message)) return false;
    throw new Error(message || "macOS refused to quit Codex");
  }
  return true;
}

export function runningApplicationPids(executable, {processTable = null} = {}) {
  const cli = path.join(path.dirname(path.dirname(executable)), "Resources/codex");
  return readProcessTable(processTable).flatMap(line => {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (match == null) return [];
    const command = match[2];
    return command === executable || command.startsWith(`${executable} `) ||
      command === cli || command.startsWith(`${cli} `) ? [Number(match[1])] : [];
  });
}

function primaryApplicationPids(executable, processTable = null) {
  return readProcessTable(processTable).flatMap(line => {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (match == null) return [];
    const command = match[2];
    return command === executable || command.startsWith(`${executable} `) ? [Number(match[1])] : [];
  });
}

function readProcessTable(value = null) {
  if (value != null) return String(value).split("\n");
  const result = spawnSync("/bin/ps", ["-axo", "pid=,command="], {encoding: "utf8"});
  if (result.error != null) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim() || "cannot inspect macOS processes");
  return result.stdout.split("\n");
}

export function openRescueTerminal({terminalApp, commandFile, processRunner = spawnSync}) {
  if (terminalApp === "Terminal") {
    const running = processRunner("/usr/bin/osascript", [
      "-e", 'application id "com.apple.Terminal" is running'
    ], {encoding: "utf8"});
    if (running.error != null) {
      return {opened: false, error: running.error.message.slice(0, 1000), applicationOwned: false};
    }
    if (running.status !== 0) {
      return {
        opened: false,
        error: (running.stderr || running.stdout || "macOS could not inspect Terminal").trim().slice(0, 1000),
        applicationOwned: false
      };
    }
    const applicationOwned = running.stdout.trim() !== "true";
    if (applicationOwned) {
      const result = processRunner("/usr/bin/open", ["-a", terminalApp, commandFile], {encoding: "utf8"});
      if (result.error != null) {
        return {opened: false, error: result.error.message.slice(0, 1000), applicationOwned: false};
      }
      const opened = result.status === 0;
      return {
        opened,
        error: opened ? null : (result.stderr || result.stdout || "macOS did not open the rescue terminal").trim().slice(0, 1000),
        applicationOwned: opened
      };
    }
    const command = `exec ${shellQuote(commandFile)}`;
    const script = `tell application id "com.apple.Terminal" to do script ${JSON.stringify(command)}`;
    const result = processRunner("/usr/bin/osascript", ["-e", script], {encoding: "utf8"});
    if (result.error != null) {
      return {opened: false, error: result.error.message.slice(0, 1000), applicationOwned: false};
    }
    const opened = result.status === 0;
    return {
      opened,
      error: opened ? null : (result.stderr || result.stdout || "macOS did not open the rescue terminal").trim().slice(0, 1000),
      applicationOwned: false
    };
  }

  const result = processRunner("/usr/bin/open", ["-a", terminalApp, commandFile], {encoding: "utf8"});
  if (result.error != null) return {opened: false, error: result.error.message.slice(0, 1000), applicationOwned: false};
  return {
    opened: result.status === 0,
    error: result.status === 0 ? null : (result.stderr || result.stdout || "macOS did not open the rescue terminal").trim().slice(0, 1000),
    applicationOwned: false
  };
}

export function rescueStopHookOverride({nodeExecutable, hookScript, receiptFile, taskId, codexHome}) {
  const command = [nodeExecutable, hookScript, receiptFile, taskId, codexHome].map(shellQuote).join(" ");
  return `hooks.Stop=[{hooks=[{type="command",command=${JSON.stringify(command)},timeout=30,statusMessage="Finishing rescue turn"}]}]`;
}

export function closeOwnedRescueTerminal({
  terminalApp,
  applicationOwned = false,
  completionFile = null,
  environment = process.env,
  processRunner = spawnSync,
  processLauncher = spawn
} = {}) {
  if (environment.TMTK_RESCUE_TERMINAL_OWNED !== "1" || terminalApp !== "Terminal") {
    return {scheduled: false, reason: "not-owned"};
  }
  const ttyResult = processRunner("/usr/bin/tty", [], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"]
  });
  if (ttyResult.error != null || ttyResult.status !== 0) {
    return {scheduled: false, reason: "tty-unavailable"};
  }
  const targetTty = ttyResult.stdout.trim();
  if (!/^\/dev\/tty[0-9A-Za-z]+$/.test(targetTty)) {
    return {scheduled: false, reason: "tty-unavailable"};
  }
  const completionCommand = typeof completionFile === "string" && completionFile !== "" ?
    `do shell script ${JSON.stringify(`/usr/bin/touch ${shellQuote(completionFile)}`)}` : "";
  const script = `
delay 1
set targetTty to ${JSON.stringify(targetTty)}
set applicationOwned to ${applicationOwned ? "true" : "false"}
if applicationOwned then
  tell application id "com.apple.Terminal" to quit
else
  set targetWindowId to missing value
  tell application id "com.apple.Terminal"
    repeat with terminalWindow in windows
      if targetWindowId is missing value then
        repeat with terminalTab in tabs of terminalWindow
          if tty of terminalTab is targetTty then
            set targetWindowId to id of terminalWindow
            exit repeat
          end if
        end repeat
      end if
    end repeat
    if targetWindowId is not missing value then close window id targetWindowId
  end tell
  if targetWindowId is missing value then return "not-found"
end if
${completionCommand}
return "closed"
`;
  let child;
  try {
    child = processLauncher("/usr/bin/osascript", ["-e", script], {
      detached: true,
      stdio: "ignore"
    });
  } catch {
    return {scheduled: false, reason: "close-failed"};
  }
  child.once("error", () => {});
  child.unref();
  return {scheduled: true, tty: targetTty};
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}
