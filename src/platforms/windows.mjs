import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { extractFile } from "@electron/asar";
import { asarHeaderSha256 } from "../asar-integrity.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const helper = path.join(directory, "windows.ps1");
const toolkitIcon = path.resolve(directory, "../../assets/TheMechanicsToolkit.ico");
const powershell = "powershell.exe";
const packageName = "OpenAI.Codex";
const publisher = "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B";
const publisherId = "2p2nqsd0c76g0";
const packageFamily = `${packageName}_${publisherId}`;
const packageFullNamePattern =
  /^OpenAI\.Codex_\d+(?:\.\d+){3}_(?:x64|x86|arm64|neutral)_[^_]*_2p2nqsd0c76g0$/i;
const taskIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveApplication(argument) {
  if (typeof argument !== "string" || argument.trim() === "") {
    throw new Error("missing application path after --");
  }
  const resolved = path.win32.resolve(argument);
  if (/\.msix(?:bundle)?$/i.test(resolved)) {
    throw new Error("Windows safe-start requires an installed or extracted application directory, not an MSIX file");
  }
  const directory = path.win32.basename(resolved).toLowerCase() === "chatgpt.exe"
    ? path.win32.dirname(resolved)
    : resolved;
  const root = path.win32.basename(directory).toLowerCase() === "app"
    ? path.win32.dirname(directory)
    : directory;
  if (!packageFullNamePattern.test(path.win32.basename(root))) {
    throw new Error(`Windows application directory has no exact OpenAI Codex MSIX identity: ${root}`);
  }
  return root;
}

export function resolveApplicationSource(argument, {fileSystem = fs} = {}) {
  if (typeof argument !== "string" || argument.trim() === "") {
    throw new Error("missing application source path");
  }
  const resolved = path.win32.resolve(argument);
  if (!/\.msix$/i.test(resolved)) return resolveApplication(resolved);
  requireFile(resolved, "Windows MSIX application source", fileSystem);
  return resolved;
}

export function applicationLayout(app) {
  return {
    executable: path.win32.join(app, "app", "ChatGPT.exe"),
    cli: path.win32.join(app, "app", "resources", "codex.exe")
  };
}

export function resolveCli(executable, {
  startPid = process.ppid,
  processRunner = spawnSync
} = {}) {
  if (!Number.isInteger(startPid) || startPid <= 0) {
    throw new Error("CLI resolution requires a valid starting PID");
  }
  const resolved = runHelper("resolve-cli", [executable, String(startPid)], processRunner);
  if (!path.win32.isAbsolute(resolved) || path.win32.basename(resolved).toLowerCase() !== "codex.exe") {
    throw new Error(`Windows returned an invalid runnable Codex CLI path: ${resolved || "<empty>"}`);
  }
  return resolved;
}

export function inspectApplication(app, {
  processRunner = spawnSync,
  fileSystem = fs,
  fileHasher = sha256File,
  headerHasher = asarHeaderSha256,
  archiveFileReader = extractFile
} = {}) {
  const root = resolveApplication(app);
  const {executable} = applicationLayout(root);
  const archive = path.win32.join(root, "app", "resources", "app.asar");
  requireDirectory(root, "Windows application directory", fileSystem);
  requireFile(executable, "ChatGPT.exe", fileSystem);
  requireFile(archive, "app.asar", fileSystem);

  const rawPackage = runHelper("inspect-package", [root, executable], processRunner);
  let packageIdentity;
  try {
    packageIdentity = JSON.parse(rawPackage);
  } catch (error) {
    throw new Error(`Windows returned invalid package identity JSON: ${error.message}`);
  }
  const expectedFullName = path.win32.basename(root);
  const expectedFamily = packageFamilyName(root);
  if (packageIdentity.packageFullName !== expectedFullName ||
      packageIdentity.packageFamilyName !== expectedFamily ||
      packageIdentity.name !== packageName ||
      packageIdentity.publisher !== publisher ||
      packageIdentity.applicationId !== `${packageFamily}!App` ||
      !sameWindowsPath(packageIdentity.installLocation, root)) {
    throw new Error("Windows package identity does not match the exact application directory");
  }
  const signatureValid = packageIdentity.status === "Ok" &&
    packageIdentity.executableSignature === "Valid" &&
    new Set(["Store", "Developer"]).has(packageIdentity.signatureKind);
  const metadata = applicationMetadata(archive, archiveFileReader);
  const asarIntegrity = inspectAsarIntegrity(
    runHelper("inspect-asar-integrity", [executable], processRunner),
    archive,
    headerHasher
  );
  return {
    app: root,
    identifier: packageIdentity.name,
    version: metadata.version,
    build: metadata.build,
    electron: metadata.electron,
    package: {
      fullName: packageIdentity.packageFullName,
      familyName: packageIdentity.packageFamilyName,
      publisher: packageIdentity.publisher,
      outerVersion: packageIdentity.version,
      architecture: packageIdentity.architecture,
      status: packageIdentity.status,
      signatureKind: packageIdentity.signatureKind,
      applicationId: packageIdentity.applicationId
    },
    archive: {path: archive, sha256: fileHasher(archive)},
    asarIntegrity,
    signature: {
      state: signatureValid ? "valid" : "invalid",
      executable: packageIdentity.executableSignature
    }
  };
}

