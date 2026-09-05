#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const extractedRoot = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !process.argv[3]) throw new Error("usage: task-visual-palette.test.mjs EXTRACTED_ASAR_ROOT PALETTE_PROJECT_ROOT");
const projectRoot = path.resolve(process.argv[3]);
const assets = path.join(extractedRoot, "webview/assets");
const assetNames = fs.readdirSync(assets);
const appInitial = uniqueAsset(/^app-initial-.*\.js$/);
const localPage = uniqueAsset(/^local-conversation-page-.*\.js$/);
const delegation = uniqueAsset(/^(?:subagent-activity-chip-group|conversation-blocks)-.*\.js$/);
const source = readAsset(appInitial);
const build7345 = source.includes("function g$c(e){MTKusePaletteBootstrap();") || source.includes("function g$c(e){MTKuseAttentionBootstrap7345();MTKusePaletteBootstrap();");
const build7746 = source.includes("function qOs(){MTKusePaletteBootstrap();") || source.includes("function qOs(){MTKuseAttentionBootstrap7746();MTKusePaletteBootstrap();");
const build7942 = source.includes("function Oks(){MTKusePaletteBootstrap();") || source.includes("function Oks(){MTKuseAttentionBootstrap7942();MTKusePaletteBootstrap();");
const appPrimary = uniqueAsset(/^app-primary-.*\.js$/);
const primarySource = readAsset(appPrimary);
const rendererSource = source + primarySource;
const helperStart = source.indexOf("const MTKpaletteRelativePath=");
const helperTail = source.slice(helperStart);
const helperBoundary = helperTail.match(
  /function [$A-Z_a-z][$\w]*\((?:e)?\)\{(?:MTKuseAttentionBootstrap(?:7345|7746|7942)?\(\);)?MTKusePaletteBootstrap\(\);/
);
const rootBoundary = helperBoundary == null ? -1 : helperStart + helperBoundary.index;
const attentionBoundary = source.indexOf('const MTKattentionRelativePath=', helperStart);
const helperEnd = attentionBoundary >= 0 && attentionBoundary < rootBoundary ? attentionBoundary : rootBoundary;
assert.ok(helperStart >= 0 && helperEnd > helperStart, "palette helper seam");
const helper = source.slice(helperStart, helperEnd);
assert.ok(!helper.includes("k9e"), "palette decoder does not capture a minified bundle binding");
assert.ok(helper.includes("new TextDecoder().decode(Uint8Array.from(atob(e)"), "palette decoder is self-contained");
const api = Function(
  `${helper};return {MTKloadPalette,MTKparsePalette,MTKmatchPalette,MTKcalibration,MTKpaletteMutationRelevant,MTKapplyPaletteSurfaces,MTKclearPaletteSurfaces,MTKsidebarArchiveProtected,MTKreasoningShouldStayOpen}`
)();

const palette = JSON.parse(fs.readFileSync(path.join(projectRoot, ".codex/task-visual-palette.json"), "utf8"));
const owner = "/palette-owner";
const files = new Map();
directory(`${owner}/.codex`);
file(`${owner}/.codex/task-visual-palette.json`, JSON.stringify(palette));
for (const rule of Object.values(palette.rules)) {
  if (rule.mark === undefined) continue;
  const parts = rule.mark.split("/");
  let current = owner;
  for (const part of parts.slice(0, -1)) {
    current += `/${part}`;
    directory(current);
  }
  file(`${owner}/${rule.mark}`, fs.readFileSync(path.join(projectRoot, rule.mark), "utf8"));
}
const client = {
  async sendRequest(method, { path: target }) {
    const entry = files.get(target);
    if (!entry) {
      const error = new Error(`No such file or directory: ${target}`);
      error.code = "ENOENT";
      throw error;
    }
    if (method === "fs/getMetadata") return entry.metadata;
    if (method === "fs/readFile") return { dataBase64: Buffer.from(entry.contents).toString("base64") };
    throw new Error(`unexpected request ${method}`);
  }
};

let manager = null;
let appServerClientCalls = 0;
const managerAtom = Symbol("app-server-manager");
const scope = {
  get(atom) {
    assert.equal(atom, managerAtom);
    return manager;
  },
  when(predicate) {
    assert.equal(predicate({ get: atom => {
      assert.equal(atom, managerAtom);
      return manager;
    } }), false);
    return new Promise(() => {});
  }
};
const react = { useEffect: callback => callback() };
const bootstrapApi = Function(
  "_s", "Ss", "vs", "ys", "Q", "Y", "Ysn", "Can", "Xsn", "fS", "Kjl", "QSl", "XMl", "yYl", "Vg", "Qg", "Lg", "zg", "Hg", "$g", "Rg", "Bg",
  "A_", "$", "x$c", "Pb", "Fb", "pb", "ZOs", "wb", "Tb",
  "hb", "Mks", "Db", "Eb",
  `${helper};return {bootstrap:MTKusePaletteBootstrap,accept:MTKacceptPaletteReload,reasoning:MTKreasoningShouldStayOpen}`
)(
  () => scope, () => scope, () => scope, () => scope, Symbol("scope"), () => [{ projectKind: "local", rootPaths: [owner] }],
  Symbol("groups"), Symbol("old-groups"), Symbol("current-groups"), Symbol("new-groups"), react, react, react, react,
  () => { appServerClientCalls++; if (manager == null) throw new Error("AppServerManager RPC is not connected"); return client; },
  () => { appServerClientCalls++; if (manager == null) throw new Error("AppServerManager RPC is not connected"); return client; },
  () => { appServerClientCalls++; if (manager == null) throw new Error("AppServerManager RPC is not connected"); return client; },
  () => { appServerClientCalls++; if (manager == null) throw new Error("AppServerManager RPC is not connected"); return client; },
  managerAtom, managerAtom, managerAtom, managerAtom,
  () => scope, Symbol("scope-7345"), react,
  () => { appServerClientCalls++; if (manager == null) throw new Error("AppServerManager RPC is not connected"); return client; },
  managerAtom,
  () => scope, react,
  () => { appServerClientCalls++; if (manager == null) throw new Error("AppServerManager RPC is not connected"); return client; },
  managerAtom,
  () => scope, react, managerAtom,
  () => { appServerClientCalls++; if (manager == null) throw new Error("AppServerManager RPC is not connected"); return client; }
);
assert.doesNotThrow(() => bootstrapApi.bootstrap(), "bootstrap waits instead of crashing before App Server readiness");
assert.equal(appServerClientCalls, 0, "host client is not requested before manager readiness");

const loggerSentinel = () => {};
globalThis.k9e = loggerSentinel;
const loaded = await api.MTKloadPalette(client, [owner, owner]);
assert.equal(globalThis.k9e, loggerSentinel, "palette load leaves unrelated logger binding untouched");
delete globalThis.k9e;
assert.ok(loaded, "valid palette loads");
assert.equal(loaded.rules.length, Object.keys(palette.rules).length);
const configuredEntries = Object.entries(palette.rules);
const configuredRules = configuredEntries.map(([, rule]) => rule);
const reasoningEntry = configuredEntries.find(([, rule]) =>
  rule.keepReasoningOpen === true && typeof rule.taskId === "string"
);
assert.ok(reasoningEntry, "configured palette has an exact-ID reasoning-retention rule");
const [reasoningKey, engineRule] = reasoningEntry;
const protectedEntries = configuredEntries.filter(([, rule]) => rule.protectSidebarArchive === true);
const protectedRules = protectedEntries.map(([, rule]) => rule);
assert.ok(protectedRules.length >= 1, "archive protection is an explicit per-rule opt-in");
assert.ok(protectedRules.every(rule => typeof rule.taskId === "string"), "protected entries own exact task IDs in data");
const [protectedKey, protectedRule] = protectedEntries[0];
const protectedTaskId = protectedRule.taskId;
const ordinaryTaskId = "not-a-configured-task";
const protectedLoadedRule = api.MTKmatchPalette(loaded, "", protectedTaskId);
assert.ok(protectedLoadedRule, "protected task ID resolves its configured palette rule");
assert.deepEqual(loaded.calibration, {
  canvas: 11,
  userBubble: 8,
  mappedBubble: 40,
  genericBubble: 16,
  sidebar: 15,
  watermarkDark: 9,
  watermarkLight: 6
});
assert.equal(api.MTKmatchPalette(loaded, "unmatched title", engineRule.taskId)?.color.toLowerCase(), engineRule.color.toLowerCase());
assert.equal(api.MTKsidebarArchiveProtected(protectedTaskId, loaded), true);
assert.equal(api.MTKsidebarArchiveProtected(ordinaryTaskId, loaded), false);
assert.equal(api.MTKsidebarArchiveProtected("Bridge Keeper — Coordination", loaded), false, "titles never authorize archive protection");
assert.equal(api.MTKreasoningShouldStayOpen(engineRule.taskId, loaded), true);
assert.equal(api.MTKreasoningShouldStayOpen("Engine Tender — Repairs", loaded), false, "titles never authorize reasoning retention");
assert.equal(api.MTKreasoningShouldStayOpen(ordinaryTaskId, loaded), false);

const coloredUnprotected = await parse({
  ...palette,
  rules: {
    ...palette.rules,
    [protectedKey]: { ...protectedRule, protectSidebarArchive: false }
  }
});
assert.ok(coloredUnprotected, "colored entries may remain explicitly unprotected");
assert.equal(api.MTKsidebarArchiveProtected(protectedTaskId, coloredUnprotected), false);
assert.equal(await parse({
  ...palette,
  rules: { ...palette.rules, [protectedKey]: { ...protectedRule, protectSidebarArchive: "yes" } }
}), null, "protection flag is boolean-only");
const missingProtectedTaskId = { ...protectedRule };
delete missingProtectedTaskId.taskId;
assert.equal(await parse({
  ...palette,
  rules: { ...palette.rules, [protectedKey]: missingProtectedTaskId }
}), null, "protected entries require an exact task ID");
assert.equal(await parse({
  ...palette,
  rules: { ...palette.rules, [reasoningKey]: { ...engineRule, keepReasoningOpen: "yes" } }
}), null, "reasoning retention is boolean-only");
const missingReasoningTaskId = { ...engineRule };
delete missingReasoningTaskId.taskId;
assert.equal(await parse({
  ...palette,
  rules: { ...palette.rules, [reasoningKey]: missingReasoningTaskId }
}), null, "reasoning retention requires an exact task ID");
for (const rule of loaded.rules) {
  assert.ok(contrast(rule.dark.selection, rule.dark.text) >= 4.5, `${rule.color} dark selection contrast`);
  assert.ok(contrast(rule.light.selection, rule.light.text) >= 4.5, `${rule.color} light selection contrast`);
}

const changedCanvas = await parseWith({ canvas: 12 });
const changedMapped = await parseWith({ mappedBubble: 41 });
const changedSidebar = await parseWith({ sidebar: 16 });
assert.notEqual(changedCanvas.rules[0].dark.canvas, loaded.rules[0].dark.canvas);
assert.equal(changedCanvas.rules[0].dark.bubble, loaded.rules[0].dark.bubble);
assert.notEqual(changedMapped.rules[0].dark.bubble, loaded.rules[0].dark.bubble);
assert.notEqual(changedSidebar.rules[0].dark.row, loaded.rules[0].dark.row);
assert.equal(await parse({ ...palette, calibration: { ...palette.calibration, userBubble: 21 } }), null);
assert.equal(await parse({ ...palette, calibration: { ...palette.calibration, surprise: 1 } }), null);

const documentElement = element();
const bridgeSidebar = element({
  "data-app-action-sidebar-thread-row": "",
  "data-app-action-sidebar-thread-title": "Bridge Keeper — Coordination",
  "data-app-action-sidebar-thread-id": protectedTaskId,
  "data-app-action-sidebar-thread-selected": "true"
});
const ordinarySidebar = element({
  "data-app-action-sidebar-thread-row": "",
  "data-app-action-sidebar-thread-title": "Bridge Keeper ticket",
  "data-app-action-sidebar-thread-id": "ordinary",
  "data-app-action-sidebar-thread-selected": "true"
});
const bridgeRoom = element({
  "data-mtk-palette-room-host": "",
  "data-mtk-palette-thread-id": protectedTaskId
});
const mappedDelegation = element({
  "data-mtk-palette-source-title": "Bridge Keeper — Coordination",
  "data-mtk-palette-source-id": protectedTaskId
});
const genericDelegation = element({
  "data-mtk-palette-source-title": "Unmapped task",
  "data-mtk-palette-source-id": "unmapped"
});
const domElements = [bridgeSidebar, ordinarySidebar, bridgeRoom, mappedDelegation, genericDelegation];
globalThis.document = {
  documentElement,
  body: {},
  getElementById() { return {}; },
  querySelectorAll(selector) {
    if (selector === "[data-app-action-sidebar-thread-row]") return domElements.filter(has("data-app-action-sidebar-thread-row"));
    if (selector === "[data-mtk-palette-room-host]") return domElements.filter(has("data-mtk-palette-room-host"));
    if (selector === "[data-mtk-palette-source-id]") return domElements.filter(has("data-mtk-palette-source-id"));
    if (selector === "[data-mtk-palette-row=true]") return domElements.filter(entry => entry.getAttribute("data-mtk-palette-row") === "true");
    throw new Error(`unexpected selector ${selector}`);
  }
};
globalThis.MutationObserver = class {
  observe() {}
};

const ordinaryTurn = element({}, [element({ class: "ordinary-message" })]);
const nestedMappedDelegation = element({}, [element({}, [mappedDelegation])]);
assert.equal(api.MTKpaletteMutationRelevant([
  mutation("childList", { addedNodes: [ordinaryTurn] })
]), false, "ordinary transcript insertion does not queue a palette-wide rescan");
assert.equal(api.MTKpaletteMutationRelevant([
  mutation("childList", { addedNodes: [bridgeRoom] })
]), true, "room insertion queues the existing full palette apply");
assert.equal(api.MTKpaletteMutationRelevant([
  mutation("childList", { addedNodes: [nestedMappedDelegation] })
]), true, "nested delegation insertion queues the existing full palette apply");
assert.equal(api.MTKpaletteMutationRelevant([
  mutation("childList", { removedNodes: [bridgeSidebar] })
]), true, "sidebar-row removal queues the existing full palette apply");
assert.equal(api.MTKpaletteMutationRelevant([
  mutation("attributes", { attributeName: "data-app-action-sidebar-thread-selected" })
]), true, "observed sidebar state mutation queues the existing full palette apply");

api.MTKapplyPaletteSurfaces(loaded);
assert.equal(documentElement.style.get("--mtk-user-bubble-strength"), "8%");
assert.equal(documentElement.style.get("--mtk-generic-bubble-strength"), "16%");
assert.equal(documentElement.style.get("--mtk-watermark-dark-opacity"), 0.09);
assert.equal(documentElement.style.get("--mtk-watermark-light-opacity"), 0.06);
assert.equal(bridgeRoom.getAttribute("data-mtk-palette-room"), "true");
assert.equal(bridgeRoom.style.get("--mtk-room-dark"), protectedLoadedRule.dark.canvas);
assert.equal(bridgeRoom.style.get("--mtk-selection-dark"), protectedLoadedRule.dark.selection);
assert.equal(mappedDelegation.getAttribute("data-mtk-palette-delegation"), "true");
assert.equal(mappedDelegation.style.get("--mtk-bubble-dark"), protectedLoadedRule.dark.bubble);
assert.equal(mappedDelegation.style.get("--mtk-selection-dark"), protectedLoadedRule.dark.selection);
assert.equal(genericDelegation.getAttribute("data-mtk-palette-delegation"), null);
assert.equal(ordinarySidebar.getAttribute("data-mtk-palette-row"), null);

manager = {};
file(`${owner}/.codex/task-visual-palette.json`, "{partial");
assert.equal(await bootstrapApi.accept(scope, [owner], { initial: false }, () => true), false,
  "invalid external saves are rejected by the consumer acceptance callback");
assert.equal(bridgeRoom.style.get("--mtk-room-dark"), protectedLoadedRule.dark.canvas,
  "an invalid save preserves the last-good palette");
const replacementPalette = structuredClone(palette);
replacementPalette.rules[protectedKey].color = "#4A90E2";
file(`${owner}/.codex/task-visual-palette.json`, JSON.stringify(replacementPalette));
const replacementLoaded = await api.MTKloadPalette(client, [owner]);
assert.equal(await bootstrapApi.accept(scope, [owner], { initial: false }, () => true), true,
  "a complete valid external save is accepted");
assert.equal(bridgeRoom.style.get("--mtk-room-dark"), api.MTKmatchPalette(replacementLoaded, "", protectedTaskId).dark.canvas,
  "accepted palette is applied immediately");
assert.equal(bootstrapApi.reasoning(engineRule.taskId), true, "accepted reload republishes exact-ID reasoning policy");

for (const contract of [
  "color-mix(in oklab,var(--color-text) var(--mtk-user-bubble-strength),transparent)",
  "var(--color-token-interactive-label-accent-default,var(--color-token-text-link-foreground,#339cff)) var(--mtk-generic-bubble-strength)",
  "opacity:var(--mtk-watermark-dark-opacity)",
  "opacity:var(--mtk-watermark-light-opacity)",
  "[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-selected=true],[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active=true]{box-shadow:inset 0 0 0 1px var(--color-token-text-tertiary)!important}",
  "box-shadow:inset 0 0 0 1px var(--mtk-accent-dark)!important",
  "box-shadow:inset 0 0 0 1px var(--mtk-accent-light)!important",
  "[data-mtk-palette-room=true] ::selection{background-color:var(--mtk-selection-dark)}",
  "[data-mtk-palette-delegation=true] [data-user-message-bubble] *::selection",
  "[data-mtk-palette-room=true] [data-mtk-palette-bottom-fade]",
  "--tw-gradient-from:var(--mtk-room-dark)",
  "--tw-gradient-via:var(--mtk-room-light)"
]) assert.ok(rendererSource.includes(contract), `renderer contract: ${contract}`);
assert.ok(!source.includes("[data-user-message-bubble]{opacity:"), "bubble text is never dimmed");
assert.ok(!source.includes("[data-mtk-palette-room=true]{opacity:"), "room content is never dimmed");
assert.ok(!source.includes(":not([data-mtk-palette-delegation=true]) ::selection"), "unmapped delegation selection stays native");
assert.ok(source.includes("function MTKloadPaletteWhenReady("), "startup has an App Server readiness boundary");
assert.ok(source.includes(".when(({get:"), "startup waits for the manager atom instead of throwing");
assert.ok(source.includes("function MTKqueueSidebar(e){if(!MTKpaletteMutationRelevant(e))return;"), "observer rejects irrelevant transcript mutations before queueing");
assert.equal(count(rendererSource, build7746
  ? "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}"
  : build7942 ? "archive:T||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}"
  : build7345 ? "archive:S||MTKsidebarArchiveProtected(f)?void 0:{id:`archive-thread`,onSelect:()=>i()}"
  : "...MTKsidebarArchiveProtected(n)?[]:[{id:`archive-thread`,onSelect:Ke}],...nt()?"), 1,
  "local sidebar context menu consults exact-ID protection");
assert.equal(count(rendererSource, build7746
  ? "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Me:t"
  : build7942 ? "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Me:t"
  : build7345 ? "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(De||L)?Ne:t"
  : "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Be||R)?Ke:t"), 1,
  "local sidebar hover action consults exact-ID protection");
const currentArchiveOwner = build7345 || build7942 || source.includes("archiveProtected:sTl(V,e).some(");
const archiveProjection = build7746 ? "archiveProtected:CEn(T,r).some(e=>MTKsidebarArchiveProtected(gC(e)))" : build7345
  ? "archiveProtected:XMc(T,e).some(e=>MTKsidebarArchiveProtected(KNc(T.get(VN,e))))"
  : build7942 ? "archiveProtected:BTn(T,r).some(e=>{let t=T.get(pv,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})"
  : currentArchiveOwner ? "archiveProtected:sTl(V,e).some(" : "archiveProtected:twl(T,e).some(";
assert.equal(count(rendererSource, archiveProjection), 1,
  "bulk selection suppresses archive when any selected task is protected");
if (build7942) {
  for (const contract of [
    "onArchive:MTKsidebarArchiveProtected(se)?null:Ve,archiveAriaLabel:He",
    "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "archive:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d(["
  ]) assert.ok(primarySource.includes(contract), `remote sidebar archive contract: ${contract}`);
} else if (build7746) {
  for (const contract of [
    "Be=Se&&!MTKsidebarArchiveProtected(se)?je:null",
    "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "archive:MTKsidebarArchiveProtected(e.task.id)?null:n",
    "getMenuItems:q&&!MTKsidebarArchiveProtected(e.task.id)?"
  ]) assert.ok(primarySource.includes(contract), `remote sidebar archive contract: ${contract}`);
} else if (build7345) {
  assert.ok(source.includes("archiveProtected:XMc(V,e).some(e=>MTKsidebarArchiveProtected(KNc(V.get(VN,e))))"),
    "current remote selection resolves exact task IDs through the flattened entry owner");
} else if (currentArchiveOwner) {
  assert.ok(source.includes("let t=V.get(Lx,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null"),
    "current bulk protection reads the flattened local entry ID or remote task ID");
  assert.ok(!source.includes("MTKsidebarArchiveProtected(Jy(t))"),
    "current bulk protection does not pass a flattened entry through the retired nested-entry helper");
}
const bulkFunctionName = build7942 ? "rjn" : build7746 ? "ljn" : build7345 ? "cRc" : currentArchiveOwner ? "zAl" : "Nkl";
const bulkSetName = build7942 ? "ajn" : build7746 ? "djn" : build7345 ? "uRc" : currentArchiveOwner ? "VAl" : "Fkl";
const bulkMessagesName = build7942 ? "ojn" : build7746 ? "nQ" : build7345 ? "dRc" : currentArchiveOwner ? "HAl" : "Ikl";
const bulkOwnerSource = build7942 || build7746 ? primarySource : source;
const bulkStart = bulkOwnerSource.indexOf(`function ${bulkFunctionName}(`);
const bulkEnd = bulkOwnerSource.indexOf("function ", bulkStart + 9);
assert.ok(bulkStart >= 0 && bulkEnd > bulkStart, "sidebar bulk menu adapter seam");
const bulkMenu = Function(
  bulkSetName,
  bulkMessagesName,
  `${bulkOwnerSource.slice(bulkStart, bulkEnd)};return ${bulkFunctionName}`
)(new Set(["archive-thread", "archive-task"]), {
  archiveChats: "Archive chats",
  pinChats: "Pin chats",
  unpinChats: "Unpin chats"
});
const archiveItems = [{ id: "rename-thread" }, { id: "archive-thread" }, { id: "archive-task" }];
assert.deepEqual(
  bulkMenu({ items: archiveItems, onArchive() {}, onSelect() {}, selectedThreadKeys: ["one"], threadKey: "one", archiveProtected: true }),
  [{ id: "rename-thread" }],
  "protected single row presents no archive item"
);
assert.deepEqual(
  bulkMenu({ items: archiveItems, onArchive() {}, onSelect() {}, selectedThreadKeys: ["one"], threadKey: "one", archiveProtected: false }),
  archiveItems,
  "ordinary single row retains stock archive items"
);
assert.deepEqual(
  bulkMenu({ items: archiveItems, onArchive() {}, onSelect() {}, selectedThreadKeys: ["one", "two"], threadKey: "one", archiveProtected: true }),
  [],
  "mixed bulk selection presents no archive action"
);
assert.equal(count(rendererSource, '"data-mtk-palette-bottom-fade":!0'), 1);
assert.ok(rendererSource.includes("h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary"));

const localSource = readAsset(localPage);
const delegationSource = readAsset(delegation);
assert.equal(count(localSource, '"data-mtk-palette-room-host":!0'), 1);
assert.equal(count(delegationSource, '"data-mtk-palette-source-id":MTKsourceId??void 0'), 1);
assert.ok(!source.includes("box-shadow:inset 1px 0 0"), "rejected sidebar fingernail stays absent");
const neutralSelection = source.indexOf("var(--color-token-text-tertiary)!important}");
const mappedSelection = source.indexOf("var(--mtk-accent-dark)!important}");
assert.ok(neutralSelection >= 0 && mappedSelection > neutralSelection,
  "mapped selection accent overrides the earlier neutral selection outline");
assert.equal(count(source, "box-shadow:inset 0 0 0 1px var(--mtk-accent-dark)!important"), 1);
assert.ok(!source.includes("[data-mtk-palette-mark=true]{background-color"), "watermark opacity stays off the room host");

api.MTKclearPaletteSurfaces();
for (const property of [
  "--mtk-user-bubble-strength",
  "--mtk-generic-bubble-strength",
  "--mtk-watermark-dark-opacity",
  "--mtk-watermark-light-opacity"
]) assert.equal(documentElement.style.has(property), false, `cleared ${property}`);

process.stdout.write(`${JSON.stringify({
  state: "green",
  rules: loaded.rules.length,
  calibration: loaded.calibration,
  surfaces: ["user-bubble", "mapped-delegation", "generic-delegation", "derived-selection", "watermark", "room-bottom-fade"],
  startup: "waits-for-app-server-manager",
  startupFallback: "invalid-or-missing-palette-leaves-native-styles",
  reloadFallback: "invalid-or-missing-replacement-keeps-last-good-palette",
  sidebarArchiveProtection: "explicit-exact-task-id",
  sidebarSelection: "universal-neutral-with-mapped-accent-override"
}, null, 2)}\n`);

function parseWith(changes) {
  return parse({ ...palette, calibration: { ...palette.calibration, ...changes } });
}

function parse(value) {
  return api.MTKparsePalette(Buffer.from(JSON.stringify(value)).toString("base64"), client, owner);
}

function uniqueAsset(pattern) {
  const matches = assetNames.filter(name => pattern.test(name));
  assert.equal(matches.length, 1, `unique asset ${pattern}`);
  return matches[0];
}

function readAsset(name) {
  return fs.readFileSync(path.join(assets, name), "utf8");
}

function element(attributes = {}, children = []) {
  const values = new Map(Object.entries(attributes));
  const properties = new Map();
  const entry = {
    nodeType: 1,
    attributes: values,
    children,
    style: {
      setProperty(name, value) { properties.set(name, value); },
      removeProperty(name) { properties.delete(name); },
      get(name) { return properties.get(name); },
      has(name) { return properties.has(name); }
    },
    getAttribute(name) { return values.get(name) ?? null; },
    setAttribute(name, value) { values.set(name, String(value)); },
    removeAttribute(name) { values.delete(name); },
    matches(selector) { return selectorAttributes(selector).some(name => values.has(name)); },
    querySelector(selector) {
      for (const child of children) {
        if (child.matches?.(selector)) return child;
        const nested = child.querySelector?.(selector);
        if (nested) return nested;
      }
      return null;
    }
  };
  return entry;
}

function mutation(type, overrides = {}) {
  return { type, addedNodes: [], removedNodes: [], ...overrides };
}

function selectorAttributes(selector) {
  return [...selector.matchAll(/\[([^\]=]+)/g)].map(match => match[1]);
}

function has(name) {
  return entry => entry.attributes.has(name);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function luminance(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function directory(target) {
  files.set(target, { metadata: { isDirectory: true, isFile: false, isSymlink: false }, contents: "" });
}

function file(target, contents) {
  files.set(target, { metadata: { isDirectory: false, isFile: true, isSymlink: false }, contents });
}
