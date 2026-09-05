#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const configPath = readOption("--config");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: tinrelay-pointer-presentation/patch.mjs check|apply EXTRACTED_ASAR_ROOT [--config TOOLKIT_CONFIG]");
}

const assets = path.join(root, "webview/assets");
const renderer = uniqueFile(/^(?:subagent-activity-chip-group|conversation-blocks)-.*\.js$/);
const main = uniqueFile(/^main-.*\.js$/, path.join(root, ".vite/build"));
let rendererSource = fs.readFileSync(renderer, "utf8");
let mainSource = fs.readFileSync(main, "utf8");
let state = inspectState();

if (command === "apply" && state === "needs-apply") {
  const config = configuredTinrelay();
  rendererSource = patchRenderer(rendererSource, config.localShip);
  mainSource = patchMain(mainSource, config);
  fs.writeFileSync(renderer, rendererSource);
  fs.writeFileSync(main, mainSource);
  moduleSyntaxCheck(renderer);
  moduleSyntaxCheck(main);
  state = inspectState();
  if (state !== "applied") throw new Error("Tinrelay pointer transform did not verify");
}

const embedded = state === "applied" ? embeddedConfiguration() : null;

process.stdout.write(`${JSON.stringify({
  state,
  contract: "tinrelay-local-pointer-v1",
  source: "any-delegated-message-with-exact-pointer-shape",
  client: embedded?.client ?? null,
  localShip: embedded?.localShip ?? null,
  targets: [renderer, main].map(file => path.relative(root, file))
}, null, 2)}\n`);

function inspectState() {
  const rendererBaseMarkers = [
    "function MTKtinrelayPointerFromMessage(",
    "function MTKtinrelayPointerView(",
    "messageNode:MTKtinrelayPointerNode(",
    "data-mtk-tinrelay-pointer",
    '.dispatchMessage("mtk-tinrelay-pointer-inspect"',
    '.subscribe("mtk-tinrelay-pointer-result"'
  ];
  const mainBaseMarkers = [
    "const MTKtinrelayClient=",
    ",MTKtinrelayLocalShip=",
    "function MTKtinrelayMainPointer(",
    "async function MTKtinrelayInspect(",
    "case`mtk-tinrelay-pointer-inspect`:",
    "type:`mtk-tinrelay-pointer-result`"
  ];
  const rendererPatched = rendererBaseMarkers.every(marker => rendererSource.includes(marker));
  const mainPatched = mainBaseMarkers.every(marker => mainSource.includes(marker));
  if (rendererPatched && mainPatched) {
    inspectAppliedRenderer(rendererSource);
    inspectAppliedMain(mainSource);
    embeddedConfiguration();
    return "applied";
  }
  if (rendererBaseMarkers.some(marker => rendererSource.includes(marker)) ||
      mainBaseMarkers.some(marker => mainSource.includes(marker))) {
    throw new Error("Upstream changed: Tinrelay pointer patch is partial");
  }
  inspectPristineRenderer(rendererSource);
  inspectPristineMain(mainSource);
  return "needs-apply";
}

function inspectPristineRenderer(source) {
  const message = functionAt(source, source.indexOf("function vb("));
  const delegation = functionAt(source, source.indexOf("function Cb("));
  if (!message.text.includes("collapsedLineCount:xb") || !message.text.includes("threadId:r") ||
      !delegation.text.includes("sourceThreadId:r") || !delegation.text.includes("message:i") ||
      count(delegation.text, "(0,Tb.jsx)(vb,") !== 1) {
    throw new Error("Upstream changed: delegated message renderer contract is not recognized");
  }
  if (!["var yb,bb,xb,Sb=e((()=>{yb=un(),Hn(),Mg(),bb=Y(),xb=2}))",
    "var yb,bb,xb,Sb=e((()=>{yb=wt(),js(),Mg(),bb=X(),xb=2}))"].some(owner => source.includes(owner))) {
    throw new Error("Upstream changed: delegated message renderer module owner is not recognized");
  }
  resolveHostBus(source);
}

