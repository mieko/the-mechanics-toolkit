#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { linuxBuild8881 } from "./profiles/linux.mjs";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const id = "[$A-Z_a-z][$\\w]*";
const legacyRegistryCall = 'globalThis.__MTK_PATCH_REGISTRY__?.register?.("outgoingMessageReceipt",{version:1,persistence:"mounted-session",visibility:"persistent-when-activity-collapsed",preview:"stock-hover",messageRendering:"recipient-user-message"});';
const flatCacheRegistryCall = 'globalThis.__MTK_PATCH_REGISTRY__?.register?.("outgoingMessageReceipt",{version:2,persistence:"bounded-private-restart-cache",visibility:"persistent-after-restart-and-collapse",preview:"stock-hover",messageRendering:"recipient-user-message"});';
const acklessRegistryCall = 'globalThis.__MTK_PATCH_REGISTRY__?.register?.("outgoingMessageReceipt",{version:3,persistence:"bounded-private-task-buckets",visibility:"persistent-after-restart-and-collapse",preview:"stock-hover",messageRendering:"recipient-user-message"});';
const currentRegistryCall = 'globalThis.__MTK_PATCH_REGISTRY__?.register?.("outgoingMessageReceipt",{version:4,persistence:"acknowledged-private-task-buckets",visibility:"persistent-after-restart-and-collapse",preview:"stock-hover",messageRendering:"recipient-user-message"});';
const legacyTaskColorFunction = 'function MTKoutboundTaskColor(e,t){try{let n=globalThis.__MTK_PATCH_REGISTRY__;if(n?.apiVersion!==1)return null;let r=n.packages?.taskVisualPalette;if(r?.version!==1||typeof r.resolveTaskColor!=="function")return null;let i=r.resolveTaskColor({taskId:e,title:t});return typeof i==="string"&&/^#[0-9A-Fa-f]{6}$/.test(i)?i.toUpperCase():null}catch{return null}}';
const themedTaskColorFunctions = `${legacyTaskColorFunction}function MTKoutboundParseHex(e){return{r:parseInt(e.slice(1,3),16),g:parseInt(e.slice(3,5),16),b:parseInt(e.slice(5,7),16)}}function MTKoutboundMix(e,t,n){let r=MTKoutboundParseHex(e),i=MTKoutboundParseHex(t),a=e=>Math.round(e).toString(16).padStart(2,"0");return("#"+a(r.r+(i.r-r.r)*n)+a(r.g+(i.g-r.g)*n)+a(r.b+(i.b-r.b)*n)).toUpperCase()}function MTKoutboundLum(e){let t=Object.values(MTKoutboundParseHex(e)).map(e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4});return.2126*t[0]+.7152*t[1]+.0722*t[2]}function MTKoutboundContrast(e,t){let n=MTKoutboundLum(e),r=MTKoutboundLum(t);return(Math.max(n,r)+.05)/(Math.min(n,r)+.05)}function MTKoutboundLabelColor(e,t){let n=t?.38:.34,r=t?"#FFFFFF":"#111318",i=t?"#101114":"#FFFFFF";for(;n<=1.001;n+=.08){let t=MTKoutboundMix(e,r,Math.min(1,n));if(MTKoutboundContrast(t,i)>=4.5)return t}return r}`;
const legacyTaskColorStyle = 'l=c==null?void 0:{color:"color-mix(in srgb, "+c+" 68%, var(--color-text) 32%)"},u=';
const themedTaskColorStyle = 'l=c==null?void 0:{color:"light-dark("+MTKoutboundLabelColor(c,!1)+","+MTKoutboundLabelColor(c,!0)+")"},u=';
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: outgoing-message-receipt/patch.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
assertStockStyles();
const target = uniqueOwner();
const conversationTarget = uniqueConversationOwner();
const conversationTurnTarget = uniqueConversationTurnOwner(conversationTarget);
const mainTarget = uniqueMainOwner();
let source = fs.readFileSync(target, "utf8");
let conversationSource = fs.readFileSync(conversationTarget, "utf8");
let conversationTurnSource = conversationTurnTarget === conversationTarget
  ? conversationSource : fs.readFileSync(conversationTurnTarget, "utf8");
let mainSource = fs.readFileSync(mainTarget, "utf8");
const collapseOwner = assertPersistentActivityContract(source);
const presentation = resolvePresentationOwners(source);
let state = inspectState();

if (command === "apply" && state === "legacy-applied") {
  source = removeLegacyOwner(source);
  state = inspectState();
  if (state !== "needs-apply") throw new Error("legacy outgoing receipt removal did not verify");
}

if (command === "apply" && state === "registry-upgrade") {
  source = replaceOnce(source, legacyRegistryCall, currentRegistryCall, "outgoing receipt registry upgrade");
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState();
  if (state !== "applied") throw new Error("outgoing receipt registry upgrade did not verify");
}

if (command === "apply" && state === "task-bucket-upgrade") {
  if (source.includes(flatCacheRegistryCall)) {
    source = replaceOnce(source, flatCacheRegistryCall, currentRegistryCall, "outgoing receipt task-bucket registry upgrade");
  }
  conversationSource = upgradeConversationCache(conversationSource);
  mainSource = upgradeMainAcknowledgment(upgradeMainCache(mainSource));
  fs.writeFileSync(target, source);
  fs.writeFileSync(conversationTarget, conversationSource);
  fs.writeFileSync(mainTarget, mainSource);
  syntaxCheck(target);
  syntaxCheck(conversationTarget);
  syntaxCheck(mainTarget);
  state = inspectState();
  if (state !== "applied") throw new Error("outgoing receipt task-bucket upgrade did not verify");
}

if (command === "apply" && state === "acknowledgment-upgrade") {
  source = replaceOnce(source, acklessRegistryCall, currentRegistryCall, "outgoing receipt acknowledgment registry upgrade");
  conversationSource = upgradeConversationAcknowledgment(conversationSource);
  mainSource = upgradeMainAcknowledgment(mainSource);
  fs.writeFileSync(target, source);
  fs.writeFileSync(conversationTarget, conversationSource);
  fs.writeFileSync(mainTarget, mainSource);
  syntaxCheck(target);
  syntaxCheck(conversationTarget);
  syntaxCheck(mainTarget);
  state = inspectState();
  if (state !== "applied") throw new Error("outgoing receipt acknowledgment upgrade did not verify");
}

if (command === "apply" && state === "theme-label-upgrade") {
  source = replaceOnce(source, legacyTaskColorFunction, themedTaskColorFunctions, "outgoing receipt contrast helpers");
  source = replaceOnce(source, legacyTaskColorStyle, themedTaskColorStyle, "outgoing receipt theme-aware label color");
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState();
  if (state !== "applied") throw new Error("outgoing receipt theme-label upgrade did not verify");
}

