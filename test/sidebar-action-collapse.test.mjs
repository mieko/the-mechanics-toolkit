#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: sidebar-action-collapse.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const names = fs.readdirSync(assets);
const matches = names.filter(name => name.endsWith(".js") &&
  fs.readFileSync(path.join(assets, name), "utf8").includes('const MTK_SIDEBAR_ACTIONS_STORAGE_KEY='));
assert.equal(matches.length, 1, "unique sidebar-collapse owner");
const source = fs.readFileSync(path.join(assets, matches[0]), "utf8");
const helperStart = source.indexOf('const MTK_SIDEBAR_ACTIONS_STORAGE_KEY=');
const helperBoundary = source.slice(helperStart).match(/function (?:cql|lJl|hYl|g\$c|ear|dar)\(e\)\{/);
const rootBoundary = helperBoundary == null ? -1 : helperStart + helperBoundary.index;
const attentionBoundary = source.indexOf('const MTKattentionRelativePath=', helperStart);
const helperEnd = attentionBoundary >= 0 && attentionBoundary < rootBoundary ? attentionBoundary : rootBoundary;
assert.ok(helperStart >= 0 && helperEnd > helperStart, "sidebar helper seam");
const rawHelper = source.slice(helperStart, helperEnd);
const build7345 = rawHelper.includes("function MTKuseSidebarActionCollapse7345(");
const build7746 = rawHelper.includes("function MTKuseSidebarActionCollapse7746(");
const build7942 = rawHelper.includes("function MTKuseSidebarActionCollapse7942(");
const helper = build7942 ? rawHelper
  .replaceAll("MTKreadSidebarActionsCollapsed7942", "MTKreadSidebarActionsCollapsed")
  .replaceAll("MTKuseSidebarActionCollapse7942", "MTKuseSidebarActionCollapse")
  .replaceAll("MTKsidebarActionDisclosure7942", "MTKsidebarActionDisclosure")
  .replaceAll("M4", "fql")
  .replaceAll("Vl", "vd")
  .replaceAll("N4", "x7") : build7746 ? rawHelper
  .replaceAll("MTKreadSidebarActionsCollapsed7746", "MTKreadSidebarActionsCollapsed")
  .replaceAll("MTKuseSidebarActionCollapse7746", "MTKuseSidebarActionCollapse")
  .replaceAll("MTKsidebarActionDisclosure7746", "MTKsidebarActionDisclosure")
  .replaceAll("D4", "fql")
  .replaceAll("Aa", "vd")
  .replaceAll("O4", "x7") : build7345 ? rawHelper
  .replaceAll("MTKreadSidebarActionsCollapsed7345", "MTKreadSidebarActionsCollapsed")
  .replaceAll("MTKuseSidebarActionCollapse7345", "MTKuseSidebarActionCollapse")
  .replaceAll("MTKsidebarCollapsedDestinations7345", "MTKsidebarCollapsedDestinations")
  .replaceAll("MTKsidebarActionDisclosure7345", "MTKsidebarActionDisclosure")
  .replaceAll("x$c", "fql")
  .replaceAll("Gc", "vd")
  .replaceAll("h7", "x7")
  .replaceAll("hR", "tX")
  .replaceAll("nz", "uI") : rawHelper;
if (source.includes("function lJl(e){")) {
  assert.ok(helper.includes("let n=hd()"), "build 6892 disclosure uses the sidebar owner's localization hook");
  assert.ok(!helper.includes("let n=vd()"), "stale build 6849 localization hook is rejected");
}
if (source.includes("function hYl(e){")) {
  assert.ok(helper.includes("let n=_d()"), "build 6962 disclosure uses the sidebar owner's localization hook");
  assert.ok(!helper.includes("let n=vd()"), "stale build 6849 localization hook is rejected");
}

const storage = new Map();
let state;
let storageListener;
const localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value)
};
const react = {
  useState(initializer) {
    state ??= initializer();
    return [state, update => { state = typeof update === "function" ? update(state) : update; }];
  },
  useEffect(callback) { return callback(); },
  useCallback(callback) { return callback; }
};
const jsx = (component, props) => ({ component, props });
const api = Function(
  "fql", "pJl", "yYl", "localStorage", "addEventListener", "removeEventListener", "vd", "hd", "_d", "x7", "uI", "aI", "tX", "nX", "aX",
  `${helper};return {MTKreadSidebarActionsCollapsed,MTKuseSidebarActionCollapse,MTKsidebarActionDisclosure,MTKsidebarCollapsedDestinations:typeof MTKsidebarCollapsedDestinations==="function"?MTKsidebarCollapsedDestinations:void 0}`
)(
  react, react, react,
  localStorage,
  (type, listener) => { assert.equal(type, "storage"); storageListener = listener; },
  () => {},
  () => ({ formatMessage: message => message.defaultMessage }),
  () => ({ formatMessage: message => message.defaultMessage }),
  () => ({ formatMessage: message => message.defaultMessage }),
  { jsx },
  "Tooltip", "Tooltip",
  "IconButton", "IconButton", "IconButton"
);

