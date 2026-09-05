#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const app = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: macos-menu-title.test.mjs CHATGPT_APP");

assert.equal(plist("CFBundleIdentifier"), "com.openai.codex");
assert.equal(plist("CFBundleExecutable"), "ChatGPT");
assert.equal(plist("CFBundleDisplayName"), "ChatGPT");
assert.equal(plist("CFBundleName"), "Codex");

process.stdout.write("macOS menu title probe passed\n");

function plist(key) {
  const info = path.join(app, "Contents/Info.plist");
  const result = spawnSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, info], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
