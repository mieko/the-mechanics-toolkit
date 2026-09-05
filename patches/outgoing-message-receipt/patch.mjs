#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const id = "[$A-Z_a-z][$\\w]*";
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: outgoing-message-receipt/patch.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
assertStockStyles();
const target = uniqueOwner();
let source = fs.readFileSync(target, "utf8");
const collapseOwner = assertPersistentActivityContract(source);
const presentation = resolvePresentationOwners(source);
let state = inspectState(source);

if (command === "apply" && state === "needs-apply") {
  source = patchSource(source);
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState(source);
  if (state !== "applied") throw new Error("outgoing receipt transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  persistence: "mounted-session",
  collapsedVisibility: "persistent",
  preview: "stock-interactive-hover",
  messageRendering: "stock-recipient-user-message-formatter",
  collapseOwner: path.relative(root, collapseOwner),
  formatterOwner: path.relative(root, presentation.formatterFile),
  target: path.relative(root, target)
}, null, 2)}\n`);

function inspectState(value) {
  const send = sendProfile(value);
  const red = `{namespace:${send.namespace},render:${send.genericRender},renderAgentActivityIcon:${send.icon},tool:${send.sendTool}}`;
  const green = `{namespace:${send.namespace},persistentInCollapsedConversation:!0,render:MTKrenderOutboundMessage,renderAgentActivityIcon:${send.icon},standaloneInConversation:!0,tool:${send.sendTool}}`;
  const helperApplied = value.includes("function MTKOutboundMessageReceipt(") &&
    value.includes("function MTKoutboundTaskColor(") &&
    value.includes("MTKoutboundStoreHook(MTKoutboundStoreScope)") &&
    value.includes(".get(MTKoutboundTaskAtom,") &&
    value.includes("let n=globalThis.__MTK_PATCH_REGISTRY__") &&
    value.includes("n.packages?.taskVisualPalette") &&
    value.includes("MTKoutboundHover") &&
    value.includes("MTKoutboundFormattedText") &&
    value.includes("interactive:!0") &&
    value.includes("delayDuration:800") &&
    value.includes('maxHeight:"min(420px, var(--radix-tooltip-content-available-height, 420px), calc(100vh - 16px))"') &&
    value.includes('overflowY:"auto"') &&
    value.includes('padding:"0.75rem"') &&
    value.includes("data-mtk-outgoing-message-receipt");
  const taskImportsApplied = value.includes(" as MTKoutboundTaskAtom") &&
    value.includes(" as MTKoutboundLocalThreadKey") &&
    value.includes(" as MTKoutboundRemoteThreadKey");
  const presentationImportsApplied = value.includes(" as MTKoutboundHover") &&
    value.includes(" as MTKoutboundFormattedText");
  if (count(value, green) === 1 && count(value, red) === 0 && helperApplied &&
      taskImportsApplied && presentationImportsApplied) return "applied";
  if (count(value, red) === 1 && count(value, green) === 0 && !helperApplied &&
      !taskImportsApplied && !presentationImportsApplied) return "needs-apply";
  throw new Error(
    `Upstream changed: outgoing receipt seam red=${count(value, red)} green=${count(value, green)} ` +
      `helper=${helperApplied} taskImports=${taskImportsApplied} presentationImports=${presentationImportsApplied}`
  );
}

function patchSource(value) {
  const send = sendProfile(value);
  const imports = resolveTaskImports(value);
  const red = `{namespace:${send.namespace},render:${send.genericRender},renderAgentActivityIcon:${send.icon},tool:${send.sendTool}}`;
  const green = `{namespace:${send.namespace},persistentInCollapsedConversation:!0,render:MTKrenderOutboundMessage,renderAgentActivityIcon:${send.icon},standaloneInConversation:!0,tool:${send.sendTool}}`;
  const helper = buildHelper(send);

  let patched = replaceOnce(value, send.functionText, `${helper}${send.functionText}`, "outbound renderer helper");
  patched = replaceOnce(patched, red, green, "send-message registry entry");
  patched = replaceOnce(patched, imports.before, imports.after, "outbound task imports");
  patched = addImportSpecifier(patched, presentation.appRelative, `${presentation.tooltipExport} as MTKoutboundHover`, "stock hover import");
  patched = addImportSpecifier(patched, presentation.formatterRelative, `${presentation.formatterExport} as MTKoutboundFormattedText`, "stock message formatter import");
  return patched;
}

function buildHelper(send) {
  return String.raw`
