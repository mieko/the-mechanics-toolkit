#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/tinrelay-presentation.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-tinrelay-test-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  const build = path.join(extracted, ".vite/build");
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(build, { recursive: true });
  const initialTarget = path.join(assets, "app-initial-fixture.js");
  const rendererTarget = path.join(assets, "conversation-blocks-fixture.js");
  const activityTarget = path.join(assets, "agent-activity-item-fixture.js");
  const mainTarget = path.join(build, "main-fixture.js");
  const config = path.join(scratch, "toolkit.json");
  fs.writeFileSync(initialTarget, initialFixture());
  fs.writeFileSync(rendererTarget, rendererFixture());
  fs.writeFileSync(activityTarget, activityFixture());
  fs.writeFileSync(mainTarget, mainFixture());
  fs.writeFileSync(config, JSON.stringify({
    workspaceRoot: "/srv/example-workspace",
    tinrelay: {client: "/opt/tinrelay/bin/tinrelay", localShip: "sample-ship"}
  }));

  assert.equal(runToolkit("check").state, "needs-apply");
  const runtimeApplied = runPatch("runtime-json-reload", "apply", true);
  assert.equal(runtimeApplied.state, "applied", "the earlier runtime watcher owns the shared main-process seam first");
  const initialAfterRuntime = fs.readFileSync(initialTarget);
  assert.equal(runToolkit("check").state, "needs-apply", "Tinrelay remains applicable after runtime watcher composition");
  const missingConfig = spawnSync(process.execPath, [toolkit, "patch", "tinrelay-pointer-presentation", "apply", extracted], { encoding: "utf8" });
  assert.notEqual(missingConfig.status, 0);
  assert.match(missingConfig.stderr, /requires --config/);
  for (const [label, tinrelay, expected] of [
    ["relative client", {client: "bin/tinrelay", localShip: "sample-ship"}, /absolute non-root path/],
    ["invalid ship", {client: "/opt/tinrelay/bin/tinrelay", localShip: "Sample Ship"}, /lowercase DNS-style ship name/]
  ]) {
    fs.writeFileSync(config, JSON.stringify({tinrelay}));
    const rejected = spawnSync(
      process.execPath,
      [toolkit, "patch", "tinrelay-pointer-presentation", "apply", extracted, "--config", config],
      { encoding: "utf8" }
    );
    assert.notEqual(rejected.status, 0, label);
    assert.match(rejected.stderr, expected, label);
  }
  fs.writeFileSync(config, JSON.stringify({
    workspaceRoot: "/srv/example-workspace",
    tinrelay: {client: "/opt/tinrelay/bin/tinrelay", localShip: "sample-ship"}
  }));

  const applied = runToolkit("apply", true);
  assert.equal(applied.state, "applied");
  assert.equal(applied.client, "/opt/tinrelay/bin/tinrelay");
  assert.equal(applied.localShip, "sample-ship");
  const rendererOnce = fs.readFileSync(rendererTarget);
  const activityOnce = fs.readFileSync(activityTarget);
  const mainOnce = fs.readFileSync(mainTarget);

  const probe = spawnSync(process.execPath, [behavioralProbe, extracted], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply").state, "applied", "an applied tree needs no config to verify");
  assert.deepEqual(fs.readFileSync(rendererTarget), rendererOnce, "renderer is byte-identical after second application");
  assert.deepEqual(fs.readFileSync(activityTarget), activityOnce, "activity classifier is byte-identical after second application");
  assert.deepEqual(fs.readFileSync(mainTarget), mainOnce, "main process is byte-identical after second application");
  assert.deepEqual(fs.readFileSync(initialTarget), initialAfterRuntime, "Tinrelay leaves the composed host-bus owner untouched");
  process.stdout.write("unified Tinrelay presentation transform probe passed\n");

  function runToolkit(action, withConfig = false) {
    return runPatch("tinrelay-pointer-presentation", action, withConfig);
  }

  function runPatch(name, action, withConfig = false) {
    const args = [toolkit, "patch", name, action, extracted];
    if (withConfig) args.push("--config", config);
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function initialFixture() {
  return [
    "const x=0,H={getInstance(){return U}},y=e=>e;let U={subscribe(){},dispatchMessage(){}};",
    "U=H.getInstance(),y((e,t)=>{U.dispatchMessage(e,t)});",
    "export{x as x,U as host};"
  ].join("");
}

function rendererFixture() {
  return [
    'import{x as X,host as Bus}from"./app-initial-fixture.js";',
    "const e=e=>e,t=e=>e,un=()=>({c(){}}),Hn=()=>null,Mg=()=>null,Y=()=>({jsx(){},jsxs(){}}),Wo=()=>({}),At=(...e)=>e.join(` `),Tb={jsx(){},jsxs(){}},cE=e=>e,rg=e=>e,Ne=!1,Ae=!1;",
    "var yb,bb,xb,Sb=e((()=>{yb=un(),Hn(),Mg(),bb=Y(),xb=2}));",
    "function Eg(e){return e}",
    "function vb(e){let t=(0,yb.c)(16),{label:n,conversationId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c,onLabelClick:l}=e,f=!0,u=c,m,p;",
    "t[2]!==n||t[3]!==l?(p=l?(0,bb.jsx)(`button`,{type:`button`,className:At(`text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description`,`cursor-interaction rounded-md hover:text-default`),onClick:l,children:n}):(0,bb.jsx)(`div`,{className:`text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description`,children:n}),t[2]=n,t[3]=l,t[4]=p):p=t[4];",
    "t[5]!==u?(m=f?(0,bb.jsx)(Eg,{message:i,sentAtMs:a,collapsedLineCount:xb,compactActions:u,cwd:o,hostId:s,threadId:r}):null,t[5]=u):m=t[5];return m}",
    "function Cb(e){let t=(0,yb.c)(13),{conversationId:n,sourceThreadId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c}=e,l,p,m;",
    "m=(0,Tb.jsx)(vb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:null});return m}",
    "function tx(e){return e}",
    "function Render(n){let m=!1,p=`default`,v=`local`,ve=`default`,ye=!0,r=null,R=null,je=!1;switch(n.type){case`exec`:{let e=cE(n);if(!Ne&&Ae&&!e||(n.parsedCmd.type===`read`||n.parsedCmd.type===`search`||n.parsedCmd.type===`list_files`)&&!n.parsedCmd.isFinished&&!e)return null;return(0,Tb.jsx)(tx,{item:n,isTurnInProgress:m,threadDetailLevel:p,hostId:v,summaryTone:ve,showSummaryIcon:ye,summaryIcon:r,hideRawCommand:je,toolActivityTurnKey:R})}}}",
    "function GE(e,{keepMcpAppEntriesPersistent:t=!1,mcpServerStatuses:n,renderMcpApps:r=!1}={}){let i=[],a=[],o=[],s=[],c=null;for(let l of e){if(l.kind===`standalone`&&l.item.item.type===`worked-for`){c=l.item.item;continue}if(l.kind===`standalone`&&l.item.item.type===`realtime-transcript`){a.length===0?s.push(l):(a.push(l),o.push(l));continue}a.push(l),KE({unit:l,keepMcpAppEntriesPersistent:t,mcpServerStatuses:n,renderMcpApps:r})?o.push(l):i.push(l)}return{collapsibleUnits:i,expandedUnits:a,persistentUnits:o,preToggleUnits:s,workedForItem:c}}",
    "function KE({unit:e,keepMcpAppEntriesPersistent:t,mcpServerStatuses:n,renderMcpApps:r}){if(e.kind!==`standalone`)return!1;let i=e.item.item;return i.type===`dynamic-tool-call`&&Zm(i)||t&&r&&i.type===`mcp-tool-call`&&qE({item:i,mcpServerStatuses:n})?!0:i.type===`user-message`&&(i.steeringStatus!=null||i.hookFeedback===!0)}",
    "function qE(){return!1}var JE=0;",
    "export const fixture=true;"
  ].join("");
}

function activityFixture() {
  return [
    "const Je=e=>false,$=(e,t)=>({item:e,grouping:t}),dn=e=>e;",
    "function ln(e){switch(e.type){case`external-event`:return null;case`exec`:case`patch`:return $(dn(e),Je(e)?`standalone`:`groupable`);case`user-message`:return $(e,`standalone`)}}",
    "export{ln};"
  ].join("");
}

function mainFixture() {
  return [
    'let x=require("node:child_process");',
    "const i={i(){return null}};",
    "const l={app:{whenReady(){return Promise.resolve()},getPath(e){return `/app/${e}`}}},L={add(){}},P=()=>{},R=0;",
    "var mQ=i.i(`electron-message-handler`);",
    "async function handler(e,t){switch(t.type){case`show-plan-summary`:break;case`update-diff-if-open`:break;case`electron-add-new-workspace-root-option`:break}}",
    "async function startup(){await l.app.whenReady(),P(`main app.whenReady resolved`,R)}",
    "export const fixture=true;"
  ].join("");
}
