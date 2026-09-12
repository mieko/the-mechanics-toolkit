#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { linuxBuild8881 } from "../patches/outgoing-message-receipt/profiles/linux.mjs";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: outgoing-message-receipt.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const require = createRequire(import.meta.url);
const owners = fs.readdirSync(assets).filter(name => {
  if (!name.endsWith(".js")) return false;
  const source = fs.readFileSync(path.join(assets, name), "utf8");
  return source.includes("function MTKOutboundMessageReceipt(") &&
    source.includes("function MTKrenderOutboundMessage(");
});
assert.equal(owners.length, 1, "unique outgoing receipt owner");
const owner = fs.readFileSync(path.join(assets, owners[0]), "utf8");
assert.ok(owner.includes("persistentInCollapsedConversation:!0"), "receipt opts into stock collapsed-activity persistence");
const collapsedOwners = fs.readdirSync(assets).filter(name => {
  if (!name.endsWith(".js")) return false;
  const source = fs.readFileSync(path.join(assets, name), "utf8");
  return source.includes("persistentUnits") && source.includes("keepMcpAppEntriesPersistent");
});
assert.equal(collapsedOwners.length, 1, "unique collapsed-activity owner");
const collapsedOwner = fs.readFileSync(path.join(assets, collapsedOwners[0]), "utf8");
assert.match(
  collapsedOwner,
  /[$A-Z_a-z][$\w]*!=null&&[$A-Z_a-z][$\w]*\.isCollapsed\?[$A-Z_a-z][$\w]*\.persistentUnits:\[\]/,
  "stock collapsed unit projection"
);
assert.match(
  collapsedOwner,
  /[$A-Z_a-z][$\w]*\.length===0\?null:\(0,[$A-Z_a-z][$\w]*\.jsx\)\([$A-Z_a-z][$\w]*,\{[\s\S]{0,300}?units:[$A-Z_a-z][$\w]*\}\)/,
  "stock persistent-unit renderer"
);
const styles = fs.readdirSync(assets).filter(name => name.endsWith(".css"))
  .map(name => fs.readFileSync(path.join(assets, name), "utf8")).join("\n");
for (const token of ["bg-surface-secondary\\/40", "border-border\\/70"]) {
  assert.ok(styles.includes(token), `stock stylesheet owns ${token}`);
}
const helperStart = owner.indexOf("function MTKoutboundArguments(");
const helperEnd = owner.indexOf("function ", owner.indexOf("function MTKrenderOutboundMessage(") + 10);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "outbound helper seam");
const helper = owner.slice(helperStart, helperEnd);
const dedicatedTitleOwner = fs.readdirSync(assets).some(name => {
  if (!/^app-primary-.*\.js$/.test(name)) return false;
  const source = fs.readFileSync(path.join(assets, name), "utf8");
  const linux = linuxBuild8881.taskImports;
  return source.includes("Q2t=Jf(o_,(e,{get:t})=>{") && source.includes("X2t({...n,localTitle:r})") ||
    source.includes(linux.titleOwner) && source.includes(linux.titleHelper);
});
assert.equal(
  helper.includes("MTKoutboundTitleAtom"),
  dedicatedTitleOwner,
  "build 8881 receipts use the stock live-title selector rather than metadata that omits active titles"
);