if (command === "apply" && state === "needs-apply") {
  source = patchSource(source);
  ({conversationSource, conversationTurnSource} = patchConversation(conversationSource, conversationTurnSource));
  mainSource = patchMain(mainSource);
  fs.writeFileSync(target, source);
  fs.writeFileSync(conversationTarget, conversationSource);
  if (conversationTurnTarget !== conversationTarget) fs.writeFileSync(conversationTurnTarget, conversationTurnSource);
  fs.writeFileSync(mainTarget, mainSource);
  syntaxCheck(target);
  syntaxCheck(conversationTarget);
  if (conversationTurnTarget !== conversationTarget) syntaxCheck(conversationTurnTarget);
  syntaxCheck(mainTarget);
  state = inspectState();
  if (state !== "applied") throw new Error("outgoing receipt transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  persistence: "acknowledged-private-task-buckets",
  collapsedVisibility: "persistent",
  preview: "stock-interactive-hover",
  messageRendering: "stock-recipient-user-message-formatter",
  collapseOwner: path.relative(root, collapseOwner),
  formatterOwner: path.relative(root, presentation.formatterFile),
  targets: [...new Set([target, conversationTarget, conversationTurnTarget, mainTarget])].map(file => path.relative(root, file))
}, null, 2)}\n`);

function inspectState() {
  const send = sendProfile(source);
  const red = `{namespace:${send.namespace},render:${send.genericRender},renderAgentActivityIcon:${send.icon},tool:${send.sendTool}}`;
  const green = `{namespace:${send.namespace},persistentInCollapsedConversation:!0,render:MTKrenderOutboundMessage,renderAgentActivityIcon:${send.icon},standaloneInConversation:!0,tool:${send.sendTool}}`;
  const ownerMarkers = [
    "function MTKOutboundMessageReceipt(",
    "function MTKoutboundTaskColor(",
    "globalThis.__MTK_OUTBOUND_REMEMBER__",
    "MTKOutboundMessageReceipt as MTKoutboundReceipt",
    "MTKoutboundStoreHook(MTKoutboundStoreScope)",
    ".get(MTKoutboundTaskAtom,",
    "n.packages?.taskVisualPalette",
    "MTKoutboundHover",
    "MTKoutboundFormattedText",
    "interactive:!0",
    "delayDuration:800",
    'maxHeight:"min(420px, var(--radix-tooltip-content-available-height, 420px), calc(100vh - 16px))"',
    'overflowY:"auto"',
    'padding:"0.75rem"',
    "data-mtk-outgoing-message-receipt"
  ];
  if (requiresDedicatedTitleSelector(source)) ownerMarkers.push("MTKoutboundTitleAtom");
  const conversationMarkers = [
    "const MTKoutboundReceiptContract=",
    "function MTKoutboundRemember(",
    "function MTKOutboundTurnReceipts(",
    'dispatchMessage("mtk-outbound-receipt-remember"',
    'subscribe("mtk-outbound-receipt-remember-result"',
    'dispatchMessage("mtk-outbound-receipts-list"',
    'subscribe("mtk-outbound-receipts-result"',
    "MTKoutboundReceipt as MTKoutboundReceipt"
  ];
  const mainMarkers = [
    "const MTKoutboundReceiptContract=",
    "function MTKoutboundReceiptWrite(",
    "function MTKoutboundReceiptList(",
    '"mechanics-toolkit","task-message-receipts"',
    "MTKoutboundReceiptLimit=256",
    "case`mtk-outbound-receipt-remember`:",
    "type:`mtk-outbound-receipt-remember-result`",
    "case`mtk-outbound-receipts-list`:"
  ];
  const combinedConversationSource = conversationTurnTarget === conversationTarget
    ? conversationSource : `${conversationSource}\n${conversationTurnSource}`;
  const ownerApplied = ownerMarkers.every(marker => source.includes(marker));
  const conversationApplied = conversationMarkers.every(marker => combinedConversationSource.includes(marker)) &&
    (conversationSource.includes("sourceTurnId:S") || conversationSource.includes("sourceTurnId:w") ||
     conversationSource.includes("sourceTurnId:T") || conversationSource.includes("sourceTurnId:C"));
  const mainApplied = mainMarkers.every(marker => mainSource.includes(marker));
  const conversationCacheStart = conversationSource.indexOf("const MTKoutboundReceiptContract=");
  const conversationCacheEnd = conversationSource.indexOf(conversationHelperBoundary(conversationSource), conversationCacheStart);
  const conversationCache = conversationCacheStart >= 0 && conversationCacheEnd > conversationCacheStart
    ? conversationSource.slice(conversationCacheStart, conversationCacheEnd) : "";
  const taskBucketConversationApplied = conversationCache.includes("function MTKOutboundTurnReceipts(") &&
    !conversationCache.includes("flatMap");
  const taskBucketMainApplied = mainSource.includes("MTKoutboundReceiptTaskBucketLimit=64") &&
    mainSource.includes("function MTKoutboundReceiptTaskDir(") && mainSource.includes("function MTKoutboundReceiptMigrateLegacy(");
  const acklessConversationApplied = conversationMarkers.filter(marker =>
    marker !== 'subscribe("mtk-outbound-receipt-remember-result"'
  ).every(marker => combinedConversationSource.includes(marker)) &&
    !conversationSource.includes('subscribe("mtk-outbound-receipt-remember-result"');
  const acklessMainApplied = mainMarkers.filter(marker =>
    marker !== "type:`mtk-outbound-receipt-remember-result`"
  ).every(marker => mainSource.includes(marker)) &&
    !mainSource.includes("type:`mtk-outbound-receipt-remember-result`");
  const anyApplied = source.includes("function MTKOutboundMessageReceipt(") ||
    source.includes('register?.("outgoingMessageReceipt"') ||
    combinedConversationSource.includes("const MTKoutboundReceiptContract=") ||
    mainSource.includes("const MTKoutboundReceiptContract=");
  if (count(source, green) === 1 && count(source, red) === 0 && ownerApplied &&
      taskBucketMainApplied && acklessConversationApplied && acklessMainApplied &&
      source.includes(acklessRegistryCall)) {
    return "acknowledgment-upgrade";
  }
  if (count(source, green) === 1 && count(source, red) === 0 && ownerApplied && conversationApplied && mainApplied &&
      taskBucketConversationApplied && taskBucketMainApplied) {
    if (source.includes(legacyRegistryCall)) return "registry-upgrade";
    if (source.includes(flatCacheRegistryCall)) return "task-bucket-upgrade";
    if (!source.includes("function MTKoutboundLabelColor(") || source.includes(legacyTaskColorStyle)) return "theme-label-upgrade";
    return "applied";
  }
  if (count(source, green) === 1 && count(source, red) === 0 && ownerApplied && conversationApplied && mainApplied &&
      (source.includes(flatCacheRegistryCall) || !source.includes('register?.("outgoingMessageReceipt"')) &&
      !taskBucketConversationApplied && !taskBucketMainApplied) {
    return "task-bucket-upgrade";
  }
  const legacyOwner = count(source, green) === 1 && count(source, red) === 0 &&
    source.includes("function MTKOutboundMessageReceipt(") &&
    source.includes("function MTKrenderOutboundMessage(e,t,n,r=!0)") &&
    source.includes(" as MTKoutboundTaskAtom") &&
    source.includes(" as MTKoutboundHover") &&
    source.includes(" as MTKoutboundFormattedText") &&
    !source.includes("globalThis.__MTK_OUTBOUND_REMEMBER__") &&
    !conversationApplied && !mainApplied;
  if (legacyOwner) return "legacy-applied";
  if (count(source, red) === 1 && count(source, green) === 0 && !anyApplied) {
    inspectPristineConversation(conversationSource);
    inspectPristineMain(mainSource);
    return "needs-apply";
  }
  throw new Error(
    `Upstream changed: outgoing receipt seam red=${count(source, red)} green=${count(source, green)} ` +
      `owner=${ownerApplied} conversation=${conversationApplied} main=${mainApplied}`
  );
}

function removeLegacyOwner(value) {
  const send = sendProfile(value);
  const green = `{namespace:${send.namespace},persistentInCollapsedConversation:!0,render:MTKrenderOutboundMessage,renderAgentActivityIcon:${send.icon},standaloneInConversation:!0,tool:${send.sendTool}}`;
  const red = `{namespace:${send.namespace},render:${send.genericRender},renderAgentActivityIcon:${send.icon},tool:${send.sendTool}}`;
  const helperStart = value.indexOf("function MTKoutboundArguments(");
  const helperEnd = value.indexOf(send.functionText, helperStart);
  if (helperStart < 0 || helperEnd <= helperStart) throw new Error("Legacy outgoing receipt helper is not localized");
  let patched = value.slice(0, helperStart) + value.slice(helperEnd);
  patched = replaceOnce(patched, green, red, "legacy send-message registry entry");
  for (const binding of [
    "MTKoutboundStoreHook", "MTKoutboundStoreScope", "MTKoutboundTaskAtom",
    "MTKoutboundLocalThreadKey", "MTKoutboundRemoteThreadKey", "MTKoutboundHover",
    "MTKoutboundFormattedText"
  ]) patched = removeImportBinding(patched, binding);
  return patched;
}

function removeImportBinding(value, localName) {
  const matches = [...value.matchAll(/import\{(?<specifiers>[^}]+)\}from"(?<relative>[^"]+)";/g)].filter(match =>
    match.groups.specifiers.split(",").some(specifier => specifier.endsWith(` as ${localName}`))
  );
  if (matches.length !== 1) throw new Error(`Legacy outgoing receipt import ${localName} is not unique`);
  const kept = matches[0].groups.specifiers.split(",").filter(specifier => !specifier.endsWith(` as ${localName}`));
  const replacement = kept.length === 0 ? "" : `import{${kept.join(",")}}from"${matches[0].groups.relative}";`;
  return replaceOnce(value, matches[0][0], replacement, `legacy ${localName} import`);
}

function patchSource(value) {
  const send = sendProfile(value);
  const imports = resolveTaskImports(value);
  const red = `{namespace:${send.namespace},render:${send.genericRender},renderAgentActivityIcon:${send.icon},tool:${send.sendTool}}`;
  const green = `{namespace:${send.namespace},persistentInCollapsedConversation:!0,render:MTKrenderOutboundMessage,renderAgentActivityIcon:${send.icon},standaloneInConversation:!0,tool:${send.sendTool}}`;
  const helper = buildHelper(send, imports.titleImport != null);

  let patched = replaceOnce(value, send.functionText, `${helper}${send.functionText}`, "outbound renderer helper");
  patched = replaceOnce(patched, red, green, "send-message registry entry");
  patched = replaceOnce(patched, imports.before, imports.after, "outbound task imports");
  if (imports.titleImport != null) {
    patched = addImportSpecifier(
      patched,
      imports.titleImport.relative,
      `${imports.titleImport.exported} as MTKoutboundTitleAtom`,
      "stock live-title selector import"
    );
  }
  patched = addImportSpecifier(patched, presentation.appRelative, `${presentation.tooltipExport} as MTKoutboundHover`, "stock hover import");
  patched = addImportSpecifier(patched, presentation.formatterRelative, `${presentation.formatterExport} as MTKoutboundFormattedText`, "stock message formatter import");
  patched = replaceOnce(patched, "export{", "export{MTKOutboundMessageReceipt as MTKoutboundReceipt,", "outbound receipt export");
  if (patched.includes(legacyRegistryCall)) {
    patched = replaceOnce(patched, legacyRegistryCall, currentRegistryCall, "outgoing receipt registry upgrade");
  }
  return patched;
}

function buildHelper(send, useDedicatedTitleSelector = false) {
  const title = useDedicatedTitleSelector
    ? 't.get(MTKoutboundTitleAtom,{hostId:n.hostId??"local",threadId:n.threadId})??('
    : "";
  const titleEnd = useDedicatedTitleSelector ? ")" : "";
  const helper = String.raw`
