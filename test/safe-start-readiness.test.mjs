#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: safe-start-readiness.test.mjs EXTRACTED_ASAR_ROOT");
const assets = path.join(root, "webview/assets");
const build = path.join(root, ".vite/build");
const renderer = fs.readFileSync(uniqueAsset(assets, /^app-initial-.*\.js$/), "utf8");
const main = fs.readFileSync(uniqueAsset(build, /^main-.*\.js$/), "utf8");

assert.ok(main.includes("if(!N(t))return;s.type===`ready`&&P();"),
  "the trusted stock ready message invokes Codex's existing relaunch-marker writer");
assert.ok(main.includes("Tie=`CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH`"),
  "readiness uses the existing per-launch marker path environment boundary");
assert.equal(count(renderer, "H.dispatchMessage(`ready`,{persistedStateResponsePriority:W7?`critical`:void 0})"), 1,
  "the renderer retains its unique stock AppRoutes-mount readiness event");
assert.equal(renderer.includes("mtk-safe-start-ready"), false, "the patch does not invent a second renderer lifecycle");
process.stdout.write("safe-start readiness probe passed\n");

function uniqueAsset(directory, pattern) {
  const matches = fs.readdirSync(directory).filter(name => pattern.test(name));
  assert.equal(matches.length, 1, `unique asset matching ${pattern}`);
  return path.join(directory, matches[0]);
}

function count(value, needle) {
  return value.split(needle).length - 1;
}
