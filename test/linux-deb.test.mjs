#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  inspectLinuxDeb,
  installLinuxDeb,
  prepareLinuxCandidateAdoption
} from "../src/linux-deb.mjs";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-linux-deb-test-"));
try {
  const incident = path.join(scratch, "incident");
  const candidateFile = path.join(scratch, "candidate-original.deb");
  const candidateSourceFile = path.join(scratch, "candidate-source-original.deb");
  const knownGoodFile = path.join(scratch, "known-good-original.deb");
  fs.mkdirSync(incident);
  fs.writeFileSync(candidateFile, "candidate");
  fs.writeFileSync(candidateSourceFile, "candidate-source");
  fs.writeFileSync(knownGoodFile, "known-good");

  const signedVendorFile = path.join(scratch, "signed-vendor.deb");
  const trustedKeyring = path.join(scratch, "chatgpt-archive-keyring.gpg");
  fs.writeFileSync(signedVendorFile, "fixture-deb");
  fs.writeFileSync(trustedKeyring, "fixture-keyring");
  const signatureCalls = [];
  const signedVendor = inspectLinuxDeb(signedVendorFile, {
    scratchParent: scratch,
    vendorKeyring: trustedKeyring,
    processRunner: vendorInspectorRunner({signatureCalls}),
    appInspector: app => ({
      app,
      version: "26.908.40834",
      build: "8881",
      archive: {sha256: "1".repeat(64)},
      executable: {sha256: "2".repeat(64)},
      cli: {sha256: "3".repeat(64)}
    })
  });
  assert.equal(signedVendor.originSignature.state, "valid");
  assert.equal(signatureCalls.length, 1);
  assert.equal(signatureCalls[0].command, "/usr/bin/gpgv");
  assert.deepEqual(signatureCalls[0].arguments_.slice(0, 2), ["--keyring", trustedKeyring]);
  assert.throws(() => inspectLinuxDeb(signedVendorFile, {
    scratchParent: scratch,
    vendorKeyring: trustedKeyring,
    processRunner: vendorInspectorRunner({signatureStatus: 1}),
    appInspector: app => ({
      app,
      version: "26.908.40834",
      build: "8881",
      archive: {sha256: "1".repeat(64)},
      executable: {sha256: "2".repeat(64)},
      cli: {sha256: "3".repeat(64)}
    })
  }), /gpgv .*failed: bad signature/);

  const knownGood = sourceReceipt({
    packageKind: "vendor",
    deb: knownGoodFile,
    debSha256: "a".repeat(64),
    packageVersion: "26.907.40000",
    version: "26.907.40000",
    build: "8870",
    archiveSha256: "b".repeat(64)
  });
  const candidateSource = sourceReceipt({
    packageKind: "vendor",
    deb: candidateSourceFile,
    debSha256: "e".repeat(64),
    packageVersion: "26.908.40834",
    archiveSha256: "f".repeat(64)
  });
  const candidate = sourceReceipt({
    packageKind: "tmtk",
    deb: candidateFile,
    debSha256: "c".repeat(64),
    packageVersion: "26.908.40834+tmtk1",
    archiveSha256: "d".repeat(64),
    originSignature: {state: "absent-local-rebuild"},
    receipt: {
      source: {
        version: candidateSource.packageVersion,
        architecture: candidateSource.architecture,
        sha256: candidateSource.debSha256
      }
    }
  });
  const inspectSource = file => {
    const content = fs.readFileSync(file, "utf8");
    const receipt = content === "candidate" ? candidate :
      content === "candidate-source" ? candidateSource : knownGood;
    return {...receipt, deb: path.resolve(file)};
  };
  const installedInspector = () => applicationInspection(knownGood);
  const prepared = prepareLinuxCandidateAdoption({
    candidatePath: candidateFile,
    candidateSourcePath: candidateSourceFile,
    knownGoodPath: knownGoodFile,
    targetApp: "/usr/lib/chatgpt",
    incidentDirectory: incident,
    debInspector: inspectSource,
    appInspector: installedInspector
  });
  assert.equal(prepared.candidate.deb, path.join(incident, "candidate.deb"));
  assert.equal(prepared.knownGood.deb, path.join(incident, "known-good.deb"));
  assert.equal(fs.readFileSync(prepared.candidate.deb, "utf8"), "candidate");
  assert.equal(fs.readFileSync(prepared.knownGood.deb, "utf8"), "known-good");
  assert.equal(fs.readFileSync(candidateSourceFile, "utf8"), "candidate-source");
  assert.equal(fs.readFileSync(candidateFile, "utf8"), "candidate");
  assert.equal(fs.readFileSync(knownGoodFile, "utf8"), "known-good");

  assert.throws(() => prepareLinuxCandidateAdoption({
    candidatePath: candidateFile,
    candidateSourcePath: null,
    knownGoodPath: knownGoodFile,
    targetApp: "/usr/lib/chatgpt",
    incidentDirectory: path.join(scratch, "missing-candidate-source"),
    debInspector: inspectSource,
    appInspector: installedInspector
  }), /requires --candidate-source/);
  assert.throws(() => prepareLinuxCandidateAdoption({
    candidatePath: candidateFile,
    candidateSourcePath: candidateSourceFile,
    knownGoodPath: null,
    targetApp: "/usr/lib/chatgpt",
    incidentDirectory: path.join(scratch, "missing-known-good"),
    debInspector: inspectSource,
    appInspector: installedInspector
  }), /requires --known-good/);
  const mismatchedCandidate = {
    ...candidate,
    receipt: {source: {...candidate.receipt.source, sha256: "9".repeat(64)}}
  };
  const mismatchIncident = path.join(scratch, "mismatch-incident");
  fs.mkdirSync(mismatchIncident);
  assert.throws(() => prepareLinuxCandidateAdoption({
    candidatePath: candidateFile,
    candidateSourcePath: candidateSourceFile,
    knownGoodPath: knownGoodFile,
    targetApp: "/usr/lib/chatgpt",
    incidentDirectory: mismatchIncident,
    debInspector(file) {
      return path.resolve(file) === path.resolve(candidateFile) ? mismatchedCandidate : inspectSource(file);
    },
    appInspector: installedInspector
  }), /candidate receipt does not identify/);
  assert.deepEqual(fs.readdirSync(mismatchIncident), []);

  const sameBuildIncident = path.join(scratch, "same-build-incident");
  fs.mkdirSync(sameBuildIncident);
  const sameBuildPrepared = prepareLinuxCandidateAdoption({
    candidatePath: candidateFile,
    candidateSourcePath: candidateSourceFile,
    knownGoodPath: candidateSourceFile,
    targetApp: "/usr/lib/chatgpt",
    incidentDirectory: sameBuildIncident,
    debInspector: inspectSource,
    appInspector: () => applicationInspection(candidateSource)
  });
  assert.equal(sameBuildPrepared.candidate.version, candidate.version,
    "the former same-build path remains valid when one DEB fills both explicit roles");
  assert.equal(sameBuildPrepared.knownGood.version, candidateSource.version);

  const installCalls = [];
  const installed = installLinuxDeb({
    targetApp: "/usr/lib/chatgpt",
    source: prepared.candidate,
    sourceInspector: () => prepared.candidate,
    appInspector: () => applicationInspection(prepared.candidate),
    effectiveUserId: 501,
    processRunner(command, arguments_) {
      installCalls.push({command, arguments_});
      if (command === "/usr/bin/dpkg-query") {
        return {status: 0, stdout: `${prepared.candidate.packageVersion}\tamd64\n`, stderr: ""};
      }
      return {status: 0, stdout: "", stderr: ""};
    }
  });
  assert.deepEqual(installCalls[0], {
    command: "/usr/bin/pkexec",
    arguments_: ["/usr/bin/dpkg", "--install", prepared.candidate.deb]
  });
  assert.equal(installed.packageVersion, prepared.candidate.packageVersion);
  assert.equal(installed.archiveSha256, prepared.candidate.archiveSha256);

  const rootCalls = [];
  installLinuxDeb({
    targetApp: "/usr/lib/chatgpt",
    source: prepared.knownGood,
    sourceInspector: () => prepared.knownGood,
    appInspector: () => applicationInspection(prepared.knownGood),
    effectiveUserId: 0,
    processRunner(command, arguments_) {
      rootCalls.push({command, arguments_});
      return command === "/usr/bin/dpkg-query"
        ? {status: 0, stdout: `${prepared.knownGood.packageVersion}\tamd64\n`, stderr: ""}
        : {status: 0, stdout: "", stderr: ""};
    }
  });
  assert.deepEqual(rootCalls[0], {
    command: "/usr/bin/dpkg",
    arguments_: ["--install", prepared.knownGood.deb]
  });

  assert.throws(() => installLinuxDeb({
    targetApp: "/usr/lib/chatgpt",
    source: prepared.candidate,
    sourceInspector: () => prepared.candidate,
    appInspector: () => applicationInspection(prepared.candidate),
    effectiveUserId: 0,
    processRunner(command) {
      return command === "/usr/bin/dpkg-query"
        ? {status: 0, stdout: "wrong\tamd64\n", stderr: ""}
        : {status: 0, stdout: "", stderr: ""};
    }
  }), /installed dpkg identity/);

  process.stdout.write("Linux DEB adoption behavior probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function sourceReceipt(overrides) {
  return {
    kind: "deb",
    packageKind: "vendor",
    deb: "/fixture.deb",
    debSha256: "0".repeat(64),
    package: "chatgpt",
    packageVersion: "26.908.40834",
    architecture: "amd64",
    version: "26.908.40834",
    build: "8881",
    archiveSha256: "1".repeat(64),
    executableSha256: "2".repeat(64),
    cliSha256: "3".repeat(64),
    originSignature: {state: "valid"},
    receipt: null,
    ...overrides
  };
}

function applicationInspection(source) {
  return {
    version: source.version,
    build: source.build,
    archive: {sha256: source.archiveSha256},
    executable: {sha256: source.executableSha256},
    cli: {sha256: source.cliSha256}
  };
}

function vendorInspectorRunner({signatureCalls = [], signatureStatus = 0} = {}) {
  return (command, arguments_, options = {}) => {
    if (command === "/usr/bin/dpkg-deb" && arguments_[0] === "--field") {
      return {
        status: 0,
        stdout: "Package: chatgpt\nVersion: 26.908.40834\nArchitecture: amd64\n",
        stderr: ""
      };
    }
    if (command === "/usr/bin/dpkg-deb" && arguments_[0] === "--raw-extract") {
      fs.mkdirSync(path.join(arguments_[2], "usr/lib/chatgpt/resources"), {recursive: true});
      return {status: 0, stdout: "", stderr: ""};
    }
    if (command === "/usr/bin/ar" && arguments_[0] === "t") {
      return {
        status: 0,
        stdout: "debian-binary\ncontrol.tar.xz\ndata.tar.xz\n_gpgorigin\n",
        stderr: ""
      };
    }
    if (command === "/usr/bin/ar" && arguments_[0] === "x") {
      for (const member of arguments_.slice(2)) {
        fs.writeFileSync(path.join(options.cwd, member), member);
      }
      return {status: 0, stdout: "", stderr: ""};
    }
    if (command === "/usr/bin/gpgv") {
      signatureCalls.push({command, arguments_});
      return signatureStatus === 0
        ? {status: 0, stdout: "", stderr: "good signature"}
        : {status: signatureStatus, stdout: "", stderr: "bad signature"};
    }
    throw new Error(`unexpected fixture command: ${command} ${arguments_.join(" ")}`);
  };
}