function inspectAppliedRenderer(source) {
  inspectAppliedRendererBase(source);
  const helpers = helperSlice(source);
  for (const contract of [
    "function MTKtinrelayAddress(",
    'function MTKtinrelayPointerFromMessage(e){if(typeof e!=="string"',
    'children:["📡 ",u]',
    'MTKtinrelayAddress(r.transmission.authorLabel,r.transmission.senderShip)',
    'r.transmission.authorLabel===null?r.transmission.senderShip:',
    'MTKtinrelayAddress(r.transmission.attentionLabel,r.transmission.localShip)',
    'function MTKtinrelayEnsureStyle()',
    'mtk-tinrelay-signal',
    '@media (prefers-reduced-motion:reduce)',
    'background:#0B0C0E',
    'border-color:#34383D',
    'repeating-radial-gradient',
    'circle at 14% 82%',
    '35px 43px',
    'animation:mtk-tinrelay-signal 18s ease-out infinite',
    'mtk-tinrelay-body{color:#F1F3F5}',
    'r.status==="ready"?(0,Tb.jsx)'
  ]) {
    if (!helpers.includes(contract)) throw new Error(`Tinrelay renderer postcondition missing: ${contract}`);
  }
  if (!["MTKtinrelayReact=t(Wo(),1)", "MTKtinrelayReact=t(ic(),1)"].some(marker => source.includes(marker))) {
    throw new Error("Tinrelay renderer React owner is not initialized");
  }
  if (source.includes("dangerouslySetInnerHTML") &&
      helperSlice(source).includes("dangerouslySetInnerHTML")) {
    throw new Error("Tinrelay body must not use an HTML injection surface");
  }
  for (const forbidden of [
    "MTKoutboundFormattedText",
    "markdown",
    "innerHTML",
    "window.open",
    "eval(",
    "From: ",
    "To: ",
    "Attention: ",
    "Local ID: "
  ]) {
    if (helpers.includes(forbidden)) throw new Error(`Tinrelay renderer uses forbidden surface: ${forbidden}`);
  }
  for (const retired of ["Hide transmission", "Show transmission", "aria-expanded", "bg-surface-secondary/50", "linear-gradient(110deg"]) {
    if (helpers.includes(retired)) throw new Error(`Tinrelay renderer retains retired disclosure surface: ${retired}`);
  }
  resolveHostBus(source);
}

function inspectAppliedRendererBase(source) {
  const message = functionAt(source, source.indexOf("function vb("));
  const delegation = functionAt(source, source.indexOf("function Cb("));
  for (const contract of ["messageNode:MTKmessageNode", "MTKmessageNode??(f?"]) {
    if (!message.text.includes(contract) && !delegation.text.includes(contract)) {
      throw new Error(`Tinrelay renderer postcondition missing: ${contract}`);
    }
  }
  if (!delegation.text.includes("messageNode:MTKtinrelayPointerNode(")) {
    throw new Error("Tinrelay renderer postcondition missing: pointer presentation call");
  }
  resolveHostBus(source);
}

function inspectPristineMain(source) {
  for (const contract of [
    'let x=require("node:child_process")',
    "var mQ=i.i(`electron-message-handler`)",
    "case`show-plan-summary`:break;case`update-diff-if-open`:break;",
    "case`electron-add-new-workspace-root-option`:"
  ]) {
    if (count(source, contract) !== 1) {
      throw new Error(`Upstream changed: Tinrelay main-process contract is not unique: ${contract}`);
    }
  }
}

function inspectAppliedMain(source) {
  inspectAppliedMainBase(source);
  const helpers = mainHelperSlice(source);
  for (const contract of [
    'typeof a==="string"&&a.length>0&&typeof o==="string"&&o===a',
    'a===null&&(o===void 0||o===null)',
    "authorLabel:a"
  ]) {
    if (!helpers.includes(contract)) throw new Error(`Tinrelay main postcondition missing: ${contract}`);
  }
}

