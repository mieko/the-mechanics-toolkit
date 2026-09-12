#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectAppBundle } from "../src/app-bundle.mjs";
import { asarHeaderSha256 } from "../src/asar-integrity.mjs";
import { patchDefinitions } from "../src/patch-catalog.mjs";

if (process.platform !== "darwin") {
  process.stdout.write("macOS application staging probe skipped on this platform\n");
  process.exit(0);
}

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const asar = path.join(repository, "node_modules/.bin/asar");
const terminalProbe = path.join(repository, "test/terminal-toggle.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-stage-test-"));

try {
  const asarPatches = patchDefinitions.filter(definition => definition.scope === "asar");
  assert.equal(asarPatches.at(-1)?.name, "renderer-patch-registry",
    "renderer registry runs after every ASAR behavior transform");
  const source = path.join(scratch, "Source ChatGPT.app");
  const destination = path.join(scratch, "Staged ChatGPT.app");
  const config = path.join(scratch, "toolkit.json");
  makeSourceApp(source, terminalFixture());
  fs.writeFileSync(config, JSON.stringify({
    enabledPatches: [
      "terminal-toggle",
      "macos-menu-title",
      "safe-start-readiness",
      "renderer-patch-registry"
    ],
    signingIdentity: "-"
  }));
  const sourceBefore = inspectAppBundle(source);

  for (const [label, enabledPatches, expected] of [
    ["unknown patch", ["imaginary-patch"], /Unknown enabled patches/],
    ["duplicate patch", ["terminal-toggle", "terminal-toggle"], /contains duplicates/],
    ["app-only fleet missing renderer registry", ["macos-menu-title"], /must include renderer-patch-registry/],
    ["missing safe-start readiness", ["macos-menu-title", "renderer-patch-registry"], /must include safe-start-readiness/],
    [
      "missing palette dependency",
      ["task-visual-palette", "safe-start-readiness", "renderer-patch-registry"],
      /requires: cross-task-attribution/
    ],
    [
      "missing reasoning dependency",
      ["reasoning-retention", "safe-start-readiness", "renderer-patch-registry"],
      /requires: task-visual-palette/
    ],
    [
      "missing model guard dependency",
      ["model-identity-guard", "safe-start-readiness", "renderer-patch-registry"],
      /requires: task-visual-palette/
    ]
  ]) {
    const rejectedConfig = path.join(scratch, `${label}.json`);
    fs.writeFileSync(rejectedConfig, JSON.stringify({enabledPatches}));
    const rejected = runToolkitRaw([
      "stage",
      source,
      path.join(scratch, `${label}.app`),
      "--config",
      rejectedConfig
    ]);
    assert.notEqual(rejected.status, 0, label);
    assert.match(rejected.stderr, expected, label);
  }

  const invalidSigningConfig = path.join(scratch, "invalid-signing-identity.json");
  fs.writeFileSync(invalidSigningConfig, JSON.stringify({
    enabledPatches: ["macos-menu-title"],
    signingIdentity: ""
  }));
  const invalidSigning = runToolkitRaw([
    "stage",
    source,
    path.join(scratch, "invalid-signing-identity.app"),
    "--config",
    invalidSigningConfig
  ]);
  assert.notEqual(invalidSigning.status, 0);
  assert.match(invalidSigning.stderr, /signingIdentity must be a nonempty string/);

  const result = runToolkit(["stage", source, destination, "--config", config]);
  assert.equal(result.state, "staged-static-proof-green");
  assert.deepEqual(result.patches, [
    "macos-menu-title",
    "terminal-toggle",
    "safe-start-readiness",
    "renderer-patch-registry"
  ]);
  assert.deepEqual(result.changedTargets, [
    ".vite/build/main-fixture.js",
    "Contents/Info.plist",
    "webview/assets/app-initial-fixture.js"
  ]);
  assert.equal(result.secondApplyByteIdentical, true);
  assert.equal(result.probesPassedAfterRepack, true);
  assert.equal(result.signatureValid, true);
  assert.equal(result.asarIntegrityValid, true);
  assert.equal(result.terminalHelperExecutable, true);
  assert.deepEqual(result.nativePackagesPreserved, [
    "@worklouder/device-kit-oai",
    "better-sqlite3",
    "node-pty",
    "objc-js"
  ]);
  assert.equal(result.liveAppTouched, false);
  assert.equal(result.launched, false);

  const sourceAfter = inspectAppBundle(source);
  assert.equal(sourceAfter.archive.sha256, sourceBefore.archive.sha256, "source ASAR stays byte-identical");
  assert.equal(sourceAfter.signature.state, "valid", "source signature stays valid");
  const staged = inspectAppBundle(destination);
  assert.equal(staged.asarIntegrity.state, "valid");
  assert.equal(staged.signature.state, "valid");
  assert.notEqual(staged.archive.sha256, sourceBefore.archive.sha256, "candidate owns the patched ASAR");
  assert.equal(plist(destination, "CFBundleName"), "Codex");
  assert.equal(plist(destination, "CFBundleDisplayName"), "ChatGPT");
  assert.equal(plist(source, "CFBundleName"), "ChatGPT", "source bundle name stays unchanged");

  const verified = path.join(scratch, "verified");
  run(asar, ["extract", staged.archive.path, verified]);
  const probe = spawnSync(process.execPath, [terminalProbe, verified], {encoding: "utf8"});
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  const existing = runToolkitRaw(["stage", source, destination, "--config", config]);
  assert.notEqual(existing.status, 0);
  assert.match(existing.stderr, /destination already exists/);

  const forbidden = runToolkitRaw([
    "stage",
    source,
    "/Applications/Mechanics Toolkit Forbidden.app",
    "--config",
    config
  ]);
  assert.notEqual(forbidden.status, 0);
  assert.match(forbidden.stderr, /must remain outside \/Applications/);

  const applicationsAlias = path.join(scratch, "Applications Alias");
  fs.symlinkSync("/Applications", applicationsAlias);
  const forbiddenAlias = runToolkitRaw([
    "stage",
    source,
    path.join(applicationsAlias, "Mechanics Toolkit Alias Forbidden.app"),
    "--config",
    config
  ]);
  assert.notEqual(forbiddenAlias.status, 0);
  assert.match(forbiddenAlias.stderr, /must remain outside \/Applications/);

  const incompatibleSource = path.join(scratch, "Incompatible ChatGPT.app");
  const failedDestination = path.join(scratch, "Failed Staged ChatGPT.app");
  makeSourceApp(incompatibleSource, "export const fixture=true;");
  const failed = runToolkitRaw(["stage", incompatibleSource, failedDestination, "--config", config]);
  assert.notEqual(failed.status, 0);
  assert.equal(fs.existsSync(failedDestination), false, "a failed new staging destination is removed");

  process.stdout.write("staged application static-proof probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function runToolkit(args) {
  const result = runToolkitRaw(args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function runToolkitRaw(args) {
  return spawnSync(process.execPath, [toolkit, ...args], {encoding: "utf8"});
}

function makeSourceApp(app, rendererSource) {
  const contents = path.join(app, "Contents");
  const resources = path.join(contents, "Resources");
  const sourceTree = path.join(scratch, `source-tree-${path.basename(app)}`);
  const assets = path.join(sourceTree, "webview/assets");
  const build = path.join(sourceTree, ".vite/build");
  const helper = path.join(sourceTree, "node_modules/node-pty/build/Release/spawn-helper");
  fs.mkdirSync(assets, {recursive: true});
  fs.mkdirSync(build, {recursive: true});
  fs.mkdirSync(path.dirname(helper), {recursive: true});
  fs.mkdirSync(path.join(contents, "MacOS"), {recursive: true});
  fs.mkdirSync(resources, {recursive: true});
  fs.writeFileSync(path.join(assets, "app-initial-fixture.js"), rendererSource);
  fs.writeFileSync(path.join(build, "main-fixture.js"),
    "var Tie=`CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH`;" +
    "function Aie(){}function owner(e){let{requestDevRelaunch:P=Aie}=e,N=()=>true,r={lt:1},l={ipcMain:{handle(){}}};" +
    "l.ipcMain.handle(r.lt,async(t,s)=>{if(!N(t))return;if(s.type===`electron-avatar-overlay-restore-ready`)return})}\n");
  fs.writeFileSync(helper, "fixture helper\n", {mode: 0o755});
  const unpackedFixtures = [helper];
  for (const packageName of ["@worklouder/device-kit-oai", "better-sqlite3", "objc-js"]) {
    const nativeFixture = path.join(sourceTree, "node_modules", packageName, "fixture.node");
    fs.mkdirSync(path.dirname(nativeFixture), {recursive: true});
    fs.writeFileSync(nativeFixture, `${packageName} fixture\n`);
    fs.writeFileSync(path.join(sourceTree, "node_modules", packageName, "README.md"), `${packageName} packed fixture\n`);
    unpackedFixtures.push(nativeFixture);
  }
  const executable = path.join(contents, "MacOS/ChatGPT");
  fs.writeFileSync(executable, "#!/bin/sh\nexit 0\n", {mode: 0o755});
  const archive = path.join(resources, "app.asar");
  run(asar, [
    "pack",
    sourceTree,
    archive,
    "--unpack",
    `**/{${unpackedFixtures.map(file => path.relative(sourceTree, file)).join(",")}}`
  ]);
  const externalModeFixture = path.join(`${archive}.unpacked`, path.relative(sourceTree, unpackedFixtures[1]));
  fs.chmodSync(externalModeFixture, 0o755);
  const externalOrphanFixture = path.join(`${archive}.unpacked`, "node_modules/node-pty/build/Release/fixture.node.dSYM/Contents/Info.plist");
  fs.mkdirSync(path.dirname(externalOrphanFixture), {recursive: true});
  fs.writeFileSync(externalOrphanFixture, "external debug metadata\n");
  writeInfo(path.join(contents, "Info.plist"), asarHeaderSha256(archive));
  run("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", app]);
}

function writeInfo(file, hash) {
  fs.writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.openai.codex</string>
  <key>CFBundleExecutable</key><string>ChatGPT</string>
  <key>CFBundleDisplayName</key><string>ChatGPT</string>
  <key>CFBundleName</key><string>ChatGPT</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>26.999.1</string>
  <key>CFBundleVersion</key><string>9999</string>
  <key>ElectronAsarIntegrity</key><dict>
    <key>Resources/app.asar</key><dict>
      <key>algorithm</key><string>SHA256</string>
      <key>hash</key><string>${hash}</string>
    </dict>
  </dict>
</dict></plist>
`);
}

function plist(app, key) {
  const result = spawnSync("/usr/libexec/PlistBuddy", [
    "-c",
    `Print :${key}`,
    path.join(app, "Contents/Info.plist")
  ], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function terminalFixture() {
  return `/*
{id:\`toggleTerminal\`,titleIntlId:\`codex.command.toggleTerminal\`,descriptionIntlId:\`codex.commandDescription.toggleTerminal\`,requiredAccess:\`codexLocal\`,commandMenuGroupKey:\`panels\`,commandMenu:!0,commandMenuFeature:\`codex\`,electron:{menuTitle:\`Open Terminal\`,menuTitleIntlId:\`codex.commandMenuTitle.toggleTerminal\`,
c=n===\`clearAllUnreads\`&&(r===\`Shift+Escape\`||r===\`Shift+Esc\`),l;
accelerators:i,allowRepeat:d,enabled:f,onlyWithin:p,yieldToSelectedText:u
allowWithinEditable:c,enabled:a,onKeyDown:l
pxi=()=>{d1t.run({action:{type:\`windows.terminal.toggle\`,windowId:Ux}})
[\`toggleTerminal\`,pxi]
defaultKeybindings:[{key:"Control+\`"}]
*/
const H={dispatchMessage(){}};function MHs(){H.dispatchMessage(\`ready\`,{persistedStateResponsePriority:W7?\`critical\`:void 0})}
export const fixture = true;
`;
}

function run(program, args) {
  const result = spawnSync(program, args, {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}
