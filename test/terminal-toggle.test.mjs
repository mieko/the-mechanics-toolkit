#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: terminal-toggle.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const names = fs.readdirSync(assets);
const matches = names.filter(name => /^app-initial-.*\.js$/.test(name));
assert.equal(matches.length, 1, "unique app-initial asset");
const source = fs.readFileSync(path.join(assets, matches[0]), "utf8");

assert.equal(
  count(source, "{id:`toggleTerminal`,titleIntlId:`codex.command.toggleTerminal`,descriptionIntlId:`codex.commandDescription.toggleTerminal`,requiredAccess:`codexLocal`,shortcutScope:`app`,commandMenuGroupKey:`panels`"),
  1,
  "the existing configurable terminal command is app-scoped"
);
assert.equal(
  count(source, "c=n===`toggleTerminal`||n===`clearAllUnreads`&&(r===`Shift+Escape`||r===`Shift+Esc`),l;"),
  1,
  "the terminal command is allowed while the composer or xterm editable owns focus"
);
const build7345 = source.includes("ccr=()=>{K9t.run({action:{type:`windows.terminal.toggle`,windowId:hx}})");
const build7746 = source.includes("$bi=()=>{u1t.run({action:{type:`windows.terminal.toggle`,windowId:Wx}})");
const build7942 = source.includes("pxi=()=>{d1t.run({action:{type:`windows.terminal.toggle`,windowId:Ux}})");
if (!build7345 && !build7746 && !build7942) assert.equal(count(source, "i=_s(uW,r)"), 1, "shortcut dispatch reads configured accelerators");
assert.equal(
  count(source, "accelerators:i,allowRepeat:d,enabled:f,onlyWithin:p,yieldToSelectedText:u"),
  1,
  "the configured accelerators feed the existing hotkey dispatcher"
);
assert.equal(
  count(source, "allowWithinEditable:c,enabled:a,onKeyDown:l"),
  1,
  "editable permission reaches the existing hotkey hook"
);
if (build7942) {
  assert.equal(count(source, "pxi=()=>{d1t.run({action:{type:`windows.terminal.toggle`,windowId:Ux}})"), 1,
    "the command keeps the stock terminal action owner");
  assert.equal(count(source, "[`toggleTerminal`,pxi]"), 1,
    "the configurable command remains routed through the stock terminal toggle action");
} else if (build7746) {
  assert.equal(count(source, "$bi=()=>{u1t.run({action:{type:`windows.terminal.toggle`,windowId:Wx}})"), 1,
    "the command keeps the stock terminal action owner");
  assert.equal(count(source, "[`toggleTerminal`,$bi]"), 1,
    "the configurable command remains routed through the stock terminal toggle action");
} else if (build7345) {
  assert.equal(count(source, "ccr=()=>{K9t.run({action:{type:`windows.terminal.toggle`,windowId:hx}})"), 1,
    "the command keeps the stock terminal action owner");
  assert.equal(count(source, "function Ugn(e,t){if(t===`bottom`){let t=e.get(RC)===`bottom-panel`?e.get(BC):null;UC(e,!1),t!=null&&PC(e,t),hT();return}"), 1,
    "hiding the bottom panel retains the stock main-focus handoff");
  assert.equal(count(source, "function hT(){kgn();let e=_T();e&&requestAnimationFrame(()=>{e.focus()})}"), 1,
    "the main-focus handoff resolves and focuses the registered composer");
} else {
  assert.equal(count(source, "Y7r=()=>{v9e({type:`windows.terminal.toggle`,windowId:d9e})}"), 1,
    "the command keeps the stock terminal action owner");
  assert.equal(count(source, "function oJo(e){if(e.get(wJo)){Z1n(e,`bottom`);return}Qqo(e)}"), 1,
    "an active bottom terminal follows the stock hide-panel branch");
  assert.equal(count(source, "function Z1n(e,t){if(t===`bottom`){let t=e.get(kT)===`bottom-panel`?e.get(QJn):null;SYn(e,!1),t!=null&&TT(e,t),lE();return}"), 1,
    "hiding the bottom panel retains the stock main-focus handoff");
  assert.equal(count(source, "function lE(){F1n();let e=uE();e&&requestAnimationFrame(()=>{e.focus()})}"), 1,
    "the main-focus handoff resolves and focuses the registered composer");
}
assert.equal(
  count(source, 'defaultKeybindings:[{key:"Control+`"}]'),
  1,
  "the stock default remains data, not patch logic"
);

process.stdout.write(`${JSON.stringify({
  state: "green",
  command: "toggleTerminal",
  acceleratorOwner: "configured-keymap",
  composerFocused: "opens-terminal",
  terminalFocused: build7746 || build7942 ? "stock-terminal-toggle-action" : "hides-bottom-panel-and-focuses-composer",
  hardcodedShortcutAdded: false
}, null, 2)}\n`);

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