function inspectAppliedMainBase(source) {
  const helpers = mainHelperSlice(source);
  for (const contract of [
    'x.execFile(MTKtinrelayClient,["inbox","show",e.local_id,"--ship",e.local_ship]',
    "shell:!1",
    "timeout:8e3",
    "maxBuffer:1048576",
    "signed_transmission",
    "recipient_ship!==t.local_ship",
    "sender_ship!==t.sender_ship",
    "attention_label!==t.attention_label"
  ]) {
    if (!helpers.includes(contract)) throw new Error(`Tinrelay main base postcondition missing: ${contract}`);
  }
  for (const forbidden of ["execSync", "spawn(", "shell:!0", "stderr", "process.env["]) {
    if (helpers.includes(forbidden)) throw new Error(`Tinrelay main helper uses forbidden surface: ${forbidden}`);
  }
  if (count(source, "case`mtk-tinrelay-pointer-inspect`:") !== 1) {
    throw new Error("Tinrelay main message handler is not unique");
  }
}

function patchRenderer(value, localShip) {
  const hostBus = resolveHostBus(value);
  const profile = value.includes("var yb,bb,xb,Sb=e((()=>{yb=un(),Hn(),Mg(),bb=Y(),xb=2}))") ?
    {cache: "un", initializer: "Hn", jsx: "Y", react: "Wo"} :
    {cache: "wt", initializer: "js", jsx: "X", react: "ic"};
  const moduleBefore = `var yb,bb,xb,Sb=e((()=>{yb=${profile.cache}(),${profile.initializer}(),Mg(),bb=${profile.jsx}(),xb=2}))`;
  const moduleAfter = `var yb,MTKtinrelayReact,bb,xb,Sb=e((()=>{yb=${profile.cache}(),${profile.initializer}(),Mg(),MTKtinrelayReact=t(${profile.react}(),1),bb=${profile.jsx}(),xb=2}))`;
  let patched = replaceOnce(value, moduleBefore, moduleAfter, "delegated message module owner");

  const messageStart = patched.indexOf("function vb(");
  const message = functionAt(patched, messageStart);
  const cache = /let t=\(0,yb\.c\)\((?<size>\d+)\)/.exec(message.text);
  if (cache == null) throw new Error("Upstream changed: delegated message cache owner is missing");
  const cacheSize = Number(cache.groups.size);
  let messageAfter = message.text.replace(cache[0], `let t=(0,yb.c)(${cacheSize + 1})`);
  if (messageAfter.includes("paletteSourceId:MTKsourceId}=e")) {
    messageAfter = replaceOnce(
      messageAfter,
      "paletteSourceId:MTKsourceId}=e",
      "paletteSourceId:MTKsourceId,messageNode:MTKmessageNode}=e",
      "composed delegated message-node property"
    );
  } else {
    messageAfter = replaceOnce(
      messageAfter,
      "compactActions:c,onLabelClick:l}=e",
      "compactActions:c,onLabelClick:l,messageNode:MTKmessageNode}=e",
      "stock delegated message-node property"
    );
  }
  messageAfter = replaceOnce(
    messageAfter,
    "?(m=f?(0,bb.jsx)(Eg,{",
    `||t[${cacheSize}]!==MTKmessageNode?(m=MTKmessageNode??(f?(0,bb.jsx)(Eg,{`,
    "delegated message-node branch"
  );
  messageAfter = replaceOnce(
    messageAfter,
    "):null,t[5]=u",
    `):null),t[${cacheSize}]=MTKmessageNode,t[5]=u`,
    "delegated message-node cache"
  );
  patched = patched.slice(0, message.start) + messageAfter + patched.slice(message.end);

  const delegationStart = patched.indexOf("function Cb(");
  const delegation = functionAt(patched, delegationStart);
  const delegationAfter = replaceOnce(
    delegation.text,
    "(vb,{conversationId:n,label:p,message:i,",
    "(vb,{conversationId:n,label:p,message:i,messageNode:MTKtinrelayPointerNode(i),",
    "Tinrelay pointer presentation"
  );
  patched = patched.slice(0, delegation.start) + delegationAfter + patched.slice(delegation.end);
  patched = patched.slice(0, delegation.start) + rendererHelpers(hostBus, localShip) + patched.slice(delegation.start);
  patched = patchTinrelayLabelOwner(patched);
  return patched;
}

