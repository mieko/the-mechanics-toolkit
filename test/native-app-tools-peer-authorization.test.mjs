#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: native-app-tools-peer-authorization.test.mjs EXTRACTED_ASAR_ROOT");

const build = path.join(root, ".vite/build");
const matches = fs.readdirSync(build).filter(name => /^main-.*\.js$/.test(name));
assert.equal(matches.length, 1, "unique main-process asset");
const source = fs.readFileSync(path.join(build, matches[0]), "utf8");
const start = source.indexOf("function MTKnativeAppToolsPeerAuthorizer()");
const profile = source.includes("async function mie(")
  ? {owner: "mie", authorizer: "Tf"}
  : {owner: "zie", authorizer: "nd"};
const end = source.indexOf(`async function ${profile.owner}(`, start);
assert.ok(start >= 0 && end > start, "localized native app-tools peer helper");
const helperSource = source.slice(start, end);
const loadHelper = new Function(profile.authorizer, `${helperSource};return MTKnativeAppToolsPeerAuthorizer`);

const authorize = result => loadHelper(() => () => result)()({});
const stockPass = { authorized: true, teamId: "2DC432GLL2", signingIdentifier: "node" };
assert.deepEqual(authorize(stockPass), stockPass, "stock authorization remains authoritative");
assert.deepEqual(
  authorize({
    authorized: false,
    reason: "missing-code-signing-identity",
    teamId: "2DC432GLL2",
    signingIdentifier: "node"
  }),
  { authorized: true, reason: undefined, teamId: "2DC432GLL2", signingIdentifier: "node" },
  "the exact OpenAI Node peer survives a locally re-signed ancestor"
);
for (const result of [
  { authorized: false, reason: "untrusted-code-signing-identity", teamId: "2DC432GLL2", signingIdentifier: "node" },
  { authorized: false, reason: "missing-code-signing-identity", teamId: "OTHERTEAM1", signingIdentifier: "node" },
  { authorized: false, reason: "missing-code-signing-identity", teamId: "2DC432GLL2", signingIdentifier: "codex" }
]) {
  assert.deepEqual(authorize(result), result, "every non-exact peer rejection remains rejected");
}
assert.equal(
  count(source, "socketPeerAuthorizer:r=MTKnativeAppToolsPeerAuthorizer()"),
  1,
  "only the native app-tools pipe uses the mixed-signature fallback"
);
assert.equal(count(source, "i.authorizeSocketPeer(t,n)"), 1, "the native stock authorizer remains installed");

process.stdout.write(`${JSON.stringify({
  state: "green",
  stockFullChainAuthorizationPreserved: true,
  exactFallback: { teamId: "2DC432GLL2", signingIdentifier: "node", reason: "missing-code-signing-identity" },
  unrelatedNativePipesChanged: false
}, null, 2)}\n`);

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
