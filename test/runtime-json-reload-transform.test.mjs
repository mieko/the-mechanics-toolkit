#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/runtime-json-reload.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-json-reload-test-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  const mainDirectory = path.join(extracted, ".vite/build");
  const workspace = path.join(scratch, 'workspace "quoted"');
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(mainDirectory, { recursive: true });
  fs.mkdirSync(path.join(workspace, ".codex"), { recursive: true });
  const renderer = path.join(assets, "app-initial-fixture.js");
  const main = path.join(mainDirectory, "main-fixture.js");
  const config = path.join(scratch, "toolkit.json");
  fs.writeFileSync(renderer, rendererFixture());
  fs.writeFileSync(main, mainFixture());
  fs.writeFileSync(config, `${JSON.stringify({ workspaceRoot: workspace }, null, 2)}\n`);

  assert.equal(runToolkit("check", false).state, "needs-apply");
  const withoutConfig = spawnSync(
    process.execPath,
    [toolkit, "patch", "runtime-json-reload", "apply", extracted],
    { encoding: "utf8" }
  );
  assert.notEqual(withoutConfig.status, 0, "apply refuses an implicit runtime JSON owner");
  assert.match(withoutConfig.stderr, /requires --config/);

  const applied = runToolkit("apply");
  assert.equal(applied.state, "applied");
  assert.deepEqual(applied.files, ["task-attention-policy.json", "task-visual-palette.json"]);
  assert.deepEqual(applied.targets, [
    ".vite/build/main-fixture.js",
    "webview/assets/app-initial-fixture.js"
  ]);
  assert.ok(fs.readFileSync(renderer, "utf8").includes(`workspaceRoot:${JSON.stringify(workspace)}`));
  assert.ok(fs.readFileSync(main, "utf8").includes(`MTKruntimeJsonRoot=${JSON.stringify(workspace)}`));

  const once = [fs.readFileSync(renderer), fs.readFileSync(main)];
  const probe = spawnSync(process.execPath, [behavioralProbe, extracted], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(renderer), once[0], "renderer second application is byte-identical");
  assert.deepEqual(fs.readFileSync(main), once[1], "main second application is byte-identical");
  process.stdout.write("runtime JSON reload transform probe passed\n");

  function runToolkit(action, withConfig = true) {
    const args = [toolkit, "patch", "runtime-json-reload", action, extracted];
    if (withConfig) args.push("--config", config);
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function rendererFixture() {
  return [
    "var H={getInstance(){return null}},U,y=e=>e;",
    "U=H.getInstance(),y((e,t)=>{U.dispatchMessage(e,t)});",
    "export{U as hostBus};"
  ].join("");
}

function mainFixture() {
  return [
    "var i={i(){return()=>({})}};var mQ=i.i(`electron-message-handler`);",
    "class App{async handleMessage(e,t){switch(t.type){",
    "case`show-plan-summary`:break;case`update-diff-if-open`:break;case`electron-add-new-workspace-root-option`:break;",
    "}}}",
    "export{App};"
  ].join("");
}