assert.equal(api.MTKreadSidebarActionsCollapsed(), false, "first use defaults expanded");
let [collapsed, toggle] = api.MTKuseSidebarActionCollapse();
assert.equal(collapsed, false);
toggle();
assert.equal(storage.get("the-mechanics-toolkit:sidebar-global-actions-collapsed:v1"), "1", "toggle persists collapse");
[collapsed, toggle] = api.MTKuseSidebarActionCollapse();
assert.equal(collapsed, true);
storage.set("the-mechanics-toolkit:sidebar-global-actions-collapsed:v1", "0");
storageListener({ key: "the-mechanics-toolkit:sidebar-global-actions-collapsed:v1" });
[collapsed] = api.MTKuseSidebarActionCollapse();
assert.equal(collapsed, false, "another-window storage event updates renderer state");

const collapsedDisclosure = api.MTKsidebarActionDisclosure({ collapsed: true, onToggle: toggle });
if (!build7746 && !build7942) {
  assert.equal(collapsedDisclosure.component, "Tooltip");
  assert.equal(collapsedDisclosure.props.tooltipContent, "Show navigation actions");
}
const collapsedButton = build7746 || build7942 ? collapsedDisclosure : collapsedDisclosure.props.children;
assert.equal(collapsedButton.component, build7746 || build7942 ? "button" : "IconButton");
assert.equal(collapsedButton.props["aria-expanded"], false);
assert.equal(collapsedButton.props["aria-label"], "Show navigation actions");
assert.equal(collapsedButton.props.children.component, "svg");
assert.equal(collapsedButton.props.children.props.children.component, "path");
assert.equal(collapsedButton.props.children.props.children.props.stroke, "currentColor");
assert.ok(!helper.includes("(0,x7.jsx)(Af") && !helper.includes("(0,x7.jsx)(XF") && !helper.includes("(0,x7.jsx)(tI"),
  "disclosure does not borrow an icon binding whose minified module may be uninitialized");
assert.equal(collapsedButton.props.children.props.className.includes("rotate-90"), false);

const expandedDisclosure = api.MTKsidebarActionDisclosure({ collapsed: false, onToggle: toggle });
const expandedButton = build7746 || build7942 ? expandedDisclosure : expandedDisclosure.props.children;
assert.equal(expandedButton.props["aria-expanded"], true);
assert.equal(expandedButton.props["aria-label"], "Hide navigation actions");
assert.equal(expandedButton.props.children.props.className.includes("rotate-90"), true);

if (build7345) {
  const destinations = [
    { id: "projects" },
    { id: "pull-requests" },
    { id: "scheduled" },
    { id: "plugins" },
    { id: "explore" }
  ];
  assert.strictEqual(api.MTKsidebarCollapsedDestinations(false, destinations, "projects"), destinations,
    "expanded state preserves the exact stock destination array");
  assert.deepEqual(api.MTKsidebarCollapsedDestinations(true, destinations, "projects"), [{ id: "projects" }],
    "collapsed state retains Projects and removes every global destination");
}

