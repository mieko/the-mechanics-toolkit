#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchStatus } from "../src/safe-start.mjs";

const userHome = os.homedir();
const stateFile = path.join(userHome, ".codex/tmtk-rescue/latest.json");
if (!fs.existsSync(stateFile)) fail("did-codex-launch: no TMTK launch attempt has been recorded", 2);
let state;
try {
  state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
} catch (error) {
  fail(`did-codex-launch: cannot read ${stateFile}: ${error.message}`, 2);
}
const result = launchStatus(state);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(result.launched ? 0 : 1);

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
