#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/task-visual-palette.test.mjs");
const examplePalette = path.join(repository, "patches/task-visual-palette/palette.example.json");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-palette-test-"));

try {
  const extracted = path.join(scratch, "extracted");
  const assets = path.join(extracted, "webview/assets");
  const workspace = path.join(scratch, 'workspace "quoted"');
  const paletteDirectory = path.join(workspace, ".codex");
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(paletteDirectory, { recursive: true });
  const initialTarget = path.join(assets, "app-initial-fixture.js");
  const primaryTarget = path.join(assets, "app-primary-fixture.js");
  const localTarget = path.join(assets, "local-conversation-page-fixture.js");
  const delegationTarget = path.join(assets, "conversation-blocks-fixture.js");
  const config = path.join(scratch, "toolkit.json");
  fs.writeFileSync(initialTarget, initialFixture());
  fs.writeFileSync(primaryTarget, primaryFixture());
  fs.writeFileSync(localTarget, localFixture());
  fs.writeFileSync(delegationTarget, delegationFixture());
  fs.writeFileSync(config, `${JSON.stringify({ workspaceRoot: workspace }, null, 2)}\n`);
  fs.copyFileSync(examplePalette, path.join(paletteDirectory, "task-visual-palette.json"));

  assert.equal(runToolkit("check", false).state, "needs-apply");
  assert.equal(runAttribution().state, "applied", "public attribution patch supplies the palette provenance seam");
  const withoutConfig = spawnSync(
    process.execPath,
    [toolkit, "patch", "task-visual-palette", "apply", extracted],
    { encoding: "utf8" }
  );
  assert.notEqual(withoutConfig.status, 0, "apply refuses to bake an implicit workspace owner");
  assert.match(withoutConfig.stderr, /requires --config/);

  const applied = runToolkit("apply");
  assert.equal(applied.state, "applied");
  assert.deepEqual(applied.targets.sort(), [
    "webview/assets/app-initial-fixture.js",
    "webview/assets/app-primary-fixture.js",
    "webview/assets/conversation-blocks-fixture.js",
    "webview/assets/local-conversation-page-fixture.js"
  ]);
  const once = [initialTarget, primaryTarget, localTarget, delegationTarget].map(target => fs.readFileSync(target));
  assert.ok(once[0].includes(`t=${JSON.stringify(workspace)}`), "configured workspace root is embedded as a quoted literal");

  const probe = spawnSync(process.execPath, [behavioralProbe, extracted, workspace], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply").state, "applied");
  for (const [index, target] of [initialTarget, primaryTarget, localTarget, delegationTarget].entries()) {
    assert.deepEqual(fs.readFileSync(target), once[index], `${path.basename(target)} second application is byte-identical`);
  }
  process.stdout.write("task visual palette transform probe passed\n");

  function runToolkit(action, withConfig = true) {
    const args = [toolkit, "patch", "task-visual-palette", action, extracted];
    if (withConfig) args.push("--config", config);
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }

  function runAttribution() {
    const result = spawnSync(
      process.execPath,
      [toolkit, "patch", "cross-task-attribution", "apply", extracted],
      { encoding: "utf8" }
    );
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
    "function Oks(){let e=(0,jks.c)(12),value=0;return e}",
    "export{x as x,hb as h,Q as q,EI as title};"
  ].join("");
}

function primaryFixture() {
  return [
    'import{title as ap}from"./app-initial-fixture.js";',
    "function VAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,x}){let m=1,T=false;return {archive:T?void 0:{id:`archive-thread`,onSelect:()=>i()}}}",
    "function rjn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:e.filter(e=>e.id!==`rename-thread`)}",
    "function localSelection(T,r){return rjn({items:[],onArchive:null,onSelect:null,selectedThreadKeys:BTn(T,r),threadKey:r})}",
    "function localRow(n,t){let Ee=true,L=false,Me=1;return {archive:t!=null&&(Ee||L)?Me:t,getMenuItems:null}}",
    "function remoteInline(){let Ve=1,He=`archive`,se=`task`;return {onArchive:Ve,archiveAriaLabel:He}}",
    "function remoteMenu(e,Se){if(Se&&e.push({id:`archive-task`,label:`Archive`}));return e}",
    "function remoteRow(e,n,K){return {archive:n,getMenuItems:K?e=>d([e]):null}}",
    "function fade(){return (0,h3.jsx)(`div`,{\"aria-hidden\":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})}",
    "export const fixture=true;"
  ].join("");
}

function localFixture() {
  return [
    "function $o(e){let t=(0,os.c)(88),r=e,pe;",
    "t[72]!==G||t[73]!==K||t[74]!==q||t[75]!==J||t[76]!==ie||t[77]!==ae||t[78]!==oe||t[79]!==se||t[80]!==le||t[81]!==ue||t[82]!==de||t[83]!==fe?(pe=(0,Q.jsxs)(`div`,{ref:U,className:`relative h-full min-h-0`,children:[G,K,q,J,re,ie,ae,oe,se,le,ue,de,fe]}),t[72]=G,t[73]=K,t[74]=q,t[75]=J,t[76]=ie,t[77]=ae,t[78]=oe,t[79]=se,t[80]=le,t[81]=ue,t[82]=de,t[83]=fe,t[84]=pe):pe=t[84];",
    "return pe}",
    "export const fixture=true;"
  ].join("");
}

function delegationFixture() {
  return [
    'import{fixture as P}from"./app-primary-fixture.js";',
    'import{h as H,q as S}from"./app-initial-fixture.js";',
    "const stock={defaultMessage:`Sent by {appName} from another task`};",
    "function Cb(e){let t=(0,wb.c)(13),{conversationId:n,sourceThreadId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c}=e,l,p,f,m,h,d=go()?`/hotkey-window/thread/${r}`:`/local/${r}`;",
    "t[1]!==f?(p=(0,Tb.jsx)(Fmt,{id:`localConversation.codexDelegationUserMessage.app`}),t[1]=p):p=t[1];",
    "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m?(h=(0,Tb.jsx)(vb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[12]=h):h=t[12];return h}",
    "function vb(e){let t=(0,yb.c)(16),{label:n,conversationId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c,onLabelClick:l}=e,f=true,u=c,m,p;",
    "m=f?(0,bb.jsx)(Eg,{message:i,sentAtMs:a,collapsedLineCount:xb,compactActions:u,cwd:o,hostId:s,threadId:r}):null;",
    "t[5]!==u||t[6]!==r||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==f?(p=m,t[5]=u,t[6]=r,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=f,t[12]=m):p=t[12];",
    "t[13]!==p||t[14]!==m?(h=(0,bb.jsxs)(`div`,{className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[15]=h):h=t[15];return h}",
    "function Eg(e){let t=(0,Og.c)(127),{message:A,cwd:E,hostId:D}=e,de,oe,_e,ve;if(t[42]!==de||t[43]!==oe||t[44]!==_e){",
    "ve=(0,Z.jsx)(`div`,{\"data-user-message-bubble\":!0,className:`max-w-full`}),t[42]=de,t[43]=oe,t[44]=_e,t[45]=ve}return ve}",
    "export const fixture=true;"
  ].join("");
}
