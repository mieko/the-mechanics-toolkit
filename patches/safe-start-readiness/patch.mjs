#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: safe-start-readiness/patch.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const mainTarget = uniqueAsset(path.join(root, ".vite/build"), /^main-.*\.js$/);
const rendererTarget = uniqueAsset(path.join(root, "webview/assets"), /^app-initial-.*\.js$/);
let mainSource = fs.readFileSync(mainTarget, "utf8");
const rendererSource = fs.readFileSync(rendererTarget, "utf8");
let state = inspectState(mainSource, rendererSource);

if (command === "apply" && state === "needs-apply") {
  mainSource = patchMain(mainSource);
  fs.writeFileSync(mainTarget, mainSource);
  syntaxCheck(mainTarget);
  state = inspectState(mainSource, rendererSource);
  if (state !== "applied") throw new Error("safe-start readiness transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  markerEnvironment: "CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH",
  readinessMessage: "ready",
  targets: [mainTarget].map(target => path.relative(root, target))
}, null, 2)}\n`);

function inspectState(mainValue, rendererValue) {
  verifyStockContracts(mainValue, rendererValue);
  return mainValue.includes("if(!N(t))return;s.type===`ready`&&P();") ? "applied" : "needs-apply";
}

function verifyStockContracts(mainValue, rendererValue) {
  const rendererReady = [
    "H.dispatchMessage(`ready`,{persistedStateResponsePriority:G7?`critical`:void 0})",
    "H.dispatchMessage(`ready`,{persistedStateResponsePriority:W7?`critical`:void 0})"
  ];
  const contracts = [
    [mainValue, "Tie=`CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH`"],
    [mainValue, "requestDevRelaunch:P=Aie}=e"],
    [mainValue, "if(!N(t))return;"]
  ];
  for (const [value, contract] of contracts) {
    if (count(value, contract) !== 1) throw new Error(`Upstream changed: safe-start contract is not unique: ${contract}`);
  }
  if (!rendererReady.some(contract => count(rendererValue, contract) === 1)) {
    throw new Error("Upstream changed: safe-start renderer readiness contract is not recognized");
  }
}

function patchMain(value) {
  return replaceOnce(
    value,
    "if(!N(t))return;",
    "if(!N(t))return;s.type===`ready`&&P();",
    "trusted stock renderer readiness message"
  );
}

function uniqueAsset(directory, pattern) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`Missing extracted asset directory: ${directory}`);
  }
  const matches = fs.readdirSync(directory).filter(name => pattern.test(name));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} assets matching ${pattern}`);
  return path.join(directory, matches[0]);
}

function replaceOnce(value, before, after, label) {
  if (count(value, before) !== 1) throw new Error(`Upstream changed: ${label} is not unique`);
  return value.replace(before, after);
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function syntaxCheck(file) {
  const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    encoding: "utf8",
    input: fs.readFileSync(file),
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    const output = result.stderr || result.stdout;
    const summary = output.match(/SyntaxError:[^\n]*/)?.[0] ?? output.trim().slice(-1000);
    throw new Error(`module syntax check failed for ${path.relative(root, file)}: ${summary}`);
  }
}
