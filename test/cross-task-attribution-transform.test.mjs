#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/cross-task-attribution.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-attribution-test-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(assets, { recursive: true });
  const initialTarget = path.join(assets, "app-initial-fixture.js");
  const primaryTarget = path.join(assets, "app-primary-fixture.js");
  const ownerTarget = path.join(assets, "conversation-blocks-fixture.js");
  fs.writeFileSync(initialTarget, initialFixture());
  fs.writeFileSync(primaryTarget, primaryFixture());
  fs.writeFileSync(ownerTarget, ownerFixture());

  assert.equal(runToolkit("check").state, "needs-apply");
  const applied = runToolkit("apply");
  assert.equal(applied.state, "applied");
  assert.deepEqual(applied.targets, ["webview/assets/conversation-blocks-fixture.js"]);
  const once = fs.readFileSync(ownerTarget);

  const probe = spawnSync(process.execPath, [behavioralProbe, extracted], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply").state, "applied");
  assert.deepEqual(fs.readFileSync(ownerTarget), once, "second application is byte-identical");
  assert.deepEqual(fs.readFileSync(initialTarget), Buffer.from(initialFixture()), "metadata owner stays untouched");
  assert.deepEqual(fs.readFileSync(primaryTarget), Buffer.from(primaryFixture()), "secondary metadata owner stays untouched");
  process.stdout.write("cross-task attribution transform probe passed\n");

  function runToolkit(action) {
    const result = spawnSync(process.execPath, [toolkit, "patch", "cross-task-attribution", action, extracted], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function initialFixture() {
  return [
    "const x=0,Q=Symbol(`scope`),EI=Symbol(`title`);",
    "function hb(e){return e}",
    "export{x as x,hb as h,Q as q,EI as title};"
  ].join("");
}

function primaryFixture() {
  return [
    'import{title as ap}from"./app-initial-fixture.js";',
    "export const fixture=true;"
  ].join("");
}

function ownerFixture() {
  return [
    'import{fixture as P}from"./app-primary-fixture.js";',
    'import{h as H,q as S}from"./app-initial-fixture.js";',
    "const stock={defaultMessage:`Sent by {appName} from another task`};",
    "function Cb(e){let t=(0,wb.c)(13),{conversationId:n,sourceThreadId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c}=e,l,p,f,m,h,d=go()?`/hotkey-window/thread/${r}`:`/local/${r}`;",
    "t[1]!==f?(p=(0,Tb.jsx)(Fmt,{id:`localConversation.codexDelegationUserMessage.app`}),t[1]=p):p=t[1];",
    "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m?(h=(0,Tb.jsx)(vb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[12]=h):h=t[12];return h}",
    "function vb(e){let t=(0,yb.c)(16),{label:n,conversationId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c,onLabelClick:l}=e,f=true,u=c,m,p;",
    "m=f?(0,bb.jsx)(Eg,{message:i,sentAtMs:a,collapsedLineCount:xb,compactActions:u,cwd:o,hostId:s,threadId:r}):null;",
    "t[5]!==u||t[6]!==r||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==f?(p=m,t[5]=u,t[6]=r,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=f,t[12]=m):p=t[12];return p}",
    "function Eg(e){let t=(0,Og.c)(127),{message:A,cwd:E,hostId:D}=e,de,oe,_e,ve;if(t[42]!==de||t[43]!==oe||t[44]!==_e){",
    "ve=(0,Z.jsx)(`div`,{\"data-user-message-bubble\":!0,className:`max-w-full`}),t[42]=de,t[43]=oe,t[44]=_e,t[45]=ve}return ve}",
    "export const fixture=true;"
  ].join("");
}
