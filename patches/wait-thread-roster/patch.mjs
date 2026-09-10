#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const id = "[$A-Z_a-z][$\\w]*";
const legacyTaskColorFunction = 'function MTKwaitTaskColor(e,t){try{let n=globalThis.__MTK_PATCH_REGISTRY__;if(n?.apiVersion!==1)return null;let r=n.packages?.taskVisualPalette;if(r?.version!==1||typeof r.resolveTaskColor!=="function")return null;let i=r.resolveTaskColor({taskId:e,title:t});return typeof i==="string"&&/^#[0-9A-Fa-f]{6}$/.test(i)?i.toUpperCase():null}catch{return null}}';
const themedTaskColorFunctions = `${legacyTaskColorFunction}function MTKwaitParseHex(e){return{r:parseInt(e.slice(1,3),16),g:parseInt(e.slice(3,5),16),b:parseInt(e.slice(5,7),16)}}function MTKwaitMix(e,t,n){let r=MTKwaitParseHex(e),i=MTKwaitParseHex(t),a=e=>Math.round(e).toString(16).padStart(2,"0");return("#"+a(r.r+(i.r-r.r)*n)+a(r.g+(i.g-r.g)*n)+a(r.b+(i.b-r.b)*n)).toUpperCase()}function MTKwaitLum(e){let t=Object.values(MTKwaitParseHex(e)).map(e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4});return.2126*t[0]+.7152*t[1]+.0722*t[2]}function MTKwaitContrast(e,t){let n=MTKwaitLum(e),r=MTKwaitLum(t);return(Math.max(n,r)+.05)/(Math.min(n,r)+.05)}function MTKwaitLabelColor(e,t){let n=t?.38:.34,r=t?"#FFFFFF":"#111318",i=t?"#101114":"#FFFFFF";for(;n<=1.001;n+=.08){let t=MTKwaitMix(e,r,Math.min(1,n));if(MTKwaitContrast(t,i)>=4.5)return t}return r}`;
const legacyTaskColorStyle = 'let n=t.color==null?void 0:{color:"color-mix(in srgb, "+t.color+" 68%, var(--color-text) 32%)"},r=';
const themedTaskColorStyle = 'let n=t.color==null?void 0:{color:"light-dark("+MTKwaitLabelColor(t.color,!1)+","+MTKwaitLabelColor(t.color,!0)+")"},r=';
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: wait-thread-roster/patch.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const target = uniqueOwner();
let source = fs.readFileSync(target, "utf8");
let state = inspectState(source);

if (command === "apply" && state === "legacy-active-spacing") {
  source = replaceOnce(source, 'e.completed||l.unshift(" ");let u=', "let u=", "legacy active wait spacing mutation");
  source = replaceOnce(source, 'children:o}),...l,e.completed?null:"…"]})', 'children:o})," ",...l,e.completed?null:"…"]})', "wait roster explicit spacing");
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState(source);
}

if (command === "apply" && state === "legacy-link-cursor") {
  source = replaceOnce(
    source,
    'className:"rounded-sm font-medium text-text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"',
    'className:"cursor-pointer rounded-sm font-medium text-text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"',
    "wait roster link cursor"
  );
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState(source);
}

if (command === "apply" && state === "legacy-theme-label") {
  source = replaceOnce(source, legacyTaskColorFunction, themedTaskColorFunctions, "wait roster contrast helpers");
  source = replaceOnce(source, legacyTaskColorStyle, themedTaskColorStyle, "wait roster theme-aware label color");
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState(source);
}

