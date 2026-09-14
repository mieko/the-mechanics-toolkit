#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { linuxBuild8881 } from "../patches/cross-task-attribution/profiles/linux.mjs";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: cross-task-attribution.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const owners = fs.readdirSync(assets).filter(name => {
  if (!name.endsWith(".js")) return false;
  const source = fs.readFileSync(path.join(assets, name), "utf8");
  return source.includes("localConversation.codexDelegationUserMessage.app") &&
    source.includes("function MTKsender(");
});
assert.equal(owners.length, 1, "unique patched cross-task attribution owner");
const ownerPath = path.join(assets, owners[0]);
const source = fs.readFileSync(ownerPath, "utf8");

const helperStart = source.indexOf("var MTKdelegatedBubbleStyle=");
const helperTail = source.slice(helperStart);
const componentBoundary = helperTail.match(/function [$A-Z_a-z][$\w]*\(e\)\{let t=/);
assert.ok(helperStart >= 0 && componentBoundary, "attribution helper seam");
const bindingStart = helperTail.indexOf("const MTKcrossTaskStoreHook=");
assert.ok(bindingStart >= 0 && bindingStart < componentBoundary.index, "stock store bindings are captured outside the component");
const helper = helperTail.slice(0, bindingStart);
const api = Function(`${helper};return {MTKsender,MTKshortTaskTitle,MTKdelegatedBubbleStyle}`)();

assert.equal(api.MTKshortTaskTitle("Bridge Keeper — Coordination"), "Bridge Keeper");
assert.equal(api.MTKshortTaskTitle("documentation-research"), "documentation-research");
assert.equal(api.MTKsender("Bridge Keeper — Coordination", "Example Ship"), "Bridge Keeper");
assert.equal(api.MTKsender("Index repair", "Archive Engine"), "Archive Engine/Index repair");
assert.equal(api.MTKsender("Index repair", null), "Index repair", "plain task title survives without project metadata");
assert.equal(api.MTKsender(null, "Archive Engine"), null, "missing task metadata retains generic attribution");
assert.ok(api.MTKdelegatedBubbleStyle.backgroundColor.includes("interactive-bg-accent-muted-context"),
  "unmapped delegation keeps the existing semantic accent fallback");

let metadataKind;
let metadataContracts;
if (source.includes("MTKstore.get(MTKtitleAtom")) {
  const capturedStore = uniqueMatch(
    source,
    /const MTKcrossTaskStoreHook=(?<store>[$A-Z_a-z][$\w]*),MTKcrossTaskStoreScope=(?<scope>[$A-Z_a-z][$\w]*);/g,
    "component-external renderer store bindings"
  ).groups;
  const titleImport = uniqueMatch(
    source,
    /import\{(?<specifiers>[^}]*MTKtitleAtom[^}]*)\}from"(?<relative>\.\/app-(?:initial|primary)-[^"]+\.js)";/g,
    "title atom import"
  ).groups;
  const titleOwner = fs.readFileSync(path.resolve(path.dirname(ownerPath), titleImport.relative), "utf8");
  const titleExport = importedExport(titleImport.specifiers, "MTKtitleAtom");
  const titleInternal = exportedInternal(titleOwner, titleExport);
  if (titleInternal === "tOn") {
    assert.ok(titleOwner.includes("tOn=vp(qv,") && titleOwner.includes("localTitle:r"),
      "current title atom retains its stock task-title selector owner");
  } else if (titleOwner.includes(`${titleInternal}=iS(`)) {
    assert.ok(titleOwner.includes("hasConversation") && titleOwner.includes("localTitle:r") &&
      titleOwner.includes("summaryTitle"), "split title atom retains its stock task-title selector owner");
  } else if (titleInternal === "L0t") {
    assert.ok(titleOwner.includes("L0t=wx(Vv,") && titleOwner.includes("hasConversation") &&
      titleOwner.includes("liveTitle") && titleOwner.includes("localTitle:r"),
    "current split title atom retains its stock live-title selector owner");
  } else if (titleInternal === "Q2t") {
    assert.ok(titleOwner.includes("Q2t=Jf(o_,") && titleOwner.includes("hasConversation") &&
      titleOwner.includes("liveTitle") && titleOwner.includes("X2t({...n,localTitle:r})"),
    "build-8881 title atom retains its stock live-title selector owner");
  } else if (titleInternal === linuxBuild8881.titleSelector.internal) {
    const selector = linuxBuild8881.titleSelector;
    assert.ok(titleOwner.includes(`${selector.internal}=${selector.atomFactory}(${selector.scope},`) &&
      titleOwner.includes("hasConversation") && titleOwner.includes("liveTitle") &&
      titleOwner.includes("localTitle:r") &&
      titleOwner.includes(`${selector.helper}({...n,localTitle:r})`),
    "Linux build-8881 title atom retains its stock live-title selector owner");
  } else {
    assert.ok(["SOn", "EI", "xNn"].includes(titleInternal), "title atom retains its stock ESM export owner");
  }
  const metadata = uniqueMatch(
    source,
    /MTKstore=(?<store>[$A-Z_a-z][$\w]*)\((?<scope>[$A-Z_a-z][$\w]*)\),MTKtitle=MTKstore\.get\(MTKtitleAtom,\{hostId:/g,
    "renderer-store title lookup"
  ).groups;
  assert.equal(metadata.store, "MTKcrossTaskStoreHook", "component uses the collision-proof store binding");
  assert.equal(metadata.scope, "MTKcrossTaskStoreScope", "component uses the collision-proof scope binding");
  const initialImport = uniqueMatch(
    source,
    /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g,
    "app-initial import"
  ).groups;
  const appInitial = fs.readFileSync(path.resolve(path.dirname(ownerPath), initialImport.relative), "utf8");
  const storeInternal = exportedInternal(appInitial, importedExport(initialImport.specifiers, capturedStore.store));
  const scopeInternal = exportedInternal(appInitial, importedExport(initialImport.specifiers, capturedStore.scope));
  if (!["pb", "hb", "Db"].includes(storeInternal)) {
    const storeFunction = functionSource(appInitial, storeInternal);
    assert.ok(storeFunction.includes(".useContext") && storeFunction.includes(".useRef") &&
      storeFunction.includes("get queryClient"), "metadata uses the stock renderer store hook");
  }
  assert.equal(scopeInternal, "Q", "metadata uses the stock renderer store scope");
  metadataKind = "stock-renderer-store-title-atom";
  metadataContracts = ["MTKstore.get(MTKtitleAtom,{hostId:"];
} else {
  const metadata = uniqueMatch(
    source,
    /MTKstore=(?<store>[$A-Z_a-z][$\w]*)\((?<scope>[$A-Z_a-z][$\w]*)\),MTKtask=MTKstore\.get\(MTKtaskAtom,MTKthreadKey\),MTKproject=MTKstore\.get\(MTKprojectAtom,MTKthreadKey\)/g,
    "renderer-store metadata lookup"
  ).groups;
  const appImport = uniqueMatch(
    source,
    /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g,
    "app-initial import"
  ).groups;
  const appInitial = fs.readFileSync(path.resolve(path.dirname(ownerPath), appImport.relative), "utf8");
  const storeExport = importedExport(appImport.specifiers, metadata.store);
  const scopeExport = importedExport(appImport.specifiers, metadata.scope);
  const storeInternal = exportedInternal(appInitial, storeExport);
  const scopeInternal = exportedInternal(appInitial, scopeExport);
  const storeFunction = functionSource(appInitial, storeInternal);
  assert.ok(storeFunction.includes(".useContext") && storeFunction.includes(".useRef") &&
    storeFunction.includes("get queryClient"), "metadata uses the stock renderer store hook");
  const taskImport = uniqueMatch(
    appImport.specifiers,
    /(?:^|,)(?<export>[$A-Z_a-z][$\w]*) as MTKtaskAtom(?=,|$)/g,
    "task atom import"
  ).groups.export;
  const taskInternal = exportedInternal(appInitial, taskImport);
  assert.ok(appInitial.includes(`${taskInternal}=no(${scopeInternal},`) ||
    appInitial.includes(`${taskInternal}=i_(${scopeInternal},`),
    "store scope and task metadata family have the same stock owner");
  metadataKind = "stock-renderer-store-get";
  metadataContracts = ["MTKstore.get(MTKtaskAtom,MTKthreadKey)", "MTKstore.get(MTKprojectAtom,MTKthreadKey)"];
}

for (const contract of [
  ...metadataContracts,
  "defaultMessage:`Sent by {appName} from another task`",
  '"data-mtk-palette-attribution-name":!0',
  "messageBubbleStyle:MTKdelegatedBubbleStyle",
  '"data-user-message-bubble":!0,style:MTKbubbleStyleOverride'
]) assert.equal(count(source, contract), 1, `attribution contract: ${contract}`);
assert.ok(!source.includes("MTKselectorStateInit") && !source.includes("MTKstoreStateInit") &&
  !source.includes("MTKtaskStateInit") && !source.includes("MTKprojectStateInit") &&
  !source.includes("zm(MTKtaskAtom"), "attribution imports no private selector hook or injected initializer");
assert.ok(source.includes("onLabelClick:"), "source-task click-through remains present");

process.stdout.write(`${JSON.stringify({
  state: "green",
  labels: ["Name", "Project/Task title", "generic fallback"],
  metadata: metadataKind,
  clickThroughPreserved: true,
  delegatedBubbleOnly: true,
  privateSelectorHookImported: false
}, null, 2)}\n`);

function importedExport(specifiers, local) {
  return uniqueMatch(
    specifiers,
    new RegExp(`(?:^|,)(?<export>[$A-Z_a-z][$\\w]*) as ${escapeRegExp(local)}(?=,|$)`, "g"),
    `import for ${local}`
  ).groups.export;
}

function exportedInternal(sourceText, exported) {
  const specifiers = uniqueMatch(sourceText, /export\{(?<specifiers>[^}]+)\}/g, "module export list").groups.specifiers;
  return uniqueMatch(
    specifiers,
    new RegExp(`(?:^|,)(?<internal>[$A-Z_a-z][$\\w]*) as ${escapeRegExp(exported)}(?=,|$)`, "g"),
    `export ${exported}`
  ).groups.internal;
}

function functionSource(sourceText, name) {
  const start = sourceText.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name}`);
  const next = sourceText.indexOf("function ", start + name.length + 10);
  return sourceText.slice(start, next < 0 ? sourceText.length : next);
}

function uniqueMatch(text, pattern, label) {
  const matches = [...text.matchAll(pattern)];
  assert.equal(matches.length, 1, label);
  return matches[0];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
