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
const helpersEnd = mainSource.indexOf("var mQ=i.i(`electron-message-handler`)", helpersStart);
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
    body: "<img src=x onerror=alert(1)>\n**not Markdown**",
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
  assert.deepEqual(call[1], ["inbox", "show", pointer.local_id, "--ship", localShip]);
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

assert.ok(rendererSource.includes("children:r.transmission.body"), "body is an inert React text child");
const rendererHelpers = rendererSource.slice(rendererStart, rendererSource.indexOf("function Cb(", rendererStart));
for (const forbidden of ["dangerouslySetInnerHTML", "innerHTML", "markdown", "MTKoutboundFormattedText", "window.open"])
  assert.ok(!rendererHelpers.includes(forbidden), `renderer omits ${forbidden}`);
assert.equal((rendererSource.match(/messageNode:MTKtinrelayPointerNode\(i\)/g) ?? []).length, 1,
  "only delegated messages receive the pointer presentation seam");
assert.ok(rendererHelpers.includes('useState({status:"loading"})'),
  "valid pointers enter automatic inspection state");
assert.ok(rendererHelpers.includes('useRef(!1)') && rendererHelpers.includes('if(!o.current){o.current=!0'),
  "mounted pointer dispatch is one-shot");
assert.ok(rendererHelpers.includes('children:["📡 ",u]'), "compact radio marker is visible");
assert.ok(rendererHelpers.includes('text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description'),
  "remote address occupies the native delegated-attribution position");
assert.ok(rendererSource.includes("MTKmessageNode?null:"),
  "a Tinrelay message suppresses the misleading local source-task attribution");
assert.ok(rendererHelpers.includes('MTKtinrelayAddress(r.transmission.authorLabel,r.transmission.senderShip)'),
  "sender uses local@ship address");
assert.ok(rendererHelpers.includes('r.transmission.authorLabel===null?r.transmission.senderShip:'),
  "an unlabeled sender falls back to the authenticated ship name without fabricating a local part");
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
assert.ok(rendererHelpers.includes("35px 43px"), "radio wake uses substantial bands rather than hairlines");
assert.ok(rendererHelpers.includes("animation:mtk-tinrelay-signal 18s ease-out infinite"), "radio signal moves slowly");
assert.ok(rendererHelpers.includes("@media (prefers-reduced-motion:reduce)"),
  "radio signal respects reduced motion");
assert.ok(rendererHelpers.includes("background:#0B0C0E"), "radio surface has an opaque black base");
assert.ok(rendererHelpers.includes("border-color:#34383D"), "radio surface has a dark-gray edge");
assert.ok(rendererHelpers.includes("mtk-tinrelay-body{color:#F1F3F5}"),
  "message body remains high contrast without an opaque slab over the signal rings");
assert.ok(!rendererHelpers.includes("mtk-tinrelay-body{background:"),
  "message body does not paint over the radio wake");
assert.equal((mainSource.match(/case`mtk-tinrelay-pointer-inspect`:/g) ?? []).length, 1,
  "one main-process bridge owner");

process.stdout.write(`${JSON.stringify({
  state: "green",
  sourceGate: "any-delegated-message-with-exact-pointer-shape",
  exactPointerGrammar: true,
  fixedArgv: true,
  metadataEquality: true,
  bodyRendering: "inert-plain-text",
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
