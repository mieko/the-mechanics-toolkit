#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const app = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: macos-menu-title.mjs check|apply CHATGPT_APP");
}

const info = path.join(app, "Contents/Info.plist");
if (!fs.existsSync(info) || !fs.statSync(info).isFile()) {
  throw new Error(`Missing application Info.plist: ${info}`);
}

verifyBundleContract();
let state = inspectState();
if (command === "apply" && state === "needs-apply") {
  plist(`Set :CFBundleName Codex`);
  state = inspectState();
  if (state !== "applied") throw new Error("macOS menu title transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  target: "Contents/Info.plist",
  title: "Codex"
}, null, 2)}\n`);

function inspectState() {
  const name = plist("Print :CFBundleName");
  if (name === "Codex") return "applied";
  if (name === "ChatGPT") return "needs-apply";
  throw new Error(`Upstream changed: CFBundleName is ${JSON.stringify(name)}`);
}

function verifyBundleContract() {
  const expected = new Map([
    ["CFBundleIdentifier", "com.openai.codex"],
    ["CFBundleExecutable", "ChatGPT"],
    ["CFBundleDisplayName", "ChatGPT"]
  ]);
  for (const [key, value] of expected) {
    const actual = plist(`Print :${key}`);
    if (actual !== value) {
      throw new Error(`Upstream changed: ${key} is ${JSON.stringify(actual)}`);
    }
  }
}

function plist(instruction) {
  const result = spawnSync("/usr/libexec/PlistBuddy", ["-c", instruction, info], {encoding: "utf8"});
  if (result.status !== 0) {
    const cause = (result.stderr || result.stdout).trim();
    throw new Error(`PlistBuddy ${instruction} failed: ${cause}`);
  }
  return result.stdout.trim();
}
