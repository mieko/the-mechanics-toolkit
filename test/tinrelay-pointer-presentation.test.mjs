#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: tinrelay-pointer-presentation.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const renderer = unique(fs.readdirSync(assets).filter(name =>
  /^(?:subagent-activity-chip-group|conversation-blocks)-.*\.js$/.test(name)
).map(name => path.join(assets, name)), "delegated message renderer");
const build = path.join(root, ".vite/build");
const main = unique(fs.readdirSync(build).filter(name => /^main-.*\.js$/.test(name))
  .map(name => path.join(build, name)), "main-process asset");
const rendererSource = fs.readFileSync(renderer, "utf8");
const mainSource = fs.readFileSync(main, "utf8");
const stringLiteral = '"(?:\\\\.|[^"\\\\])*"';
const rendererConfig = uniqueMatch(
  rendererSource,
  new RegExp(`const MTKtinrelayLocalShip=(?<ship>${stringLiteral});function MTKtinrelayPointerFromMessage\\(`, "g"),
  "embedded renderer configuration"
).groups;
const mainConfig = uniqueMatch(
  mainSource,
  new RegExp(`const MTKtinrelayClient=(?<client>${stringLiteral}),MTKtinrelayLocalShip=(?<ship>${stringLiteral});function MTKtinrelayMainPointer\\(`, "g"),
  "embedded main configuration"
).groups;
const client = JSON.parse(mainConfig.client);
const localShip = JSON.parse(mainConfig.ship);
assert.equal(JSON.parse(rendererConfig.ship), localShip, "renderer and main process agree on the local ship");

