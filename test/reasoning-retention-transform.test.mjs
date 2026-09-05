#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const probe = path.join(repository, "test/reasoning-retention.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-reasoning-transform-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  fs.mkdirSync(assets, {recursive: true});
  const palette = path.join(assets, "app-initial-fixture.js");
  const turn = path.join(assets, "local-conversation-turn-fixture.js");
  const activity = path.join(assets, "subagent-activity-chip-group-fixture.js");
  fs.writeFileSync(palette, paletteFixture());
  fs.writeFileSync(turn, turnFixture());
  fs.writeFileSync(activity, collapseFixture());

  assert.equal(run("check").state, "needs-apply");
  assert.equal(run("apply").state, "applied");
  const once = [palette, turn, activity].map(file => fs.readFileSync(file));

  const result = spawnSync(process.execPath, [probe, extracted], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);

  assert.equal(run("apply").state, "applied");
  for (const [index, file] of [palette, turn, activity].entries()) {
    assert.deepEqual(fs.readFileSync(file), once[index], `${path.basename(file)} second application is byte-identical`);
  }
  process.stdout.write("reasoning retention transform probe passed\n");

  function run(action) {
    const result = spawnSync(process.execPath, [toolkit, "patch", "reasoning-retention", action, extracted], {encoding: "utf8"});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function paletteFixture() {
  return [
    'const MTKpaletteRelativePath=".codex/task-visual-palette.json";let MTKsidebarPalette=null;',
    'function MTKvisualRule(e,t,n){let r={},i={};return{pattern:n,color:t.color,markDataUrl:t.markDataUrl??null,taskId:t.taskId??null,protectSidebarArchive:t.protectSidebarArchive===!0,keepReasoningOpen:t.keepReasoningOpen===!0,dark:r,light:i}}',
    'function MTKschema(r){if(Object.keys(r).some(e=>e!=="color"&&e!=="mark"&&e!=="taskId"&&e!=="protectSidebarArchive"&&e!=="keepReasoningOpen")||r.protectSidebarArchive!==void 0&&typeof r.protectSidebarArchive!=="boolean"||r.protectSidebarArchive===!0&&r.taskId===void 0||r.keepReasoningOpen!==void 0&&typeof r.keepReasoningOpen!=="boolean"||r.keepReasoningOpen===!0&&r.taskId===void 0)return null;let o=[],a=/x/;o.push(MTKvisualRule({}, {color:r.color,markDataUrl:null,taskId:r.taskId,protectSidebarArchive:r.protectSidebarArchive,keepReasoningOpen:r.keepReasoningOpen},a));return o}',
    'function MTKsidebarArchiveProtected(e,t=MTKsidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.protectSidebarArchive&&t.taskId===e)}globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected;',
    'const MTKreasoningListeners=new Set;function MTKreasoningShouldStayOpen(e,t=MTKsidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.keepReasoningOpen===!0&&t.taskId===e)}function MTKreasoningSubscribe(e){return MTKreasoningListeners.add(e),()=>MTKreasoningListeners.delete(e)}globalThis.__MTKreasoningShouldStayOpen=MTKreasoningShouldStayOpen;globalThis.__MTKreasoningSubscribe=MTKreasoningSubscribe;',
    'function MTKinstallSidebar(e){MTKsidebarPalette=e;for(let t of MTKreasoningListeners)t();if(e==null){return}}',
    'export const fixture=true;'
  ].join("");
}

function turnFixture() {
  return [
    'const Ui={useSyncExternalStore(){return false}},bt=()=>null;',
    'function _i(e){let t=(0,Vi.c)(207),{conversationId:a,showFullTranscript:Fe}=e,I=Fe!==void 0&&Fe,ot=bt(le);',
    'return {preventAutoCollapse:kt||yr,I,ot}}',
    'export const fixture=true;'
  ].join("");
}

function collapseFixture() {
  return [
    'function $E({hasFinalAssistantStarted:e,isTurnCancelled:t,hasRenderableAgentItems:n,forceExpanded:r=!1,preventAutoCollapse:i,persistedCollapsed:a}){return e&&!t&&n?{shouldAllowCollapse:!0,isCollapsed:!r&&(a??!i)}:{shouldAllowCollapse:!1,isCollapsed:!1}}',
    'function toggle(){let W=false,u=null,A=()=>{};return {onToggle:()=>{let e=!W;if(u==null){A(e);return}u(e)}}}',
    'export{$E,toggle};'
  ].join("");
}
