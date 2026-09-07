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
  const mainDirectory = path.join(extracted, ".vite/build");
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(mainDirectory, { recursive: true });
  const initialTarget = path.join(assets, "app-initial-fixture.js");
  const ownerTarget = path.join(assets, "app-control-fixture.js");
  const conversationTarget = path.join(assets, "conversation-fixture.js");
  const activityTarget = path.join(assets, "activity-fixture.js");
  const formatterTarget = path.join(assets, "message-fixture.js");
  const consumerTarget = path.join(assets, "message-consumer-fixture.js");
  const styleTarget = path.join(assets, "styles-fixture.css");
  const mainTarget = path.join(mainDirectory, "main-fixture.js");
  fs.writeFileSync(initialTarget, initialFixture());
  fs.writeFileSync(ownerTarget, ownerFixture());
  fs.writeFileSync(conversationTarget, conversationFixture());
  fs.writeFileSync(activityTarget, activityFixture());
  fs.writeFileSync(formatterTarget, formatterFixture());
  fs.writeFileSync(consumerTarget, consumerFixture());
  fs.writeFileSync(styleTarget, styleFixture());
  fs.writeFileSync(mainTarget, mainFixture());

  assert.equal(runToolkit("check").state, "needs-apply");
  const applied = runToolkit("apply");
  assert.equal(applied.state, "applied");
  assert.deepEqual(applied.targets, [
    "webview/assets/app-control-fixture.js",
    "webview/assets/conversation-fixture.js",
    ".vite/build/main-fixture.js"
  ]);
  assert.equal(applied.collapseOwner, "webview/assets/activity-fixture.js");
  assert.equal(applied.formatterOwner, "webview/assets/message-fixture.js");
  const once = fs.readFileSync(ownerTarget);
  const conversationOnce = fs.readFileSync(conversationTarget);
  const mainOnce = fs.readFileSync(mainTarget);

  const probe = spawnSync(process.execPath, [behavioralProbe, extracted], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(ownerTarget), once, "second application is byte-identical");
  assert.deepEqual(fs.readFileSync(conversationTarget), conversationOnce, "second conversation application is byte-identical");
  assert.deepEqual(fs.readFileSync(mainTarget), mainOnce, "second main application is byte-identical");
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
    "const U={subscribe(){return()=>{}},dispatchMessage(){}};",
    "function hb(e){return e}",
    "function ZP(e){return `local:${e}`}",
    "function QP(e){return `remote:${e}`}",
    "const zy=(...e)=>e,XU=zy(Q,0),Delay=800,J={jsx(){}};",
    "function Oks(){}",
    "function Hover(e){return e}",
    "const preview=(0,J.jsx)(Hover,{align:`center`,closeOnTriggerBlur:!1,delayDuration:Delay,children:0,interactive:!0,skipDelayKey:`diff-preview`,tooltipContent:0,variant:`unstyled`});",
    "export{x as x,hb as h,Q as q,XU as task,ZP as local,QP as remote,Hover as hover,U as bus};"
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

function conversationFixture() {
  return [
    'import{x as x,persistent as rh}from"./app-control-fixture.js";',
    'import{bus as HostBus}from"./app-initial-fixture.js";',
    "const Jy={useState(e){return[typeof e===`function`?e():e,()=>{}]},useEffect(){}},Yy={jsx(){return{}},jsxs(){return{}}},Compiler={c(){return[]}};",
    "function Ub(e){let t=(0,Compiler.c)(16),{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s}=e,c=a===void 0||a,l=s===void 0?`row`:s,u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l?(u=rh(o)?.render(o,l,i,c),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=u):u=t[4];let d=u;if(d!=null)return d;if(l===`row`&&i!==void 0){let e;return e}let f;return f}",
    "function Oy(e){let t=(0,Compiler.c)(195),{turnId:o,conversationId:p}=e,Ze=null,Qe=!1,ft,Rr=()=>null;return ft=Qe?(0,Yy.jsx)(`div`,{className:`flex w-full items-center justify-center pt-8`,children:(0,Yy.jsx)(Rr,{className:`icon-sm`})}):(0,Yy.jsxs)(Yy.Fragment,{children:[Ze,null]}),ft}",
    "function YT(e){let t=(0,Compiler.c)(349),{item:n,conversationId:d,turnId:S,enableTimelineTargets:xe}=e,Ne=null;switch(n.type){case`dynamic-tool-call`:{let e;return t[332]!==Ne||t[333]!==d||t[334]!==xe||t[335]!==n?(e=(0,Yy.jsx)(Ub,{agentActivityIcon:Ne,conversationId:d,enableTimelineTargets:xe,item:n}),t[332]=Ne,t[333]=d,t[334]=xe,t[335]=n,t[336]=e):e=t[336]}}}",
    "const toolActivityTurnKey=true;export{YT};"
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

function mainFixture() {
  return [
    "const l={app:{getPath(){return `/tmp/user-data`},whenReady(){return Promise.resolve()}}};",
    "const i={i(){return{}}};",
    "var mQ=i.i(`electron-message-handler`);",
    "async function ready(){await l.app.whenReady()}",
    "class Handler{handle(e,t){switch(t.type){case`electron-add-new-workspace-root-option`:break}}}",
    "export{Handler};"
  ].join("");
}