if (command === "apply" && state === "needs-apply") {
  source = patchSource(source);
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState(source);
  if (state !== "applied") throw new Error("wait-thread roster transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  names: "hydrated-task-titles",
  links: "known-tasks",
  colors: "optional-task-visual-palette",
  targets: [path.relative(root, target)]
}, null, 2)}\n`);

function inspectState(value) {
  const markers = [
    "function MTKwaitTargets(",
    "function MTKwaitTaskLabel(",
    "function MTKwaitResolvedTarget(",
    "function MTKrenderWaitThreads(",
    "data-mtk-wait-thread-roster",
    "let r=n.packages?.crossTaskAttribution",
    "tool:`wait_threads`"
  ];
  const present = markers.map(marker => value.includes(marker));
  if (present.every(Boolean)) {
    if (count(value, "function MTKrenderWaitThreads(") !== 1 || count(value, "tool:`wait_threads`") !== 1) {
      throw new Error("Unrecognized wait-thread roster patch: renderer ownership is ambiguous");
    }
    if (value.includes('e.completed||l.unshift(" ");')) return "legacy-active-spacing";
    if (!value.includes('children:o})," ",...l,e.completed?null:"…"]})')) {
      throw new Error("Unrecognized wait-thread roster patch: first-target spacing is missing");
    }
    if (!value.includes('className:"cursor-pointer rounded-sm font-medium text-text-secondary')) {
      return "legacy-link-cursor";
    }
    if (!value.includes("function MTKwaitLabelColor(") || value.includes(legacyTaskColorStyle)) {
      return "legacy-theme-label";
    }
    return "applied";
  }
  if (present.some(Boolean)) throw new Error("Unrecognized wait-thread roster patch: partial markers");
  inspectPristine(value);
  return "needs-apply";
}

function inspectPristine(value) {
  const profile = rendererProfile(value);
  if (value.includes("wait_threads") || value.includes("tool:`wait_threads`")) {
    throw new Error("Upstream changed: wait_threads already has renderer-local ownership");
  }
  if (!value.includes("threadsReadActive") || !value.includes("threadsSendMessageActive")) {
    throw new Error("Upstream changed: app-control renderer status family is incomplete");
  }
  resolveTaskImports(value);
}

function patchSource(value) {
  const profile = rendererProfile(value);
  const imports = resolveTaskImports(value);
  const helper = buildHelper(profile);
  const waitEntry = `{namespace:${profile.namespace},render:MTKrenderWaitThreads,renderAgentActivityIcon:${profile.icon},tool:\`wait_threads\`}`;
  let patched = replaceOnce(value, profile.functionText, `${helper}${profile.functionText}`, "wait roster helper");
  patched = replaceOnce(patched, profile.sendEntry, `${waitEntry},${profile.sendEntry}`, "wait roster registry entry");
  return replaceOnce(patched, imports.before, imports.after, "wait roster task imports");
}