const stockLabels = ["New chat", "Pull requests", "Sites", "Scheduled", "Plugins", "Projects"];
if (source.includes("defaultMessage:`Library`")) stockLabels.push("Library", "Security");
for (const label of stockLabels) {
  assert.ok(source.includes(`defaultMessage:\`${label}\``), `stock Codex-mode label remains: ${label}`);
}
const helperSuffix = build7942 ? "7942" : build7746 ? "7746" : build7345 ? "7345" : "";
assert.equal(count(source, `function MTKuseSidebarActionCollapse${helperSuffix}(`), 1);
assert.equal(count(source, `function MTKsidebarActionDisclosure${helperSuffix}(`), 1);
if (build7942) {
  assert.ok(source.includes("let MTKsidebarDestinations=ZSn(we),Te=MTKsidebarActionsCollapsed?[]:MTKsidebarDestinations"),
    "collapsed state hides the complete stock global destination family");
  assert.ok(source.includes("MTKsidebarActionsCollapsed?null:(0,N4.jsx)($wn,"), "collapsed state hides the stock New chat row");
  assert.ok(source.includes("(0,N4.jsx)(MTKsidebarActionDisclosure7942,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})"),
    "disclosure shares the Codex sidebar header controls");
  assert.ok(source.includes("t[144]!==MTKsidebarActionsCollapsed") && source.includes("t[144]=MTKsidebarActionsCollapsed"),
    "disclosure state participates in the stock memo cache");
} else if (build7746) {
  assert.ok(source.includes("let MTKsidebarDestinations=$Cn(we),Te=MTKsidebarActionsCollapsed?[]:MTKsidebarDestinations"),
    "collapsed state hides the complete stock global destination family");
  assert.ok(source.includes("MTKsidebarActionsCollapsed?null:(0,O4.jsx)(zTn,"), "collapsed state hides the stock New chat row");
  assert.ok(source.includes("(0,O4.jsx)(MTKsidebarActionDisclosure7746,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})"),
    "disclosure shares the Codex sidebar header controls");
  assert.ok(source.includes("t[144]!==MTKsidebarActionsCollapsed") && source.includes("t[144]=MTKsidebarActionsCollapsed"),
    "disclosure state participates in the stock memo cache");
} else if (build7345) {
  assert.ok(source.includes("MTKsidebarActionsCollapsed?null:(0,h7.jsx)(gMc,"), "collapsed state hides the whole stock global action block");
  assert.ok(source.includes("let be=MTKsidebarCollapsedDestinations7345(MTKsidebarActionsCollapsed,ye,x6.projects)"),
    "collapsed state filters the separately rendered stock destination family to Projects only");
  assert.ok(source.includes("(0,h7.jsx)(TXc,"), "Projects and task content remain independently projected");
  assert.ok(source.includes("MTKsidebarActionDisclosure7345,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions}"),
    "disclosure shares the Codex sidebar header cluster with notifications and search");
} else {
  assert.ok(source.includes("let se=MTKsidebarActionsCollapsed?[]:oe,ce;"), "collapsed state hides the whole stock global destination family");
  assert.ok(source.includes("MTKsidebarActionsCollapsed?null:"), "collapsed state hides the stock New chat row");
  assert.ok(source.includes("de=[...ue,...se]"), "Projects remain independently projected above the filtered global family");
  assert.ok(source.includes("MTKsidebarActionDisclosure,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions}"),
    "disclosure shares the Codex sidebar header cluster with notifications and search");
}

process.stdout.write(`${JSON.stringify({
  state: "green",
  surface: "codex-sidebar",
  firstRun: "expanded",
  persistence: "renderer-localStorage-with-cross-window-storage-event",
  collapsedRows: stockLabels.filter(label => label !== "Projects"),
  projectsPreserved: true,
  disclosure: "native-button-with-owned-inline-svg-tooltip-and-aria-expanded"
}, null, 2)}\n`);

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
