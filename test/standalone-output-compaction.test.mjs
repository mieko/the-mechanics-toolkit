import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const app = path.resolve(process.argv[2] ?? "");
const layout = applicationLayout(app);
const versions = layout.map(binary => version(binary.path, binary.linux));
assert.equal(new Set(versions).size, 1, "bundled Codex executables report the same version");

process.stdout.write(`${JSON.stringify({
  patch: "standalone-output-compaction",
  binaryExecutable: true,
  targets: layout.map(binary => binary.relative),
  version: versions[0]
}, null, 2)}\n`);

function applicationLayout(root) {
  const mac = {relative: "Contents/Resources/codex", linux: false};
  mac.path = path.join(root, mac.relative);
  if (fs.existsSync(mac.path)) {
    requireFile(mac.path);
    fs.accessSync(mac.path, fs.constants.X_OK);
    return [mac];
  }
  return [
    {relative: "app/resources/codex.exe", linux: false},
    {relative: "app/resources/codex", linux: true}
  ].map(binary => {
    binary.path = path.join(root, binary.relative);
    requireFile(binary.path);
    return binary;
  });
}

function version(binary, linuxBinary) {
  const invocation = linuxBinary && process.platform === "win32"
    ? {program: "wsl.exe", arguments_: ["--exec", wslPath(binary), "--version"]}
    : {program: binary, arguments_: ["--version"]};
  const result = spawnSync(invocation.program, invocation.arguments_, {encoding: "utf8"});
  assert.equal(result.status, 0, `${binary} starts and reports its version`);
  const output = result.stdout.trim();
  assert.match(output, /^codex-cli \d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  return output;
}

function wslPath(value) {
  const match = path.win32.resolve(value).match(/^([A-Za-z]):\\(.*)$/);
  assert.ok(match, "WSL Codex binary is on a local Windows drive");
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

function requireFile(value) {
  assert.ok(fs.existsSync(value) && fs.statSync(value).isFile(),
    `Codex replacement is a file: ${value}`);
}
