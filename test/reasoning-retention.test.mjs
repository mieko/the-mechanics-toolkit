#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const extracted = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: reasoning-retention.test.mjs EXTRACTED_ASAR_ROOT");
const assets = path.join(extracted, "webview/assets");

const palette = uniqueSource(source => source.includes("function MTKreasoningShouldStayOpen("), "reasoning policy owner");
const turn = uniqueSource(source => source.includes("function MTKuseReasoningRetention("), "reasoning turn owner");
const activity = uniqueSource(source => source.includes("isCollapsed:!r&&(a??!i)"), "stock collapse owner");

const decisionText = functionAt(palette.source, palette.source.indexOf("function MTKreasoningShouldStayOpen("));
const decision = Function(`${decisionText};return MTKreasoningShouldStayOpen`)();
const kept = "22222222-2222-4222-8222-222222222222";
const ordinary = "33333333-3333-4333-8333-333333333333";
const policy = {rules: [
  {taskId: kept, keepReasoningOpen: true},
  {taskId: ordinary, keepReasoningOpen: false}
]};
assert.equal(decision(kept, policy), true, "an exact opted-in task retains reasoning");
assert.equal(decision(ordinary, policy), false, "an ordinary task keeps stock behavior");
assert.equal(decision("Engine Tender — Repairs", policy), false, "a title cannot opt a task into retention");

const helperStart = turn.source.indexOf("const MTKreasoningNoopSubscribe=");
const helperEnd = turn.source.indexOf("function _i(e){", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "turn hook helper seam");
const hookText = turn.source.slice(helperStart, helperEnd);
let subscribed = false;
const bridge = {
  __MTKreasoningSubscribe(listener) {
    subscribed = typeof listener === "function";
    return () => {};
  },
  __MTKreasoningShouldStayOpen(taskId) {
    return decision(taskId, policy);
  }
};
const Ui = {
  useSyncExternalStore(subscribe, snapshot) {
    subscribe(() => {});
    return snapshot();
  }
};
const hook = Function("Ui", "globalThis", `${hookText};return MTKuseReasoningRetention`)(Ui, bridge);
assert.equal(hook(kept), true);
assert.equal(hook(ordinary), false);
assert.equal(subscribed, true, "the turn rerenders when the async palette arrives");

const collapseText = functionAt(activity.source, containingFunctionStart(activity.source, activity.source.indexOf("isCollapsed:!r&&(a??!i)")));
const collapse = Function(`${collapseText};return ${functionName(collapseText)}`)();
const base = {hasFinalAssistantStarted: true, isTurnCancelled: false, hasRenderableAgentItems: true};
assert.deepEqual(collapse({...base, preventAutoCollapse: true}), {shouldAllowCollapse: true, isCollapsed: false});
assert.deepEqual(collapse({...base, preventAutoCollapse: false}), {shouldAllowCollapse: true, isCollapsed: true});
assert.deepEqual(collapse({...base, preventAutoCollapse: true, persistedCollapsed: true}), {shouldAllowCollapse: true, isCollapsed: true}, "manual collapse still wins");
assert.deepEqual(collapse({...base, preventAutoCollapse: true, persistedCollapsed: false}), {shouldAllowCollapse: true, isCollapsed: false}, "manual reopen still wins");
assert.equal(turn.source.includes("preventAutoCollapse:kt||yr||MTKreasoningRetained"), true, "selected policy reaches the stock collapse decision");

process.stdout.write("reasoning retention behavioral probe passed\n");

function uniqueSource(predicate, label) {
  const found = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (predicate(source)) found.push({file, source});
  }
  if (found.length !== 1) throw new Error(`expected one ${label}, found ${found.length}`);
  return found[0];
}

function containingFunctionStart(source, position) {
  let start = source.lastIndexOf("function ", position);
  while (start >= 0) {
    const text = functionAt(source, start);
    if (position < start + text.length) return start;
    start = source.lastIndexOf("function ", start - 1);
  }
  throw new Error("function owner not found");
}

function functionAt(source, start) {
  if (start < 0 || !source.startsWith("function ", start)) throw new Error("function start missing");
  const open = functionBodyOpen(source, start);
  let quote = null;
  let escaped = false;
  let depth = 1;
  for (let index = open + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error("unterminated function");
}

function functionBodyOpen(source, start) {
  const parameters = source.indexOf("(", start);
  let quote = null;
  let escaped = false;
  let depth = 0;
  for (let index = parameters; index < source.length; index += 1) {
    const char = source[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "{" && depth === 0) return index;
  }
  throw new Error("function body missing");
}

function functionName(source) {
  const match = source.match(/^function\s+([$\w]+)/);
  if (!match) throw new Error("named function missing");
  return match[1];
}
