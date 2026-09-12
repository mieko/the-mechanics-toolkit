import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {inspectAppBundle, sha256File} from "./app-bundle.mjs";

const applicationRelative = "usr/lib/chatgpt";
const packageName = "chatgpt";
const toolkitReceiptRelative = "resources/tmtk-package.json";

export function inspectLinuxDeb(debArgument, {
  processRunner = spawnSync,
  appInspector = inspectAppBundle,
  scratchParent = os.tmpdir(),
  vendorKeyring = "/usr/share/keyrings/chatgpt-archive-keyring.gpg"
} = {}) {
  const deb = path.resolve(debArgument);
  requireFile(deb, "DEB package");
  if (path.extname(deb) !== ".deb") throw new Error(`Linux package is not a .deb: ${deb}`);
  const fields = debFields(deb, processRunner);
  requirePackageFields(fields);
  const members = run(processRunner, "/usr/bin/ar", ["t", deb]).stdout.trim().split("\n");
  const scratch = fs.mkdtempSync(path.join(scratchParent, "mechanics-toolkit-inspect-deb-"));
  try {
    const root = path.join(scratch, "package");
    run(processRunner, "/usr/bin/dpkg-deb", ["--raw-extract", deb, root]);
    const application = appInspector(path.join(root, applicationRelative), {platform: "linux"});
    if (application.version !== fields.Version) {
      const receiptFile = path.join(application.app, toolkitReceiptRelative);
      if (!fs.existsSync(receiptFile)) {
        throw new Error("DEB and inner application versions disagree");
      }
    }
    const receiptFile = path.join(application.app, toolkitReceiptRelative);
    const receipt = fs.existsSync(receiptFile) ? readJson(receiptFile, "TMTK package receipt") : null;
    const kind = receipt == null ? "vendor" : "tmtk";
    if (kind === "vendor" && !members.includes("_gpgorigin")) {
      throw new Error("Vendor DEB does not contain its embedded origin signature");
    }
    if (kind === "tmtk" && members.includes("_gpgorigin")) {
      throw new Error("Local TMTK rebuild misleadingly retains the vendor _gpgorigin signature");
    }
    if (kind === "vendor" && fields.Version !== application.version) {
      throw new Error("Vendor DEB and inner application versions disagree");
    }
    if (kind === "tmtk") validateToolkitReceipt(receipt, fields, application);
    const originSignature = kind === "vendor"
      ? verifyVendorOriginSignature({deb, members, scratch, processRunner, vendorKeyring})
      : {state: "absent-local-rebuild"};
    return {
      kind: "deb",
      packageKind: kind,
      deb,
      debSha256: sha256File(deb),
      package: packageName,
      packageVersion: fields.Version,
      architecture: fields.Architecture,
      version: application.version,
      build: application.build,
      archiveSha256: application.archive.sha256,
      executableSha256: application.executable.sha256,
      cliSha256: application.cli.sha256,
      originSignature,
      receipt
    };
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true});
  }
}

function verifyVendorOriginSignature({deb, members, scratch, processRunner, vendorKeyring}) {
  requireFile(vendorKeyring, "trusted ChatGPT APT keyring");
  const compression = "(?:gz|xz|zst|bz2|lzma)";
  const control = uniqueArchiveMember(members,
    new RegExp(`^control\\.tar(?:\\.${compression})?$`), "control archive");
  const data = uniqueArchiveMember(members,
    new RegExp(`^data\\.tar(?:\\.${compression})?$`), "data archive");
  const signedMembers = ["debian-binary", control, data];
  run(processRunner, "/usr/bin/ar", ["x", deb, "_gpgorigin", ...signedMembers], {cwd: scratch});
  const signedData = path.join(scratch, "origin-signed-data");
  fs.writeFileSync(signedData, Buffer.concat(signedMembers.map(member =>
    fs.readFileSync(path.join(scratch, member)))));
  const signature = path.join(scratch, "_gpgorigin");
  run(processRunner, "/usr/bin/gpgv", ["--keyring", vendorKeyring, signature, signedData]);
  return {state: "valid", keyring: path.resolve(vendorKeyring)};
}