export function inspectApplicationSource(applicationSource, {
  processRunner = spawnSync,
  fileSystem = fs,
  fileHasher = sha256File,
  archiveFileReader = extractFile,
  temporaryRoot = os.tmpdir()
} = {}) {
  const source = resolveApplicationSource(applicationSource, {fileSystem});
  if (!/\.msix$/i.test(source)) {
    return inspectApplication(source, {
      processRunner,
      fileSystem,
      fileHasher,
      archiveFileReader
    });
  }

  const temporary = fs.mkdtempSync(path.join(temporaryRoot, "tmtk-msix-inspection-"));
  const extractedAsar = path.join(temporary, "app.asar");
  const extractedExecutable = path.join(temporary, "ChatGPT.exe");
  try {
    let packageIdentity;
    try {
      packageIdentity = JSON.parse(runHelper(
        "inspect-msix",
        [source, extractedAsar, extractedExecutable],
        processRunner
      ));
    } catch (error) {
      throw new Error(`Windows MSIX inspection failed: ${error.message}`);
    }
    const architecture = String(packageIdentity.architecture ?? "").toLowerCase();
    const resourceId = String(packageIdentity.resourceId ?? "");
    if (packageIdentity.name !== packageName ||
        packageIdentity.publisher !== publisher ||
        packageIdentity.applicationId !== `${packageFamily}!App` ||
        !/^\d+(?:\.\d+){3}$/.test(packageIdentity.version ?? "") ||
        !new Set(["x64", "x86", "arm64", "neutral"]).has(architecture) ||
        !/^[A-Za-z0-9.-]*$/.test(resourceId)) {
      throw new Error("MSIX archive does not have the exact qualified OpenAI Codex identity");
    }
    const packageFullName = [
      packageName,
      packageIdentity.version,
      architecture,
      resourceId,
      publisherId
    ].join("_");
    const signatureValid = packageIdentity.signature === "Valid" &&
      packageIdentity.signerSubject === publisher &&
      packageIdentity.executableSignature === "Valid";
    const metadata = applicationMetadata(extractedAsar, archiveFileReader);
    const archiveSha256 = fileHasher(extractedAsar);
    if (archiveSha256 !== packageIdentity.asarSha256) {
      throw new Error("MSIX app.asar extraction does not match its independently computed hash");
    }
    return {
      app: source,
      identifier: packageName,
      version: metadata.version,
      build: metadata.build,
      electron: metadata.electron,
      package: {
        fullName: packageFullName,
        familyName: packageFamily,
        publisher,
        outerVersion: packageIdentity.version,
        architecture,
        status: signatureValid ? "Ok" : "Invalid",
        signatureKind: "PackageFile",
        applicationId: packageIdentity.applicationId
      },
      artifact: {path: source, sha256: fileHasher(source)},
      archive: {path: "app/resources/app.asar", sha256: archiveSha256},
      asarIntegrity: {
        state: "not-present",
        detail: "ChatGPT.exe has no Integrity/ ElectronAsar resource; the signed MSIX block map protects app.asar"
      },
      signature: {
        state: signatureValid ? "valid" : "invalid",
        package: packageIdentity.signature,
        executable: packageIdentity.executableSignature,
        signer: packageIdentity.signerSubject
      }
    };
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}

export function defaultTerminal() {
  return "PowerShell";
}

export function confirmApplicationRestart({processRunner = spawnSync, iconFile = toolkitIcon} = {}) {
  return choice("confirm-restart", new Map([
    ["restart", true],
    ["cancel", false]
  ]), "Windows restart confirmation", processRunner, iconFile);
}

export function confirmRepairFallback({processRunner = spawnSync, iconFile = toolkitIcon} = {}) {
  return choice("confirm-repair", new Map([
    ["restore", "restore"],
    ["interactive", "interactive"]
  ]), "Windows repair fallback", processRunner, iconFile);
}

export function confirmTaskHandoff({processRunner = spawnSync, iconFile = toolkitIcon} = {}) {
  return choice("confirm-handoff", new Map([
    ["continue", true],
    ["cancel", false]
  ]), "Windows task handoff confirmation", processRunner, iconFile);
}

export function diagnosticLocations(home, {app} = {}) {
  const family = packageFamilyName(app);
  const packageCache = path.win32.join(home, "AppData", "Local", "Packages", family, "LocalCache");
  return {
    desktopLogs: path.win32.join(packageCache, "Local", "Codex", "Logs"),
    rendererScope: path.win32.join(
      packageCache,
      "Roaming", "Codex", "web", "Codex", "sentry", "scope_v3.json"
    )
  };
}

export function launchApplication({app, marker, appLog, taskId, processRunner = spawnSync}) {
  const {executable} = applicationLayout(app);
  const markerArgument = safeStartMarkerArgument(marker);
  if (typeof taskId !== "string" || !taskIdPattern.test(taskId)) {
    throw new Error("Windows application launch requires a valid task ID");
  }
  const taskArgument = `codex://threads/${taskId}`;
  fs.closeSync(fs.openSync(appLog, "a", 0o600));
  const result = runHelper("launch-app", [app, executable, markerArgument, taskArgument], processRunner);
  if (!/^activated:[0-9]+$/.test(result)) {
    throw new Error(`Windows returned an invalid Codex activation receipt: ${result || "<empty>"}`);
  }
  return monitorApplication(Number(result.slice("activated:".length)), executable, processRunner);
}

export function launchSupervisor({
  nodeExecutable,
  supervisorScript,
  stateFile,
  logFile,
  processRunner = spawnSync
}) {
  const result = runHelper("launch-supervisor", [
    nodeExecutable,
    supervisorScript,
    stateFile,
    logFile
  ], processRunner);
  if (result !== "armed:TMTK-Supervisor") {
    throw new Error(`Windows returned an invalid supervisor launch receipt: ${result || "<empty>"}`);
  }
  return {taskName: result.slice("armed:".length)};
}

export function releaseApplicationLaunch(child) {
  // The monitor owns no Desktop process; kill only stops its exact-path polling interval.
  child.kill();
}

export function applicationIsRunning(executable, {processRunner = spawnSync} = {}) {
  const result = runHelper("is-running", [executable], processRunner);
  if (result === "true") return true;
  if (result === "false") return false;
  throw new Error(`Windows returned an invalid Codex application state for ${executable}: ${result || "<empty>"}`);
}

export function ancestorProcessPid(executable, {
  startPid = process.ppid,
  processRunner = spawnSync
} = {}) {
  if (typeof executable !== "string" || executable.trim() === "") {
    throw new Error("ancestor executable is required");
  }
  if (!Number.isInteger(startPid) || startPid <= 0) {
    throw new Error("ancestor search requires a valid starting PID");
  }
  const result = runHelper("ancestor", [executable, String(startPid)], processRunner);
  if (result === "") return null;
  if (!/^\d+$/.test(result) || Number(result) <= 0) {
    throw new Error(`Windows returned an invalid ancestor process identity: ${result}`);
  }
  return Number(result);
}

export function requestApplicationQuit(executable, {processRunner = spawnSync} = {}) {
  const result = runHelper("request-quit", [executable], processRunner);
  if (result === "true") return true;
  if (result === "false") return false;
  throw new Error(`Windows returned an invalid Codex quit result for ${executable}: ${result || "<empty>"}`);
}

export function openRescueTerminal({terminalApp, commandFile, processRunner = spawnSync}) {
  if (terminalApp !== "PowerShell") {
    return {
      opened: false,
      error: `Windows rescue terminal is not qualified for ${terminalApp}`,
      applicationOwned: false
    };
  }
  try {
    const result = runHelper("open-rescue", [process.execPath, commandFile], processRunner);
    if (!/^opened:\d+$/.test(result)) {
      return {opened: false, error: `Windows returned an invalid rescue launch: ${result}`, applicationOwned: false};
    }
    return {opened: true, error: null, applicationOwned: true};
  } catch (error) {
    return {opened: false, error: error.message.slice(0, 1000), applicationOwned: false};
  }
}

export function rescueStopHookOverride({nodeExecutable, hookScript, receiptFile, taskId, codexHome}) {
  const command = [nodeExecutable, hookScript, receiptFile, taskId, codexHome]
    .map(powerShellLiteral)
    .join(" ");
  const encoded = Buffer.from(`& ${command}\nexit $LASTEXITCODE\n`, "utf16le").toString("base64");
  const hook = `${powershell} -NoLogo -NoProfile -NonInteractive -EncodedCommand ${encoded}`;
  return `hooks.Stop=[{hooks=[{type="command",command=${JSON.stringify(hook)},timeout=30,statusMessage="Finishing rescue turn"}]}]`;
}

export function rescueTerminalClosureRequired({terminalApp, environment = process.env} = {}) {
  return environment.TMTK_RESCUE_TERMINAL_OWNED === "1" && terminalApp === "PowerShell";
}

export function closeOwnedRescueTerminal({
  terminalApp,
  completionFile = null,
  environment = process.env,
  processRunner = spawnSync
} = {}) {
  if (!rescueTerminalClosureRequired({terminalApp, environment})) {
    return {scheduled: false, reason: "not-owned"};
  }
  const pid = Number(environment.TMTK_RESCUE_TERMINAL_PID);
  if (!Number.isInteger(pid) || pid <= 0) return {scheduled: false, reason: "pid-unavailable"};
  if (typeof completionFile !== "string" || completionFile === "") {
    return {scheduled: false, reason: "completion-file-unavailable"};
  }
  try {
    const result = runHelper(
      "schedule-close-rescue",
      [String(pid), completionFile],
      processRunner,
      environment
    );
    if (!/^scheduled:TMTK-RescueClose-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result)) {
      return {scheduled: false, reason: "close-failed"};
    }
  } catch (error) {
    return {scheduled: false, reason: `close-failed: ${error.message}`};
  }
  return {scheduled: true, pid};
}

