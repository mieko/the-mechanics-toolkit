#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectAppBundle } from "../src/app-bundle.mjs";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-app-test-"));
try {
  const app = path.join(scratch, "ChatGPT.app");
  const contents = path.join(app, "Contents");
  const resources = path.join(contents, "Resources");
  fs.mkdirSync(resources, { recursive: true });
  const archive = path.join(resources, "app.asar");
  const header = writeFixtureAsar(archive);
  const headerHash = crypto.createHash("sha256").update(header).digest("hex");
  writeInfo(path.join(contents, "Info.plist"), "com.openai.codex", headerHash);

  const inspected = inspectAppBundle(app, { verifySignature: false });
  assert.equal(inspected.identifier, "com.openai.codex");
  assert.equal(inspected.version, "26.999.1");
  assert.equal(inspected.build, "9999");
  assert.equal(inspected.asarIntegrity.state, "valid");
  assert.equal(inspected.asarIntegrity.actualHash, headerHash);
  assert.match(inspected.archive.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(inspected.signature, { state: "not-checked" });

  writeInfo(path.join(contents, "Info.plist"), "example.invalid", headerHash);
  assert.throws(
    () => inspectAppBundle(app, { verifySignature: false }),
    /Refusing non-Codex application bundle/
  );

  writeInfo(path.join(contents, "Info.plist"), "com.openai.codex", "0".repeat(64));
  assert.equal(
    inspectAppBundle(app, { verifySignature: false }).asarIntegrity.state,
    "mismatch"
  );

  process.stdout.write("application bundle inspection probe passed\n");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function writeFixtureAsar(file) {
  const header = Buffer.from('{"files":{}}');
  const headerPayload = Buffer.alloc(align4(4 + header.length));
  headerPayload.writeUInt32LE(header.length, 0);
  header.copy(headerPayload, 4);
  const headerPickle = Buffer.alloc(4 + headerPayload.length);
  headerPickle.writeUInt32LE(headerPayload.length, 0);
  headerPayload.copy(headerPickle, 4);
  const sizePickle = Buffer.alloc(8);
  sizePickle.writeUInt32LE(4, 0);
  sizePickle.writeUInt32LE(headerPickle.length, 4);
  fs.writeFileSync(file, Buffer.concat([sizePickle, headerPickle]));
  return header;
}

function writeInfo(file, identifier, hash) {
  fs.writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>${identifier}</string>
  <key>CFBundleShortVersionString</key><string>26.999.1</string>
  <key>CFBundleVersion</key><string>9999</string>
  <key>ElectronAsarIntegrity</key><dict>
    <key>Resources/app.asar</key><dict>
      <key>algorithm</key><string>SHA256</string>
      <key>hash</key><string>${hash}</string>
    </dict>
  </dict>
</dict></plist>
`);
}

function align4(value) {
  return value + ((4 - (value % 4)) % 4);
}
