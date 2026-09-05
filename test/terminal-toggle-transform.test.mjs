#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolkit = path.join(repository, "bin/toolkit.mjs");
const behavioralProbe = path.join(repository, "test/terminal-toggle.test.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-terminal-test-"));

try {
  const assets = path.join(scratch, "webview/assets");
  fs.mkdirSync(assets, { recursive: true });
  const target = path.join(assets, "app-initial-fixture.js");
  fs.writeFileSync(target, fixtureSource());

  assert.equal(runToolkit("check", scratch).state, "needs-apply");
  assert.equal(runToolkit("apply", scratch).state, "applied");
  const once = fs.readFileSync(target);
  assert.equal(runToolkit("check", scratch).state, "applied");

  const probe = spawnSync(process.execPath, [behavioralProbe, scratch], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);

  assert.equal(runToolkit("apply", scratch).state, "applied");
  assert.deepEqual(fs.readFileSync(target), once, "second application is byte-identical");
  process.stdout.write("terminal toggle transform probe passed\n");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function runToolkit(action, root) {
  const result = spawnSync(
    process.execPath,
    [toolkit, "patch", "terminal-toggle", action, root],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function fixtureSource() {
  return `/*
{id:\`toggleTerminal\`,titleIntlId:\`codex.command.toggleTerminal\`,descriptionIntlId:\`codex.commandDescription.toggleTerminal\`,requiredAccess:\`codexLocal\`,commandMenuGroupKey:\`panels\`,commandMenu:!0,commandMenuFeature:\`codex\`,electron:{menuTitle:\`Open Terminal\`,menuTitleIntlId:\`codex.commandMenuTitle.toggleTerminal\`,
c=n===\`clearAllUnreads\`&&(r===\`Shift+Escape\`||r===\`Shift+Esc\`),l;
accelerators:i,allowRepeat:d,enabled:f,onlyWithin:p,yieldToSelectedText:u
allowWithinEditable:c,enabled:a,onKeyDown:l
pxi=()=>{d1t.run({action:{type:\`windows.terminal.toggle\`,windowId:Ux}})
[\`toggleTerminal\`,pxi]
defaultKeybindings:[{key:"Control+\`"}]
*/
export const fixture = true;
`;
}
