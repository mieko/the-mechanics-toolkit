#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const probe = path.join(repository, "test/renderer-turn-window.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-renderer-window-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(assets, { recursive: true });
  const app = path.join(assets, "app-initial-fixture.js");
  const local = path.join(assets, "local-conversation-thread-fixture.js");
  fs.writeFileSync(app, historicalAppFixture());
  fs.writeFileSync(local, historicalLocalFixture("qCs"));

  assert.equal(run("check").state, "needs-apply");
  assert.equal(run("apply").state, "applied");
  const once = [fs.readFileSync(app), fs.readFileSync(local)];
  const behavior = spawnSync(process.execPath, [probe, extracted], { encoding: "utf8" });
  assert.equal(behavior.status, 0, behavior.stderr || behavior.stdout);
  const evidence = JSON.parse(behavior.stdout);
  assert.equal(evidence.nativeTurnLimit, 1500);
  assert.equal(evidence.longTaskMaterializations, 1500);
  assert.equal(evidence.parentAndCurrentShareLimit, true);
  assert.equal(evidence.transcriptExportScope, "full");

  assert.equal(run("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(app), once[0], "app selector is byte-identical after second application");
  assert.deepEqual(fs.readFileSync(local), once[1], "renderer is byte-identical after second application");

  fs.writeFileSync(app, upstreamAppFixture());
  fs.writeFileSync(local, historicalLocalFixture("gLo"));
  const stockBefore = [fs.readFileSync(app), fs.readFileSync(local)];
  assert.equal(run("check").state, "upstream-owned");
  assert.equal(run("apply").state, "upstream-owned");
  assert.deepEqual(fs.readFileSync(app), stockBefore[0], "upstream-owned selector is read-only");
  assert.deepEqual(fs.readFileSync(local), stockBefore[1], "upstream-owned renderer is read-only");
  const stockProbe = spawnSync(process.execPath, [probe, extracted], { encoding: "utf8" });
  assert.equal(stockProbe.status, 0, stockProbe.stderr || stockProbe.stdout);
  assert.equal(JSON.parse(stockProbe.stdout).ownership, "upstream-paginated-renderer");

  fs.writeFileSync(app, build8881AppFixture());
  fs.writeFileSync(local, build8881LocalFixture("Ipo"));
  assert.equal(run("check").state, "needs-apply", "build 8881 requires a mounted-renderer bound");
  assert.equal(run("apply").state, "applied");
  const build8881Once = [fs.readFileSync(app), fs.readFileSync(local)];
  const build8881Probe = spawnSync(process.execPath, [probe, extracted], { encoding: "utf8" });
  assert.equal(build8881Probe.status, 0, build8881Probe.stderr || build8881Probe.stdout);
  const build8881Evidence = JSON.parse(build8881Probe.stdout);
  assert.equal(build8881Evidence.nativeTurnLimit, 1500);
  assert.equal(build8881Evidence.mountedSelectorCalls, 4);
  assert.equal(build8881Evidence.upstreamTransportPaginationPreserved, true);
  assert.equal(run("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(app), build8881Once[0], "build-8881 selector is byte-identical after second application");
  assert.deepEqual(fs.readFileSync(local), build8881Once[1], "build-8881 renderer is byte-identical after second application");

  fs.writeFileSync(app, upstreamAppFixture().replace("thread/turns/list", "thread/turns/missing"));
  fs.writeFileSync(local, historicalLocalFixture("gLo"));
  const partial = spawnSync(process.execPath,
    [toolkit, "patch", "renderer-turn-window", "check", extracted], { encoding: "utf8" });
  assert.notEqual(partial.status, 0, "partial upstream ownership fails closed");

  process.stdout.write("renderer turn window transform probe passed\n");

  function run(action) {
    const result = spawnSync(process.execPath,
      [toolkit, "patch", "renderer-turn-window", action, extracted], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function historicalAppFixture() {
  return [
    "const Q=Symbol('scope'),gH={},TH={},wH={},kH={},UH={},zH={},zCs=false;",
    "function init(e){return e}function factory(e,t){return t}",
    "function Aqn(e){return [e]}function project(e){return e}function output(e){return e}",
    "var before,qCs,after=init((()=>{qCs=factory(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{",
    "let r=n(gH,e)??!1,i=n(TH,e)??zCs;n(wH,e);let a=t?n(kH,e)??null:null,",
    "o={hostId:n(UH,e),threadId:e},d=n(zH,o),f=d?.flatMap(Aqn),m=null,",
    "h=n(zH,a==null?null:{hostId:n(UH,a),threadId:a}),g=a!=null&&m==null?h?.flatMap(Aqn):null;",
    "return project({conversationRequests:[],visibleTurnEntries:f??[],historyTimeline:g,",
    "turnEntityKeys:d?.map(({entityKey:e})=>e)})});return qCs})());",
    "async function renderMarkdown(client,{conversationId:e,isBackgroundSubagentsEnabled:t,markdownLimit:m}){",
    "let {visibleTurnEntries:v}=client.get(qCs,{conversationId:e,isBackgroundSubagentsEnabled:t});return output(v)}",
    "function loadOlderConversationHistoryPage(){}",
    "const request={initialTurnsPage:{limit:5}},endpoint='thread/turns/list';"
  ].join("");
}

function upstreamAppFixture() {
  return [
    "const Q=Symbol('scope'),II={},zI={};function Iy(e,t){return t}",
    "const gLo=Iy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{",
    "let a=null,o={hostId:n(zI,e),threadId:e},d=n(II,o),f=d?.flatMap(x=>x),m=null,",
    "h=n(II,a==null?null:{hostId:n(zI,a),threadId:a}),g=a!=null&&m==null?h?.flatMap(x=>x):null;",
    "return {visibleTurnEntries:f,historyTimeline:g,turnEntityKeys:d?.map(({entityKey:e})=>e)}});",
    "function loadOlderConversationHistoryPage(){}",
    "const request={initialTurnsPage:{limit:5,itemsView:`full`,sortDirection:`desc`}},",
    "endpoint='thread/turns/list';"
  ].join("");
}

function historicalLocalFixture(selector) {
  return [
    "function use(e,t){return {visibleTurnEntries:[]}}",
    `function localConversation(e,t){let a=use(${selector},{conversationId:e,isBackgroundSubagentsEnabled:t}),`,
    `b=use(${selector},{conversationId:e,isBackgroundSubagentsEnabled:t}),`,
    `c=use(${selector},{conversationId:e,isBackgroundSubagentsEnabled:t}),`,
    `d=use(${selector},{conversationId:e,isBackgroundSubagentsEnabled:t});`,
    "function loadOlderConversationHistoryPage(){}",
    "return {renderEntries:[a,b,c,d],visibleTurnEntries:a.visibleTurnEntries,",
    "searchPersisted:true,getConversationState:()=>a}}"
  ].join("");
}

function build8881AppFixture() {
  return [
    "const Q=Symbol('scope'),Opo=[],kpo=[],Ppo={visibleTurnEntries:[]};",
    "function init(e){return e}function rm(e,t){return t}function gpo(e){return e}",
    "var before,Ipo,after=init((()=>{Ipo=rm(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n,scope:r})=>{",
    "if(e==null)return Ppo;let i=n(VA,e)??!1,a=n(XA,e)??Opo;n(d8n,e);",
    "let o=t?n(ej,e)??null:null,s={hostId:n(sj,e),threadId:e},c=n(Dti,s),l=fpo(c),",
    "u=o==null?null:n(Dti,{hostId:n(sj,o),threadId:o}),d=fpo(u),f=n(EV,s),",
    "p=f?.flatMap(e=>{n(DV,e)?.status,n(OV,e);let i=bti(r,e);if(i==null)return[];i.turnId;",
    "let a=qMn(i,[],{isAeonThread:!1,isBackgroundSubagentsEnabled:t,shouldHideUserMessage:void 0});",
    "if(!a)for(let t of i.items)t!=null&&!a&&n(TV,{...e,itemId:t.id});return[i]})??kpo,",
    "m=l?.length===p.length&&(o==null||d!=null)&&!0,h=m&&o!=null&&l!=null&&c!=null&&d!=null&&u!=null?",
    "ppo({conversationId:e,getTurn:(e,t)=>bti(r,{hostId:n(sj,e),threadId:e,entityKey:t}),historyEntries:l,",
    "historyTimeline:c,parentConversationId:o,parentHistoryEntries:d,parentHistoryTimeline:u}):void 0,",
    "g=n(EV,o==null?null:{hostId:n(sj,o),threadId:o}),_=o!=null&&h==null?g?.flatMap(e=>{",
    "n(DV,e),n(OV,e);let t=bti(r,e);return t==null?[]:[t]})??kpo:kpo;",
    "return gpo({conversationRequests:a,isAeonThread:!1,showPartialHistoryGaps:!1,mergeBerryDisplayTurnsForPIA:!1,",
    "preserveServerUserMessages:!1,conversationTurns:p,hasConversation:i,historyEntriesByTurnIndex:m?l:void 0,",
    "historyTimeline:m?c??void 0:void 0,isBackgroundSubagentsEnabled:t,hideReactionInputs:!1,",
    "inheritedHistoryPositionKeys:h,liveTailHistoryPositionKey:m?n(X8n,e):null,parentConversationTurns:_,",
    "subagentParentThreadId:o,turnEntityKeys:f?.map(({entityKey:e})=>e)})});return Ipo})());",
    "async function zpo(e,{conversationId:t,isBackgroundSubagentsEnabled:n,markdownLimit:r}){",
    "let{visibleTurnEntries:i}=e.get(Ipo,{conversationId:t,isBackgroundSubagentsEnabled:n});return output(i)}",
    "function loadOlderConversationHistoryPage(){}",
    "const request={initialTurnsPage:{limit:5,itemsView:`full`,sortDirection:`desc`}},endpoint='thread/turns/list';"
  ].join("");
}

function build8881LocalFixture(selector) {
  return [
    "function localConversation(e,l){let G={get(){return {visibleTurnEntries:[]}}},Y=(...e)=>e;",
    `let callback=()=>{let{visibleTurnEntries:t}=G.get(${selector},{conversationId:e,isBackgroundSubagentsEnabled:l})};`,
    `let{generatedImageTurnEntries:ae,renderEntries:ue,visibleTurnEntries:fe}=Y(${selector},{conversationId:e,isBackgroundSubagentsEnabled:l});`,
    `let state=G.get(${selector},{conversationId:e,isBackgroundSubagentsEnabled:l});`,
    `let reveal=G.get(${selector},{conversationId:e,isBackgroundSubagentsEnabled:l});`,
    "function loadOlderConversationHistoryPage(){}",
    "return {renderEntries:ue,visibleTurnEntries:fe,searchPersisted:true,getConversationState:()=>state,reveal}}"
  ].join("");
}
