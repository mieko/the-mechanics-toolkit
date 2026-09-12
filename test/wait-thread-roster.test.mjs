#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: wait-thread-roster.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const owners = fs.readdirSync(assets).filter(name => {
  if (!name.endsWith(".js")) return false;
  const source = fs.readFileSync(path.join(assets, name), "utf8");
  return source.includes("function MTKrenderWaitThreads(") && source.includes("data-mtk-wait-thread-roster");
});
assert.equal(owners.length, 1, "unique patched wait-thread roster owner");
const ownerPath = path.join(assets, owners[0]);
const source = fs.readFileSync(ownerPath, "utf8");

const names = [
  "MTKwaitTargets",
  "MTKwaitFallbackLabel",
  "MTKwaitTaskLabel",
  "MTKwaitTaskColor",
  "MTKwaitParseHex",
  "MTKwaitMix",
  "MTKwaitLum",
  "MTKwaitContrast",
  "MTKwaitLabelColor",
  "MTKwaitResolvedTarget",
  "MTKwaitNavigate",
  "MTKWaitThreadRoster",
  "MTKrenderWaitThreads"
];
const helper = names.map(name => functionSource(source, name)).join("");
const dedicatedTitleOwner = fs.readdirSync(assets).some(name => {
  if (!/^app-primary-.*\.js$/.test(name)) return false;
  const value = fs.readFileSync(path.join(assets, name), "utf8");
  return [
    ["Q2t=Jf(o_,(e,{get:t})=>{", "X2t({...n,localTitle:r})"],
    ["G2t=Ll(Hc,(e,{get:t})=>{", "U2t({...n,localTitle:r})"]
  ].some(markers => markers.every(marker => value.includes(marker)));
});
assert.equal(
  helper.includes("MTKwaitTitleAtom"),
  dedicatedTitleOwner,
  "current wait rosters use the stock live-title selector rather than stale task metadata"
);
const profile = presentationProfile(source);
const dispatched = [];
const tasks = new Map([
  ["local:elias", {kind: "local", conversation: {title: "Elias — MapWire Deployment Steward"}}],
  ["local:mechanic", {kind: "local", conversation: {title: "The Mechanic — Engine Rooms and Escape Hatches"}}],
  ["remote:rowan", {kind: "remote", task: {title: "Rowan — Systems Wayfinder"}}]
]);
const jsx = {
  jsx(type, props, key) { return {type, props, key}; },
  jsxs(type, props, key) { return {type, props, key}; }
};
const taskAtom = {};
const titleAtom = {};
const liveTitles = new Map([
  ["local:elias", "Elias — MapWire Deployment Steward"],
  ["local:mechanic", "The Mechanic — Engine Rooms and Escape Hatches"],
  ["remote:rowan", "Rowan — Systems Wayfinder"]
]);
const deps = {
  MTKwaitStoreHook: () => ({get(atom, key) {
    if (atom === titleAtom) return liveTitles.get(`${key.hostId}:${key.threadId}`) ?? null;
    if (dedicatedTitleOwner && atom === taskAtom) return null;
    return tasks.get(key) ?? null;
  }}),
  MTKwaitStoreScope: {},
  MTKwaitTaskAtom: taskAtom,
  MTKwaitTitleAtom: titleAtom,
  MTKwaitLocalThreadKey: id => `local:${id}`,
  MTKwaitRemoteThreadKey: id => `remote:${id}`,
  [profile.jsx]: jsx,
  [profile.container]: "container",
  [profile.classNames]: (...values) => values.filter(Boolean).join(" "),
  [profile.iconFunction]: () => "tool-icon",
  [profile.spinner]: "spinner",
  [profile.summaryWrapper]: "summary-wrapper",
  [profile.normalize]: id => `normalized:${id}`,
  [profile.hostBridge]: {dispatchHostMessage(message) { dispatched.push(message); }},
  [profile.routeFlag]: () => false,
  [profile.newRoute]: id => `/new/${id}`,
  [profile.oldRoute]: id => `/local/${id}`
};
const realm = {
  __MTK_PATCH_REGISTRY__: {
    apiVersion: 1,
    packages: {
      crossTaskAttribution: {
        version: 2,
        resolveTaskLabel({title}) { return title.split(" — ")[0]; }
      },
      taskVisualPalette: {
        version: 1,
        resolveTaskColor({title}) { return title?.startsWith("Elias") ? "#aabbcc" : null; }
      }
    }
  }
};
const api = Function("deps", "globalThis", `with(deps){${helper};return {${names.join(",")}}}`)(deps, realm);

