#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/native-app-tools-peer-authorization.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-native-peer-test-"));

try {
  for (const profile of [
    {owner: "zie", authorizer: "nd", envConst: "Mie", addonConst: "Nie"},
    {owner: "mie", authorizer: "Tf", envConst: "sie", addonConst: "cie"}
  ]) {
    const extracted = path.join(scratch, profile.owner);
    const build = path.join(extracted, ".vite/build");
    const target = path.join(build, "main-fixture.js");
    fs.mkdirSync(build, {recursive: true});
    fs.writeFileSync(target, fixture(profile));

    assert.equal(runToolkit("check", extracted).state, "needs-apply");
    const applied = runToolkit("apply", extracted);
    assert.equal(applied.state, "applied");
    assert.deepEqual(applied.fallback, {
      stockReason: "missing-code-signing-identity",
      immediatePeerTeamId: "2DC432GLL2",
      immediatePeerSigningIdentifier: "node"
    });
    const once = fs.readFileSync(target);
    const probe = spawnSync(process.execPath, [behavioralProbe, extracted], {encoding: "utf8"});
    assert.equal(probe.status, 0, probe.stderr || probe.stdout);

    assert.equal(runToolkit("apply", extracted).state, "applied");
    assert.deepEqual(fs.readFileSync(target), once, `${profile.owner} second application is byte-identical`);
  }
  process.stdout.write("native app-tools peer authorization transform probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}

function runToolkit(action, extracted) {
  const result = spawnSync(
    process.execPath,
    [toolkit, "patch", "native-app-tools-peer-authorization", action, extracted],
    {encoding: "utf8"}
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function fixture(profile) {
  return [
    `const ${profile.envConst}=\`CODEX_BROWSER_USE_PEER_AUTHORIZATION\`,${profile.addonConst}=\`browser-use-peer-authorization.node\`;`,
    `const i={authorizeSocketPeer(){}};function ${profile.authorizer}(){return()=>({authorized:false})}`,
    "function stock(t,n){return i.authorizeSocketPeer(t,n)}",
    `async function ${profile.owner}({callTool:e,listTools:t,pipePath:n,socketPeerAuthorizer:r=${profile.authorizer}()}){return r}`,
    "const reasons=[`dynamic_app_tools_peer_rejected`,`missing-socket-file-descriptor`];",
    "export const fixture=true;"
  ].join("");
}