export function finishRescueTerminalClosure({
  completionFile,
  processRunner = spawnSync
} = {}) {
  try {
    return new Set(["removed", "absent"]).has(
      runHelper("finish-close-rescue", [completionFile], processRunner)
    );
  } catch {
    return false;
  }
}

export function prepareCandidateAdoption({
  candidatePath,
  candidateSourcePath,
  knownGoodPath,
  configuration,
  incidentDirectory,
  appInspector,
  verifyApplicationSource,
  fileSystem = fs
}) {
  if (candidateSourcePath != null && candidateSourcePath.trim() !== "") {
    throw new Error("--candidate-source is only valid for Linux DEB adoption");
  }
  if (typeof knownGoodPath !== "string" || knownGoodPath.trim() === "") {
    throw new Error("Windows candidate adoption requires --known-good with a signed recovery MSIX");
  }
  const inspect = (source, target) => verifyApplicationSource(source, target, {
    platform: configuration.platform,
    appInspector,
    fileSystem
  });
  const candidate = inspect(candidatePath, configuration.app);
  const current = inspect(configuration.app, path.win32.join(incidentDirectory, "known-good.msix"));
  const externalKnownGood = inspect(knownGoodPath, configuration.app);

  requireSamePackage(current, candidate, "candidate");
  requireSamePackage(current, externalKnownGood, "known-good");
  for (const key of ["version", "build", "archiveSha256"]) {
    if (externalKnownGood[key] !== current[key]) {
      throw new Error(`Windows known-good MSIX does not reproduce the installed ${key}`);
    }
  }
  if (comparePackageVersions(candidate.package?.outerVersion, current.package?.outerVersion) <= 0) {
    throw new Error("Windows candidate MSIX must be newer than the installed package");
  }
  if (comparePackageVersions(externalKnownGood.package?.outerVersion, candidate.package?.outerVersion) <= 0) {
    throw new Error("Windows known-good MSIX must be newer than the candidate package");
  }

  const capturedPath = path.win32.join(incidentDirectory, "known-good.msix");
  fileSystem.copyFileSync(externalKnownGood.app, capturedPath, fs.constants.COPYFILE_EXCL);
  const knownGood = inspect(capturedPath, configuration.app);
  for (const key of ["version", "build", "archiveSha256", "artifactSha256", "packageFullName"]) {
    if (knownGood[key] !== externalKnownGood[key]) {
      throw new Error("copied Windows known-good MSIX no longer matches its verified source");
    }
  }
  return {candidate, knownGood};
}

