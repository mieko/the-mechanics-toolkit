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
const outgoingViewStart = rendererSource.indexOf("function MTKtinrelayOutgoingView(", rendererStart);
const rendererEnd = rendererSource.indexOf("function ", outgoingViewStart + "function ".length);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, "outgoing renderer helpers are localized");
const helper = rendererSource.slice(rendererStart, rendererEnd);
const jsxName = uniqueMatch(helper, /\(0,(?<jsx>[$A-Z_a-z][$\w]*)\.jsx\)\("div",\{"data-mtk-tinrelay-outgoing-turn":!0/g,
  "outgoing renderer JSX runtime").groups.jsx;
const busName = unique([...new Set([...helper.matchAll(
  /(?<bus>[$A-Z_a-z][$\w]*)\.subscribe\("mtk-tinrelay-outgoing-result"/g
)].map(match => match.groups.bus))], "outgoing renderer host bus");
const jsx = {
  jsx(type, props) { return {type, props}; },
  jsxs(type, props) { return {type, props}; }
};
const hookSlots = new Map();
let activeSlots = null;
let hookIndex = 0;
const subscriptions = new Map();
const dispatches = [];
const scrollToken = {follow: true};
const scrollSnapshots = [];
const scheduledScrolls = [];
const react = {
  useState(initial) {
    const index = hookIndex++;
    if (!(index in activeSlots)) activeSlots[index] = typeof initial === "function" ? initial() : initial;
    return [activeSlots[index], value => {
      activeSlots[index] = typeof value === "function" ? value(activeSlots[index]) : value;
    }];
  },
  useEffect(effect) { effect(); },
  useRef(value) {
    const index = hookIndex++;
    if (!(index in activeSlots)) activeSlots[index] = {current: value};
    return activeSlots[index];
  }
};
function StockMessageBubble() {}
const bus = {
  subscribe(type, callback) {
    let listeners = subscriptions.get(type);
    if (listeners == null) subscriptions.set(type, listeners = new Set());
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  dispatchMessage(type, value) { dispatches.push({type, value}); }
};
const rendererApiFactory = () => Function(
    jsxName, "MTKtinrelayReact", "MTKtinrelayLocalShip", "MTKtinrelayAddress",
    "MTKtinrelayScrollSnapshot", "MTKtinrelayScheduleScroll", "MTKtinrelayMessageView", busName,
    `${helper};return {acceptance:MTKtinrelayOutgoingAcceptance,matches:MTKtinrelayOutgoingMatches,exec:MTKtinrelayOutgoingExec,turn:MTKtinrelayOutgoingTurnPresentations,view:MTKtinrelayOutgoingView}`
  )(
    jsx,
    react,
    localShip,
    (label, ship) => `${label || ""}@${ship}`,
    () => { scrollSnapshots.push(scrollToken); return scrollToken; },
    value => scheduledScrolls.push(value),
    StockMessageBubble,
    bus
  );
const rendererApi = rendererApiFactory();

const liveAnchorListeners = [...(subscriptions.get("mtk-tinrelay-outgoing-result") ?? [])];
assert.equal(liveAnchorListeners.length, 1,
  "a module-lived listener reconciles durable anchors after their source exec unmounts");
const detachedTransmissionId = "10101010-1010-4010-8010-101010101010";
const detachedEvent = {
  contract: "tinrelay-outgoing-observer-v1",
  kind: "transmission",
  transmission_id: detachedTransmissionId,
  sender_ship: localShip,
  recipient_ship: "friendly-ship",
  attention_label: "aster",
  author_label: "mechanic",
  body: "The source command has already left the activity tree."
};
liveAnchorListeners[0]({
  type: "mtk-tinrelay-outgoing-result",
  requestId: "detached-source-exec",
  ok: true,
  event: detachedEvent,
  anchor: {
    contract: "tinrelay-outgoing-anchor-v1",
    sourceThreadId: "detached-source-task",
    sourceTurnId: "detached-source-turn",
    transmissionId: detachedTransmissionId,
    recordedAtMs: Date.now(),
    event: detachedEvent
  }
});
const detachedTurn = renderWithHooks("detached-turn", rendererApi.turn,
  {conversationId: "detached-source-task", turnId: "detached-source-turn"});
assert.equal(detachedTurn.props.children[0].props.event, detachedEvent,
  "the turn receives a persisted outgoing card even when its request-scoped listener is gone");
dispatches.length = 0;

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
const componentProps = {Component: Stock, item, hostId: "local", isTurnInProgress: false,
  sourceThreadId: "source-task", sourceTurnId: "source-turn"};
const pending = renderWithHooks("exec", rendererApi.exec, componentProps);
assert.equal(pending.type, Stock, "ordinary command rendering remains until matching observer evidence arrives");
assert.deepEqual(scrollSnapshots, [scrollToken], "outgoing lookup snapshots the pre-hoist scroll position");
assert.equal(dispatches.length, 1);
assert.equal(dispatches[0].type, "mtk-tinrelay-outgoing-lookup");
assert.deepEqual({...dispatches[0].value, requestId: "ignored"}, {
  requestId: "ignored",
  transmissionId,
  senderShip: localShip,
  recipientShip: "friendly-ship",
  sourceThreadId: "source-task",
  sourceTurnId: "source-turn"
});
const rendererAnchor = {
  contract: "tinrelay-outgoing-anchor-v1",
  sourceThreadId: "source-task",
  sourceTurnId: "source-turn",
  transmissionId,
  recordedAtMs: Date.now(),
  event
};
for (const callback of subscriptions.get("mtk-tinrelay-outgoing-result") ?? []) callback({
  type: "mtk-tinrelay-outgoing-result",
  requestId: dispatches[0].value.requestId,
  ok: true,
  event,
  anchor: rendererAnchor
});
assert.deepEqual(scheduledScrolls, [scrollToken], "a matching outgoing transmission schedules settled scrolling");
assert.equal(dispatches.filter(entry => entry.type === "mtk-tinrelay-outgoing-anchor-remember").length, 0,
  "the successful lookup returns the main-process anchor instead of relying on a second silent IPC write");
const observed = renderWithHooks("exec", rendererApi.exec, componentProps);
assert.equal(observed, null, "the source exec disappears after the turn-owned presentation is anchored");
const turn = renderWithHooks("turn", rendererApi.turn, {conversationId: "source-task", turnId: "source-turn"});
assert.equal(turn.props["data-mtk-tinrelay-outgoing-turn"], true);
const anchored = turn.props.children[0];
assert.equal(anchored.type.name, "MTKtinrelayOutgoingView");
const rendered = anchored.type(anchored.props);
const restartedRenderer = rendererApiFactory();
assert.equal(renderWithHooks("restarted-turn", restartedRenderer.turn,
  {conversationId: "source-task", turnId: "source-turn"}), null,
"a fresh renderer waits for its private source-task anchor bucket");
const anchorRequest = dispatches.findLast(entry => entry.type === "mtk-tinrelay-outgoing-anchors-list");
assert.ok(anchorRequest, "fresh renderer requests source-task anchors");
for (const callback of subscriptions.get("mtk-tinrelay-outgoing-anchors-result") ?? []) callback({
  type: "mtk-tinrelay-outgoing-anchors-result",
  requestId: anchorRequest.value.requestId,
  ok: true,
  records: [{
    contract: "tinrelay-outgoing-anchor-v1",
    sourceThreadId: "source-task",
    sourceTurnId: "source-turn",
    transmissionId,
    recordedAtMs: rendererAnchor.recordedAtMs,
    event
  }]
});
const reconstructed = renderWithHooks("restarted-turn", restartedRenderer.turn,
  {conversationId: "source-task", turnId: "source-turn"});
assert.equal(reconstructed.props.children[0].props.event, event,
  "a fresh renderer rebuilds the card without the original command activity");
assert.equal(rendered.props.className, "flex w-full flex-col items-start justify-start gap-1",
  "outgoing card mirrors the incoming card across the conversation");
assert.ok(rendererSource.includes("circle at 7% 72%"),
  "outgoing emission rings expose their source along the left edge");
assert.ok(rendererSource.includes("background:#303438!important"),
  "outgoing surface uses a slightly darker inverted palette");
assert.ok(rendererSource.includes("mtk-tinrelay-signal [data-user-message-bubble] *{color:#F1F3F5!important}"),
  "outgoing Markdown descendants remain white in dark mode");
assert.ok(rendererSource.includes("html.electron-light [data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]{background:#E3E7EB!important;box-shadow:inset 0 0 0 1px #B5BEC7;color:#171B1F!important}"),
  "outgoing light-mode transmissions have their own mist-gray palette");
assert.ok(rendererSource.includes("html.electron-light [data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble] *{color:inherit!important}"),
  "outgoing light-mode Markdown inherits the card's dark foreground");
assert.ok(rendererSource.includes("transparent 0 35px,rgba(11,12,14,.52) 35px 37px,transparent 37px 78px"),
  "outgoing wake implies its left-edge source with sparse crisp rings rather than a solid core");
const [route, card] = rendered.props.children;
assert.deepEqual(route.props.children, ["📡 ", `mechanic@${localShip} → aster@friendly-ship`]);
assert.equal(card.type, StockMessageBubble, "outgoing cards use the shared Tinrelay stock-bubble presentation");
assert.deepEqual(card.props, {
  body: event.body,
  outgoing: true,
  screenReaderStatus: "Accepted by Tinrelay"
}, "outgoing direction changes only presentation metadata around the shared bubble");

const unlabeled = {...event, author_label: null, attention_label: ""};
const unlabeledRoute = rendererApi.view({event: unlabeled}).props.children[0].props.children[1];
assert.equal(unlabeledRoute, `@${localShip} → @friendly-ship`, "ship-wide endpoints retain canonical @ship addresses");

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
const activityEnd = ["function an(", "function ln("]
  .map(marker => activitySource.indexOf(marker, activityStart))
  .find(index => index >= 0) ?? -1;
assert.ok(activityStart >= 0 && activityEnd > activityStart, "outgoing activity parser is localized");
const activityApi = Function(`${activitySource.slice(activityStart, activityEnd)};return MTKtinrelayOutgoingAcceptance`)();
assert.deepEqual(activityApi(item, localShip), acceptance, "activity classifier recognizes ordinary Tinrelay acceptance");
assert.equal((activitySource.match(/MTKtinrelayOutgoingAcceptance\(e,MTKtinrelayOutgoingLocalShip\)!=null\?`standalone`/g) ?? []).length, 1,
  "recognized sends are first-class standalone conversation items");
assert.equal((rendererSource.match(/\(MTKtinrelayOutgoingExec,\{Component:/g) ?? []).length, 1,
  "one exec renderer owns the outgoing card");

const collapseMarker = rendererSource.indexOf("i.type===`exec`&&MTKtinrelayOutgoingAcceptance(i,MTKtinrelayLocalShip)!=null||");
const collapseStart = rendererSource.lastIndexOf("function ", collapseMarker);
const collapseEndMarker = rendererSource.indexOf("}function ", collapseMarker);
const collapseEnd = collapseEndMarker < 0 ? -1 : collapseEndMarker + 1;
assert.ok(collapseStart >= 0 && collapseEnd > collapseStart, "collapsed activity classifier is localized");
const collapseSource = rendererSource.slice(collapseStart, collapseEnd);
const collapseFunction = collapseSource.match(/^function (?<name>[$A-Z_a-z][$\w]*)\(/)?.groups.name;
const collapseAggregateStart = rendererSource.lastIndexOf("function ", collapseStart - 1);
const collapseAggregateSource = rendererSource.slice(collapseAggregateStart, collapseEnd);
const collapseAggregate = collapseAggregateSource.match(/^function (?<name>[$A-Z_a-z][$\w]*)\(/)?.groups.name;
const dynamicPredicate = collapseSource.match(/i\.type===`dynamic-tool-call`&&(?<name>[$A-Z_a-z][$\w]*)\(i\)/)?.groups.name;
const mcpPredicate = collapseSource.match(/i\.type===`mcp-tool-call`&&(?<name>[$A-Z_a-z][$\w]*)\(\{item:i,mcpServerStatuses:n\}\)/)?.groups.name;
assert.ok(collapseFunction && collapseAggregate && dynamicPredicate && mcpPredicate, "collapsed activity classifier dependencies");
const collapseApi = Function(
  dynamicPredicate, mcpPredicate, "MTKtinrelayOutgoingAcceptance", "MTKtinrelayLocalShip",
  `${collapseAggregateSource};return ${collapseAggregate}`
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
const mainEnd = [mainSource.indexOf("var dQ=i.i(`electron-message-handler`)", mainStart),
  mainSource.indexOf("var mQ=i.i(`electron-message-handler`)", mainStart),
  mainSource.indexOf("var pQ=i.i(`electron-message-handler`)", mainStart),
  mainSource.indexOf("var fQ=i.i(`electron-message-handler`)", mainStart)].find(index => index >= 0);
assert.ok(mainStart >= 0 && mainEnd > mainStart, "outgoing main helpers are localized");
const localRequire = await import("node:module").then(({createRequire}) => createRequire(import.meta.url));
const mainApiFactory = () => Function("require", `${mainSource.slice(mainStart, mainEnd)};return {event:MTKtinrelayOutgoingEvent,remember:MTKtinrelayRememberOutgoing,read:MTKtinrelayReadOutgoing,lookup:MTKtinrelayOutgoingLookup,anchorRemember:MTKtinrelayOutgoingAnchorRemember,anchorsList:MTKtinrelayOutgoingAnchorsList,start:MTKtinrelayStartOutgoingObserver}`)(localRequire);
const mainApi = mainApiFactory();
const mainHandlerStart = mainSource.indexOf("case`mtk-tinrelay-outgoing-lookup`:");
const mainHandlerEnd = mainSource.indexOf("case`electron-add-new-workspace-root-option`:", mainHandlerStart);
assert.ok(mainHandlerStart >= 0 && mainHandlerEnd > mainHandlerStart,
  "outgoing main request handlers are localized");
const mainHandlerFactory = api => Function(
  "MTKtinrelayOutgoingLookup", "MTKtinrelayOutgoingAnchorRemember", "MTKtinrelayOutgoingAnchorsList",
  "MTKtinrelayOutgoingAnchorContract",
  `return async function(type,t,e){switch(type){${mainSource.slice(mainHandlerStart, mainHandlerEnd)}default:break}}`
)(api.lookup, api.anchorRemember, api.anchorsList, "tinrelay-outgoing-anchor-v1");

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
  const responses = [];
  const mainHandler = mainHandlerFactory(mainApi);
  await mainHandler.call({windowManager: {sendMessageToWebContents(_webContents, response) {
    responses.push(response);
  }}}, "mtk-tinrelay-outgoing-lookup", {
    requestId: "request-with-anchor",
    transmissionId: delayedId,
    senderShip: localShip,
    recipientShip: "friendly-ship",
    sourceThreadId: "source-task",
    sourceTurnId: "source-turn"
  }, {});
  const anchor = responses[0].anchor;
  assert.deepEqual(responses[0], {
    type: "mtk-tinrelay-outgoing-result",
    requestId: "request-with-anchor",
    ok: true,
    event: delayedEvent,
    anchor
  });
  assert.deepEqual(anchor, {
    contract: "tinrelay-outgoing-anchor-v1",
    sourceThreadId: "source-task",
    sourceTurnId: "source-turn",
    transmissionId: delayedId,
    recordedAtMs: anchor.recordedAtMs,
    event: delayedEvent
  }, "the successful lookup durably anchors the observed event before acknowledging the renderer");
  const failedAnchorResponses = [];
  const failedAnchorHandler = mainHandlerFactory({...mainApi, anchorRemember() { return null; }});
  await failedAnchorHandler.call({windowManager: {sendMessageToWebContents(_webContents, response) {
    failedAnchorResponses.push(response);
  }}}, "mtk-tinrelay-outgoing-lookup", {
    requestId: "request-with-failed-anchor",
    transmissionId: delayedId,
    senderShip: localShip,
    recipientShip: "friendly-ship",
    sourceThreadId: "source-task",
    sourceTurnId: "source-turn"
  }, {});
  assert.equal(failedAnchorResponses[0].ok, false,
    "the main process does not acknowledge a turn-owned presentation whose durable anchor failed");
  assert.deepEqual(mainApi.anchorsList("source-task"), [anchor]);
  const anchorInput = {
    contract: anchor.contract,
    sourceThreadId: anchor.sourceThreadId,
    sourceTurnId: anchor.sourceTurnId,
    transmissionId: anchor.transmissionId,
    recordedAtMs: anchor.recordedAtMs
  };
  const anchorDirectory = path.join(appUserData, "mechanics-toolkit", "tinrelay", localShip,
    "outgoing-anchors");
  assert.equal(fs.statSync(anchorDirectory).mode & 0o777, 0o700, "turn-anchor directory is private");
  assert.equal(fs.statSync(path.join(anchorDirectory, fs.readdirSync(anchorDirectory)[0])).mode & 0o777, 0o600,
    "turn-anchor bucket is private");

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
  assert.deepEqual(restarted.anchorsList("source-task"), [anchor],
    "turn ownership reconstructs independently of the original exec activity after restart");
  assert.equal(restarted.anchorRemember({...anchorInput, transmissionId: "77777777-7777-4777-8777-777777777777"}), null,
    "renderer claims cannot attach an event that the observer never accepted");

  for (let index = 0; index < 257; index += 1) {
    const id = `70000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const busyEvent = {...event, transmission_id: id};
    restarted.remember(busyEvent);
    restarted.anchorRemember({...anchorInput, sourceThreadId: "busy-task", sourceTurnId: `turn-${index}`,
      transmissionId: id, recordedAtMs: anchor.recordedAtMs + index + 1});
  }
  assert.equal(restarted.anchorsList("busy-task").length, 256,
    "one busy task retains at most 256 outgoing transmission anchors");
  assert.equal(restarted.anchorsList("source-task").length, 1,
    "a busy task does not consume another task's turn-anchor allowance");
  for (let index = 0; index < 65; index += 1) {
    const id = `71000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    restarted.remember({...event, transmission_id: id});
    restarted.anchorRemember({...anchorInput, sourceThreadId: `bucket-task-${index}`, sourceTurnId: "turn",
      transmissionId: id, recordedAtMs: anchor.recordedAtMs + 1000 + index});
  }
  assert.ok(fs.readdirSync(anchorDirectory).filter(name => /^[0-9a-f]{64}\.json$/.test(name)).length <= 64,
    "abandoned source-task anchor buckets have a global safety ceiling");
  assert.equal(restarted.anchorsList("bucket-task-64").length, 1,
    "the currently written source-task bucket survives global pruning");

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
  restartContinuity: "bounded-private-source-task-turn-anchors",
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

function renderWithHooks(key, component, props) {
  activeSlots = hookSlots.get(key);
  if (activeSlots == null) hookSlots.set(key, activeSlots = []);
  hookIndex = 0;
  return component(props);
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
