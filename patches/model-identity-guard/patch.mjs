#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: model-identity-guard.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const owner = uniqueOwner(source =>
  source.includes("function _Lr(e){let t=(0,DLr.c)(231),") &&
  source.includes("Ie=aor(I.reasoningEffort,Me)") &&
  source.includes('"data-codex-intelligence-trigger"'),
  "build-8109 composer model owner"
);

let state = inspectState();
if (command === "apply" && state === "needs-apply") {
  ensurePaletteBridge();
  patchOwner(owner.file);
  syntaxCheck(owner.file);
  state = inspectState();
  if (state !== "applied") throw new Error("model identity guard transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  policy: ".codex/task-visual-palette.json",
  targets: [path.relative(root, owner.file)]
}, null, 2)}\n`);

function inspectState() {
  const source = fs.readFileSync(owner.file, "utf8");
  const markers = [
    source.includes("function MTKinstallModelIdentityGuard("),
    source.includes("function MTKuseModelIdentityGuard("),
    source.includes("MTKmodelIdentityGuardHook=MTKuseModelIdentityGuard(r,U,Ie)"),
    source.includes('data-mtk-model-guard-mismatch'),
    source.includes('content:"RED ALERT"')
  ];
  if (markers.every(Boolean)) return "applied";
  if (markers.some(Boolean)) throw new Error("Unrecognized model identity guard patch: partial markers");
  if (!source.includes("function _Lr(e){let t=(0,DLr.c)(231),") ||
      !source.includes("Ie=aor(I.reasoningEffort,Me),Le=")) {
    throw new Error("Upstream changed: missing build-8109 model selector contract");
  }
  return "needs-apply";
}

function ensurePaletteBridge() {
  const owners = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (source.includes('MTKpaletteRelativePath=".codex/task-visual-palette.json"')) owners.push(source);
  }
  if (owners.length !== 1 ||
      !owners[0].includes("globalThis.__MTKmodelPinForTask=MTKmodelPinForTask") ||
      !owners[0].includes("globalThis.__MTKmodelPinSubscribe=MTKmodelPinSubscribe")) {
    throw new Error("Model identity guard requires the current task-visual-palette patch first");
  }
}

function patchOwner(file) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("function MTKinstallModelIdentityGuard(")) return;

  const helper = String.raw`const MTKmodelGuardStyleId="mtk-model-identity-guard-style",MTKmodelGuardEditors=new WeakMap,MTKmodelGuardSelectors=new WeakMap;function MTKmodelGuardFriendlyModel(e){return{"gpt-5.6-sol":"GPT-5.6 Sol","gpt-5.6-luna":"GPT-5.6 Luna","gpt-6-astra":"GPT-6 Astra","gpt-5.5":"GPT-5.5"}[e]??e}function MTKmodelGuardFriendlyEffort(e){return{none:"None",minimal:"Minimal",low:"Light",medium:"Medium",high:"High",xhigh:"XHigh",max:"Max",ultra:"Ultra",persistent:"Persistent"}[e]??e}function MTKmodelGuardMismatch(e,t){return e!=null&&(t==null||e.model!==t.model||e.reasoningEffort!==t.reasoningEffort)}function MTKmodelGuardDescription(e,t){let n=e==null?"unknown":MTKmodelGuardFriendlyModel(e.model)+" / "+MTKmodelGuardFriendlyEffort(e.reasoningEffort);return"RED ALERT — pinned model mismatch. Expected "+MTKmodelGuardFriendlyModel(t.model)+" / "+MTKmodelGuardFriendlyEffort(t.reasoningEffort)+"; current "+n+". Select the pinned model to unlock input."}function MTKmodelGuardSetSelector(e,t,n){if(t){MTKmodelGuardSelectors.has(e)||MTKmodelGuardSelectors.set(e,{title:e.getAttribute("title")}),e.setAttribute("data-mtk-model-guard-alert","true"),e.setAttribute("title",n)}else{let t=MTKmodelGuardSelectors.get(e);if(t==null)return;e.removeAttribute("data-mtk-model-guard-alert"),t.title==null?e.removeAttribute("title"):e.setAttribute("title",t.title),MTKmodelGuardSelectors.delete(e)}}function MTKmodelGuardSetEditor(e,t){if(t){if(!MTKmodelGuardEditors.has(e))MTKmodelGuardEditors.set(e,{contenteditable:e.getAttribute("contenteditable"),disabled:"disabled"in e?e.disabled:void 0});e.setAttribute("data-mtk-model-guard-editor","true"),e.setAttribute("aria-disabled","true"),e.hasAttribute("contenteditable")&&e.setAttribute("contenteditable","false"),"disabled"in e&&(e.disabled=!0),document.activeElement===e&&e.blur?.()}else{let t=MTKmodelGuardEditors.get(e);if(t==null)return;e.removeAttribute("data-mtk-model-guard-editor"),e.removeAttribute("aria-disabled"),t.contenteditable==null?e.removeAttribute("contenteditable"):e.setAttribute("contenteditable",t.contenteditable),t.disabled!==void 0&&(e.disabled=t.disabled),MTKmodelGuardEditors.delete(e)}}function MTKmodelGuardEnsureStyle(){if(document.getElementById(MTKmodelGuardStyleId))return;let e=document.createElement("style");e.id=MTKmodelGuardStyleId,e.textContent='@keyframes mtk-model-red-alert{0%,100%{background:#7f1d1d;box-shadow:0 0 0 1px #ef4444,0 0 8px rgba(239,68,68,.35)}50%{background:#dc2626;box-shadow:0 0 0 2px #fecaca,0 0 18px rgba(239,68,68,.8)}}[data-mtk-model-guard-mismatch="true"] [data-codex-intelligence-trigger]{animation:mtk-model-red-alert 1s ease-in-out infinite!important;color:#fff!important;border-color:#fca5a5!important}[data-mtk-model-guard-mismatch="true"] [data-codex-intelligence-trigger] *{color:#fff!important}[data-mtk-model-guard-mismatch="true"] [data-codex-intelligence-trigger]::before{content:"RED ALERT";font-size:9px;line-height:1;font-weight:850;letter-spacing:.08em;color:#fff}[data-mtk-model-guard-editor="true"]{cursor:not-allowed!important;opacity:.42!important;pointer-events:none!important}@media (prefers-reduced-motion:reduce){[data-mtk-model-guard-mismatch="true"] [data-codex-intelligence-trigger]{animation:none!important;background:#b91c1c!important;box-shadow:0 0 0 2px #fca5a5!important}}',document.head.appendChild(e)}function MTKinstallModelIdentityGuard(){let e=globalThis.__MTK_MODEL_IDENTITY_GUARD__;if(e?.version===1)return e;let t=new Map,n=!1,r=null;function i(){if(n)return;n=!0,queueMicrotask(()=>{n=!1,a()})}function a(){MTKmodelGuardEnsureStyle();for(let e of document.querySelectorAll("[data-mtk-palette-room-host][data-mtk-palette-thread-id]")){let n=e.getAttribute("data-mtk-palette-thread-id"),r=globalThis.__MTKmodelPinForTask?.(n)??null,i=t.get(n)??null,a=MTKmodelGuardMismatch(r,i);a?e.setAttribute("data-mtk-model-guard-mismatch","true"):e.removeAttribute("data-mtk-model-guard-mismatch");let o=a?MTKmodelGuardDescription(i,r):null;for(let t of e.querySelectorAll("[data-codex-intelligence-trigger]"))MTKmodelGuardSetSelector(t,a,o);for(let t of e.querySelectorAll('textarea,[contenteditable],[role="textbox"],[data-mtk-model-guard-editor]'))MTKmodelGuardSetEditor(t,a)}}function o(e,n,r){if(typeof e!=="string"||e.length===0)return()=>{};let a={model:n,reasoningEffort:r};return t.set(e,a),i(),()=>{t.get(e)===a&&(t.delete(e),i())}}function s(e){let t=e.target instanceof Element?e.target:null,n=t?.closest('[data-mtk-model-guard-mismatch="true"]');if(n==null)return!1;if(e.type==="submit"||(e.type==="click"&&t.closest('button[type="submit"]'))||(t.closest('[data-mtk-model-guard-editor="true"]')&&e.type!=="focusout"))return e.preventDefault(),e.stopImmediatePropagation(),!0;return!1}for(let e of["beforeinput","keydown","paste","drop","submit","click"])document.addEventListener(e,s,!0);let c=()=>{document.body!=null&&(r??=new MutationObserver(e=>{e.some(e=>e.type==="childList"&&(e.addedNodes.length>0||e.removedNodes.length>0))&&i()}),r.observe(document.body,{subtree:!0,childList:!0}),i())};document.body==null?document.addEventListener("DOMContentLoaded",c,{once:!0}):c();globalThis.__MTKmodelPinSubscribe?.(i);return e=Object.freeze({version:1,publish:o,refresh:i}),globalThis.__MTK_MODEL_IDENTITY_GUARD__=e,e}const MTKmodelIdentityGuard=MTKinstallModelIdentityGuard();function MTKuseModelIdentityGuard(e,t,n){return S7.useEffect(()=>MTKmodelIdentityGuard.publish(e,t,n),[e,t,n])}`;

  source = replaceOnce(
    source,
    "function _Lr(e){let t=(0,DLr.c)(231),",
    `${helper}function _Lr(e){let t=(0,DLr.c)(231),`,
    "composer model guard helper"
  );
  source = replaceOnce(
    source,
    "Ie=aor(I.reasoningEffort,Me),Le=",
    "Ie=aor(I.reasoningEffort,Me),MTKmodelIdentityGuardHook=MTKuseModelIdentityGuard(r,U,Ie),Le=",
    "live model and effort publication"
  );
  fs.writeFileSync(file, source);
}

function uniqueOwner(predicate, label) {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const owners = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (predicate(source)) owners.push({file, source});
  }
  if (owners.length !== 1) throw new Error(`Upstream changed: found ${owners.length} ${label}s`);
  return owners[0];
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function syntaxCheck(file) {
  const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    encoding: "utf8",
    input: fs.readFileSync(file),
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    const output = result.stderr || result.stdout;
    const summary = output.match(/SyntaxError:[^\n]*/)?.[0] ?? output.trim().slice(-1000);
    throw new Error(`module syntax check failed for ${path.relative(root, file)}: ${summary}`);
  }
}
