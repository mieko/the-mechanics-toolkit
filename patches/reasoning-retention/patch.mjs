#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: reasoning-retention.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const turn = uniqueOwner(source =>
  source.includes("preventAutoCollapse:kt||yr") || source.includes("function MTKuseReasoningRetention("),
  "local reasoning-collapse owner"
);
const collapse = uniqueOwner(source =>
  source.includes("preventAutoCollapse:i,persistedCollapsed:a") &&
    source.includes("isCollapsed:!r&&(a??!i)"),
  "agent-activity collapse contract"
);

let state = inspectState();
if (command === "apply" && state === "needs-apply") {
  const palette = paletteOwner();
  ensurePaletteBridge(palette);
  patchTurn(turn.file);
  syntaxCheck(palette.file);
  syntaxCheck(turn.file);
  state = inspectState();
  if (state !== "applied") throw new Error("reasoning retention transform did not verify");
}

const palette = paletteOwner(false);
process.stdout.write(`${JSON.stringify({
  state,
  policy: ".codex/task-visual-palette.json",
  targets: [palette?.file, turn.file].filter(Boolean).map(file => path.relative(root, file))
}, null, 2)}\n`);

function inspectState() {
  const source = fs.readFileSync(turn.file, "utf8");
  const markers = [
    source.includes("function MTKuseReasoningRetention("),
    source.includes("MTKreasoningRetained=MTKuseReasoningRetention(a)"),
    source.includes("preventAutoCollapse:kt||yr||MTKreasoningRetained")
  ];
  if (markers.every(Boolean)) {
    const palette = paletteOwner();
    const paletteSource = fs.readFileSync(palette.file, "utf8");
    for (const marker of [
      "keepReasoningOpen:t.keepReasoningOpen===!0",
      "function MTKreasoningShouldStayOpen(",
      "globalThis.__MTKreasoningShouldStayOpen=MTKreasoningShouldStayOpen",
      "globalThis.__MTKreasoningSubscribe="
    ]) {
      if (!paletteSource.includes(marker)) throw new Error(`Unrecognized reasoning retention patch: missing ${marker}`);
    }
    verifyCollapseContract();
    return "applied";
  }
  if (markers.some(Boolean)) throw new Error("Unrecognized reasoning retention patch: partial turn markers");
  for (const contract of [
    "function _i(e){let t=(0,Vi.c)(207),",
    "I=Fe!==void 0&&Fe,ot=bt(le)",
    "preventAutoCollapse:kt||yr"
  ]) {
    if (!source.includes(contract)) throw new Error(`Upstream changed: missing reasoning turn contract ${contract}`);
  }
  verifyCollapseContract();
  return "needs-apply";
}

function verifyCollapseContract() {
  const source = fs.readFileSync(collapse.file, "utf8");
  for (const contract of [
    "preventAutoCollapse:i,persistedCollapsed:a",
    "isCollapsed:!r&&(a??!i)",
    "onToggle:()=>{let e=!W;if(u==null){A(e);return}u(e)}"
  ]) {
    if (!source.includes(contract)) throw new Error(`Upstream changed: missing agent-activity contract ${contract}`);
  }
}

function paletteOwner(required = true) {
  const owners = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (source.includes('MTKpaletteRelativePath=".codex/task-visual-palette.json"')) {
      owners.push({file, source});
    }
  }
  if (!required && owners.length === 0) return null;
  if (owners.length !== 1) throw new Error(`Reasoning retention requires exactly one task visual palette owner; found ${owners.length}`);
  return owners[0];
}

function ensurePaletteBridge(owner) {
  if (!owner.source.includes("function MTKreasoningShouldStayOpen(")) {
    throw new Error("Reasoning retention requires the current task-visual-palette patch first");
  }
}

function patchTurn(file) {
  let source = fs.readFileSync(file, "utf8");
  const helper = "const MTKreasoningNoopSubscribe=()=>()=>{};function MTKuseReasoningRetention(e){let t=globalThis.__MTKreasoningSubscribe??MTKreasoningNoopSubscribe;return Ui.useSyncExternalStore(t,()=>globalThis.__MTKreasoningShouldStayOpen?.(e)===!0,()=>!1)}";
  source = replaceOnce(source, "function _i(e){let t=(0,Vi.c)(207),", `${helper}function _i(e){let t=(0,Vi.c)(207),`, "reasoning turn hook");
  source = replaceOnce(source, "I=Fe!==void 0&&Fe,ot=bt(le)", "I=Fe!==void 0&&Fe,MTKreasoningRetained=MTKuseReasoningRetention(a),ot=bt(le)", "reasoning task decision");
  source = replaceOnce(source, "preventAutoCollapse:kt||yr", "preventAutoCollapse:kt||yr||MTKreasoningRetained", "reasoning auto-collapse gate");
  fs.writeFileSync(file, source);
}

function uniqueOwner(predicate, label) {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const owners = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (predicate(source)) owners.push({file, source});
  }
  if (owners.length !== 1) throw new Error(`Upstream changed: found ${owners.length} ${label}s`);
  return owners[0];
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function syntaxCheck(file) {
  const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    encoding: "utf8",
    input: fs.readFileSync(file),
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    const output = result.stderr || result.stdout;
    const summary = output.match(/SyntaxError:[^\n]*/)?.[0] ?? output.trim().slice(-1000);
    throw new Error(`module syntax check failed for ${path.relative(root, file)}: ${summary}`);
  }
}
