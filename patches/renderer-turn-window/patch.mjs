#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("Usage: node patches/renderer-turn-window/patch.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const appInitial = uniqueAsset(/^app-initial-.*\.js$/);
const localThread = uniqueAsset(
  /^local-conversation-thread-(?!turn-entries-).*\.js$/,
  source => source.includes("renderEntries:") && source.includes("visibleTurnEntries:")
);
let appSource = fs.readFileSync(appInitial, "utf8");
let localSource = fs.readFileSync(localThread, "utf8");
let state = inspectState(appSource, localSource);

if (command === "apply" && state === "needs-apply") {
  appSource = patchSelector(appSource);
  localSource = patchRenderer(localSource);
  fs.writeFileSync(appInitial, appSource);
  fs.writeFileSync(localThread, localSource);
  state = inspectState(appSource, localSource);
  if (state !== "applied") throw new Error("Renderer turn window did not verify after application");
  for (const target of [appInitial, localThread]) syntaxCheck(target);
}

process.stdout.write(`${JSON.stringify({
  state,
  historicalLimit: 1500,
  behavior: state === "upstream-owned" ? "stock-paginated-renderer" : "bounded-mounted-turns",
  targets: [path.relative(root, appInitial), path.relative(root, localThread)]
}, null, 2)}\n`);

function inspectState(app, local) {
  const appMarked = app.includes("UHrendererTail=(e,t)=>") || app.includes("rendererTailLimit:UHrendererTailLimit");
  const localMarked = local.includes("const UH_RENDERER_TURN_LIMIT=1500;") || local.includes("rendererTailLimit:UH_RENDERER_TURN_LIMIT");
  if (appMarked || localMarked) {
    if (!appMarked || !localMarked) throw new Error("Unrecognized renderer turn window: partial application");
    inspectAppliedSelector(app);
    inspectAppliedRenderer(local);
    return "applied";
  }
  if (isStockPaginatedRenderer(app)) {
    inspectStockPaginatedRenderer(app);
    inspectPristineRenderer(local);
    return "upstream-owned";
  }
  inspectPristineSelector(app);
  inspectPristineRenderer(local);
  return "needs-apply";
}

function isStockPaginatedRenderer(source) {
  return (source.includes("gLo=Iy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{") ||
    source.includes("cRo=zy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{")) &&
    source.includes("initialTurnsPage:{limit:5,itemsView:`full`,sortDirection:`desc`}") &&
    source.includes("loadOlderConversationHistoryPage") &&
    source.includes("thread/turns/list");
}

function inspectStockPaginatedRenderer(source) {
  const selectorProfile = source.includes("cRo=zy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{")
    ? [
      "cRo=zy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{",
      "d=n(NI,o),f=d?.flatMap",
      "h=n(NI,a==null?null:{hostId:n(II,a),threadId:a}),g=a!=null&&m==null?h?.flatMap",
      "turnEntityKeys:d?.map(({entityKey:e})=>e)"
    ]
    : [
      "gLo=Iy(Q,({conversationId:e,isBackgroundSubagentsEnabled:t},{get:n})=>{",
      "d=n(II,o),f=d?.flatMap",
      "h=n(II,a==null?null:{hostId:n(zI,a),threadId:a}),g=a!=null&&m==null?h?.flatMap",
      "turnEntityKeys:d?.map(({entityKey:e})=>e)"
    ];
  const contracts = [
    ...selectorProfile,
    "initialTurnsPage:{limit:5,itemsView:`full`,sortDirection:`desc`}",
    "loadOlderConversationHistoryPage",
    "thread/turns/list"
  ];
  for (const contract of contracts) {
    if (count(source, contract) !== 1 && contract !== "thread/turns/list") {
      throw new Error(`Upstream changed: stock paginated-renderer contract ${contract}`);
    }
  }
  if (count(source, "thread/turns/list") < 1) {
    throw new Error("Upstream changed: stock paginated-renderer turn-list owner is missing");
  }
}