function buildHelper(profile) {
  const helper = String.raw`
function MTKwaitTargets(e){if(e==null||typeof e!=="object"||Array.isArray(e)||!Array.isArray(e.targets)||e.targets.length<1||e.targets.length>8)return null;let t=[];for(let n of e.targets){if(n==null||typeof n!=="object"||Array.isArray(n)||typeof n.threadId!=="string"||n.threadId.length<1||n.threadId.length>256||n.hostId!==void 0&&(typeof n.hostId!=="string"||n.hostId.length<1||n.hostId.length>256))return null;t.push({hostId:n.hostId??"local",threadId:n.threadId})}return t}function MTKwaitFallbackLabel(e){if(typeof e!=="string")return null;let t=e.trim();if(t.length===0)return null;let n=t.indexOf(" — ");return n>0?t.slice(0,n).trim():t}function MTKwaitTaskLabel(e){let t=MTKwaitFallbackLabel(e);if(t==null)return null;try{let n=globalThis.__MTK_PATCH_REGISTRY__;if(n?.apiVersion!==1)return t;let r=n.packages?.crossTaskAttribution;if(r?.version!==2||typeof r.resolveTaskLabel!=="function")return t;let i=r.resolveTaskLabel({title:e});return typeof i==="string"&&i.trim().length>0?i.trim():t}catch{return t}}function MTKwaitTaskColor(e,t){try{let n=globalThis.__MTK_PATCH_REGISTRY__;if(n?.apiVersion!==1)return null;let r=n.packages?.taskVisualPalette;if(r?.version!==1||typeof r.resolveTaskColor!=="function")return null;let i=r.resolveTaskColor({taskId:e,title:t});return typeof i==="string"&&/^#[0-9A-Fa-f]{6}$/.test(i)?i.toUpperCase():null}catch{return null}}function MTKwaitResolvedTarget(e,t){let n=t?.kind==="local"?(t.conversation?.title??t.catalogTitle??t.summary?.title):t?.kind==="remote"?t.task?.title:null;return{color:MTKwaitTaskColor(e.threadId,n),known:t!=null,label:MTKwaitTaskLabel(n)??"Task "+e.threadId.slice(0,8)+"…",target:e,title:n}}function MTKwaitNavigate(e){let t=${profile.normalize}(e);${profile.hostBridge}.dispatchHostMessage({type:"navigate-to-route",path:${profile.routeFlag}()?${profile.newRoute}(t):${profile.oldRoute}(t)})}function MTKWaitThreadRoster({item:e,variant:t,agentActivityIcon:n}){let r=MTKwaitStoreHook(MTKwaitStoreScope),i=MTKwaitTargets(e.arguments);if(i==null)return null;let a=i.map(e=>{let t=e.hostId==="local"?MTKwaitLocalThreadKey(e.threadId):MTKwaitRemoteThreadKey(e.threadId);return MTKwaitResolvedTarget(e,r.get(MTKwaitTaskAtom,t))}),o=e.completed?e.success===!1?"Wait failed for":"Waited for":"Waiting for",s=t==="row"&&n!==void 0,c=s?"summary-text":t,l=[];for(let e=0;e<a.length;e++){let t=a[e];e>0&&l.push((0,${profile.jsx}.jsx)("span",{className:"text-text-tertiary/70",children:e===a.length-1&&a.length>2?", and ":a.length===2?" and ":", "},"separator-"+e));let n=t.color==null?void 0:{color:"color-mix(in srgb, "+t.color+" 68%, var(--color-text) 32%)"},r=t.target.hostId+":"+t.target.threadId+":"+e;l.push(t.known?(0,${profile.jsx}.jsx)("button",{"aria-label":"Open "+(t.title??t.label),className:"cursor-pointer rounded-sm font-medium text-text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",onClick:e=>{e.preventDefault(),e.stopPropagation(),MTKwaitNavigate(t.target.threadId)},style:n,type:"button",children:t.label},r):(0,${profile.jsx}.jsx)("span",{className:"font-medium text-text-secondary",style:n,children:t.label},r))}let u=(0,${profile.jsx}.jsxs)(${profile.container},{"data-mtk-wait-thread-roster":!0,className:${profile.classNames}("text-size-chat",c==="row"?"text-text-tertiary/90":"text-text/40 group-hover/activity-header:text-default"),children:[c==="summary-text"?null:${profile.iconFunction}(e),(0,${profile.jsx}.jsxs)("span",{className:${profile.classNames}(c!=="summary-text"&&"min-w-0"),children:[(0,${profile.jsx}.jsx)(${profile.spinner},{active:!e.completed,children:o})," ",...l,e.completed?null:"…"]})]});return s?(0,${profile.jsx}.jsx)(${profile.summaryWrapper},{icon:n,summary:u}):u}function MTKrenderWaitThreads(e,t,n){return(0,${profile.jsx}.jsx)(MTKWaitThreadRoster,{agentActivityIcon:n,item:e,variant:t})}
`;
  const themed = helper.replace(legacyTaskColorFunction, themedTaskColorFunctions).replace(legacyTaskColorStyle, themedTaskColorStyle);
  if (!themed.includes(themedTaskColorFunctions) || !themed.includes(themedTaskColorStyle)) {
    throw new Error("unrecognized wait roster theme-color seam");
  }
  return themed;
}

