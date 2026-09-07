#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: tinrelay-presentation-outgoing.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const renderer = unique(fs.readdirSync(assets).filter(name =>
  /^(?:subagent-activity-chip-group|conversation-blocks)-.*\.js$/.test(name)
).map(name => path.join(assets, name)), "conversation renderer");
const activity = unique(fs.readdirSync(assets).filter(name => /^agent-activity-item-.*\.js$/.test(name))
  .map(name => path.join(assets, name)), "activity classifier");
const main = unique(fs.readdirSync(path.join(root, ".vite/build")).filter(name => /^main-.*\.js$/.test(name))
  .map(name => path.join(root, ".vite/build", name)), "main process");
const rendererSource = fs.readFileSync(renderer, "utf8");
const activitySource = fs.readFileSync(activity, "utf8");
const mainSource = fs.readFileSync(main, "utf8");
const localShip = JSON.parse(uniqueMatch(
  rendererSource,
  /const MTKtinrelayLocalShip=(?<ship>"(?:\\.|[^"\\])*");function MTKtinrelayPointerFromMessage\(/g,
  "embedded local ship"
).groups.ship);

const rendererStart = rendererSource.indexOf("function MTKtinrelayOutgoingAcceptance(");
const rendererEnd = rendererSource.indexOf("function Cb(", rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, "outgoing renderer helpers are localized");
const helper = rendererSource.slice(rendererStart, rendererEnd);
const busName = uniqueMatch(helper, /(?<bus>[$A-Z_a-z][$\w]*)\.subscribe\("mtk-tinrelay-outgoing-result"/g,
  "outgoing renderer host bus").groups.bus;
const jsx = {
  jsx(type, props) { return {type, props}; },
  jsxs(type, props) { return {type, props}; }
};
let hookState = null;
const subscriptions = new Set();
const dispatches = [];
const react = {
  useState() { return [hookState, value => { hookState = value; }]; },
  useEffect(effect) { effect(); }
};
function StockMarkdown() {}
const bus = {
  subscribe(type, callback) {
    assert.equal(type, "mtk-tinrelay-outgoing-result");
    subscriptions.add(callback);
    return () => subscriptions.delete(callback);
  },
  dispatchMessage(type, value) { dispatches.push({type, value}); }
};
let styleCalls = 0;
const rendererApi = Function(
  "Tb", "MTKtinrelayReact", "MTKtinrelayLocalShip", "MTKtinrelayEnsureStyle", "MTKtinrelayAddress", "rg", busName,
  `${helper};return {acceptance:MTKtinrelayOutgoingAcceptance,matches:MTKtinrelayOutgoingMatches,exec:MTKtinrelayOutgoingExec,view:MTKtinrelayOutgoingView}`
)(jsx, react, localShip, () => { styleCalls += 1; }, (label, ship) => `${label}@${ship}`, StockMarkdown, bus);

const transmissionId = "11111111-1111-4111-8111-111111111111";
const acceptance = {
  recipient_ship: "friendly-ship",
  sender_ship: localShip,
  state: "accepted",
  transmission_id: transmissionId
};
const event = {
  contract: "tinrelay-outgoing-observer-v1",
  kind: "transmission",
  transmission_id: transmissionId,
  sender_ship: localShip,
  recipient_ship: "friendly-ship",
  attention_label: "aster",
  author_label: "mechanic",
  body: "Hello from below deck.\n<em>This stays text.</em>"
};
const item = execItem(acceptance);
assert.deepEqual(rendererApi.acceptance(item, localShip), acceptance);
assert.equal(rendererApi.matches(event, acceptance), true);

function Stock() {}
const componentProps = {Component: Stock, item, hostId: "local", isTurnInProgress: false};
const pending = rendererApi.exec(componentProps);
assert.equal(pending.type, Stock, "ordinary command rendering remains until matching observer evidence arrives");
assert.equal(dispatches.length, 1);
assert.equal(dispatches[0].type, "mtk-tinrelay-outgoing-lookup");
assert.deepEqual({...dispatches[0].value, requestId: "ignored"}, {
  requestId: "ignored",
  transmissionId,
  senderShip: localShip,
  recipientShip: "friendly-ship"
});
for (const callback of subscriptions) callback({
  type: "mtk-tinrelay-outgoing-result",
  requestId: dispatches[0].value.requestId,
  ok: true,
  event
});
const observed = rendererApi.exec(componentProps);
assert.equal(observed.type.name, "MTKtinrelayOutgoingView");
const rendered = observed.type(observed.props);
assert.equal(styleCalls, 1, "outgoing card reuses the incoming radio stylesheet");
assert.equal(rendered.props.className, "flex w-full flex-col items-start justify-start gap-1",
  "outgoing card mirrors the incoming card across the conversation");
assert.ok(rendererSource.includes("circle at 7% 72%"),
  "outgoing emission rings expose their source along the left edge");
assert.ok(rendererSource.includes("background:#34383D"),
  "outgoing surface inverts the incoming black-field palette");
assert.ok(rendererSource.includes("rgba(11,12,14,.82) 0 7px"),
  "outgoing wake begins with a visible dark transmitter source");
const [route, card] = rendered.props.children;
assert.deepEqual(route.props.children, ["📡 ", `mechanic@${localShip} → aster@friendly-ship`]);
assert.equal(card.props["data-mtk-tinrelay-pointer"], true, "shared radio styling owns the card");
assert.equal(card.props["data-mtk-tinrelay-outgoing"], true, "outgoing direction remains inspectable");
assert.equal(card.props.children[0].props["aria-label"], "Accepted by Tinrelay");
assert.equal(card.props.style.maxWidth, "min(38rem,86%)", "outgoing card uses the narrower radio width");
assert.equal(card.props.children[1].props.children.type, StockMarkdown,
  "outgoing body uses Codex's stock safe Markdown renderer");
assert.deepEqual(card.props.children[1].props.children.props, {
  text: event.body,
  cwd: null,
  hostId: "local",
  collapsedLineCount: 6
}, "long outgoing Markdown uses the stock six-line Show more disclosure");

const unlabeled = {...event, author_label: null, attention_label: ""};
const unlabeledRoute = rendererApi.view({event: unlabeled}).props.children[0].props.children[1];
assert.equal(unlabeledRoute, `${localShip} → friendly-ship`, "absent labels are not fabricated");

for (const [label, candidate] of [
  ["nonzero exit", execItem(acceptance, {exitCode: 2})],
  ["wrong sender", execItem({...acceptance, sender_ship: "other-ship"})],
  ["wrong state", execItem({...acceptance, state: "delivered"})],
  ["unknown field", execItem({...acceptance, secret: "no"})],
  ["empty id", execItem({...acceptance, transmission_id: ""})],
  ["non-UUID id", execItem({...acceptance, transmission_id: "tr-outgoing-test-1"})],
  ["extra output", execItem(acceptance, {suffix: "noise\n"})],
  ["carriage return", execItem(acceptance, {prefix: "\r"})]
]) assert.equal(rendererApi.acceptance(candidate, localShip), null, label);

const activityStart = activitySource.indexOf("const MTKtinrelayOutgoingLocalShip=");
const activityEnd = activitySource.indexOf("function ln(", activityStart);
assert.ok(activityStart >= 0 && activityEnd > activityStart, "outgoing activity parser is localized");
const activityApi = Function(`${activitySource.slice(activityStart, activityEnd)};return MTKtinrelayOutgoingAcceptance`)();
assert.deepEqual(activityApi(item, localShip), acceptance, "activity classifier recognizes ordinary Tinrelay acceptance");
assert.equal((activitySource.match(/MTKtinrelayOutgoingAcceptance\(e,MTKtinrelayOutgoingLocalShip\)!=null\?`standalone`/g) ?? []).length, 1,
  "recognized sends are first-class standalone conversation items");
assert.equal((rendererSource.match(/\(MTKtinrelayOutgoingExec,\{Component:/g) ?? []).length, 1,
  "one exec renderer owns the outgoing card");

const collapseStart = rendererSource.indexOf("function GE(");
const collapseEnd = rendererSource.indexOf("var JE=", collapseStart);
assert.ok(collapseStart >= 0 && collapseEnd > collapseStart, "collapsed activity classifier is localized");
const collapseApi = Function(
  "Zm", "Kl", "MTKtinrelayOutgoingAcceptance", "MTKtinrelayLocalShip",
  `${rendererSource.slice(collapseStart, collapseEnd)};return GE`
)(
  () => false,
  () => null,
  activityApi,
  localShip
);
const unit = {kind: "standalone", item: {item}};
const collapsed = collapseApi([unit]);
assert.deepEqual(collapsed.persistentUnits, [unit],
  "an accepted outgoing transmission remains hoisted when its activity turn is collapsed");
assert.deepEqual(collapsed.collapsibleUnits, [],
  "the hoisted transmission is not duplicated inside the collapsed activity body");

for (const forbidden of ["dangerouslySetInnerHTML", "innerHTML", "markdown", "eval(", "window.open", "TINRELAY OUTGOING RECEIPT"])
  assert.ok(!helper.includes(forbidden), `renderer omits ${forbidden}`);

const mainStart = mainSource.indexOf("const MTKtinrelayOutgoingContract=");
const mainEnd = [mainSource.indexOf("var mQ=i.i(`electron-message-handler`)", mainStart),
  mainSource.indexOf("var pQ=i.i(`electron-message-handler`)", mainStart)].find(index => index >= 0);
assert.ok(mainStart >= 0 && mainEnd > mainStart, "outgoing main helpers are localized");
const localRequire = await import("node:module").then(({createRequire}) => createRequire(import.meta.url));
const mainApiFactory = () => Function("require", `${mainSource.slice(mainStart, mainEnd)};return {event:MTKtinrelayOutgoingEvent,remember:MTKtinrelayRememberOutgoing,read:MTKtinrelayReadOutgoing,lookup:MTKtinrelayOutgoingLookup,start:MTKtinrelayStartOutgoingObserver}`)(localRequire);
const mainApi = mainApiFactory();

assert.equal(mainApi.event({...event, extra: true}), null, "observer event shape is exact");
assert.equal(mainApi.event({...event, sender_ship: "other-ship"}), null, "observer is local-ship scoped");
assert.equal(mainApi.event({...event, transmission_id: "not-a-uuid"}), null,
  "observer transmission IDs use Tinrelay's exact UUID grammar");
assert.equal(mainApi.event(event)?.body, event.body);

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-outgoing-observer-test-"));
const socketDir = fs.mkdtempSync(path.join(os.tmpdir(), "mtko-"));
const originalHome = process.env.HOME;
try {
  process.env.HOME = scratch;
  const appUserData = path.join(scratch, "app-user-data");
  const cacheDirectory = path.join(appUserData, "mechanics-toolkit", "tinrelay", localShip,
    "outgoing-presentations");
  const configDir = path.join(scratch, ".config", "tinrelay", localShip);
  fs.mkdirSync(configDir, {recursive: true, mode: 0o700});
  fs.chmodSync(configDir, 0o700);
  const publicSocketDir = path.join(scratch, "public-socket");
  fs.mkdirSync(publicSocketDir, {mode: 0o755});
  fs.chmodSync(publicSocketDir, 0o755);
  const publicSocketPath = path.join(publicSocketDir, "observer.sock");
  const configPath = path.join(configDir, "outgoing-observer.json");
  fs.writeFileSync(configPath, JSON.stringify({socket_path: publicSocketPath}));
  const disposeDisabled = await mainApi.start(appUserData);
  assert.equal(fs.existsSync(publicSocketPath), false, "observer rejects a group/world-accessible parent");
  assert.equal(fs.statSync(cacheDirectory).mode & 0o777, 0o700, "presentation cache is private");
  disposeDisabled();

  fs.chmodSync(socketDir, 0o700);
  const socketPath = path.join(socketDir, "observer.sock");
  fs.writeFileSync(configPath, JSON.stringify({socket_path: socketPath}));
  const dispose = await mainApi.start(appUserData);
  assert.equal(fs.lstatSync(socketPath).isSocket(), true, "observer binds the configured Unix socket");

  const delayedId = "22222222-2222-4222-8222-222222222222";
  const delayed = mainApi.lookup({requestId: "request-1", transmissionId: delayedId,
    senderShip: localShip, recipientShip: "friendly-ship"});
  const delayedEvent = {...event, transmission_id: delayedId};
  await send(socketPath, `${JSON.stringify(delayedEvent)}\n`, 2);
  assert.deepEqual(await delayed, delayedEvent, "lookup bridges the socket/stdout event-order race");
  const delayedCache = path.join(cacheDirectory, `${delayedId}.json`);
  assert.equal(fs.statSync(delayedCache).mode & 0o777, 0o600, "accepted event cache file is private");
  assert.deepEqual(JSON.parse(fs.readFileSync(delayedCache, "utf8")), delayedEvent,
    "accepted event is durably cached without changing Tinrelay output");

  const duplicate = {...delayedEvent, body: "conflicting duplicate"};
  await send(socketPath, `${JSON.stringify(duplicate)}\n`);
  assert.deepEqual(await mainApi.lookup({requestId: "request-2", transmissionId: delayedId,
    senderShip: localShip, recipientShip: "friendly-ship"}), delayedEvent, "first valid event wins by transmission ID");

  const malformedId = "33333333-3333-4333-8333-333333333333";
  await send(socketPath, `${JSON.stringify({...event, transmission_id: malformedId, extra: true})}\n`);
  assert.equal(await mainApi.lookup({requestId: "request-3", transmissionId: malformedId,
    senderShip: localShip, recipientShip: "friendly-ship"}), null, "malformed socket events are ignored");

  const oversizedId = "44444444-4444-4444-8444-444444444444";
  const oversized = {...event, transmission_id: oversizedId, body: "x".repeat(21 * 1024)};
  await send(socketPath, `${JSON.stringify(oversized)}\n`);
  assert.equal(await mainApi.lookup({requestId: "request-4", transmissionId: oversizedId,
    senderShip: localShip, recipientShip: "friendly-ship"}), null, "events larger than 20 KiB are ignored");

  dispose();
  await tick();
  assert.equal(fs.existsSync(socketPath), false, "observer removes only its socket on disposal");

  const restarted = mainApiFactory();
  const disposeRestarted = await restarted.start(appUserData);
  assert.deepEqual(await restarted.lookup({requestId: "request-after-restart", transmissionId: delayedId,
    senderShip: localShip, recipientShip: "friendly-ship"}), delayedEvent,
  "a historical task reconstructs its outgoing presentation after app restart");

  const corruptId = "55555555-5555-4555-8555-555555555555";
  fs.writeFileSync(path.join(cacheDirectory, `${corruptId}.json`), "not json\n", {mode: 0o600});
  assert.equal(restarted.read(corruptId), null, "corrupt presentation cache data is ignored");

  const mismatchedId = "55555555-5555-4555-8555-555555555556";
  fs.writeFileSync(path.join(cacheDirectory, `${mismatchedId}.json`), `${JSON.stringify({
    ...event, transmission_id: mismatchedId, recipient_ship: "other-ship"
  })}\n`, {mode: 0o600});
  assert.equal(await restarted.lookup({requestId: "request-mismatched-cache", transmissionId: mismatchedId,
    senderShip: localShip, recipientShip: "friendly-ship"}), null,
  "cached routing must match the ordinary acceptance result");

  for (let index = 0; index < 257; index += 1) {
    const id = `60000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    restarted.remember({...event, transmission_id: id});
  }
  const cacheFiles = fs.readdirSync(cacheDirectory).filter(name => /^[0-9a-f-]{36}\.json$/.test(name));
  assert.equal(cacheFiles.length, 256, "presentation cache retains at most 256 events across restarts");
  assert.ok(cacheFiles.includes("60000000-0000-4000-8000-000000000256.json"),
    "the newest accepted event survives pruning");
  assert.equal(fs.readdirSync(cacheDirectory).some(name => name.endsWith(".tmp")), false,
    "atomic cache writes leave no temporary residue");
  disposeRestarted();
  await tick();
} finally {
  if (originalHome == null) delete process.env.HOME;
  else process.env.HOME = originalHome;
  fs.rmSync(scratch, {recursive: true, force: true});
  fs.rmSync(socketDir, {recursive: true, force: true});
}

process.stdout.write(`${JSON.stringify({
  state: "green",
  contract: "tinrelay-outgoing-observer-v1",
  cli: "ordinary-tinrelay-send-stdout-unchanged",
  observer: "private-configured-unix-socket",
  restartContinuity: "bounded-private-codex-presentation-cache",
  correlation: "transmission-id",
  acceptedState: "relay-accepted-not-delivered",
  grouping: "standalone-persistent",
  bodyRendering: "stock-safe-markdown",
  longBodyDisclosure: "stock-six-line-collapse",
  styling: "shared-radio-wake"
}, null, 2)}\n`);

function execItem(value, {exitCode = 0, prefix = "", suffix = ""} = {}) {
  return {
    type: "exec",
    output: {
      exitCode,
      aggregatedOutput: `${prefix}${JSON.stringify(value)}\n${suffix}`
    }
  };
}

function send(socketPath, text, splitAt = null) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => {
      if (splitAt == null) socket.end(text);
      else {
        socket.write(text.slice(0, splitAt));
        socket.end(text.slice(splitAt));
      }
    });
    socket.on("error", reject);
    socket.on("close", resolve);
  });
}

function tick() {
  return new Promise(resolve => setTimeout(resolve, 20));
}

function unique(values, label) {
  assert.equal(values.length, 1, label);
  return values[0];
}

function uniqueMatch(value, pattern, label) {
  const matches = [...value.matchAll(pattern)];
  assert.equal(matches.length, 1, label);
  return matches[0];
}
