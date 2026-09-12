import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { inspectAppBundle } from "./app-bundle.mjs";
import { asarHeaderSha256 } from "./asar-integrity.mjs";
import {
  applyPatchFleet,
  equalRecords,
  readToolkitConfig,
  recordDifferences,
  selectedPatches,
  treeSnapshot,
  verifyPatchFleet
} from "./stage-patch-fleet.mjs";

const terminalHelperRelative = "node_modules/node-pty/build/Release/spawn-helper";
const expectedNativePackages = Object.freeze([
  "@worklouder/device-kit-oai",
  "better-sqlite3",
  "node-pty",
  "objc-js"
]);

export function stageApp({sourceApp, destinationApp, configPath, repositoryRoot}) {
  if (process.platform !== "darwin") {
    throw new Error("macOS application staging requires macOS");
  }
  const source = path.resolve(sourceApp);
  const destination = path.resolve(destinationApp);
  const configFile = path.resolve(configPath);
  const repository = path.resolve(repositoryRoot);
  const asar = path.join(repository, "node_modules/.bin/asar");
  requireFile(asar, "repository-local asar CLI; run npm install");
  const config = readToolkitConfig(configFile);
  const signingIdentity = configuredSigningIdentity(config);
  const selected = selectedPatches(config.enabledPatches);
  const hasAsarPatches = selected.some(definition => definition.scope === "asar");
  validatePaths(source, destination);

  const sourceBefore = inspectAppBundle(source);
  if (sourceBefore.signature.state !== "valid") throw new Error("Source app code signature is not valid");
  if (sourceBefore.asarIntegrity.state !== "valid") {
    throw new Error("Source app ASAR header does not match ElectronAsarIntegrity");
  }
  const sourceUnpacked = `${sourceBefore.archive.path}.unpacked`;
  verifyNativePackages(sourceUnpacked);
  const sourceNativeSnapshot = treeSnapshot(sourceUnpacked);
  const sourceUnpackedHeaderPaths = unpackedHeaderPaths(asar, sourceBefore.archive.path);
  const unpackRules = deriveUnpackRules(sourceUnpackedHeaderPaths, sourceUnpacked);

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
    const roots = {app: destination, asar: extracted};
    const fleet = applyPatchFleet({
      selected,
      roots,
      configFile,
      config,
      repository,
      sourceLabel: "Source app"
    });
    const targets = fleet.changedTargets;

    if (hasAsarPatches) {
      restoreUnpackedModes(extracted, sourceNativeSnapshot);
      const extractedTerminalHelper = path.join(extracted, terminalHelperRelative);
      requireFile(extractedTerminalHelper, "node-pty spawn-helper in extracted ASAR");
      fs.chmodSync(extractedTerminalHelper, 0o755);

      const stagedArchive = `${copied.archive.path}.toolkit-new`;
      const stagedUnpacked = `${stagedArchive}.unpacked`;
      fs.rmSync(stagedArchive, {force: true});
      fs.rmSync(stagedUnpacked, {recursive: true, force: true});
      run(asar, ["pack", extracted, stagedArchive, ...unpackArguments(unpackRules)]);
      if (!equalRecords(sourceUnpackedHeaderPaths, unpackedHeaderPaths(asar, stagedArchive))) {
        throw new Error("ASAR repack did not preserve the source unpacked-header paths");
      }
      requireDirectory(stagedUnpacked, "repacked native-module directory");
      verifyNativePackages(stagedUnpacked);
      if (!isExecutable(path.join(stagedUnpacked, terminalHelperRelative))) {
        throw new Error("ASAR repack did not preserve the executable node-pty spawn-helper");
      }
      run("/usr/bin/ditto", [sourceUnpacked, stagedUnpacked]);

      fs.renameSync(stagedArchive, copied.archive.path);
      fs.rmSync(`${copied.archive.path}.unpacked`, {recursive: true, force: true});
      fs.renameSync(stagedUnpacked, `${copied.archive.path}.unpacked`);
      const repackedNativeSnapshot = treeSnapshot(`${copied.archive.path}.unpacked`);
      if (!equalRecords(sourceNativeSnapshot, repackedNativeSnapshot)) {
        throw new Error(`ASAR repack did not preserve the source native-module tree: ${recordDifferences(sourceNativeSnapshot, repackedNativeSnapshot)}`);
      }
      writeAsarIntegrity(destination, asarHeaderSha256(copied.archive.path));
    }
    run("/usr/bin/codesign", ["--force", "--sign", signingIdentity, destination]);

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
      throw new Error(`Final staged application did not preserve the source native-module tree: ${recordDifferences(sourceNativeSnapshot, treeSnapshot(`${finalInspection.archive.path}.unpacked`))}`);
    }

    const verified = path.join(scratch, "verified");
    run(asar, ["extract", finalInspection.archive.path, verified]);
    const finalRoots = {app: destination, asar: verified};
    const finalChecks = verifyPatchFleet({
      selected,
      roots: finalRoots,
      configFile,
      config,
      repository
    });

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

function configuredSigningIdentity(config) {
  if (config.signingIdentity === undefined) return "-";
  if (typeof config.signingIdentity !== "string" || config.signingIdentity.trim() === "") {
    throw new Error("Toolkit config signingIdentity must be a nonempty string");
  }
  return config.signingIdentity;
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

function exactGlob(paths, prefix = "") {
  if (paths.length === 0) return null;
  const unsafe = paths.find(file => /[{},!\[\]*?\\]/.test(file));
  if (unsafe) {
    throw new Error(`Cannot safely preserve unpacked native path in an ASAR glob: ${unsafe}`);
  }
  return paths.length === 1 ? `${prefix}${paths[0]}` : `${prefix}{${paths.join(",")}}`;
}

function unpackedHeaderPaths(asar, archive) {
  const prefix = "unpack : /";
  return run(asar, ["list", "--is-pack", archive]).stdout
    .split("\n")
    .filter(line => line.startsWith(prefix))
    .map(line => line.slice(prefix.length))
    .sort();
}

function deriveUnpackRules(headerPaths, unpackedRoot) {
  if (headerPaths.length === 0) throw new Error("Source application has no unpacked ASAR entries");
  const directories = headerPaths.filter(relative => fs.statSync(path.join(unpackedRoot, relative)).isDirectory())
    .sort((left, right) => left.length - right.length || left.localeCompare(right));
  const directoryRoots = [];
  for (const relative of directories) {
    if (!directoryRoots.some(root => relative === root || relative.startsWith(`${root}/`))) {
      directoryRoots.push(relative);
    }
  }
  const files = headerPaths.filter(relative => !fs.statSync(path.join(unpackedRoot, relative)).isDirectory())
    .filter(relative => !directoryRoots.some(root => relative.startsWith(`${root}/`)));
  return {directories: directoryRoots.sort(), files: files.sort()};
}

function unpackArguments({directories, files}) {
  const args = [];
  const directoryGlob = exactGlob(directories);
  const fileGlob = exactGlob(files, "**/");
  if (directoryGlob) args.push("--unpack-dir", directoryGlob);
  if (fileGlob) args.push("--unpack", fileGlob);
  return args;
}

function restoreUnpackedModes(extracted, snapshot) {
  for (const [relative, record] of Object.entries(snapshot)) {
    const target = path.join(extracted, relative);
    if (record.type === "file" && fs.existsSync(target)) fs.chmodSync(target, record.mode);
  }
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

function run(program, args) {
  const result = spawnSync(program, args, {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
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
