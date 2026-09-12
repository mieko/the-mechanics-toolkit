#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const probe = path.join(repository, "test/safe-start-readiness.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-safe-start-patch-test-"));
try {
  const extracted = path.join(scratch, "extracted");
  const build = path.join(extracted, ".vite/build");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(build, {recursive: true});
  fs.mkdirSync(assets, {recursive: true});
  const main = path.join(build, "main-fixture.js");
  const renderer = path.join(assets, "app-initial-fixture.js");
  fs.writeFileSync(main, "var Tie=`CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH`;" +
    "globalThis.__handler=null;function Aie(){globalThis.__marker=process.env[Tie]??null}" +
    "function owner(e){let{requestDevRelaunch:P=Aie}=e,N=()=>true,r={lt:1}," +
    "l={ipcMain:{handle(k,h){globalThis.__handler=h}}};" +
    "l.ipcMain.handle(r.lt,async(t,s)=>{if(!N(t))return;" +
    "if(s.type===`electron-avatar-overlay-restore-ready`)return})}" +
    "owner({});await globalThis.__handler(null,{type:`ready`});" +
    "process.stdout.write(globalThis.__marker??``)");
  fs.writeFileSync(renderer, "const H={dispatchMessage(){}};function MHs(){H.dispatchMessage(`ready`,{persistedStateResponsePriority:W7?`critical`:void 0})}");

  assert.equal(run("check", extracted).state, "needs-apply");
  assert.equal(run("apply", extracted).state, "applied");
  const once = [fs.readFileSync(main), fs.readFileSync(renderer)];
  const behavior = spawnSync(process.execPath, [probe, extracted], {encoding: "utf8"});
  assert.equal(behavior.status, 0, behavior.stderr || behavior.stdout);
  const marker = String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\renderer.ready`;
  const markerArgument = `--tmtk-safe-start-marker=${Buffer.from(marker).toString("base64url")}`;
  const windowsEnvironment = {...process.env, USERPROFILE: String.raw`C:\Users\Mike`};
  delete windowsEnvironment.CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH;
  const windowsReady = spawnSync(process.execPath, [main, markerArgument], {
    encoding: "utf8",
    env: windowsEnvironment
  });
  assert.equal(windowsReady.status, 0, windowsReady.stderr || windowsReady.stdout);
  assert.equal(windowsReady.stdout, marker);
  const outside = String.raw`C:\Users\Mike\Desktop\renderer.ready`;
  const refused = spawnSync(process.execPath, [main,
    `--tmtk-safe-start-marker=${Buffer.from(outside).toString("base64url")}`], {
    encoding: "utf8",
    env: windowsEnvironment
  });
  assert.equal(refused.status, 0, refused.stderr || refused.stdout);
  assert.equal(refused.stdout, "");
  const traversing = String.raw`C:\Users\Mike\.codex\tmtk-rescue\incident\..\..\Desktop\renderer.ready`;
  const traversalRefused = spawnSync(process.execPath, [main,
    `--tmtk-safe-start-marker=${Buffer.from(traversing).toString("base64url")}`], {
    encoding: "utf8",
    env: windowsEnvironment
  });
  assert.equal(traversalRefused.status, 0, traversalRefused.stderr || traversalRefused.stdout);
  assert.equal(traversalRefused.stdout, "");
  assert.equal(run("apply", extracted).state, "applied");
  assert.deepEqual(fs.readFileSync(main), once[0]);
  assert.deepEqual(fs.readFileSync(renderer), once[1]);
  process.stdout.write("safe-start readiness transform probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function run(action, extracted) {
  const result = spawnSync(process.execPath, [toolkit, "patch", "safe-start-readiness", action, extracted], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