function rendererHelpers(hostBus, localShip) {
  return String.raw`const MTKtinrelayLocalShip=${JSON.stringify(localShip)};function MTKtinrelayPointerFromMessage(e){if(typeof e!=="string"||e.includes("\r"))return null;let t=e.endsWith("\n")?e.slice(0,-1):e,n=t.split("\n");if(n.length!==2||n[0]!=="TINRELAY LOCAL POINTER")return null;let r;try{r=JSON.parse(n[1])}catch{return null}if(r==null||typeof r!=="object"||Array.isArray(r))return null;let i=["attention_label","contract","kind","local_id","local_ship","sender_ship"];if(Object.keys(r).sort().join("\0")!==i.join("\0")||r.contract!=="tinrelay-local-pointer-v1"||r.kind!=="transmission"||typeof r.local_id!=="string"||!/^tr_[0-9a-f]{32}$/.test(r.local_id)||r.local_ship!==MTKtinrelayLocalShip||typeof r.sender_ship!=="string"||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(r.sender_ship)||typeof r.attention_label!=="string")return null;return r}function MTKtinrelayPointerNode(e){return MTKtinrelayPointerFromMessage(e)==null?null:(0,Tb.jsx)(MTKtinrelayPointerView,{pointerText:e})}function MTKtinrelayAddress(e,t){return e+"@"+t}function MTKtinrelayEnsureStyle(){if(document.getElementById("mtk-tinrelay-signal-style"))return;let e=document.createElement("style");e.id="mtk-tinrelay-signal-style",e.textContent="@keyframes mtk-tinrelay-signal{0%{transform:scale(.82);opacity:.32}55%{opacity:.72}100%{transform:scale(1.18);opacity:.24}}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal{position:relative;overflow:hidden;isolation:isolate;background:#0B0C0E;border-color:#34383D;color:#F1F3F5}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{content:\"\";position:absolute;z-index:0;inset:-38%;pointer-events:none;background:repeating-radial-gradient(circle at 14% 82%,transparent 0 34px,rgba(116,124,134,.24) 35px 43px,transparent 44px 78px);animation:mtk-tinrelay-signal 18s ease-out infinite}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal>*{position:relative;z-index:1}[data-mtk-tinrelay-pointer] .mtk-tinrelay-route{color:#A8ADB4}[data-mtk-tinrelay-pointer] .mtk-tinrelay-body{color:#F1F3F5}@media (prefers-reduced-motion:reduce){[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{animation:none;transform:scale(1);opacity:.34}}",document.head.appendChild(e)}function MTKtinrelayPointerView({pointerText:e}){MTKtinrelayEnsureStyle();let n=MTKtinrelayPointerFromMessage(e),[r,i]=MTKtinrelayReact.useState({status:"loading"}),a=MTKtinrelayReact.useRef(null),o=MTKtinrelayReact.useRef(!1);MTKtinrelayReact.useEffect(()=>{let s=${hostBus}.subscribe("mtk-tinrelay-pointer-result",e=>{if(e?.requestId!==a.current)return;a.current=null;if(e.ok!==!0||e.transmission==null){i({status:"error",error:typeof e.error==="string"?e.error:"Tinrelay inspection failed."});return}let t=e.transmission;t.localId===n.local_id&&t.localShip===n.local_ship&&t.senderShip===n.sender_ship&&t.attentionLabel===n.attention_label&&(t.authorLabel===null||typeof t.authorLabel==="string"&&t.authorLabel.length>0)&&typeof t.body==="string"?i({status:"ready",transmission:t}):i({status:"error",error:"Tinrelay inspection did not match this pointer."})});if(!o.current){o.current=!0;let c=crypto.randomUUID();a.current=c,${hostBus}.dispatchMessage("mtk-tinrelay-pointer-inspect",{requestId:c,pointerText:e})}return s},[n.local_id,n.local_ship,n.sender_ship,n.attention_label]);let u=r.status==="ready"?(r.transmission.authorLabel===null?r.transmission.senderShip:MTKtinrelayAddress(r.transmission.authorLabel,r.transmission.senderShip))+" → "+MTKtinrelayAddress(r.transmission.attentionLabel,r.transmission.localShip):"Tinrelay transmission from "+n.sender_ship;return(0,Tb.jsxs)("div",{className:"flex w-full flex-col items-end justify-end gap-1",children:[(0,Tb.jsxs)("div",{className:"text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description",children:["📡 ",u]}),(0,Tb.jsxs)("div",{"data-mtk-tinrelay-pointer":!0,className:"mtk-tinrelay-signal flex min-w-0 flex-col gap-2 rounded-xl border px-3 py-2 text-start",style:{maxWidth:"min(42rem,92%)"},children:[r.status==="loading"?(0,Tb.jsx)("div",{className:"text-xs mtk-tinrelay-route",children:"Inspecting…"}):null,r.status==="error"?(0,Tb.jsx)("div",{role:"alert",className:"text-xs text-danger",children:r.error}):null,r.status==="ready"?(0,Tb.jsx)("div",{className:"mtk-tinrelay-body min-w-0 rounded-lg px-3 py-2 text-size-chat",style:{overflowWrap:"anywhere",userSelect:"text",whiteSpace:"pre-wrap"},children:r.transmission.body}):null]})]})}`;
}

