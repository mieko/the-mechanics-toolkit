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

  fs.writeFileSync(app, upstreamAppFixture().replace("thread/turns/list", "thread/turns/missing"));
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
