#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/renderer-patch-registry.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-registry-test-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(assets, { recursive: true });
  const appTarget = path.join(assets, "app-initial-fixture.js");
  const lazyTarget = path.join(assets, "conversation-blocks-fixture.js");
  fs.writeFileSync(appTarget, appFixture());
  fs.writeFileSync(lazyTarget, lazyFixture());

  assert.equal(runToolkit("check").state, "needs-apply");
  const applied = runToolkit("apply");
  assert.equal(applied.state, "applied");
  assert.deepEqual(applied.packages, [
    "crossTaskAttribution",
    "sidebarActionCollapse",
    "taskAttentionPolicy",
    "taskVisualPalette",
    "terminalToggle"
  ]);
  assert.deepEqual(applied.targets, [
    "webview/assets/app-initial-fixture.js",
    "webview/assets/conversation-blocks-fixture.js"
  ]);
  const appOnce = fs.readFileSync(appTarget);
  const lazyOnce = fs.readFileSync(lazyTarget);

  const probe = spawnSync(process.execPath, [behavioralProbe, extracted], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(appTarget), appOnce, "app owner is byte-identical after second application");
  assert.deepEqual(fs.readFileSync(lazyTarget), lazyOnce, "lazy owner is byte-identical after second application");

  const bare = path.join(scratch, "bare");
  const bareAssets = path.join(bare, "webview/assets");
  fs.mkdirSync(bareAssets, { recursive: true });
  fs.writeFileSync(path.join(bareAssets, "app-initial-fixture.js"), "export const fixture=true;");
  const bareApply = spawnSync(process.execPath, [toolkit, "patch", "renderer-patch-registry", "apply", bare], { encoding: "utf8" });
  assert.equal(bareApply.status, 0, bareApply.stderr || bareApply.stdout);
  assert.deepEqual(JSON.parse(bareApply.stdout).packages, [], "registry does not require a behavior patch");
  const bareProbe = spawnSync(process.execPath, [behavioralProbe, bare], { encoding: "utf8" });
  assert.equal(bareProbe.status, 0, bareProbe.stderr || bareProbe.stdout);
  process.stdout.write("renderer patch registry transform probe passed\n");

  function runToolkit(action) {
    const result = spawnSync(process.execPath, [toolkit, "patch", "renderer-patch-registry", action, extracted], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function appFixture() {
  return [
    "let MTKsidebarPalette={rules:[]};",
    "function MTKmatchPalette(e,t,n){return e?.rules.find(e=>e.pattern?.test?.(t)||e.pattern?.test?.(n))??null}",
    "function MTKusePaletteBootstrap(){}",
    "function MTKsidebarActionDisclosure7942(){}",
    "function MTKattentionIgnoredThread7942(){}",
    "const terminal={descriptionIntlId:`codex.commandDescription.toggleTerminal`,requiredAccess:`codexLocal`,shortcutScope:`app`,commandMenuGroupKey:`panels`};",
    "export const fixture=true;"
  ].join("");
}

function lazyFixture() {
  return [
    "function MTKsender(){}",
    "const delegated={messageBubbleStyle:MTKdelegatedBubbleStyle};",
    "var MTKdelegatedBubbleStyle={};",
    "export const fixture=true;"
  ].join("");
}