function MTKoutboundArguments(e){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&typeof e.threadId==="string"&&e.threadId.length>0&&typeof e.prompt==="string"&&(e.hostId===void 0||typeof e.hostId==="string")?e:null}function MTKoutboundLabel(e){if(typeof e!=="string"||e.trim().length===0)return null;let t=e.trim(),n=t.indexOf(" — ");return n>0?t.slice(0,n).trim():t}function MTKoutboundPreview(e){let t=e.split(/\r?\n/).map(e=>e.trim()).find(e=>e.length>0)??"(empty message)";return t.length<=180?t:t.slice(0,179)+"…"}function MTKoutboundTaskColor(e,t){try{let n=globalThis.__MTK_PATCH_REGISTRY__;if(n?.apiVersion!==1)return null;let r=n.packages?.taskVisualPalette;if(r?.version!==1||typeof r.resolveTaskColor!=="function")return null;let i=r.resolveTaskColor({taskId:e,title:t});return typeof i==="string"&&/^#[0-9A-Fa-f]{6}$/.test(i)?i.toUpperCase():null}catch{return null}}function MTKoutboundNavigate(e){let t=${send.normalize}(e);${send.hostBridge}.dispatchHostMessage({type:"navigate-to-route",path:${send.routeFlag}()?${send.newRoute}(t):${send.oldRoute}(t)})}function MTKOutboundMessageReceipt({item:e}){let t=MTKoutboundStoreHook(MTKoutboundStoreScope),n=MTKoutboundArguments(e.arguments);if(n==null)return null;let r=n.hostId==null||n.hostId==="local"?MTKoutboundLocalThreadKey(n.threadId):MTKoutboundRemoteThreadKey(n.threadId),i=t.get(MTKoutboundTaskAtom,r),a=${title}i?.kind==="local"?(i.conversation?.title??i.catalogTitle??i.summary?.title):i?.kind==="remote"?i.task?.title:null${titleEnd},o=i?.kind==="local"?(i.conversation?.cwd??i.cwd??i.summary?.cwd):void 0,s=MTKoutboundLabel(a)??"Task "+n.threadId.slice(0,8)+"…",c=MTKoutboundTaskColor(n.threadId,a),l=c==null?void 0:{color:"color-mix(in srgb, "+c+" 68%, var(--color-text) 32%)"},u=e.completed?e.success===!1?"Failed to send to":"Sent to":"Sending to",d=MTKoutboundPreview(n.prompt),f=e=>{e.preventDefault(),e.stopPropagation(),MTKoutboundNavigate(n.threadId)},p=(0,${send.jsx}.jsxs)("div",{"data-mtk-outgoing-message-receipt":!0,className:"self-start flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-surface-secondary/40 px-3 py-2 text-size-chat text-text-tertiary",style:{maxWidth:"min(42rem,92%)"},children:[(0,${send.jsx}.jsx)("span",{"aria-hidden":!0,className:"shrink-0",children:"↗"}),(0,${send.jsx}.jsx)("span",{className:"shrink-0",children:u}),(0,${send.jsx}.jsx)("button",{"aria-label":"Open "+(a??s),className:"min-w-0 shrink-0 rounded-sm font-medium text-text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",onClick:f,style:l,type:"button",children:s}),(0,${send.jsx}.jsx)("span",{"aria-hidden":!0,className:"shrink-0",children:"·"}),(0,${send.jsx}.jsx)("span",{className:"min-w-0 flex-1 truncate text-text-tertiary/90",children:d})]});return(0,${send.jsx}.jsx)(MTKoutboundHover,{align:"start",closeOnTriggerBlur:!1,delayDuration:800,interactive:!0,side:"top",sideOffset:6,skipDelayKey:"outbound-message-preview",tooltipMaxWidth:"min(42rem, var(--radix-tooltip-content-available-width), calc(100vw - 16px))",variant:"rich",tooltipContent:(0,${send.jsx}.jsx)("div",{className:"min-w-0 text-start",style:{maxHeight:"min(420px, var(--radix-tooltip-content-available-height, 420px), calc(100vh - 16px))",overflowY:"auto",padding:"0.75rem",userSelect:"text"},children:(0,${send.jsx}.jsx)(MTKoutboundFormattedText,{cwd:o,externalLinkContextMenuConversationId:n.threadId,hostId:n.hostId??"local",text:n.prompt})}),children:p})}function MTKrenderOutboundMessage(e,t,n,r=!0,i){let a=MTKoutboundArguments(e.arguments);if(t==="row"&&a!=null){if(e.completed&&e.success===!0&&typeof e.callId==="string"&&e.callId.length>0&&i!=null&&typeof i.conversationId==="string"&&i.conversationId.length>0&&typeof i.turnId==="string"&&i.turnId.length>0&&typeof globalThis.__MTK_OUTBOUND_REMEMBER__==="function"){let t={callId:e.callId,contract:"outgoing-message-receipt-v1",prompt:a.prompt,recordedAtMs:Date.now(),sourceThreadId:i.conversationId,sourceTurnId:i.turnId,targetHostId:a.hostId??"local",targetThreadId:a.threadId};if(globalThis.__MTK_OUTBOUND_REMEMBER__(t)===!0)return null}return(0,${send.jsx}.jsx)(MTKOutboundMessageReceipt,{item:e})}return ${send.genericRender}(e,t,n,r)}
`;
  const themed = helper.replace(legacyTaskColorFunction, themedTaskColorFunctions).replace(legacyTaskColorStyle, themedTaskColorStyle);
  if (!themed.includes(themedTaskColorFunctions) || !themed.includes(themedTaskColorStyle)) {
    throw new Error("unrecognized outgoing receipt theme-color seam");
  }
  return themed;
}

function inspectPristineConversation(value, turnValue = conversationTurnSource) {
  const ownerImport = ownerImportProfile(value);
  if (ownerImport.specifiers.includes("MTKoutboundReceipt")) {
    throw new Error("Upstream changed: outgoing receipt import is unexpectedly present");
  }
  const dynamic = dynamicRendererProfile(value);
  if (dynamic.variant.startsWith("split-")) {
    splitTurnProfile(turnValue, linuxBuild8881.turn);
  } else {
    assistantProfile(value);
  }
}

function inspectPristineMain(value) {
  if (count(value, "case`electron-add-new-workspace-root-option`:") !== 1) {
    throw new Error("Upstream changed: outgoing receipt main message seam is not unique");
  }
  if (count(value, "var dQ=i.i(`electron-message-handler`)") +
      count(value, "var mQ=i.i(`electron-message-handler`)") +
      count(value, "var pQ=i.i(`electron-message-handler`)") +
      count(value, "var fQ=i.i(`electron-message-handler`)") !== 1) {
    throw new Error("Upstream changed: outgoing receipt main helper owner is not unique");
  }
  uniqueMatch(value, new RegExp(`await (?<electron>${id})\\.app\\.whenReady\\(\\)`, "g"), "Electron app owner");
}

function patchConversation(value, turnValue) {
  const ownerImport = ownerImportProfile(value);
  const hostBus = resolveHostBus(value);
  const dynamic = dynamicRendererProfile(value);
  let patched = replaceOnce(
    value,
    ownerImport.text,
    `import{${ownerImport.specifiers},MTKoutboundReceipt as MTKoutboundReceipt}from"${ownerImport.relative}";`,
    "outbound receipt component import"
  );
  patched = replaceOnce(patched, dynamic.functionText, dynamic.patchedFunction, "dynamic renderer context");
  patched = replaceOnce(
    patched,
    dynamic.callText,
    dynamic.patchedCallText,
    "outbound source turn context"
  );
  if (dynamic.variant.startsWith("split-")) {
    const turn = splitTurnProfile(turnValue, linuxBuild8881.turn);
    patched = replaceOnce(
      patched,
      "export{",
      "export{MTKOutboundTurnReceipts as MTKOutboundTurnReceipts,",
      "durable receipt component export"
    );
    let patchedTurn = replaceOnce(
      turnValue,
      turn.importText,
      `import{${turn.specifiers},MTKOutboundTurnReceipts as MTKOutboundTurnReceipts}from"${turn.relative}";`,
      "durable receipt component import"
    );
    patchedTurn = replaceOnce(patchedTurn, turn.before, turn.after, "durable outbound turn receipts");
    const insertion = patched.indexOf(dynamic.helperBoundary);
    if (insertion < 0) throw new Error("Upstream changed: split dynamic renderer owner is missing");
    patched = patched.slice(0, insertion) +
      `const MTKOutboundReceiptReact=${dynamic.react};` +
      conversationHelpers(hostBus, "MTKOutboundReceiptReact", dynamic.jsx) +
      patched.slice(insertion);
    return {conversationSource: patched, conversationTurnSource: patchedTurn};
  }
  const assistant = assistantProfile(value);
  patched = replaceOnce(
    patched,
    assistant.children,
    assistant.children.replace("children:[Ze,", "children:[(0,Yy.jsx)(MTKOutboundTurnReceipts,{conversationId:p,turnId:o}),Ze,"),
    "durable outbound turn receipts"
  );
  const insertion = patched.indexOf("function Oy(");
  if (insertion < 0) throw new Error("Upstream changed: assistant renderer owner is missing");
  patched = patched.slice(0, insertion) + conversationHelpers(hostBus) + patched.slice(insertion);
  return {conversationSource: patched, conversationTurnSource: patched};
}

function upgradeConversationCache(value) {
  const start = value.indexOf("const MTKoutboundReceiptContract=");
  const end = value.indexOf("function Oy(", start);
  if (start < 0 || end <= start || value.indexOf("const MTKoutboundReceiptContract=", start + 1) >= 0 ||
      !value.slice(start, end).includes("flatMap")) {
    throw new Error("Upstream changed: flat conversation receipt cache is not uniquely localized");
  }
  return value.slice(0, start) + conversationHelpers(resolveHostBus(value)) + value.slice(end);
}

function upgradeMainCache(value) {
  const start = value.indexOf("const MTKoutboundReceiptContract=");
  const ends = [
    value.indexOf("var dQ=i.i(`electron-message-handler`)", start),
    value.indexOf("var mQ=i.i(`electron-message-handler`)", start),
    value.indexOf("var pQ=i.i(`electron-message-handler`)", start),
    value.indexOf("var fQ=i.i(`electron-message-handler`)", start)
  ]
    .filter(index => index > start);
  if (start < 0 || ends.length !== 1 || value.indexOf("const MTKoutboundReceiptContract=", start + 1) >= 0 ||
      value.slice(start, ends[0]).includes("MTKoutboundReceiptTaskBucketLimit")) {
    throw new Error("Upstream changed: flat main-process receipt cache is not uniquely localized");
  }
  const electron = uniqueMatch(value, new RegExp(`await (?<electron>${id})\\.app\\.whenReady\\(\\)`, "g"), "Electron app owner").groups.electron;
  return value.slice(0, start) + mainHelpers(electron) + value.slice(ends[0]);
}

function ownerImportProfile(value) {
  const relative = `./${path.basename(target)}`;
  const match = uniqueMatch(
    value,
    new RegExp(`import\\{(?<specifiers>[^}]+)\\}from"${escapeRegExp(relative)}";`, "g"),
    "outbound owner import"
  );
  return {text: match[0], specifiers: match.groups.specifiers, relative};
}

function dynamicRendererProfile(value) {
  const linux = linuxBuild8881.dynamic;
  if (value.includes(linux.before) && value.includes(linux.call) && value.includes(linux.parentBefore)) {
    const start = value.indexOf(linux.owner);
    const owner = functionAt(value, start);
    const patchedFunction = replaceOnce(
      owner.text,
      linux.before,
      linux.after,
      "Linux build-8881 split dynamic renderer context body"
    );
    if (count(value, linux.call) !== 1) {
      throw new Error(`Upstream changed: found ${count(value, linux.call)} Linux build-8881 dynamic renderer calls`);
    }
    const callIndex = value.indexOf(linux.call);
    const parent = containingFunction(value, callIndex);
    if (!parent.text.startsWith(linux.parentBefore) || !parent.text.includes(linux.parentTurn)) {
      throw new Error("Upstream changed: Linux build-8881 source-turn owner is ambiguous");
    }
    const patchedParent = replaceOnce(
      parent.text,
      linux.parentBefore,
      linux.parentAfter,
      "Linux build-8881 source-turn cache size"
    );
    const patchedCall = linux.call
      .replace(linux.callDependencyBefore, linux.callDependencyAfter)
      .replace(linux.callBodyBefore, linux.callBodyAfter)
      .replace(linux.callStorageBefore, linux.callStorageAfter);
    return {
      variant: "split-8881-linux",
      functionText: owner.text,
      patchedFunction,
      callText: parent.text,
      patchedCallText: replaceOnce(patchedParent, linux.call, patchedCall, "Linux build-8881 source-turn call"),
      helperBoundary: linux.helperBoundary,
      react: linux.react,
      jsx: linux.jsx
    };
  }
  if (value.includes("function Cz(") && value.includes("Ih(o)?.render?.(o,l,i,c)")) {
    const start = value.indexOf("function Cz(");
    const owner = functionAt(value, start);
    const patchedFunction = replaceOnce(
      owner.text,
      "function Cz(e){let t=(0,wz.c)(16),{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s}=e,c=a===void 0||a,l=s===void 0?`row`:s;if(Xt(`off`,n)===`stopped`)return null;let u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l?(u=Ih(o)?.render?.(o,l,i,c),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=u):u=t[4]",
      "function Cz(e){let t=(0,wz.c)(17),{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s,sourceTurnId:h}=e,c=a===void 0||a,l=s===void 0?`row`:s;if(Xt(`off`,n)===`stopped`)return null;let u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l||t[16]!==h?(u=Ih(o)?.render?.(o,l,i,c,{conversationId:n,turnId:h}),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[16]=h,t[4]=u):u=t[4]",
      "build-8881 split dynamic renderer context body"
    );
    const call = uniqueMatch(
      value,
      /\(e=\(0,\$\.jsx\)\(Cz,\{agentActivityIcon:Ie,conversationId:f,enableTimelineTargets:we,item:n\}\),t\[354\]=Ie,t\[355\]=f,t\[356\]=we,t\[357\]=n,t\[358\]=e\)/g,
      "build-8881 split conversation dynamic renderer call"
    );
    const parent = containingFunction(value, call.index);
    if (!parent.text.startsWith("function NW(e){let t=(0,JW.c)(371),") || !parent.text.includes("turnId:T,")) {
      throw new Error("Upstream changed: build-8881 source-turn owner is ambiguous");
    }
    const patchedParent = replaceOnce(
      parent.text,
      "function NW(e){let t=(0,JW.c)(371),",
      "function NW(e){let t=(0,JW.c)(372),",
      "build-8881 source-turn cache size"
    );
    const patchedCall = call[0]
      .replace("t[357]!==n?", "t[357]!==n||t[371]!==T?")
      .replace("enableTimelineTargets:we,item:n}", "enableTimelineTargets:we,item:n,sourceTurnId:T}")
      .replace("t[357]=n,t[358]=e", "t[357]=n,t[371]=T,t[358]=e");
    return {
      variant: "split-8881",
      functionText: owner.text,
      patchedFunction,
      callText: parent.text,
      patchedCallText: replaceOnce(patchedParent, call[0], patchedCall, "build-8881 source-turn call"),
      helperBoundary: "function Cz(",
      react: "t(r(),1)",
      jsx: "Tz"
    };
  }
  if (value.includes("function Cz(") && value.includes("wh(o)?.render?.(o,l,i,c)")) {
    const start = value.indexOf("function Cz(");
    const owner = functionAt(value, start);
    const patchedFunction = replaceOnce(
      owner.text,
      "function Cz(e){let t=(0,wz.c)(16),{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s}=e,c=a===void 0||a,l=s===void 0?`row`:s;if(Ut(`off`,n)===`stopped`)return null;let u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l?(u=wh(o)?.render?.(o,l,i,c),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=u):u=t[4]",
      "function Cz(e){let t=(0,wz.c)(17),{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s,sourceTurnId:h}=e,c=a===void 0||a,l=s===void 0?`row`:s;if(Ut(`off`,n)===`stopped`)return null;let u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l||t[16]!==h?(u=wh(o)?.render?.(o,l,i,c,{conversationId:n,turnId:h}),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[16]=h,t[4]=u):u=t[4]",
      "build-8690 split dynamic renderer context body"
    );
    const call = uniqueMatch(
      value,
      /\(e=\(0,\$\.jsx\)\(Cz,\{agentActivityIcon:Ie,conversationId:d,enableTimelineTargets:Ce,item:n\}\),t\[354\]=Ie,t\[355\]=d,t\[356\]=Ce,t\[357\]=n,t\[358\]=e\)/g,
      "build-8690 split conversation dynamic renderer call"
    );
    const parent = containingFunction(value, call.index);
    if (!parent.text.startsWith("function FW(e){let t=(0,XW.c)(371),") || !parent.text.includes("turnId:C,")) {
      throw new Error("Upstream changed: build-8690 source-turn owner is ambiguous");
    }
    const patchedParent = replaceOnce(
      parent.text,
      "function FW(e){let t=(0,XW.c)(371),",
      "function FW(e){let t=(0,XW.c)(372),",
      "build-8690 source-turn cache size"
    );
    const patchedCall = call[0]
      .replace("t[357]!==n?", "t[357]!==n||t[371]!==C?")
      .replace("enableTimelineTargets:Ce,item:n}", "enableTimelineTargets:Ce,item:n,sourceTurnId:C}")
      .replace("t[357]=n,t[358]=e", "t[357]=n,t[371]=C,t[358]=e");
    return {
      variant: "split-8690",
      functionText: owner.text,
      patchedFunction,
      callText: parent.text,
      patchedCallText: replaceOnce(patchedParent, call[0], patchedCall, "build-8690 source-turn call"),
      helperBoundary: "function Cz(",
      react: "t(r(),1)",
      jsx: "Tz"
    };
  }
  if (value.includes("function gx(") && value.includes("Nh(o)?.render?.(o,l,i,c)")) {
    const start = value.indexOf("function gx(");
    const owner = functionAt(value, start);
    const patchedFunction = replaceOnce(
      owner.text,
      "{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s}=e,c=a===void 0||a,l=s===void 0?`row`:s,u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l?(u=Nh(o)?.render?.(o,l,i,c),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=u):u=t[4]",
      "{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s,sourceTurnId:h}=e,c=a===void 0||a,l=s===void 0?`row`:s,u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l||t[4]!==h?(u=Nh(o)?.render?.(o,l,i,c,{conversationId:n,turnId:h}),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=h,t[5]=u):u=t[5]",
      "build-8576 split dynamic renderer context body"
    );
    const call = uniqueMatch(
      value,
      /\(e=\(0,\$\.jsx\)\(gx,\{agentActivityIcon:Re,conversationId:f,enableTimelineTargets:Te,item:n\}\),t\[338\]=Re,t\[339\]=f,t\[340\]=Te,t\[341\]=n,t\[342\]=e\)/g,
      "build-8576 split conversation dynamic renderer call"
    );
    const parent = containingFunction(value, call.index);
    if (!parent.text.startsWith("function ME(e){let t=(0,KE.c)(355),") || !parent.text.includes("turnId:T,")) {
      throw new Error("Upstream changed: build-8576 source-turn owner is ambiguous");
    }
    const patchedParent = replaceOnce(
      parent.text,
      "function ME(e){let t=(0,KE.c)(355),",
      "function ME(e){let t=(0,KE.c)(356),",
      "build-8576 source-turn cache size"
    );
    const patchedCall = call[0]
      .replace("t[341]!==n?", "t[341]!==n||t[355]!==T?")
      .replace("enableTimelineTargets:Te,item:n}", "enableTimelineTargets:Te,item:n,sourceTurnId:T}")
      .replace("t[341]=n,t[342]=e", "t[341]=n,t[355]=T,t[342]=e");
    return {
      variant: "split-8576",
      functionText: owner.text,
      patchedFunction,
      callText: parent.text,
      patchedCallText: replaceOnce(patchedParent, call[0], patchedCall, "build-8576 source-turn call"),
      helperBoundary: "function gx(",
      react: "t(x(),1)",
      jsx: "$"
    };
  }
  if (value.includes("function hx(") && value.includes("Mh(o)?.render?.(o,l,i,c)")) {
    const start = value.indexOf("function hx(");
    const owner = functionAt(value, start);
    const patchedFunction = replaceOnce(
      owner.text,
      "{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s}=e,c=a===void 0||a,l=s===void 0?`row`:s,u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l?(u=Mh(o)?.render?.(o,l,i,c),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=u):u=t[4]",
      "{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s,sourceTurnId:h}=e,c=a===void 0||a,l=s===void 0?`row`:s,u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l||t[4]!==h?(u=Mh(o)?.render?.(o,l,i,c,{conversationId:n,turnId:h}),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=h,t[5]=u):u=t[5]",
      "split dynamic renderer context body"
    );
    const call = uniqueMatch(
      value,
      /\(e=\(0,\$\.jsx\)\(hx,\{agentActivityIcon:Ie,conversationId:d,enableTimelineTargets:we,item:n\}\),t\[338\]=Ie,t\[339\]=d,t\[340\]=we,t\[341\]=n,t\[342\]=e\)/g,
      "split conversation dynamic renderer call"
    );
    return {
      variant: "split-8378",
      functionText: owner.text,
      patchedFunction,
      callText: call[0],
      patchedCallText: call[0].replace("enableTimelineTargets:we,item:n}", "enableTimelineTargets:we,item:n,sourceTurnId:w}"),
      helperBoundary: "function hx(",
      react: "gS",
      jsx: "_x"
    };
  }
  const start = value.indexOf("function Ub(");
  const owner = functionAt(value, start);
  if (!owner.text.includes("rh(o)?.render(o,l,i,c)")) {
    throw new Error("Upstream changed: dynamic renderer call is missing");
  }
  const patchedFunction = replaceOnce(
    owner.text,
    "{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s}=e,c=a===void 0||a,l=s===void 0?`row`:s,u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l?(u=rh(o)?.render(o,l,i,c),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=u):u=t[4]",
    "{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s,sourceTurnId:h}=e,c=a===void 0||a,l=s===void 0?`row`:s,u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l||t[4]!==h?(u=rh(o)?.render(o,l,i,c,{conversationId:n,turnId:h}),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=h,t[5]=u):u=t[5]",
    "dynamic renderer context body"
  );
  const call = uniqueMatch(
    value,
    /\(e=\(0,[$A-Z_a-z][$\w]*\.jsx\)\(Ub,\{agentActivityIcon:Ne,conversationId:d,enableTimelineTargets:xe,item:n\}\),t\[332\]=Ne,t\[333\]=d,t\[334\]=xe,t\[335\]=n,t\[336\]=e\)/g,
    "conversation dynamic renderer call"
  );
  return {
    variant: "combined-legacy",
    functionText: owner.text,
    patchedFunction,
    callText: call[0],
    patchedCallText: call[0].replace("enableTimelineTargets:xe,item:n", "enableTimelineTargets:xe,item:n,sourceTurnId:S")
  };
}

function splitTurnProfile(value, linux) {
  const relative = `./${path.basename(conversationTarget)}`;
  const imported = uniqueMatch(
    value,
    new RegExp(`import\\{(?<specifiers>[^}]+)\\}from"${escapeRegExp(relative)}";`, "g"),
    "split conversation renderer import"
  );
  if (linux != null && value.includes(linux.owner) && value.includes(linux.marker) && value.includes(linux.boundary)) {
    const before = linux.boundary;
    return {
      importText: imported[0], specifiers: imported.groups.specifiers, relative,
      before,
      after: `$(\`mtk-outbound-turn-receipts\`,(0,Q.jsx)(MTKOutboundTurnReceipts,{conversationId:${linux.conversationId},turnId:${linux.turnId}}),{canOwnLatestTurnFollowContent:!1});${before}`
    };
  }
  if (!value.includes("function _i(") || !value.includes("{conversationId:s")) {
    if (value.includes("function bi(e){let t=(0,Ki.c)(216),") && value.includes("conversationId:o") &&
        value.includes("turnId:m") && value.includes("let Ha=za.length,Ua={")) {
      const before = "let Ha=za.length,Ua={";
      return {
        importText: imported[0], specifiers: imported.groups.specifiers, relative,
        before,
        after: '$(`mtk-outbound-turn-receipts`,(0,Q.jsx)(MTKOutboundTurnReceipts,{conversationId:o,turnId:m}),{canOwnLatestTurnFollowContent:!1});let Ha=za.length,Ua={'
      };
    }
    if (value.includes("function bi(e){let t=(0,Ki.c)(216),") && value.includes("conversationId:o") &&
        value.includes("turnId:p") && value.includes("let Ha=za.length,Ua={")) {
      const before = "let Ha=za.length,Ua={";
      return {
        importText: imported[0], specifiers: imported.groups.specifiers, relative,
        before,
        after: '$(`mtk-outbound-turn-receipts`,(0,Q.jsx)(MTKOutboundTurnReceipts,{conversationId:o,turnId:p}),{canOwnLatestTurnFollowContent:!1});let Ha=za.length,Ua={'
      };
    }
    throw new Error("Upstream changed: split turn renderer ownership is missing");
  }
  if (value.includes("function _i(e){let t=(0,Hi.c)(208),") && value.includes("turnId:f,")) {
    const before = "let Ra=Fa.length,za={";
    const after = '$(`mtk-outbound-turn-receipts`,(0,Q.jsx)(MTKOutboundTurnReceipts,{conversationId:s,turnId:f}),{canOwnLatestTurnFollowContent:!1});let Ra=Fa.length,za={';
    if (count(value, before) !== 1) throw new Error("Upstream changed: build-8576 pre-activity turn boundary is missing");
    return {
      importText: imported[0], specifiers: imported.groups.specifiers, relative,
      before,
      after
    };
  }
  if (!value.includes("turnId:d")) throw new Error("Upstream changed: split turn id is missing");
  const children = uniqueMatch(value, /children:\[qt,Va,Ha,Ua\]/g, "split turn root children")[0];
  return {
    importText: imported[0], specifiers: imported.groups.specifiers, relative,
    before: children,
    after: children.replace("children:[qt,", "children:[(0,Q.jsx)(MTKOutboundTurnReceipts,{conversationId:s,turnId:d}),qt,")
  };
}

