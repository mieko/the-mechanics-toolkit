#!/usr/bin/env node
import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {inspectAppBundle} from "../src/app-bundle.mjs";
import {
  ancestorProcessPid,
  applicationIsRunning,
  applicationLayout,
  confirmApplicationRestart,
  confirmRepairFallback,
  confirmTaskHandoff,
  defaultTerminal,
  diagnosticLocations,
  launchApplication,
  openRescueTerminal,
  releaseApplicationLaunch,
  requestApplicationQuit,
  rescueStopHookOverride,
  rescueTerminalClosureRequired,
  resolveApplication
} from "../src/restart-platform.mjs";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-linux-test-"));
try {
  const application = path.join(scratch, "usr/lib/chatgpt");
  const executable = path.join(application, "ChatGPT");
  const cli = path.join(application, "resources/codex");
  makeLinuxApplication(application, "26.908.40834", "8881");

  assert.equal(resolveApplication(application, "linux"), application);
  assert.deepEqual(applicationLayout(application, "linux"), {executable, cli});
  assert.throws(() => resolveApplication("", "linux"), /missing application path/);

  const tools = path.join(scratch, "tools");
  fs.mkdirSync(tools);
  for (const name of ["zenity", "kdialog", "gnome-terminal", "konsole"]) {
    const file = path.join(tools, name);
    fs.writeFileSync(file, "#!/bin/sh\nexit 0\n", {mode: 0o755});
  }
  const gnome = {PATH: tools, XDG_CURRENT_DESKTOP: "GNOME"};
  const kde = {PATH: tools, XDG_CURRENT_DESKTOP: "KDE:Plasma"};
  assert.equal(defaultTerminal("linux", {environment: gnome}), path.join(tools, "gnome-terminal"));
  assert.equal(defaultTerminal("linux", {environment: kde}), path.join(tools, "konsole"));

  const dialogCalls = [];
  assert.equal(confirmApplicationRestart({
    platform: "linux",
    environment: gnome,
    processRunner(command, arguments_, options) {
      dialogCalls.push({command, arguments_, options});
      return {status: 0, stdout: "", stderr: "", error: null};
    }
  }), true);
  assert.equal(dialogCalls[0].command, path.join(tools, "zenity"));
  assert.ok(dialogCalls[0].arguments_.includes("--ok-label=Relaunch Codex"));
  assert.ok(dialogCalls[0].arguments_.includes("--cancel-label=Don't Restart"));
  assert.equal(dialogCalls[0].options.env, gnome);
  assert.equal(confirmApplicationRestart({
    platform: "linux",
    environment: gnome,
    processRunner() {
      return {status: 1, stdout: "", stderr: "", error: null};
    }
  }), false);
  const kdeCalls = [];
  assert.equal(confirmTaskHandoff({
    platform: "linux",
    environment: kde,
    processRunner(command, arguments_) {
      kdeCalls.push({command, arguments_});
      return {status: 0, stdout: "", stderr: "", error: null};
    }
  }), true);
  assert.equal(kdeCalls[0].command, path.join(tools, "kdialog"));
  assert.deepEqual(kdeCalls[0].arguments_.slice(-4), [
    "--yes-label", "Continue", "--no-label", "Don't Relaunch"
  ]);
  assert.equal(confirmRepairFallback({
    platform: "linux",
    environment: gnome,
    processRunner() {
      return {status: 1, stdout: "", stderr: "", error: null};
    }
  }), "interactive");
  const yadTools = path.join(scratch, "yad-tools");
  fs.mkdirSync(yadTools);
  fs.copyFileSync(path.join(tools, "zenity"), path.join(yadTools, "yad"));
  fs.chmodSync(path.join(yadTools, "yad"), 0o755);
  assert.equal(confirmApplicationRestart({
    platform: "linux",
    environment: {PATH: yadTools},
    processRunner() {
      return {status: 252, stdout: "", stderr: "", error: null};
    }
  }), false, "closing a YAD confirmation is cancellation");
  assert.throws(() => confirmApplicationRestart({
    platform: "linux",
    environment: {PATH: path.join(scratch, "empty")},
    processRunner() {
      throw new Error("must not run");
    }
  }), /no supported Linux dialog program/);

  assert.deepEqual(diagnosticLocations(scratch, "linux"), {
    desktopLogs: path.join(scratch, ".local/state/codex/logs"),
    rendererScope: path.join(scratch, ".config/Codex/sentry/scope_v3.json")
  });

  const launchCalls = [];
  const launchChild = new EventEmitter();
  launchChild.unrefCalled = false;
  launchChild.unref = () => { launchChild.unrefCalled = true; };
  const marker = path.join(scratch, "renderer.ready");
  const appLog = path.join(scratch, "app.log");
  assert.equal(launchApplication({
    app: application,
    marker,
    appLog,
    platform: "linux",
    environment: {DISPLAY: ":1"},
    processLauncher(command, arguments_, options) {
      launchCalls.push({command, arguments_, options});
      return launchChild;
    }
  }), launchChild);
  assert.equal(launchCalls[0].command, executable);
  assert.deepEqual(launchCalls[0].arguments_, []);
  assert.equal(launchCalls[0].options.detached, true);
  assert.equal(launchCalls[0].options.env.CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH, marker);
  assert.equal(launchCalls[0].options.env.DISPLAY, ":1");
  assert.equal(launchChild.unrefCalled, true);
  releaseApplicationLaunch(launchChild, "linux");
  assert.equal(launchChild.listenerCount("exit"), 0, "releasing a Linux launch does not kill Desktop");

  const processRoot = path.join(scratch, "proc");
  const shell = path.join(scratch, "bin/sh");
  const otherExecutable = path.join(application, "Other");
  fs.mkdirSync(path.dirname(shell), {recursive: true});
  fs.writeFileSync(shell, "", {mode: 0o755});
  fs.writeFileSync(otherExecutable, "", {mode: 0o755});
  makeProcess(processRoot, 101, 1, executable);
  makeProcess(processRoot, 102, 101, executable, ["--type=renderer"]);
  makeProcess(processRoot, 202, 101, cli);
  makeProcess(processRoot, 303, 202, shell);
  makeProcess(processRoot, 404, 1, shell);
  assert.equal(applicationIsRunning(executable, {platform: "linux", processRoot}), true);
  assert.equal(applicationIsRunning(otherExecutable, {platform: "linux", processRoot}), false);
  assert.equal(ancestorProcessPid(cli, {
    platform: "linux",
    startPid: 303,
    processRoot
  }), 202);
  assert.equal(ancestorProcessPid(cli, {
    platform: "linux",
    startPid: 404,
    processRoot
  }), null);
  const killed = [];
  assert.equal(requestApplicationQuit(executable, {
    platform: "linux",
    processRoot,
    processKiller(pid, signal) {
      killed.push({pid, signal});
    }
  }), true);
  assert.deepEqual(killed, [{pid: 101, signal: "SIGTERM"}]);

  const terminalCalls = [];
  const terminalChild = new EventEmitter();
  terminalChild.pid = 505;
  terminalChild.unrefCalled = false;
  terminalChild.unref = () => { terminalChild.unrefCalled = true; };
  assert.deepEqual(openRescueTerminal({
    terminalApp: path.join(tools, "gnome-terminal"),
    commandFile: "/private/open-rescue.command",
    processLauncher(command, arguments_, options) {
      terminalCalls.push({command, arguments_, options});
      return terminalChild;
    }
  }, {platform: "linux"}), {
    opened: true,
    error: null,
    applicationOwned: false,
    terminalPid: 505
  });
  assert.deepEqual(terminalCalls[0], {
    command: path.join(tools, "gnome-terminal"),
    arguments_: ["--wait", "--", "/private/open-rescue.command"],
    options: {detached: true, stdio: "ignore"}
  });
  assert.equal(terminalChild.unrefCalled, true);
  assert.equal(rescueTerminalClosureRequired({
    terminalApp: path.join(tools, "gnome-terminal"),
    environment: {TMTK_RESCUE_TERMINAL_OWNED: "1"}
  }, {platform: "linux"}), false);
  const hook = rescueStopHookOverride({
    nodeExecutable: "/path/with ' quote/node",
    hookScript: "/toolkit/rescue-turn-stop.mjs",
    receiptFile: "/private/receipt.json",
    taskId: "01900000-0000-7000-8000-000000000001",
    codexHome: "/private/codex-home"
  }, {platform: "linux"});
  assert.match(hook, /\\"'\\"/);
  const inspection = inspectAppBundle(application, {platform: "linux"});
  assert.equal(inspection.identifier, "chatgpt");
  assert.equal(inspection.version, "26.908.40834");
  assert.equal(inspection.build, "8881");
  assert.equal(inspection.asarIntegrity.state, "not-applicable");
  assert.equal(inspection.signature.state, "not-applicable");
  assert.match(inspection.archive.sha256, /^[0-9a-f]{64}$/);
  assert.match(inspection.archive.headerSha256, /^[0-9a-f]{64}$/);
  fs.writeFileSync(path.join(application, "resources/linux-package-metadata.json"), JSON.stringify({
    codexAppBrand: "chatgpt",
    codexBuildFlavor: "prod",
    version: "26.999.1"
  }));
  assert.throws(() => inspectAppBundle(application, {platform: "linux"}), /versions disagree/);

  process.stdout.write("Linux platform behavior probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function makeLinuxApplication(application, version, build) {
  const resources = path.join(application, "resources");
  fs.mkdirSync(resources, {recursive: true});
  fs.writeFileSync(path.join(application, "ChatGPT"), "fixture\n", {mode: 0o755});
  fs.writeFileSync(path.join(resources, "codex"), "fixture\n", {mode: 0o755});
  fs.writeFileSync(path.join(resources, "linux-package-metadata.json"), JSON.stringify({
    codexAppBrand: "chatgpt",
    codexBuildFlavor: "prod",
    version
  }));
  writeAsar(path.join(resources, "app.asar"), {
    name: "openai-codex-electron",
    version,
    codexBuildNumber: build,
    desktopName: "chatgpt.desktop"
  });
}

function writeAsar(file, packageJson) {
  const payload = Buffer.from(JSON.stringify(packageJson));
  const header = Buffer.from(JSON.stringify({
    files: {"package.json": {size: payload.length, offset: "0"}}
  }));
  const headerPayload = Buffer.alloc(align4(4 + header.length));
  headerPayload.writeUInt32LE(header.length, 0);
  header.copy(headerPayload, 4);
  const headerPickle = Buffer.alloc(4 + headerPayload.length);
  headerPickle.writeUInt32LE(headerPayload.length, 0);
  headerPayload.copy(headerPickle, 4);
  const sizePickle = Buffer.alloc(8);
  sizePickle.writeUInt32LE(4, 0);
  sizePickle.writeUInt32LE(headerPickle.length, 4);
  fs.writeFileSync(file, Buffer.concat([sizePickle, headerPickle, payload]));
}

function makeProcess(processRoot, pid, parentPid, executable, arguments_ = []) {
  const directory = path.join(processRoot, String(pid));
  fs.mkdirSync(directory, {recursive: true});
  fs.symlinkSync(fs.realpathSync(executable), path.join(directory, "exe"));
  fs.writeFileSync(path.join(directory, "status"), `Name:\tfixture\nPPid:\t${parentPid}\n`);
  fs.writeFileSync(path.join(directory, "cmdline"), [executable, ...arguments_, ""].join("\0"));
}

function align4(value) {
  return value + ((4 - (value % 4)) % 4);
}
