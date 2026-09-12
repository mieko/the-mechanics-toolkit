import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ancestorProcessPid,
  applicationLayout,
  applicationIsRunning,
  closeOwnedRescueTerminal,
  confirmApplicationRestart,
  confirmRepairFallback,
  confirmTaskHandoff,
  defaultTerminal,
  diagnosticLocations,
  finishRescueTerminalClosure,
  inspectApplication,
  inspectApplicationSource,
  launchApplication,
  launchSupervisor,
  openRescueTerminal,
  prepareCandidateAdoption,
  releaseApplicationLaunch,
  replaceApplicationWithVerifiedSource,
  requestApplicationQuit,
  resolveApplication,
  resolveApplicationSource,
  resolveCli,
  rescueStopHookOverride,
  rescueTerminalClosureRequired
} from "../src/restart-platform.mjs";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tmtk-windows-platform-test-"));
try {
  const powershellCalls = [];
  const runChoice = choice => (command, arguments_, options) => {
    powershellCalls.push({command, arguments_, options});
    return {status: 0, stdout: `${choice}\r\n`, stderr: "", error: null};
  };

  assert.equal(confirmApplicationRestart({
    platform: "win32",
    processRunner: runChoice("restart")
  }), true);
  assert.equal(confirmApplicationRestart({
    platform: "win32",
    processRunner: runChoice("cancel")
  }), false);
  assert.equal(confirmRepairFallback({
    platform: "win32",
    processRunner: runChoice("restore")
  }), "restore");
  assert.equal(confirmRepairFallback({
    platform: "win32",
    processRunner: runChoice("interactive")
  }), "interactive");
  assert.equal(confirmTaskHandoff({
    platform: "win32",
    processRunner: runChoice("continue")
  }), true);
  assert.equal(confirmTaskHandoff({
    platform: "win32",
    processRunner: runChoice("cancel")
  }), false);
  for (const [index, action] of [
    "confirm-restart",
    "confirm-restart",
    "confirm-repair",
    "confirm-repair",
    "confirm-handoff",
    "confirm-handoff"
  ].entries()) {
    assert.equal(powershellCalls[index].command, "powershell.exe");
    assert.deepEqual(powershellCalls[index].arguments_.slice(0, 7), [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-WindowStyle", "Hidden", "-ExecutionPolicy"
    ]);
    assert.equal(powershellCalls[index].arguments_[7], "Bypass");
    assert.equal(powershellCalls[index].arguments_[8], "-File");
    assert.match(powershellCalls[index].arguments_[9], /windows\.ps1$/);
    assert.equal(powershellCalls[index].arguments_[10], action);
    assert.match(powershellCalls[index].arguments_[11], /TheMechanicsToolkit\.ico$/);
    assert.equal(powershellCalls[index].options.windowsHide, true);
    assert.ok(Object.entries(powershellCalls[index].options.env)
      .some(([key, value]) => key.toLowerCase() === "path" && typeof value === "string" && value !== ""));
    assert.equal(Object.keys(powershellCalls[index].options.env)
      .some(key => key.toLowerCase() === "psmodulepath"), false);
  }

  assert.throws(() => confirmApplicationRestart({
    platform: "win32",
    processRunner: runChoice("Relaunch Codex")
  }), /unknown choice/);
  const missingIconCalls = [];
  assert.equal(confirmApplicationRestart({
    platform: "win32",
    iconFile: path.join(scratch, "missing.ico"),
    processRunner(command, arguments_, options) {
      missingIconCalls.push({command, arguments_, options});
      return {status: 0, stdout: "cancel\r\n", stderr: "", error: null};
    }
  }), false);
  assert.deepEqual(missingIconCalls[0].arguments_.slice(-1), ["confirm-restart"]);

  const executable = String.raw`C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe`;
  const applicationRoot = String.raw`C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0`;
  assert.equal(resolveApplication(executable, "win32"), applicationRoot);
  assert.equal(resolveApplication(applicationRoot, "win32"), applicationRoot);
  assert.deepEqual(applicationLayout(applicationRoot, "win32"), {
    executable,
    cli: String.raw`C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0\app\resources\codex.exe`
  });
  assert.deepEqual(diagnosticLocations(String.raw`C:\Users\Mike`, "win32", applicationRoot), {
    desktopLogs: String.raw`C:\Users\Mike\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Codex\Logs`,
    rendererScope: String.raw`C:\Users\Mike\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Codex\web\Codex\sentry\scope_v3.json`
  });
  assert.throws(() => diagnosticLocations(String.raw`C:\Users\Mike`, "win32",
    String.raw`C:\extracted\ChatGPT`), /no exact OpenAI Codex MSIX identity/);
  const packagedCli = String.raw`C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0\app\resources\codex.exe`;
  const cachedCli = String.raw`C:\Users\Mike\AppData\Local\OpenAI\Codex\bin\0123456789abcdef\codex.exe`;
  assert.equal(resolveCli(packagedCli, {
    platform: "win32",
    startPid: 913,
    processRunner(command, arguments_) {
      assert.equal(command, "powershell.exe");
      assert.deepEqual(arguments_.slice(-3), ["resolve-cli", packagedCli, "913"]);
      return {status: 0, stdout: `${cachedCli}\r\n`, stderr: "", error: null};
    }
  }), cachedCli);
  const archive = String.raw`C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0\app\resources\app.asar`;
  const inspected = inspectApplication(applicationRoot, {
    platform: "win32",
    fileSystem: {
      statSync(value) {
        return {
          isDirectory: () => value === applicationRoot,
          isFile: () => value === executable || value === archive
        };
      }
    },
    fileHasher(value) {
      assert.equal(value, archive);
      return "c".repeat(64);
    },
    headerHasher(value) {
      assert.equal(value, archive);
      return "d".repeat(64);
    },
    archiveFileReader(value, file) {
      assert.equal(value, archive);
      assert.equal(file, "package.json");
      return Buffer.from(JSON.stringify({
        version: "26.903.61454",
        codexBuildNumber: "8378",
        devDependencies: {electron: "42.3.0"}
      }));
    },
    processRunner(command, arguments_) {
      assert.equal(command, "powershell.exe");
      if (arguments_[10] === "inspect-asar-integrity") {
        assert.deepEqual(arguments_.slice(-2), ["inspect-asar-integrity", executable]);
        return {status: 0, stdout: `${JSON.stringify({
          state: "present",
          resource: JSON.stringify([{
            file: "resources/app.asar",
            alg: "SHA256",
            value: "d".repeat(64)
          }])
        })}\r\n`, stderr: "", error: null};
      }
      assert.deepEqual(arguments_.slice(-3), ["inspect-package", applicationRoot, executable]);
      return {status: 0, stdout: `${JSON.stringify({
        name: "OpenAI.Codex",
        publisher: "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B",
        packageFullName: "OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0",
        packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
        installLocation: applicationRoot,
        version: "1.0.0.0",
        architecture: "X64",
        status: "Ok",
        signatureKind: "Store",
        executableSignature: "Valid",
        applicationId: "OpenAI.Codex_2p2nqsd0c76g0!App"
      })}\r\n`, stderr: "", error: null};
    }
  });
  assert.equal(inspected.package.outerVersion, "1.0.0.0");
  assert.equal(inspected.package.publisher, "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B");
  assert.equal(inspected.version, "26.903.61454");
  assert.equal(inspected.build, "8378");
  assert.equal(inspected.electron, "42.3.0");
  assert.equal(inspected.archive.sha256, "c".repeat(64));
  assert.equal(inspected.signature.state, "valid");
  assert.equal(inspected.package.applicationId, "OpenAI.Codex_2p2nqsd0c76g0!App");
  assert.equal(inspected.asarIntegrity.state, "valid");
  assert.throws(() => resolveApplication(String.raw`C:\Downloads\ChatGPT.msix`, "win32"),
    /requires an installed or extracted application directory/);
  const candidatePackage = String.raw`C:\staging\OpenAI.Codex_1.0.0.1_arm64.msix`;
  assert.equal(resolveApplicationSource(candidatePackage, {
    platform: "win32",
    fileSystem: {statSync: () => ({isFile: () => true})}
  }), candidatePackage);
  const candidateArchiveHash = "e".repeat(64);
  const candidateArtifactHash = "f".repeat(64);
  const candidateInspection = inspectApplicationSource(candidatePackage, {
    platform: "win32",
    fileSystem: {statSync: () => ({isFile: () => true})},
    temporaryRoot: scratch,
    archiveFileReader(value, file) {
      assert.equal(path.basename(value), "app.asar");
      assert.equal(file, "package.json");
      return Buffer.from(JSON.stringify({
        version: "26.903.61454",
        codexBuildNumber: "8378",
        devDependencies: {electron: "42.3.0"}
      }));
    },
    fileHasher(value) {
      return path.basename(value) === "app.asar" ? candidateArchiveHash : candidateArtifactHash;
    },
    processRunner(command, arguments_) {
      assert.equal(command, "powershell.exe");
      assert.equal(arguments_.at(-4), "inspect-msix");
      assert.equal(arguments_.at(-3), candidatePackage);
      return {status: 0, stdout: `${JSON.stringify({
        name: "OpenAI.Codex",
        publisher: "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B",
        version: "1.0.0.1",
        architecture: "arm64",
        resourceId: "",
        applicationId: "OpenAI.Codex_2p2nqsd0c76g0!App",
        signature: "Valid",
        signerSubject: "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B",
        executableSignature: "Valid",
        asarSha256: candidateArchiveHash
      })}\r\n`, stderr: "", error: null};
    }
  });
  assert.equal(candidateInspection.package.fullName,
    "OpenAI.Codex_1.0.0.1_arm64__2p2nqsd0c76g0");
  assert.equal(candidateInspection.artifact.sha256, candidateArtifactHash);
  assert.equal(candidateInspection.archive.sha256, candidateArchiveHash);
  assert.equal(candidateInspection.signature.state, "valid");
  const adoptionRoot = String.raw`C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_arm64__2p2nqsd0c76g0`;
  const recoveryPackage = String.raw`C:\staging\OpenAI.Codex_1.0.0.2_arm64.msix`;
  const incidentDirectory = String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident`;
  const capturedRecovery = path.win32.join(incidentDirectory, "known-good.msix");
  const packageIdentity = outerVersion => ({
    fullName: `OpenAI.Codex_${outerVersion}_arm64__2p2nqsd0c76g0`,
    familyName: "OpenAI.Codex_2p2nqsd0c76g0",
    publisher: "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B",
    outerVersion,
    architecture: "arm64",
    status: "Ok",
    applicationId: "OpenAI.Codex_2p2nqsd0c76g0!App"
  });
  const receipt = (app, outerVersion, archiveSha256 = "c".repeat(64)) => ({
    app,
    version: "26.908.40834",
    build: "8881",
    archiveSha256,
    artifactSha256: "d".repeat(64),
    packageFullName: packageIdentity(outerVersion).fullName,
    package: packageIdentity(outerVersion)
  });
  const copiedPackages = [];
  const prepared = prepareCandidateAdoption({
    candidatePath: candidatePackage,
    candidateSourcePath: null,
    knownGoodPath: recoveryPackage,
    configuration: {app: adoptionRoot, platform: "win32"},
    incidentDirectory,
    verifyApplicationSource(source) {
      if (source === adoptionRoot) return receipt(source, "1.0.0.0");
      if (source === candidatePackage) return receipt(source, "1.0.0.1", "e".repeat(64));
      if (source === recoveryPackage || source === capturedRecovery) return receipt(source, "1.0.0.2");
      throw new Error(`unexpected Windows adoption source: ${source}`);
    },
    fileSystem: {
      copyFileSync(source, destination, mode) { copiedPackages.push({source, destination, mode}); }
    }
  }, {platform: "win32"});
  assert.equal(prepared.candidate.app, candidatePackage);
  assert.equal(prepared.knownGood.app, capturedRecovery);
  assert.deepEqual(copiedPackages, [{
    source: recoveryPackage,
    destination: capturedRecovery,
    mode: fs.constants.COPYFILE_EXCL
  }]);
  assert.throws(() => prepareCandidateAdoption({
    candidatePath: candidatePackage,
    candidateSourcePath: null,
    knownGoodPath: recoveryPackage,
    configuration: {app: adoptionRoot, platform: "win32"},
    incidentDirectory,
    verifyApplicationSource(source) {
      const value = source === candidatePackage
        ? receipt(source, "1.0.0.1", "e".repeat(64))
        : receipt(source, source === adoptionRoot ? "1.0.0.0" : "1.0.0.2");
      return source === recoveryPackage ? {...value, build: "newer-build"} : value;
    },
    fileSystem: {copyFileSync() { throw new Error("must fail before copy"); }}
  }, {platform: "win32"}), /does not reproduce the installed build/);
  const processCalls = [];
  assert.equal(applicationIsRunning(executable, {
    platform: "win32",
    processRunner(command, arguments_, options) {
      processCalls.push({command, arguments_, options});
      return {status: 0, stdout: "true\r\n", stderr: "", error: null};
    }
  }), true);
  assert.equal(processCalls[0].arguments_.at(-2), "is-running");
  assert.equal(processCalls[0].arguments_.at(-1), executable);

  assert.equal(ancestorProcessPid(executable, {
    platform: "win32",
    startPid: 913,
    processRunner(command, arguments_, options) {
      processCalls.push({command, arguments_, options});
      return {status: 0, stdout: "812\r\n", stderr: "", error: null};
    }
  }), 812);
  assert.deepEqual(processCalls[1].arguments_.slice(-3), ["ancestor", executable, "913"]);

  assert.equal(requestApplicationQuit(executable, {
    platform: "win32",
    processRunner(command, arguments_, options) {
      processCalls.push({command, arguments_, options});
      return {status: 0, stdout: "true\r\n", stderr: "", error: null};
    }
  }), true);
  assert.deepEqual(processCalls[2].arguments_.slice(-2), ["request-quit", executable]);

  const launchCalls = [];
  const launchTaskId = "01a092e7-9706-74d3-b474-8e852228746f";
  const launched = launchApplication({
    app: applicationRoot,
    marker: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\renderer.ready`,
    appLog: path.join(scratch, "app.log"),
    taskId: launchTaskId,
    platform: "win32",
    processRunner(command, arguments_, options) {
      launchCalls.push({command, arguments_, options});
      const action = arguments_[10];
      return action === "launch-app"
        ? {status: 0, stdout: "activated:5150\r\n", stderr: "", error: null}
        : {status: 0, stdout: "true\r\n", stderr: "", error: null};
    }
  });
  assert.equal(launched.pid, 5150);
  assert.equal(typeof launched.kill, "function");
  assert.equal(launchCalls[0].command, "powershell.exe");
  assert.deepEqual(launchCalls[0].arguments_.slice(-5, -2), ["launch-app", applicationRoot, executable]);
  assert.equal(
    Buffer.from(launchCalls[0].arguments_.at(-2).split("=")[1], "base64url").toString("utf8"),
    String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\renderer.ready`
  );
  assert.equal(launchCalls[0].arguments_.at(-1), `codex://threads/${launchTaskId}`);
  assert.equal(launchCalls[0].options.windowsHide, true);
  assert.equal(Object.keys(launchCalls[0].options.env)
    .some(key => key.toLowerCase() === "psmodulepath"), false);
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.deepEqual(launchCalls[1].arguments_.slice(-3), ["is-process", executable, "5150"]);
  releaseApplicationLaunch(launched, "win32");
  const callsAtRelease = launchCalls.length;
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.equal(launchCalls.length, callsAtRelease, "release stops polling without terminating Desktop");
  const exitedLaunch = launchApplication({
    app: applicationRoot,
    marker: String.raw`C:\Users\Mike\.codex\tmtk-rescue\exited\renderer.ready`,
    appLog: path.join(scratch, "exited-app.log"),
    taskId: launchTaskId,
    platform: "win32",
    processRunner(command, arguments_) {
      return arguments_[10] === "launch-app"
        ? {status: 0, stdout: "activated:5151\r\n", stderr: "", error: null}
        : {status: 0, stdout: "false\r\n", stderr: "", error: null};
    }
  });
  assert.deepEqual(await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("exact-PID launch monitor did not report exit")), 1_500);
    exitedLaunch.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve([code, signal]);
    });
  }), [0, null], "the monitor reports exit when the exact activated PID is gone");
  assert.throws(() => launchApplication({
    app: applicationRoot,
    marker: String.raw`C:\arbitrary\renderer.ready`,
    appLog: path.join(scratch, "invalid.log"),
    taskId: launchTaskId,
    platform: "win32",
    processRunner() { throw new Error("must not run"); }
  }), /must belong to a TMTK rescue incident/);
  assert.throws(() => launchApplication({
    app: applicationRoot,
    marker: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\renderer.ready`,
    appLog: path.join(scratch, "invalid-task.log"),
    taskId: "not-a-task",
    platform: "win32",
    processRunner() { throw new Error("must not run"); }
  }), /valid task ID/);

  const supervisorCalls = [];
  assert.deepEqual(launchSupervisor({
    nodeExecutable: String.raw`C:\Program Files\nodejs\node.exe`,
    supervisorScript: String.raw`C:\toolkit\safe-start-supervisor.mjs`,
    stateFile: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\state.json`,
    logFile: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\supervisor.log`,
    platform: "win32",
    processRunner(command, arguments_, options) {
      supervisorCalls.push({command, arguments_, options});
      return {status: 0, stdout: "armed:TMTK-Supervisor\r\n", stderr: "", error: null};
    }
  }), {taskName: "TMTK-Supervisor"});
  assert.deepEqual(supervisorCalls[0].arguments_.slice(-5), [
    "launch-supervisor",
    String.raw`C:\Program Files\nodejs\node.exe`,
    String.raw`C:\toolkit\safe-start-supervisor.mjs`,
    String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\state.json`,
    String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\supervisor.log`
  ]);
  assert.throws(() => launchSupervisor({
    nodeExecutable: String.raw`C:\Program Files\nodejs\node.exe`,
    supervisorScript: String.raw`C:\toolkit\safe-start-supervisor.mjs`,
    stateFile: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\state.json`,
    logFile: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\supervisor.log`,
    platform: "win32",
    processRunner() {
      return {status: 0, stdout: "started\r\n", stderr: "", error: null};
    }
  }), /invalid supervisor launch receipt/);

  const terminalCalls = [];
  const opened = openRescueTerminal({
    terminalApp: "PowerShell",
    commandFile: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\open-rescue.command`,
    processRunner(command, arguments_, options) {
      terminalCalls.push({command, arguments_, options});
      return {status: 0, stdout: "opened:710\r\n", stderr: "", error: null};
    }
  }, {platform: "win32"});
  assert.deepEqual(opened, {opened: true, error: null, applicationOwned: true});
  assert.equal(terminalCalls[0].command, "powershell.exe");
  assert.deepEqual(terminalCalls[0].arguments_.slice(-3), [
    "open-rescue",
    process.execPath,
    String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\open-rescue.command`
  ]);
  assert.equal(terminalCalls[0].options.windowsHide, true);
  assert.equal(defaultTerminal("win32"), "PowerShell");
  assert.deepEqual(openRescueTerminal({
    terminalApp: "Windows Terminal",
    commandFile: String.raw`C:\private\open-rescue.command`,
    processRunner() { throw new Error("must not run"); }
  }, {platform: "win32"}), {
    opened: false,
    error: "Windows rescue terminal is not qualified for Windows Terminal",
    applicationOwned: false
  });
  assert.equal(rescueTerminalClosureRequired({
    terminalApp: "PowerShell",
    environment: {TMTK_RESCUE_TERMINAL_OWNED: "1"}
  }, {platform: "win32"}), true);

  const closerCalls = [];
  const closed = closeOwnedRescueTerminal({
    terminalApp: "PowerShell",
    applicationOwned: true,
    completionFile: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\terminal-closed`,
    environment: {
      TMTK_RESCUE_TERMINAL_OWNED: "1",
      TMTK_RESCUE_TERMINAL_PID: "711"
    },
    processRunner(command, arguments_, options) {
      closerCalls.push({command, arguments_, options});
      return {
        status: 0,
        stdout: "scheduled:TMTK-RescueClose-22222222-2222-4222-8222-222222222222\r\n",
        stderr: "",
        error: null
      };
    }
  }, {platform: "win32"});
  assert.deepEqual(closed, {scheduled: true, pid: 711});
  assert.deepEqual(closerCalls[0].arguments_.slice(-3), [
    "schedule-close-rescue", "711",
    String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\terminal-closed`
  ]);
  assert.deepEqual(closerCalls[0].options.windowsHide, true);
  assert.deepEqual(closeOwnedRescueTerminal({
    terminalApp: "PowerShell",
    environment: {},
    processRunner() { throw new Error("must not run"); }
  }, {platform: "win32"}), {scheduled: false, reason: "not-owned"});
  const finishCalls = [];
  assert.equal(finishRescueTerminalClosure({
    completionFile: String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\terminal-closed`,
    processRunner(command, arguments_, options) {
      finishCalls.push({command, arguments_, options});
      return {status: 0, stdout: "removed\r\n", stderr: "", error: null};
    }
  }, {platform: "win32"}), true);
  assert.deepEqual(finishCalls[0].arguments_.slice(-2), [
    "finish-close-rescue",
    String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\terminal-closed`
  ]);

  const hook = rescueStopHookOverride({
    nodeExecutable: String.raw`C:\Program Files\nodejs\node.exe`,
    hookScript: String.raw`C:\toolkit's path\rescue-turn-stop.mjs`,
    receiptFile: String.raw`C:\private\attempt-stop.json`,
    taskId: "01900000-0000-7000-8000-000000000001",
    codexHome: String.raw`C:\Users\Mike\.codex`
  }, {platform: "win32"});
  const encodedHook = hook.match(/-EncodedCommand ([A-Za-z0-9+/=]+)/)?.[1];
  assert.ok(encodedHook);
  assert.equal(Buffer.from(encodedHook, "base64").toString("utf16le"),
    "& 'C:\\Program Files\\nodejs\\node.exe' " +
    "'C:\\toolkit''s path\\rescue-turn-stop.mjs' " +
    "'C:\\private\\attempt-stop.json' " +
    "'01900000-0000-7000-8000-000000000001' " +
    "'C:\\Users\\Mike\\.codex'\nexit $LASTEXITCODE\n");
  assert.match(hook, /statusMessage="Finishing rescue turn"/);

  const helperSource = fs.readFileSync(path.join(repository, "src/platforms/windows.ps1"), "utf8");
  assert.match(helperSource, /Get-CimInstance Win32_Process -Filter "Name = '\$name'"/);
  assert.match(helperSource, /Get-AppxPackage -Name 'OpenAI\.Codex'/);
  assert.match(helperSource,
    /Register-ScheduledTask -TaskName \$TaskName -Action \$taskAction -Principal \$principal -Force/);
  assert.match(helperSource, /TMTK-RescueClose-\$\(\$Matches\[1\]\)/);
  assert.match(helperSource, /OpenAI\.Codex_2p2nqsd0c76g0/);
  assert.match(helperSource, /\[StringComparison\]::OrdinalIgnoreCase/);
  assert.match(helperSource, /PostMessage\(window, 0x0010/);
  assert.match(helperSource, /\[DateTime\]::UtcNow\.AddSeconds\(5\)/);
  assert.match(helperSource, /TerminateAllProcesses\(packageFullName\)/);
  assert.match(helperSource, /TmtkPackageTermination\]::Terminate\(\$package\.PackageFullName\)/);
  assert.equal(
    [...helperSource.matchAll(/CoCreateInstance\(ref classId, IntPtr\.Zero, 1/g)].length,
    2
  );
  assert.match(helperSource, /WindowsIdentity\]::GetCurrent\(\)\.Name/);
  assert.match(helperSource, /New-ScheduledTaskPrincipal -UserId \$identityName/);
  assert.doesNotMatch(helperSource, /\$env:COMPUTERNAME\\\$env:USERNAME/);
  assert.match(helperSource, /-LogonType Interactive -RunLevel Limited/);
  assert.match(helperSource, /Unregister-ScheduledTask -TaskName \$taskLiteral/);
  assert.match(helperSource, /Test-SameFile \$observed \$packaged \$expectedHash/);
  assert.match(helperSource, /Where-Object \{ \$_\.CommandLine -notmatch/);
  assert.match(helperSource, /"Don't Restart" "restart" "cancel"/);
  assert.match(helperSource, /BitmapFrame\]::Create/);
  assert.match(helperSource, /"Restore Known-Working" "Open Terminal Line with Agent"/);
  assert.match(helperSource, /Start-Process -FilePath \$ActionArguments\[0\]/);
  assert.match(helperSource, /Wait-Process -Id \$terminalPid -Timeout 30/);
  assert.match(helperSource, /Get-ExactApplicationId \$package \$ActionArguments\[1\]/);
  assert.doesNotMatch(helperSource, /Wait-Process -Id \$activatedPid/);

  const installedRoot = String.raw`C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.1_arm64__2p2nqsd0c76g0`;
  const sourceReceipt = {
    app: candidatePackage,
    version: candidateInspection.version,
    build: candidateInspection.build,
    archiveSha256: candidateArchiveHash,
    artifactSha256: candidateArtifactHash,
    packageFullName: candidateInspection.package.fullName,
    package: candidateInspection.package
  };
  const currentInspection = {
    ...inspected,
    package: {...inspected.package, architecture: "arm64"}
  };
  const installedInspection = {
    ...candidateInspection,
    app: installedRoot,
    artifact: undefined,
    package: {...candidateInspection.package, signatureKind: "Developer"}
  };
  const installationCalls = [];
  const installed = replaceApplicationWithVerifiedSource({
    targetApp: applicationRoot,
    source: sourceReceipt,
    sourceInspector(value) {
      assert.equal(value, candidatePackage);
      return candidateInspection;
    },
    appInspector(value) {
      if (value === applicationRoot) return currentInspection;
      if (value === installedRoot) return installedInspection;
      throw new Error(`unexpected application inspection: ${value}`);
    },
    processRunner(command, arguments_) {
      installationCalls.push({command, arguments_});
      return {status: 0, stdout: `${JSON.stringify({
        packageFullName: candidateInspection.package.fullName,
        packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
        installLocation: installedRoot,
        status: "Ok",
        signatureKind: "Developer"
      })}\r\n`, stderr: "", error: null};
    }
  }, {platform: "win32"});
  assert.equal(installed.app, installedRoot);
  assert.equal(installed.archiveSha256, candidateArchiveHash);
  assert.deepEqual(installationCalls[0].arguments_.slice(-3), [
    "install-msix", candidatePackage, candidateInspection.package.fullName
  ]);
  process.stdout.write("Windows platform adapter behavior probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}
