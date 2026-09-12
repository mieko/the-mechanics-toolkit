#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {sha256File} from "../src/app-bundle.mjs";
import {
  compareMsixVersions,
  stageMsix,
  temporaryPackagePath,
  windowsConfig
} from "../src/stage-msix.mjs";

assert.equal(compareMsixVersions("26.908.4834.1", "26.908.4834.0"), 1);
assert.equal(compareMsixVersions("26.908.4834.1", "26.908.4834.1"), 0);
assert.equal(compareMsixVersions("26.908.4833.65535", "26.908.4834.0"), -1);
assert.throws(() => compareMsixVersions("26.908.4834", "26.908.4834.0"),
  /Invalid MSIX package version/);
assert.throws(() => compareMsixVersions("26.908.4834.65536", "26.908.4834.0"),
  /out of range/);

const windows = {
  candidateVersion: "26.908.4834.1",
  knownGoodVersion: "26.908.4834.2",
  makeAppx: String.raw`C:\tools\makeappx.exe`,
  signTool: String.raw`C:\tools\signtool.exe`,
  signingCertificateThumbprint: "B3521CC4DA7ED2BB47F0C0A43109428A634109B2",
  codexBinaries: {
    native: String.raw`C:\build\codex.exe`,
    wsl: String.raw`C:\build\codex`
  }
};
assert.equal(windowsConfig(windows), windows);
assert.throws(() => windowsConfig({...windows, candidateVersion: "1.2.3"}),
  /Invalid MSIX package version/);
assert.throws(() => windowsConfig({...windows, makeAppx: "makeappx.exe"}),
  /absolute Windows path/);
assert.throws(() => windowsConfig({...windows, surprise: true}),
  /Unknown toolkit config windows keys/);
assert.throws(() => windowsConfig({...windows, signingCertificateThumbprint: "short"}),
  /SHA-1 thumbprint/);