export function replaceApplicationWithVerifiedSource({
  targetApp,
  source: verifiedSource,
  processRunner = spawnSync,
  appInspector = inspectApplication,
  sourceInspector = inspectApplicationSource
}) {
  const target = resolveApplication(targetApp);
  if (typeof verifiedSource?.app !== "string" || !/\.msix$/i.test(verifiedSource.app)) {
    throw new Error("verified Windows replacement must be a signed MSIX package");
  }
  const sourceInspection = sourceInspector(verifiedSource.app);
  requireVerifiedSourceMatch(sourceInspection, verifiedSource, "verified MSIX source");
  const targetInspection = appInspector(target);
  requireCompatiblePackage(targetInspection, sourceInspection);
  if (comparePackageVersions(
    sourceInspection.package.outerVersion,
    targetInspection.package.outerVersion
  ) <= 0) {
    throw new Error("Windows replacement MSIX version must be newer than the installed package");
  }

  let installed;
  try {
    installed = JSON.parse(runHelper("install-msix", [
      verifiedSource.app,
      sourceInspection.package.fullName
    ], processRunner));
  } catch (error) {
    throw new Error(`Windows MSIX installation failed: ${error.message}`);
  }
  if (installed.packageFullName !== sourceInspection.package.fullName ||
      installed.packageFamilyName !== packageFamily ||
      installed.status !== "Ok" ||
      !new Set(["Store", "Developer"]).has(installed.signatureKind) ||
      typeof installed.installLocation !== "string") {
    throw new Error("Windows installed package does not match the verified MSIX source");
  }
  const installedInspection = appInspector(installed.installLocation);
  requireVerifiedSourceMatch(installedInspection, verifiedSource, "installed Windows application", {
    artifact: false
  });
  if (installedInspection.package.fullName !== sourceInspection.package.fullName) {
    throw new Error("installed Windows application has the wrong package version");
  }
  return {
    app: installedInspection.app,
    version: installedInspection.version,
    build: installedInspection.build,
    archiveSha256: installedInspection.archive.sha256,
    artifactSha256: verifiedSource.artifactSha256,
    package: installedInspection.package
  };
}

