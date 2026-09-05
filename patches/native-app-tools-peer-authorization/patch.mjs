#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: native-app-tools-peer-authorization/patch.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const build = path.join(root, ".vite/build");
const target = uniqueAsset(/^main-.*\.js$/);
let source = fs.readFileSync(target, "utf8");
let state = inspectState(source);

if (command === "apply" && state === "needs-apply") {
  source = patchSource(source);
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState(source);
  if (state !== "applied") throw new Error("native app-tools peer authorization transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  fallback: {
    stockReason: "missing-code-signing-identity",
    immediatePeerTeamId: "2DC432GLL2",
    immediatePeerSigningIdentifier: "node"
  },
  target: path.relative(root, target)
}, null, 2)}\n`);

function inspectState(value) {
  const profile = ownershipProfile(value);
  const helper = helperFor(profile.authorizer);
  const ownerBefore = ownerFor(profile, `${profile.authorizer}()`);
  const ownerAfter = ownerFor(profile, "MTKnativeAppToolsPeerAuthorizer()");
  const helperCount = count(value, helper);
  const redCount = count(value, ownerBefore);
  const greenCount = count(value, ownerAfter);
  verifyStockAuthorization(value);
  if (helperCount === 1 && greenCount === 1 && redCount === 0) return "applied";
  if (helperCount === 0 && greenCount === 0 && redCount === 1) return "needs-apply";
  throw new Error(
    `Upstream changed: native app-tools peer seams helper=${helperCount} red=${redCount} green=${greenCount}`
  );
}

function verifyStockAuthorization(value) {
  const profile = ownershipProfile(value);
  const contracts = [
    `${profile.envConst}=\`CODEX_BROWSER_USE_PEER_AUTHORIZATION\``,
    `${profile.addonConst}=\`browser-use-peer-authorization.node\``,
    `${profile.addon}.authorizeSocketPeer(t,n)`,
    "dynamic_app_tools_peer_rejected",
    "missing-socket-file-descriptor"
  ];
  for (const contract of contracts) {
    if (count(value, contract) !== 1) {
      throw new Error(`Upstream changed: native app-tools authorization contract is not unique: ${contract}`);
    }
  }
}

function patchSource(value) {
  const profile = ownershipProfile(value);
  const helper = helperFor(profile.authorizer);
  const ownerBefore = ownerFor(profile, `${profile.authorizer}()`);
  const ownerAfter = ownerFor(profile, "MTKnativeAppToolsPeerAuthorizer()");
  const ownerAt = value.indexOf(ownerBefore);
  if (ownerAt < 0 || value.indexOf(ownerBefore, ownerAt + ownerBefore.length) >= 0) {
    throw new Error("Upstream changed: native app-tools server owner is not unique");
  }
  return value.slice(0, ownerAt) + helper + ownerAfter + value.slice(ownerAt + ownerBefore.length);
}

function helperFor(authorizer) {
  return "function MTKnativeAppToolsPeerAuthorizer(){let e=" + authorizer + "();return t=>{let n=e(t);" +
    "return n.authorized?n:n.reason===`missing-code-signing-identity`&&" +
    "n.teamId===`2DC432GLL2`&&n.signingIdentifier===`node`?" +
    "{...n,authorized:!0,reason:void 0}:n}}";
}

function ownerFor(profile, defaultAuthorizer) {
  return `async function ${profile.owner}({callTool:e,listTools:t,pipePath:n,` +
    `socketPeerAuthorizer:r=${defaultAuthorizer}})`;
}

function ownershipProfile(value) {
  const profiles = [
    { owner: "zie", authorizer: "nd", envConst: "Mie", addonConst: "Nie", addon: "i" },
    { owner: "mie", authorizer: "Tf", envConst: "sie", addonConst: "cie", addon: "i" }
  ];
  const pristine = profiles.filter(profile =>
    value.includes(`${profile.envConst}=\`CODEX_BROWSER_USE_PEER_AUTHORIZATION\``) &&
    value.includes(ownerFor(profile, `${profile.authorizer}()`))
  );
  const applied = profiles.filter(profile =>
    value.includes(`${profile.envConst}=\`CODEX_BROWSER_USE_PEER_AUTHORIZATION\``) &&
    value.includes(ownerFor(profile, "MTKnativeAppToolsPeerAuthorizer()"))
  );
  if (pristine.length === 1 && applied.length === 0) return pristine[0];
  if (applied.length === 1 && pristine.length === 0) return applied[0];
  throw new Error(`Upstream changed: found ${pristine.length} pristine and ${applied.length} applied native app-tools owners`);
}

function uniqueAsset(pattern) {
  if (!fs.existsSync(build) || !fs.statSync(build).isDirectory()) {
    throw new Error(`Missing extracted main-process build directory: ${build}`);
  }
  const matches = fs.readdirSync(build).filter(name => pattern.test(name));
  if (matches.length !== 1) {
    throw new Error(`Upstream changed: found ${matches.length} assets matching ${pattern}`);
  }
  return path.join(build, matches[0]);
}

function count(value, needle) {
  return value.split(needle).length - 1;
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