function uniqueArchiveMember(members, pattern, label) {
  const matches = members.filter(member => pattern.test(member));
  if (matches.length !== 1) throw new Error(`Vendor DEB has ${matches.length} ${label} members`);
  return matches[0];
}

export function prepareLinuxCandidateAdoption({
  candidatePath,
  candidateSourcePath,
  knownGoodPath,
  targetApp,
  incidentDirectory,
  debInspector = inspectLinuxDeb,
  appInspector = inspectAppBundle
}) {
  if (typeof candidateSourcePath !== "string" || candidateSourcePath.trim() === "") {
    throw new Error("Linux candidate adoption requires --candidate-source with its pristine source DEB");
  }
  if (typeof knownGoodPath !== "string" || knownGoodPath.trim() === "") {
    throw new Error("Linux candidate adoption requires --known-good with the currently installed vendor DEB");
  }
  const candidate = debInspector(candidatePath);
  const candidateSource = debInspector(candidateSourcePath);
  const knownGood = debInspector(knownGoodPath);
  requireCandidateSource(candidate, candidateSource);
  requireRollbackPair(candidate, knownGood);
  requireInstalledMatch(appInspector(targetApp, {platform: "linux"}), knownGood,
    "currently installed application");

  const candidateCopy = path.join(incidentDirectory, "candidate.deb");
  const knownGoodCopy = path.join(incidentDirectory, "known-good.deb");
  try {
    fs.copyFileSync(candidate.deb, candidateCopy, fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(knownGood.deb, knownGoodCopy, fs.constants.COPYFILE_EXCL);
    const copiedCandidate = debInspector(candidateCopy);
    const copiedKnownGood = debInspector(knownGoodCopy);
    requireSourceMatch(copiedCandidate, candidate, "copied candidate DEB");
    requireSourceMatch(copiedKnownGood, knownGood, "copied known-good DEB");
    return {candidate: copiedCandidate, knownGood: copiedKnownGood};
  } catch (error) {
    fs.rmSync(candidateCopy, {force: true});
    fs.rmSync(knownGoodCopy, {force: true});
    throw error;
  }
}

export function installLinuxDeb({
  targetApp,
  source,
  processRunner = spawnSync,
  sourceInspector = inspectLinuxDeb,
  appInspector = inspectAppBundle,
  effectiveUserId = process.getuid?.() ?? -1
}) {
  const verified = sourceInspector(source?.deb);
  requireSourceMatch(verified, source, "DEB selected when restart was armed");
  const dpkgArguments = ["--install", verified.deb];
  const command = effectiveUserId === 0 ? "/usr/bin/dpkg" : "/usr/bin/pkexec";
  const arguments_ = effectiveUserId === 0 ? dpkgArguments : ["/usr/bin/dpkg", ...dpkgArguments];
  run(processRunner, command, arguments_);

  const installed = appInspector(targetApp, {platform: "linux"});
  requireInstalledMatch(installed, verified, "installed application");
  const status = run(processRunner, "/usr/bin/dpkg-query", [
    "--show",
    "--showformat=${Version}\t${Architecture}\n",
    packageName
  ]).stdout.trim().split("\t");
  if (status.length !== 2 || status[0] !== verified.packageVersion ||
      status[1] !== verified.architecture) {
    throw new Error("installed dpkg identity does not match the verified DEB");
  }
  return {
    app: path.resolve(targetApp),
    package: verified.package,
    packageVersion: verified.packageVersion,
    architecture: verified.architecture,
    version: verified.version,
    build: verified.build,
    archiveSha256: verified.archiveSha256,
    executableSha256: verified.executableSha256,
    cliSha256: verified.cliSha256
  };
}

function requireCandidateSource(candidate, source) {
  if (candidate.packageKind !== "tmtk") {
    throw new Error("Linux candidate DEB has no TMTK package receipt");
  }
  if (source.packageKind !== "vendor" || source.originSignature?.state !== "valid") {
    throw new Error("Linux candidate source DEB must be an authenticated vendor package");
  }
  if (candidate.package !== packageName || source.package !== packageName ||
      candidate.architecture !== source.architecture ||
      candidate.version !== source.version || candidate.build !== source.build ||
      candidate.executableSha256 !== source.executableSha256 ||
      candidate.cliSha256 !== source.cliSha256) {
    throw new Error("candidate and candidate-source DEBs do not describe the same application build");
  }
  if (candidate.receipt?.source?.version !== source.packageVersion ||
      candidate.receipt?.source?.sha256 !== source.debSha256 ||
      candidate.receipt?.source?.architecture !== source.architecture) {
    throw new Error("candidate receipt does not identify the supplied candidate-source DEB");
  }
}

function requireRollbackPair(candidate, knownGood) {
  if (knownGood.packageKind !== "vendor" || knownGood.originSignature?.state !== "valid") {
    throw new Error("Linux known-good DEB must be an authenticated vendor package");
  }
  if (candidate.package !== packageName || knownGood.package !== packageName ||
      candidate.architecture !== knownGood.architecture) {
    throw new Error("candidate and known-good DEBs do not describe the same package architecture");
  }
}

function requireInstalledMatch(actual, expected, label) {
  const values = {
    version: actual.version,
    build: actual.build,
    archiveSha256: actual.archive?.sha256,
    executableSha256: actual.executable?.sha256,
    cliSha256: actual.cli?.sha256
  };
  for (const [name, value] of Object.entries(values)) {
    if (typeof expected?.[name] !== "string" || value !== expected[name]) {
      throw new Error(`${label} does not match the known package (${name})`);
    }
  }
}

function requireSourceMatch(actual, expected, label) {
  for (const name of [
    "packageKind", "debSha256", "package", "packageVersion", "architecture", "version", "build",
    "archiveSha256", "executableSha256", "cliSha256"
  ]) {
    if (actual?.[name] !== expected?.[name]) {
      throw new Error(`${label} no longer matches its verified identity (${name})`);
    }
  }
}

function validateToolkitReceipt(receipt, fields, application) {
  if (receipt?.schemaVersion !== 1 || receipt?.source?.package !== packageName ||
      !/^[0-9a-f]{64}$/.test(receipt?.source?.sha256 ?? "") ||
      receipt?.source?.architecture !== fields.Architecture ||
      fields.Version !== `${receipt?.source?.version}+tmtk1` ||
      !Array.isArray(receipt?.patches) ||
      !receipt.patches.includes("safe-start-readiness") ||
      !receipt.patches.includes("renderer-patch-registry") ||
      !/^[0-9a-f]{40}$/.test(receipt?.toolkit?.commit ?? "") ||
      typeof receipt?.toolkit?.dirty !== "boolean" ||
      receipt?.application?.version !== application.version ||
      String(receipt?.application?.build) !== application.build ||
      receipt?.application?.asarSha256 !== application.archive.sha256) {
    throw new Error("TMTK package receipt does not match the rebuilt DEB");
  }
}

function debFields(file, processRunner) {
  const names = ["Package", "Version", "Architecture"];
  const output = run(processRunner, "/usr/bin/dpkg-deb", ["--field", file, ...names]).stdout;
  const fields = {};
  for (const line of output.trimEnd().split("\n")) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match != null) fields[match[1]] = match[2];
  }
  return fields;
}

function requirePackageFields(fields) {
  if (fields.Package !== packageName) throw new Error(`Refusing non-ChatGPT DEB: ${fields.Package}`);
  if (!new Set(["amd64", "arm64"]).has(fields.Architecture)) {
    throw new Error(`Unsupported ChatGPT DEB architecture: ${fields.Architecture}`);
  }
  if (typeof fields.Version !== "string" || fields.Version === "") {
    throw new Error("DEB package version is missing");
  }
}

function run(processRunner, command, arguments_, options = {}) {
  const result = processRunner(command, arguments_, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options
  });
  if (result.error != null || result.status !== 0) {
    const cause = result.error?.message ?? (result.stderr || result.stdout).trim();
    throw new Error(`${path.basename(command)} ${arguments_.join(" ")} failed: ${cause}`);
  }
  return result;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label}: ${error.message}`);
  }
}

function requireFile(file, label) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Missing ${label}: ${file}`);
}
