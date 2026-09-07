#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: tinrelay-presentation.test.mjs EXTRACTED_ASAR_ROOT");

const here = path.dirname(fileURLToPath(import.meta.url));
for (const probe of ["tinrelay-pointer-presentation.test.mjs", "tinrelay-presentation-outgoing.test.mjs"]) {
  const result = spawnSync(process.execPath, [path.join(here, probe), root], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

process.stdout.write("unified Tinrelay presentation probe passed\n");