const rendererStart = rendererSource.indexOf("const MTKtinrelayLocalShip=");
const rendererEnd = rendererSource.indexOf("function MTKtinrelayPointerNode(", rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, "localized renderer pointer parser");
const outgoingHelpersStart = rendererSource.indexOf("function MTKtinrelayOutgoingAcceptance(", rendererStart);
assert.ok(outgoingHelpersStart > rendererEnd, "localized outgoing renderer helpers");
const incomingHostBus = uniqueMatch(
  rendererSource.slice(rendererStart, outgoingHelpersStart),
  /(?<bus>[$A-Z_a-z][$\w]*)\.subscribe\("mtk-tinrelay-pointer-result"/g,
  "incoming renderer host bus"
).groups.bus;
const incomingHostBusOwner = uniqueMatch(
  rendererSource.slice(rendererStart, outgoingHelpersStart),
  /const MTKtinrelayHostBus=(?<bus>[$A-Z_a-z][$\w]*);/g,
  "incoming renderer host bus capture"
).groups.bus;
const parsePointer = Function(`${rendererSource.slice(rendererStart, rendererEnd)};return MTKtinrelayPointerFromMessage`)();

const pointer = {
  contract: "tinrelay-local-pointer-v1",
  kind: "transmission",
  local_id: "tr_0123456789abcdef0123456789abcdef",
  local_ship: localShip,
  sender_ship: "friendly-ship",
  attention_label: "Engine room"
};
const pointerText = `TINRELAY LOCAL POINTER\n${JSON.stringify(pointer)}`;
assert.deepEqual(parsePointer(pointerText), pointer);
assert.deepEqual(parsePointer(`${pointerText}\n`), pointer, "one final LF is allowed");
for (const [label, text] of [
  ["CRLF", pointerText.replace("\n", "\r\n")],
  ["third line", `${pointerText}\nprose`],
  ["two final LFs", `${pointerText}\n\n`],
  ["markdown fence", `TINRELAY LOCAL POINTER\n\`${JSON.stringify(pointer)}\``],
  ["unknown key", `TINRELAY LOCAL POINTER\n${JSON.stringify({...pointer, path: "/tmp/no"})}`],
  ["bad local id", `TINRELAY LOCAL POINTER\n${JSON.stringify({...pointer, local_id: "tr_BAD"})}`],
  ["wrong local ship", `TINRELAY LOCAL POINTER\n${JSON.stringify({...pointer, local_ship: "other"})}`],
  ["bad sender ship", `TINRELAY LOCAL POINTER\n${JSON.stringify({...pointer, sender_ship: "Bad Ship"})}`],
  ["non-string label", `TINRELAY LOCAL POINTER\n${JSON.stringify({...pointer, attention_label: null})}`]
]) assert.equal(parsePointer(text), null, label);

const helpersStart = mainSource.indexOf("const MTKtinrelayClient=");
const helpersEnd = [
  "const MTKtinrelayOutgoingContract=",
  "var mQ=i.i(`electron-message-handler`)",
  "var pQ=i.i(`electron-message-handler`)"
]
  .map(marker => mainSource.indexOf(marker, helpersStart))
  .filter(index => index >= 0)
  .sort((a, b) => a - b)[0] ?? -1;
assert.ok(helpersStart >= 0 && helpersEnd > helpersStart, "localized main-process helpers");
const helperSource = mainSource.slice(helpersStart, helpersEnd);
const calls = [];
let executorResult;
const x = {execFile(...args) {
  calls.push(args.slice(0, 3));
  const callback = args.at(-1);
  if (executorResult instanceof Error) callback(executorResult, "", "secret stderr");
  else callback(null, JSON.stringify(executorResult), "");
}};
const mainHelpers = Function("x", `${helperSource};return {parse:MTKtinrelayMainPointer,inspect:MTKtinrelayInspect}`)(x);
const request = {
  requestId: "01234567-89ab-4cde-8fab-0123456789ab",
  pointerText
};
executorResult = {
  contract: "tinrelay-inspected-inbox-v1",
  kind: "transmission",
  local_id: pointer.local_id,
  recipient_ship: pointer.local_ship,
  sender_ship: pointer.sender_ship,
  attention_label: pointer.attention_label,
  author_label: "aster",
  signed_transmission: {
    sender_ship: pointer.sender_ship,
    recipient_ship: pointer.local_ship,
    from_label: "aster",
    to_label: pointer.attention_label,
    body: "<img src=x onerror=alert(1)>\n**rendered Markdown**",
    secret: "not returned"
  },
  certificate: {secret: true},
  path: "/private/never-return"
};
assert.deepEqual(await mainHelpers.inspect(request), {
  localId: pointer.local_id,
  localShip: pointer.local_ship,
  senderShip: pointer.sender_ship,
  attentionLabel: pointer.attention_label,
  authorLabel: executorResult.author_label,
  body: executorResult.signed_transmission.body
}, "only validated display fields cross back to the renderer");

const unlabeledInspection = {
  contract: "tinrelay-inspected-inbox-v1",
  kind: "transmission",
  local_id: pointer.local_id,
  recipient_ship: pointer.local_ship,
  sender_ship: pointer.sender_ship,
  attention_label: pointer.attention_label,
  author_label: null,
  signed_transmission: {
    sender_ship: pointer.sender_ship,
    recipient_ship: pointer.local_ship,
    to_label: pointer.attention_label,
    body: "Untouched unlabeled Tinrelay inspection"
  }
};
executorResult = unlabeledInspection;
assert.deepEqual(await mainHelpers.inspect(request), {
  localId: pointer.local_id,
  localShip: pointer.local_ship,
  senderShip: pointer.sender_ship,
  attentionLabel: pointer.attention_label,
  authorLabel: null,
  body: unlabeledInspection.signed_transmission.body
}, "a valid unlabeled inspection normalizes the absent author to null");
executorResult = {
  ...unlabeledInspection,
  signed_transmission: {...unlabeledInspection.signed_transmission, from_label: null}
};
assert.equal((await mainHelpers.inspect(request)).authorLabel, null,
  "an explicitly null signed author is also unlabeled");
assert.equal(calls.length, 3);
for (const call of calls) {
  assert.equal(call[0], client);
  assert.deepEqual(call[1], ["--ship", localShip, "inbox", "show", pointer.local_id]);
  assert.deepEqual(call[2], {
    encoding: "utf8",
    maxBuffer: 1048576,
    shell: false,
    timeout: 8000,
    windowsHide: true
  });
}

executorResult = {...unlabeledInspection, sender_ship: "wrong-ship"};
await assert.rejects(mainHelpers.inspect(request), /did not match this pointer/);
for (const [label, inspection] of [
  ["unequal labels", {...executorResult, sender_ship: pointer.sender_ship, author_label: "imposter",
    signed_transmission: {...unlabeledInspection.signed_transmission, from_label: "aster"}}],
  ["empty labels", {...unlabeledInspection, author_label: "",
    signed_transmission: {...unlabeledInspection.signed_transmission, from_label: ""}}],
  ["top null but signed string", {...unlabeledInspection,
    signed_transmission: {...unlabeledInspection.signed_transmission, from_label: "aster"}}],
  ["top string but signed absent", {...unlabeledInspection, author_label: "aster"}],
  ["top author absent", (() => { const copy = {...unlabeledInspection}; delete copy.author_label; return copy; })()]
]) {
  executorResult = inspection;
  await assert.rejects(mainHelpers.inspect(request), /did not match this pointer/, label);
}
const callsBeforeInvalid = calls.length;
await assert.rejects(mainHelpers.inspect({...request, pointerText: "ordinary delegated message"}), /Invalid local Tinrelay pointer/);
assert.equal(calls.length, callsBeforeInvalid, "invalid messages never reach the process bridge");
const missing = new Error("spawn failure with private details");
missing.code = "ENOENT";
executorResult = missing;
await assert.rejects(mainHelpers.inspect(request), {message: "Tinrelay client is unavailable."});

const outgoingViewStart = rendererSource.indexOf("function MTKtinrelayOutgoingView(", rendererStart);
const rendererHelpersEnd = rendererSource.indexOf("function ", outgoingViewStart + "function ".length);
assert.ok(outgoingViewStart > rendererStart && rendererHelpersEnd > outgoingViewStart,
  "localized Tinrelay presentation helpers");
const rendererHelpers = rendererSource.slice(rendererStart, rendererHelpersEnd);
const outgoingHostBus = unique([...new Set([...rendererHelpers.matchAll(
  /(?<bus>[$A-Z_a-z][$\w]*)\.subscribe\("mtk-tinrelay-outgoing-result"/g
)].map(match => match.groups.bus))], "outgoing renderer host bus");
assert.equal(incomingHostBus, "MTKtinrelayHostBus",
  "incoming renderer reads the captured host bus rather than a component-local minified binding");
assert.equal(outgoingHostBus, incomingHostBusOwner,
  "incoming and outgoing Tinrelay presentation share Codex's renderer host bridge");
const scrollHelpersEnd = rendererHelpers.indexOf("function MTKtinrelayEnsureStyle(");
assert.ok(scrollHelpersEnd > 0, "localized Tinrelay scroll helpers");
let queuedScroll = null;
const nearScroller = {
  clientHeight: 600,
  scrollTop: -590,
  isConnected: true,
  getClientRects: () => [{}],
  scrollTo(options) { this.lastScroll = options; }
};
const hiddenScroller = {...nearScroller, clientHeight: 0, getClientRects: () => []};
const scrollApi = Function(
  "document",
  "setTimeout",
  incomingHostBusOwner,
  `${rendererHelpers.slice(0, scrollHelpersEnd)};return {snapshot:MTKtinrelayScrollSnapshot,schedule:MTKtinrelayScheduleScroll}`
)(
  {querySelectorAll: () => [hiddenScroller, nearScroller]},
  (callback, delay) => { queuedScroll = {callback, delay}; },
  {}
);
const nearSnapshot = scrollApi.snapshot();
assert.equal(nearSnapshot.follow, true, "one viewport from the bottom remains eligible for settled scrolling");
scrollApi.schedule(nearSnapshot);
assert.equal(queuedScroll.delay, 32, "settled scrolling waits for the hoisted card layout");
queuedScroll.callback();
assert.deepEqual(nearScroller.lastScroll, {behavior: "instant", top: 0}, "settled scrolling uses the thread's bottom origin");
nearScroller.lastScroll = null;
nearScroller.scrollTop = -590;
queuedScroll = null;
scrollApi.schedule(scrollApi.snapshot());
nearScroller.scrollTop = -601;
queuedScroll.callback();
assert.equal(nearScroller.lastScroll, null, "scrolling away during the layout delay cancels the snap to bottom");
nearScroller.scrollTop = -601;
queuedScroll = null;
scrollApi.schedule(scrollApi.snapshot());
assert.equal(queuedScroll, null, "reading more than one viewport up is never disturbed");
for (const forbidden of ["dangerouslySetInnerHTML", "innerHTML", "MTKoutboundFormattedText", "window.open"])
  assert.ok(!rendererHelpers.includes(forbidden), `renderer omits ${forbidden}`);
assert.match(rendererHelpers,
  /\(0,[A-Za-z_$][\w$]*\.jsx\)\([A-Za-z_$][\w$]*,\{message:e,collapsedLineCount:6,compactActions:!0,hideActions:!0,cwd:null,hostId:"local"\}\)/,
  "incoming and outgoing bodies reuse Codex's complete stock user-message bubble");
assert.ok(!rendererHelpers.includes('maxWidth:"min(38rem,86%)"'),
  "Tinrelay does not maintain a competing message-width rule");
assert.equal((rendererSource.match(/messageNode:MTKtinrelayPointerNode\(i\)/g) ?? []).length, 1,
  "only delegated messages receive the pointer presentation seam");
assert.ok(rendererHelpers.includes('useState({status:"loading"})'),
  "valid pointers enter automatic inspection state");
assert.ok(rendererHelpers.includes('useRef(!1)') && rendererHelpers.includes('if(!o.current){o.current=!0'),
  "mounted pointer dispatch is one-shot");
assert.ok(rendererHelpers.includes("d.current=MTKtinrelayScrollSnapshot()"),
  "incoming inspection snapshots scroll position before replacing the pointer body");
assert.ok(rendererHelpers.includes("MTKtinrelayScheduleScroll(d.current)"),
  "a matching incoming transmission schedules settled scrolling");
assert.ok(rendererHelpers.includes('children:["📡 ",u]'), "compact radio marker is visible");
assert.ok(rendererHelpers.includes('text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description'),
  "remote address occupies the native delegated-attribution position");
assert.ok(rendererSource.includes("MTKmessageNode?null:"),
  "a Tinrelay message suppresses the misleading local source-task attribution");
assert.ok(rendererHelpers.includes('MTKtinrelayAddress(r.transmission.authorLabel,r.transmission.senderShip)'),
  "sender uses local@ship address");
assert.ok(rendererHelpers.includes('MTKtinrelayAddress(null,n.sender_ship)'),
  "an unlabeled sender retains the canonical @ship address while loading");
assert.ok(rendererHelpers.includes('MTKtinrelayAddress(r.transmission.attentionLabel,r.transmission.localShip)'),
  "recipient uses local@ship address");
for (const transportLabel of ["From: ", "To: ", "Attention: ", "Local ID: "])
  assert.ok(!rendererHelpers.includes(transportLabel), `renderer hides ${transportLabel}`);
assert.ok(!rendererHelpers.includes("Inspect locally"), "inspection does not wait for a click");
for (const retired of ["Hide transmission", "Show transmission", "aria-expanded", "bg-surface-secondary/50", "linear-gradient(110deg"])
  assert.ok(!rendererHelpers.includes(retired), `renderer omits retired disclosure surface ${retired}`);
assert.ok(rendererHelpers.includes('className:"mtk-tinrelay-signal'), "radio surface owns a distinct signal treatment");
assert.ok(rendererHelpers.includes("repeating-radial-gradient"), "radio surface carries faint emission rings");
assert.ok(rendererHelpers.includes("circle at 14% 82%"), "radio wake enters from a diagonal lower-left origin");
assert.ok(rendererHelpers.includes("circle at 7% 72%"), "outgoing radio wake exposes its source on the left edge");
assert.ok(rendererHelpers.includes("rgba(190,196,204,.34) 35px 37px"),
  "incoming radio wake uses one clearly visible crisp two-pixel light ring");
assert.ok(rendererHelpers.includes("@keyframes mtk-tinrelay-signal{0%{transform:scale(1);opacity:0}15%{opacity:.28}50%{opacity:.52}85%{opacity:.28}100%{transform:scale(1.12);opacity:0}}"),
  "each radio wave resets only while transparent");
assert.ok(rendererHelpers.includes("animation:mtk-tinrelay-signal 6s linear infinite"),
  "radio wake remains continuously active");
assert.ok(rendererHelpers.includes("mtk-tinrelay-signal [data-user-message-bubble]::after{animation-delay:-3s}"),
  "a staggered second wave remains visible across the first wave reset");
assert.ok(!rendererHelpers.includes("animation:mtk-tinrelay-signal 1.6s ease-out 1 both"),
  "radio wake does not stop after one cycle");
assert.ok(rendererHelpers.includes("will-change:transform,opacity"),
  "radio animation stays on compositor-friendly properties");
assert.ok(rendererHelpers.includes("transform-origin:14% 82%"),
  "incoming waves expand from their visible source");
assert.ok(rendererHelpers.includes("transform-origin:7% 72%"),
  "outgoing waves expand from their visible source");
assert.ok(!rendererHelpers.includes("transform:scale(.82)"),
  "radio geometry never contracts below the card and leaves an expanded edge unpainted");
assert.ok(rendererHelpers.includes("@media (prefers-reduced-motion:reduce)"),
  "radio signal respects reduced motion");
assert.ok(rendererHelpers.includes("background:#050607!important"),
  "incoming radio surface overrides the stock blue user-message field with opaque near-black");
assert.ok(rendererHelpers.includes("background:#303438!important"),
  "outgoing surface overrides the stock field with its directional gray");
assert.ok(!rendererHelpers.includes("rgba(11,12,14,.68) 0 5px"),
  "outgoing radio wake does not add a competing animated transmitter core");
assert.ok(rendererHelpers.includes("transparent 0 35px,rgba(11,12,14,.52) 35px 37px,transparent 37px 78px"),
  "outgoing radio wake mirrors the incoming surface with one crisp two-pixel dark ring");
assert.ok(rendererHelpers.includes('className:"flex w-full flex-col items-end justify-end gap-1"'),
  "incoming radio surface remains on the receiving side");
assert.ok(rendererHelpers.includes("box-shadow:inset 0 0 0 1px #34383D"), "radio surface has a dark-gray inset edge");
assert.ok(rendererHelpers.includes("color:#F1F3F5"),
  "message body remains high contrast without an opaque slab over the signal rings");
assert.ok(rendererHelpers.includes("mtk-tinrelay-signal [data-user-message-bubble] *{color:#F1F3F5!important}"),
  "dark-mode Markdown descendants remain white");
assert.ok(rendererHelpers.includes("html.electron-light [data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]{background:#F7F8FA!important;box-shadow:inset 0 0 0 1px #C9D0D7;color:#1B1F23!important}"),
  "incoming light-mode transmissions use a porcelain surface with dark text");
assert.ok(rendererHelpers.includes("html.electron-light [data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]{background:#E3E7EB!important;box-shadow:inset 0 0 0 1px #B5BEC7;color:#171B1F!important}"),
  "outgoing light-mode transmissions use a distinct mist-gray surface");
assert.ok(rendererHelpers.includes("rgba(69,78,88,.24) 35px 37px"),
  "incoming light-mode radio waves are crisp dark hairlines");
assert.ok(rendererHelpers.includes("rgba(52,62,72,.28) 35px 37px"),
  "outgoing light-mode radio waves remain directionally distinct");
assert.ok(rendererHelpers.includes("html.electron-light [data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble] *{color:inherit!important}"),
  "light-mode Markdown inherits the card's dark foreground");
assert.ok(!rendererHelpers.includes("padding-top:"),
  "Tinrelay adds no independent vertical-padding correction to the stock bubble");
assert.ok(!rendererHelpers.includes("mtk-tinrelay-body"),
  "Tinrelay does not wrap the stock bubble in a second padded body");
assert.ok(rendererHelpers.includes(".mtk-tinrelay-signal .whitespace-pre-wrap{white-space:normal}"),
  "Markdown soft line breaks collapse while block-level paragraph boundaries remain intact");
assert.ok(rendererHelpers.includes("mtk-tinrelay-signal>.group{align-items:flex-start}"),
  "outgoing transmission alignment mirrors the stock bubble without rebuilding it");
assert.equal((mainSource.match(/case`mtk-tinrelay-pointer-inspect`:/g) ?? []).length, 1,
  "one main-process bridge owner");

process.stdout.write(`${JSON.stringify({
  state: "green",
  sourceGate: "any-delegated-message-with-exact-pointer-shape",
  exactPointerGrammar: true,
  fixedArgv: true,
  metadataEquality: true,
  bodyRendering: "stock-safe-markdown",
  longBodyDisclosure: "stock-six-line-collapse",
  disclosure: "automatic-one-shot",
  retries: false
}, null, 2)}\n`);

function unique(values, label) {
  assert.equal(values.length, 1, label);
  return values[0];
}

function uniqueMatch(value, pattern, label) {
  const matches = [...value.matchAll(pattern)];
  assert.equal(matches.length, 1, label);
  return matches[0];
}
