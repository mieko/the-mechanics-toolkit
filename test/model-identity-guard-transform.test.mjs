#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const probe = path.join(repository, "test/model-identity-guard.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-model-guard-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(assets, {recursive: true});
  const palette = path.join(assets, "app-initial-fixture.js");
  const owner = path.join(assets, "app-primary-fixture.js");
  fs.writeFileSync(palette, paletteFixture(false));
  fs.writeFileSync(owner, ownerFixture());

  assert.equal(run("check").state, "needs-apply");
  const refused = raw("apply");
  assert.notEqual(refused.status, 0, "guard refuses a palette without the exact pin bridge");
  assert.match(refused.stderr, /requires the current task-visual-palette patch first/);

  fs.writeFileSync(palette, paletteFixture(true));
  assert.equal(run("apply").state, "applied");
  const once = fs.readFileSync(owner);
  const behavior = spawnSync(process.execPath, [probe, extracted], {encoding: "utf8"});
  assert.equal(behavior.status, 0, behavior.stderr || behavior.stdout);
  assert.equal(run("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(owner), once, "second application is byte-identical");
  process.stdout.write("model identity guard transform probe passed\n");

  function raw(action) {
    return spawnSync(process.execPath, [toolkit, "patch", "model-identity-guard", action, extracted], {encoding: "utf8"});
  }
  function run(action) {
    const result = raw(action);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function paletteFixture(withBridge) {
  return [
    'const MTKpaletteRelativePath=".codex/task-visual-palette.json";',
    withBridge ? 'function MTKmodelPinForTask(){}function MTKmodelPinSubscribe(){}globalThis.__MTKmodelPinForTask=MTKmodelPinForTask;globalThis.__MTKmodelPinSubscribe=MTKmodelPinSubscribe;' : '',
    'export const fixture=true;'
  ].join("");
}

function ownerFixture() {
  return [
    'const S7={useEffect:e=>e()},aor=e=>e;',
    'const selector={"data-codex-intelligence-trigger":true};',
    'function _Lr(e){let t=(0,DLr.c)(231),r=e.conversationId,U=e.model,I={reasoningEffort:e.reasoningEffort},Me=[],Ie=aor(I.reasoningEffort,Me),Le=true;return{t,r,U,I,Ie,Le}}',
    'export{_Lr};'
  ].join("");
}