function requireSamePackage(installed, source, label) {
  for (const key of ["familyName", "publisher", "architecture", "applicationId"]) {
    if (String(installed.package?.[key] ?? "").toLowerCase() !==
        String(source.package?.[key] ?? "").toLowerCase()) {
      throw new Error(`Windows ${label} MSIX has a different package ${key}`);
    }
  }
}

function requireCompatiblePackage(installed, source) {
  for (const key of ["familyName", "publisher", "architecture", "applicationId"]) {
    const installedValue = installed.package?.[key];
    const sourceValue = source.package?.[key];
    if (typeof installedValue !== "string" || typeof sourceValue !== "string" ||
        installedValue.toLowerCase() !== sourceValue.toLowerCase()) {
      throw new Error(`Windows replacement MSIX has a different package ${key}`);
    }
  }
}

function requireVerifiedSourceMatch(inspection, expected, label, {artifact = true} = {}) {
  const packageProtected = inspection.signature?.state === "valid" &&
    inspection.package?.status === "Ok";
  if (!packageProtected ||
      !new Set(["valid", "not-present"]).has(inspection.asarIntegrity?.state)) {
    throw new Error(`${label} failed signature or package-integrity verification`);
  }
  const actual = {
    version: inspection.version,
    build: inspection.build,
    archiveSha256: inspection.archive?.sha256,
    artifactSha256: artifact ? inspection.artifact?.sha256 : expected.artifactSha256,
    packageFullName: inspection.package?.fullName
  };
  for (const [key, value] of Object.entries(actual)) {
    if (typeof expected?.[key] !== "string" || expected[key] !== value) {
      throw new Error(`${label} no longer matches the package verified when the restart was armed`);
    }
  }
}