function patchMain(value, config) {
  let patched = replaceOnce(
    value,
    "var mQ=i.i(`electron-message-handler`)",
    `${mainHelpers(config)}var mQ=i.i(\`electron-message-handler\`)`,
    "Tinrelay main helper owner"
  );
  patched = replaceOnce(
    patched,
    "case`electron-add-new-workspace-root-option`:",
    "case`mtk-tinrelay-pointer-inspect`:{let n;try{let r=await MTKtinrelayInspect(t);n={type:`mtk-tinrelay-pointer-result`,requestId:t.requestId,ok:!0,transmission:r}}catch(r){n={type:`mtk-tinrelay-pointer-result`,requestId:typeof t.requestId===`string`?t.requestId:``,ok:!1,error:r instanceof Error?r.message:`Tinrelay inspection failed.`}}this.windowManager.sendMessageToWebContents(e,n);break}case`electron-add-new-workspace-root-option`:",
    "Tinrelay main message handler"
  );
  return patched;
}

function mainHelpers(config) {
  return String.raw`const MTKtinrelayClient=${JSON.stringify(config.client)},MTKtinrelayLocalShip=${JSON.stringify(config.localShip)};function MTKtinrelayMainPointer(e){if(typeof e?.requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(e.requestId)||typeof e.pointerText!=="string"||e.pointerText.includes("\r"))throw Error("Invalid local Tinrelay pointer.");let t=e.pointerText.endsWith("\n")?e.pointerText.slice(0,-1):e.pointerText,n=t.split("\n");if(n.length!==2||n[0]!=="TINRELAY LOCAL POINTER")throw Error("Invalid local Tinrelay pointer.");let r;try{r=JSON.parse(n[1])}catch{throw Error("Invalid local Tinrelay pointer.")}let i=["attention_label","contract","kind","local_id","local_ship","sender_ship"];if(r==null||typeof r!=="object"||Array.isArray(r)||Object.keys(r).sort().join("\0")!==i.join("\0")||r.contract!=="tinrelay-local-pointer-v1"||r.kind!=="transmission"||typeof r.local_id!=="string"||!/^tr_[0-9a-f]{32}$/.test(r.local_id)||r.local_ship!==MTKtinrelayLocalShip||typeof r.sender_ship!=="string"||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(r.sender_ship)||typeof r.attention_label!=="string")throw Error("Invalid local Tinrelay pointer.");return r}function MTKtinrelayExec(e){return new Promise((t,n)=>{x.execFile(MTKtinrelayClient,["inbox","show",e.local_id,"--ship",e.local_ship],{encoding:"utf8",maxBuffer:1048576,shell:!1,timeout:8e3,windowsHide:!0},(r,i)=>{if(r){n(Error(r.code==="ENOENT"?"Tinrelay client is unavailable.":"Tinrelay could not inspect this transmission."));return}t(i)})})}async function MTKtinrelayInspect(e){let t=MTKtinrelayMainPointer(e),n=await MTKtinrelayExec(t),r;try{r=JSON.parse(n)}catch{throw Error("Tinrelay returned an invalid inspection.")}if(r==null||typeof r!=="object"||Array.isArray(r)||r.contract!=="tinrelay-inspected-inbox-v1"||r.kind!=="transmission"||r.signed_transmission==null||typeof r.signed_transmission!=="object"||Array.isArray(r.signed_transmission))throw Error("Tinrelay inspection did not match this pointer.");let i=r.signed_transmission,a=r.author_label,o=i.from_label,s=typeof a==="string"&&a.length>0&&typeof o==="string"&&o===a||a===null&&(o===void 0||o===null);if(r.local_id!==t.local_id||r.recipient_ship!==t.local_ship||r.sender_ship!==t.sender_ship||r.attention_label!==t.attention_label||!s||r.sender_ship!==i.sender_ship||r.recipient_ship!==i.recipient_ship||r.attention_label!==i.to_label||typeof i.body!=="string")throw Error("Tinrelay inspection did not match this pointer.");return{localId:r.local_id,localShip:r.recipient_ship,senderShip:r.sender_ship,attentionLabel:r.attention_label,authorLabel:a,body:i.body}}`;
}

