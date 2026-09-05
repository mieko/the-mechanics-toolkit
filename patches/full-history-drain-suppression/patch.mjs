#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error(
    "Usage: node patches/full-history-drain-suppression/patch.mjs check|apply EXTRACTED_ASAR_ROOT"
  );
}

const id = "[$A-Z_a-z][$\\w]*";
const historicalPristine = new RegExp(
  `function (?<factory>${id})\\((?<scope>${id}),(?<host>${id}),(?<backend>${id}),` +
    `\\{[\\s\\S]{0,4096}?suppressResumeHistoryDrain:(?<suppress>${id})=\\(\\)=>` +
    `(?<flag>${id})\\(\\k<scope>,(?<support>${id})\\?\\?\\(\\(\\)=>\\k<backend>` +
    `\\.supportsPaginatedThreadHistory\\(\\)\\)\\),supportsPaginatedThreadHistory:\\k<support>` +
    `\\}=\\{\\}\\)\\{let (?<localBool>${id})=\\k<host>===(?<localConst>${id}),`,
  "g"
);
const historicalApplied = new RegExp(
  `function (?<factory>${id})\\((?<scope>${id}),(?<host>${id}),(?<backend>${id}),` +
    `\\{[\\s\\S]{0,4096}?suppressResumeHistoryDrain:(?<suppress>${id})=\\(\\)=>\\k<host>===` +
    `(?<localConst>${id})\\?\\((?<support>${id})\\?\\?\\(\\(\\)=>\\k<backend>` +
    `\\.supportsPaginatedThreadHistory\\(\\)\\)\\)\\(\\):(?<flag>${id})` +
    `\\(\\k<scope>,\\k<support>\\?\\?\\(\\(\\)=>\\k<backend>` +
    `\\.supportsPaginatedThreadHistory\\(\\)\\)\\),supportsPaginatedThreadHistory:\\k<support>` +
    `\\}=\\{\\}\\)\\{let (?<localBool>${id})=\\k<host>===\\k<localConst>,`,
  "g"
);

const assets = path.join(root, "webview/assets");
const owner = inspect();
let state = owner.state;
if (command === "apply" && state === "needs-apply") {
  const patched = patchHistory(owner.source, owner.match);
  fs.writeFileSync(owner.file, patched);
  syntaxCheck(owner.file);
  state = inspect().state;
  if (state !== "applied") throw new Error("History-drain suppression did not verify after application");
}

process.stdout.write(`${JSON.stringify({
  state,
  target: path.relative(root, owner.file),
  behavior: state === "upstream-owned" ? "stock-paginated-history" : "local-resume-drain-suppressed"
}, null, 2)}\n`);

function inspect() {
  requireAssets();
  const stock = findStockPaginationOwner();
  if (stock != null) return stock;
  return findHistoricalOwner();
}