function comparePackageVersions(left, right) {
  const leftParts = String(left).split(".").map(Number);
  const rightParts = String(right).split(".").map(Number);
  if (leftParts.length !== 4 || rightParts.length !== 4 ||
      [...leftParts, ...rightParts].some(part => !Number.isInteger(part) || part < 0)) {
    throw new Error("Windows package version is invalid");
  }
  for (let index = 0; index < 4; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function choice(action, choices, label, processRunner, iconFile) {
  const result = runHelper(action, fs.existsSync(iconFile) ? [iconFile] : [], processRunner);
  if (choices.has(result)) return choices.get(result);
  throw new Error(`${label} returned an unknown choice: ${result || "<empty>"}`);
}

function runHelper(action, arguments_, processRunner, environment = process.env) {
  const result = processRunner(powershell, helperArguments(action, arguments_), {
    encoding: "utf8",
    env: windowsPowerShellEnvironment(environment),
    windowsHide: true
  });
  if (result.error != null) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout).trim() || `Windows ${action} helper failed`);
  }
  return result.stdout.trim();
}

function monitorApplication(pid, executable, processRunner) {
  const monitor = new EventEmitter();
  monitor.pid = pid;
  let active = true;
  const interval = setInterval(() => {
    if (!active) return;
    try {
      if (exactProcessIsRunning(pid, executable, processRunner)) return;
      active = false;
      clearInterval(interval);
      monitor.emit("exit", 0, null);
    } catch (error) {
      active = false;
      clearInterval(interval);
      monitor.emit("error", error);
    }
  }, 500);
  interval.unref();
  monitor.kill = () => {
    active = false;
    clearInterval(interval);
  };
  return monitor;
}

function exactProcessIsRunning(pid, executable, processRunner) {
  const result = runHelper("is-process", [executable, String(pid)], processRunner);
  if (result === "true") return true;
  if (result === "false") return false;
  throw new Error(`Windows returned an invalid Codex process state for PID ${pid}: ${result || "<empty>"}`);
}

function helperArguments(action, arguments_) {
  return [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-WindowStyle", "Hidden",
    "-ExecutionPolicy", "Bypass", "-File", helper, action, ...arguments_
  ];
}

function windowsPowerShellEnvironment(environment = process.env) {
  const result = {...environment};
  for (const key of Object.keys(result)) {
    if (key.toLowerCase() === "psmodulepath") delete result[key];
  }
  return result;
}

function powerShellLiteral(value) {
  if (typeof value !== "string" || value === "") throw new Error("Windows hook arguments must be non-empty strings");
  return `'${value.replaceAll("'", "''")}'`;
}