function patchTinrelayLabelOwner(value) {
  const start = value.indexOf("function vb(");
  const message = functionAt(value, start);
  if (message.text.includes("MTKmessageNode?null:")) return value;
  const cache = /let t=\(0,yb\.c\)\((?<size>\d+)\)/.exec(message.text);
  if (cache == null) throw new Error("Upstream changed: delegated message label cache owner is missing");
  const cacheSize = Number(cache.groups.size);
  let after = message.text.replace(cache[0], `let t=(0,yb.c)(${cacheSize + 1})`);
  const merge = message.text.includes("className:jc(`text-size-chat-sm") ? "jc" : "At";
  const before = `t[2]!==n||t[3]!==l?(p=l?(0,bb.jsx)(\`button\`,{type:\`button\`,className:${merge}(\`text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description\`,\`cursor-interaction rounded-md hover:text-default\`),onClick:l,children:n}):(0,bb.jsx)(\`div\`,{className:\`text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description\`,children:n}),t[2]=n,t[3]=l,t[4]=p):p=t[4]`;
  const replacement = `t[2]!==n||t[3]!==l||t[${cacheSize}]!==MTKmessageNode?(p=MTKmessageNode?null:l?(0,bb.jsx)(\`button\`,{type:\`button\`,className:${merge}(\`text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description\`,\`cursor-interaction rounded-md hover:text-default\`),onClick:l,children:n}):(0,bb.jsx)(\`div\`,{className:\`text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description\`,children:n}),t[2]=n,t[3]=l,t[${cacheSize}]=MTKmessageNode,t[4]=p):p=t[4]`;
  after = replaceOnce(after, before, replacement, "Tinrelay stock delegated-label suppression");
  return value.slice(0, message.start) + after + value.slice(message.end);
}


function resolveHostBus(source) {
  const imported = uniqueMatch(
    source,
    /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g,
    "app-initial import"
  );
  const appInitial = fs.readFileSync(path.resolve(path.dirname(renderer), imported.groups.relative), "utf8");
  const exported = exportedAs(appInitial, "U");
  const binding = uniqueMatch(
    imported.groups.specifiers,
    new RegExp(`(?:^|,)${escapeRegExp(exported)} as (?<local>[$A-Z_a-z][$\\w]*)(?=,|$)`, "g"),
    "renderer host-bus import"
  );
  return binding.groups.local;
}

function exportedAs(source, internal) {
  const exports = source.slice(source.lastIndexOf("export{"));
  return uniqueMatch(
    exports,
    new RegExp(`(?:^|,)${escapeRegExp(internal)} as (?<exported>[$A-Z_a-z][$\\w]*)(?=,|\\})`, "g"),
    `export for ${internal}`
  ).groups.exported;
}

