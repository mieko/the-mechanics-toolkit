#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-history-drain-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(assets, { recursive: true });
  const target = path.join(assets, "app-initial-fixture.js");
  fs.writeFileSync(target, historicalFixture());

  assert.equal(run("check").state, "needs-apply");
  assert.equal(run("apply").state, "applied");
  const once = fs.readFileSync(target);
  const make = Function(`${once.toString("utf8")};return makeHistoryRuntime`)();
  const backend = { supportsPaginatedThreadHistory: () => true };
  assert.equal(make("scope", "local", backend)(), true,
    "local resume trusts the authoritative pagination capability");
  assert.equal(make("scope", "remote", backend)(), "legacy:scope:true",
    "remote resume retains the stock policy decision");
  assert.equal(make("scope", "local", backend, { supportsPaginatedThreadHistory: () => false })(), false,
    "an explicit local capability owner wins over the backend fallback");

  assert.equal(run("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(target), once, "second application is byte-identical");

  fs.writeFileSync(target, stockFixture());
  const stockBefore = fs.readFileSync(target);
  assert.equal(run("check").state, "upstream-owned");
  assert.equal(run("apply").state, "upstream-owned");
  assert.deepEqual(fs.readFileSync(target), stockBefore, "upstream-owned apply is read-only");

  fs.writeFileSync(target, stockFixture().replace('const endpoint="thread/turns/list";', ""));
  const partial = spawnSync(process.execPath, [toolkit, "patch", "full-history-drain-suppression",
    "check", extracted], { encoding: "utf8" });
  assert.notEqual(partial.status, 0, "partial stock ownership fails closed");
  assert.match(partial.stderr, /complete and 1 partial stock pagination owners/);

  process.stdout.write("full-history drain suppression transform probe passed\n");

  function run(action) {
    const result = spawnSync(process.execPath,
      [toolkit, "patch", "full-history-drain-suppression", action, extracted], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function historicalFixture() {
  return [
    'const LOCAL="local";',
    'function legacyPolicy(scope,capability){return `legacy:${scope}:${capability()}`}',
    'function makeHistoryRuntime(scope,host,backend,{useTailHydration:tail=true,',
    'suppressResumeHistoryDrain:suppress=()=>legacyPolicy(scope,support??(()=>backend.supportsPaginatedThreadHistory())),',
    'supportsPaginatedThreadHistory:support}={}){let local=host===LOCAL,unused=tail;return suppress}',
    'function loadRemainingConversationTurns(){}function loadOlderConversationHistoryPage(){}',
    'const request={initialTurnsPage:{limit:5}};'
  ].join("");
}

function stockFixture() {
  return [
    'const modeOwner={params:{usePaginatedThreadHistory:()=>true},',
    'getRequestedThreadHistoryMode(e){return e==="default"&&this.params.usePaginatedThreadHistory?.()===!0?`paginated`:`legacy`}};',
    'function runtime(a,b,c,{useTailHydration:u,suppressResumeHistoryDrain:s,',
    'supportsPaginatedThreadHistory:p}={}){let ready=true;return {runtimeSettings:{',
    'suppressResumeHistoryDrain:s,supportsPaginatedThreadHistory:p,ready}}}',
    'const r={suppressResumeHistoryDrain:()=>true},t={olderCursor:null};',
    'if(!r.suppressResumeHistoryDrain()&&t?.olderCursor!=null)throw new Error("drain");',
    'function loadOlderConversationHistoryPage(){}',
    'const request={initialTurnsPage:{limit:5,itemsView:`full`,sortDirection:`desc`}};',
    'const endpoint="thread/turns/list";'
  ].join("");
}
