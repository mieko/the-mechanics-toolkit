#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: model-identity-guard.test.mjs EXTRACTED_ASAR_ROOT");
const assets = path.join(root, "webview/assets");
const owner = uniqueOwner(source => source.includes("function MTKinstallModelIdentityGuard("));
const start = owner.source.indexOf('const MTKmodelGuardStyleId=');
const end = owner.source.indexOf("function _Lr(e){", start);
assert.ok(start >= 0 && end > start, "model guard helper seam");
const helper = owner.source.slice(start, end);

class FakeElement {
  constructor(attributes = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.parentElement = null;
    this.blurred = false;
  }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  appendChild(child) { this.append(child); return child; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  blur() { this.blurred = true; }
  closest(selector) {
    for (let node = this; node != null; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  matches(selector) {
    if (selector === '[data-mtk-model-guard-mismatch="true"]') return this.getAttribute("data-mtk-model-guard-mismatch") === "true";
    if (selector === '[data-mtk-model-guard-editor="true"]') return this.getAttribute("data-mtk-model-guard-editor") === "true";
    if (selector === 'button[type="submit"]') return this.tagName === "BUTTON" && this.getAttribute("type") === "submit";
    return false;
  }
  querySelectorAll(selector) {
    const all = [];
    const walk = node => { for (const child of node.children) { all.push(child); walk(child); } };
    walk(this);
    if (selector === "[data-codex-intelligence-trigger]") return all.filter(node => node.hasAttribute("data-codex-intelligence-trigger"));
    if (selector === 'textarea,[contenteditable],[role="textbox"],[data-mtk-model-guard-editor]') {
      return all.filter(node => node.tagName === "TEXTAREA" || node.hasAttribute("contenteditable") || node.getAttribute("role") === "textbox" || node.hasAttribute("data-mtk-model-guard-editor"));
    }
    return [];
  }
}

const room = new FakeElement({"data-mtk-palette-room-host": "", "data-mtk-palette-thread-id": "task-1"});
const selector = new FakeElement({"data-codex-intelligence-trigger": "true", title: "Choose model"});
selector.tagName = "BUTTON";
const stockPlaceholder = "Whatever upstream currently says";
const editor = new FakeElement({contenteditable: "true", role: "textbox", "aria-label": "Message", "data-placeholder": stockPlaceholder});
editor.tagName = "DIV";
const send = new FakeElement({type: "submit"});
send.tagName = "BUTTON";
room.append(selector, editor, send);

const listeners = new Map();
const styles = new Map();
const document = {
  body: {},
  head: {appendChild(element) { styles.set(element.id, element); }},
  activeElement: null,
  createElement() { return new FakeElement(); },
  getElementById(id) { return styles.get(id) ?? null; },
  querySelectorAll(selectorText) {
    if (selectorText === "[data-mtk-palette-room-host][data-mtk-palette-thread-id]") return [room];
    return [];
  },
  addEventListener(name, callback) { listeners.set(name, callback); }
};
class FakeMutationObserver { observe() {} }
let pin = {model: "gpt-5.6-sol", reasoningEffort: "high"};
const realm = {
  __MTKmodelPinForTask(taskId) { return taskId === "task-1" ? pin : null; },
  __MTKmodelPinSubscribe() { return () => {}; }
};
const S7 = {useEffect(callback) { return callback(); }};
const api = Function("document", "MutationObserver", "Element", "S7", "globalThis", `${helper};return {guard:MTKmodelIdentityGuard,mismatch:MTKmodelGuardMismatch,describe:MTKmodelGuardDescription,recovery:MTKmodelGuardRecoveryMessage,use:MTKuseModelIdentityGuard}`)(document, FakeMutationObserver, FakeElement, S7, realm);

assert.equal(api.mismatch(pin, {model: "gpt-5.6-sol", reasoningEffort: "high"}), false);
assert.equal(api.mismatch(pin, {model: "gpt-5.6-luna", reasoningEffort: "low"}), true);
assert.match(api.describe({model: "gpt-5.6-luna", reasoningEffort: "low"}, pin), /Expected GPT-5.6 Sol \/ High; current GPT-5.6 Luna \/ Light/);
assert.equal(api.recovery(pin), "Expected: GPT-5.6 Sol High — restore that selection to continue.");

const releaseWrong = api.guard.publish("task-1", "gpt-5.6-luna", "low");
await tick();
assert.equal(room.getAttribute("data-mtk-model-guard-mismatch"), "true");
assert.equal(selector.getAttribute("data-mtk-model-guard-alert"), "true");
assert.match(selector.getAttribute("title"), /Select the pinned model to unlock input/);
assert.equal(editor.getAttribute("contenteditable"), "false");
assert.equal(editor.getAttribute("aria-disabled"), "true");
assert.equal(editor.getAttribute("data-mtk-model-guard-message"), "Expected: GPT-5.6 Sol High — restore that selection to continue.");
assert.equal(editor.getAttribute("aria-label"), "Expected: GPT-5.6 Sol High — restore that selection to continue.");
assert.equal(editor.getAttribute("placeholder"), "Expected: GPT-5.6 Sol High — restore that selection to continue.");
assert.equal(editor.getAttribute("data-placeholder"), "Expected: GPT-5.6 Sol High — restore that selection to continue.");
const guardStyle = styles.get("mtk-model-identity-guard-style").textContent;
assert.match(guardStyle, /content:attr\(data-mtk-model-guard-message\)/);
assert.match(guardStyle, /\.prosemirror-placeholder::before\{content:none!important\}/, "stock placeholder is not double-painted");
assert.match(guardStyle, /::after\{[^}]*inset:0;display:block;padding:0;[^}]*font-size:inherit;line-height:inherit;/, "recovery text keeps the native composer baseline");
assert.match(guardStyle, /html\.electron-light \[data-mtk-model-guard-editor="true"\]::after\{color:#A61B1B!important\}/,
  "light mode uses an opaque dark-red recovery message instead of translucent red");
assert.doesNotMatch(guardStyle, /::after\{[^}]*align-items:center/, "recovery text is not vertically recentered below the native first line");

let prevented = false, stopped = false;
listeners.get("submit")({type: "submit", target: room, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; }});
assert.equal(prevented && stopped, true, "submit is suppressed during a mismatch");
prevented = false;
listeners.get("click")({type: "click", target: selector, preventDefault() { prevented = true; }, stopImmediatePropagation() {}});
assert.equal(prevented, false, "the model selector remains usable");

releaseWrong();
const releaseRight = api.guard.publish("task-1", "gpt-5.6-sol", "high");
await tick();
assert.equal(room.getAttribute("data-mtk-model-guard-mismatch"), null);
assert.equal(selector.getAttribute("data-mtk-model-guard-alert"), null);
assert.equal(selector.getAttribute("title"), "Choose model", "stock selector title is restored");
assert.equal(editor.getAttribute("contenteditable"), "true");
assert.equal(editor.getAttribute("aria-disabled"), null);
assert.equal(editor.getAttribute("data-mtk-model-guard-message"), null);
assert.equal(editor.getAttribute("aria-label"), "Message");
assert.equal(editor.getAttribute("placeholder"), null);
assert.equal(editor.getAttribute("data-placeholder"), stockPlaceholder);

pin = null;
api.guard.refresh();
await tick();
assert.equal(room.getAttribute("data-mtk-model-guard-mismatch"), null, "an unpinned task remains stock");
releaseRight();

process.stdout.write("model identity guard behavioral probe passed\n");

function tick() { return new Promise(resolve => setTimeout(resolve, 0)); }
function uniqueOwner(predicate) {
  const found = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name), source = fs.readFileSync(file, "utf8");
    if (predicate(source)) found.push({file, source});
  }
  assert.equal(found.length, 1, "one model identity guard owner");
  return found[0];
}
