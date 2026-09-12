#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectAppBundle } from "../src/app-bundle.mjs";
import { diagnoseApp } from "../src/diagnose-app.mjs";
import { patchDefinition } from "../src/patch-catalog.mjs";
import { sourcePatchDefinition, sourcePatchDefinitions } from "../src/source-patch-catalog.mjs";
import { applySourcePatch, sourcePatchState } from "../src/source-patch.mjs";
import { stageApp } from "../src/stage-app.mjs";
import {stageDeb} from "../src/stage-deb.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [command, ...args] = process.argv.slice(2);

if (command === "inspect" && args.length === 1) {
  print(inspectAppBundle(args[0]));
} else if (command === "diagnose" && args.length === 1) {
  print(diagnoseApp({app: args[0]}));
} else if (command === "stage" && args.length === 4 && args[2] === "--config") {
  print(stageApp({sourceApp: args[0], destinationApp: args[1], configPath: args[3], repositoryRoot: root}));
} else if (command === "stage-deb" && args.length === 4 && args[2] === "--config") {
  print(stageDeb({sourceDeb: args[0], destinationDeb: args[1], configPath: args[3], repositoryRoot: root}));
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
} else if (command === "source-patch" && args.length === 1 && args[0] === "list") {
  print(sourcePatchDefinitions.map(({name, upstream, tag, commit, desktop}) => ({
    name, upstream, tag, commit, desktop
  })));
} else if (command === "source-patch" && args.length === 3) {
  const [patchName, action, checkoutRoot] = args;
  const definition = sourcePatchDefinition(patchName);
  if (!definition) fail(`Unknown source patch: ${patchName}`);
  if (!new Set(["check", "apply"]).has(action)) fail(`Unknown source-patch action: ${action}`);
  print(action === "apply"
    ? applySourcePatch({definition, checkoutRoot, repositoryRoot: root})
    : sourcePatchState({definition, checkoutRoot, repositoryRoot: root}));
} else {
  fail(
    "usage:\n" +
      "  mechanics-toolkit inspect CHATGPT_APP\n" +
      "  mechanics-toolkit diagnose CHATGPT_APP\n" +
      "  mechanics-toolkit stage SOURCE_CHATGPT_APP STAGED_CHATGPT_APP --config TOOLKIT_CONFIG\n" +
      "  mechanics-toolkit stage-deb SOURCE_CHATGPT_DEB STAGED_CHATGPT_DEB --config TOOLKIT_CONFIG\n" +
      "  mechanics-toolkit patch PATCH_NAME check|apply PATCH_ROOT [--config TOOLKIT_CONFIG]\n" +
      "  mechanics-toolkit source-patch list\n" +
      "  mechanics-toolkit source-patch PATCH_NAME check|apply CODEX_CHECKOUT"
  );
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
