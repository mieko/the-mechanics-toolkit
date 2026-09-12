import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {inspectAppBundle, sha256File} from "./app-bundle.mjs";
import {inspectLinuxDeb} from "./linux-deb.mjs";
import {
  applyPatchFleet,
  equalRecords,
  readToolkitConfig,
  recordDifferences,
  selectedPatches,
  treeSnapshot,
  verifyPatchFleet
} from "./stage-patch-fleet.mjs";

const applicationRelative = "usr/lib/chatgpt";
const toolkitMetadataRelative = "resources/tmtk-package.json";

export function stageDeb({
  sourceDeb,
  destinationDeb,
  configPath,
  repositoryRoot,
  sourceInspector = inspectLinuxDeb,
  scratchParent = os.tmpdir()
}) {
  const source = path.resolve(sourceDeb);
  const destination = path.resolve(destinationDeb);
  const configFile = path.resolve(configPath);
  const repository = path.resolve(repositoryRoot);
  const asar = path.join(repository, "node_modules/.bin/asar");
  requireFile(source, "source DEB");
  requireFile(asar, "repository-local asar CLI; run npm install");
  validateDestination(source, destination);

  const config = readToolkitConfig(configFile);
  const selected = selectedPatches(config.enabledPatches);
  validatePatchScopes(selected);
  const sourceSha256 = sha256File(source);
  const sourcePackage = debFields(source);
  requireSourcePackage(sourcePackage);
  requireAuthenticatedSource(sourceInspector(source, {scratchParent}), sourceSha256, sourcePackage);
  const toolkit = toolkitIdentity(repository);
  const scratch = fs.mkdtempSync(path.join(scratchParent, "mechanics-toolkit-deb-"));
  let destinationCreated = false;
  let complete = false;
  let temporaryDestination = null;
  try {
    const packageRoot = path.join(scratch, "package");
    run("/usr/bin/dpkg-deb", ["--raw-extract", source, packageRoot]);
    const app = path.join(packageRoot, applicationRelative);
    const sourceApplication = inspectAppBundle(app, {platform: "linux"});
    if (sourceApplication.version !== sourcePackage.Version) {
      throw new Error("DEB and inner application versions disagree");
    }
    const sourceData = packageTreeSnapshot(packageRoot, {excludeControl: true});
    const sourceUnpacked = `${sourceApplication.archive.path}.unpacked`;
    requireDirectory(sourceUnpacked, "unpacked native-module directory");
    const sourceNative = treeSnapshot(sourceUnpacked);
    const unpackedPaths = asarUnpackedPaths(asar, sourceApplication.archive.path);
    const unpackRules = deriveUnpackRules(unpackedPaths, sourceUnpacked);

    const extracted = path.join(scratch, "asar");
    run(asar, ["extract", sourceApplication.archive.path, extracted]);
    const fleet = applyPatchFleet({
      selected,
      roots: {asar: extracted},
      configFile,
      config,
      repository,
      sourceLabel: "Source DEB"
    });
    const {changedTargets: targets} = fleet;

    const newArchive = `${sourceApplication.archive.path}.tmtk-new`;
    const newUnpacked = `${newArchive}.unpacked`;
    run(asar, ["pack", extracted, newArchive, ...unpackArguments(unpackRules)]);
    if (!equalRecords(unpackedPaths, asarUnpackedPaths(asar, newArchive))) {
      throw new Error("ASAR repack did not preserve the source unpacked-header paths");
    }
    requireDirectory(newUnpacked, "repacked native-module directory");
    fs.cpSync(sourceUnpacked, newUnpacked, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
      verbatimSymlinks: true
    });
    restoreTreeModes(sourceUnpacked, newUnpacked);
    if (!equalRecords(sourceNative, treeSnapshot(newUnpacked))) {
      throw new Error("ASAR repack did not preserve the source native-module tree");
    }
    fs.renameSync(newArchive, sourceApplication.archive.path);
    fs.rmSync(sourceUnpacked, {recursive: true, force: true});
    fs.renameSync(newUnpacked, sourceUnpacked);

    const stagedApplication = inspectAppBundle(app, {platform: "linux"});
    if (stagedApplication.version !== sourceApplication.version ||
        stagedApplication.build !== sourceApplication.build) {
      throw new Error("Staging changed the inner application version or build");
    }
    const metadata = {
      schemaVersion: 1,
      source: {
        package: sourcePackage.Package,
        version: sourcePackage.Version,
        architecture: sourcePackage.Architecture,
        sha256: sourceSha256
      },
      toolkit,
      patches: selected.map(definition => definition.name),
      application: {
        version: stagedApplication.version,
        build: stagedApplication.build,
        asarSha256: stagedApplication.archive.sha256
      }
    };
    fs.writeFileSync(path.join(app, toolkitMetadataRelative), `${JSON.stringify(metadata, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o644
    });
    const rebuiltVersion = `${sourcePackage.Version}+tmtk1`;
    writeControl(path.join(packageRoot, "DEBIAN/control"), {
      version: rebuiltVersion,
      installedSize: installedSize(packageRoot),
      sourcePackage,
      sourceSha256,
      toolkit,
      patches: metadata.patches
    });

    temporaryDestination = `${destination}.tmp-${process.pid}-${crypto.randomUUID()}`;
    run("/usr/bin/dpkg-deb", ["--root-owner-group", "--build", packageRoot, temporaryDestination]);
    fs.renameSync(temporaryDestination, destination);
    destinationCreated = true;

    const finalPackage = debFields(destination);
    if (finalPackage.Package !== "chatgpt" || finalPackage.Version !== rebuiltVersion ||
        finalPackage.Architecture !== sourcePackage.Architecture) {
      throw new Error("Rebuilt DEB does not preserve its expected package identity");
    }
    const verifiedRoot = path.join(scratch, "verified-package");
    run("/usr/bin/dpkg-deb", ["--raw-extract", destination, verifiedRoot]);
    verifyDataChanges(sourceData, packageTreeSnapshot(verifiedRoot, {excludeControl: true}));
    const finalApp = path.join(verifiedRoot, applicationRelative);
    const finalInspection = inspectAppBundle(finalApp, {platform: "linux"});
    const finalMetadata = readJson(path.join(finalApp, toolkitMetadataRelative));
    if (!equalRecords(finalMetadata, metadata)) {
      throw new Error("Rebuilt DEB did not preserve its toolkit metadata");
    }
    const verifiedAsar = path.join(scratch, "verified-asar");
    run(asar, ["extract", finalInspection.archive.path, verifiedAsar]);
    verifyPatchFleet({
      selected,
      roots: {asar: verifiedAsar},
      configFile,
      config,
      repository
    });
    if (sha256File(source) !== sourceSha256) throw new Error("Source DEB changed while staging");

    complete = true;
    return {
      state: "staged-deb-static-proof-green",
      source: {...sourcePackage, sha256: sourceSha256, untouched: true},
      candidate: {...finalPackage, path: destination, sha256: sha256File(destination)},
      application: {
        version: finalInspection.version,
        build: finalInspection.build,
        asarSha256: finalInspection.archive.sha256
      },
      patches: metadata.patches,
      changedTargets: targets,
      secondApplyByteIdentical: true,
      probesPassedAfterRepack: true,
      nativePayloadPreserved: true,
      packageIdentity: "local-tmtk-rebuild",
      updateBehavior: "a higher vendor repository version may replace this local rebuild",
      liveAppTouched: false,
      installed: false,
      launched: false
    };
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true});
    if (temporaryDestination != null) fs.rmSync(temporaryDestination, {force: true});
    if (destinationCreated && !complete) fs.rmSync(destination, {force: true});
  }
}

function requireAuthenticatedSource(inspection, sourceSha256, sourcePackage) {
  if (inspection?.packageKind !== "vendor" || inspection?.originSignature?.state !== "valid") {
    throw new Error("Source DEB is not authenticated by the trusted ChatGPT APT keyring");
  }
  if (inspection.debSha256 !== sourceSha256 || inspection.package !== sourcePackage.Package ||
      inspection.packageVersion !== sourcePackage.Version ||
      inspection.architecture !== sourcePackage.Architecture) {
    throw new Error("Authenticated source DEB identity changed before staging");
  }
}

function validatePatchScopes(selected) {
  const appPatches = selected.filter(definition => definition.scope === "app");
  if (appPatches.length > 0) {
    throw new Error(`Linux DEB staging does not support app-scope patches: ${appPatches.map(p => p.name).join(", ")}`);
  }
}

function debFields(file) {
  const names = ["Package", "Version", "Architecture", "Maintainer", "Installed-Size"];
  const result = run("/usr/bin/dpkg-deb", ["--field", file, ...names]);
  const fields = {};
  for (const line of result.stdout.trimEnd().split("\n")) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match != null) fields[match[1]] = match[2];
  }
  if (names.some(name => typeof fields[name] !== "string" || fields[name] === "")) {
    throw new Error("DEB package fields are incomplete");
  }
  return Object.fromEntries(names.map(name => [name, fields[name]]));
}

function requireSourcePackage(fields) {
  if (fields.Package !== "chatgpt") throw new Error(`Refusing non-ChatGPT DEB package: ${fields.Package}`);
  if (!new Set(["amd64", "arm64"]).has(fields.Architecture)) {
    throw new Error(`Unsupported ChatGPT DEB architecture: ${fields.Architecture}`);
  }
  if (fields.Version.includes("+tmtk")) throw new Error("Source DEB is already a TMTK rebuild");
}

function writeControl(file, {version, installedSize, sourcePackage, sourceSha256, toolkit, patches}) {
  let control = fs.readFileSync(file, "utf8");
  control = replaceControlField(control, "Version", version);
  control = replaceControlField(control, "Installed-Size", String(installedSize));
  control = replaceControlField(control, "Maintainer", "The Mechanic's Toolkit <noreply@localhost>");
  const fields = [
    ["Original-Maintainer", sourcePackage.Maintainer],
    ["X-TMTK-Rebuild", "yes"],
    ["X-TMTK-Source-Version", sourcePackage.Version],
    ["X-TMTK-Source-SHA256", sourceSha256],
    ["X-TMTK-Toolkit-Commit", toolkit.commit],
    ["X-TMTK-Toolkit-Dirty", String(toolkit.dirty)],
    ["X-TMTK-Patches", patches.join(", ")]
  ];
  const description = control.search(/^Description:/m);
  if (description < 0) throw new Error("DEB control file has no Description field");
  const additions = fields.map(([name, value]) => `${name}: ${value}`).join("\n");
  control = `${control.slice(0, description)}${additions}\n${control.slice(description)}`;
  fs.writeFileSync(file, control, {encoding: "utf8", mode: 0o644});
}

function replaceControlField(control, name, value) {
  const pattern = new RegExp(`^${name}:.*$`, "m");
  if (!pattern.test(control)) throw new Error(`DEB control file has no ${name} field`);
  return control.replace(pattern, `${name}: ${value}`);
}

function toolkitIdentity(repository) {
  const commit = run("/usr/bin/git", ["-C", repository, "rev-parse", "HEAD"]).stdout.trim();
  const dirty = run("/usr/bin/git", ["-C", repository, "status", "--porcelain"]).stdout !== "";
  return {commit, dirty};
}

function installedSize(packageRoot) {
  let bytes = 0;
  walk(packageRoot, (file, relative) => {
    if (relative === "DEBIAN" || relative.startsWith("DEBIAN/")) return;
    const stat = fs.lstatSync(file);
    if (stat.isFile()) bytes += stat.size;
  });
  return Math.ceil(bytes / 1024);
}

function verifyDataChanges(before, after) {
  const allowed = new Set([
    `${applicationRelative}/resources/app.asar`,
    `${applicationRelative}/${toolkitMetadataRelative}`
  ]);
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const unexpected = names.filter(name => !allowed.has(name) &&
    JSON.stringify(before[name]) !== JSON.stringify(after[name]));
  if (unexpected.length > 0) {
    throw new Error(`Rebuilt DEB changed non-owned payloads: ${recordDifferences(
      Object.fromEntries(unexpected.map(name => [name, before[name]])),
      Object.fromEntries(unexpected.map(name => [name, after[name]]))
    )}`);
  }
}

function packageTreeSnapshot(root, {excludeControl = false} = {}) {
  const snapshot = {};
  walk(root, (file, relative) => {
    if (excludeControl && (relative === "DEBIAN" || relative.startsWith("DEBIAN/"))) return;
    const stat = fs.lstatSync(file);
    snapshot[relative] = stat.isSymbolicLink()
      ? {type: "symlink", target: fs.readlinkSync(file)}
      : stat.isFile()
        ? {type: "file", sha256: sha256File(file), mode: stat.mode & 0o777}
        : {type: "directory", mode: stat.mode & 0o777};
  });
  return snapshot;
}

function restoreTreeModes(source, destination) {
  fs.chmodSync(destination, fs.lstatSync(source).mode & 0o777);
  walk(source, (file, relative) => {
    const stat = fs.lstatSync(file);
    if (!stat.isSymbolicLink()) fs.chmodSync(path.join(destination, relative), stat.mode & 0o777);
  });
}

function asarUnpackedPaths(asar, archive) {
  const prefix = "unpack : /";
  return run(asar, ["list", "--is-pack", archive]).stdout.split("\n")
    .filter(line => line.startsWith(prefix))
    .map(line => line.slice(prefix.length))
    .sort();
}

function deriveUnpackRules(headerPaths, unpackedRoot) {
  if (headerPaths.length === 0) throw new Error("Source application has no unpacked ASAR entries");
  const directories = headerPaths.filter(relative => fs.statSync(path.join(unpackedRoot, relative)).isDirectory())
    .sort((left, right) => left.length - right.length || left.localeCompare(right));
  const roots = [];
  for (const relative of directories) {
    if (!roots.some(root => relative === root || relative.startsWith(`${root}/`))) roots.push(relative);
  }
  const files = headerPaths.filter(relative => !fs.statSync(path.join(unpackedRoot, relative)).isDirectory())
    .filter(relative => !roots.some(root => relative.startsWith(`${root}/`)));
  return {directories: roots.sort(), files: files.sort()};
}

function unpackArguments({directories, files}) {
  const args = [];
  const directoryGlob = exactGlob(directories);
  const fileGlob = exactGlob(files, "**/");
  if (directoryGlob) args.push("--unpack-dir", directoryGlob);
  if (fileGlob) args.push("--unpack", fileGlob);
  return args;
}

function exactGlob(paths, prefix = "") {
  if (paths.length === 0) return null;
  const unsafe = paths.find(file => /[{},!\[\]*?\\]/.test(file));
  if (unsafe) throw new Error(`Cannot safely preserve unpacked ASAR path in a glob: ${unsafe}`);
  return paths.length === 1 ? `${prefix}${paths[0]}` : `${prefix}{${paths.join(",")}}`;
}

function run(program, args) {
  const result = spawnSync(program, args, {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
  if (result.error != null || result.status !== 0) {
    const cause = result.error?.message ?? (result.stderr || result.stdout).trim();
    throw new Error(`${path.basename(program)} ${args.join(" ")} failed: ${cause}`);
  }
  return result;
}

function readJson(file, label = path.basename(file)) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${label}: ${error.message}`);
  }
}

function validateDestination(source, destination) {
  if (source === destination) throw new Error("Source and destination DEBs must differ");
  if (fs.existsSync(destination)) throw new Error(`Staging destination already exists: ${destination}`);
  requireDirectory(path.dirname(destination), "staging destination parent");
  if (path.extname(source) !== ".deb" || path.extname(destination) !== ".deb") {
    throw new Error("Linux package staging requires .deb source and destination paths");
  }
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

function walk(root, visit, current = root) {
  const relative = path.relative(root, current);
  if (relative !== "") visit(current, relative);
  if (!fs.lstatSync(current).isDirectory()) return;
  for (const entry of fs.readdirSync(current).sort()) walk(root, visit, path.join(current, entry));
}
