import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectAppBundle } from "../app-bundle.mjs";

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
  set dialogMessage to "Codex restart is armed." & return & return & "Wait for all active agents to reach a safe stopping point, then click Relaunch Codex."
try
  if (count of arguments) > 0 then
    set iconFile to POSIX file (item 1 of arguments) as alias
    set answer to display dialog dialogMessage with title "The Mechanic's Toolkit" buttons {"Don't Restart", "Relaunch Codex"} default button "Relaunch Codex" cancel button "Don't Restart" with icon iconFile
  else
    set answer to display dialog dialogMessage with title "The Mechanic's Toolkit" buttons {"Don't Restart", "Relaunch Codex"} default button "Relaunch Codex" cancel button "Don't Restart" with icon note
  end if
  return button returned of answer
on error number -128
  return "Don't Restart"
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
  if (choice === "Don't Restart") return false;
  throw new Error(`macOS restart confirmation returned an unknown choice: ${choice || "<empty>"}`);
}

export function confirmRepairFallback({processRunner = spawnSync, iconFile = toolkitIcon} = {}) {
  const script = String.raw`
on run arguments
  set dialogMessage to "Codex could not be repaired after three attempts." & return & return & "Restore the last known-working version, or open a terminal line to continue troubleshooting with the agent."
try
  if (count of arguments) > 0 then
    set iconFile to POSIX file (item 1 of arguments) as alias
    set answer to display dialog dialogMessage with title "The Mechanic's Toolkit" buttons {"Open Terminal Line with Agent", "Restore Known-Working"} default button "Restore Known-Working" cancel button "Open Terminal Line with Agent" with icon iconFile
  else
    set answer to display dialog dialogMessage with title "The Mechanic's Toolkit" buttons {"Open Terminal Line with Agent", "Restore Known-Working"} default button "Restore Known-Working" cancel button "Open Terminal Line with Agent" with icon stop
  end if
  return button returned of answer
on error number -128
  return "Open Terminal Line with Agent"
end try
end run`;
  const arguments_ = fs.existsSync(iconFile) ? ["-", iconFile] : ["-"];
  const result = processRunner("/usr/bin/osascript", arguments_, {
    encoding: "utf8",
    input: script
  });
  if (result.error != null) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout).trim() || "macOS repair fallback confirmation failed");
  }
  const choice = result.stdout.trim();
  if (choice === "Restore Known-Working") return "restore";
  if (choice === "Open Terminal Line with Agent") return "interactive";
  throw new Error(`macOS repair fallback returned an unknown choice: ${choice || "<empty>"}`);
}

export function confirmTaskHandoff({processRunner = spawnSync, iconFile = toolkitIcon} = {}) {
  const script = String.raw`
on run arguments
  set dialogMessage to "Codex closed, but the agent task that armed this restart is still active." & return & return & "Close its existing terminal or session, then click Continue."
try
  if (count of arguments) > 0 then
    set iconFile to POSIX file (item 1 of arguments) as alias
    set answer to display dialog dialogMessage with title "The Mechanic's Toolkit" buttons {"Don't Relaunch", "Continue"} default button "Continue" cancel button "Don't Relaunch" with icon iconFile
  else
    set answer to display dialog dialogMessage with title "The Mechanic's Toolkit" buttons {"Don't Relaunch", "Continue"} default button "Continue" cancel button "Don't Relaunch" with icon caution
  end if
  return button returned of answer
on error number -128
  return "Don't Relaunch"
end try
end run`;
  const arguments_ = fs.existsSync(iconFile) ? ["-", iconFile] : ["-"];
  const result = processRunner("/usr/bin/osascript", arguments_, {
    encoding: "utf8",
    input: script
  });
  if (result.error != null) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout).trim() || "macOS task handoff confirmation failed");
  }
  const choice = result.stdout.trim();
  if (choice === "Continue") return true;
  if (choice === "Don't Relaunch") return false;
  throw new Error(`macOS task handoff confirmation returned an unknown choice: ${choice || "<empty>"}`);
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

export function applicationIsRunning(executable, {processRunner = spawnSync} = {}) {
  const script = String.raw`
ObjC.import("AppKit");
function run(arguments_) {
  const expectedExecutable = arguments_[0];
  const applications = $.NSRunningApplication.runningApplicationsWithBundleIdentifier("com.openai.codex");
  for (let index = 0; index < applications.count; index += 1) {
    const executableURL = applications.objectAtIndex(index).executableURL;
    if (executableURL && ObjC.unwrap(executableURL.path) === expectedExecutable) return "true";
  }
  return "false";
}`;
  const result = processRunner("/usr/bin/osascript", [
    "-l", "JavaScript", "-", executable
  ], {encoding: "utf8", input: script});
  if (result.error != null) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout).trim() || "macOS could not inspect Codex");
  }
  const running = result.stdout.trim();
  if (running === "true") return true;
  if (running === "false") return false;
  throw new Error(`macOS returned an invalid Codex application state for ${executable}: ${running || "<empty>"}`);
}

