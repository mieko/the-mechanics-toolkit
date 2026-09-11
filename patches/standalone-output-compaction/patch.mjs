#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const app = path.resolve(process.argv[3] ?? "");
const configFlag = process.argv[4];
const configPath = process.argv[5];
if (!new Set(["check", "apply"]).has(command) || !process.argv[3] || configFlag !== "--config" || !configPath) {
  throw new Error("usage: standalone-output-compaction.mjs check|apply CHATGPT_APP --config TOOLKIT_CONFIG");
}

const config = JSON.parse(fs.readFileSync(path.resolve(configPath), "utf8"));
if (typeof config.codexBinary !== "string" || !path.isAbsolute(config.codexBinary)) {
  throw new Error("Toolkit config codexBinary must be an absolute path");
}

const bundled = path.join(app, "Contents/Resources/codex");
const replacement = path.resolve(config.codexBinary);
requireExecutable(bundled, "bundled Codex binary");
requireExecutable(replacement, "configured patched Codex binary");

const bundledVersion = version(bundled);
const replacementVersion = version(replacement);
if (replacementVersion !== bundledVersion) {
  throw new Error(`Patched Codex version ${JSON.stringify(replacementVersion)} does not match bundle version ${JSON.stringify(bundledVersion)}`);
}

const replacementSha256 = sha256(replacement);
let state = sha256(bundled) === replacementSha256 ? "applied" : "needs-apply";
if (command === "apply" && state === "needs-apply") {
  const mode = fs.statSync(bundled).mode;
  fs.copyFileSync(replacement, bundled);
  fs.chmodSync(bundled, mode);
  state = sha256(bundled) === replacementSha256 ? "applied" : "failed";
  if (state !== "applied") throw new Error("Patched Codex binary replacement did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  target: "Contents/Resources/codex",
  version: replacementVersion,
  sha256: replacementSha256
}, null, 2)}\n`);

function requireExecutable(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`Missing ${label}: ${target}`);
  fs.accessSync(target, fs.constants.X_OK);
}

function version(binary) {
  const result = spawnSync(binary, ["--version"], {encoding: "utf8"});
  if (result.status !== 0) throw new Error(`${binary} --version failed: ${(result.stderr || result.stdout).trim()}`);
  const output = result.stdout.trim();
  if (!/^codex-cli \d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(output)) throw new Error(`Unexpected Codex version output: ${JSON.stringify(output)}`);
  return output;
}

function sha256(target) {
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}
