#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: test/renderer-turn-window.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const names = fs.readdirSync(assets);
const app = read(unique(/^app-initial-.*\.js$/));
const localName = names.filter(name => /^local-conversation-thread-(?!turn-entries-).*\.js$/.test(name))
  .filter(name => {
    const source = read(name);
    return source.includes("renderEntries:") && source.includes("visibleTurnEntries:");
  });
assert.equal(localName.length, 1, "unique renderer-owning local-conversation-thread asset");
const local = read(localName[0]);
const build7345 = app.includes("UHrendererCurrentKeys=UHrendererTail(d,UHrendererTailLimit)");

if (!app.includes("UHrendererTail=(e,t)=>")) {
  const selectorContracts = app.includes("cRo=zy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{") ? [
    "cRo=zy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{",
    "d=n(NI,o),f=d?.flatMap",
    "h=n(NI,a==null?null:{hostId:n(II,a),threadId:a}),g=a!=null&&m==null?h?.flatMap",
    "turnEntityKeys:d?.map(({entityKey:e})=>e)"
  ] : [
    "gLo=Iy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{",
    "d=n(II,o),f=d?.flatMap",
    "h=n(II,a==null?null:{hostId:n(zI,a),threadId:a}),g=a!=null&&m==null?h?.flatMap",
    "turnEntityKeys:d?.map(({entityKey:e})=>e)"
  ];
  for (const contract of [
    ...selectorContracts,
    "initialTurnsPage:{limit:5,itemsView:`full`,sortDirection:`desc`}",
    "loadOlderConversationHistoryPage",
    "thread/turns/list"
  ]) assert.ok(app.includes(contract), `upstream renderer contract: ${contract}`);
  assert.ok(!local.includes("UH_RENDERER_TURN_LIMIT") && !local.includes("rendererTailLimit:"),
    "dormant local turn window is absent");
  process.stdout.write(`${JSON.stringify({
    state: "green",
    ownership: "upstream-paginated-renderer",
    localTailPatch: "dormant",
    stockOlderPageOwnerPreserved: true
  }, null, 2)}\n`);
  process.exit(0);
}

const tailSource = "UHrendererTail=(e,t)=>e==null||t==null||e.length<=t?e:t<=0?[]:e.slice(-t)";
const projectionSource = "UHrendererProjection=(e,t)=>{let n=UHrendererTail(e.visibleTurnEntries,t);return n===e.visibleTurnEntries?e:{...e,historyTimeline:null,latestVisibleTurnId:n.at(-1)?.turnId??null,visibleTurnEntries:n}}";
assert.equal(count(app, tailSource), 1, "one renderer-tail helper");
assert.equal(count(app, projectionSource), build7345 ? 0 : 1, "final projection helper matches selector generation");
assert.ok(build7345 ? app.includes(`,UHrendererTail,qCs,`) : app.includes(`,${tailSource},${projectionSource},`),
  "helpers remain declarations inside the selector's existing var owner");
