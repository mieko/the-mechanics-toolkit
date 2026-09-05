#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectAppBundle } from "../src/app-bundle.mjs";
import { patchDefinition } from "../src/patch-catalog.mjs";
import { stageApp } from "../src/stage-app.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [command, ...args] = process.argv.slice(2);

if (command === "inspect" && args.length === 1) {
  print(inspectAppBundle(args[0]));
} else if (command === "stage" && args.length === 4 && args[2] === "--config") {
  print(stageApp({sourceApp: args[0], destinationApp: args[1], configPath: args[3], repositoryRoot: root}));
} else if (command === "patch" && (args.length === 3 || args.length === 5)) {
  const [patchName, action, patchRoot, ...patchArgs] = args;
  const definition = patchDefinition(patchName);
  if (!definition) fail(`Unknown patch: ${patchName}`);
  if (!new Set(["check", "apply"]).has(action)) fail(`Unknown patch action: ${action}`);
  if (patchArgs.length > 0 && (patchArgs.length !== 2 || patchArgs[0] !== "--config")) {
    fail("Optional patch arguments must be: --config TOOLKIT_CONFIG");
  }
  const patch = path.join(root, definition.script);
  const result = spawnSync(process.execPath, [patch, action, patchRoot, ...patchArgs], { encoding: "utf8" });
  if (result.status !== 0) fail((result.stderr || result.stdout).trim());
  process.stdout.write(result.stdout);
} else {
  fail(
    "usage:\n" +
      "  mechanics-toolkit inspect CHATGPT_APP\n" +
      "  mechanics-toolkit stage SOURCE_CHATGPT_APP STAGED_CHATGPT_APP --config TOOLKIT_CONFIG\n" +
      "  mechanics-toolkit patch PATCH_NAME check|apply PATCH_ROOT [--config TOOLKIT_CONFIG]"
  );
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