function inspectPristineSelector(source) {
  const owner = selectorOwner(source);
  if (owner.header.groups.limit != null) {
    throw new Error("Unrecognized renderer selector: unexpected tail-limit parameter");
  }
  const body = owner.body;
  for (const contract of [
    "visibleTurnEntries:",
    "turnEntityKeys:",
    ".flatMap(",
    "historyTimeline:"
  ]) {
    if (!source.includes(contract)) throw new Error(`Upstream changed: missing selector contract ${contract}`);
  }
  if (isBuild7345Selector(body)) {
    inspectBuild7345PristineSelector(body);
  } else {
    matchSelectorPrefix(body, owner.header.groups);
    matchParentMaterialization(body, owner.header.groups);
  }
  matchSelectorReturn(body);
  const declaration = selectorDeclaration(source, owner.header.groups.selector, owner.header.index);
  if (declaration.names.includes("UHrendererTail") || declaration.names.includes("UHrendererProjection")) {
    throw new Error("Unrecognized renderer selector: helper declaration is already present");
  }
  inspectTranscriptConsumer(source, owner.header.groups.selector, false);
}

function inspectAppliedSelector(source) {
  const owner = selectorOwner(source);
  const { limit } = owner.header.groups;
  if (limit !== "UHrendererTailLimit") {
    throw new Error("Unrecognized renderer selector: wrong tail-limit owner");
  }
  if (owner.body.includes("UHrendererCurrentKeys=UHrendererTail(d,UHrendererTailLimit)")) {
    inspectBuild7345AppliedSelector(source, owner);
    return;
  }
  for (const contract of [
    "UHrendererTail=(e,t)=>e==null||t==null||e.length<=t?e:t<=0?[]:e.slice(-t)",
    "UHrendererProjection=(e,t)=>{let n=UHrendererTail(e.visibleTurnEntries,t);return n===e.visibleTurnEntries?e:{...e,historyTimeline:null,latestVisibleTurnId:n.at(-1)?.turnId??null,visibleTurnEntries:n}}",
    "UHrendererCurrentRaw=",
    "UHrendererCurrentTurns=UHrendererTail(",
    "UHrendererCurrentKeys=UHrendererTail(",
    "UHrendererParentRawKeys=",
    "UHrendererParentLimit=UHrendererTailLimit==null?null:Math.max(0,",
    "UHrendererParentKeys=UHrendererTail(",
    "UHrendererWindowActive=UHrendererTailLimit!=null&&",
    "UHrendererWindowActive?null:",
    "),UHrendererTailLimit)"
  ]) {
    if (!source.includes(contract)) throw new Error(`Unrecognized renderer turn window: missing ${contract}`);
  }
  if (count(source, "UHrendererTail=(e,t)=>") !== 1 || count(source, "UHrendererProjection=(e,t)=>") !== 1) {
    throw new Error("Unrecognized renderer turn window: helper ownership is ambiguous");
  }
  const declaration = selectorDeclaration(source, owner.header.groups.selector, owner.header.index);
  if (count(declaration.names, "UHrendererTail") !== 1 || count(declaration.names, "UHrendererProjection") !== 1) {
    throw new Error("Unrecognized renderer turn window: helpers are not declared by the selector owner");
  }
  if (count(owner.body, "UHrendererCurrentKeys?.flatMap(") !== 1) {
    throw new Error("Unrecognized renderer turn window: current turns are not bounded before materialization");
  }
  if (count(owner.body, "UHrendererParentKeys?.flatMap(") !== 1) {
    throw new Error("Unrecognized renderer turn window: parent turns are not bounded before materialization");
  }
  if (count(owner.body, "turnEntityKeys:UHrendererCurrentKeys?.map(") !== 1) {
    throw new Error("Unrecognized renderer turn window: bounded entity keys are not aligned");
  }
  if (count(owner.body, "return UHrendererProjection(") !== 1) {
    throw new Error("Unrecognized renderer turn window: final bounded projection ownership changed");
  }
  inspectTranscriptConsumer(source, owner.header.groups.selector, true);
}

