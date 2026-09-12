#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {asarHeaderSha256, readAsarFile} from "../src/asar-integrity.mjs";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "asar-integrity-test-"));
try {
  const archive = path.join(scratch, "fixture.asar");
  const payload = Buffer.from('{"name":"fixture"}\n');
  const header = Buffer.from(JSON.stringify({
    files: {"package.json": {size: payload.length, offset: "0"}}
  }));
  const headerPayload = Buffer.alloc(align4(4 + header.length));
  headerPayload.writeUInt32LE(header.length, 0);
  header.copy(headerPayload, 4);
  const headerPickle = Buffer.alloc(4 + headerPayload.length);
  headerPickle.writeUInt32LE(headerPayload.length, 0);
  headerPayload.copy(headerPickle, 4);
  const sizePickle = Buffer.alloc(8);
  sizePickle.writeUInt32LE(4, 0);
  sizePickle.writeUInt32LE(headerPickle.length, 4);
  fs.writeFileSync(archive, Buffer.concat([sizePickle, headerPickle, payload]));

  assert.equal(
    asarHeaderSha256(archive),
    crypto.createHash("sha256").update(header).digest("hex")
  );
  assert.deepEqual(readAsarFile(archive, "package.json"), payload);
  assert.throws(() => readAsarFile(archive, "../package.json"), /Invalid ASAR file path/);
  assert.throws(() => readAsarFile(archive, "missing.json"), /Missing packed ASAR file/);

  fs.writeFileSync(path.join(scratch, "truncated.asar"), Buffer.alloc(12));
  assert.throws(() => asarHeaderSha256(path.join(scratch, "truncated.asar")), /Truncated ASAR header/);
  process.stdout.write("asar integrity probe passed\n");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function align4(value) {
  return value + ((4 - (value % 4)) % 4);
}