function assistantProfile(value) {
  const start = value.indexOf("function Oy(");
  const owner = functionAt(value, start);
  const children = uniqueMatch(
    owner.text,
    /children:\[Ze,/g,
    "assistant message children"
  );
  return {children: children[0]};
}

function conversationHelperBoundary(value) {
  if (value.includes("function Cz(")) return "function Cz(";
  if (value.includes("function gx(")) return "function gx(";
  if (value.includes("function hx(")) return "function hx(";
  if (value.includes("function Oy(")) return "function Oy(";
  throw new Error("Upstream changed: outgoing receipt helper boundary is missing");
}

function resolveHostBus(value) {
  const busImports = [...value.matchAll(/import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/message-bus-[^"]+\.js)";/g)];
  if (busImports.length === 1) {
    const busSource = fs.readFileSync(path.resolve(path.dirname(conversationTarget), busImports[0].groups.relative), "utf8");
    const singleton = uniqueMatch(busSource, new RegExp(`,(?<internal>${id})=${id}\\.getInstance\\(\\),`, "g"), "message bus singleton").groups.internal;
    const exported = exportedAs(busSource, singleton);
    return uniqueMatch(
      busImports[0].groups.specifiers,
      new RegExp(`(?:^|,)${escapeRegExp(exported)} as (?<local>${id})(?=,|$)`, "g"),
      "conversation message bus import"
    ).groups.local;
  }
  const imported = uniqueMatch(value, /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g, "conversation app-initial import");
  const appInitial = fs.readFileSync(path.resolve(path.dirname(conversationTarget), imported.groups.relative), "utf8");
  const internal = appInitial.includes("function ALs(){") || appInitial.includes("function zLs(){") ? "H" : "U";
  const exported = exportedAs(appInitial, internal);
  return uniqueMatch(
    imported.groups.specifiers,
    new RegExp(`(?:^|,)${escapeRegExp(exported)} as (?<local>${id})(?=,|$)`, "g"),
    "conversation host bus import"
  ).groups.local;
}

function acklessConversationHelpers(hostBus, react = "Jy", jsx = "Yy") {
  return String.raw`const MTKoutboundReceiptContract="outgoing-message-receipt-v1",MTKoutboundReceiptLimit=256,MTKoutboundReceiptStates=new Map,MTKoutboundReceiptRequests=new Map;function MTKoutboundReceiptRecord(e){if(e==null||typeof e!=="object"||Array.isArray(e)||Object.keys(e).sort().join("\0")!=="callId\0contract\0prompt\0recordedAtMs\0sourceThreadId\0sourceTurnId\0targetHostId\0targetThreadId"||e.contract!==MTKoutboundReceiptContract||typeof e.callId!=="string"||e.callId.length===0||e.callId.length>256||typeof e.sourceThreadId!=="string"||e.sourceThreadId.length===0||typeof e.sourceTurnId!=="string"||e.sourceTurnId.length===0||typeof e.targetThreadId!=="string"||e.targetThreadId.length===0||typeof e.targetHostId!=="string"||e.targetHostId.length===0||typeof e.prompt!=="string"||!Number.isSafeInteger(e.recordedAtMs)||e.recordedAtMs<=0)return null;return e}function MTKoutboundReceiptState(e){let t=MTKoutboundReceiptStates.get(e);return t==null&&(t={loaded:!1,loading:!1,records:new Map,listeners:new Set},MTKoutboundReceiptStates.set(e,t)),t}function MTKoutboundReceiptValues(e){return[...e.records.values()].sort((e,t)=>e.recordedAtMs-t.recordedAtMs||e.callId.localeCompare(t.callId))}function MTKoutboundReceiptNotify(e){let t=MTKoutboundReceiptValues(e);for(let n of e.listeners)n(t)}function MTKoutboundRemember(e){if((e=MTKoutboundReceiptRecord(e))==null)return!1;let t=MTKoutboundReceiptState(e.sourceThreadId),n=t.records.get(e.callId);if(n!=null)return JSON.stringify(n)===JSON.stringify(e);t.records.set(e.callId,e);let r=MTKoutboundReceiptValues(t);for(let e of r.slice(0,Math.max(0,r.length-MTKoutboundReceiptLimit)))t.records.delete(e.callId);MTKoutboundReceiptNotify(t),${hostBus}.dispatchMessage("mtk-outbound-receipt-remember",{record:e});return!0}function MTKoutboundLoad(e){let t=MTKoutboundReceiptState(e);if(t.loaded||t.loading)return;t.loading=!0;let n=crypto.randomUUID();MTKoutboundReceiptRequests.set(n,e),${hostBus}.dispatchMessage("mtk-outbound-receipts-list",{requestId:n,sourceThreadId:e})}globalThis.__MTK_OUTBOUND_REMEMBER__=MTKoutboundRemember;${hostBus}.subscribe("mtk-outbound-receipts-result",e=>{if(typeof e?.requestId!=="string")return;let t=MTKoutboundReceiptRequests.get(e.requestId);if(t==null)return;MTKoutboundReceiptRequests.delete(e.requestId);let n=MTKoutboundReceiptState(t);n.loading=!1,n.loaded=!0;if(e.ok===!0&&Array.isArray(e.records))for(let r of e.records){r=MTKoutboundReceiptRecord(r);r!=null&&r.sourceThreadId===t&&!n.records.has(r.callId)&&n.records.set(r.callId,r)}MTKoutboundReceiptNotify(n)});function MTKOutboundTurnReceipts({conversationId:e,turnId:t}){let n=typeof e==="string"&&e.length>0&&typeof t==="string"&&t.length>0,r=n?MTKoutboundReceiptState(e):null,[i,a]=${react}.useState(()=>r==null?[]:MTKoutboundReceiptValues(r).filter(e=>e.sourceTurnId===t));return ${react}.useEffect(()=>{if(r==null)return;let n=e=>a(e.filter(e=>e.sourceTurnId===t));return r.listeners.add(n),MTKoutboundLoad(e),n(MTKoutboundReceiptValues(r)),()=>r.listeners.delete(n)},[e,t,r]),i.length===0?null:(0,${jsx}.jsx)("div",{"data-mtk-outgoing-message-receipts":!0,className:"mb-3 flex min-w-0 flex-col items-start gap-2",children:i.map(e=>(0,${jsx}.jsx)(MTKoutboundReceipt,{item:{arguments:{hostId:e.targetHostId,prompt:e.prompt,threadId:e.targetThreadId},completed:!0,success:!0}},e.callId))})}`;
}

function conversationHelpers(hostBus, react = "Jy", jsx = "Yy") {
  const ackless = acklessConversationHelpers(hostBus, react, jsx);
  const current = ackless
    .replace(
      "MTKoutboundReceiptStates=new Map,MTKoutboundReceiptRequests=new Map;",
      "MTKoutboundReceiptStates=new Map,MTKoutboundReceiptRequests=new Map,MTKoutboundReceiptRememberRequests=new Map;"
    )
    .replace(
      `function MTKoutboundRemember(e){if((e=MTKoutboundReceiptRecord(e))==null)return!1;let t=MTKoutboundReceiptState(e.sourceThreadId),n=t.records.get(e.callId);if(n!=null)return JSON.stringify(n)===JSON.stringify(e);t.records.set(e.callId,e);let r=MTKoutboundReceiptValues(t);for(let e of r.slice(0,Math.max(0,r.length-MTKoutboundReceiptLimit)))t.records.delete(e.callId);MTKoutboundReceiptNotify(t),${hostBus}.dispatchMessage("mtk-outbound-receipt-remember",{record:e});return!0}`,
      `function MTKoutboundRemember(e){if((e=MTKoutboundReceiptRecord(e))==null)return!1;let t=MTKoutboundReceiptState(e.sourceThreadId),n=t.records.get(e.callId);if(n!=null)return JSON.stringify(n)===JSON.stringify(e);for(let t of MTKoutboundReceiptRememberRequests.values())if(t.sourceThreadId===e.sourceThreadId&&t.callId===e.callId)return!1;let r=crypto.randomUUID();return MTKoutboundReceiptRememberRequests.set(r,e),${hostBus}.dispatchMessage("mtk-outbound-receipt-remember",{requestId:r,record:e}),!1}`
    )
    .replace(
      `globalThis.__MTK_OUTBOUND_REMEMBER__=MTKoutboundRemember;${hostBus}.subscribe("mtk-outbound-receipts-result"`,
      `globalThis.__MTK_OUTBOUND_REMEMBER__=MTKoutboundRemember;${hostBus}.subscribe("mtk-outbound-receipt-remember-result",e=>{if(typeof e?.requestId!=="string")return;let t=MTKoutboundReceiptRememberRequests.get(e.requestId);if(t==null)return;MTKoutboundReceiptRememberRequests.delete(e.requestId);let n=MTKoutboundReceiptRecord(e.record);if(e.ok!==!0||n==null||JSON.stringify(n)!==JSON.stringify(t))return;let r=MTKoutboundReceiptState(t.sourceThreadId);r.records.set(n.callId,n);let i=MTKoutboundReceiptValues(r);for(let e of i.slice(0,Math.max(0,i.length-MTKoutboundReceiptLimit)))r.records.delete(e.callId);MTKoutboundReceiptNotify(r)});${hostBus}.subscribe("mtk-outbound-receipts-result"`
    );
  if (current === ackless || !current.includes('subscribe("mtk-outbound-receipt-remember-result"')) {
    throw new Error("acknowledged outgoing receipt renderer helper construction failed");
  }
  return current;
}

function upgradeConversationAcknowledgment(value) {
  const start = value.indexOf("const MTKoutboundReceiptContract=");
  const end = value.indexOf("function Oy(", start);
  const hostBus = resolveHostBus(value);
  if (start < 0 || end <= start || value.slice(start, end) !== acklessConversationHelpers(hostBus)) {
    throw new Error("Upstream changed: unacknowledged outgoing receipt renderer helper is not uniquely localized");
  }
  return value.slice(0, start) + conversationHelpers(hostBus) + value.slice(end);
}

function patchMain(value) {
  const electron = uniqueMatch(value, new RegExp(`await (?<electron>${id})\\.app\\.whenReady\\(\\)`, "g"), "Electron app owner").groups.electron;
  const helperOwner = [
    "var dQ=i.i(`electron-message-handler`)",
    "var mQ=i.i(`electron-message-handler`)",
    "var pQ=i.i(`electron-message-handler`)",
    "var fQ=i.i(`electron-message-handler`)"
  ].find(marker => value.includes(marker));
  if (helperOwner == null) throw new Error("Upstream changed: outgoing receipt main helper owner is not recognized");
  let patched = replaceOnce(value, helperOwner, `${mainHelpers(electron)}${helperOwner}`, "outgoing receipt main helper owner");
  return replaceOnce(
    patched,
    "case`electron-add-new-workspace-root-option`:",
    `${currentMainHandlers()}case\`electron-add-new-workspace-root-option\`:`,
    "outgoing receipt main message handler"
  );
}

function acklessMainHandlers() {
  return "case`mtk-outbound-receipt-remember`:{MTKoutboundReceiptRemember(t?.record);break}case`mtk-outbound-receipts-list`:{let n=MTKoutboundReceiptList(t?.sourceThreadId);this.windowManager.sendMessageToWebContents(e,{type:`mtk-outbound-receipts-result`,requestId:typeof t?.requestId===`string`?t.requestId:``,ok:n!=null,records:n??[]});break}";
}

function currentMainHandlers() {
  return "case`mtk-outbound-receipt-remember`:{let n=MTKoutboundReceiptRemember(t?.record);this.windowManager.sendMessageToWebContents(e,{type:`mtk-outbound-receipt-remember-result`,requestId:typeof t?.requestId===`string`?t.requestId:``,ok:n!=null,record:n});break}case`mtk-outbound-receipts-list`:{let n=MTKoutboundReceiptList(t?.sourceThreadId);this.windowManager.sendMessageToWebContents(e,{type:`mtk-outbound-receipts-result`,requestId:typeof t?.requestId===`string`?t.requestId:``,ok:n!=null,records:n??[]});break}";
}

function upgradeMainAcknowledgment(value) {
  return replaceOnce(
    value,
    acklessMainHandlers(),
    currentMainHandlers(),
    "outgoing receipt acknowledged main handler"
  );
}

function mainHelpers(electron) {
  return String.raw`
const MTKoutboundReceiptContract="outgoing-message-receipt-v1";
const MTKoutboundReceiptLimit=256;
const MTKoutboundReceiptMaxBytes=131072;
const MTKoutboundReceiptTaskMaxBytes=8388608;
const MTKoutboundReceiptTaskBucketLimit=64;
const MTKoutboundReceiptFs=require("node:fs");
const MTKoutboundReceiptPath=require("node:path");
const MTKoutboundReceiptCrypto=require("node:crypto");
let MTKoutboundReceiptDir=null;
let MTKoutboundReceiptMigrating=!1;
function MTKoutboundReceiptRecord(e){
  if(e==null||typeof e!=="object"||Array.isArray(e)||Object.keys(e).sort().join("\0")!=="callId\0contract\0prompt\0recordedAtMs\0sourceThreadId\0sourceTurnId\0targetHostId\0targetThreadId"||e.contract!==MTKoutboundReceiptContract||typeof e.callId!=="string"||e.callId.length===0||e.callId.length>256||typeof e.sourceThreadId!=="string"||e.sourceThreadId.length===0||typeof e.sourceTurnId!=="string"||e.sourceTurnId.length===0||typeof e.targetThreadId!=="string"||e.targetThreadId.length===0||typeof e.targetHostId!=="string"||e.targetHostId.length===0||typeof e.prompt!=="string"||!Number.isSafeInteger(e.recordedAtMs)||e.recordedAtMs<=0)return null;
  return e;
}
function MTKoutboundReceiptHash(e){return MTKoutboundReceiptCrypto.createHash("sha256").update(e).digest("hex")}
function MTKoutboundReceiptPrivate(e){return process.platform==="win32"||(e.mode&63)===0}
function MTKoutboundReceiptPrepare(){
  if(MTKoutboundReceiptDir!=null)return!0;
  try{
    let e=MTKoutboundReceiptPath.join(${electron}.app.getPath("userData"),"mechanics-toolkit","task-message-receipts");
    MTKoutboundReceiptFs.mkdirSync(e,{recursive:!0,mode:448});
    MTKoutboundReceiptFs.chmodSync(e,448);
    let t=MTKoutboundReceiptFs.lstatSync(e);
    if(!t.isDirectory()||!MTKoutboundReceiptPrivate(t))return!1;
    MTKoutboundReceiptDir=e;
    MTKoutboundReceiptMigrating=!0;
    MTKoutboundReceiptMigrateLegacy();
    MTKoutboundReceiptMigrating=!1;
    MTKoutboundReceiptPruneBuckets(null);
    return!0;
  }catch{
    MTKoutboundReceiptMigrating=!1;
    MTKoutboundReceiptDir=null;
    return!1;
  }
}
function MTKoutboundReceiptTaskDir(e,t){
  if(!MTKoutboundReceiptPrepare()||typeof e!=="string"||e.length===0)return null;
  let n=MTKoutboundReceiptPath.join(MTKoutboundReceiptDir,MTKoutboundReceiptHash(e)),r=!1,i;
  try{i=MTKoutboundReceiptFs.lstatSync(n)}catch(e){
    if(!t||e?.code!=="ENOENT")return null;
    try{MTKoutboundReceiptFs.mkdirSync(n,{mode:448}),r=!0,i=MTKoutboundReceiptFs.lstatSync(n)}catch{return null}
  }
  try{MTKoutboundReceiptFs.chmodSync(n,448),i=MTKoutboundReceiptFs.lstatSync(n)}catch{return null}
  if(!i.isDirectory()||!MTKoutboundReceiptPrivate(i))return null;
  if(r&&!MTKoutboundReceiptMigrating)MTKoutboundReceiptPruneBuckets(n);
  return n;
}
function MTKoutboundReceiptFile(e,t,n){
  let r=MTKoutboundReceiptTaskDir(e,n);
  return r==null||typeof t!=="string"?null:MTKoutboundReceiptPath.join(r,MTKoutboundReceiptHash(t)+".json");
}
function MTKoutboundReceiptReadFile(e){
  let t,n;
  try{
    t=MTKoutboundReceiptFs.lstatSync(e);
    if(!t.isFile()||!MTKoutboundReceiptPrivate(t)||t.size<2||t.size>MTKoutboundReceiptMaxBytes)return null;
    n=MTKoutboundReceiptFs.readFileSync(e,"utf8");
  }catch{return null}
  if(!n.endsWith("\n")||n.slice(0,-1).includes("\n")||n.includes("\r"))return null;
  let r;
  try{r=JSON.parse(n.slice(0,-1))}catch{return null}
  return MTKoutboundReceiptRecord(r);
}
function MTKoutboundReceiptEntries(e){
  let t=[];
  try{
    for(let n of MTKoutboundReceiptFs.readdirSync(e)){
      if(!/^[0-9a-f]{64}\.json$/.test(n))continue;
      let r=MTKoutboundReceiptPath.join(e,n),i=MTKoutboundReceiptFs.lstatSync(r);
      if(i.isFile())t.push({path:r,mtime:i.mtimeMs,size:i.size});
    }
  }catch{}
  return t;
}
function MTKoutboundReceiptPruneTask(e,t){
  let n=MTKoutboundReceiptEntries(e),r=n.reduce((e,t)=>e+t.size,0);
  n.sort((e,n)=>e.path===t?1:n.path===t?-1:e.mtime-n.mtime||e.path.localeCompare(n.path));
  while(n.length>MTKoutboundReceiptLimit||r>MTKoutboundReceiptTaskMaxBytes){
    let e=n.shift();
    if(e==null)break;
    try{MTKoutboundReceiptFs.unlinkSync(e.path),r-=e.size}catch{}
  }
}
function MTKoutboundReceiptRemoveBucket(e){
  let t;
  try{
    t=MTKoutboundReceiptFs.lstatSync(e);
    if(!t.isDirectory()||!MTKoutboundReceiptPrivate(t))return!1;
    let n=MTKoutboundReceiptFs.readdirSync(e);
    if(n.some(e=>!/^[0-9a-f]{64}\.json$/.test(e)))return!1;
    for(let t of n){let n=MTKoutboundReceiptPath.join(e,t),r=MTKoutboundReceiptFs.lstatSync(n);if(!r.isFile())return!1}
    for(let t of n)MTKoutboundReceiptFs.unlinkSync(MTKoutboundReceiptPath.join(e,t));
    MTKoutboundReceiptFs.rmdirSync(e);
    return!0;
  }catch{return!1}
}
function MTKoutboundReceiptPruneBuckets(e){
  if(MTKoutboundReceiptDir==null)return;
  let t=[];
  try{
    for(let n of MTKoutboundReceiptFs.readdirSync(MTKoutboundReceiptDir)){
      if(!/^[0-9a-f]{64}$/.test(n))continue;
      let r=MTKoutboundReceiptPath.join(MTKoutboundReceiptDir,n),i=MTKoutboundReceiptFs.lstatSync(r);
      i.isDirectory()&&MTKoutboundReceiptPrivate(i)&&t.push({path:r,mtime:i.mtimeMs});
    }
  }catch{return}
  t.sort((t,n)=>t.path===e?1:n.path===e?-1:t.mtime-n.mtime||t.path.localeCompare(n.path));
  while(t.length>MTKoutboundReceiptTaskBucketLimit){
    let e=t.shift();
    if(e==null)break;
    MTKoutboundReceiptRemoveBucket(e.path);
  }
}
function MTKoutboundReceiptMigrateLegacy(){
  if(MTKoutboundReceiptDir==null)return;
  let e=[];
  try{e=MTKoutboundReceiptFs.readdirSync(MTKoutboundReceiptDir)}catch{return}
  for(let t of e){
    if(!/^[0-9a-f]{64}\.json$/.test(t))continue;
    let n=MTKoutboundReceiptPath.join(MTKoutboundReceiptDir,t),r=MTKoutboundReceiptReadFile(n);
    if(r==null)continue;
    let i=MTKoutboundReceiptFile(r.sourceThreadId,r.callId,!0);
    if(i==null)continue;
    let a=MTKoutboundReceiptReadFile(i);
    try{
      if(a==null)MTKoutboundReceiptFs.renameSync(n,i);
      else MTKoutboundReceiptFs.unlinkSync(n);
      MTKoutboundReceiptPruneTask(MTKoutboundReceiptPath.dirname(i),i);
    }catch{}
  }
}
function MTKoutboundReceiptWrite(e){
  if((e=MTKoutboundReceiptRecord(e))==null)return null;
  let t=MTKoutboundReceiptFile(e.sourceThreadId,e.callId,!0);
  if(t==null)return null;
  let n=MTKoutboundReceiptReadFile(t);
  if(n!=null)return n;
  let r=JSON.stringify(e)+"\n";
  if(Buffer.byteLength(r,"utf8")>MTKoutboundReceiptMaxBytes)return null;
  let i=MTKoutboundReceiptPath.join(MTKoutboundReceiptPath.dirname(t),"."+process.pid+"."+MTKoutboundReceiptCrypto.randomUUID()+".tmp");
  try{
    MTKoutboundReceiptFs.writeFileSync(i,r,{encoding:"utf8",mode:384,flag:"wx"});
    MTKoutboundReceiptFs.renameSync(i,t);
    MTKoutboundReceiptPruneTask(MTKoutboundReceiptPath.dirname(t),t);
    return MTKoutboundReceiptReadFile(t);
  }catch{
    try{MTKoutboundReceiptFs.unlinkSync(i)}catch{}
    return null;
  }
}
function MTKoutboundReceiptRemember(e){return MTKoutboundReceiptWrite(e)}
function MTKoutboundReceiptList(e){
  if(typeof e!=="string"||e.length===0||!MTKoutboundReceiptPrepare())return null;
  let t=MTKoutboundReceiptTaskDir(e,!1);
  if(t==null)return[];
  let n=[];
  for(let r of MTKoutboundReceiptEntries(t)){let t=MTKoutboundReceiptReadFile(r.path);t?.sourceThreadId===e&&n.push(t)}
  return n.sort((e,t)=>e.recordedAtMs-t.recordedAtMs||e.callId.localeCompare(t.callId));
}
`;
}

function sendProfile(value) {
  const statusOwners = [...value.matchAll(
    /case (?<sendTool>[$A-Z_a-z][$\w]*):return e\.completed\?`threadsSendMessageCompleted`:`threadsSendMessageActive`/g
  )];
  const sendTool = statusOwners.length === 1
    ? statusOwners[0].groups.sendTool
    : importedToolConstant(value, "send_message_to_thread");
  const functionAt = value.indexOf('e.tool===`send_message_to_thread`');
  const owner = containingFunction(value, functionAt);
  const header = uniqueMatch(
    owner.text,
    /function (?<genericRender>[$A-Z_a-z][$\w]*)\(e,t,n,[$A-Z_a-z][$\w]*=!0\)\{/g,
    "generic app-control renderer"
  ).groups;
  const render = header.genericRender === "X" && owner.text.includes("let e=r(l);ae.dispatchHostMessage({type:`navigate-to-route`,path:Ee()?A(e):p(e)})")
    ? {jsx: "Z", normalize: "r", hostBridge: "ae", routeFlag: "Ee", newRoute: "A", oldRoute: "p"}
    : uniqueMatch(
      owner.text,
      new RegExp(`${id}=\\(0,(?<jsx>${id})\\.jsxs\\)[\\s\\S]*?let e=(?<normalize>${id})\\(${id}\\);(?<hostBridge>${id})\\.dispatchHostMessage\\(\\{type:\`navigate-to-route\`,path:(?<routeFlag>${id})\\(\\)\\?(?<newRoute>${id})\\(e\\):(?<oldRoute>${id})\\(e\\)\\}\\)`, "g"),
      "existing task navigation owner"
    ).groups;
  const registry = uniqueMatch(
    value,
    new RegExp(
      `\\{namespace:(?<namespace>[$A-Z_a-z][$\\w]*),(?:persistentInCollapsedConversation:!0,)?render:(?:${header.genericRender}|MTKrenderOutboundMessage),` +
        `renderAgentActivityIcon:(?<icon>[$A-Z_a-z][$\\w]*),(?:standaloneInConversation:!0,)?tool:${sendTool}\\}`,
      "g"
    ),
    "send-message registry entry"
  ).groups;
  return {sendTool, ...header, ...render, ...registry, functionText: owner.text};
}

function importedToolConstant(value, toolName) {
  const imports = [...value.matchAll(/import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g)];
  if (imports.length !== 1) throw new Error("Upstream changed: app-initial tool import is not unique");
  const moduleSource = fs.readFileSync(path.resolve(path.dirname(target), imports[0].groups.relative), "utf8");
  const internal = uniqueMatch(
    moduleSource,
    new RegExp("(?<internal>" + id + ")=`" + escapeRegExp(toolName) + "`", "g"),
    `${toolName} constant`
  ).groups.internal;
  const exported = exportedAs(moduleSource, internal);
  return uniqueMatch(
    imports[0].groups.specifiers,
    new RegExp(`(?:^|,)${escapeRegExp(exported)} as (?<local>${id})(?=,|$)`, "g"),
    `${toolName} imported binding`
  ).groups.local;
}

function assertPersistentActivityContract(activitySource) {
  const persistentFunction = uniqueMatch(
    activitySource,
    new RegExp(`function (?<fn>${id})\\(e\\)\\{return ${id}\\(e\\)\\?\\.persistentInCollapsedConversation===!0\\}`, "g"),
    "collapsed-activity persistence classifier"
  ).groups.fn;
  const persistentExport = exportedAs(activitySource, persistentFunction);
  const ownerFiles = fs.readdirSync(assets).filter(name => {
    if (!name.endsWith(".js") || name === path.basename(target)) return false;
    const value = fs.readFileSync(path.join(assets, name), "utf8");
    return value.includes("persistentUnits") && value.includes("keepMcpAppEntriesPersistent") &&
      value.includes(`from\"./${path.basename(target)}\"`);
  });
  if (ownerFiles.length !== 1) {
    throw new Error(`Upstream changed: found ${ownerFiles.length} collapsed-activity owners`);
  }
  const owner = path.join(assets, ownerFiles[0]);
  const value = fs.readFileSync(owner, "utf8");
  const imported = uniqueMatch(
    value,
    new RegExp(
      `import\\{(?<specifiers>[^}]+)\\}from\"\\./${escapeRegExp(path.basename(target))}\";`,
      "g"
    ),
    "activity classifier import"
  ).groups.specifiers;
  const localClassifier = uniqueMatch(
    imported,
    new RegExp(`(?:^|,)${escapeRegExp(persistentExport)} as (?<local>${id})(?=,|$)`, "g"),
    "local persistence classifier"
  ).groups.local;
  if (!value.includes(`i.type===\`dynamic-tool-call\`&&${localClassifier}(i)`)) {
    throw new Error("Upstream changed: dynamic tools no longer consult the persistence classifier");
  }
  const persistentUnits = uniqueMatch(
    value,
    new RegExp(`(?<units>${id})=${id}!=null&&${id}\\.isCollapsed\\?${id}\\.persistentUnits:\\[\\]`, "g"),
    "collapsed persistent-unit projection"
  ).groups.units;
  const rendered = uniqueMatch(
    value,
    new RegExp(`(?<node>${id})=${escapeRegExp(persistentUnits)}\\.length===0\\?null:\\(0,${id}\\.jsx\\)\\(${id},\\{[\\s\\S]{0,300}?units:${escapeRegExp(persistentUnits)}\\}\\)`, "g"),
    "persistent-unit renderer"
  ).groups.node;
  if (![...value.matchAll(/children:\[(?<children>[^\]]{0,240})\]/g)].some(match =>
    match.groups.children.split(",").includes(rendered)
  )) {
    throw new Error("Upstream changed: persistent units are not returned outside the collapsed activity body");
  }
  return owner;
}

function resolveTaskImports(ownerSource) {
  const importMatch = uniqueMatch(
    ownerSource,
    /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g,
    "app-initial import"
  );
  const appInitialFile = path.resolve(path.dirname(target), importMatch.groups.relative);
  if (!appInitialFile.startsWith(path.resolve(root) + path.sep)) throw new Error("App import escaped extraction root");
  const appInitial = fs.readFileSync(appInitialFile, "utf8");
  const linux = linuxBuild8881.taskImports;
  if (appInitial.includes(linux.appRoot) && appInitial.includes(linux.taskOwner)) {
    const titleImport = uniqueMatch(
      ownerSource,
      /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-primary-[^"]+\.js)";/g,
      "app-primary import"
    );
    const appPrimaryFile = path.resolve(path.dirname(target), titleImport.groups.relative);
    if (!appPrimaryFile.startsWith(path.resolve(root) + path.sep)) throw new Error("App import escaped extraction root");
    const appPrimary = fs.readFileSync(appPrimaryFile, "utf8");
    if (!appPrimary.includes(linux.titleOwner) || !appPrimary.includes(linux.titleHelper)) {
      throw new Error("Upstream changed: Linux build-8881 live-title selector owner is not recognized");
    }
    const additions = [
      `${exportedAs(appInitial, linux.storeHook)} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, linux.storeScope)} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, linux.taskAtom)} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, linux.localThreadKey)} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, linux.remoteThreadKey)} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      titleImport: {
        relative: titleImport.groups.relative,
        exported: exportedAs(appPrimary, linux.titleAtom)
      },
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  if (appInitial.includes("function Jcs(){") && appInitial.includes("KB=rm(Q,")) {
    const titleImport = uniqueMatch(
      ownerSource,
      /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-primary-[^"]+\.js)";/g,
      "app-primary import"
    );
    const appPrimaryFile = path.resolve(path.dirname(target), titleImport.groups.relative);
    if (!appPrimaryFile.startsWith(path.resolve(root) + path.sep)) throw new Error("App import escaped extraction root");
    const appPrimary = fs.readFileSync(appPrimaryFile, "utf8");
    if (!appPrimary.includes("Q2t=Jf(o_,(e,{get:t})=>{") ||
        !appPrimary.includes("X2t({...n,localTitle:r})")) {
      throw new Error("Upstream changed: build-8881 live-title selector owner is not recognized");
    }
    const additions = [
      `${exportedAs(appInitial, "gm")} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, "Q")} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, "KB")} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, "yk")} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, "bk")} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      titleImport: {
        relative: titleImport.groups.relative,
        exported: exportedAs(appPrimary, "Q2t")
      },
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  if (appInitial.includes("function Ocs(){") && appInitial.includes("KB=am(Q,")) {
    const additions = [
      `${exportedAs(appInitial, "vm")} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, "Q")} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, "KB")} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, "yk")} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, "bk")} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  if (appInitial.includes("function zLs(){") && appInitial.includes("kW=Ny(Q,")) {
    const additions = [
      `${exportedAs(appInitial, "ub")} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, "Q")} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, "kW")} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, "PF")} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, "FF")} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  if (appInitial.includes("function ALs(){") && appInitial.includes("kW=Py(Q,")) {
    const additions = [
      `${exportedAs(appInitial, "db")} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, "Q")} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, "kW")} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, "FF")} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, "IF")} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  if (appInitial.includes("function Oks(){") && appInitial.includes("cW=Xy(Q,")) {
    const additions = [
      `${exportedAs(appInitial, "Db")} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, "Q")} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, "cW")} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, "oF")} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, "sF")} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  if (appInitial.includes("function Oks(){") && appInitial.includes("XU=zy(Q,")) {
    const additions = [
      `${exportedAs(appInitial, "hb")} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, "Q")} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, "XU")} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, "ZP")} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, "QP")} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  if (appInitial.includes("function qOs(){") && appInitial.includes("aW=Iy(Q,")) {
    const additions = [
      `${exportedAs(appInitial, "pb")} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, "Q")} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, "aW")} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, "QP")} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, "$P")} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  if (appInitial.includes("function g$c(e){") && appInitial.includes("VN=i_($,")) {
    const additions = [
      `${exportedAs(appInitial, "A_")} as MTKoutboundStoreHook`,
      `${exportedAs(appInitial, "$")} as MTKoutboundStoreScope`,
      `${exportedAs(appInitial, "VN")} as MTKoutboundTaskAtom`,
      `${exportedAs(appInitial, "gk")} as MTKoutboundLocalThreadKey`,
      `${exportedAs(appInitial, "_k")} as MTKoutboundRemoteThreadKey`
    ];
    return {
      before: importMatch[0],
      after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
      storeHook: "MTKoutboundStoreHook",
      storeScope: "MTKoutboundStoreScope"
    };
  }
  const projectUse = uniqueMatch(
    appInitial,
    new RegExp(`projectId:${id}\\.get\\((?<project>${id}),(?<keyForHost>${id})\\(${id}\\.id,${id}\\.hostId\\)\\)\\?\\.projectId\\?\\?null`, "g"),
    "thread project selector ownership"
  ).groups;
  const keyFunction = uniqueMatch(
    appInitial,
    new RegExp(
      "function " + projectUse.keyForHost + "\\((?<thread>" + id + "),(?<host>" + id +
        ")\\)\\{return \\k<host>===`local`\\?(?<local>" + id + ")\\((?<normalize>" + id +
        ")\\(\\k<thread>\\)\\):(?<remote>" + id + ")\\(\\k<thread>\\)\\}",
      "g"
    ),
    "thread key ownership"
  ).groups;
  const task = uniqueMatch(
    appInitial,
    new RegExp(
      "(?<task>" + id + ")=" + id + "\\(" + id + ",\\((?<key>" + id + "),\\{get:(?<get>" + id +
        ")\\}\\)=>\\{let (?<parsed>" + id + ")=" + id + "\\(\\k<key>\\);switch\\(\\k<parsed>\\?\\.kind\\)" +
        "\\{case`local`:\\{let " + id + "=" + id + "\\(\\k<get>,\\k<parsed>\\.threadId\\);if\\(" + id +
        "!=null\\)return \\k<get>\\(" + id + "," + id + "\\.clientThreadId\\);[\\s\\S]{0,600}?" +
        "case`remote`:return \\k<get>\\(" + id + ",\\k<parsed>\\.taskId\\);case void 0:return null\\}\\}\\)",
      "g"
    ),
    "thread task selector ownership"
  ).groups.task;
  const scope = uniqueMatch(appInitial, new RegExp(`${task}=${id}\\((?<scope>${id}),`, "g"), "task selector scope").groups.scope;
  const storeOwner = uniqueMatch(
    appInitial,
    new RegExp(
      `function (?<hook>${id})\\(e\\)\\{let t=\\(0,${id}\\.useContext\\)\\(${id}\\),n=${id}\\(t,e\\),` +
        `r=${id}\\(n\\),i=\\(0,${id}\\.useRef\\)\\(null\\);`,
      "g"
    ),
    "renderer store hook ownership"
  ).groups.hook;
  const additions = [
    `${exportedAs(appInitial, storeOwner)} as MTKoutboundStoreHook`,
    `${exportedAs(appInitial, scope)} as MTKoutboundStoreScope`,
    `${exportedAs(appInitial, task)} as MTKoutboundTaskAtom`,
    `${exportedAs(appInitial, keyFunction.local)} as MTKoutboundLocalThreadKey`,
    `${exportedAs(appInitial, keyFunction.remote)} as MTKoutboundRemoteThreadKey`
  ];
  return {
    before: importMatch[0],
    after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`,
    storeHook: "MTKoutboundStoreHook",
    storeScope: "MTKoutboundStoreScope"
  };
}

function requiresDedicatedTitleSelector(ownerSource) {
  const importMatch = uniqueMatch(
    ownerSource,
    /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g,
    "app-initial import"
  );
  const appInitialFile = path.resolve(path.dirname(target), importMatch.groups.relative);
  if (!appInitialFile.startsWith(path.resolve(root) + path.sep)) throw new Error("App import escaped extraction root");
  const appInitial = fs.readFileSync(appInitialFile, "utf8");
  const linux = linuxBuild8881.taskImports;
  return appInitial.includes("function Jcs(){") && appInitial.includes("KB=rm(Q,") ||
    appInitial.includes(linux.appRoot) && appInitial.includes(linux.taskOwner);
}

function resolvePresentationOwners(ownerSource) {
  const appImports = [...ownerSource.matchAll(/import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-(?:initial|primary)-[^"]+\.js)";/g)];
  const hoverOwners = appImports.map(appImport => {
    const file = path.resolve(path.dirname(target), appImport.groups.relative);
    if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error("App import escaped extraction root");
    return { appImport, file, source: fs.readFileSync(file, "utf8") };
  }).filter(owner => owner.source.includes("skipDelayKey:`diff-preview`"));
  if (hoverOwners.length !== 1) throw new Error(`Upstream changed: found ${hoverOwners.length} imported native diff hover owners`);
  const { appImport, source: appInitial } = hoverOwners[0];
  const diffPreview = uniqueMatch(
    appInitial,
    new RegExp(
      `\\(0,${id}\\.jsx\\)\\((?<tooltip>${id}),\\{align:\`center\`,closeOnTriggerBlur:!1,` +
        `delayDuration:(?<delay>${id}),[\\s\\S]{0,900}?interactive:!0,[\\s\\S]{0,900}?` +
        `skipDelayKey:\`diff-preview\`,[\\s\\S]{0,1200}?variant:\`unstyled\``,
      "g"
    ),
    "native diff hover owner"
  ).groups;
  if (!appInitial.includes(`${diffPreview.delay}=800`)) {
    throw new Error("Upstream changed: native diff hover delay is no longer 800ms");
  }
  let tooltipRelative = appImport.groups.relative;
  let tooltipExport;
  const appExports = uniqueMatch(appInitial, /export\{(?<specifiers>[^}]+)\}/g, "module export list").groups.specifiers;
  const localTooltipExports = [...appExports.matchAll(new RegExp(`(?:^|,)${escapeRegExp(diffPreview.tooltip)} as (?<export>${id})(?=,|$)`, "g"))];
  if (localTooltipExports.length === 1) {
    tooltipExport = exportedAs(appInitial, diffPreview.tooltip);
  } else {
    const imports = [...appInitial.matchAll(/import\{(?<specifiers>[^}]+)\}from"(?<relative>[^"]+)";/g)];
    const matches = imports.map(match => {
      const binding = new RegExp(`(?:^|,)(?<export>${id}) as ${escapeRegExp(diffPreview.tooltip)}(?=,|$)`).exec(match.groups.specifiers);
      return binding == null ? null : { match, binding };
    }).filter(Boolean);
    if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} native hover import owners`);
    tooltipRelative = matches[0].match.groups.relative;
    tooltipExport = matches[0].binding.groups.export;
  }

  const formatterFiles = assetFiles().filter(file => {
    const value = fs.readFileSync(file, "utf8");
    return value.includes("pluginMentionPresentation") && value.includes("externalLinkContextMenuConversationId") &&
      value.includes("whitespace-pre-wrap") && value.includes("markdownClassName");
  });
  if (formatterFiles.length !== 1) {
    throw new Error(`Upstream changed: found ${formatterFiles.length} recipient message formatter owners`);
  }
  const formatterFile = formatterFiles[0];
  const formatterSource = fs.readFileSync(formatterFile, "utf8");
  const formatterInternal = uniqueMatch(
    formatterSource,
    new RegExp(
      `function (?<formatter>${id})\\(e\\)\\{let ${id}=\\(0,${id}\\.c\\)\\((?:20|23|24)\\),` +
        `\\{text:${id},ref:${id},className:${id},components:${id},(?:directives:${id},)?externalLinkContextMenuConversationId:${id},` +
        `markdownClassName:${id},cwd:${id},hostId:${id},pluginMentionPresentation:${id},variant:${id}\\}=e`,
      "g"
    ),
    "recipient user-message formatter"
  ).groups.formatter;
  const formatterExports = [...uniqueMatch(formatterSource, /export\{(?<specifiers>[^}]+)\}/g, "formatter export list")
    .groups.specifiers.matchAll(new RegExp(`(?:^|,)${escapeRegExp(formatterInternal)} as (?<export>${id})(?=,|$)`, "g"))]
    .map(match => match.groups.export);
  if (formatterExports.length === 0) throw new Error("Upstream changed: recipient formatter is not exported");
  const formatterBasename = path.basename(formatterFile);
  const consumers = assetFiles().filter(file => {
    if (file === formatterFile) return false;
    const value = fs.readFileSync(file, "utf8");
    return value.includes(`from"./${formatterBasename}"`) && value.includes("collapsedLineCount") &&
      value.includes("externalLinkContextMenuConversationId");
  });
  if (consumers.length !== 1) {
    throw new Error(`Upstream changed: found ${consumers.length} recipient user-message consumers`);
  }
  const consumerSource = fs.readFileSync(consumers[0], "utf8");
  const consumerImport = uniqueMatch(
    consumerSource,
    new RegExp(`import\\{(?<specifiers>[^}]+)\\}from"\\./${escapeRegExp(formatterBasename)}";`, "g"),
    "recipient formatter import"
  ).groups.specifiers;
  const formatterBinding = uniqueMatch(
    consumerImport,
    new RegExp(`(?:^|,)(?<export>${formatterExports.map(escapeRegExp).join("|")}) as (?<local>${id})(?=,|$)`, "g"),
    "recipient formatter local binding"
  ).groups;
  const formatterExport = formatterBinding.export;
  const formatterLocal = formatterBinding.local;
  uniqueMatch(
    consumerSource,
    new RegExp(
      `\\(0,${id}\\.jsx\\)\\(${escapeRegExp(formatterLocal)},\\{cwd:${id},` +
        `(?:directives:${id},)?externalLinkContextMenuConversationId:${id},hostId:${id},text:${id}(?:,variant:\`user-message\`)?\\}\\)`,
      "g"
    ),
    "recipient user-message formatter call"
  );
  return {
    appRelative: tooltipRelative,
    tooltipExport,
    formatterFile,
    formatterRelative: `./${formatterBasename}`,
    formatterExport
  };
}