assert.deepEqual(api.MTKwaitTargets({targets: [{threadId: "one"}, {threadId: "two", hostId: "remote"}]}), [
  {threadId: "one", hostId: "local"},
  {threadId: "two", hostId: "remote"}
]);
assert.equal(api.MTKwaitTargets({targets: []}), null);
assert.equal(api.MTKwaitTargets({targets: Array.from({length: 9}, (_, index) => ({threadId: String(index)}))}), null);
assert.equal(api.MTKwaitTargets({targets: [{threadId: "one", hostId: 2}]}), null);
assert.equal(api.MTKwaitTaskLabel("The Mechanic — Engine Rooms"), "The Mechanic", "shared label capability is used");
assert.equal(api.MTKwaitTaskColor("elias", "Elias — Deployment"), "#AABBCC");
for (const raw of ["#AABBCC", "#39FF14", "#C6A13D"]) {
  assert.ok(api.MTKwaitContrast(api.MTKwaitLabelColor(raw, false), "#FFFFFF") >= 4.5,
    `${raw} remains readable in light mode`);
  assert.ok(api.MTKwaitContrast(api.MTKwaitLabelColor(raw, true), "#101114") >= 4.5,
    `${raw} remains readable in dark mode`);
}

const known = api.MTKwaitResolvedTarget({threadId: "elias", hostId: "local"}, tasks.get("local:elias"));
assert.deepEqual(known, {
  color: "#AABBCC",
  known: true,
  label: "Elias",
  target: {threadId: "elias", hostId: "local"},
  title: "Elias — MapWire Deployment Steward"
});
assert.equal(api.MTKwaitResolvedTarget({threadId: "0123456789", hostId: "local"}, null).label, "Task 01234567…");

const item = {
  arguments: {targets: [
    {threadId: "elias"},
    {threadId: "mechanic"},
    {threadId: "rowan", hostId: "remote"},
    {threadId: "0123456789"}
  ]},
  completed: false
};
const rendered = api.MTKWaitThreadRoster({item, variant: "row"});
assert.equal(rendered.type, "container");
assert.equal(rendered.props["data-mtk-wait-thread-roster"], true);
const inlineSummary = rendered.props.children[1];
assert.equal(inlineSummary.type, "span");
const content = inlineSummary.props.children;
const spinner = content[0];
assert.equal(spinner.type, "spinner");
assert.equal(spinner.props.active, true);
assert.equal(spinner.props.children, "Waiting for");
assert.equal(content[1], " ", "expanded roster keeps a visible gap before the first target");
assert.equal(content.at(-1), "…");
const rosterNodes = content.slice(1, -1);
const buttons = rosterNodes.filter(node => node?.type === "button");
assert.deepEqual(buttons.map(button => button.props.children), ["Elias", "The Mechanic", "Rowan"]);
assert.ok(buttons.every(button => button.props.className.includes("cursor-pointer")),
  "known task links advertise pointer interaction");
assert.equal(rosterNodes.filter(node => node?.type === "span" && node.props.children === "Task 01234567…").length, 1,
  "unknown target is visible but not linked");
const duplicate = api.MTKWaitThreadRoster({item: {
  arguments: {targets: [{threadId: "elias"}, {threadId: "elias"}]},
  completed: true,
  success: true
}, variant: "row"});
const duplicateButtons = duplicate.props.children[1].props.children.filter(node => node?.type === "button");
assert.equal(new Set(duplicateButtons.map(button => button.key)).size, 2,
  "duplicate wait targets retain distinct React identities");