function findStockPaginationOwner() {
  const profiles = [
    [
      /getRequestedThreadHistoryMode\([$A-Z_a-z][$\w]*\)\{return [$A-Z_a-z][$\w]*==="default"&&this\.params\.usePaginatedThreadHistory\?\.\(\)===!0\?`paginated`:`legacy`\}/,
      /suppressResumeHistoryDrain:[$A-Z_a-z][$\w]*=\(\)=>[$A-Z_a-z][$\w]*\([$A-Z_a-z][$\w]*,[$A-Z_a-z][$\w]*\?\?\(\(\)=>[$A-Z_a-z][$\w]*\.supportsPaginatedThreadHistory\(\)\)\)/,
      /![$A-Z_a-z][$\w]*\.suppressResumeHistoryDrain\(\)&&[$A-Z_a-z][$\w]*\?\.olderCursor!=null/,
      /loadOlderConversationHistoryPage/,
      /initialTurnsPage:\{limit:5/,
      /thread\/turns\/list/
    ],
    [
      /getRequestedThreadHistoryMode\([$A-Z_a-z][$\w]*\)\{return [$A-Z_a-z][$\w]*==="default"&&this\.params\.usePaginatedThreadHistory\?\.\(\)===!0\?`paginated`:`legacy`\}/,
      /useTailHydration:[$A-Z_a-z][$\w]*,suppressResumeHistoryDrain:[$A-Z_a-z][$\w]*,supportsPaginatedThreadHistory:[$A-Z_a-z][$\w]*\}=\{\}\)\{let/,
      /runtimeSettings:\{suppressResumeHistoryDrain:[$A-Z_a-z][$\w]*,supportsPaginatedThreadHistory:[$A-Z_a-z][$\w]*,/,
      /![$A-Z_a-z][$\w]*\.suppressResumeHistoryDrain\(\)&&[$A-Z_a-z][$\w]*\?\.olderCursor!=null/,
      /loadOlderConversationHistoryPage/,
      /initialTurnsPage:\{limit:5,itemsView:`full`,sortDirection:`desc`\}/,
      /thread\/turns\/list/
    ]
  ];
  const partial = [];
  const complete = [];
  for (const file of javascriptAssets()) {
    const source = fs.readFileSync(file, "utf8");
    const matches = profiles.map(contracts => contracts.filter(contract => contract.test(source)));
    historicalPristine.lastIndex = 0;
    historicalApplied.lastIndex = 0;
    const historicalOwner = historicalPristine.test(source) || historicalApplied.test(source);
    if (!historicalOwner && matches.some(found => found.length >= 3)) partial.push({ file, matches });
    profiles.forEach((contracts, profile) => {
      if (matches[profile].length === contracts.length) complete.push({ file, source, profile });
    });
  }
  if (partial.length === 0) return null;
  if (complete.length !== 1) {
    throw new Error(
      `Upstream changed: found ${complete.length} complete and ${partial.length} partial stock pagination owners`
    );
  }
  if (partial.length !== 1 || partial[0].file !== complete[0].file) {
    throw new Error(`Upstream changed: stock pagination ownership split across ${partial.length} assets`);
  }
  historicalApplied.lastIndex = 0;
  if (historicalApplied.test(complete[0].source)) {
    throw new Error("Stock pagination owner is contaminated by the retired history-drain patch");
  }
  return { ...complete[0], state: "upstream-owned" };
}

function findHistoricalOwner() {
  const found = [];
  for (const file of javascriptAssets()) {
    const source = fs.readFileSync(file, "utf8");
    for (const [state, pattern] of [["needs-apply", historicalPristine], ["applied", historicalApplied]]) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) found.push({ state, file, source, match });
    }
  }
  if (found.length !== 1) throw new Error(`Upstream changed: found ${found.length} history-drain owners`);
  const owner = found[0];
  for (const contract of [
    "loadRemainingConversationTurns",
    "loadOlderConversationHistoryPage",
    "initialTurnsPage:{limit:5"
  ]) {
    if (!owner.source.includes(contract)) throw new Error(`Upstream changed: missing ${contract}`);
  }
  return owner;
}

function patchHistory(source, match) {
  const owner = match.groups;
  const capability = `${owner.support}??(()=>${owner.backend}.supportsPaginatedThreadHistory())`;
  const before = `suppressResumeHistoryDrain:${owner.suppress}=()=>${owner.flag}(${owner.scope},${capability}),`;
  const after = `suppressResumeHistoryDrain:${owner.suppress}=()=>${owner.host}===${owner.localConst}?` +
    `(${capability})():${owner.flag}(${owner.scope},${capability}),`;
  return replaceOnce(source, before, after, "history-drain patch point");
}

function javascriptAssets() {
  const files = [];
  walk(assets, file => {
    if (file.endsWith(".js")) files.push(file);
  });
  return files;
}

function walk(directory, visit) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, visit);
    else visit(file);
  }
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Upstream changed: ${label} is not unique`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function requireAssets() {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
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
    throw new Error(`Patched JavaScript failed module syntax check: ${summary}`);
  }
}
