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

assert.ok(main.includes("if(!N(t))return;s.type===`ready`&&(()=>{"),
  "the trusted stock ready message invokes Codex's existing relaunch-marker writer");
assert.ok(main.includes("e.startsWith(`--tmtk-safe-start-marker=`)"),
  "Windows activation can carry its launch-only marker without an inherited environment");
assert.ok(main.includes("i.startsWith(r)&&n.length===2&&/^[0-9a-z-]+$/.test(n[0])"),
  "the Windows marker is bounded to one of this user's TMTK rescue incidents");
assert.ok([
  "Tie=`CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH`",
  "Doe=`CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH`"
].some(contract => main.includes(contract)),
  "readiness uses the existing per-launch marker path environment boundary");
assert.equal([
  "H.dispatchMessage(`ready`,{persistedStateResponsePriority:G7?`critical`:void 0})",
  "H.dispatchMessage(`ready`,{persistedStateResponsePriority:W7?`critical`:void 0})",
  "h.dispatchMessage(`ready`,{persistedStateResponsePriority:i7?`critical`:void 0})"
].filter(contract => count(renderer, contract) === 1).length, 1,
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