function helperSlice(source) {
  const start = source.indexOf("function MTKtinrelayPointerFromMessage(");
  const end = source.indexOf("function Cb(", start);
  if (start < 0 || end < 0) throw new Error("Tinrelay renderer helper boundary is missing");
  return source.slice(start, end);
}

function mainHelperSlice(source) {
  const start = source.indexOf("const MTKtinrelayClient=");
  const end = source.indexOf("var mQ=i.i(`electron-message-handler`)", start);
  if (start < 0 || end < 0) throw new Error("Tinrelay main helper boundary is missing");
  return source.slice(start, end);
}

function functionAt(source, start) {
  if (start < 0) throw new Error("function owner is missing");
  const open = source.indexOf("{", start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "`" || char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error("unterminated function owner");
}

function uniqueFile(pattern, directory = assets) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`missing extracted directory: ${directory}`);
  }
  const found = fs.readdirSync(directory).filter(name => pattern.test(name));
  if (found.length !== 1) throw new Error(`expected one ${pattern}, found ${found.length}`);
  return path.join(directory, found[0]);
}

function replaceOnce(value, before, after, label) {
  const first = value.indexOf(before);
  if (first < 0 || value.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Upstream changed: ${label} is not unique`);
  }
  return value.slice(0, first) + after + value.slice(first + before.length);
}

function uniqueMatch(value, pattern, label) {
  const matches = [...value.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Upstream changed: ${label} matches ${matches.length}`);
  return matches[0];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function readOption(name) {
  const index = process.argv.indexOf(name, 4);
  if (index < 0) return null;
  if (index !== process.argv.length - 2 || !process.argv[index + 1]) {
    throw new Error(`usage: ${name} must be followed by one value`);
  }
  return path.resolve(process.argv[index + 1]);
}

function configuredTinrelay() {
  if (configPath == null) throw new Error("tinrelay-pointer-presentation apply requires --config TOOLKIT_CONFIG");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read toolkit config: ${error.message}`);
  }
  if (config == null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Toolkit config must be a JSON object");
  }
  const tinrelay = config.tinrelay;
  if (tinrelay == null || typeof tinrelay !== "object" || Array.isArray(tinrelay) ||
      Object.keys(tinrelay).some(key => key !== "client" && key !== "localShip")) {
    throw new Error("Toolkit config tinrelay must contain only client and localShip");
  }
  const client = tinrelay.client;
  const localShip = tinrelay.localShip;
  if (typeof client !== "string" || !path.isAbsolute(client) || path.parse(client).root === path.resolve(client)) {
    throw new Error("Toolkit config tinrelay.client must be an absolute non-root path");
  }
  if (!validShip(localShip)) {
    throw new Error("Toolkit config tinrelay.localShip must be a lowercase DNS-style ship name");
  }
  return {client: path.resolve(client), localShip};
}

function embeddedConfiguration() {
  const literal = '"(?:\\\\.|[^"\\\\])*"';
  const renderer = uniqueMatch(
    rendererSource,
    new RegExp(`const MTKtinrelayLocalShip=(?<ship>${literal});function MTKtinrelayPointerFromMessage\\(`, "g"),
    "embedded renderer Tinrelay configuration"
  ).groups;
  const main = uniqueMatch(
    mainSource,
    new RegExp(`const MTKtinrelayClient=(?<client>${literal}),MTKtinrelayLocalShip=(?<ship>${literal});function MTKtinrelayMainPointer\\(`, "g"),
    "embedded main Tinrelay configuration"
  ).groups;
  const config = {client: JSON.parse(main.client), localShip: JSON.parse(main.ship)};
  if (JSON.parse(renderer.ship) !== config.localShip || !path.isAbsolute(config.client) || !validShip(config.localShip)) {
    throw new Error("Upstream changed: embedded Tinrelay configuration is inconsistent");
  }
  return config;
}

function validShip(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

function moduleSyntaxCheck(file) {
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
