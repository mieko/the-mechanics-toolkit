import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { inspectAppBundle, sha256File } from "./app-bundle.mjs";
import { asarHeaderSha256 } from "./asar-integrity.mjs";
import { patchDefinition, patchDefinitions } from "./patch-catalog.mjs";

const terminalHelperRelative = "node_modules/node-pty/build/Release/spawn-helper";
const expectedNativePackages = Object.freeze([
  "@worklouder/device-kit-oai",
  "better-sqlite3",
  "node-pty",
  "objc-js"
]);
const nativePackages = `node_modules/{${expectedNativePackages.join(",")}}`;

export function stageApp({sourceApp, destinationApp, configPath, repositoryRoot}) {
  const source = path.resolve(sourceApp);
  const destination = path.resolve(destinationApp);
  const configFile = path.resolve(configPath);
  const repository = path.resolve(repositoryRoot);
  const asar = path.join(repository, "node_modules/.bin/asar");
  requireFile(asar, "repository-local asar CLI; run npm install");
  const config = readConfig(configFile);
  const selected = selectedPatches(config.enabledPatches);
  validatePaths(source, destination);

  const sourceBefore = inspectAppBundle(source);
  if (sourceBefore.signature.state !== "valid") throw new Error("Source app code signature is not valid");
  if (sourceBefore.asarIntegrity.state !== "valid") {
    throw new Error("Source app ASAR header does not match ElectronAsarIntegrity");
  }
  const sourceUnpacked = `${sourceBefore.archive.path}.unpacked`;
  verifyNativePackages(sourceUnpacked);
  const sourceNativeSnapshot = treeSnapshot(sourceUnpacked);

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-stage-"));
  let destinationCreated = false;
  let complete = false;
  try {
    fs.mkdirSync(destination, {mode: 0o700});
    destinationCreated = true;
    run("/usr/bin/ditto", [source, destination]);
    const copied = inspectAppBundle(destination);
    if (copied.archive.sha256 !== sourceBefore.archive.sha256) {
      throw new Error("Staged copy does not preserve the source ASAR bytes");
    }
    if (!equalRecords(sourceNativeSnapshot, treeSnapshot(`${copied.archive.path}.unpacked`))) {
      throw new Error("Staged copy does not preserve the source native-module tree");
    }

    const extracted = path.join(scratch, "extracted");
    run(asar, ["extract", copied.archive.path, extracted]);
    const initialChecks = checkPatches(selected, extracted, configFile, repository);
    const unexpected = initialChecks.filter(result => result.output.state !== "needs-apply");
    if (unexpected.length > 0) {
      const states = unexpected.map(result => `${result.name}=${result.output.state}`).join(", ");
      throw new Error(`Source app is not pristine for selected patches: ${states}`);
    }

    const applied = applyPatches(selected, extracted, configFile, repository);
    const targets = changedTargets(applied);
    syntaxCheckTargets(extracted, targets);
    runProbes(selected, extracted, config, repository);
    const firstTree = treeSnapshot(extracted);
    applyPatches(selected, extracted, configFile, repository);
    if (!equalRecords(firstTree, treeSnapshot(extracted))) {
      throw new Error("Second patch application changed the extracted tree");
    }

    const extractedTerminalHelper = path.join(extracted, terminalHelperRelative);
    requireFile(extractedTerminalHelper, "node-pty spawn-helper in extracted ASAR");
    fs.chmodSync(extractedTerminalHelper, 0o755);

    const stagedArchive = `${copied.archive.path}.toolkit-new`;
    const stagedUnpacked = `${stagedArchive}.unpacked`;
    fs.rmSync(stagedArchive, {force: true});
    fs.rmSync(stagedUnpacked, {recursive: true, force: true});
    run(asar, ["pack", extracted, stagedArchive, "--unpack-dir", nativePackages]);
    requireDirectory(stagedUnpacked, "repacked native-module directory");
    verifyNativePackages(stagedUnpacked);
    if (!isExecutable(path.join(stagedUnpacked, terminalHelperRelative))) {
      throw new Error("ASAR repack did not preserve the executable node-pty spawn-helper");
    }

    fs.renameSync(stagedArchive, copied.archive.path);
    fs.rmSync(`${copied.archive.path}.unpacked`, {recursive: true, force: true});
    fs.renameSync(stagedUnpacked, `${copied.archive.path}.unpacked`);
    writeAsarIntegrity(destination, asarHeaderSha256(copied.archive.path));
    run("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", destination]);

    const finalInspection = inspectAppBundle(destination);
    if (finalInspection.signature.state !== "valid" || finalInspection.asarIntegrity.state !== "valid") {
      throw new Error("Staged application signature or ASAR integrity did not verify");
    }
    if (finalInspection.version !== sourceBefore.version || finalInspection.build !== sourceBefore.build) {
      throw new Error("Staging changed the application version or build identity");
    }
    if (!isExecutable(path.join(`${finalInspection.archive.path}.unpacked`, terminalHelperRelative))) {
      throw new Error("Final staged application lost the executable node-pty spawn-helper");
    }
    if (!equalRecords(sourceNativeSnapshot, treeSnapshot(`${finalInspection.archive.path}.unpacked`))) {
      throw new Error("Final staged application did not preserve the source native-module tree");
    }

    const verified = path.join(scratch, "verified");
    run(asar, ["extract", finalInspection.archive.path, verified]);
    const finalChecks = checkPatches(selected, verified, configFile, repository);
    if (!finalChecks.every(result => result.output.state === "applied")) {
      throw new Error("Final staged application does not satisfy every selected patch");
    }
    syntaxCheckTargets(verified, targets);
    runProbes(selected, verified, config, repository);

    const sourceAfter = inspectAppBundle(source);
    if (sourceAfter.archive.sha256 !== sourceBefore.archive.sha256 || sourceAfter.signature.state !== "valid" ||
        !equalRecords(sourceNativeSnapshot, treeSnapshot(sourceUnpacked))) {
      throw new Error("Source application changed while staging");
    }

    complete = true;
    return {
      state: "staged-static-proof-green",
      version: finalInspection.version,
      build: finalInspection.build,
      source: {app: source, asarSha256: sourceBefore.archive.sha256, untouched: true},
      candidate: {app: destination, asarSha256: finalInspection.archive.sha256},
      patches: finalChecks.map(result => result.name),
      changedTargets: targets,
      secondApplyByteIdentical: true,
      probesPassedAfterRepack: true,
      signatureValid: true,
      asarIntegrityValid: true,
      terminalHelperExecutable: true,
      nativePackagesPreserved: expectedNativePackages,
      liveAppTouched: false,
      launched: false
    };
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true});
    if (destinationCreated && !complete) fs.rmSync(destination, {recursive: true, force: true});
  }
}

