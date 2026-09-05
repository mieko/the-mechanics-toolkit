#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: renderer-patch-registry.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const files = fs.readdirSync(assets).filter(name => name.endsWith(".js")).map(name => path.join(assets, name));
const appInitial = unique(files.filter(file => /^app-initial-.*\.js$/.test(path.basename(file))), "app-initial asset");
const appSource = fs.readFileSync(appInitial, "utf8");
const bootstrapStart = appSource.indexOf('const MTKpatchRegistryKey="__MTK_PATCH_REGISTRY__"');
const bootstrapEnd = appSource.indexOf("})();", bootstrapStart) + 5;
assert.ok(bootstrapStart >= 0 && bootstrapEnd > bootstrapStart, "registry bootstrap seam");
const bootstrap = appSource.slice(bootstrapStart, bootstrapEnd);

const firstRealm = {};
const registry = Function("globalThis", `${bootstrap};return MTKpatchRegistry`)(firstRealm);
assert.equal(registry.apiVersion, 1);
assert.equal(firstRealm.__MTK_PATCH_REGISTRY__, registry);
assert.deepEqual(Object.keys(registry.packages), []);
assert.equal(registry.register("bad-name", {version: 1}), false);
assert.equal(registry.register("validPackage", {version: 0}), false);
assert.equal(registry.register("validPackage", {version: 1, answer: 1}), true);
assert.equal(registry.packages.validPackage.answer, 1);
assert.equal(Object.isFrozen(registry.packages.validPackage), true, "published descriptors are immutable");
assert.equal(registry.register("validPackage", {version: 2}), false, "incompatible package replacement is rejected");
assert.equal(registry.register("validPackage", {version: 1, answer: 2}), true, "same-version reload refreshes its closure");
assert.equal(registry.packages.validPackage.answer, 2);

const secondRealm = {};
const secondRegistry = Function("globalThis", `${bootstrap};return MTKpatchRegistry`)(secondRealm);
assert.notEqual(secondRegistry, registry, "each renderer realm owns its own registry");
assert.deepEqual(Object.keys(secondRegistry.packages), []);
const incompatibleRealm = {__MTK_PATCH_REGISTRY__: {apiVersion: 2, packages: {}, register() {}}};
assert.equal(Function("globalThis", `${bootstrap};return MTKpatchRegistry`)(incompatibleRealm), null,
  "an incompatible existing registry is left untouched and unavailable");
assert.ok(appSource.startsWith(bootstrap), "renderer registry owns an independent module-level bootstrap seam");

const appCalls = registrationCalls(appSource, "MTKpatchRegistry?.register(");
const lazyCalls = files.flatMap(file => {
  const source = fs.readFileSync(file, "utf8");
  return registrationCalls(source, "globalThis.__MTK_PATCH_REGISTRY__?.register?.(");
});
const names = [...appCalls, ...lazyCalls].map(call => call.name).sort();
const allSources = files.map(file => fs.readFileSync(file, "utf8"));
const expectedNames = [
  ["crossTaskAttribution", source => source.includes("function MTKsender(")],
  ["outgoingMessageReceipt", source => source.includes("function MTKOutboundMessageReceipt(")],
  ["sidebarActionCollapse", source => source.includes("function MTKsidebarActionDisclosure(") ||
    source.includes("function MTKsidebarActionDisclosure7345(") || source.includes("function MTKsidebarActionDisclosure7746(") ||
    source.includes("function MTKsidebarActionDisclosure7942(")],
  ["taskAttentionPolicy", source => source.includes("function MTKattentionIgnoredThread(") ||
    source.includes("function MTKattentionIgnoredThread7345(") || source.includes("function MTKattentionIgnoredThread7746(") ||
    source.includes("function MTKattentionIgnoredThread7942(")],
  ["taskVisualPalette", source => source.includes("function MTKusePaletteBootstrap(")],
  ["terminalToggle", source => source.includes('requiredAccess:`codexLocal`,shortcutScope:`app`,commandMenuGroupKey:`panels`')]
].filter(([, active]) => allSources.some(active)).map(([name]) => name).sort();
assert.deepEqual(names, expectedNames);
assert.equal(new Set(names).size, names.length, "one owner registers each active package");

const paletteCalls = appCalls.filter(call => call.name === "taskVisualPalette");
if (paletteCalls.length === 1) {
  const palette = {rules: [{pattern: /^Bridge Keeper(?:\s+—|$)/, color: "#6B8E72"}]};
  const matchPalette = (loaded, title, taskId) => loaded.rules.find(rule => rule.pattern.test(title) || rule.pattern.test(taskId)) ?? null;
  Function("MTKpatchRegistry", "MTKmatchPalette", "MTKsidebarPalette", paletteCalls[0].source)(registry, matchPalette, palette);
  const capability = registry.packages.taskVisualPalette;
  assert.equal(capability.version, 1);
  assert.equal(capability.resolveTaskColor({taskId: "other", title: "Bridge Keeper — Coordination"}), "#6B8E72");
  assert.equal(capability.resolveTaskColor({taskId: "other", title: "Ordinary"}), null);
} else {
  assert.equal(paletteCalls.length, 0, "palette registration is unique when present");
}

for (const call of appCalls.filter(call => call.name !== "taskVisualPalette")) {
  Function("MTKpatchRegistry", call.source)(registry);
}
for (const call of lazyCalls) Function("globalThis", call.source)(firstRealm);
assert.deepEqual(Object.keys(registry.packages).sort(), ["validPackage", ...names].sort());
if (registry.packages.outgoingMessageReceipt != null) {
  assert.equal(registry.packages.outgoingMessageReceipt.version, 1);
  assert.equal(registry.packages.outgoingMessageReceipt.persistence, "mounted-session");
  assert.equal(registry.packages.outgoingMessageReceipt.visibility, "persistent-when-activity-collapsed");
  assert.equal(registry.packages.outgoingMessageReceipt.preview, "stock-hover");
  assert.equal(registry.packages.outgoingMessageReceipt.messageRendering, "recipient-user-message");
}
assert.ok(!bootstrap.includes("subscribe") && !bootstrap.includes("addEventListener") && !bootstrap.includes("MutationObserver"),
  "registry has no lifecycle or event machinery");

process.stdout.write(`${JSON.stringify({
  state: "green",
  scope: "one-registry-per-renderer-realm",
  apiVersion: registry.apiVersion,
  packages: names,
  callableCapabilities: paletteCalls.length === 1 ? ["taskVisualPalette.resolveTaskColor"] : [],
  subscriptions: false,
  incompatibleRegistryFallback: "packages-remain-independent"
}, null, 2)}\n`);

function unique(values, label) {
  assert.equal(values.length, 1, label);
  return values[0];
}

function registrationCalls(source, prefix) {
  const calls = [];
  let start = 0;
  while ((start = source.indexOf(prefix, start)) >= 0) {
    const name = source.slice(start + prefix.length).match(/^"(?<name>[A-Za-z][A-Za-z0-9]*)"/)?.groups.name;
    assert.ok(name, "registered package name");
    let quote = null, escaped = false, depth = 1, end = start + prefix.length;
    for (; end < source.length; end += 1) {
      const character = source[end];
      if (quote != null) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") quote = character;
      else if (character === "(") depth += 1;
      else if (character === ")" && --depth === 0) break;
    }
    assert.ok(end < source.length && source[end + 1] === ";", `${name} registration terminates`);
    calls.push({name, source: source.slice(start, end + 2)});
    start = end + 2;
  }
  return calls;
}
