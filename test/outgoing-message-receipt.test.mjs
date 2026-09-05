#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: outgoing-message-receipt.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const owners = fs.readdirSync(assets).filter(name => {
  if (!name.endsWith(".js")) return false;
  const source = fs.readFileSync(path.join(assets, name), "utf8");
  return source.includes("localConversation.appControlToolCall.threadsSendMessage.active") &&
    source.includes("function MTKOutboundMessageReceipt(");
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

const jsxName = unique(
  helper,
  /p=\(0,(?<name>[$A-Z_a-z][$\w]*)\.jsxs\)\("div",\{"data-mtk-outgoing-message-receipt":!0/g,
  "JSX runtime"
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
const store = {
  get(_atom, key) {
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
  "X"
];
const values = [
  jsx,
  () => store,
  Symbol("store-scope"),
  id => `local:${id}`,
  id => `remote:${id}`,
  Symbol("task-atom"),
  function StockHover() {},
  function StockUserFormattedText() {},
  id => id,
  {dispatchHostMessage(message) { sent.push(message); }},
  () => false,
  id => `/new/${id}`,
  id => `/local/${id}`,
  () => ({type: "stock-fallback"})
];
const api = Function(...names, `${helper};return {MTKoutboundArguments,MTKoutboundLabel,MTKoutboundPreview,MTKoutboundTaskColor,MTKOutboundMessageReceipt,MTKrenderOutboundMessage}`)(...values);

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
assert.ok(recipient.props.style.color.includes("#6B8E72"), "recipient name opportunistically uses palette color");
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

for (const contract of [
  "standaloneInConversation:!0",
  "persistentInCollapsedConversation:!0",
  "function MTKOutboundMessageReceipt(",
  "MTKoutboundStoreHook(MTKoutboundStoreScope)",
  "MTKoutboundTaskColor(n.threadId,a)",
  "globalThis.__MTK_PATCH_REGISTRY__",
  "MTKoutboundHover",
  "MTKoutboundFormattedText",
  "interactive:!0",
  "delayDuration:800",
  "navigate-to-route"
]) assert.ok(owner.includes(contract), contract);
assert.ok(!helper.includes("innerHTML") && !helper.includes("dangerouslySetInnerHTML"), "message text is never parsed as markup");
assert.ok(!helper.includes("\"details\"") && !helper.includes("\"pre\""), "no parallel click disclosure or monospace body remains");

process.stdout.write(`${JSON.stringify({
  state: "green",
  persistence: "mounted-session",
  collapsedVisibility: "persistent-via-stock-activity-contract",
  layout: "left-aligned-neutral-hover-receipt",
  recipientMetadata: "stock-task-selector",
  paletteCapability: "optional-versioned-render-time-query",
  clickThrough: "stock-task-route",
  messageRendering: "stock-recipient-user-message-formatter"
}, null, 2)}\n`);

function unique(value, pattern, label) {
  const matches = [...value.matchAll(pattern)];
  assert.equal(matches.length, 1, label);
  return matches[0];
}
