#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/wait-thread-roster.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-wait-roster-test-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(assets, {recursive: true});
  const initialTarget = path.join(assets, "app-initial-fixture.js");
  const ownerTarget = path.join(assets, "agent-activity-item-fixture.js");
  fs.writeFileSync(initialTarget, initialFixture());
  fs.writeFileSync(ownerTarget, ownerFixture());

  assert.equal(runToolkit("check").state, "needs-apply");
  const applied = runToolkit("apply");
  assert.equal(applied.state, "applied");
  assert.deepEqual(applied.targets, ["webview/assets/agent-activity-item-fixture.js"]);
  const once = fs.readFileSync(ownerTarget);

  const probe = spawnSync(process.execPath, [behavioralProbe, extracted], {encoding: "utf8"});
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(ownerTarget), once, "second application is byte-identical");

  const legacyCursor = once.toString().replace("cursor-pointer rounded-sm", "rounded-sm");
  assert.notEqual(legacyCursor, once.toString(), "legacy link-cursor fixture differs");
  fs.writeFileSync(ownerTarget, legacyCursor);
  assert.equal(runToolkit("check").state, "legacy-link-cursor");
  assert.equal(runToolkit("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(ownerTarget), once, "legacy links upgrade to pointer cursors");

  const legacySpacing = once.toString()
    .replace("let u=", 'e.completed||l.unshift(" ");let u=')
    .replace('children:o})," ",...l,e.completed?null:"…"]})', 'children:o}),...l,e.completed?null:"…"]})');
  assert.notEqual(legacySpacing, once.toString(), "legacy active-spacing fixture differs");
  fs.writeFileSync(ownerTarget, legacySpacing);
  assert.equal(runToolkit("check").state, "legacy-active-spacing");
  assert.equal(runToolkit("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(ownerTarget), once, "legacy active spacing upgrades to explicit layout spacing");

  assert.deepEqual(fs.readFileSync(initialTarget), Buffer.from(initialFixture()), "task metadata owner stays untouched");
  process.stdout.write("wait-thread roster transform probe passed\n");

  function runToolkit(action) {
    const result = spawnSync(process.execPath, [toolkit, "patch", "wait-thread-roster", action, extracted], {encoding: "utf8"});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function initialFixture() {
  return [
    "const x=0,Q=Symbol(`scope`);",
    "function hb(e){return e}",
    "function ZP(e){return `local:${e}`}",
    "function QP(e){return `remote:${e}`}",
    "const zy=(...e)=>e,XU=zy(Q,0);",
    "function Oks(){}",
    "export{x as x,hb as h,Q as q,XU as task,ZP as local,QP as remote};"
  ].join("");
}

function ownerFixture() {
  return [
    'import{x as P}from"./app-initial-fixture.js";',
    "const L=0,Send=0,X={jsx(){},jsxs(){}},C=`container`,j=`spinner`,ye=`summary`;",
    "const F=(...e)=>e.filter(Boolean).join(` `),J=()=>`tool-icon`,ee=e=>`normalized:${e}`;",
    "const _={dispatchHostMessage(){}},Oe=()=>!1,m=e=>`/new/${e}`,te=e=>`/local/${e}`;",
    "function Kt(e){switch(e.tool){case Send:return e.completed?`threadsSendMessageCompleted`:`threadsSendMessageActive`;case 1:return`threadsReadActive`}}",
    "function Y(e,t,n,r=!0){let i=Kt(e);if(i==null)return null;let a=r?i:i,o=e.tool===`create_thread`&&e.completed&&e.success===!0&&t===`row`?null:null,s=t===`row`&&(e.tool===`read_thread`||e.tool===`send_message_to_thread`)?{success:!1}:null,c=s?.success===!0?s.data.threadId:null,l=t===`row`&&n!==void 0,u=l?`summary-text`:t,d=(0,X.jsxs)(C,{className:F(`text-size-chat`,u===`row`?`text-text-tertiary/90`:`text-text/40 group-hover/activity-header:text-default`),children:[u===`summary-text`?null:J(e),(0,X.jsx)(j,{active:!e.completed,className:F(u!==`summary-text`&&`min-w-0 truncate`,c!=null&&`group-hover:!text-default`),children:i})]}),f=c==null?d:(0,X.jsx)(`button`,{type:`button`,className:`group`,onClick:()=>{let e=ee(c);_.dispatchHostMessage({type:`navigate-to-route`,path:Oe()?m(e):te(e)})},children:d});return l?(0,X.jsx)(ye,{icon:n,summary:f}):f}",
    "const entries=[{namespace:L,render:Y,renderAgentActivityIcon:J,tool:Send}];",
    "const label=`localConversation.appControlToolCall.threadsSendMessage.active`;",
    "export const fixture=true;"
  ].join("");
}
