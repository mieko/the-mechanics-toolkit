#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {sha256File} from "../src/app-bundle.mjs";
import {stageDeb} from "../src/stage-deb.mjs";

if (process.platform !== "linux") {
  process.stdout.write("Linux production DEB staging fixture skipped on this platform\n");
  process.exit(0);
}

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-stage-deb-test-"));
try {
  const source = path.join(scratch, "chatgpt-fixture.deb");
  const destination = path.join(scratch, "chatgpt-fixture-tmtk.deb");
  const config = path.join(scratch, "toolkit.json");
  buildSourceDeb(source);
  fs.writeFileSync(config, `${JSON.stringify({
    enabledPatches: ["safe-start-readiness", "renderer-patch-registry"]
  })}\n`);
  const sourceSha256 = sha256File(source);
  const result = stageDeb({
    sourceDeb: source,
    destinationDeb: destination,
    configPath: config,
    repositoryRoot: repository,
    scratchParent: scratch,
    sourceInspector: authenticatedFixtureSource
  });
  assert.equal(result.state, "staged-deb-static-proof-green");
  assert.deepEqual(result.patches, ["safe-start-readiness", "renderer-patch-registry"]);
  assert.equal(result.source.sha256, sourceSha256);
  assert.equal(sha256File(source), sourceSha256, "production staging leaves its source byte-identical");
  assert.equal(fs.existsSync(destination), true);
  assert.equal(run("/usr/bin/dpkg-deb", ["--field", destination, "Version"]).stdout.trim(),
    "26.908.40834+tmtk1");
  assert.deepEqual(stageScratchDirectories(), [], "successful staging removes its scratch tree");

  const refused = path.join(scratch, "refused.deb");
  const refusedConfig = path.join(scratch, "refused-toolkit.json");
  fs.writeFileSync(refusedConfig, `${JSON.stringify({
    enabledPatches: [
      "full-history-drain-suppression",
      "safe-start-readiness",
      "renderer-patch-registry"
    ]
  })}\n`);
  assert.throws(() => stageDeb({
    sourceDeb: source,
    destinationDeb: refused,
    configPath: refusedConfig,
    repositoryRoot: repository,
    scratchParent: scratch,
    sourceInspector: authenticatedFixtureSource
  }), /full-history-drain-suppression\/patch\.mjs check/);
  assert.equal(fs.existsSync(refused), false);
  assert.deepEqual(stageScratchDirectories(), [], "refusal leaves no staging scratch tree");
  process.stdout.write("Linux production DEB staging fixture passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function buildSourceDeb(destination) {
  const root = path.join(scratch, "source-root");
  const control = path.join(root, "DEBIAN/control");
  const app = path.join(root, "usr/lib/chatgpt");
  const resources = path.join(app, "resources");
  const asarRoot = path.join(scratch, "asar-root");
  fs.mkdirSync(path.dirname(control), {recursive: true});
  fs.mkdirSync(resources, {recursive: true});
  fs.mkdirSync(path.join(asarRoot, ".vite/build"), {recursive: true});
  fs.mkdirSync(path.join(asarRoot, "webview/assets"), {recursive: true});
  fs.mkdirSync(path.join(asarRoot, "node_modules/native"), {recursive: true});
  fs.writeFileSync(control, [
    "Package: chatgpt",
    "Version: 26.908.40834",
    `Architecture: ${process.arch === "arm64" ? "arm64" : "amd64"}`,
    "Maintainer: OpenAI <support@openai.com>",
    "Installed-Size: 1",
    "Description: fixture ChatGPT package",
    ""
  ].join("\n"));
  fs.writeFileSync(path.join(asarRoot, "package.json"), `${JSON.stringify({
    name: "openai-codex-electron",
    desktopName: "chatgpt.desktop",
    version: "26.908.40834",
    codexBuildNumber: "8881"
  })}\n`);
  fs.writeFileSync(path.join(asarRoot, ".vite/build/main-fixture.js"),
    "var Tie=`CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH`;function Aie(){}function owner(e){let{requestDevRelaunch:P=Aie}=e,N=()=>true,r={lt:1},l={ipcMain:{handle(){}}};l.ipcMain.handle(r.lt,async(t,s)=>{if(!N(t))return;if(s.type===`electron-avatar-overlay-restore-ready`)return})}");
  fs.writeFileSync(path.join(asarRoot, "webview/assets/app-initial-fixture.js"),
    "const H={dispatchMessage(){}};function MHs(){H.dispatchMessage(`ready`,{persistedStateResponsePriority:W7?`critical`:void 0})}");
  fs.writeFileSync(path.join(asarRoot, "node_modules/native/addon.node"), "native-fixture");
  fs.writeFileSync(path.join(resources, "linux-package-metadata.json"), `${JSON.stringify({
    codexAppBrand: "chatgpt",
    codexBuildFlavor: "prod",
    version: "26.908.40834"
  })}\n`);
  for (const executable of [path.join(app, "ChatGPT"), path.join(resources, "codex")]) {
    fs.writeFileSync(executable, "#!/bin/sh\nexit 0\n");
    fs.chmodSync(executable, 0o755);
  }
  run(path.join(repository, "node_modules/.bin/asar"), [
    "pack", asarRoot, path.join(resources, "app.asar"), "--unpack-dir", "node_modules/native"
  ]);
  run("/usr/bin/dpkg-deb", ["--root-owner-group", "--build", root, destination]);
  fs.rmSync(root, {recursive: true, force: true});
  fs.rmSync(asarRoot, {recursive: true, force: true});
}

function authenticatedFixtureSource(file) {
  return {
    packageKind: "vendor",
    originSignature: {state: "valid"},
    debSha256: sha256File(file),
    package: "chatgpt",
    packageVersion: "26.908.40834",
    architecture: process.arch === "arm64" ? "arm64" : "amd64"
  };
}

function stageScratchDirectories() {
  return fs.readdirSync(scratch).filter(name => name.startsWith("mechanics-toolkit-deb-"));
}

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}