function addImportSpecifier(value, relative, specifier, label) {
  if (value.includes(`,${specifier}}from"${relative}";`) || value.includes(`{${specifier}}from"${relative}";`)) return value;
  const pattern = new RegExp(`import\\{(?<specifiers>[^}]+)\\}from"${escapeRegExp(relative)}";`, "g");
  const matches = [...value.matchAll(pattern)];
  if (matches.length === 1) {
    return replaceOnce(value, matches[0][0], `import{${matches[0].groups.specifiers},${specifier}}from"${relative}";`, label);
  }
  if (matches.length !== 0) throw new Error(`Upstream changed: ${label} owner is ambiguous`);
  const appImport = uniqueMatch(value, /import\{[^}]+\}from"\.\/app-initial-[^"]+\.js";/g, "app-initial import insertion point");
  return replaceOnce(value, appImport[0], `${appImport[0]}import{${specifier}}from"${relative}";`, label);
}

function assetFiles() {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  return fs.readdirSync(assets).filter(name => name.endsWith(".js")).map(name => path.join(assets, name));
}

function uniqueOwner() {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const matches = fs.readdirSync(assets).filter(name => {
    if (!name.endsWith(".js")) return false;
    const value = fs.readFileSync(path.join(assets, name), "utf8");
    return value.includes('e.tool===`send_message_to_thread`') &&
      (value.includes("localConversation.appControlToolCall.threadsSendMessage.active") ||
       value.includes("standaloneInConversation:!0") && value.includes("renderAgentActivityIcon:"));
  });
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} outbound-message owners`);
  return path.join(assets, matches[0]);
}

function uniqueConversationOwner() {
  const matches = fs.readdirSync(assets).filter(name => {
    if (!name.endsWith(".js")) return false;
    const value = fs.readFileSync(path.join(assets, name), "utf8");
    const combined = value.includes("function Ub(") && value.includes("function Oy(");
    const split = (value.includes("function Cz(") && (value.includes("Ih(o)?.render?.(o,l,i,c)") || value.includes("wh(o)?.render?.(o,l,i,c)"))) ||
      (value.includes("function hx(") && value.includes("Mh(o)?.render?.(o,l,i,c)")) ||
      (value.includes("function gx(") && value.includes("Nh(o)?.render?.(o,l,i,c)")) ||
      value.includes("function MTKOutboundTurnReceipts(");
    return (combined || split) && value.includes("toolActivityTurnKey") &&
      value.includes(`from"./${path.basename(target)}"`);
  });
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} conversation renderer owners`);
  return path.join(assets, matches[0]);
}