export function ancestorProcessPid(executable, {
  startPid = process.ppid,
  processRunner = spawnSync,
  maximumDepth = 32
} = {}) {
  if (typeof executable !== "string" || executable.trim() === "") {
    throw new Error("ancestor executable is required");
  }
  if (!Number.isInteger(startPid) || startPid <= 0) {
    throw new Error("ancestor search requires a valid starting PID");
  }
  let pid = startPid;
  const visited = new Set();
  for (let depth = 0; depth < maximumDepth && pid > 1 && !visited.has(pid); depth += 1) {
    visited.add(pid);
    const result = processRunner("/bin/ps", [
      "-p", String(pid), "-o", "pid=", "-o", "ppid=", "-o", "comm="
    ], {encoding: "utf8"});
    if (result.error != null) throw result.error;
    if (result.status !== 0 || result.stdout.trim() === "") return null;
    const match = result.stdout.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/);
    if (match == null) throw new Error(`macOS returned an invalid process identity for PID ${pid}`);
    const observedPid = Number(match[1]);
    const parentPid = Number(match[2]);
    const command = match[3];
    if (observedPid !== pid) throw new Error(`macOS returned the wrong process identity for PID ${pid}`);
    if (command === executable) return pid;
    pid = parentPid;
  }
  return null;
}

export function requestApplicationQuit(executable, {processRunner = spawnSync} = {}) {
  if (!applicationIsRunning(executable, {processRunner})) return true;
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

export function replaceApplicationWithVerifiedSource({
  targetApp,
  source: verifiedSource,
  processRunner = spawnSync,
  appInspector = inspectAppBundle,
  token = crypto.randomUUID()
}) {
  const target = path.resolve(targetApp);
  if (typeof verifiedSource?.app !== "string" || verifiedSource.app.trim() === "") {
    throw new Error("verified source application path is required");
  }
  const source = path.resolve(verifiedSource.app);
  if (source === target || containsPath(source, target) || containsPath(target, source)) {
    throw new Error("known-good and live application paths must be separate");
  }
  const sourceInspection = appInspector(source);
  requireVerifiedSourceMatch(sourceInspection, verifiedSource, "verified source");

  const staging = `${target}.tmtk-restore-${token}`;
  const displaced = `${target}.tmtk-failed-${token}`;
  if (fs.existsSync(staging) || fs.existsSync(displaced)) {
    throw new Error("known-good restore workspace already exists");
  }

  let targetDisplaced = false;
  let replacementInstalled = false;
  try {
    const copied = processRunner("/usr/bin/ditto", [source, staging], {encoding: "utf8"});
    if (copied.error != null) throw copied.error;
    if (copied.status !== 0) {
      throw new Error((copied.stderr || copied.stdout).trim() || "could not copy known-good application");
    }
    requireVerifiedSourceMatch(appInspector(staging), verifiedSource, "copied application");
    if (fs.existsSync(target)) {
      fs.renameSync(target, displaced);
      targetDisplaced = true;
    }
    fs.renameSync(staging, target);
    replacementInstalled = true;
    requireVerifiedSourceMatch(appInspector(target), verifiedSource, "installed application");
    if (targetDisplaced) fs.rmSync(displaced, {recursive: true, force: true});
    return {
      app: target,
      version: verifiedSource.version,
      build: verifiedSource.build,
      archiveSha256: verifiedSource.archiveSha256
    };
  } catch (error) {
    try {
      if (targetDisplaced) {
        if (fs.existsSync(target)) fs.renameSync(target, staging);
        fs.renameSync(displaced, target);
      } else if (replacementInstalled && fs.existsSync(target)) {
        fs.rmSync(target, {recursive: true, force: true});
      }
    } catch (rollbackError) {
      throw new Error(`${error.message}; restoring the failed application also failed (${rollbackError.message})`);
    } finally {
      if (fs.existsSync(staging)) fs.rmSync(staging, {recursive: true, force: true});
    }
    throw error;
  }
}

function requireVerifiedSourceMatch(inspection, expected, label) {
  if (inspection.signature?.state !== "valid" || inspection.asarIntegrity?.state !== "valid") {
    throw new Error(`${label} failed signature or ASAR-integrity verification`);
  }
  const actual = {
    version: inspection.version,
    build: inspection.build,
    archiveSha256: inspection.archive?.sha256
  };
  for (const key of Object.keys(actual)) {
    if (typeof expected?.[key] !== "string" || actual[key] !== expected[key]) {
      throw new Error(`${label} no longer matches the app verified when the restart was armed`);
    }
  }
}

function containsPath(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}