assert.throws(() => stageMsix({platform: "darwin"}), /must run on Windows/);
assert.match(temporaryPackagePath("candidate.msix"),
  /^candidate\.tmp-\d+-[0-9a-f-]{36}\.msix$/,
  "temporary package names retain the MSIX extension required by SignTool");

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-stage-msix-test-"));
try {
  const source = path.join(scratch,
    "OpenAI.Codex_26.908.4834.0_arm64__2p2nqsd0c76g0");
  const candidate = path.join(scratch, "candidate.msix");
  const knownGood = path.join(scratch, "known-good.msix");
  const config = path.join(scratch, "toolkit.json");
  buildSourceApplication(source);
  writeConfig(config, ["safe-start-readiness", "renderer-patch-registry"]);
  const sourceBefore = installedInspection(source);
  const packageContents = new Map();
  const result = stageMsix({
    sourceApp: source,
    candidateMsix: candidate,
    knownGoodMsix: knownGood,
    configPath: config,
    repositoryRoot: repository,
    platform: "win32",
    processRunner: fixtureRunner(sourceBefore, packageContents),
    appInspector: installedInspection,
    sourceInspector: packageFile => packageInspection(packageFile, packageContents),
    scratchParent: scratch
  });
  assert.equal(result.state, "staged-msix-static-proof-green");
  assert.deepEqual(result.patches, ["safe-start-readiness", "renderer-patch-registry"]);
  assert.equal(result.source.asarSha256, sourceBefore.archive.sha256);
  assert.equal(result.knownGood.asarSha256, sourceBefore.archive.sha256);
  assert.notEqual(result.candidate.asarSha256, sourceBefore.archive.sha256);
  assert.equal(fs.existsSync(candidate), true);
  assert.equal(fs.existsSync(knownGood), true);
  assert.deepEqual(stageScratchDirectories(), [], "successful staging removes its scratch tree");

  const refused = path.join(scratch, "refused.msix");
  const refusedKnownGood = path.join(scratch, "refused-known-good.msix");
  const refusedConfig = path.join(scratch, "refused-toolkit.json");
  writeConfig(refusedConfig, [
    "full-history-drain-suppression",
    "safe-start-readiness",
    "renderer-patch-registry"
  ]);
  const refusedContents = new Map();
  assert.throws(() => stageMsix({
    sourceApp: source,
    candidateMsix: refused,
    knownGoodMsix: refusedKnownGood,
    configPath: refusedConfig,
    repositoryRoot: repository,
    platform: "win32",
    processRunner: fixtureRunner(sourceBefore, refusedContents),
    appInspector: installedInspection,
    sourceInspector: packageFile => packageInspection(packageFile, refusedContents),
    scratchParent: scratch
  }), /full-history-drain-suppression\/patch\.mjs check/);
  assert.equal(fs.existsSync(refused), false);
  assert.equal(fs.existsSync(refusedKnownGood), false);
  assert.deepEqual(stageScratchDirectories(), [], "refusal leaves no staging scratch tree");
  process.stdout.write("Windows production MSIX staging fixture passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function buildSourceApplication(source) {
  const resources = path.join(source, "app/resources");
  const asarRoot = path.join(scratch, "asar-root");
  fs.mkdirSync(resources, {recursive: true});
  fs.mkdirSync(path.join(asarRoot, ".vite/build"), {recursive: true});
  fs.mkdirSync(path.join(asarRoot, "webview/assets"), {recursive: true});
  fs.mkdirSync(path.join(asarRoot, "node_modules/native"), {recursive: true});
  fs.writeFileSync(path.join(source, "AppxManifest.xml"), manifest("26.908.4834.0"));
  fs.writeFileSync(path.join(source, "app/ChatGPT.exe"), "signed-executable-fixture");
  fs.writeFileSync(path.join(resources, "codex.exe"), "native-codex-fixture");
  fs.writeFileSync(path.join(resources, "codex"), "wsl-codex-fixture");
  fs.writeFileSync(path.join(asarRoot, "package.json"), `${JSON.stringify({
    name: "openai-codex-electron",
    version: "26.908.40834",
    codexBuildNumber: "8881",
    devDependencies: {electron: "42.3.0"}
  })}\n`);
  fs.writeFileSync(path.join(asarRoot, ".vite/build/main-fixture.js"),
    "var Tie=`CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH`;function Aie(){}function owner(e){let{requestDevRelaunch:P=Aie}=e,N=()=>true,r={lt:1},l={ipcMain:{handle(){}}};l.ipcMain.handle(r.lt,async(t,s)=>{if(!N(t))return;if(s.type===`electron-avatar-overlay-restore-ready`)return})}");
  fs.writeFileSync(path.join(asarRoot, "webview/assets/app-initial-fixture.js"),
    "const H={dispatchMessage(){}};function MHs(){H.dispatchMessage(`ready`,{persistedStateResponsePriority:W7?`critical`:void 0})}");
  fs.writeFileSync(path.join(asarRoot, "node_modules/native/addon.node"), "native-fixture");
  run(process.execPath, [
    path.join(repository, "node_modules/@electron/asar/bin/asar.mjs"),
    "pack", asarRoot, path.join(resources, "app.asar"),
    "--unpack-dir", "node_modules/native"
  ]);
  fs.rmSync(asarRoot, {recursive: true, force: true});
}

function writeConfig(file, enabledPatches) {
  fs.writeFileSync(file, `${JSON.stringify({enabledPatches, windows})}\n`);
}

function fixtureRunner(sourceInspection, packageContents) {
  return (program, arguments_, options) => {
    if (program === process.execPath) return spawnSync(program, arguments_, options);
    assert.equal(program, "powershell.exe");
    const actionIndex = arguments_.indexOf("-File") + 2;
    const action = arguments_[actionIndex];
    const values = arguments_.slice(actionIndex + 1);
    if (action === "validate-prerequisites") {
      return ok({
        source: {
          packageFullName: sourceInspection.package.fullName,
          packageFamilyName: sourceInspection.package.familyName,
          manifest: {version: sourceInspection.package.outerVersion}
        },
        certificate: {thumbprint: windows.signingCertificateThumbprint.toLowerCase()}
      });
    }
    if (action === "copy-package-content") {
      const [source, destination, version] = values;
      fs.cpSync(source, destination, {recursive: true, preserveTimestamps: true});
      fs.writeFileSync(path.join(destination, "AppxManifest.xml"), manifest(version));
      return ok({
        sourceVersion: sourceInspection.package.outerVersion,
        manifest: fixtureManifestIdentity(version)
      });
    }
    if (action === "build-package") {
      const [content, output] = values;
      const version = manifestVersion(path.join(content, "AppxManifest.xml"));
      fs.writeFileSync(output, `fixture-msix:${version}:${sha256File(path.join(
        content, "app/resources/app.asar"))}\n`);
      packageContents.set(path.resolve(output), {content, version});
      return ok({
        sha256: sha256File(output),
        signature: "Valid",
        signerThumbprint: windows.signingCertificateThumbprint.toLowerCase()
      });
    }
    if (action === "extract-package") {
      const [packageFile, destination] = values;
      const built = packageContents.get(path.resolve(packageFile));
      assert.ok(built, `missing fixture package content for ${packageFile}`);
      fs.cpSync(built.content, destination, {recursive: true, preserveTimestamps: true});
      return ok({content: destination, manifest: fixtureManifestIdentity(built.version)});
    }
    throw new Error(`unexpected Windows staging helper action: ${action}`);
  };
}

function installedInspection(source) {
  return {
    app: source,
    identifier: "OpenAI.Codex",
    version: "26.908.40834",
    build: "8881",
    electron: "42.3.0",
    package: {
      fullName: "OpenAI.Codex_26.908.4834.0_arm64__2p2nqsd0c76g0",
      familyName: "OpenAI.Codex_2p2nqsd0c76g0",
      publisher: "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B",
      outerVersion: "26.908.4834.0",
      architecture: "arm64",
      status: "Ok",
      signatureKind: "Store",
      applicationId: "OpenAI.Codex_2p2nqsd0c76g0!App"
    },
    archive: {
      path: path.join(source, "app/resources/app.asar"),
      sha256: sha256File(path.join(source, "app/resources/app.asar"))
    },
    asarIntegrity: {state: "not-present"},
    signature: {state: "valid", executable: "Valid"}
  };
}

function packageInspection(packageFile, packageContents) {
  const built = packageContents.get(path.resolve(packageFile));
  assert.ok(built, `missing fixture inspection content for ${packageFile}`);
  const archive = path.join(built.content, "app/resources/app.asar");
  return {
    app: packageFile,
    identifier: "OpenAI.Codex",
    version: "26.908.40834",
    build: "8881",
    electron: "42.3.0",
    package: {
      fullName: `OpenAI.Codex_${built.version}_arm64__2p2nqsd0c76g0`,
      familyName: "OpenAI.Codex_2p2nqsd0c76g0",
      publisher: "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B",
      outerVersion: built.version,
      architecture: "arm64",
      status: "Ok",
      signatureKind: "PackageFile",
      applicationId: "OpenAI.Codex_2p2nqsd0c76g0!App"
    },
    artifact: {path: packageFile, sha256: sha256File(packageFile)},
    archive: {path: "app/resources/app.asar", sha256: sha256File(archive)},
    asarIntegrity: {state: "not-present"},
    signature: {state: "valid", package: "Valid", executable: "Valid"}
  };
}

function fixtureManifestIdentity(version) {
  return {
    name: "OpenAI.Codex",
    publisher: "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B",
    version,
    architecture: "arm64",
    resourceId: "",
    applicationId: "OpenAI.Codex_2p2nqsd0c76g0!App"
  };
}

function manifest(version) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"><Identity Name="OpenAI.Codex" Publisher="CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B" Version="${version}" ProcessorArchitecture="arm64" ResourceId=""/><Applications><Application Id="App" Executable="app\\ChatGPT.exe" EntryPoint="Windows.FullTrustApplication"/></Applications></Package>\n`;
}

function manifestVersion(file) {
  const match = fs.readFileSync(file, "utf8").match(/\bVersion="([^"]+)"/);
  assert.ok(match);
  return match[1];
}

function stageScratchDirectories() {
  return fs.readdirSync(scratch).filter(name => name.startsWith("mechanics-toolkit-msix-"));
}

function ok(value) {
  return {status: 0, stdout: `${JSON.stringify(value)}\n`, stderr: "", error: null};
}

function run(program, arguments_) {
  const result = spawnSync(program, arguments_, {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}