function patchSelector(source) {
  const owner = selectorOwner(source);
  if (isBuild7345Selector(owner.body)) return patchBuild7345Selector(source, owner);
  const names = owner.header.groups;
  const declaration = selectorDeclaration(source, names.selector, owner.header.index);
  const prefix = matchSelectorPrefix(owner.body, names);
  const parent = matchParentMaterialization(owner.body, names);
  const returned = matchSelectorReturn(owner.body);
  const parentKey = `{hostId:${names.get}(${prefix.groups.hostAtom},${prefix.groups.parent}),threadId:${prefix.groups.parent}}`;
  const beforePrefix = prefix[0];
  const afterPrefix =
    `let ${prefix.groups.parent}=${names.background}?${names.get}(${prefix.groups.parentAtom},${names.conversation})??null:null,` +
    `${prefix.groups.threadKey}={hostId:${names.get}(${prefix.groups.hostAtom},${names.conversation}),threadId:${names.conversation}},` +
    `${prefix.groups.keys}=${names.get}(${prefix.groups.keysAtom},${prefix.groups.threadKey}),` +
    `UHrendererCurrentRaw=${prefix.groups.transient}?.turns??${prefix.groups.keys},` +
    `UHrendererCurrentTurns=UHrendererTail(UHrendererCurrentRaw,UHrendererTailLimit),` +
    `UHrendererCurrentKeys=UHrendererTail(${prefix.groups.keys},UHrendererTailLimit),` +
    `UHrendererParentKey=${prefix.groups.parent}==null?null:${parentKey},` +
    `UHrendererParentRawKeys=${names.get}(${prefix.groups.keysAtom},UHrendererParentKey),` +
    `UHrendererParentLimit=UHrendererTailLimit==null?null:Math.max(0,UHrendererTailLimit-(UHrendererCurrentTurns?.length??0)),` +
    `UHrendererParentKeys=UHrendererTail(UHrendererParentRawKeys,UHrendererParentLimit),` +
    `UHrendererWindowActive=UHrendererTailLimit!=null&&` +
    `((UHrendererCurrentRaw?.length??0)+(UHrendererParentRawKeys?.length??0)>UHrendererTailLimit),` +
    `${prefix.groups.history}=UHrendererWindowActive?null:${names.get}(${prefix.groups.timelineAtom},${prefix.groups.threadKey}),` +
    `${prefix.groups.timeline}=UHrendererWindowActive?null:${prefix.groups.transient}==null?${prefix.groups.history}:${prefix.groups.timelineFromTransient}(${prefix.groups.transient}),` +
    `${prefix.groups.historyEntries}=${prefix.groups.historyEntriesFn}(${prefix.groups.timeline}),` +
    `${prefix.groups.parentHistory}=UHrendererWindowActive?null:${names.get}(${prefix.groups.timelineAtom},UHrendererParentKey),` +
    `${prefix.groups.parentHistoryEntries}=${prefix.groups.historyEntriesFn}(${prefix.groups.parentHistory}),` +
    `${prefix.groups.turns}=${prefix.groups.transient}?.turns!=null?UHrendererCurrentTurns:UHrendererCurrentKeys?.flatMap`;

  let body = replaceOnce(owner.body, beforePrefix, afterPrefix, "selector materialization prefix");
  body = replaceOnce(
    body,
    parent[0],
    `${parent.groups.parentTurns}=${parent.groups.parent}!=null&&${parent.groups.inherited}==null?UHrendererParentKeys?.flatMap`,
    "parent materialization"
  );
  body = replaceOnce(
    body,
    returned[0],
    `return UHrendererProjection(${returned.groups.projector}({${returned.groups.arguments.replace(
      `turnEntityKeys:${prefix.groups.keys}?.map(`,
      "turnEntityKeys:UHrendererCurrentKeys?.map("
    )}}),UHrendererTailLimit)`,
    "selector projection return"
  );

  const headerBefore = owner.header[0];
  const headerAfter = headerBefore.replace(
    `isBackgroundSubagentsEnabled:${names.background}}`,
    `isBackgroundSubagentsEnabled:${names.background},rendererTailLimit:UHrendererTailLimit}`
  );
  const helper =
    "UHrendererTail=(e,t)=>e==null||t==null||e.length<=t?e:t<=0?[]:e.slice(-t)," +
    "UHrendererProjection=(e,t)=>{let n=UHrendererTail(e.visibleTurnEntries,t);return n===e.visibleTurnEntries?e:{...e,historyTimeline:null,latestVisibleTurnId:n.at(-1)?.turnId??null,visibleTurnEntries:n}},";
  const patchedOwner = `${helper}${owner.text.replace(headerBefore, headerAfter).replace(owner.body, body)}`;
  let patched = replaceOnce(source, owner.text, patchedOwner, "renderer selector owner");
  const declaredNames = declaration.names.replace(
    `,${names.selector},`,
    `,UHrendererTail,UHrendererProjection,${names.selector},`
  );
  if (declaredNames === declaration.names) {
    throw new Error("Upstream changed: selector is not an interior declaration");
  }
  patched = replaceOnce(
    patched,
    declaration.text,
    declaration.text.replace(declaration.names, declaredNames),
    "renderer selector declarations"
  );
  return patched;
}

function isBuild7345Selector(body) {
  return body.includes("let r=n(gH,e)??!1,i=n(TH,e)??zCs;n(wH,e);let a=t?n(kH,e)??null:null") &&
    body.includes("d=n(zH,o),f=d?.flatMap") &&
    body.includes("turnEntityKeys:d?.map(({entityKey:e})=>e)");
}

function inspectBuild7345PristineSelector(body) {
  for (const contract of [
    "d=n(zH,o),f=d?.flatMap",
    "h=n(zH,a==null?null:{hostId:n(UH,a),threadId:a}),g=a!=null&&m==null?h?.flatMap",
    "turnEntityKeys:d?.map(({entityKey:e})=>e)"
  ]) {
    if (count(body, contract) !== 1) throw new Error(`Upstream changed: build-7345 selector contract ${contract}`);
  }
}

function inspectBuild7345AppliedSelector(source, owner) {
  for (const contract of [
    "UHrendererTail=(e,t)=>e==null||t==null||e.length<=t?e:t<=0?[]:e.slice(-t)",
    "UHrendererCurrentKeys=UHrendererTail(d,UHrendererTailLimit)",
    "f=UHrendererCurrentKeys?.flatMap",
    "UHrendererParentLimit=UHrendererTailLimit==null?null:Math.max(0,UHrendererTailLimit-(UHrendererCurrentKeys?.length??0))",
    "UHrendererParentKeys=UHrendererTail(h,UHrendererParentLimit)",
    "g=a!=null&&m==null?UHrendererParentKeys?.flatMap",
    "turnEntityKeys:UHrendererCurrentKeys?.map(({entityKey:e})=>e)"
  ]) {
    if (count(source, contract) !== 1) throw new Error(`Unrecognized build-7345 renderer window: missing ${contract}`);
  }
  const declaration = selectorDeclaration(source, owner.header.groups.selector, owner.header.index);
  if (count(declaration.names, "UHrendererTail") !== 1) {
    throw new Error("Unrecognized build-7345 renderer window: helper declaration ownership changed");
  }
  inspectTranscriptConsumer(source, owner.header.groups.selector, true);
}

function patchBuild7345Selector(source, owner) {
  let body = owner.body;
  body = replaceOnce(
    body,
    "d=n(zH,o),f=d?.flatMap",
    "d=n(zH,o),UHrendererCurrentKeys=UHrendererTail(d,UHrendererTailLimit),f=UHrendererCurrentKeys?.flatMap",
    "build-7345 current turn window"
  );
  body = replaceOnce(
    body,
    "h=n(zH,a==null?null:{hostId:n(UH,a),threadId:a}),g=a!=null&&m==null?h?.flatMap",
    "h=n(zH,a==null?null:{hostId:n(UH,a),threadId:a}),UHrendererParentLimit=UHrendererTailLimit==null?null:Math.max(0,UHrendererTailLimit-(UHrendererCurrentKeys?.length??0)),UHrendererParentKeys=UHrendererTail(h,UHrendererParentLimit),g=a!=null&&m==null?UHrendererParentKeys?.flatMap",
    "build-7345 parent turn window"
  );
  body = replaceOnce(
    body,
    "turnEntityKeys:d?.map(({entityKey:e})=>e)",
    "turnEntityKeys:UHrendererCurrentKeys?.map(({entityKey:e})=>e)",
    "build-7345 bounded entity keys"
  );
  const names = owner.header.groups;
  const headerAfter = owner.header[0].replace(
    `isBackgroundSubagentsEnabled:${names.background}}`,
    `isBackgroundSubagentsEnabled:${names.background},rendererTailLimit:UHrendererTailLimit}`
  );
  const helper = "UHrendererTail=(e,t)=>e==null||t==null||e.length<=t?e:t<=0?[]:e.slice(-t),";
  const patchedOwner = `${helper}${owner.text.replace(owner.header[0], headerAfter).replace(owner.body, body)}`;
  let patched = replaceOnce(source, owner.text, patchedOwner, "build-7345 renderer selector owner");
  const declaration = selectorDeclaration(source, names.selector, owner.header.index);
  const declaredNames = declaration.names.replace(`,${names.selector},`, `,UHrendererTail,${names.selector},`);
  if (declaredNames === declaration.names) throw new Error("Upstream changed: build-7345 selector declaration shape");
  return replaceOnce(
    patched,
    declaration.text,
    declaration.text.replace(declaration.names, declaredNames),
    "build-7345 renderer selector declarations"
  );
}

function inspectPristineRenderer(source) {
  const owner = rendererOwner(source);
  if (owner.calls !== 4) throw new Error(`Upstream changed: found ${owner.calls} renderer selector calls`);
  if (owner.text.includes("rendererTailLimit:")) {
    throw new Error("Unrecognized renderer component: unexpected tail-limit argument");
  }
}

function inspectAppliedRenderer(source) {
  const owner = rendererOwner(source);
  if (!source.slice(Math.max(0, owner.start - 80), owner.start).includes("const UH_RENDERER_TURN_LIMIT=1500;")) {
    throw new Error("Unrecognized renderer turn window: global limit is not adjacent to its owner");
  }
  if (owner.calls !== 4) throw new Error(`Unrecognized renderer turn window: found ${owner.calls} selector calls`);
  if (count(owner.text, "rendererTailLimit:UH_RENDERER_TURN_LIMIT") !== 4) {
    throw new Error("Unrecognized renderer turn window: not every UI selector call is bounded");
  }
}

function patchRenderer(source) {
  const owner = rendererOwner(source);
  const args = `{conversationId:${owner.conversation},isBackgroundSubagentsEnabled:${owner.background}}`;
  const bounded = `{conversationId:${owner.conversation},isBackgroundSubagentsEnabled:${owner.background},rendererTailLimit:UH_RENDERER_TURN_LIMIT}`;
  if (count(owner.text, args) !== 4) throw new Error("Upstream changed: renderer selector argument ownership is ambiguous");
  const patched = owner.text.split(args).join(bounded);
  return replaceOnce(source, owner.text, `const UH_RENDERER_TURN_LIMIT=1500;${patched}`, "local conversation renderer");
}

function selectorOwner(source) {
  const headerPattern = new RegExp(
    `(?<selector>[$A-Z_a-z][$\\w]*)=(?<factory>[$A-Z_a-z][$\\w]*)\\((?<atom>[$A-Z_a-z][$\\w]*),` +
      `\\(\\{conversationId:(?<conversation>[$A-Z_a-z][$\\w]*),` +
      `isBackgroundSubagentsEnabled:(?<background>[$A-Z_a-z][$\\w]*)` +
      `(?:,rendererTailLimit:(?<limit>[$A-Z_a-z][$\\w]*))?\\},` +
      `\\{get:(?<get>[$A-Z_a-z][$\\w]*)\\}\\)=>\\{`,
    "g"
  );
  const headers = [...source.matchAll(headerPattern)].filter(match => {
    const block = extractBlock(source, match.index + match[0].length - 1);
    return block.text.includes("turnEntityKeys:") && block.text.includes("historyTimeline:");
  });
  if (headers.length !== 1) throw new Error(`Upstream changed: found ${headers.length} renderer selectors`);
  const header = headers[0];
  const block = extractBlock(source, header.index + header[0].length - 1);
  return {
    header,
    body: block.text.slice(1, -1),
    text: source.slice(header.index, block.end + 1)
  };
}

function selectorDeclaration(source, selector, ownerPosition) {
  const id = "[$A-Z_a-z][$\\w]*";
  const pattern = new RegExp(`var (?<names>${id}(?:,${id})*)=(?<initializer>${id})\\(\\(\\(\\)=>\\{`, "g");
  const matches = [...source.matchAll(pattern)].filter(match => {
    if (!match.groups.names.split(",").includes(selector)) return false;
    const open = match.index + match[0].length - 1;
    return ownerPosition > open && ownerPosition < extractBlock(source, open).end;
  });
  if (matches.length !== 1) {
    throw new Error(`Upstream changed: found ${matches.length} selector declaration owners`);
  }
  return { text: matches[0][0], names: matches[0].groups.names };
}

function matchSelectorPrefix(body, names) {
  const id = "[$A-Z_a-z][$\\w]*";
  const pattern = new RegExp(
    `let (?<parent>${id})=${names.background}\\?${names.get}\\((?<parentAtom>${id}),${names.conversation}\\)\\?\\?null:null,` +
      `(?<threadKey>${id})=\\{hostId:${names.get}\\((?<hostAtom>${id}),${names.conversation}\\),threadId:${names.conversation}\\},` +
      `(?<history>${id})=${names.get}\\((?<timelineAtom>${id}),\\k<threadKey>\\),` +
      `(?<timeline>${id})=(?<transient>${id})==null\\?\\k<history>:(?<timelineFromTransient>${id})\\(\\k<transient>\\),` +
      `(?<historyEntries>${id})=(?<historyEntriesFn>${id})\\(\\k<timeline>\\),` +
      `(?<parentHistory>${id})=\\k<parent>==null\\?null:${names.get}\\(\\k<timelineAtom>,\\{hostId:${names.get}\\(\\k<hostAtom>,\\k<parent>\\),threadId:\\k<parent>\\}\\),` +
      `(?<parentHistoryEntries>${id})=\\k<historyEntriesFn>\\(\\k<parentHistory>\\),` +
      `(?<keys>${id})=${names.get}\\((?<keysAtom>${id}),\\k<threadKey>\\),` +
      `(?<turns>${id})=\\k<transient>\\?\\.turns\\?\\?\\k<keys>\\?\\.flatMap`,
    "g"
  );
  return matchUnique(body, pattern, "renderer selector materialization prefix");
}

function matchParentMaterialization(body, names) {
  const id = "[$A-Z_a-z][$\\w]*";
  return matchUnique(
    body,
    new RegExp(
      `(?<parentKeys>${id})=${names.get}\\((?<keysAtom>${id}),(?<parent>${id})==null\\?null:` +
        `\\{hostId:${names.get}\\((?<hostAtom>${id}),\\k<parent>\\),threadId:\\k<parent>\\}\\),` +
        `(?<parentTurns>${id})=\\k<parent>!=null&&(?<inherited>${id})==null\\?\\k<parentKeys>\\?\\.flatMap`,
      "g"
    ),
    "parent turn materialization"
  );
}

function matchSelectorReturn(body) {
  return matchUnique(
    body,
    /return (?<projector>[$A-Z_a-z][$\w]*)\(\{(?<arguments>conversationRequests:[\s\S]{0,4096}?turnEntityKeys:[\s\S]{0,256}?)\}\)$/g,
    "renderer selector return"
  );
}

function inspectTranscriptConsumer(source, selector, applied) {
  const id = "[$A-Z_a-z][$\\w]*";
  const owner = matchUnique(
    source,
    new RegExp(
      `async function ${id}\\(${id},\\{conversationId:${id},isBackgroundSubagentsEnabled:${id},markdownLimit:${id}\\}\\)` +
        `\\{[^}]{0,512}visibleTurnEntries:${id}\\}=${id}\\.get\\(${selector},` +
        `\\{conversationId:${id},isBackgroundSubagentsEnabled:${id}\\}\\);return ${id}\\(`,
      "g"
    ),
    "full transcript selector consumer"
  );
  if (owner[0].includes("rendererTailLimit:")) {
    throw new Error(`Unrecognized renderer turn window: transcript consumer is ${applied ? "bounded" : "changed"}`);
  }
}

function rendererOwner(source) {
  const calls = [...source.matchAll(
    /(?<hook>[$A-Z_a-z][$\w]*)\((?<selector>[$A-Z_a-z][$\w]*),\{conversationId:(?<conversation>[$A-Z_a-z][$\w]*),isBackgroundSubagentsEnabled:(?<background>[$A-Z_a-z][$\w]*)(?:,rendererTailLimit:UH_RENDERER_TURN_LIMIT)?\}\)/g
  )].filter(match => {
      const owner = extractContainingFunction(source, match.index);
      return owner.text.includes("renderEntries:") && owner.text.includes("visibleTurnEntries:");
    });
  if (calls.length === 0) throw new Error("Upstream changed: local conversation renderer selector calls are missing");
  const call = calls[0];
  const owner = extractContainingFunction(source, call.index);
  if (calls.some(match => {
    const candidate = extractContainingFunction(source, match.index);
    return candidate.start !== owner.start || match.groups.conversation !== call.groups.conversation ||
      match.groups.background !== call.groups.background;
  })) {
    throw new Error("Upstream changed: renderer selector call ownership is ambiguous");
  }
  const argsPattern = new RegExp(
    `\\{conversationId:${call.groups.conversation},isBackgroundSubagentsEnabled:${call.groups.background}` +
      `(?:,rendererTailLimit:UH_RENDERER_TURN_LIMIT)?\\}`,
    "g"
  );
  return {
    ...owner,
    conversation: call.groups.conversation,
    background: call.groups.background,
    calls: [...owner.text.matchAll(argsPattern)].length
  };
}

function extractContainingFunction(source, position) {
  let start = source.lastIndexOf("function ", position);
  while (start >= 0) {
    const open = functionBodyOpen(source, start);
    const block = extractBlock(source, open);
    if (position < block.end) return { start, end: block.end, text: source.slice(start, block.end) };
    start = source.lastIndexOf("function ", start - 1);
  }
  throw new Error("Could not locate containing function");
}

function functionBodyOpen(source, start) {
  const parameters = source.indexOf("(", start);
  let depth = 0;
  for (let i = parameters; i < source.length; i += 1) {
    const char = source[i];
    if (char === "(") depth += 1;
    else if (char === ")" && --depth === 0) return source.indexOf("{", i + 1);
  }
  throw new Error("Function parameters did not terminate");
}

function extractBlock(source, open) {
  if (source[open] !== "{") throw new Error("Block start is missing");
  let quote = null;
  let escaped = false;
  let depth = 1;
  for (let i = open + 1; i < source.length; i += 1) {
    const char = source[i];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return { end: i + 1, text: source.slice(open, i + 1) };
  }
  throw new Error("Block did not terminate");
}

function matchUnique(source, pattern, label, predicate = () => true) {
  const matches = [...source.matchAll(pattern)].filter(predicate);
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} matches for ${label}`);
  return matches[0];
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Upstream changed: ${label} is not unique`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function uniqueAsset(pattern, predicate = () => true) {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const matches = fs.readdirSync(assets).filter(name => {
    if (!pattern.test(name)) return false;
    return predicate(fs.readFileSync(path.join(assets, name), "utf8"));
  });
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} assets matching ${pattern}`);
  return path.join(assets, matches[0]);
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