function readConfig(file) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read toolkit config: ${error.message}`);
  }
  if (config == null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Toolkit config must be a JSON object");
  }
  const allowed = new Set(["enabledPatches", "workspaceRoot", "tinrelay"]);
  const unknown = Object.keys(config).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`Unknown toolkit config keys: ${unknown.join(", ")}`);
  return config;
}

function selectedPatches(names) {
  if (!Array.isArray(names) || names.length === 0 || names.some(name => typeof name !== "string")) {
    throw new Error("Toolkit config enabledPatches must be a nonempty array of patch names");
  }
  if (new Set(names).size !== names.length) throw new Error("Toolkit config enabledPatches contains duplicates");
  const unknown = names.filter(name => patchDefinition(name) == null);
  if (unknown.length > 0) throw new Error(`Unknown enabled patches: ${unknown.join(", ")}`);
  const selected = patchDefinitions.filter(definition => names.includes(definition.name));
  for (const definition of selected) {
    const missing = definition.requires.filter(name => !names.includes(name));
    if (missing.length > 0) throw new Error(`${definition.name} requires: ${missing.join(", ")}`);
  }
  return selected;
}

function validatePaths(source, destination) {
  requireDirectory(source, "source application bundle");
  if (source === destination) throw new Error("Source and staging destination must differ");
  if (fs.existsSync(destination)) throw new Error(`Staging destination already exists: ${destination}`);
  const destinationParent = path.dirname(destination);
  requireDirectory(destinationParent, "staging destination parent");
  const canonicalDestination = path.join(fs.realpathSync(destinationParent), path.basename(destination));
  if (insideApplications(canonicalDestination)) {
    throw new Error("Staging destination must remain outside /Applications");
  }
}

function checkPatches(selected, extracted, configFile, repository) {
  return selected.map(definition => ({
    name: definition.name,
    output: patchCommand(definition, "check", extracted, configFile, repository)
  }));
}

function applyPatches(selected, extracted, configFile, repository) {
  return selected.map(definition => {
    const output = patchCommand(definition, "apply", extracted, configFile, repository);
    if (output.state !== "applied") throw new Error(`${definition.name} apply returned ${output.state}`);
    return {name: definition.name, output};
  });
}

function patchCommand(definition, action, extracted, configFile, repository) {
  const args = [path.join(repository, definition.script), action, extracted];
  if (definition.config) args.push("--config", configFile);
  return jsonCommand(process.execPath, args, `${definition.name} ${action}`);
}

function runProbes(selected, extracted, config, repository) {
  for (const definition of selected) {
    const args = [path.join(repository, definition.probe), extracted];
    if (definition.probeWorkspaceRoot) args.push(path.resolve(config.workspaceRoot));
    run(process.execPath, args);
  }
}

function changedTargets(results) {
  const targets = [];
  for (const {output} of results) {
    if (typeof output.target === "string") targets.push(output.target);
    if (Array.isArray(output.targets)) targets.push(...output.targets);
  }
  return [...new Set(targets)].sort();
}

function syntaxCheckTargets(extracted, targets) {
  for (const target of targets.filter(target => target.endsWith(".js"))) {
    const file = path.join(extracted, target);
    requireFile(file, `changed module ${target}`);
    const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
      encoding: "utf8",
      input: fs.readFileSync(file),
      maxBuffer: 64 * 1024 * 1024
    });
    if (result.status !== 0) {
      const output = result.stderr || result.stdout;
      const summary = output.match(/SyntaxError:[^\n]*/)?.[0] ?? output.trim().slice(-1000);
      throw new Error(`module syntax check failed for ${target}: ${summary}`);
    }
  }
}

function treeSnapshot(root) {
  const snapshot = {};
  walk(root, file => {
    const relative = path.relative(root, file);
    const stat = fs.lstatSync(file);
    snapshot[relative] = stat.isSymbolicLink()
      ? {type: "symlink", target: fs.readlinkSync(file)}
      : {type: "file", sha256: sha256File(file), mode: stat.mode & 0o777};
  });
  return snapshot;
}

function equalRecords(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function writeAsarIntegrity(app, hash) {
  const info = path.join(app, "Contents/Info.plist");
  run("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${hash}`,
    info
  ]);
}

