#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectAppBundle } from "../src/app-bundle.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const patchScripts = new Map([
  ["sidebar-action-collapse", "patches/sidebar-action-collapse/patch.mjs"],
  ["terminal-toggle", "patches/terminal-toggle/patch.mjs"]
]);
const [command, ...args] = process.argv.slice(2);

if (command === "inspect" && args.length === 1) {
  print(inspectAppBundle(args[0]));
} else if (command === "patch" && args.length === 3) {
  const [patchName, action, extractedRoot] = args;
  const patchRelativePath = patchScripts.get(patchName);
  if (!patchRelativePath) fail(`Unknown patch: ${patchName}`);
  if (!new Set(["check", "apply"]).has(action)) fail(`Unknown patch action: ${action}`);
  const patch = path.join(root, patchRelativePath);
  const result = spawnSync(process.execPath, [patch, action, extractedRoot], { encoding: "utf8" });
  if (result.status !== 0) fail((result.stderr || result.stdout).trim());
  process.stdout.write(result.stdout);
} else {
  fail(
    "usage:\n" +
      "  mechanics-toolkit inspect CHATGPT_APP\n" +
      "  mechanics-toolkit patch PATCH_NAME check|apply EXTRACTED_ASAR_ROOT"
  );
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