assert.match(buttons[0].props.style.color, /^light-dark\(#[0-9A-F]{6},#[0-9A-F]{6}\)$/,
  "palette color decorates a known name with a contrast-checked theme pair");
assert.ok(!spinner.props.children?.props, "active shimmer does not wrap or repaint colored task names");
buttons[0].props.onClick({preventDefault() {}, stopPropagation() {}});
assert.deepEqual(dispatched, [{type: "navigate-to-route", path: "/local/normalized:elias"}]);

const summarized = api.MTKWaitThreadRoster({item: {...item, completed: true, success: true}, variant: "row", agentActivityIcon: "activity"});
assert.equal(summarized.type, "summary-wrapper");
assert.equal(summarized.props.summary.props.children[1].props.children[0].props.children, "Waited for");

const fallbackApi = Function("deps", "globalThis", `with(deps){${helper};return {MTKwaitTaskLabel,MTKwaitTaskColor}}`)(deps, {});
assert.equal(fallbackApi.MTKwaitTaskLabel("The Mechanic — Engine Rooms"), "The Mechanic");
assert.equal(fallbackApi.MTKwaitTaskLabel("documentation-research"), "documentation-research");
assert.equal(fallbackApi.MTKwaitTaskColor("one", "One"), null);
const hostileApi = Function("deps", "globalThis", `with(deps){${helper};return {MTKwaitTaskLabel,MTKwaitTaskColor}}`)(deps, {
  __MTK_PATCH_REGISTRY__: {apiVersion: 1, packages: {
    crossTaskAttribution: {version: 2, resolveTaskLabel() { throw new Error("no"); }},
    taskVisualPalette: {version: 1, resolveTaskColor() { return "red"; }}
  }}
});
assert.equal(hostileApi.MTKwaitTaskLabel("Rowan — Systems"), "Rowan");
assert.equal(hostileApi.MTKwaitTaskColor("rowan", "Rowan — Systems"), null);

assert.equal(count(source, "tool:`wait_threads`"), 1);
assert.match(source, /\{namespace:[$A-Z_a-z][$\w]*,render:MTKrenderWaitThreads,renderAgentActivityIcon:[$A-Z_a-z][$\w]*,tool:`wait_threads`\}/);
assert.ok(!source.match(/\{namespace:[^}]+persistentInCollapsedConversation:!0[^}]+tool:`wait_threads`\}/),
  "wait renderer does not change persistence semantics");

process.stdout.write(`${JSON.stringify({
  state: "green",
  activeLabel: "Waiting for named targets",
  completedLabel: "Waited for named targets",
  links: "known-task-only",
  unknownFallback: "short-task-id",
  optionalCapabilities: ["crossTaskAttribution.resolveTaskLabel", "taskVisualPalette.resolveTaskColor"]
}, null, 2)}\n`);

function presentationProfile(value) {
  const start = value.indexOf("function MTKWaitThreadRoster(");
  const component = functionSource(value, "MTKWaitThreadRoster");
  assert.ok(start >= 0);
  const jsxName = uniqueMatch(functionSource(value, "MTKrenderWaitThreads"),
    /\(0,(?<jsx>[$A-Z_a-z][$\w]*)\.jsx\)\(MTKWaitThreadRoster/g, "wait JSX binding").groups.jsx;
  return {
    jsx: jsxName,
    container: uniqueMatch(component, new RegExp(`let u=\\(0,${jsxName}\\.jsxs\\)\\((?<name>[$A-Z_a-z][$\\w]*),\\{"data-mtk-wait-thread-roster"`), "stock activity container").groups.name,
    classNames: uniqueMatch(component, /className:(?<name>[$A-Z_a-z][$\w]*)\("text-size-chat"/g, "class-name helper").groups.name,
    iconFunction: uniqueMatch(component, /"summary-text"\?null:(?<name>[$A-Z_a-z][$\w]*)\(e\)/g, "activity icon helper").groups.name,
    spinner: uniqueMatch(component, new RegExp(`\\(0,${jsxName}\\.jsx\\)\\((?<name>[$A-Z_a-z][$\\w]*),\\{active:!e\\.completed`), "spinner component").groups.name,
    summaryWrapper: uniqueMatch(component, new RegExp(`return s\\?\\(0,${jsxName}\\.jsx\\)\\((?<name>[$A-Z_a-z][$\\w]*),\\{icon:n,summary:u\\}\\):u`), "summary wrapper").groups.name,
    ...uniqueMatch(functionSource(value, "MTKwaitNavigate"), /let t=(?<normalize>[$A-Z_a-z][$\w]*)\(e\);(?<hostBridge>[$A-Z_a-z][$\w]*)\.dispatchHostMessage\(\{type:"navigate-to-route",path:(?<routeFlag>[$A-Z_a-z][$\w]*)\(\)\?(?<newRoute>[$A-Z_a-z][$\w]*)\(t\):(?<oldRoute>[$A-Z_a-z][$\w]*)\(t\)\}\)/g, "navigation bindings").groups
  };
}

function functionSource(value, name) {
  const start = value.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name}`);
  const signatureEnd = value.indexOf("){", start);
  assert.ok(signatureEnd >= 0, `function body ${name}`);
  const open = signatureEnd + 1;
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
    else if (character === "}" && --depth === 0) return value.slice(start, index + 1);
  }
  assert.fail(`unterminated function ${name}`);
}

function uniqueMatch(value, pattern, label) {
  const regex = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + "g");
  const matches = [...value.matchAll(regex)];
  assert.equal(matches.length, 1, label);
  return matches[0];
}

function count(value, needle) {
  return value.split(needle).length - 1;
}
