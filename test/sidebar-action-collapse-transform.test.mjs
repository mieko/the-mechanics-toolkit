#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/sidebar-action-collapse.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-sidebar-test-"));

try {
  const assets = path.join(scratch, "webview/assets");
  fs.mkdirSync(assets, { recursive: true });
  const target = path.join(assets, "app-primary-fixture.js");
  fs.writeFileSync(target, fixtureSource());

  assert.equal(runToolkit("check", scratch).state, "needs-apply");
  assert.equal(runToolkit("apply", scratch).state, "applied");
  const once = fs.readFileSync(target);
  assert.equal(runToolkit("check", scratch).state, "applied");

  const probe = spawnSync(process.execPath, [behavioralProbe, scratch], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply", scratch).state, "applied");
  assert.deepEqual(fs.readFileSync(target), once, "second application is byte-identical");
  process.stdout.write("sidebar action collapse transform probe passed\n");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function runToolkit(action, root) {
  const result = spawnSync(
    process.execPath,
    [toolkit, "patch", "sidebar-action-collapse", action, root],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function fixtureSource() {
  return [
    "function dar(e){let t=(0,har.c)(144),Ue=0,{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,placeholder=0;",
    "let Te=ZSn(we),Ee;",
    '(0,N4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,N4.jsx)(Z_n,{}),(0,N4.jsx)(JY,{showCustomizeSidebarAction:Me,children:(0,N4.jsx)(Twn,{})}),!E&&ve===`header_icon`?(0,N4.jsx)(_Tn,{sidebarMode:ce}):null]});',
    '(0,N4.jsx)($wn,{showCustomizeSidebarAction:Me,sidebarMode:ce,showSearchNavItem:!1});',
    "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==ve||t[97]!==ne||t[98]!==Ne||t[99]!==Me||t[100]!==ce?(Ue=1,t[93]=m,t[94]=v,t[95]=E,t[96]=ve,t[97]=ne,t[98]=Ne,t[99]=Me,t[100]=ce,t[101]=Ue):Ue=t[101];",
    "return Ue}",
    "const labels=[",
    "{defaultMessage:`New chat`},{defaultMessage:`Pull requests`},{defaultMessage:`Sites`},",
    "{defaultMessage:`Scheduled`},{defaultMessage:`Plugins`},{defaultMessage:`Projects`}",
    "];",
    "export const fixture=true;"
  ].join("");
}
