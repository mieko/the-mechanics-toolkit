#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: tinrelay-pointer-presentation/patch.mjs check|apply EXTRACTED_ASAR_ROOT [--config TOOLKIT_CONFIG]");
}

const here = path.dirname(fileURLToPath(import.meta.url));
const incoming = path.join(here, "incoming-transform.mjs");
const outgoing = path.join(here, "outgoing-transform.mjs");
const incomingCheck = run(incoming, "check", []);
const outgoingCheck = run(outgoing, "check", []);

if (incomingCheck.state === "needs-apply" && outgoingCheck.state === "applied") {
  throw new Error("Upstream changed: Tinrelay presentation patch is partial");
}

let incomingResult = incomingCheck;
let outgoingResult = outgoingCheck;
if (command === "apply" && (incomingCheck.state !== "applied" || outgoingCheck.state !== "applied")) {
  incomingResult = run(incoming, "apply", process.argv.slice(4));
  outgoingResult = run(outgoing, "apply", []);
}

const state = incomingResult.state === "applied" && outgoingResult.state === "applied" ?
  "applied" : "needs-apply";
if (command === "apply" && state !== "applied") {
  throw new Error("Tinrelay presentation transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  contracts: ["tinrelay-local-pointer-v1", "tinrelay-outgoing-observer-v1"],
  source: "incoming-pointers-and-ordinary-successful-sends",
  client: incomingResult.client,
  localShip: incomingResult.localShip,
  targets: [...new Set([...incomingResult.targets, ...outgoingResult.targets])].sort()
}, null, 2)}\n`);

function run(script, action, extra) {
  const result = spawnSync(process.execPath, [script, action, root, ...extra], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `exit ${result.status}`;
    throw new Error(`${path.basename(script)} ${action} failed: ${detail.trim()}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${path.basename(script)} ${action} returned invalid JSON`);
  }
}
