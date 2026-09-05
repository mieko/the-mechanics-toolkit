#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/outgoing-message-receipt.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-outgoing-receipt-test-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(assets, { recursive: true });
  const initialTarget = path.join(assets, "app-initial-fixture.js");
  const ownerTarget = path.join(assets, "app-control-fixture.js");
  const activityTarget = path.join(assets, "activity-fixture.js");
  const formatterTarget = path.join(assets, "message-fixture.js");
  const consumerTarget = path.join(assets, "message-consumer-fixture.js");
  const styleTarget = path.join(assets, "styles-fixture.css");
  fs.writeFileSync(initialTarget, initialFixture());
  fs.writeFileSync(ownerTarget, ownerFixture());
  fs.writeFileSync(activityTarget, activityFixture());
  fs.writeFileSync(formatterTarget, formatterFixture());
  fs.writeFileSync(consumerTarget, consumerFixture());
  fs.writeFileSync(styleTarget, styleFixture());

  assert.equal(runToolkit("check").state, "needs-apply");
  const applied = runToolkit("apply");
  assert.equal(applied.state, "applied");
  assert.equal(applied.target, "webview/assets/app-control-fixture.js");
  assert.equal(applied.collapseOwner, "webview/assets/activity-fixture.js");
  assert.equal(applied.formatterOwner, "webview/assets/message-fixture.js");
  const once = fs.readFileSync(ownerTarget);

  const probe = spawnSync(process.execPath, [behavioralProbe, extracted], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(ownerTarget), once, "second application is byte-identical");
  assert.deepEqual(fs.readFileSync(initialTarget), Buffer.from(initialFixture()), "task and hover owner stays untouched");
  assert.deepEqual(fs.readFileSync(activityTarget), Buffer.from(activityFixture()), "collapsed-activity owner stays untouched");
  assert.deepEqual(fs.readFileSync(formatterTarget), Buffer.from(formatterFixture()), "message formatter owner stays untouched");
  assert.deepEqual(fs.readFileSync(consumerTarget), Buffer.from(consumerFixture()), "message formatter consumer stays untouched");
  assert.deepEqual(fs.readFileSync(styleTarget), Buffer.from(styleFixture()), "stylesheet stays untouched");

  const registry = spawnSync(process.execPath, [toolkit, "patch", "renderer-patch-registry", "apply", extracted], { encoding: "utf8" });
  assert.equal(registry.status, 0, registry.stderr || registry.stdout);
  assert.deepEqual(JSON.parse(registry.stdout).packages, ["outgoingMessageReceipt"], "registry discovers the applied receipt");
  const registryProbe = spawnSync(process.execPath, [path.join(repository, "test/renderer-patch-registry.test.mjs"), extracted], { encoding: "utf8" });
  assert.equal(registryProbe.status, 0, registryProbe.stderr || registryProbe.stdout);
  process.stdout.write("outgoing message receipt transform probe passed\n");

  function runToolkit(action) {
    const result = spawnSync(process.execPath, [toolkit, "patch", "outgoing-message-receipt", action, extracted], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function initialFixture() {
  return [
    "const x=0,Q=Symbol(`scope`);",
    "function hb(e){return e}",
    "function ZP(e){return `local:${e}`}",
    "function QP(e){return `remote:${e}`}",
    "const zy=(...e)=>e,XU=zy(Q,0),Delay=800,J={jsx(){}};",
    "function Oks(){}",
    "function Hover(e){return e}",
    "const preview=(0,J.jsx)(Hover,{align:`center`,closeOnTriggerBlur:!1,delayDuration:Delay,children:0,interactive:!0,skipDelayKey:`diff-preview`,tooltipContent:0,variant:`unstyled`});",
    "export{x as x,hb as h,Q as q,XU as task,ZP as local,QP as remote,Hover as hover};"
  ].join("");
}

function ownerFixture() {
  return [
    'import{x as P}from"./app-initial-fixture.js";',
    "const x=0,N=0,I=0,Send=0,Z={jsx(){},jsxs(){}};",
    "function CFG(e){return e}",
    "function PC(e){return CFG(e)?.persistentInCollapsedConversation===!0}",
    "function r(e){return e}",
    "const ae={dispatchHostMessage(){}},Ee=()=>!1,A=e=>`/new/${e}`,p=e=>`/local/${e}`;",
    "function X(e,t,n,u=!0){let l=e.threadId;",
    "if(e.tool===`send_message_to_thread`){let e=r(l);ae.dispatchHostMessage({type:`navigate-to-route`,path:Ee()?A(e):p(e)})}",
    "switch(e.tool){case Send:return e.completed?`threadsSendMessageCompleted`:`threadsSendMessageActive`}",
    "return null}",
    "const registry={namespace:N,render:X,renderAgentActivityIcon:I,tool:Send};",
    "const label=`localConversation.appControlToolCall.threadsSendMessage.active`;",
    "export{x as x,PC as persistent};"
  ].join("");
}

function activityFixture() {
  return [
    'import{x as x,persistent as L}from"./app-control-fixture.js";',
    "const keepMcpAppEntriesPersistent=true,J={jsx(){}},K=()=>null;",
    "function render(x,i){if(i.type===`dynamic-tool-call`&&L(i))return i;let o=x!=null&&x.isCollapsed?x.persistentUnits:[],F=o.length===0?null:(0,J.jsx)(K,{units:o}),view={children:[F]};return view}",
    "export const fixture=true;"
  ].join("");
}

function formatterFixture() {
  return [
    "const x=0,C={c(){return null}},style=`whitespace-pre-wrap`;",
    "function Fmt(e){let t=(0,C.c)(24),{text:a,ref:b,className:c,components:d,directives:f,externalLinkContextMenuConversationId:g,markdownClassName:h,cwd:i,hostId:j,pluginMentionPresentation:k,variant:l}=e;return t}",
    "export{x as x,Fmt as formatted};"
  ].join("");
}

function consumerFixture() {
  return [
    'import{formatted as FM}from"./message-fixture.js";',
    "const J={jsx(){}},o=null,d=null,i=null,h=null,m=`message`,collapsedLineCount=1;",
    "const rendered=(0,J.jsx)(FM,{cwd:o,directives:d,externalLinkContextMenuConversationId:i,hostId:h,text:m,variant:`user-message`});",
    "export const fixture=true;"
  ].join("");
}

function styleFixture() {
  return "bg-surface-secondary\\/40 border-border\\/70 text-text-tertiary\\/90 focus-visible\\:ring-ring";
}