function MTKoutboundArguments(e){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&typeof e.threadId==="string"&&e.threadId.length>0&&typeof e.prompt==="string"&&(e.hostId===void 0||typeof e.hostId==="string")?e:null}function MTKoutboundLabel(e){if(typeof e!=="string"||e.trim().length===0)return null;let t=e.trim(),n=t.indexOf(" — ");return n>0?t.slice(0,n).trim():t}function MTKoutboundPreview(e){let t=e.split(/\r?\n/).map(e=>e.trim()).find(e=>e.length>0)??"(empty message)";return t.length<=180?t:t.slice(0,179)+"…"}function MTKoutboundTaskColor(e,t){try{let n=globalThis.__MTK_PATCH_REGISTRY__;if(n?.apiVersion!==1)return null;let r=n.packages?.taskVisualPalette;if(r?.version!==1||typeof r.resolveTaskColor!=="function")return null;let i=r.resolveTaskColor({taskId:e,title:t});return typeof i==="string"&&/^#[0-9A-Fa-f]{6}$/.test(i)?i.toUpperCase():null}catch{return null}}function MTKoutboundNavigate(e){let t=${send.normalize}(e);${send.hostBridge}.dispatchHostMessage({type:"navigate-to-route",path:${send.routeFlag}()?${send.newRoute}(t):${send.oldRoute}(t)})}function MTKOutboundMessageReceipt({item:e}){let t=MTKoutboundStoreHook(MTKoutboundStoreScope),n=MTKoutboundArguments(e.arguments);if(n==null)return null;let r=n.hostId==null||n.hostId==="local"?MTKoutboundLocalThreadKey(n.threadId):MTKoutboundRemoteThreadKey(n.threadId),i=t.get(MTKoutboundTaskAtom,r),a=i?.kind==="local"?(i.conversation?.title??i.catalogTitle??i.summary?.title):i?.kind==="remote"?i.task?.title:null,o=i?.kind==="local"?(i.conversation?.cwd??i.cwd??i.summary?.cwd):void 0,s=MTKoutboundLabel(a)??"Task "+n.threadId.slice(0,8)+"…",c=MTKoutboundTaskColor(n.threadId,a),l=c==null?void 0:{color:"color-mix(in srgb, "+c+" 68%, var(--color-text) 32%)"},u=e.completed?e.success===!1?"Failed to send to":"Sent to":"Sending to",d=MTKoutboundPreview(n.prompt),f=e=>{e.preventDefault(),e.stopPropagation(),MTKoutboundNavigate(n.threadId)},p=(0,${send.jsx}.jsxs)("div",{"data-mtk-outgoing-message-receipt":!0,className:"self-start flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-surface-secondary/40 px-3 py-2 text-size-chat text-text-tertiary",style:{maxWidth:"min(42rem,92%)"},children:[(0,${send.jsx}.jsx)("span",{"aria-hidden":!0,className:"shrink-0",children:"↗"}),(0,${send.jsx}.jsx)("span",{className:"shrink-0",children:u}),(0,${send.jsx}.jsx)("button",{"aria-label":"Open "+(a??s),className:"min-w-0 shrink-0 rounded-sm font-medium text-text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",onClick:f,style:l,type:"button",children:s}),(0,${send.jsx}.jsx)("span",{"aria-hidden":!0,className:"shrink-0",children:"·"}),(0,${send.jsx}.jsx)("span",{className:"min-w-0 flex-1 truncate text-text-tertiary/90",children:d})]});return(0,${send.jsx}.jsx)(MTKoutboundHover,{align:"start",closeOnTriggerBlur:!1,delayDuration:800,interactive:!0,side:"top",sideOffset:6,skipDelayKey:"outbound-message-preview",tooltipMaxWidth:"min(42rem, var(--radix-tooltip-content-available-width), calc(100vw - 16px))",variant:"rich",tooltipContent:(0,${send.jsx}.jsx)("div",{className:"min-w-0 text-start",style:{maxHeight:"min(420px, var(--radix-tooltip-content-available-height, 420px), calc(100vh - 16px))",overflowY:"auto",padding:"0.75rem",userSelect:"text"},children:(0,${send.jsx}.jsx)(MTKoutboundFormattedText,{cwd:o,externalLinkContextMenuConversationId:n.threadId,hostId:n.hostId??"local",text:n.prompt})}),children:p})}function MTKrenderOutboundMessage(e,t,n,r=!0){return t==="row"&&MTKoutboundArguments(e.arguments)!=null?(0,${send.jsx}.jsx)(MTKOutboundMessageReceipt,{item:e}):${send.genericRender}(e,t,n,r)}
`;
}

function sendProfile(value) {
  const sendCase = uniqueMatch(
    value,
    /case (?<sendTool>[$A-Z_a-z][$\w]*):return e\.completed\?`threadsSendMessageCompleted`:`threadsSendMessageActive`/g,
    "send-message status owner"
  ).groups;
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
        `renderAgentActivityIcon:(?<icon>[$A-Z_a-z][$\\w]*),(?:standaloneInConversation:!0,)?tool:${sendCase.sendTool}\\}`,
      "g"
    ),
    "send-message registry entry"
  ).groups;
  return {...sendCase, ...header, ...render, ...registry, functionText: owner.text};
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
  if (appInitial.includes(`function ${diffPreview.tooltip}(`)) {
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
  const formatterExport = exportedAs(formatterSource, formatterInternal);
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
  const formatterLocal = uniqueMatch(
    consumerImport,
    new RegExp(`(?:^|,)${escapeRegExp(formatterExport)} as (?<local>${id})(?=,|$)`, "g"),
    "recipient formatter local binding"
  ).groups.local;
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
    return value.includes("localConversation.appControlToolCall.threadsSendMessage.active") &&
      value.includes('e.tool===`send_message_to_thread`');
  });
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} outbound-message owners`);
  return path.join(assets, matches[0]);
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
  return uniqueMatch(value, new RegExp(`(?:^|,)${escapeRegExp(internal)} as (?<export>${id})(?=,|\\})`, "g"), `export for ${internal}`).groups.export;
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