assert.ok(!app.includes(",function UHrendererTail"), "function declarations cannot split the var owner");
if (!build7345) assert.match(app, /var [$A-Z_a-z][$\w]*(?:,[$A-Z_a-z][$\w]*)*,UHrendererTail,UHrendererProjection,[$A-Z_a-z][$\w]*(?:,[$A-Z_a-z][$\w]*)*=[$A-Z_a-z][$\w]*\(\(\(\)=>\{/,
  "helper assignments have declarations in the owning initialization group");
const { UHrendererTail, UHrendererProjection } = Function(
  `var ${tailSource},${projectionSource};return {UHrendererTail,UHrendererProjection}`
)();

const short = turns(1499);
assert.strictEqual(UHrendererTail(short, 1500), short, "short task keeps the exact stock array");
assert.strictEqual(UHrendererProjection({ visibleTurnEntries: short }, 1500).visibleTurnEntries, short);

const long = turns(5050);
const bounded = UHrendererTail(long, 1500);
assert.equal(bounded.length, 1500);
assert.equal(bounded[0].turnId, "turn-3550");
assert.equal(bounded.at(-1).turnId, "turn-5049");
let materializations = 0;
bounded.flatMap(turn => {
  materializations += 1;
  return [turn];
});
assert.equal(materializations, 1500, "materialization receives only the bounded tail");

const current = turns(400);
const parent = turns(5000, "parent");
const parentLimit = Math.max(0, 1500 - UHrendererTail(current, 1500).length);
assert.equal(UHrendererTail(parent, parentLimit).length + current.length, 1500, "parent and current share one budget");
assert.deepEqual(UHrendererTail(parent, 0), [], "a full current tail leaves no parent budget");

const delegated = {
  turnId: "delegated",
  items: [
    { type: "userMessage", source: "cross-task" },
    { type: "agentMessage", phase: "commentary" },
    { type: "agentMessage", phase: "final_answer" }
  ]
};
const active = { turnId: "active", status: "inProgress", items: turns(2500, "item") };
const containers = UHrendererTail([...turns(1600), delegated, active], 1500);
assert.strictEqual(containers.at(-2), delegated, "delegated multi-item container remains whole");
assert.equal(containers.at(-2).items.length, 3);
assert.strictEqual(containers.at(-1), active, "newest streaming container remains whole");
assert.equal(containers.at(-1).items.length, 2500);

const projected = UHrendererProjection({
  historyTimeline: turns(5050, "history"),
  latestVisibleTurnId: "old",
  visibleTurnEntries: long
}, 1500);
assert.equal(projected.visibleTurnEntries.length, 1500);
assert.equal(projected.historyTimeline, null, "bounded projection cannot rejoin the full timeline");
assert.equal(projected.latestVisibleTurnId, "turn-5049");

const accumulatedPages = turns(2505, "paged");
const accumulatedTail = UHrendererTail(accumulatedPages, 1500);
assert.equal(accumulatedTail.length, 1500, "loaded pages cannot grow the mounted renderer past its budget");
assert.equal(accumulatedTail[0].turnId, "paged-1005");
assert.equal(accumulatedTail.at(-1).turnId, "paged-2504");

const selectorContracts = build7345 ? [
  "UHrendererCurrentKeys=UHrendererTail(d,UHrendererTailLimit)",
  "f=UHrendererCurrentKeys?.flatMap(",
  "UHrendererParentLimit=UHrendererTailLimit==null?null:Math.max(0,UHrendererTailLimit-(UHrendererCurrentKeys?.length??0))",
  "UHrendererParentKeys=UHrendererTail(h,UHrendererParentLimit)",
  "g=a!=null&&m==null?UHrendererParentKeys?.flatMap(",
  "turnEntityKeys:UHrendererCurrentKeys?.map("
] : [
  "UHrendererCurrentRaw=",
  "UHrendererCurrentTurns=UHrendererTail(UHrendererCurrentRaw,UHrendererTailLimit)",
  "UHrendererParentLimit=UHrendererTailLimit==null?null:Math.max(0,UHrendererTailLimit-(UHrendererCurrentTurns?.length??0))",
  "UHrendererParentKeys=UHrendererTail(UHrendererParentRawKeys,UHrendererParentLimit)",
  "UHrendererWindowActive=UHrendererTailLimit!=null&&((UHrendererCurrentRaw?.length??0)+(UHrendererParentRawKeys?.length??0)>UHrendererTailLimit)",
  "UHrendererWindowActive?null:",
  "UHrendererCurrentKeys?.flatMap(",
  "UHrendererParentKeys?.flatMap(",
  "turnEntityKeys:UHrendererCurrentKeys?.map(",
  "return UHrendererProjection("
];
for (const contract of selectorContracts) assert.ok(app.includes(contract), `selector contract: ${contract}`);

assert.equal(count(local, "const UH_RENDERER_TURN_LIMIT=1500;"), 1);
assert.equal(count(local, "rendererTailLimit:UH_RENDERER_TURN_LIMIT"), 4,
  "initial render, mounted search, reveal, and eager local UI consumers share the bound");
assert.ok(local.includes("searchPersisted:"), "bounded component still owns mounted persisted search");
assert.ok(local.includes("getConversationState:"), "mounted search consumes the bounded selector");

for (const contract of [
  "initialTurnsPage:{limit:5",
  "loadOlderConversationHistoryPage",
  "thread/turns/list"
]) assert.ok(app.includes(contract), `stock pagination contract remains in app owner: ${contract}`);
assert.ok(local.includes("loadOlderConversationHistoryPage"),
  "stock older-page UI action remains available alongside the mounted window");

const fullConsumer = app.match(
  /async function [$A-Z_a-z][$\w]*\([$A-Z_a-z][$\w]*,\{conversationId:[$A-Z_a-z][$\w]*,isBackgroundSubagentsEnabled:[$A-Z_a-z][$\w]*,markdownLimit:[$A-Z_a-z][$\w]*\}\)\{[^}]{0,512}visibleTurnEntries:[$A-Z_a-z][$\w]*\}=[$A-Z_a-z][$\w]*\.get\([$A-Z_a-z][$\w]*,\{conversationId:[$A-Z_a-z][$\w]*,isBackgroundSubagentsEnabled:[$A-Z_a-z][$\w]*\}\);return [$A-Z_a-z][$\w]*\(/
);
assert.ok(fullConsumer, "full transcript/export consumer remains recognizable");
assert.ok(!fullConsumer[0].includes("rendererTailLimit:"), "full transcript/export remains unbounded");

process.stdout.write(`${JSON.stringify({
  state: "green",
  nativeTurnLimit: 1500,
  shortTaskIdentityPreserved: true,
  longTaskMaterializations: materializations,
  parentAndCurrentShareLimit: true,
  activeAndDelegatedContainersIntact: true,
  accumulatedPaginationBounded: true,
  stockOlderPageOwnerPreserved: true,
  mountedSearchScope: "bounded-renderer-tail",
  transcriptExportScope: "full"
}, null, 2)}\n`);

function turns(length, prefix = "turn") {
  return Array.from({ length }, (_, index) => ({ turnId: `${prefix}-${index}`, items: [] }));
}

function unique(pattern) {
  const matches = names.filter(name => pattern.test(name));
  assert.equal(matches.length, 1, `unique asset ${pattern}`);
  return matches[0];
}

function read(name) {
  return fs.readFileSync(path.join(assets, name), "utf8");
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
