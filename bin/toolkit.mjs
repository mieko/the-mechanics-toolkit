#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectAppBundle } from "../src/app-bundle.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const patchScripts = new Map([
  ["cross-task-attribution", "patches/cross-task-attribution/patch.mjs"],
  ["outgoing-message-receipt", "patches/outgoing-message-receipt/patch.mjs"],
  ["renderer-patch-registry", "patches/renderer-patch-registry/patch.mjs"],
  ["sidebar-action-collapse", "patches/sidebar-action-collapse/patch.mjs"],
  ["task-attention-policy", "patches/task-attention-policy/patch.mjs"],
  ["task-visual-palette", "patches/task-visual-palette/patch.mjs"],
  ["terminal-toggle", "patches/terminal-toggle/patch.mjs"]
]);
const [command, ...args] = process.argv.slice(2);

if (command === "inspect" && args.length === 1) {
  print(inspectAppBundle(args[0]));
} else if (command === "patch" && (args.length === 3 || args.length === 5)) {
  const [patchName, action, extractedRoot, ...patchArgs] = args;
  const patchRelativePath = patchScripts.get(patchName);
  if (!patchRelativePath) fail(`Unknown patch: ${patchName}`);
  if (!new Set(["check", "apply"]).has(action)) fail(`Unknown patch action: ${action}`);
  if (patchArgs.length > 0 && (patchArgs.length !== 2 || patchArgs[0] !== "--config")) {
    fail("Optional patch arguments must be: --config TOOLKIT_CONFIG");
  }
  const patch = path.join(root, patchRelativePath);
  const result = spawnSync(process.execPath, [patch, action, extractedRoot, ...patchArgs], { encoding: "utf8" });
  if (result.status !== 0) fail((result.stderr || result.stdout).trim());
  process.stdout.write(result.stdout);
} else {
  fail(
    "usage:\n" +
      "  mechanics-toolkit inspect CHATGPT_APP\n" +
      "  mechanics-toolkit patch PATCH_NAME check|apply EXTRACTED_ASAR_ROOT [--config TOOLKIT_CONFIG]"
  );
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