function safeStartMarkerArgument(marker) {
  if (typeof marker !== "string" || !path.win32.isAbsolute(marker)) {
    throw new Error("Windows renderer readiness marker must be an absolute path");
  }
  const incident = path.win32.dirname(marker);
  const rescueRoot = path.win32.dirname(incident);
  if (path.win32.basename(marker).toLowerCase() !== "renderer.ready" ||
      !/^[0-9A-Za-z-]+$/.test(path.win32.basename(incident)) ||
      path.win32.basename(rescueRoot).toLowerCase() !== "tmtk-rescue" ||
      path.win32.basename(path.win32.dirname(rescueRoot)).toLowerCase() !== ".codex") {
    throw new Error("Windows renderer readiness marker must belong to a TMTK rescue incident");
  }
  return `--tmtk-safe-start-marker=${Buffer.from(marker, "utf8").toString("base64url")}`;
}

function applicationMetadata(archive, archiveFileReader) {
  let metadata;
  try {
    metadata = JSON.parse(archiveFileReader(archive, "package.json").toString("utf8"));
  } catch (error) {
    throw new Error(`Windows app.asar package metadata is unreadable: ${error.message}`);
  }
  const version = nonEmptyString(metadata.version);
  const build = nonEmptyString(String(metadata.codexBuildNumber ?? ""));
  const electron = nonEmptyString(metadata.devDependencies?.electron ?? metadata.dependencies?.electron);
  if (version == null || build == null || electron == null) {
    throw new Error("Windows app.asar package metadata is incomplete");
  }
  return {version, build, electron};
}

function inspectAsarIntegrity(rawInspection, archive, headerHasher) {
  let inspection;
  try {
    inspection = JSON.parse(rawInspection);
  } catch (error) {
    throw new Error(`Windows returned invalid ASAR integrity JSON: ${error.message}`);
  }
  if (inspection.state === "not-present") {
    return {
      state: "not-present",
      detail: "ChatGPT.exe has no Integrity/ ElectronAsar resource"
    };
  }
  if (inspection.state !== "present" || typeof inspection.resource !== "string") {
    throw new Error("Windows returned an unknown ASAR integrity resource state");
  }
  let entries;
  try {
    entries = JSON.parse(inspection.resource);
  } catch (error) {
    return {state: "invalid", detail: `ElectronAsar resource is invalid JSON: ${error.message}`};
  }
  const matches = Array.isArray(entries) ? entries.filter(entry =>
    typeof entry?.file === "string" &&
    entry.file.replaceAll("\\", "/").toLowerCase() === "resources/app.asar"
  ) : [];
  if (matches.length !== 1 || matches[0].alg !== "SHA256" ||
      !/^[0-9a-f]{64}$/i.test(matches[0].value ?? "")) {
    return {state: "invalid", detail: "ElectronAsar resource has no exact SHA256 app.asar record"};
  }
  const expectedHash = matches[0].value.toLowerCase();
  const actualHash = headerHasher(archive);
  return {
    state: expectedHash === actualHash ? "valid" : "invalid",
    expectedHash,
    actualHash
  };
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function packageFamilyName(app) {
  if (typeof app !== "string" || app.trim() === "") {
    throw new Error("Windows diagnostics require the exact installed package directory");
  }
  const packageFullName = path.win32.basename(resolveApplication(app));
  if (!packageFullNamePattern.test(packageFullName)) {
    throw new Error(`Windows application directory has no exact OpenAI Codex MSIX identity: ${packageFullName}`);
  }
  return packageFamily;
}

function sameWindowsPath(left, right) {
  return typeof left === "string" &&
    path.win32.resolve(left).toLowerCase() === path.win32.resolve(right).toLowerCase();
}

function requireDirectory(value, label, fileSystem) {
  let stat;
  try { stat = fileSystem.statSync(value); } catch {}
  if (stat == null || !stat.isDirectory()) throw new Error(`${label} is missing: ${value}`);
}

function requireFile(value, label, fileSystem) {
  let stat;
  try { stat = fileSystem.statSync(value); } catch {}
  if (stat == null || !stat.isFile()) throw new Error(`${label} is missing: ${value}`);
}

function sha256File(file) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}
