#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const patch = path.join(repository, "patches/macos-menu-title/patch.mjs");
const probe = path.join(repository, "test/macos-menu-title.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-menu-title-test-"));

try {
  const app = path.join(scratch, "ChatGPT.app");
  writeApp(app);

  assert.equal(runPatch("check", app).state, "needs-apply");
  const applied = runPatch("apply", app);
  assert.equal(applied.state, "applied");
  assert.equal(applied.target, "Contents/Info.plist");
  assert.equal(plist(app, "CFBundleName"), "Codex");
  assert.equal(plist(app, "CFBundleDisplayName"), "ChatGPT");
  assert.equal(plist(app, "CFBundleExecutable"), "ChatGPT");
  assert.equal(plist(app, "CFBundleIdentifier"), "com.openai.codex");

  const firstHash = sha256(path.join(app, "Contents/Info.plist"));
  assert.equal(runPatch("apply", app).state, "applied");
  assert.equal(sha256(path.join(app, "Contents/Info.plist")), firstHash, "second application is byte-identical");

  const probed = spawnSync(process.execPath, [probe, app], {encoding: "utf8"});
  assert.equal(probed.status, 0, probed.stderr || probed.stdout);

  for (const [key, value, expected] of [
    ["CFBundleName", "Something Else", /CFBundleName/],
    ["CFBundleDisplayName", "Codex", /CFBundleDisplayName/],
    ["CFBundleExecutable", "Codex", /CFBundleExecutable/],
    ["CFBundleIdentifier", "example.invalid", /CFBundleIdentifier/]
  ]) {
    const rejected = path.join(scratch, `${key}.app`);
    writeApp(rejected);
    setPlist(rejected, key, value);
    const result = runPatchRaw("check", rejected);
    assert.notEqual(result.status, 0, key);
    assert.match(result.stderr, expected, key);
  }

  process.stdout.write("macOS menu title transform probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function writeApp(app) {
  const contents = path.join(app, "Contents");
  fs.mkdirSync(contents, {recursive: true});
  fs.writeFileSync(path.join(contents, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.openai.codex</string>
  <key>CFBundleExecutable</key><string>ChatGPT</string>
  <key>CFBundleDisplayName</key><string>ChatGPT</string>
  <key>CFBundleName</key><string>ChatGPT</string>
</dict></plist>
`);
}

function runPatch(action, app) {
  const result = runPatchRaw(action, app);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function runPatchRaw(action, app) {
  return spawnSync(process.execPath, [patch, action, app], {encoding: "utf8"});
}

function plist(app, key) {
  const result = spawnSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, path.join(app, "Contents/Info.plist")], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function setPlist(app, key, value) {
  const result = spawnSync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, path.join(app, "Contents/Info.plist")], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
