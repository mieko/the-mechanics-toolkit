import assert from "node:assert/strict";
import {
  compareMsixVersions,
  stageMsix,
  temporaryPackagePath,
  windowsConfig
} from "../src/stage-msix.mjs";

assert.equal(compareMsixVersions("26.908.4834.1", "26.908.4834.0"), 1);
assert.equal(compareMsixVersions("26.908.4834.1", "26.908.4834.1"), 0);
assert.equal(compareMsixVersions("26.908.4833.65535", "26.908.4834.0"), -1);
assert.throws(() => compareMsixVersions("26.908.4834", "26.908.4834.0"),
  /Invalid MSIX package version/);
assert.throws(() => compareMsixVersions("26.908.4834.65536", "26.908.4834.0"),
  /out of range/);

const config = {
  candidateVersion: "26.908.4834.1",
  knownGoodVersion: "26.908.4834.2",
  makeAppx: String.raw`C:\tools\makeappx.exe`,
  signTool: String.raw`C:\tools\signtool.exe`,
  signingCertificateThumbprint: "B3521CC4DA7ED2BB47F0C0A43109428A634109B2",
  codexBinaries: {
    native: String.raw`C:\build\codex.exe`,
    wsl: String.raw`C:\build\codex`
  }
};
assert.equal(windowsConfig(config), config);
assert.throws(() => windowsConfig({...config, candidateVersion: "1.2.3"}),
  /Invalid MSIX package version/);
assert.throws(() => windowsConfig({...config, makeAppx: "makeappx.exe"}),
  /absolute Windows path/);
assert.throws(() => windowsConfig({...config, surprise: true}), /Unknown toolkit config windows keys/);
assert.throws(() => windowsConfig({...config, signingCertificateThumbprint: "short"}),
  /SHA-1 thumbprint/);
assert.throws(() => stageMsix({platform: "darwin"}), /must run on Windows/);
assert.match(temporaryPackagePath("candidate.msix"),
  /^candidate\.tmp-\d+-[0-9a-f-]{36}\.msix$/,
  "temporary package names retain the MSIX extension required by SignTool");

process.stdout.write("Windows MSIX staging contract probe passed\n");
