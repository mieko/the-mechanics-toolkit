#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/task-supervisor.test.mjs");

for (const profile of ["7746", "7942"]) exercise(profile);
process.stdout.write("task supervisor transform probe passed\n");

function exercise(profile) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `mechanics-toolkit-supervisor-${profile}-`));
  try {
    const assets = path.join(scratch, "extracted/webview/assets");
    fs.mkdirSync(assets, { recursive: true });
    const target = path.join(assets, "app-initial-fixture.js");
    fs.writeFileSync(target, fixture(profile));

    assert.equal(run("check").state, "needs-apply");
    assert.equal(run("apply").state, "applied");
    const once = fs.readFileSync(target);

    const probe = spawnSync(process.execPath, [behavioralProbe, path.join(scratch, "extracted")], {
      encoding: "utf8"
    });
    assert.equal(probe.status, 0, probe.stderr || probe.stdout);

    assert.equal(run("apply").state, "applied");
    assert.deepEqual(fs.readFileSync(target), once, `${profile} second application is byte-identical`);

    fs.writeFileSync(target, fixture(profile).replace(
      "function",
      `const MTKtaskSupervisorConfigName${profile}=\"task-supervision.json\";function`
    ));
    const partial = spawnSync(process.execPath, [toolkit, "patch", "task-supervisor", "check",
      path.join(scratch, "extracted")], { encoding: "utf8" });
    assert.notEqual(partial.status, 0, `${profile} partial ownership fails closed`);

    fs.writeFileSync(target, stockFixture(profile));
    const missingPrerequisites = spawnSync(process.execPath,
      [toolkit, "patch", "task-supervisor", "check", path.join(scratch, "extracted")],
      { encoding: "utf8" });
    assert.notEqual(missingPrerequisites.status, 0, `${profile} refuses a pristine owner`);
    assert.match(missingPrerequisites.stderr, /requires the attention-policy and palette bootstraps/);

    function run(action) {
      const result = spawnSync(process.execPath, [toolkit, "patch", "task-supervisor", action,
        path.join(scratch, "extracted")], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function fixture(profile) {
  if (profile === "7746") {
    return [
      "const Q=Symbol('scope'),Tb=Symbol('ready');",
      "function pb(e){return e}function wb(e,t){return e}",
      "const ZOs={useEffect(){}};",
      "function qOs(){MTKuseAttentionBootstrap7746();MTKusePaletteBootstrap();let e=0;return e}",
      "export const fixture=true;"
    ].join("");
  }
  return [
    "const Q=Symbol('scope'),Db=Symbol('ready');",
    "function hb(e){return e}function Eb(e,t){return e}",
    "const Mks={useEffect(){}};",
    "function Oks(){MTKuseAttentionBootstrap7942();MTKusePaletteBootstrap();let e=0;return e}",
    "export const fixture=true;"
  ].join("");
}

function stockFixture(profile) {
  return profile === "7746"
    ? "function qOs(){let e=0;return e}export const fixture=true;"
    : "function Oks(){let e=0;return e}export const fixture=true;";
}