function rendererProfile(value) {
  const sendCase = uniqueMatch(
    value,
    /case (?<sendTool>[$A-Z_a-z][$\w]*):return e\.completed\?`threadsSendMessageCompleted`:`threadsSendMessageActive`/g,
    "send-message status owner"
  ).groups;
  const position = value.indexOf('e.tool===`create_thread`&&e.completed&&e.success===!0&&t===`row`');
  const owner = containingFunction(value, position);
  const header = uniqueMatch(
    owner.text,
    /function (?<genericRender>[$A-Z_a-z][$\w]*)\(e,t,n,[$A-Z_a-z][$\w]*=!0\)\{/g,
    "generic app-control renderer"
  ).groups;
  const render = uniqueMatch(
    owner.text,
    new RegExp(
      `(?<node>${id})=\\(0,(?<jsx>${id})\\.jsxs\\)\\((?<container>${id}),\\{className:(?<classNames>${id})\\([\\s\\S]{0,500}?` +
        `children:\\[[^\\]]{0,120}?(?<iconFunction>${id})\\(e\\),\\(0,\\k<jsx>\\.jsx\\)\\((?<spinner>${id}),[\\s\\S]{0,700}?` +
        `return ${id}\\?\\(0,\\k<jsx>\\.jsx\\)\\((?<summaryWrapper>${id}),\\{icon:n,summary:${id}\\}\\):${id}`,
      "g"
    ),
    "generic app-control presentation"
  ).groups;
  const navigation = uniqueMatch(
    owner.text,
    new RegExp(
      `let e=(?<normalize>${id})\\(${id}\\);(?<hostBridge>${id})\\.dispatchHostMessage\\(\\{type:\`navigate-to-route\`,path:(?<routeFlag>${id})\\(\\)\\?(?<newRoute>${id})\\(e\\):(?<oldRoute>${id})\\(e\\)\\}\\)`,
      "g"
    ),
    "existing task navigation owner"
  ).groups;
  const registry = uniqueMatch(
    value,
    new RegExp(
      `(?<sendEntry>\\{namespace:(?<namespace>${id}),(?:persistentInCollapsedConversation:!0,)?render:(?:${header.genericRender}|MTKrenderOutboundMessage),` +
        `renderAgentActivityIcon:(?<icon>${id}),(?:standaloneInConversation:!0,)?tool:${sendCase.sendTool}\\})`,
      "g"
    ),
    "send-message registry entry"
  ).groups;
  return {...header, ...render, ...navigation, ...registry, ...sendCase, functionText: owner.text};
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
  const profiles = [
    ["function QMn(){", "kW=Ny(Q,", ["ub", "Q", "kW", "PF", "FF"]],
    ["function ALs(){", "kW=Py(Q,", ["db", "Q", "kW", "FF", "IF"]],
    ["function Oks(){", "cW=Xy(Q,", ["Db", "Q", "cW", "oF", "sF"]],
    ["function Oks(){", "XU=zy(Q,", ["hb", "Q", "XU", "ZP", "QP"]],
    ["function qOs(){", "aW=Iy(Q,", ["pb", "Q", "aW", "QP", "$P"]],
    ["function g$c(e){", "VN=i_($,", ["A_", "$", "VN", "gk", "_k"]]
  ];
  const match = profiles.find(([owner, atom]) => appInitial.includes(owner) && appInitial.includes(atom));
  if (match == null) throw new Error("Upstream changed: wait roster task metadata family is unknown");
  const aliases = ["MTKwaitStoreHook", "MTKwaitStoreScope", "MTKwaitTaskAtom", "MTKwaitLocalThreadKey", "MTKwaitRemoteThreadKey"];
  const additions = match[2].map((internal, index) => `${exportedAs(appInitial, internal)} as ${aliases[index]}`);
  return {
    before: importMatch[0],
    after: `import{${importMatch.groups.specifiers},${additions.join(",")}}from"${importMatch.groups.relative}";`
  };
}

function uniqueOwner() {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const matches = fs.readdirSync(assets).filter(name => {
    if (!name.endsWith(".js")) return false;
    const value = fs.readFileSync(path.join(assets, name), "utf8");
    return value.includes("localConversation.appControlToolCall.threadsSendMessage.active") &&
      value.includes("threadsReadActive") && value.includes("send_message_to_thread");
  });
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} wait roster owners`);
  return path.join(assets, matches[0]);
}

function exportedAs(sourceValue, internal) {
  const specifiers = uniqueMatch(sourceValue, /export\{(?<specifiers>[^}]+)\}/g, "module export list").groups.specifiers;
  return uniqueMatch(specifiers, new RegExp(`(?:^|,)${escapeRegExp(internal)} as (?<export>${id})(?=,|$)`, "g"), `export for ${internal}`).groups.export;
}

function containingFunction(value, position) {
  let start = value.lastIndexOf("function ", position);
  while (start >= 0) {
    const candidate = functionAt(value, start);
    if (position < candidate.end) return candidate;
    start = value.lastIndexOf("function ", start - 1);
  }
  throw new Error("Could not locate containing function");
}

function functionAt(value, start) {
  if (start < 0 || !value.startsWith("function ", start)) throw new Error("Function start is missing");
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
  throw new Error("Function did not terminate");
}

function uniqueMatch(value, pattern, label) {
  const regex = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + "g");
  const matches = [...value.matchAll(regex)];
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function count(value, needle) {
  return value.split(needle).length - 1;
}