function uniqueConversationTurnOwner(owner) {
  const ownerSource = fs.readFileSync(owner, "utf8");
  if (ownerSource.includes("function Ub(") && ownerSource.includes("function Oy(")) return owner;
  const basename = path.basename(owner);
  const matches = fs.readdirSync(assets).filter(name => {
    if (!name.endsWith(".js") || name === basename) return false;
    const value = fs.readFileSync(path.join(assets, name), "utf8");
    return (value.includes("function _i(") || value.includes("function bi(e){let t=(0,Ki.c)(216),")) &&
      (value.includes("children:[qt,Va,Ha,Ua]") || value.includes("children:[Jt,Va,Ha,Ua]") ||
       value.includes("let Ha=za.length,Ua={") ||
       value.includes("MTKOutboundTurnReceipts,{conversationId:s,turnId:d}") ||
       value.includes("MTKOutboundTurnReceipts,{conversationId:s,turnId:f}")) &&
      value.includes(`from"./${basename}"`);
  });
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} conversation turn owners`);
  return path.join(assets, matches[0]);
}

function uniqueMainOwner() {
  const directory = path.join(root, ".vite/build");
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`Missing extracted main directory: ${directory}`);
  }
  const matches = fs.readdirSync(directory).filter(name => /^main-.*\.js$/.test(name));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} main owners`);
  return path.join(directory, matches[0]);
}

