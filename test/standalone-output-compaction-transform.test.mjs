import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const script = path.join(root, "patches/standalone-output-compaction/patch.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tmtk-standalone-output-"));
try {
  const app = path.join(scratch, "ChatGPT.app");
  const bundled = path.join(app, "Contents/Resources/codex");
  const replacement = path.join(scratch, "patched-codex");
  const bundledProbeLog = path.join(scratch, "bundled-probe.log");
  fs.mkdirSync(path.dirname(bundled), {recursive: true});
  writeFakeCodex(bundled, "stock", "codex-cli 0.154.0-alpha.6.2", bundledProbeLog);
  writeFakeCodex(replacement, "patched", "codex-cli 0.154.0-alpha.6.2");
  const config = path.join(scratch, "toolkit.json");
  fs.writeFileSync(config, JSON.stringify({codexBinary: replacement}));

  assert.equal(run("check", app, config).state, "needs-apply");
  const bundledProbe = fs.readFileSync(bundledProbeLog, "utf8").trim();
  assert.equal(bundledProbe.startsWith(`${app}${path.sep}`), false,
    "macOS version probe executes a temporary copy outside the application bundle");
  assert.equal(fs.existsSync(bundledProbe), false,
    "temporary macOS version probe is removed before the check returns");
  assert.equal(run("apply", app, config).state, "applied");
  assert.equal(fs.readFileSync(bundled, "utf8"), fs.readFileSync(replacement, "utf8"));
  assert.equal(run("apply", app, config).state, "applied");

  writeFakeCodex(replacement, "wrong", "codex-cli 0.154.0");
  const mismatch = spawnSync(process.execPath, [script, "check", app, "--config", config], {encoding: "utf8"});
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /does not match bundle version/);

  const windowsApp = path.join(scratch, "windows-package");
  const windowsResources = path.join(windowsApp, "app/resources");
  const bundledNative = path.join(windowsResources, "codex.exe");
  const bundledWsl = path.join(windowsResources, "codex");
  const replacementNative = path.join(scratch, "patched-codex.exe");
  const replacementWsl = path.join(scratch, "patched-codex-wsl");
  fs.mkdirSync(windowsResources, {recursive: true});
  fs.writeFileSync(path.join(windowsApp, "AppxManifest.xml"), `<?xml version="1.0"?>
<Package>
  <Identity Name="OpenAI.Codex" Publisher="CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B"
    Version="26.908.4834.1" ProcessorArchitecture="arm64" ResourceId="" />
  <Applications>
    <Application Id="App" Executable="app\\ChatGPT.exe"
      EntryPoint="Windows.FullTrustApplication">
    </Application>
  </Applications>
</Package>`);
  for (const [target, marker] of [
    [bundledNative, "stock-native"],
    [bundledWsl, "stock-wsl"],
    [replacementNative, "patched-native"],
    [replacementWsl, "patched-wsl"]
  ]) writeFakeCodex(target, marker, "codex-cli 0.154.0-alpha.6.2");
  const windowsConfig = path.join(scratch, "windows-toolkit.json");
  fs.writeFileSync(windowsConfig, JSON.stringify({
    windows: {codexBinaries: {native: replacementNative, wsl: replacementWsl}}
  }));

  const windowsCheck = run("check", windowsApp, windowsConfig);
  assert.equal(windowsCheck.state, "needs-apply");
  assert.deepEqual(windowsCheck.targets, ["app/resources/codex.exe", "app/resources/codex"]);
  assert.equal(run("apply", windowsApp, windowsConfig).state, "applied");
  assert.equal(fs.readFileSync(bundledNative, "utf8"), fs.readFileSync(replacementNative, "utf8"));
  assert.equal(fs.readFileSync(bundledWsl, "utf8"), fs.readFileSync(replacementWsl, "utf8"));
  assert.equal(run("apply", windowsApp, windowsConfig).state, "applied");

  writeFakeCodex(replacementWsl, "wrong-wsl", "codex-cli 0.154.0");
  const wslMismatch = spawnSync(
    process.execPath,
    [script, "check", windowsApp, "--config", windowsConfig],
    {encoding: "utf8"}
  );
  assert.notEqual(wslMismatch.status, 0);
  assert.match(wslMismatch.stderr, /does not match bundle version/);
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function run(command, app, config) {
  const result = spawnSync(process.execPath, [script, command, app, "--config", config], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function writeFakeCodex(target, marker, reportedVersion = "codex-cli 0.153.4", invocationLog = null) {
  const recordInvocation = invocationLog == null ? "" : `printf '%s\\n' "$0" >> '${invocationLog}'\n`;
  fs.writeFileSync(target, `#!/bin/sh\n${recordInvocation}if [ "$1" = "--version" ]; then echo "${reportedVersion}"; else echo "${marker}"; fi\n`, {mode: 0o755});
}