const jsxName = unique(
  helper,
  /p=\(0,(?<name>[$A-Z_a-z][$\w]*)\.jsxs\)\("div",\{"data-mtk-outgoing-message-receipt":!0/g,
  "JSX runtime"
).groups.name;
const genericRenderName = unique(
  helper,
  /function MTKrenderOutboundMessage\(e,t,n,r=!0,i\)\{[\s\S]*?return (?<name>[$A-Z_a-z][$\w]*)\(e,t,n,r\)\}/g,
  "generic tool renderer"
).groups.name;
const navigation = unique(
  helper,
  /function MTKoutboundNavigate\(e\)\{let t=(?<normalize>[$A-Z_a-z][$\w]*)\(e\);(?<bridge>[$A-Z_a-z][$\w]*)\.dispatchHostMessage\(\{type:"navigate-to-route",path:(?<flag>[$A-Z_a-z][$\w]*)\(\)\?(?<newRoute>[$A-Z_a-z][$\w]*)\(t\):(?<oldRoute>[$A-Z_a-z][$\w]*)\(t\)\}\)\}/g,
  "navigation owner"
).groups;
const sent = [];
const jsx = {
  jsx(type, props) { return {type, props}; },
  jsxs(type, props) { return {type, props}; }
};
const taskAtom = Symbol("task-atom");
const titleAtom = Symbol("title-atom");
const store = {
  get(atom, key) {
    if (atom === titleAtom && key?.threadId === "bridge-keeper") return "Bridge Keeper — Coordination";
    if (dedicatedTitleOwner && atom === taskAtom) return null;
    if (key === "local:bridge-keeper") return {kind: "local", conversation: {title: "Bridge Keeper — Coordination"}};
    return null;
  }
};
const names = [
  jsxName,
  "MTKoutboundStoreHook",
  "MTKoutboundStoreScope",
  "MTKoutboundLocalThreadKey",
  "MTKoutboundRemoteThreadKey",
  "MTKoutboundTaskAtom",
  "MTKoutboundHover",
  "MTKoutboundFormattedText",
  navigation.normalize,
  navigation.bridge,
  navigation.flag,
  navigation.newRoute,
  navigation.oldRoute,
  genericRenderName
];
if (dedicatedTitleOwner) names.splice(names.indexOf("MTKoutboundHover"), 0, "MTKoutboundTitleAtom");
const values = [
  jsx,
  () => store,
  Symbol("store-scope"),
  id => `local:${id}`,
  id => `remote:${id}`,
  taskAtom,
  function StockHover() {},
  function StockUserFormattedText() {},
  id => id,
  {dispatchHostMessage(message) { sent.push(message); }},
  () => false,
  id => `/new/${id}`,
  id => `/local/${id}`,
  () => ({type: "stock-fallback"})
];
if (dedicatedTitleOwner) values.splice(names.indexOf("MTKoutboundTitleAtom"), 0, titleAtom);
const api = Function(...names, `${helper};return {MTKoutboundArguments,MTKoutboundLabel,MTKoutboundPreview,MTKoutboundTaskColor,MTKoutboundContrast,MTKoutboundLabelColor,MTKOutboundMessageReceipt,MTKrenderOutboundMessage}`)(...values);

assert.equal(api.MTKoutboundArguments({threadId: "bridge-keeper", prompt: "hello"})?.threadId, "bridge-keeper");
assert.equal(api.MTKoutboundArguments({threadId: "bridge-keeper"}), null, "prompt is required");
assert.equal(api.MTKoutboundLabel("Bridge Keeper — Coordination"), "Bridge Keeper");
assert.equal(api.MTKoutboundLabel("Ordinary task"), "Ordinary task");
assert.equal(api.MTKoutboundPreview("\n First line \nsecond"), "First line");
assert.equal(api.MTKoutboundPreview("x".repeat(200)).length, 180);

delete globalThis.__MTK_PATCH_REGISTRY__;
assert.equal(api.MTKoutboundTaskColor("bridge-keeper", "Bridge Keeper — Coordination"), null, "registry absence is neutral");
globalThis.__MTK_PATCH_REGISTRY__ = {apiVersion: 2, packages: {taskVisualPalette: {version: 1, resolveTaskColor: () => "#6b8e72"}}};
assert.equal(api.MTKoutboundTaskColor("bridge-keeper", "Bridge Keeper — Coordination"), null, "registry API mismatch is neutral");
globalThis.__MTK_PATCH_REGISTRY__ = {apiVersion: 1, packages: {taskVisualPalette: {version: 1, resolveTaskColor: () => { throw new Error("boom"); }}}};
assert.equal(api.MTKoutboundTaskColor("bridge-keeper", "Bridge Keeper — Coordination"), null, "capability failure is neutral");
globalThis.__MTK_PATCH_REGISTRY__.packages.taskVisualPalette.resolveTaskColor = () => "not-a-color";
assert.equal(api.MTKoutboundTaskColor("bridge-keeper", "Bridge Keeper — Coordination"), null, "invalid capability output is neutral");
globalThis.__MTK_PATCH_REGISTRY__.packages.taskVisualPalette.resolveTaskColor = ({taskId, title}) => {
  assert.equal(taskId, "bridge-keeper");
  assert.equal(title, "Bridge Keeper — Coordination");
  return "#6b8e72";
};
assert.equal(api.MTKoutboundTaskColor("bridge-keeper", "Bridge Keeper — Coordination"), "#6B8E72");
for (const raw of ["#6B8E72", "#39FF14", "#C6A13D"]) {
  assert.ok(api.MTKoutboundContrast(api.MTKoutboundLabelColor(raw, false), "#FFFFFF") >= 4.5,
    `${raw} recipient label remains readable in light mode`);
  assert.ok(api.MTKoutboundContrast(api.MTKoutboundLabelColor(raw, true), "#101114") >= 4.5,
    `${raw} recipient label remains readable in dark mode`);
}

const prompt = "Please inspect this exact behavior.\nDo not reply.";
const receipt = api.MTKOutboundMessageReceipt({item: {
  arguments: {threadId: "bridge-keeper", prompt},
  completed: true,
  success: true
}});
assert.equal(receipt.type.name, "StockHover", "stock interactive hover surface owns the preview");
assert.equal(receipt.props.interactive, true);
assert.equal(receipt.props.delayDuration, 800, "hover timing matches the stock diff preview");
assert.equal(receipt.props.variant, "rich", "stock elevated rich surface owns the preview chrome");
assert.equal(receipt.props.closeOnTriggerBlur, false, "interactive preview remains reachable");
assert.equal(receipt.props.tooltipMaxWidth, "min(42rem, var(--radix-tooltip-content-available-width), calc(100vw - 16px))");
const summary = receipt.props.children;
assert.equal(summary.type, "div");
assert.equal(summary.props["data-mtk-outgoing-message-receipt"], true);
assert.ok(summary.props.className.includes("self-start"), "receipt is left aligned");
assert.equal(summary.props.style.maxWidth, "min(42rem,92%)", "receipt width does not depend on post-build Tailwind generation");
assert.ok(!summary.props.className.includes("data-user-message-bubble"), "receipt is not a dialogue bubble");
const [arrow, status, recipient, separator, preview] = summary.props.children;
assert.equal(arrow.props.children, "↗", "outbound direction is explicit");
assert.equal(status.props.children, "Sent to");
assert.equal(recipient.props.children, "Bridge Keeper");
assert.match(recipient.props.style.color, /^light-dark\(#[0-9A-F]{6},#[0-9A-F]{6}\)$/,
  "recipient name opportunistically uses a contrast-checked theme pair");
assert.equal(separator.props.children, "·");
assert.equal(preview.props.children, "Please inspect this exact behavior.");
assert.equal(summary.props.children.length, 5, "hover receipt has no click-disclosure indicator");
const hoverBody = receipt.props.tooltipContent;
assert.equal(hoverBody.type, "div");
assert.equal(hoverBody.props.style.userSelect, "text", "floating message remains selectable");
assert.equal(hoverBody.props.style.padding, "0.75rem", "tooltip restores the recipient bubble's missing inset");
assert.equal(hoverBody.props.style.overflowY, "auto", "long outgoing messages remain inside the viewport");
assert.ok(hoverBody.props.style.maxHeight.includes("420px"), "preview height follows the stock diff-preview ceiling");
const formatted = hoverBody.props.children;
assert.equal(formatted.type.name, "StockUserFormattedText", "recipient user-message formatter renders the prompt");
assert.equal(formatted.props.text, prompt);
assert.equal(formatted.props.cwd, undefined);
assert.equal(formatted.props.hostId, "local");
assert.equal(formatted.props.externalLinkContextMenuConversationId, "bridge-keeper");
let prevented = false, stopped = false;
recipient.props.onClick({preventDefault() { prevented = true; }, stopPropagation() { stopped = true; }});
assert.equal(prevented && stopped, true, "recipient navigation does not toggle disclosure");
assert.deepEqual(sent, [{type: "navigate-to-route", path: "/local/bridge-keeper"}], "stock route owner remains authoritative");

const pending = api.MTKOutboundMessageReceipt({item: {arguments: {threadId: "bridge-keeper", prompt}, completed: false}});
assert.equal(pending.props.children.props.children[1].props.children, "Sending to");
const failed = api.MTKOutboundMessageReceipt({item: {
  arguments: {threadId: "bridge-keeper", prompt}, completed: true, success: false
}});
assert.equal(failed.props.children.props.children[1].props.children, "Failed to send to");
const unknown = api.MTKOutboundMessageReceipt({item: {
  arguments: {threadId: "unknown-task-1234", prompt}, completed: true, success: true
}});
assert.equal(unknown.props.children.props.children[2].props.children, "Task unknown-…", "missing task metadata stays explicit");

delete globalThis.__MTK_PATCH_REGISTRY__;
const neutral = api.MTKOutboundMessageReceipt({item: {arguments: {threadId: "bridge-keeper", prompt}, completed: true}});
assert.equal(neutral.props.children.props.children[2].props.style, undefined, "palette-free rendering stays neutral");
assert.equal(api.MTKrenderOutboundMessage({arguments: {threadId: "bridge-keeper", prompt}, completed: true}, "row").type, api.MTKOutboundMessageReceipt,
  "valid send gets the dedicated standalone component");
assert.deepEqual(api.MTKrenderOutboundMessage({arguments: {threadId: "bridge-keeper"}}, "row"), {type: "stock-fallback"},
  "unrecognized send shape retains stock rendering");
const remembered = [];
globalThis.__MTK_OUTBOUND_REMEMBER__ = record => { remembered.push(record); return true; };
assert.equal(api.MTKrenderOutboundMessage({
  arguments: {threadId: "bridge-keeper", prompt},
  callId: "call-1",
  completed: true,
  success: true
}, "row", null, true, {conversationId: "source-thread", turnId: "source-turn"}), null,
"completed sends hand rendering to the durable turn receipt");
assert.deepEqual({...remembered[0], recordedAtMs: 1}, {
  callId: "call-1",
  contract: "outgoing-message-receipt-v1",
  prompt,
  recordedAtMs: 1,
  sourceThreadId: "source-thread",
  sourceTurnId: "source-turn",
  targetHostId: "local",
  targetThreadId: "bridge-keeper"
});
delete globalThis.__MTK_OUTBOUND_REMEMBER__;

for (const contract of [
  "standaloneInConversation:!0",
  "persistentInCollapsedConversation:!0",
  "function MTKOutboundMessageReceipt(",
  "MTKoutboundStoreHook(MTKoutboundStoreScope)",
  "MTKoutboundTaskColor(n.threadId,a)",
  "globalThis.__MTK_PATCH_REGISTRY__",
  "MTKoutboundHover",
  "MTKoutboundFormattedText",
  "globalThis.__MTK_OUTBOUND_REMEMBER__",
  "interactive:!0",
  "delayDuration:800",
  "navigate-to-route"
]) assert.ok(owner.includes(contract), contract);
assert.ok(!helper.includes("innerHTML") && !helper.includes("dangerouslySetInnerHTML"), "message text is never parsed as markup");
assert.ok(!helper.includes("\"details\"") && !helper.includes("\"pre\""), "no parallel click disclosure or monospace body remains");

const conversationOwners = fs.readdirSync(assets).filter(name => {
  const source = name.endsWith(".js") ? fs.readFileSync(path.join(assets, name), "utf8") : "";
  return source.includes("function MTKOutboundTurnReceipts(");
});
assert.equal(conversationOwners.length, 1, "unique durable turn-receipt owner");
const conversation = fs.readFileSync(path.join(assets, conversationOwners[0]), "utf8");
for (const contract of [
  'dispatchMessage("mtk-outbound-receipt-remember"',
  'subscribe("mtk-outbound-receipt-remember-result"',
  'dispatchMessage("mtk-outbound-receipts-list"',
  'subscribe("mtk-outbound-receipts-result"',
  "MTKoutboundReceiptLimit=256",
  "MTKoutboundReceipt as MTKoutboundReceipt"
]) assert.ok(conversation.includes(contract), contract);
const presentationOwners = fs.readdirSync(assets).filter(name => {
  const source = name.endsWith(".js") ? fs.readFileSync(path.join(assets, name), "utf8") : "";
  return source.includes("MTKOutboundTurnReceipts,{conversationId:");
});
assert.equal(presentationOwners.length, 1, "unique durable receipt presentation owner");
const presentation = fs.readFileSync(path.join(assets, presentationOwners[0]), "utf8");
const receiptPresentation = presentation.indexOf("MTKOutboundTurnReceipts,{conversationId:");
assert.ok(receiptPresentation >= 0, "durable receipts are present in the source turn presentation");
if (presentation.includes('$(`mtk-outbound-turn-receipts`')) {
  const userPresentation = presentation.indexOf('$(`user-item-');
  const taskPresentation = presentation.indexOf('$(`mtk-outbound-turn-receipts`');
  const tinrelayPresentation = presentation.indexOf('$(`mtk-tinrelay-outgoing-turn`');
  const activityBoundary = ["let Ha=za.length", "let Ra=Fa.length"]
    .map(marker => presentation.indexOf(marker, taskPresentation))
    .find(index => index >= 0) ?? -1;
  assert.ok(userPresentation >= 0 && taskPresentation > userPresentation && taskPresentation < activityBoundary,
    "durable receipts follow the initiating user request and precede activity");
  if (tinrelayPresentation >= 0) assert.ok(tinrelayPresentation > taskPresentation && tinrelayPresentation < activityBoundary,
    "Tinrelay sends follow task receipts at the same post-user boundary");
} else {
  assert.match(presentation,
    /children:\[\(0,[A-Za-z_$][\w$]*\.jsx\)\(MTKOutboundTurnReceipts,\{conversationId:[A-Za-z_$][\w$]*,turnId:[A-Za-z_$][\w$]*\}\),/,
    "combined-build receipts remain ahead of the stock assistant content");
}
const conversationCacheStart = conversation.indexOf("const MTKoutboundReceiptContract=");
const receiptFunctionStart = conversation.indexOf("function MTKOutboundTurnReceipts(", conversationCacheStart);
const conversationCacheEnd = conversation.indexOf("function ", receiptFunctionStart + "function ".length);
const conversationHelper = conversation.slice(conversationCacheStart, conversationCacheEnd);
assert.ok(conversationHelper.includes("length-MTKoutboundReceiptLimit"),
  "renderer bounds acknowledged receipts per source task");
assert.ok(!conversation.slice(conversationCacheStart, conversationCacheEnd).includes("flatMap"),
  "renderer does not enforce one global receipt pool");
const hostBusName = unique(
  conversationHelper,
  /(?<name>[$A-Z_a-z][$\w]*)\.dispatchMessage\("mtk-outbound-receipt-remember"/g,
  "receipt host bus"
).groups.name;
const receiptDispatches = [];
const receiptListeners = new Map();
const receiptBus = {
  dispatchMessage(type, payload) { receiptDispatches.push({type, payload}); },
  subscribe(type, callback) { receiptListeners.set(type, callback); return () => receiptListeners.delete(type); }
};
const receiptReact = {
  useState(initializer) { return [typeof initializer === "function" ? initializer() : initializer, () => {}]; },
  useEffect() {}
};
const receiptJsx = {jsx() { return null; }};
const receiptReactBinding = conversation.match(
  /const MTKOutboundReceiptReact=(?<expression>[^;]+);const MTKoutboundReceiptContract=/
);
const boundReceiptReact = receiptReactBinding == null
  ? receiptReact
  : evaluateReceiptReactBinding(receiptReactBinding.groups.expression);
const conversationApi = Function(
  hostBusName, "Jy", "Yy", "gS", "_x", "t", "x", "$", "MTKOutboundReceiptReact", "MTKoutboundReceipt",
  `${conversationHelper};return {component:MTKOutboundTurnReceipts,remember:MTKoutboundRemember,state:MTKoutboundReceiptState,values:MTKoutboundReceiptValues}`
)(receiptBus, receiptReact, receiptJsx, receiptReact, receiptJsx, value => value, () => receiptReact, receiptJsx,
  boundReceiptReact, () => null);
assert.equal(
  conversationApi.component({conversationId: "source-thread", turnId: "source-turn"}),
  null,
  "durable turn receipt uses the owning renderer's React hooks without local binding collisions"
);

const mainDirectory = path.join(root, ".vite/build");
const mainOwners = fs.readdirSync(mainDirectory).filter(name => {
  const source = /^main-.*\.js$/.test(name) ? fs.readFileSync(path.join(mainDirectory, name), "utf8") : "";
  return source.includes("function MTKoutboundReceiptWrite(") && source.includes("function MTKoutboundReceiptList(");
});
assert.equal(mainOwners.length, 1, "unique durable receipt cache owner");
const main = fs.readFileSync(path.join(mainDirectory, mainOwners[0]), "utf8");
const mainStart = main.indexOf('const MTKoutboundReceiptContract=');
const mainEnds = [
  main.indexOf("const MTKtinrelayClient=", mainStart),
  main.indexOf("var mQ=i.i(`electron-message-handler`)", mainStart),
  main.indexOf("var pQ=i.i(`electron-message-handler`)", mainStart),
  main.indexOf("var fQ=i.i(`electron-message-handler`)", mainStart)
].filter(index => index > mainStart);
assert.ok(mainEnds.length >= 1, "localized durable receipt main helper");
const mainHelper = main.slice(mainStart, Math.min(...mainEnds));
assert.ok(mainHelper.includes('process.platform==="win32"||(e.mode&63)===0'),
  "Windows relies on its inherited user-data ACL instead of unavailable POSIX mode bits");
const mainHandlerStart = main.indexOf("case`mtk-outbound-receipt-remember`:");
const mainListHandlerStart = main.indexOf("case`mtk-outbound-receipts-list`:", mainHandlerStart);
const mainHandlerEnd = main.indexOf("case`", mainListHandlerStart + 5);
assert.ok(mainHandlerStart >= 0 && mainHandlerEnd > mainHandlerStart, "localized durable receipt main handlers");
const electronName = unique(mainHelper, /MTKoutboundReceiptPath\.join\((?<name>[$A-Z_a-z][$\w]*)\.app\.getPath\("userData"\)/g, "Electron app binding").groups.name;
const cacheScratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-outbound-cache-test-"));
try {
  const makeCache = () => Function("require", "process", "Buffer", electronName,
    `${mainHelper};return {remember:MTKoutboundReceiptRemember,list:MTKoutboundReceiptList}`)(
      require, process, Buffer, {app: {getPath() { return cacheScratch; }}}
    );
  const first = {
    callId: "call-persisted",
    contract: "outgoing-message-receipt-v1",
    prompt: "Coordinator → Engine Tender — durable hello",
    recordedAtMs: 100,
    sourceThreadId: "source-thread",
    sourceTurnId: "source-turn",
    targetHostId: "local",
    targetThreadId: "coordinator-thread"
  };
  const cache = makeCache();
  assert.equal(conversationApi.remember(first), false, "renderer waits for durable acknowledgment before hoisting");
  assert.equal(receiptDispatches.length, 1, "renderer sends one persistence request");
  assert.equal(conversationApi.remember(first), false, "a pending receipt does not dispatch twice");
  assert.equal(receiptDispatches.length, 1, "pending persistence remains single-flight");
  assert.deepEqual(conversationApi.values(conversationApi.state("source-thread")), [],
    "unacknowledged receipts do not enter the durable presentation state");
  assert.equal(receiptDispatches[0].type, "mtk-outbound-receipt-remember");
  assert.deepEqual(receiptDispatches[0].payload.record, first);
  assert.equal(typeof receiptDispatches[0].payload.requestId, "string");
  const mainResponses = [];
  const mainHandler = Function(
    "MTKoutboundReceiptRemember", "MTKoutboundReceiptList",
    `return function(type,t,e){switch(type){${main.slice(mainHandlerStart, mainHandlerEnd)}default:break}}`
  )(cache.remember, cache.list);
  mainHandler.call({windowManager: {sendMessageToWebContents(_webContents, response) {
    mainResponses.push(response);
  }}}, receiptDispatches[0].type, receiptDispatches[0].payload, {});
  assert.deepEqual(mainResponses, [{
    type: "mtk-outbound-receipt-remember-result",
    requestId: receiptDispatches[0].payload.requestId,
    ok: true,
    record: first
  }], "main process acknowledges only the receipt it durably wrote");
  receiptListeners.get("mtk-outbound-receipt-remember-result")(mainResponses[0]);
  assert.deepEqual(conversationApi.values(conversationApi.state("source-thread")), [first],
    "renderer accepts the acknowledged durable record");
  assert.equal(conversationApi.remember(first), true, "acknowledged receipt can hand off to the durable turn surface");
  const failed = {...first, callId: "call-write-failed", recordedAtMs: 101};
  assert.equal(conversationApi.remember(failed), false);
  const failedDispatch = receiptDispatches.at(-1);
  receiptListeners.get("mtk-outbound-receipt-remember-result")({
    type: "mtk-outbound-receipt-remember-result",
    requestId: failedDispatch.payload.requestId,
    ok: false,
    record: null
  });
  assert.deepEqual(conversationApi.values(conversationApi.state("source-thread")), [first],
    "a failed persistence acknowledgment leaves the receipt on its stock activity path");
  assert.deepEqual(cache.list("source-thread"), [first], "same-process list returns the receipt");
  assert.deepEqual(makeCache().list("source-thread"), [first], "new main-process instance reconstructs the receipt");
  const cacheDir = path.join(cacheScratch, "mechanics-toolkit", "task-message-receipts");
  const taskDir = sourceThreadId => path.join(cacheDir, createHash("sha256").update(sourceThreadId).digest("hex"));
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(cacheDir).mode & 0o077, 0, "cache directory is private");
    assert.equal(fs.statSync(taskDir("source-thread")).mode & 0o077, 0, "task bucket is private");
  }
  const files = fs.readdirSync(taskDir("source-thread")).filter(name => name.endsWith(".json"));
  assert.equal(files.length, 1);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(path.join(taskDir("source-thread"), files[0])).mode & 0o077, 0,
      "cache file is private");
  }
  assert.deepEqual(cache.remember({...first, prompt: "conflicting rewrite"}), first, "first call identity wins");
  fs.writeFileSync(path.join(taskDir("source-thread"), "f".repeat(64) + ".json"), "not-json\n", {mode: 0o600});
  assert.deepEqual(makeCache().list("source-thread"), [first], "corrupt cache entry is ignored");

  const legacy = {
    ...first,
    callId: "legacy-call",
    recordedAtMs: 200,
    sourceThreadId: "legacy-source"
  };
  fs.writeFileSync(path.join(cacheDir, "e".repeat(64) + ".json"), `${JSON.stringify(legacy)}\n`, {mode: 0o600});
  assert.deepEqual(makeCache().list("legacy-source"), [legacy], "flat-cache receipt migrates into its task bucket");
  assert.equal(fs.existsSync(path.join(cacheDir, "e".repeat(64) + ".json")), false, "migrated flat receipt is removed");

  const other = {...first, callId: "other-call", sourceThreadId: "other-source", recordedAtMs: 300};
  assert.deepEqual(cache.remember(other), other, "another source task gets an independent bucket");
  for (let index = 0; index < 260; index += 1) {
    cache.remember({...first, callId: `call-${index}`, recordedAtMs: 1000 + index});
  }
  assert.ok(fs.readdirSync(taskDir("source-thread")).filter(name => name.endsWith(".json")).length <= 256,
    "busy source task remains independently bounded");
  assert.deepEqual(cache.list("other-source"), [other], "busy source task does not evict another task's receipt");
  const sourceBytes = fs.readdirSync(taskDir("source-thread"))
    .filter(name => name.endsWith(".json"))
    .reduce((total, name) => total + fs.statSync(path.join(taskDir("source-thread"), name)).size, 0);
  assert.ok(sourceBytes <= 8 * 1024 * 1024, "task bucket remains within its byte ceiling");

  for (let index = 0; index < 70; index += 1) {
    cache.remember({...first, callId: `bucket-call-${index}`, sourceThreadId: `bucket-source-${index}`, recordedAtMs: 2000 + index});
  }
  const buckets = fs.readdirSync(cacheDir).filter(name => /^[0-9a-f]{64}$/.test(name));
  assert.ok(buckets.length <= 64, "global task-bucket ceiling bounds abandoned source tasks");
  assert.equal(cache.list("bucket-source-69").length, 1, "current task bucket survives global pruning");
} finally {
  fs.rmSync(cacheScratch, {recursive: true, force: true});
}

process.stdout.write(`${JSON.stringify({
  state: "green",
  persistence: "acknowledged-private-task-buckets",
  collapsedVisibility: "persistent-via-stock-activity-contract",
  layout: "left-aligned-neutral-hover-receipt",
  recipientMetadata: "stock-task-selector",
  paletteCapability: "optional-versioned-render-time-query",
  clickThrough: "stock-task-route",
  messageRendering: "stock-recipient-user-message-formatter"
}, null, 2)}\n`);

function evaluateReceiptReactBinding(expression) {
  const wrapped = expression.match(/^(?<wrap>[$A-Z_a-z][$\w]*)\((?<factory>[$A-Z_a-z][$\w]*)\(\),1\)$/);
  if (wrapped) {
    return Function(wrapped.groups.wrap, wrapped.groups.factory, `return (${expression})`)(
      value => value,
      () => receiptReact
    );
  }
  return Function("gS", "t", "x", `return (${expression})`)(receiptReact, value => value, () => receiptReact);
}

function unique(value, pattern, label) {
  const matches = [...value.matchAll(pattern)];
  assert.equal(matches.length, 1, label);
  return matches[0];
}