function assertStockStyles() {
  const styles = fs.readdirSync(assets).filter(name => name.endsWith(".css"))
    .map(name => fs.readFileSync(path.join(assets, name), "utf8")).join("\n");
  for (const token of [
    "bg-surface-secondary\\/40",
    "border-border\\/70",
    "text-text-tertiary\\/90",
    "focus-visible\\:ring-ring"
  ]) {
    if (!styles.includes(token)) throw new Error(`Upstream changed: missing stock receipt style ${token}`);
  }
}

function containingFunction(value, position) {
  if (position < 0) throw new Error("send-message renderer seam is missing");
  let start = value.lastIndexOf("function ", position);
  while (start >= 0) {
    const candidate = functionAt(value, start);
    if (position < candidate.end) return candidate;
    start = value.lastIndexOf("function ", start - 1);
  }
  throw new Error("could not locate send-message renderer function");
}

function functionAt(value, start) {
  const open = value.indexOf("{", start);
  let quote = null, escaped = false, depth = 1;
  for (let index = open + 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return {start, end: index + 1, text: value.slice(start, index + 1)};
  }
  throw new Error("function did not terminate");
}

function exportedAs(value, internal) {
  const specifiers = uniqueMatch(value, /export\{(?<specifiers>[^}]+)\}/g, "module export list").groups.specifiers;
  return uniqueMatch(
    specifiers,
    new RegExp(`(?:^|,)${escapeRegExp(internal)} as (?<export>${id})(?=,|$)`, "g"),
    `export for ${internal}`
  ).groups.export;
}

function uniqueMatch(value, pattern, label) {
  const matches = [...value.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} matches for ${label}`);
  return matches[0];
}

function replaceOnce(value, before, after, label) {
  const first = value.indexOf(before);
  if (first < 0 || value.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Upstream changed: ${label} is not unique`);
  }
  return value.slice(0, first) + after + value.slice(first + before.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function count(value, needle) {
  return value.split(needle).length - 1;
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