function insideApplications(target) {
  const relative = path.relative(fs.realpathSync("/Applications"), target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function verifyNativePackages(unpacked) {
  const modules = path.join(unpacked, "node_modules");
  requireDirectory(modules, "unpacked native node_modules");
  const actual = [];
  for (const entry of fs.readdirSync(modules, {withFileTypes: true})) {
    if (!entry.isDirectory()) throw new Error(`Unexpected unpacked native-module entry: node_modules/${entry.name}`);
    if (entry.name.startsWith("@")) {
      const scope = path.join(modules, entry.name);
      for (const packageEntry of fs.readdirSync(scope, {withFileTypes: true})) {
        if (!packageEntry.isDirectory()) {
          throw new Error(`Unexpected unpacked native-module entry: node_modules/${entry.name}/${packageEntry.name}`);
        }
        actual.push(`${entry.name}/${packageEntry.name}`);
      }
    } else {
      actual.push(entry.name);
    }
  }
  actual.sort();
  if (!equalRecords(actual, expectedNativePackages)) {
    throw new Error(`Upstream changed: unpacked native packages are ${actual.join(", ")}`);
  }
}

function jsonCommand(program, args, label) {
  const result = run(program, args);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function run(program, args) {
  const result = spawnSync(program, args, {encoding: "utf8"});
  if (result.status !== 0) {
    const cause = result.error?.message ?? (result.stderr || result.stdout).trim();
    throw new Error(`${path.basename(program)} ${args.join(" ")} failed: ${cause}`);
  }
  return result;
}

function requireDirectory(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

function requireFile(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

function walk(directory, visit) {
  const entries = fs.readdirSync(directory, {withFileTypes: true})
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, visit);
    else visit(target);
  }
}
