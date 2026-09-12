#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const command = process.argv[2];
const app = path.resolve(process.argv[3] ?? "");
const configFlag = process.argv[4];
const configPath = process.argv[5];
if (!new Set(["check", "apply"]).has(command) || !process.argv[3] ||
    configFlag !== "--config" || !configPath) {
  throw new Error(
    "usage: standalone-output-compaction.mjs check|apply CHATGPT_APP --config TOOLKIT_CONFIG"
  );
}

const config = JSON.parse(fs.readFileSync(path.resolve(configPath), "utf8"));
const layout = applicationLayout(app);
const replacements = replacementBinaries(config, layout.kind);
const versions = layout.binaries.map((binary, index) => ({
  bundled: version(binary.path, {linuxBinary: binary.linux}),
  replacement: version(replacements[index], {linuxBinary: binary.linux})
}));
const expectedVersion = versions[0].bundled;
if (versions.some(pair => pair.bundled !== expectedVersion)) {
  throw new Error("Bundled native and WSL Codex binaries report different versions");
}
if (versions.some(pair => pair.replacement !== expectedVersion)) {
  const actual = [...new Set(versions.map(pair => pair.replacement))].join(", ");
  throw new Error(
    `Patched Codex version ${JSON.stringify(actual)} does not match bundle version ${JSON.stringify(expectedVersion)}`
  );
}

const replacementHashes = replacements.map(sha256);
let state = layout.binaries.every((binary, index) =>
  sha256(binary.path) === replacementHashes[index]
) ? "applied" : "needs-apply";
if (command === "apply" && state === "needs-apply") {
  for (const [index, binary] of layout.binaries.entries()) {
    const mode = fs.statSync(binary.path).mode;
    fs.copyFileSync(replacements[index], binary.path);
    if (process.platform !== "win32") fs.chmodSync(binary.path, mode);
  }
  state = layout.binaries.every((binary, index) =>
    sha256(binary.path) === replacementHashes[index]
  ) ? "applied" : "failed";
  if (state !== "applied") throw new Error("Patched Codex binary replacement did not verify");
}

const result = {
  state,
  version: expectedVersion,
  sha256: Object.fromEntries(layout.binaries.map((binary, index) => [
    binary.name,
    replacementHashes[index]
  ]))
};
if (layout.binaries.length === 1) result.target = layout.binaries[0].relative;
else result.targets = layout.binaries.map(binary => binary.relative);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function applicationLayout(root) {
  const macRelative = "Contents/Resources/codex";
  const mac = path.join(root, macRelative);
  const manifest = path.join(root, "AppxManifest.xml");
  const windowsDefinitions = [
    {name: "native", relative: "app/resources/codex.exe", linux: false},
    {name: "wsl", relative: "app/resources/codex", linux: true}
  ];
  const macPresent = fs.existsSync(mac);
  const windowsPresent = fs.existsSync(manifest) || windowsDefinitions.some(definition =>
    fs.existsSync(path.join(root, definition.relative))
  );
  if (macPresent && windowsPresent) throw new Error("Application contains ambiguous Codex layouts");
  if (macPresent) {
    requireExecutable(mac, "bundled Codex binary");
    return {
      kind: "macos",
      binaries: [{name: "native", relative: macRelative, path: mac, linux: false}]
    };
  }
  if (!windowsPresent) throw new Error("Application has no recognized bundled Codex layout");
  requireWindowsManifest(manifest);
  const binaries = windowsDefinitions.map(definition => {
    const binary = path.join(root, definition.relative);
    requireFile(binary, `bundled ${definition.name} Codex binary`);
    return {...definition, path: binary};
  });
  return {kind: "windows", binaries};
}

function replacementBinaries(value, kind) {
  if (kind === "macos") {
    if (typeof value.codexBinary !== "string" || !path.isAbsolute(value.codexBinary)) {
      throw new Error("Toolkit config codexBinary must be an absolute path");
    }
    const replacement = path.resolve(value.codexBinary);
    requireExecutable(replacement, "configured patched Codex binary");
    return [replacement];
  }
  const binaries = value.windows?.codexBinaries;
  if (binaries == null || typeof binaries !== "object" || Array.isArray(binaries) ||
      Object.keys(binaries).sort().join(",") !== "native,wsl") {
    throw new Error("Toolkit config windows.codexBinaries must contain exactly native and wsl");
  }
  return ["native", "wsl"].map(name => {
    const replacement = binaries[name];
    if (typeof replacement !== "string" || !path.isAbsolute(replacement)) {
      throw new Error(`Toolkit config windows.codexBinaries.${name} must be an absolute path`);
    }
    const resolved = path.resolve(replacement);
    requireFile(resolved, `configured patched ${name} Codex binary`);
    return resolved;
  });
}

function requireWindowsManifest(file) {
  requireFile(file, "AppxManifest.xml");
  const xml = fs.readFileSync(file, "utf8");
  const identityTags = [...xml.matchAll(/<Identity\b([^>]*?)\/?\s*>/g)];
  const applicationTags = [...xml.matchAll(/<Application\b([^>]*)>/g)];
  if (identityTags.length !== 1) throw new Error("MSIX manifest has no unique package identity");
  const identity = attributes(identityTags[0][1]);
  if (identity.Name !== "OpenAI.Codex" ||
      identity.Publisher !== "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B" ||
      !new Set(["arm64", "x64", "x86", "neutral"]).has(identity.ProcessorArchitecture)) {
    throw new Error("MSIX manifest does not have the exact qualified OpenAI Codex identity");
  }
  const applications = applicationTags.map(match => attributes(match[1])).filter(value =>
    value.Id === "App" && value.Executable?.replaceAll("\\", "/").toLowerCase() ===
      "app/chatgpt.exe" && value.EntryPoint?.toLowerCase() === "windows.fulltrustapplication"
  );
  if (applications.length !== 1) {
    throw new Error("MSIX manifest has no unique exact Codex full-trust application");
  }
}

function attributes(value) {
  const result = {};
  let consumed = value;
  for (const match of value.matchAll(/\s+([A-Za-z_:][\w:.-]*)=("[^"]*"|'[^']*')/g)) {
    if (Object.hasOwn(result, match[1])) throw new Error(`MSIX manifest repeats ${match[1]}`);
    result[match[1]] = match[2].slice(1, -1);
    consumed = consumed.replace(match[0], "");
  }
  if (consumed.trim() !== "" || Object.values(result).some(item => item.includes("&"))) {
    throw new Error("MSIX manifest contains an unsupported attribute form");
  }
  return result;
}

function version(binary, {linuxBinary}) {
  const invocation = linuxBinary && process.platform === "win32"
    ? {program: "wsl.exe", arguments_: ["--exec", wslPath(binary), "--version"]}
    : {program: binary, arguments_: ["--version"]};
  const result = spawnSync(invocation.program, invocation.arguments_, {encoding: "utf8"});
  if (result.status !== 0) {
    throw new Error(`${binary} --version failed: ${
      result.error?.message ?? (result.stderr || result.stdout).trim()}`);
  }
  const output = result.stdout.trim();
  if (!/^codex-cli \d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(output)) {
    throw new Error(`Unexpected Codex version output: ${JSON.stringify(output)}`);
  }
  return output;
}

function wslPath(value) {
  const match = path.win32.resolve(value).match(/^([A-Za-z]):\\(.*)$/);
  if (match == null) throw new Error(`WSL Codex binary must be on a local Windows drive: ${value}`);
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

function requireExecutable(target, label) {
  requireFile(target, label);
  fs.accessSync(target, fs.constants.X_OK);
}

function requireFile(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

function sha256(target) {
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}
