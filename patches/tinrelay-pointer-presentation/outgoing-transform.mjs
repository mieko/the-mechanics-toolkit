#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const id = "[$A-Z_a-z][$\\w]*";
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: tinrelay-pointer-presentation/outgoing-transform.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const renderer = uniqueFile(/^(?:subagent-activity-chip-group|conversation-blocks)-.*\.js$/);
const activity = uniqueFile(/^agent-activity-item-.*\.js$/);
const main = uniqueFile(/^main-.*\.js$/, path.join(root, ".vite/build"));
const turnRenderer = optionalUniqueFile(/^local-conversation-turn-.*\.js$/);
let rendererSource = fs.readFileSync(renderer, "utf8");
let activitySource = fs.readFileSync(activity, "utf8");
let mainSource = fs.readFileSync(main, "utf8");
let turnSource = turnRenderer == null ? null : fs.readFileSync(turnRenderer, "utf8");
let state = inspectState();
let localShip = pointerDependencyState() === "applied" ? embeddedLocalShip(rendererSource) : null;

if (command === "apply" && state === "legacy-presentation-applied") {
  rendererSource = upgradeOutgoingPresentation(rendererSource);
  fs.writeFileSync(renderer, rendererSource);
  moduleSyntaxCheck(renderer);
  state = inspectState();
  if (!new Set(["legacy-scroll-applied", "legacy-turn-anchor-applied", "legacy-ackless-anchor-applied",
    "legacy-weak-ack-applied", "legacy-source-turn-applied", "applied"]).has(state)) {
    throw new Error("Tinrelay outgoing stock-bubble migration did not verify");
  }
}

if (command === "apply" && state === "legacy-scroll-applied") {
  const hostBus = resolveHostBus(rendererSource);
  rendererSource = replaceOnce(
    rendererSource,
    legacyOutgoingExec(hostBus),
    scrollOutgoingExec(hostBus),
    "Tinrelay outgoing settled scroll"
  );
  fs.writeFileSync(renderer, rendererSource);
  moduleSyntaxCheck(renderer);
  state = inspectState();
  if (state !== "legacy-turn-anchor-applied") throw new Error("Tinrelay outgoing scroll migration did not verify");
}

if (command === "apply" && state === "legacy-turn-anchor-applied") {
  if (localShip == null) throw new Error("Tinrelay presentation requires its incoming transform first");
  rendererSource = upgradeRendererTurnAnchors(rendererSource);
  mainSource = upgradeMainTurnAnchors(mainSource, localShip);
  fs.writeFileSync(renderer, rendererSource);
  fs.writeFileSync(main, mainSource);
  moduleSyntaxCheck(renderer);
  moduleSyntaxCheck(main);
  state = inspectState();
  if (state !== "legacy-ackless-anchor-applied") throw new Error("Tinrelay outgoing turn-anchor migration did not verify");
}

if (command === "apply" && state === "legacy-ackless-anchor-applied") {
  const hostBus = resolveHostBus(rendererSource);
  rendererSource = upgradeRendererAcknowledgedAnchors(rendererSource, hostBus);
  mainSource = upgradeMainAcknowledgedAnchors(mainSource);
  fs.writeFileSync(renderer, rendererSource);
  fs.writeFileSync(main, mainSource);
  moduleSyntaxCheck(renderer);
  moduleSyntaxCheck(main);
  state = inspectState();
  if (!new Set(["legacy-weak-ack-applied", "legacy-source-turn-applied", "applied"]).has(state)) {
    throw new Error("Tinrelay acknowledged-anchor migration did not verify");
  }
}

if (command === "apply" && state === "legacy-weak-ack-applied") {
  const hostBus = resolveHostBus(rendererSource);
  rendererSource = replaceOnce(
    rendererSource,
    previousAcknowledgedOutgoingExec(hostBus),
    currentOutgoingExec(hostBus),
    "Tinrelay persistence-gated renderer acknowledgment"
  );
  mainSource = replaceOnce(
    mainSource,
    previousAcknowledgedMainHandlers(),
    currentMainHandlers(),
    "Tinrelay persistence-gated main acknowledgment"
  );
  fs.writeFileSync(renderer, rendererSource);
  fs.writeFileSync(main, mainSource);
  moduleSyntaxCheck(renderer);
  moduleSyntaxCheck(main);
  state = inspectState();
  if (!new Set(["legacy-source-turn-applied", "applied"]).has(state)) {
    throw new Error("Tinrelay persistence-gated acknowledgment migration did not verify");
  }
}

if (command === "apply" && state === "legacy-source-turn-applied") {
  rendererSource = upgradeRendererSourceTurn(rendererSource);
  fs.writeFileSync(renderer, rendererSource);
  moduleSyntaxCheck(renderer);
  state = inspectState();
  if (state !== "applied") throw new Error("Tinrelay source-turn migration did not verify");
}

if (command === "apply" && state === "needs-apply") {
  if (localShip == null) throw new Error("Tinrelay presentation requires its incoming transform first");
  ({rendererSource, turnSource} = patchRenderer(rendererSource, turnSource));
  activitySource = patchActivity(activitySource, localShip);
  mainSource = patchMain(mainSource, localShip);
  fs.writeFileSync(renderer, rendererSource);
  if (turnRenderer != null) fs.writeFileSync(turnRenderer, turnSource);
  fs.writeFileSync(activity, activitySource);
  fs.writeFileSync(main, mainSource);
  moduleSyntaxCheck(renderer);
  if (turnRenderer != null) moduleSyntaxCheck(turnRenderer);
  moduleSyntaxCheck(activity);
  moduleSyntaxCheck(main);
  state = inspectState();
  if (state !== "applied") throw new Error("Tinrelay outgoing presentation transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  contract: "tinrelay-outgoing-observer-v1",
  source: "ordinary-successful-tinrelay-send",
  localShip,
  targets: [activity, main, renderer, turnRenderer].filter(Boolean).map(file => path.relative(root, file))
}, null, 2)}\n`);

function inspectState() {
  const dependencyState = pointerDependencyState();
  const rendererMarkers = [
    "function MTKtinrelayOutgoingAcceptance(",
    "function MTKtinrelayOutgoingExec(",
    "function MTKtinrelayOutgoingView(",
    "(MTKtinrelayOutgoingExec,{Component:",
    "i.type===`exec`&&MTKtinrelayOutgoingAcceptance(i,MTKtinrelayLocalShip)!=null||"
  ];
  const activityMarkers = [
    "const MTKtinrelayOutgoingLocalShip=",
    "function MTKtinrelayOutgoingAcceptance(",
    "MTKtinrelayOutgoingAcceptance(e,MTKtinrelayOutgoingLocalShip)!=null?`standalone`"
  ];
  const mainMarkers = [
    "const MTKtinrelayOutgoingContract=",
    "function MTKtinrelayStartOutgoingObserver(",
    "function MTKtinrelayOutgoingLookup(",
    "function MTKtinrelayPrepareOutgoingCache(",
    "case`mtk-tinrelay-outgoing-lookup`:"
  ];
  const rendererApplied = rendererMarkers.every(marker => rendererSource.includes(marker));
  const activityApplied = activityMarkers.every(marker => activitySource.includes(marker));
  const mainApplied = mainMarkers.every(marker => mainSource.includes(marker)) &&
    /[$A-Z_a-z][$\w]*\.add\(await MTKtinrelayStartOutgoingObserver\(l\.app\.getPath\("userData"\)\)\)/.test(mainSource);
  if (rendererApplied && activityApplied && mainApplied) {
    if (dependencyState !== "applied") {
      throw new Error("Tinrelay outgoing presentation is applied without its pointer-presentation dependency");
    }
    if (!rendererSource.includes('(MTKtinrelayMessageView,{body:e.body,outgoing:!0,screenReaderStatus:"Accepted by Tinrelay"})')) {
      inspectLegacyAppliedRenderer(rendererSource);
      inspectAppliedActivity(activitySource);
      inspectAppliedMain(mainSource);
      return "legacy-presentation-applied";
    }
    if (!rendererSource.includes("MTKtinrelayScheduleScroll(")) {
      inspectLegacyAppliedRenderer(rendererSource);
      inspectAppliedActivity(activitySource);
      inspectAppliedMain(mainSource);
      return "legacy-scroll-applied";
    }
    if (!rendererSource.includes("function MTKtinrelayOutgoingTurnPresentations(") ||
        !mainSource.includes("function MTKtinrelayOutgoingAnchorRemember(")) {
      inspectAppliedRenderer(rendererSource);
      inspectAppliedActivity(activitySource);
      inspectAppliedMain(mainSource);
      return "legacy-turn-anchor-applied";
    }
    if (rendererSource.includes('dispatchMessage("mtk-tinrelay-outgoing-anchor-remember"') ||
        mainSource.includes("case`mtk-tinrelay-outgoing-anchor-remember`:")) {
      inspectAppliedRenderer(rendererSource);
      inspectAppliedActivity(activitySource);
      inspectAppliedMain(mainSource);
      return "legacy-ackless-anchor-applied";
    }
    const hostBus = resolveHostBus(rendererSource);
    if (rendererSource.includes(previousAcknowledgedOutgoingExec(hostBus)) ||
        mainSource.includes(previousAcknowledgedMainHandlers())) {
      inspectAppliedActivity(activitySource);
      return "legacy-weak-ack-applied";
    }
    const wrapped = findWrappedExecCall(rendererSource);
    const expectedSourceTurn = sourceTurnExpression(
      wrapped.groups.sourceThreadId,
      wrapped.groups.toolActivityTurnKey
    );
    if (wrapped.groups.sourceTurnId !== expectedSourceTurn) {
      if (!new RegExp(`^${id}$`).test(wrapped.groups.sourceTurnId)) {
        throw new Error("Upstream changed: Tinrelay outgoing source-turn expression is not recognized");
      }
      inspectAppliedRenderer(rendererSource);
      inspectAppliedActivity(activitySource);
      inspectAppliedMain(mainSource);
      inspectTurnAnchors(rendererSource, turnSource, mainSource);
      return "legacy-source-turn-applied";
    }
    inspectAppliedRenderer(rendererSource);
    inspectAppliedActivity(activitySource);
    inspectAppliedMain(mainSource);
    inspectTurnAnchors(rendererSource, turnSource, mainSource);
    return "applied";
  }
  if (rendererMarkers.some(marker => rendererSource.includes(marker)) ||
      activityMarkers.some(marker => activitySource.includes(marker)) ||
      mainMarkers.some(marker => mainSource.includes(marker))) {
    throw new Error("Upstream changed: Tinrelay outgoing presentation patch is partial");
  }
  inspectPristineRenderer(rendererSource);
  inspectPristineActivity(activitySource);
  inspectPristineMain(mainSource);
  return "needs-apply";
}

function inspectLegacyAppliedRenderer(source) {
  const helpers = helperSlice(source);
  for (const marker of [
    "function MTKtinrelayOutgoingExec(",
    '.subscribe("mtk-tinrelay-outgoing-result"',
    '.dispatchMessage("mtk-tinrelay-outgoing-lookup"',
    'children:["📡 ",t]',
    'MTKtinrelayAddress(e.author_label,e.sender_ship)',
    'MTKtinrelayAddress(e.attention_label,e.recipient_ship)',
    '"data-mtk-tinrelay-outgoing":!0'
  ]) {
    if (!helpers.includes(marker)) throw new Error(`Tinrelay outgoing legacy postcondition missing: ${marker}`);
  }
}

function pointerDependencyState() {
  const rendererMarkers = [
    "const MTKtinrelayLocalShip=",
    "function MTKtinrelayEnsureStyle()",
    "function MTKtinrelayAddress(",
    "data-mtk-tinrelay-pointer"
  ];
  const mainMarkers = [
    "const MTKtinrelayClient=",
    "function MTKtinrelayMainPointer(",
    "case`mtk-tinrelay-pointer-inspect`:"
  ];
  const present = [...rendererMarkers.map(marker => rendererSource.includes(marker)),
    ...mainMarkers.map(marker => mainSource.includes(marker))];
  if (present.every(Boolean)) return "applied";
  if (present.every(value => !value)) return "absent";
  throw new Error("Upstream changed: Tinrelay pointer-presentation dependency is partial");
}

function inspectPristineRenderer(source) {
  if (findExecComponentCall(source) == null) {
    throw new Error("Upstream changed: exec conversation component seam is not unique");
  }
  persistentClassifier(source);
}

function inspectPristineActivity(source) {
  if (countMatches(source, new RegExp("case`exec`:case`patch`:return " + id + "\\(" + id + "\\(e\\)," + id + "\\(e\\)\\?`standalone`:`groupable`\\);", "g")) !== 1) {
    throw new Error("Upstream changed: exec activity-classification seam is not unique");
  }
}

function inspectPristineMain(source) {
  mainStartup(source);
  if (count(source, "case`electron-add-new-workspace-root-option`:") !== 1) {
    throw new Error("Upstream changed: Tinrelay outgoing main message seam is not unique");
  }
  if (count(source, "var mQ=i.i(`electron-message-handler`)") +
      count(source, "var pQ=i.i(`electron-message-handler`)") +
      count(source, "var fQ=i.i(`electron-message-handler`)") !== 1) {
    throw new Error("Upstream changed: Tinrelay outgoing main helper owner is not unique");
  }
}

function inspectAppliedRenderer(source) {
  const profile = rendererProfile(source);
  const helpers = helperSlice(source);
  for (const marker of [
    'i.state!=="accepted"',
    "MTKtinrelayOutgoingAcceptance(n,MTKtinrelayLocalShip)",
    "i.sender_ship!==t",
    '.subscribe("mtk-tinrelay-outgoing-result"',
    '.dispatchMessage("mtk-tinrelay-outgoing-lookup"',
    'children:["📡 ",t]',
    'className:"flex w-full flex-col items-start justify-start gap-1"',
    `(0,${profile.jsx}.jsx)(MTKtinrelayMessageView,{body:e.body,outgoing:!0,screenReaderStatus:"Accepted by Tinrelay"})`,
    "=MTKtinrelayReact.useRef(null)",
    ".current=MTKtinrelayScrollSnapshot()",
    "MTKtinrelayScheduleScroll("
  ]) {
    if (!helpers.includes(marker)) throw new Error(`Tinrelay outgoing renderer postcondition missing: ${marker}`);
  }
  for (const forbidden of ["dangerouslySetInnerHTML", "innerHTML", "markdown", "eval(", "window.open", "TINRELAY OUTGOING RECEIPT"]) {
    if (helpers.includes(forbidden)) throw new Error(`Tinrelay outgoing renderer uses forbidden surface: ${forbidden}`);
  }
  if (count(source, "(MTKtinrelayOutgoingExec,{Component:") !== 1) {
    throw new Error("Tinrelay outgoing renderer call is not unique");
  }
  if (count(source, "i.type===`exec`&&MTKtinrelayOutgoingAcceptance(i,MTKtinrelayLocalShip)!=null||") !== 1) {
    throw new Error("Tinrelay outgoing collapsed-activity persistence is not unique");
  }
}

function inspectAppliedActivity(source) {
  const helpers = activityHelperSlice(source);
  for (const marker of [
    "const MTKtinrelayOutgoingLocalShip=",
    'i.state!=="accepted"',
    "i.sender_ship!==t",
    "MTKtinrelayOutgoingAcceptance(e,MTKtinrelayOutgoingLocalShip)!=null?`standalone`"
  ]) {
    if (!source.includes(marker)) throw new Error(`Tinrelay outgoing activity postcondition missing: ${marker}`);
  }
  for (const forbidden of ["innerHTML", "eval(", "TINRELAY OUTGOING RECEIPT"]) {
    if (helpers.includes(forbidden)) throw new Error(`Tinrelay outgoing activity parser uses forbidden surface: ${forbidden}`);
  }
}

function inspectAppliedMain(source) {
  const helpers = mainHelperSlice(source);
  for (const marker of [
    '".config","tinrelay",MTKtinrelayOutgoingLocalShip,"outgoing-observer.json"',
    '"mechanics-toolkit","tinrelay",MTKtinrelayOutgoingLocalShip,"outgoing-presentations"',
    'Object.keys(t).sort().join("\\0")!=="socket_path"',
    "(n.mode&63)!==0",
    "MTKtinrelayOutgoingMaxBytes=20480",
    "MTKtinrelayOutgoingUuid",
    'writeFileSync(i,r,{encoding:"utf8",mode:384,flag:"wx"})',
    "renameSync(i,t)",
    "MTKtinrelayPruneOutgoing(t)",
    "MTKtinrelayReadOutgoing(e.transmissionId)",
    'e.contract!==MTKtinrelayOutgoingContract',
    'e.kind!=="transmission"',
    "MTKtinrelayOutgoingEvents.has(e.transmission_id)",
    "MTKtinrelayOutgoingEvents.size>MTKtinrelayOutgoingLimit",
    "setTimeout(()=>",
    "750",
    'createServer(e=>',
    "e.setTimeout(100",
    "n.unref()"
  ]) {
    if (!source.includes(marker)) throw new Error(`Tinrelay outgoing main postcondition missing: ${marker}`);
  }
  for (const forbidden of ["console.", "process.env", 'require("node:child_process")', "execFile(", "spawn(", "appendFile", "TINRELAY OUTGOING RECEIPT"]) {
    if (helpers.includes(forbidden)) throw new Error(`Tinrelay outgoing main helper uses forbidden surface: ${forbidden}`);
  }
  if (countMatches(source, /[$A-Z_a-z][$\w]*\.add\(await MTKtinrelayStartOutgoingObserver\(l\.app\.getPath\("userData"\)\)\)/g) !== 1 ||
      count(source, "case`mtk-tinrelay-outgoing-lookup`:") !== 1) {
    throw new Error("Tinrelay outgoing main integration is not unique");
  }
}

function inspectTurnAnchors(rendererSource, turnSource, mainSource) {
  const helpers = helperSlice(rendererSource);
  for (const marker of [
    "function MTKtinrelayOutgoingTurnPresentations(",
    'dispatchMessage("mtk-tinrelay-outgoing-anchors-list"',
    'subscribe("mtk-tinrelay-outgoing-anchors-result"',
    "MTKtinrelayOutgoingAnchorRecord(t?.anchor)",
    "sourceThreadId:",
    "sourceTurnId:"
  ]) {
    if (!helpers.includes(marker) && !rendererSource.includes(marker)) {
      throw new Error(`Tinrelay outgoing turn-anchor postcondition missing: ${marker}`);
    }
  }
  if (count(rendererSource + (turnSource ?? ""), "(MTKtinrelayOutgoingTurnPresentations,{conversationId:") !== 1) {
    throw new Error("Tinrelay outgoing turn presentation is not unique");
  }
  for (const marker of [
    '"outgoing-anchors"',
    "MTKtinrelayOutgoingAnchorTaskLimit=256",
    "MTKtinrelayOutgoingAnchorTaskMaxBytes=8388608",
    "MTKtinrelayOutgoingAnchorBucketLimit=64",
    "function MTKtinrelayOutgoingAnchorRemember(",
    "function MTKtinrelayOutgoingAnchorsList(",
    "anchor:r",
    "case`mtk-tinrelay-outgoing-anchors-list`:"
  ]) {
    if (!mainSource.includes(marker)) throw new Error(`Tinrelay outgoing main turn-anchor postcondition missing: ${marker}`);
  }
}

function patchRenderer(value, turnValue) {
  const profile = rendererProfile(value);
  const hostBus = resolveHostBus(value);
  const match = findExecComponentCall(value);
  if (match == null) throw new Error("Upstream changed: exec conversation component seam is not unique");
  const context = sourceContextProfile(value, match.index);
  let patched = replaceOnce(
    value,
    match[0],
    `${match.groups.jsx}(MTKtinrelayOutgoingExec,{Component:${match.groups.component},${match.groups.props},sourceThreadId:${context.conversationId},sourceTurnId:${sourceTurnExpression(context.conversationId, match.groups.toolActivityTurnKey)}})`,
    "Tinrelay outgoing conversation component"
  );
  const persistent = persistentClassifier(patched);
  patched = replaceOnce(
    patched,
    persistent[0],
    persistent[0].replace(
      "return i.type===`dynamic-tool-call`",
      "return i.type===`exec`&&MTKtinrelayOutgoingAcceptance(i,MTKtinrelayLocalShip)!=null||i.type===`dynamic-tool-call`"
    ),
    "Tinrelay outgoing collapsed-activity persistence"
  );
  const insertion = patched.indexOf(profile.boundary);
  if (insertion < 0) throw new Error("Upstream changed: delegated-message owner is missing");
  patched = patched.slice(0, insertion) + rendererHelpers(hostBus, profile.jsx) + patched.slice(insertion);
  return patchAssistantPresentations(patched, turnValue, profile);
}

function persistentClassifier(source) {
  return uniqueMatch(
    source,
    /function [$A-Z_a-z][$\w]*\(\{unit:e,keepMcpAppEntriesPersistent:t,mcpServerStatuses:n,renderMcpApps:r\}\)\{if\(e\.kind!==`standalone`\)return!1;let i=e\.item\.item;return i\.type===`dynamic-tool-call`&&[$A-Z_a-z][$\w]*\(i\)\|\|t&&r&&i\.type===`mcp-tool-call`&&[$A-Z_a-z][$\w]*\(\{item:i,mcpServerStatuses:n\}\)\?!0:i\.type===`user-message`&&\(i\.steeringStatus!=null\|\|i\.hookFeedback===!0\)\}/g,
    "collapsed-activity persistence classifier"
  );
}

function findExecComponentCall(source) {
  const patterns = [
    "(?<jsx>\\(0," + id + "\\.jsx\\))\\((?<component>" + id + "),\\{(?<props>item:(?<item>" + id + "),isTurnInProgress:" + id + ",threadDetailLevel:" + id + ",hostId:" + id + ",summaryTone:" + id + ",showSummaryIcon:" + id + ",summaryIcon:" + id + ",hideRawCommand:" + id + ",toolActivityTurnKey:(?<toolActivityTurnKey>" + id + "))\\}\\)",
    "(?<jsx>\\(0," + id + "\\.jsx\\))\\((?<component>" + id + "),\\{(?<props>conversationId:" + id + ",isReadOnly:" + id + ",item:(?<item>" + id + "),isTurnInProgress:" + id + ",threadDetailLevel:" + id + ",hostId:" + id + ",summaryTone:" + id + ",showSummaryIcon:" + id + ",summaryIcon:" + id + ",hideRawCommand:" + id + ",toolActivityTurnKey:(?<toolActivityTurnKey>" + id + "))\\}\\)"
  ];
  const matches = patterns.flatMap(pattern => [...source.matchAll(new RegExp(pattern, "g"))]);
  return matches.length === 1 ? matches[0] : null;
}

function findWrappedExecCall(source) {
  return uniqueMatch(
    source,
    new RegExp(
      `(?<jsx>\\(0,${id}\\.jsx\\))\\(MTKtinrelayOutgoingExec,\\{(?<props>Component:${id},(?:conversationId:${id},isReadOnly:${id},)?item:${id},isTurnInProgress:${id},threadDetailLevel:${id},hostId:${id},summaryTone:${id},showSummaryIcon:${id},summaryIcon:${id},hideRawCommand:${id},toolActivityTurnKey:(?<toolActivityTurnKey>${id})),sourceThreadId:(?<sourceThreadId>${id}),sourceTurnId:(?<sourceTurnId>typeof ${id}==="string"&&${id}\\.startsWith\\(${id}\\+"\\\\0"\\)\\?${id}\\.slice\\(${id}\\.length\\+1\\):void 0|${id})\\}\\)`,
      "g"
    ),
    "Tinrelay wrapped outgoing exec"
  );
}

function sourceTurnExpression(conversationId, toolActivityTurnKey) {
  return `typeof ${toolActivityTurnKey}==="string"&&${toolActivityTurnKey}.startsWith(${conversationId}+"\\0")?${toolActivityTurnKey}.slice(${conversationId}.length+1):void 0`;
}

function upgradeRendererSourceTurn(value) {
  const wrapped = findWrappedExecCall(value);
  const expected = sourceTurnExpression(wrapped.groups.sourceThreadId, wrapped.groups.toolActivityTurnKey);
  if (wrapped.groups.sourceTurnId === expected) return value;
  return replaceOnce(
    value,
    wrapped[0],
    `${wrapped.groups.jsx}(MTKtinrelayOutgoingExec,{${wrapped.groups.props},sourceThreadId:${wrapped.groups.sourceThreadId},sourceTurnId:${expected}})`,
    "Tinrelay durable source turn"
  );
}

function patchActivity(value, ship) {
  const match = uniqueMatch(
    value,
    new RegExp(
      "case`exec`:case`patch`:return (?<wrap>" + id + ")\\((?<clean>" + id + ")\\(e\\),(?<standalone>" + id + ")\\(e\\)\\?`standalone`:`groupable`\\);",
      "g"
    ),
    "exec activity classifier"
  );
  const replacement = `case\`exec\`:return ${match.groups.wrap}(${match.groups.clean}(e),MTKtinrelayOutgoingAcceptance(e,MTKtinrelayOutgoingLocalShip)!=null?\`standalone\`:${match.groups.standalone}(e)?\`standalone\`:\`groupable\`);case\`patch\`:return ${match.groups.wrap}(${match.groups.clean}(e),${match.groups.standalone}(e)?\`standalone\`:\`groupable\`);`;
  let patched = replaceOnce(value, match[0], replacement, "Tinrelay outgoing activity classifier");
  const insertion = patched.indexOf("function ln(");
  if (insertion < 0) throw new Error("Upstream changed: activity classifier owner is missing");
  return patched.slice(0, insertion) + `const MTKtinrelayOutgoingLocalShip=${JSON.stringify(ship)};${acceptanceParser()}` + patched.slice(insertion);
}

function patchMain(value, ship) {
  const helperOwner = ["var mQ=i.i(`electron-message-handler`)", "var pQ=i.i(`electron-message-handler`)", "var fQ=i.i(`electron-message-handler`)"].find(owner => value.includes(owner));
  if (helperOwner == null) throw new Error("Upstream changed: Tinrelay outgoing main helper owner is not recognized");
  let patched = replaceOnce(value, helperOwner, `${mainHelpers(ship)}${helperOwner}`, "Tinrelay outgoing main helper owner");
  patched = replaceOnce(
    patched,
    "case`electron-add-new-workspace-root-option`:",
    `${currentMainHandlers()}case\`electron-add-new-workspace-root-option\`:`,
    "Tinrelay outgoing main message handler"
  );
  const startup = mainStartup(patched);
  return replaceOnce(
    patched,
    startup[0],
    `${startup.groups.prefix}${startup.groups.disposers}.add(await MTKtinrelayStartOutgoingObserver(l.app.getPath("userData"))),${startup.groups.log}`,
    "Tinrelay outgoing observer startup"
  );
}

function rendererHelpers(hostBus, jsx = "Tb") {
  const legacy = legacyAnchorRendererHelpers(hostBus);
  const current = legacy
    .replace(/MTKtinrelayOutgoingAnchorNotify\(t\),[$A-Z_a-z][$\w]*\.dispatchMessage\("mtk-tinrelay-outgoing-anchor-remember",\{record:\{contract:e\.contract,sourceThreadId:e\.sourceThreadId,sourceTurnId:e\.sourceTurnId,transmissionId:e\.transmissionId,recordedAtMs:e\.recordedAtMs\}\}\);return!0/, "MTKtinrelayOutgoingAnchorNotify(t);return!0")
    .replace(legacyAnchorOutgoingExec(hostBus), currentOutgoingExec(hostBus));
  if (current === legacy || current.includes('dispatchMessage("mtk-tinrelay-outgoing-anchor-remember"') ||
      !current.includes("MTKtinrelayOutgoingAnchorRecord(t?.anchor)")) {
    throw new Error("Tinrelay acknowledged renderer helper construction failed");
  }
  const upgraded = jsxDialect(upgradeOutgoingPresentation(current), jsx);
  const insertion = upgraded.indexOf("function MTKtinrelayOutgoingExec(");
  if (insertion < 0) throw new Error("Tinrelay live-anchor renderer helper construction failed");
  return upgraded.slice(0, insertion) + liveAnchorResultSubscription(hostBus) + upgraded.slice(insertion);
}

function liveAnchorResultSubscription(hostBus) {
  return `${hostBus}.subscribe("mtk-tinrelay-outgoing-result",e=>{let t=MTKtinrelayOutgoingAnchorRecord(e?.anchor);t!=null&&MTKtinrelayOutgoingAnchorRemember(t)});`;
}

function upgradeOutgoingPresentation(value) {
  const start = value.indexOf("function MTKtinrelayOutgoingView(");
  const owner = functionAt(value, start);
  const current = outgoingView();
  if (owner.text === current) return value;
  for (const marker of [
    '"data-mtk-tinrelay-pointer":!0',
    '"data-mtk-tinrelay-outgoing":!0',
    '(0,Tb.jsx)(rg,{text:e.body,cwd:null,hostId:"local",collapsedLineCount:6})'
  ]) {
    if (!owner.text.includes(marker)) {
      throw new Error(`Upstream changed: Tinrelay outgoing custom-card owner is missing ${marker}`);
    }
  }
  return value.slice(0, owner.start) + current + value.slice(owner.end);
}

function outgoingView() {
  return 'function MTKtinrelayOutgoingView({event:e}){let n=MTKtinrelayAddress(e.author_label,e.sender_ship),r=MTKtinrelayAddress(e.attention_label,e.recipient_ship),t=n+" → "+r;return(0,Tb.jsxs)("div",{className:"flex w-full flex-col items-start justify-start gap-1",children:[(0,Tb.jsxs)("div",{className:"text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description",children:["📡 ",t]}),(0,Tb.jsx)(MTKtinrelayMessageView,{body:e.body,outgoing:!0,screenReaderStatus:"Accepted by Tinrelay"})]})}';
}

function legacyAnchorRendererHelpers(hostBus) {
  return `${acceptanceParser()}function MTKtinrelayOutgoingMatches(e,t){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&e.contract==="tinrelay-outgoing-observer-v1"&&e.kind==="transmission"&&e.transmission_id===t.transmission_id&&e.sender_ship===t.sender_ship&&e.recipient_ship===t.recipient_ship&&typeof e.attention_label==="string"&&(e.author_label===null||typeof e.author_label==="string"&&e.author_label.length>0)&&typeof e.body==="string"}const MTKtinrelayOutgoingAnchorContract="tinrelay-outgoing-anchor-v1",MTKtinrelayOutgoingAnchorLimit=256,MTKtinrelayOutgoingAnchorUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,MTKtinrelayOutgoingAnchorStates=new Map,MTKtinrelayOutgoingAnchorRequests=new Map;function MTKtinrelayOutgoingAnchorRecord(e){if(e==null||typeof e!=="object"||Array.isArray(e)||Object.keys(e).sort().join("\\0")!=="contract\\0event\\0recordedAtMs\\0sourceThreadId\\0sourceTurnId\\0transmissionId"||e.contract!==MTKtinrelayOutgoingAnchorContract||typeof e.sourceThreadId!=="string"||e.sourceThreadId.length===0||typeof e.sourceTurnId!=="string"||e.sourceTurnId.length===0||typeof e.transmissionId!=="string"||!MTKtinrelayOutgoingAnchorUuid.test(e.transmissionId)||!Number.isSafeInteger(e.recordedAtMs)||e.recordedAtMs<=0||!MTKtinrelayOutgoingMatches(e.event,{transmission_id:e.transmissionId,sender_ship:MTKtinrelayLocalShip,recipient_ship:e.event?.recipient_ship}))return null;return e}function MTKtinrelayOutgoingAnchorState(e){let t=MTKtinrelayOutgoingAnchorStates.get(e);return t==null&&(t={loaded:!1,loading:!1,records:new Map,listeners:new Set},MTKtinrelayOutgoingAnchorStates.set(e,t)),t}function MTKtinrelayOutgoingAnchorValues(e){return[...e.records.values()].sort((e,t)=>e.recordedAtMs-t.recordedAtMs||e.transmissionId.localeCompare(t.transmissionId))}function MTKtinrelayOutgoingAnchorNotify(e){let t=MTKtinrelayOutgoingAnchorValues(e);for(let n of e.listeners)n(t)}function MTKtinrelayOutgoingAnchorRemember(e){if((e=MTKtinrelayOutgoingAnchorRecord(e))==null)return!1;let t=MTKtinrelayOutgoingAnchorState(e.sourceThreadId),n=t.records.get(e.transmissionId);if(n!=null)return JSON.stringify(n)===JSON.stringify(e);t.records.set(e.transmissionId,e);let r=MTKtinrelayOutgoingAnchorValues(t);for(let e of r.slice(0,Math.max(0,r.length-MTKtinrelayOutgoingAnchorLimit)))t.records.delete(e.transmissionId);MTKtinrelayOutgoingAnchorNotify(t),${hostBus}.dispatchMessage("mtk-tinrelay-outgoing-anchor-remember",{record:{contract:e.contract,sourceThreadId:e.sourceThreadId,sourceTurnId:e.sourceTurnId,transmissionId:e.transmissionId,recordedAtMs:e.recordedAtMs}});return!0}function MTKtinrelayOutgoingAnchorsLoad(e){let t=MTKtinrelayOutgoingAnchorState(e);if(t.loaded||t.loading)return;t.loading=!0;let n=crypto.randomUUID();MTKtinrelayOutgoingAnchorRequests.set(n,e),${hostBus}.dispatchMessage("mtk-tinrelay-outgoing-anchors-list",{requestId:n,sourceThreadId:e})}${hostBus}.subscribe("mtk-tinrelay-outgoing-anchors-result",e=>{if(typeof e?.requestId!=="string")return;let t=MTKtinrelayOutgoingAnchorRequests.get(e.requestId);if(t==null)return;MTKtinrelayOutgoingAnchorRequests.delete(e.requestId);let n=MTKtinrelayOutgoingAnchorState(t);n.loading=!1,n.loaded=!0;if(e.ok===!0&&Array.isArray(e.records))for(let r of e.records){r=MTKtinrelayOutgoingAnchorRecord(r);r!=null&&r.sourceThreadId===t&&!n.records.has(r.transmissionId)&&n.records.set(r.transmissionId,r)}MTKtinrelayOutgoingAnchorNotify(n)});${legacyAnchorOutgoingExec(hostBus)}function MTKtinrelayOutgoingTurnPresentations({conversationId:e,turnId:t}){let n=typeof e==="string"&&e.length>0&&typeof t==="string"&&t.length>0,r=n?MTKtinrelayOutgoingAnchorState(e):null,[i,a]=MTKtinrelayReact.useState(()=>r==null?[]:MTKtinrelayOutgoingAnchorValues(r).filter(e=>e.sourceTurnId===t));return MTKtinrelayReact.useEffect(()=>{if(r==null)return;let n=e=>a(e.filter(e=>e.sourceTurnId===t));return r.listeners.add(n),MTKtinrelayOutgoingAnchorsLoad(e),n(MTKtinrelayOutgoingAnchorValues(r)),()=>r.listeners.delete(n)},[e,t,r]),i.length===0?null:(0,Tb.jsx)("div",{"data-mtk-tinrelay-outgoing-turn":!0,className:"mb-3 flex min-w-0 flex-col items-start gap-2",children:i.map(e=>(0,Tb.jsx)(MTKtinrelayOutgoingView,{event:e.event},e.transmissionId))})}function MTKtinrelayOutgoingView({event:e}){MTKtinrelayEnsureStyle();let n=MTKtinrelayAddress(e.author_label,e.sender_ship),r=MTKtinrelayAddress(e.attention_label,e.recipient_ship),t=n+" → "+r;return(0,Tb.jsxs)("div",{className:"flex w-full flex-col items-start justify-start gap-1",children:[(0,Tb.jsxs)("div",{className:"text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description",children:["📡 ",t]}),(0,Tb.jsxs)("div",{"data-mtk-tinrelay-pointer":!0,"data-mtk-tinrelay-outgoing":!0,className:"mtk-tinrelay-signal flex min-w-0 flex-col gap-2 rounded-xl border px-3 py-2 text-start",style:{maxWidth:"min(38rem,86%)"},children:[(0,Tb.jsx)("span",{"aria-label":"Accepted by Tinrelay",className:"sr-only",children:"Accepted by Tinrelay"}),(0,Tb.jsx)("div",{className:"mtk-tinrelay-body min-w-0 px-2",children:(0,Tb.jsx)(rg,{text:e.body,cwd:null,hostId:"local",collapsedLineCount:6})})]})]})}`;
}

function legacyOutgoingExec(hostBus) {
  return `function MTKtinrelayOutgoingExec(e){let{Component:t,item:n,...r}=e,i=MTKtinrelayOutgoingAcceptance(n,MTKtinrelayLocalShip),[a,o]=MTKtinrelayReact.useState(null);return MTKtinrelayReact.useEffect(()=>{if(i==null)return;let e=crypto.randomUUID(),t=${hostBus}.subscribe("mtk-tinrelay-outgoing-result",t=>{t?.requestId===e&&o(t.ok===!0&&MTKtinrelayOutgoingMatches(t.event,i)?t.event:null)});return ${hostBus}.dispatchMessage("mtk-tinrelay-outgoing-lookup",{requestId:e,transmissionId:i.transmission_id,senderShip:i.sender_ship,recipientShip:i.recipient_ship}),t},[i?.transmission_id,i?.sender_ship,i?.recipient_ship]),i!=null&&MTKtinrelayOutgoingMatches(a,i)?(0,Tb.jsx)(MTKtinrelayOutgoingView,{event:a}):(0,Tb.jsx)(t,{item:n,...r})}`;
}

function scrollOutgoingExec(hostBus) {
  return `function MTKtinrelayOutgoingExec(e){let{Component:t,item:n,...r}=e,i=MTKtinrelayOutgoingAcceptance(n,MTKtinrelayLocalShip),[a,o]=MTKtinrelayReact.useState(null),s=MTKtinrelayReact.useRef(null);return MTKtinrelayReact.useEffect(()=>{if(i==null)return;s.current=MTKtinrelayScrollSnapshot();let e=crypto.randomUUID(),t=${hostBus}.subscribe("mtk-tinrelay-outgoing-result",t=>{if(t?.requestId!==e)return;let n=t.ok===!0&&MTKtinrelayOutgoingMatches(t.event,i)?t.event:null;o(n),n!=null&&MTKtinrelayScheduleScroll(s.current)});return ${hostBus}.dispatchMessage("mtk-tinrelay-outgoing-lookup",{requestId:e,transmissionId:i.transmission_id,senderShip:i.sender_ship,recipientShip:i.recipient_ship}),t},[i?.transmission_id,i?.sender_ship,i?.recipient_ship]),i!=null&&MTKtinrelayOutgoingMatches(a,i)?(0,Tb.jsx)(MTKtinrelayOutgoingView,{event:a}):(0,Tb.jsx)(t,{item:n,...r})}`;
}

function legacyAnchorOutgoingExec(hostBus) {
  return `function MTKtinrelayOutgoingExec(e){let{Component:t,item:n,sourceThreadId:r,sourceTurnId:i,...a}=e,o=MTKtinrelayOutgoingAcceptance(n,MTKtinrelayLocalShip),[s,c]=MTKtinrelayReact.useState(null),l=MTKtinrelayReact.useRef(null);return MTKtinrelayReact.useEffect(()=>{if(o==null)return;l.current=MTKtinrelayScrollSnapshot();let e=crypto.randomUUID(),t=${hostBus}.subscribe("mtk-tinrelay-outgoing-result",t=>{if(t?.requestId!==e)return;let n=t.ok===!0&&MTKtinrelayOutgoingMatches(t.event,o)?t.event:null;c(n),n!=null&&(typeof r==="string"&&r.length>0&&typeof i==="string"&&i.length>0&&MTKtinrelayOutgoingAnchorRemember({contract:MTKtinrelayOutgoingAnchorContract,sourceThreadId:r,sourceTurnId:i,transmissionId:n.transmission_id,recordedAtMs:Date.now(),event:n}),MTKtinrelayScheduleScroll(l.current))});return ${hostBus}.dispatchMessage("mtk-tinrelay-outgoing-lookup",{requestId:e,transmissionId:o.transmission_id,senderShip:o.sender_ship,recipientShip:o.recipient_ship}),t},[o?.transmission_id,o?.sender_ship,o?.recipient_ship,r,i]),o!=null&&MTKtinrelayOutgoingMatches(s,o)?typeof r==="string"&&r.length>0&&typeof i==="string"&&i.length>0?null:(0,Tb.jsx)(MTKtinrelayOutgoingView,{event:s}):(0,Tb.jsx)(t,{item:n,...a})}`;
}

function currentOutgoingExec(hostBus) {
  return `function MTKtinrelayOutgoingExec(e){let{Component:t,item:n,sourceThreadId:r,sourceTurnId:i,...a}=e,o=MTKtinrelayOutgoingAcceptance(n,MTKtinrelayLocalShip),[s,c]=MTKtinrelayReact.useState(null),l=MTKtinrelayReact.useRef(null);return MTKtinrelayReact.useEffect(()=>{if(o==null)return;l.current=MTKtinrelayScrollSnapshot();let e=crypto.randomUUID(),t=${hostBus}.subscribe("mtk-tinrelay-outgoing-result",t=>{if(t?.requestId!==e)return;let n=t.ok===!0&&MTKtinrelayOutgoingMatches(t.event,o)?t.event:null,a=MTKtinrelayOutgoingAnchorRecord(t?.anchor),s=typeof r==="string"&&r.length>0&&typeof i==="string"&&i.length>0;c(s&&a==null?null:n),a!=null&&MTKtinrelayOutgoingAnchorRemember(a),n!=null&&(!s||a!=null)&&MTKtinrelayScheduleScroll(l.current)});return ${hostBus}.dispatchMessage("mtk-tinrelay-outgoing-lookup",{requestId:e,transmissionId:o.transmission_id,senderShip:o.sender_ship,recipientShip:o.recipient_ship,sourceThreadId:r,sourceTurnId:i}),t},[o?.transmission_id,o?.sender_ship,o?.recipient_ship,r,i]),o!=null&&MTKtinrelayOutgoingMatches(s,o)?typeof r==="string"&&r.length>0&&typeof i==="string"&&i.length>0?null:(0,Tb.jsx)(MTKtinrelayOutgoingView,{event:s}):(0,Tb.jsx)(t,{item:n,...a})}`;
}

function previousAcknowledgedOutgoingExec(hostBus) {
  return `function MTKtinrelayOutgoingExec(e){let{Component:t,item:n,sourceThreadId:r,sourceTurnId:i,...a}=e,o=MTKtinrelayOutgoingAcceptance(n,MTKtinrelayLocalShip),[s,c]=MTKtinrelayReact.useState(null),l=MTKtinrelayReact.useRef(null);return MTKtinrelayReact.useEffect(()=>{if(o==null)return;l.current=MTKtinrelayScrollSnapshot();let e=crypto.randomUUID(),t=${hostBus}.subscribe("mtk-tinrelay-outgoing-result",t=>{if(t?.requestId!==e)return;let n=t.ok===!0&&MTKtinrelayOutgoingMatches(t.event,o)?t.event:null,r=MTKtinrelayOutgoingAnchorRecord(t?.anchor);c(n),r!=null&&MTKtinrelayOutgoingAnchorRemember(r),n!=null&&MTKtinrelayScheduleScroll(l.current)});return ${hostBus}.dispatchMessage("mtk-tinrelay-outgoing-lookup",{requestId:e,transmissionId:o.transmission_id,senderShip:o.sender_ship,recipientShip:o.recipient_ship,sourceThreadId:r,sourceTurnId:i}),t},[o?.transmission_id,o?.sender_ship,o?.recipient_ship,r,i]),o!=null&&MTKtinrelayOutgoingMatches(s,o)?typeof r==="string"&&r.length>0&&typeof i==="string"&&i.length>0?null:(0,Tb.jsx)(MTKtinrelayOutgoingView,{event:s}):(0,Tb.jsx)(t,{item:n,...a})}`;
}

function currentMainHandlers() {
  return "case`mtk-tinrelay-outgoing-lookup`:{let n=await MTKtinrelayOutgoingLookup(t),r=n==null?null:MTKtinrelayOutgoingAnchorRemember({contract:MTKtinrelayOutgoingAnchorContract,sourceThreadId:t?.sourceThreadId,sourceTurnId:t?.sourceTurnId,transmissionId:n.transmission_id,recordedAtMs:Date.now()}),i=typeof t?.sourceThreadId===`string`&&t.sourceThreadId.length>0&&typeof t?.sourceTurnId===`string`&&t.sourceTurnId.length>0;this.windowManager.sendMessageToWebContents(e,{type:`mtk-tinrelay-outgoing-result`,requestId:typeof t?.requestId===`string`?t.requestId:``,ok:n!=null&&(!i||r!=null),event:n,anchor:r});break}case`mtk-tinrelay-outgoing-anchors-list`:{let n=MTKtinrelayOutgoingAnchorsList(t?.sourceThreadId);this.windowManager.sendMessageToWebContents(e,{type:`mtk-tinrelay-outgoing-anchors-result`,requestId:typeof t?.requestId===`string`?t.requestId:``,ok:n!=null,records:n??[]});break}";
}

function previousAcknowledgedMainHandlers() {
  return "case`mtk-tinrelay-outgoing-lookup`:{let n=await MTKtinrelayOutgoingLookup(t),r=n==null?null:MTKtinrelayOutgoingAnchorRemember({contract:MTKtinrelayOutgoingAnchorContract,sourceThreadId:t?.sourceThreadId,sourceTurnId:t?.sourceTurnId,transmissionId:n.transmission_id,recordedAtMs:Date.now()});this.windowManager.sendMessageToWebContents(e,{type:`mtk-tinrelay-outgoing-result`,requestId:typeof t?.requestId===`string`?t.requestId:``,ok:n!=null,event:n,anchor:r});break}case`mtk-tinrelay-outgoing-anchors-list`:{let n=MTKtinrelayOutgoingAnchorsList(t?.sourceThreadId);this.windowManager.sendMessageToWebContents(e,{type:`mtk-tinrelay-outgoing-anchors-result`,requestId:typeof t?.requestId===`string`?t.requestId:``,ok:n!=null,records:n??[]});break}";
}

function legacyAnchorMainHandlers() {
  return "case`mtk-tinrelay-outgoing-lookup`:{let n=await MTKtinrelayOutgoingLookup(t);this.windowManager.sendMessageToWebContents(e,{type:`mtk-tinrelay-outgoing-result`,requestId:typeof t.requestId===`string`?t.requestId:``,ok:n!=null,event:n});break}case`mtk-tinrelay-outgoing-anchor-remember`:{MTKtinrelayOutgoingAnchorRemember(t?.record);break}case`mtk-tinrelay-outgoing-anchors-list`:{let n=MTKtinrelayOutgoingAnchorsList(t?.sourceThreadId);this.windowManager.sendMessageToWebContents(e,{type:`mtk-tinrelay-outgoing-anchors-result`,requestId:typeof t?.requestId===`string`?t.requestId:``,ok:n!=null,records:n??[]});break}";
}

function acceptanceParser() {
  return `function MTKtinrelayOutgoingAcceptance(e,t){let n=e?.output;if(n==null||n.exitCode!==0||typeof n.aggregatedOutput!=="string"||n.aggregatedOutput.includes("\\r"))return null;let r=n.aggregatedOutput.endsWith("\\n")?n.aggregatedOutput.slice(0,-1):n.aggregatedOutput;if(r.includes("\\n")||new TextEncoder().encode(r).length>20480)return null;let i;try{i=JSON.parse(r)}catch{return null}if(i==null||typeof i!=="object"||Array.isArray(i)||Object.keys(i).sort().join("\\0")!=="recipient_ship\\0sender_ship\\0state\\0transmission_id"||i.state!=="accepted"||i.sender_ship!==t||typeof i.recipient_ship!=="string"||i.recipient_ship.length===0||typeof i.transmission_id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(i.transmission_id))return null;return i}`;
}

function legacyMainHelpers(ship) {
  return String.raw`const MTKtinrelayOutgoingContract="tinrelay-outgoing-observer-v1",MTKtinrelayOutgoingLocalShip=${JSON.stringify(ship)},MTKtinrelayOutgoingMaxBytes=20480,MTKtinrelayOutgoingLimit=256,MTKtinrelayOutgoingUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,MTKtinrelayOutgoingEvents=new Map,MTKtinrelayOutgoingWaiters=new Map,MTKtinrelayOutgoingFs=require("node:fs"),MTKtinrelayOutgoingNet=require("node:net"),MTKtinrelayOutgoingOs=require("node:os"),MTKtinrelayOutgoingPath=require("node:path"),MTKtinrelayOutgoingCrypto=require("node:crypto");let MTKtinrelayOutgoingCacheDir=null;
function MTKtinrelayOutgoingConfig(){let e=MTKtinrelayOutgoingPath.join(MTKtinrelayOutgoingOs.homedir(),".config","tinrelay",MTKtinrelayOutgoingLocalShip,"outgoing-observer.json"),t;try{t=JSON.parse(MTKtinrelayOutgoingFs.readFileSync(e,"utf8"))}catch{return null}if(t==null||typeof t!=="object"||Array.isArray(t)||Object.keys(t).sort().join("\0")!=="socket_path"||typeof t.socket_path!=="string"||!MTKtinrelayOutgoingPath.isAbsolute(t.socket_path))return null;let n;try{n=MTKtinrelayOutgoingFs.statSync(MTKtinrelayOutgoingPath.dirname(t.socket_path))}catch{return null}return!n.isDirectory()||(n.mode&63)!==0?null:t.socket_path}
function MTKtinrelayOutgoingEvent(e){if(e==null||typeof e!=="object"||Array.isArray(e)||Object.keys(e).sort().join("\0")!=="attention_label\0author_label\0body\0contract\0kind\0recipient_ship\0sender_ship\0transmission_id"||e.contract!==MTKtinrelayOutgoingContract||e.kind!=="transmission"||typeof e.transmission_id!=="string"||!MTKtinrelayOutgoingUuid.test(e.transmission_id)||e.sender_ship!==MTKtinrelayOutgoingLocalShip||typeof e.recipient_ship!=="string"||e.recipient_ship.length===0||typeof e.attention_label!=="string"||e.author_label!==null&&(typeof e.author_label!=="string"||e.author_label.length===0)||typeof e.body!=="string")return null;return e}
function MTKtinrelayPrepareOutgoingCache(e){MTKtinrelayOutgoingCacheDir=null;if(typeof e!=="string"||!MTKtinrelayOutgoingPath.isAbsolute(e))return;let t=MTKtinrelayOutgoingPath.join(e,"mechanics-toolkit","tinrelay",MTKtinrelayOutgoingLocalShip,"outgoing-presentations");try{MTKtinrelayOutgoingFs.mkdirSync(t,{recursive:!0,mode:448}),MTKtinrelayOutgoingFs.chmodSync(t,448);let e=MTKtinrelayOutgoingFs.lstatSync(t);e.isDirectory()&&(e.mode&63)===0&&(MTKtinrelayOutgoingCacheDir=t)}catch{}}
function MTKtinrelayOutgoingCachePath(e){return MTKtinrelayOutgoingCacheDir==null||!MTKtinrelayOutgoingUuid.test(e)?null:MTKtinrelayOutgoingPath.join(MTKtinrelayOutgoingCacheDir,e+".json")}
function MTKtinrelayReadOutgoing(e){let t=MTKtinrelayOutgoingCachePath(e);if(t==null)return null;let n,r;try{n=MTKtinrelayOutgoingFs.lstatSync(t);if(!n.isFile()||(n.mode&63)!==0||n.size<2||n.size>MTKtinrelayOutgoingMaxBytes)return null;r=MTKtinrelayOutgoingFs.readFileSync(t,"utf8")}catch{return null}if(!r.endsWith("\n")||r.slice(0,-1).includes("\n")||r.includes("\r"))return null;let i;try{i=JSON.parse(r.slice(0,-1))}catch{return null}return i=MTKtinrelayOutgoingEvent(i),i?.transmission_id===e?i:null}
function MTKtinrelayPruneOutgoing(e){if(MTKtinrelayOutgoingCacheDir==null)return;let t=[];try{for(let n of MTKtinrelayOutgoingFs.readdirSync(MTKtinrelayOutgoingCacheDir)){let r=/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/.exec(n);if(r==null)continue;let i=MTKtinrelayOutgoingPath.join(MTKtinrelayOutgoingCacheDir,n),a=MTKtinrelayOutgoingFs.lstatSync(i);a.isFile()&&t.push({path:i,mtime:a.mtimeMs})}}catch{return}t.sort((t,n)=>t.path===e?1:n.path===e?-1:t.mtime-n.mtime||t.path.localeCompare(n.path));for(;t.length>MTKtinrelayOutgoingLimit;){let e=t.shift();try{MTKtinrelayOutgoingFs.unlinkSync(e.path)}catch{}}}
function MTKtinrelayWriteOutgoing(e){let t=MTKtinrelayOutgoingCachePath(e.transmission_id);if(t==null)return e;let n=MTKtinrelayReadOutgoing(e.transmission_id);if(n!=null)return n;let r=JSON.stringify(e)+"\n";if(Buffer.byteLength(r,"utf8")>MTKtinrelayOutgoingMaxBytes)return e;let i=MTKtinrelayOutgoingPath.join(MTKtinrelayOutgoingCacheDir,"."+e.transmission_id+"."+process.pid+"."+MTKtinrelayOutgoingCrypto.randomUUID()+".tmp");try{MTKtinrelayOutgoingFs.writeFileSync(i,r,{encoding:"utf8",mode:384,flag:"wx"}),MTKtinrelayOutgoingFs.renameSync(i,t),MTKtinrelayPruneOutgoing(t);let n=MTKtinrelayReadOutgoing(e.transmission_id);return n??e}catch{try{MTKtinrelayOutgoingFs.unlinkSync(i)}catch{}return e}}
function MTKtinrelayRememberOutgoing(e){if(!MTKtinrelayOutgoingEvents.has(e.transmission_id)){e=MTKtinrelayWriteOutgoing(e),MTKtinrelayOutgoingEvents.set(e.transmission_id,e);if(MTKtinrelayOutgoingEvents.size>MTKtinrelayOutgoingLimit)MTKtinrelayOutgoingEvents.delete(MTKtinrelayOutgoingEvents.keys().next().value)}let t=MTKtinrelayOutgoingWaiters.get(e.transmission_id);if(t!=null){MTKtinrelayOutgoingWaiters.delete(e.transmission_id);let n=MTKtinrelayOutgoingEvents.get(e.transmission_id);for(let r of t)r(n)}}
function MTKtinrelayOutgoingLookup(e){if(typeof e?.requestId!=="string"||typeof e.transmissionId!=="string"||!MTKtinrelayOutgoingUuid.test(e.transmissionId)||e.senderShip!==MTKtinrelayOutgoingLocalShip||typeof e.recipientShip!=="string"||e.recipientShip.length===0)return Promise.resolve(null);let t=MTKtinrelayOutgoingEvents.get(e.transmissionId);if(t==null&&(t=MTKtinrelayReadOutgoing(e.transmissionId),t!=null)){MTKtinrelayOutgoingEvents.set(e.transmissionId,t);if(MTKtinrelayOutgoingEvents.size>MTKtinrelayOutgoingLimit)MTKtinrelayOutgoingEvents.delete(MTKtinrelayOutgoingEvents.keys().next().value)}if(t!=null)return Promise.resolve(t.sender_ship===e.senderShip&&t.recipient_ship===e.recipientShip?t:null);return new Promise(t=>{let n=r=>{clearTimeout(i),t(r!=null&&r.sender_ship===e.senderShip&&r.recipient_ship===e.recipientShip?r:null)},r=MTKtinrelayOutgoingWaiters.get(e.transmissionId);r==null&&(r=new Set,MTKtinrelayOutgoingWaiters.set(e.transmissionId,r)),r.add(n);let i=setTimeout(()=>{r.delete(n),r.size===0&&MTKtinrelayOutgoingWaiters.delete(e.transmissionId),t(null)},750)})}
function MTKtinrelayOutgoingConnection(e){let t=[],n=0,r=!1;e.setTimeout(100,()=>e.destroy()),e.on("data",s=>{if(r)return;n+=s.length,n>MTKtinrelayOutgoingMaxBytes?(r=!0,e.destroy()):t.push(s)}),e.on("end",()=>{if(r)return;let e;try{e=new TextDecoder("utf-8",{fatal:!0}).decode(Buffer.concat(t))}catch{return}if(!e.endsWith("\n")||e.slice(0,-1).includes("\n")||e.includes("\r"))return;let n;try{n=JSON.parse(e.slice(0,-1))}catch{return}n=MTKtinrelayOutgoingEvent(n),n!=null&&MTKtinrelayRememberOutgoing(n)}),e.on("error",()=>{})}
function MTKtinrelayOutgoingProbe(e){return new Promise(t=>{let n=!1,r=MTKtinrelayOutgoingNet.createConnection(e),i=setTimeout(()=>{n||(n=!0,r.destroy(),t("active"))},50),a=e=>{n||(n=!0,clearTimeout(i),r.destroy(),t(e))};r.once("connect",()=>a("active")),r.once("error",e=>a(e?.code==="ECONNREFUSED"||e?.code==="ENOENT"?"stale":"active"))})}
async function MTKtinrelayStartOutgoingObserver(e){MTKtinrelayPrepareOutgoingCache(e);let t=MTKtinrelayOutgoingConfig();if(t==null)return()=>{};let n;try{n=MTKtinrelayOutgoingFs.lstatSync(t)}catch(e){if(e?.code!=="ENOENT")return()=>{}}if(n!=null){if(!n.isSocket()||await MTKtinrelayOutgoingProbe(t)!=="stale")return()=>{};try{MTKtinrelayOutgoingFs.unlinkSync(t)}catch{return()=>{}}}return new Promise(e=>{let n=MTKtinrelayOutgoingNet.createServer(e=>MTKtinrelayOutgoingConnection(e)),r=!1,i=!1,a=null,o=()=>{if(i)return;i=!0;for(let e of MTKtinrelayOutgoingWaiters.values())for(let t of e)t(null);MTKtinrelayOutgoingWaiters.clear(),n.close(()=>{});if(a!=null)try{let e=MTKtinrelayOutgoingFs.lstatSync(t);e.isSocket()&&e.dev===a.dev&&e.ino===a.ino&&MTKtinrelayOutgoingFs.unlinkSync(t)}catch{}};n.on("error",()=>{r||(r=!0,e(()=>{}))}),n.listen(t,()=>{if(r)return;try{let s=MTKtinrelayOutgoingFs.lstatSync(t);if(!s.isSocket()){r=!0,n.close(()=>{}),e(()=>{});return}a={dev:s.dev,ino:s.ino}}catch{r=!0,n.close(()=>{}),e(()=>{});return}n.unref(),r=!0,e(o)})})}`;
}

function mainHelpers(ship) {
  const observer = legacyMainHelpers(ship).replace(
    "function MTKtinrelayPrepareOutgoingCache(e){MTKtinrelayOutgoingCacheDir=null;",
    "function MTKtinrelayPrepareOutgoingCache(e){MTKtinrelayOutgoingCacheDir=null;MTKtinrelayPrepareOutgoingAnchors(e);"
  );
  return observer + String.raw`
const MTKtinrelayOutgoingAnchorContract="tinrelay-outgoing-anchor-v1",MTKtinrelayOutgoingAnchorBucketContract="tinrelay-outgoing-anchor-bucket-v1",MTKtinrelayOutgoingAnchorTaskLimit=256,MTKtinrelayOutgoingAnchorTaskMaxBytes=8388608,MTKtinrelayOutgoingAnchorBucketLimit=64;let MTKtinrelayOutgoingAnchorDir=null;
function MTKtinrelayOutgoingAnchorInput(e){if(e==null||typeof e!=="object"||Array.isArray(e)||Object.keys(e).sort().join("\0")!=="contract\0recordedAtMs\0sourceThreadId\0sourceTurnId\0transmissionId"||e.contract!==MTKtinrelayOutgoingAnchorContract||typeof e.sourceThreadId!=="string"||e.sourceThreadId.length===0||e.sourceThreadId.length>512||typeof e.sourceTurnId!=="string"||e.sourceTurnId.length===0||e.sourceTurnId.length>512||typeof e.transmissionId!=="string"||!MTKtinrelayOutgoingUuid.test(e.transmissionId)||!Number.isSafeInteger(e.recordedAtMs)||e.recordedAtMs<=0)return null;return e}
function MTKtinrelayOutgoingAnchorRecord(e){if(e==null||typeof e!=="object"||Array.isArray(e)||Object.keys(e).sort().join("\0")!=="contract\0event\0recordedAtMs\0sourceThreadId\0sourceTurnId\0transmissionId")return null;let t=MTKtinrelayOutgoingAnchorInput({contract:e.contract,sourceThreadId:e.sourceThreadId,sourceTurnId:e.sourceTurnId,transmissionId:e.transmissionId,recordedAtMs:e.recordedAtMs}),n=MTKtinrelayOutgoingEvent(e.event);return t==null||n==null||n.transmission_id!==t.transmissionId?null:{...t,event:n}}
function MTKtinrelayPrepareOutgoingAnchors(e){MTKtinrelayOutgoingAnchorDir=null;if(typeof e!=="string"||!MTKtinrelayOutgoingPath.isAbsolute(e))return;let t=MTKtinrelayOutgoingPath.join(e,"mechanics-toolkit","tinrelay",MTKtinrelayOutgoingLocalShip,"outgoing-anchors");try{MTKtinrelayOutgoingFs.mkdirSync(t,{recursive:!0,mode:448}),MTKtinrelayOutgoingFs.chmodSync(t,448);let e=MTKtinrelayOutgoingFs.lstatSync(t);e.isDirectory()&&(e.mode&63)===0&&(MTKtinrelayOutgoingAnchorDir=t),MTKtinrelayOutgoingPruneAnchorBuckets(null)}catch{}}
function MTKtinrelayOutgoingAnchorPath(e){return MTKtinrelayOutgoingAnchorDir==null||typeof e!=="string"||e.length===0?null:MTKtinrelayOutgoingPath.join(MTKtinrelayOutgoingAnchorDir,MTKtinrelayOutgoingCrypto.createHash("sha256").update(e).digest("hex")+".json")}
function MTKtinrelayOutgoingAnchorBucket(e,t){if(e==null||typeof e!=="object"||Array.isArray(e)||Object.keys(e).sort().join("\0")!=="contract\0records\0sourceThreadId"||e.contract!==MTKtinrelayOutgoingAnchorBucketContract||e.sourceThreadId!==t||!Array.isArray(e.records))return null;let n=[],r=new Set;for(let t of e.records){if((t=MTKtinrelayOutgoingAnchorRecord(t))==null||t.sourceThreadId!==e.sourceThreadId||r.has(t.transmissionId))return null;r.add(t.transmissionId),n.push(t)}return{contract:MTKtinrelayOutgoingAnchorBucketContract,sourceThreadId:e.sourceThreadId,records:n.sort((e,t)=>e.recordedAtMs-t.recordedAtMs||e.transmissionId.localeCompare(t.transmissionId))}}
function MTKtinrelayOutgoingReadAnchorBucket(e){let t=MTKtinrelayOutgoingAnchorPath(e);if(t==null)return null;let n,r;try{n=MTKtinrelayOutgoingFs.lstatSync(t);if(!n.isFile()||(n.mode&63)!==0||n.size<2||n.size>MTKtinrelayOutgoingAnchorTaskMaxBytes)return null;r=MTKtinrelayOutgoingFs.readFileSync(t,"utf8")}catch{return null}if(!r.endsWith("\n")||r.slice(0,-1).includes("\n")||r.includes("\r"))return null;let i;try{i=JSON.parse(r.slice(0,-1))}catch{return null}return MTKtinrelayOutgoingAnchorBucket(i,e)}
function MTKtinrelayOutgoingRemoveAnchorBucket(e){try{let t=MTKtinrelayOutgoingFs.lstatSync(e);return!!(t.isFile()&&(t.mode&63)===0)&&(MTKtinrelayOutgoingFs.unlinkSync(e),!0)}catch{return!1}}
function MTKtinrelayOutgoingPruneAnchorBuckets(e){if(MTKtinrelayOutgoingAnchorDir==null)return;let t=[];try{for(let n of MTKtinrelayOutgoingFs.readdirSync(MTKtinrelayOutgoingAnchorDir)){if(!/^[0-9a-f]{64}\.json$/.test(n))continue;let r=MTKtinrelayOutgoingPath.join(MTKtinrelayOutgoingAnchorDir,n),i=MTKtinrelayOutgoingFs.lstatSync(r);i.isFile()&&(i.mode&63)===0&&t.push({path:r,mtime:i.mtimeMs})}}catch{return}t.sort((t,n)=>t.path===e?1:n.path===e?-1:t.mtime-n.mtime||t.path.localeCompare(n.path));while(t.length>MTKtinrelayOutgoingAnchorBucketLimit){let e=t.shift();if(e==null)break;MTKtinrelayOutgoingRemoveAnchorBucket(e.path)}}
function MTKtinrelayOutgoingWriteAnchorBucket(e){let t=MTKtinrelayOutgoingAnchorPath(e.sourceThreadId);if(t==null)return null;let n=JSON.stringify(e)+"\n";if(Buffer.byteLength(n,"utf8")>MTKtinrelayOutgoingAnchorTaskMaxBytes)return null;let r=MTKtinrelayOutgoingPath.join(MTKtinrelayOutgoingAnchorDir,"."+process.pid+"."+MTKtinrelayOutgoingCrypto.randomUUID()+".tmp");try{MTKtinrelayOutgoingFs.writeFileSync(r,n,{encoding:"utf8",mode:384,flag:"wx"}),MTKtinrelayOutgoingFs.renameSync(r,t),MTKtinrelayOutgoingPruneAnchorBuckets(t);return MTKtinrelayOutgoingReadAnchorBucket(e.sourceThreadId)}catch{try{MTKtinrelayOutgoingFs.unlinkSync(r)}catch{}return null}}
function MTKtinrelayOutgoingAnchorRemember(e){if((e=MTKtinrelayOutgoingAnchorInput(e))==null)return null;let t=MTKtinrelayOutgoingEvents.get(e.transmissionId)??MTKtinrelayReadOutgoing(e.transmissionId);if(t==null)return null;let n=MTKtinrelayOutgoingReadAnchorBucket(e.sourceThreadId)??{contract:MTKtinrelayOutgoingAnchorBucketContract,sourceThreadId:e.sourceThreadId,records:[]},r=n.records.find(t=>t.transmissionId===e.transmissionId);if(r!=null)return r;let i={...e,event:t};n.records.push(i),n.records.sort((e,t)=>e.recordedAtMs-t.recordedAtMs||e.transmissionId.localeCompare(t.transmissionId)),n.records=n.records.slice(-MTKtinrelayOutgoingAnchorTaskLimit);while(n.records.length>0&&Buffer.byteLength(JSON.stringify(n)+"\n","utf8")>MTKtinrelayOutgoingAnchorTaskMaxBytes)n.records.shift();return MTKtinrelayOutgoingWriteAnchorBucket(n)?.records.find(e=>e.transmissionId===i.transmissionId)??null}
function MTKtinrelayOutgoingAnchorsList(e){if(typeof e!=="string"||e.length===0||e.length>512)return null;return MTKtinrelayOutgoingReadAnchorBucket(e)?.records??[]}
`;
}

function sourceContextProfile(value, position) {
  const owner = containingFunction(value, position);
  const argument = uniqueMatch(owner.text, /function [$A-Z_a-z][$\w]*\((?<argument>[$A-Z_a-z][$\w]*)\)\{/g, "Tinrelay exec renderer argument").groups.argument;
  const candidates = [...owner.text.matchAll(new RegExp(`\\{(?<properties>[^{}]+)\\}=${escapeRegExp(argument)}(?:,|;)`, "g"))]
    .map(match => match.groups.properties)
    .filter(properties => new RegExp(`(?:^|,)conversationId:${id}(?=,|$)`).test(properties) &&
      new RegExp(`(?:^|,)turnId:${id}(?=,|$)`).test(properties));
  if (candidates.length !== 1) throw new Error(`Upstream changed: found ${candidates.length} Tinrelay source-context bindings`);
  const destructuring = candidates[0];
  const conversationId = uniqueMatch(destructuring, new RegExp(`(?:^|,)conversationId:(?<value>${id})(?=,|$)`, "g"), "conversation ID binding").groups.value;
  const turnId = uniqueMatch(destructuring, new RegExp(`(?:^|,)turnId:(?<value>${id})(?=,|$)`, "g"), "turn ID binding").groups.value;
  return {conversationId, turnId};
}

function patchAssistantPresentations(value, turnValue, profile) {
  if (profile.splitTurn) {
    if (turnValue == null) throw new Error("Upstream changed: split turn renderer is missing");
    if (value.includes("MTKtinrelayOutgoingTurnPresentations as MTKtinrelayOutgoingTurnPresentations") ||
        turnValue.includes("MTKtinrelayOutgoingTurnPresentations as MTKtinrelayOutgoingTurnPresentations")) {
      throw new Error("Tinrelay outgoing split presentation is partial");
    }
    const rendererExport = uniqueMatch(value, /export\{/g, "renderer export owner");
    value = replaceOnce(
      value,
      rendererExport[0],
      "export{MTKtinrelayOutgoingTurnPresentations as MTKtinrelayOutgoingTurnPresentations,",
      "Tinrelay outgoing turn presentation export"
    );
    const relative = `./${path.basename(renderer)}`;
    const importPattern = new RegExp(`import\\{(?<specifiers>[^}]*MTKOutboundTurnReceipts[^}]*)\\}from"${escapeRegExp(relative)}";`, "g");
    const imported = uniqueMatch(turnValue, importPattern, "turn renderer receipt import");
    turnValue = replaceOnce(
      turnValue,
      imported[0],
      `import{${imported.groups.specifiers},MTKtinrelayOutgoingTurnPresentations as MTKtinrelayOutgoingTurnPresentations}from"${relative}";`,
      "Tinrelay outgoing turn presentation import"
    );
    const stagedReceipts = [...turnValue.matchAll(
      /(?<call>\$\(`mtk-outbound-turn-receipts`,\(0,(?<jsx>[$A-Z_a-z][$\w]*)\.jsx\)\(MTKOutboundTurnReceipts,\{conversationId:(?<conversationId>[$A-Z_a-z][$\w]*),turnId:(?<turnId>[$A-Z_a-z][$\w]*)\}\),\{canOwnLatestTurnFollowContent:!1\}\));(?<boundary>let [$A-Z_a-z][$\w]*=[$A-Z_a-z][$\w]*\.length,[$A-Z_a-z][$\w]*=\{)/g
    )];
    if (stagedReceipts.length > 1) throw new Error("Upstream changed: post-user outbound receipt boundary is ambiguous");
    if (stagedReceipts.length === 1) {
      const stagedReceipt = stagedReceipts[0];
      turnValue = replaceOnce(
        turnValue,
        stagedReceipt[0],
        `${stagedReceipt.groups.call};$(\`mtk-tinrelay-outgoing-turn\`,(0,${stagedReceipt.groups.jsx}.jsx)(MTKtinrelayOutgoingTurnPresentations,{conversationId:${stagedReceipt.groups.conversationId},turnId:${stagedReceipt.groups.turnId}}),{canOwnLatestTurnFollowContent:!1});${stagedReceipt.groups.boundary}`,
        "Tinrelay outgoing presentation after the user request and before activity"
      );
      return {rendererSource: value, turnSource: turnValue};
    }
    const receipt = uniqueMatch(
      turnValue,
      /(?<call>\(0,[$A-Z_a-z][$\w]*\.jsx\)\(MTKOutboundTurnReceipts,\{conversationId:(?<conversationId>[$A-Z_a-z][$\w]*),turnId:(?<turnId>[$A-Z_a-z][$\w]*)\}\)),(?<prelude>[$A-Z_a-z][$\w]*),(?<body>[$A-Z_a-z][$\w]*),/g,
      "turn renderer receipt and body"
    );
    turnValue = replaceOnce(
      turnValue,
      receipt[0],
      `${receipt.groups.call},(0,Q.jsx)(MTKtinrelayOutgoingTurnPresentations,{conversationId:${receipt.groups.conversationId},turnId:${receipt.groups.turnId}}),${receipt.groups.prelude},${receipt.groups.body},`,
      "Tinrelay outgoing presentation before the stock turn body"
    );
    return {rendererSource: value, turnSource: turnValue};
  }
  if (value.includes("(MTKtinrelayOutgoingTurnPresentations,{conversationId:")) {
    return {rendererSource: value, turnSource: turnValue};
  }
  const start = value.indexOf("function Oy(");
  if (start < 0) throw new Error("Upstream changed: assistant renderer owner is missing");
  const owner = functionAt(value, start);
  const context = sourceContextProfile(value, start);
  const existing = [...owner.text.matchAll(/(?<call>\(0,[$A-Z_a-z][$\w]*\.jsx\)\(MTKOutboundTurnReceipts,\{conversationId:(?<conversationId>[$A-Z_a-z][$\w]*),turnId:(?<turnId>[$A-Z_a-z][$\w]*)\}\)),(?<body>[$A-Z_a-z][$\w]*),/g)];
  if (existing.length === 1) {
    const match = existing[0];
    value = replaceOnce(value, match[0], `${match.groups.call},(0,Tb.jsx)(MTKtinrelayOutgoingTurnPresentations,{conversationId:${match.groups.conversationId},turnId:${match.groups.turnId}}),${match.groups.body},`, "Tinrelay assistant turn presentation before the stock turn body");
    return {rendererSource: value, turnSource: turnValue};
  }
  if (existing.length > 1) throw new Error("Upstream changed: assistant task receipt seam is not unique");
  const children = uniqueMatch(owner.text, /children:\[(?<first>[$A-Z_a-z][$\w]*),/g, "assistant message children");
  value = replaceOnce(value, children[0], `children:[(0,Tb.jsx)(MTKtinrelayOutgoingTurnPresentations,{conversationId:${context.conversationId},turnId:${context.turnId}}),${children.groups.first},`, "Tinrelay assistant turn presentation before the stock turn body");
  return {rendererSource: value, turnSource: turnValue};
}

function upgradeRendererTurnAnchors(value) {
  const hostBus = resolveHostBus(value);
  const start = value.indexOf("function MTKtinrelayOutgoingAcceptance(");
  const end = value.indexOf("function Cb(", start);
  if (start < 0 || end <= start || value.slice(start, end).includes("MTKtinrelayOutgoingAnchorContract")) {
    throw new Error("Upstream changed: legacy Tinrelay renderer helper is not uniquely localized");
  }
  let patched = value.slice(0, start) + rendererHelpers(hostBus) + value.slice(end);
  const wrapped = uniqueMatch(
    patched,
    new RegExp(`(?<jsx>\\(0,${id}\\.jsx\\))\\(MTKtinrelayOutgoingExec,\\{(?<props>Component:${id},item:${id},isTurnInProgress:${id},threadDetailLevel:${id},hostId:${id},summaryTone:${id},showSummaryIcon:${id},summaryIcon:${id},hideRawCommand:${id},toolActivityTurnKey:(?<toolActivityTurnKey>${id}))\\}\\)`, "g"),
    "legacy Tinrelay outgoing renderer call"
  );
  const context = sourceContextProfile(patched, wrapped.index);
  patched = replaceOnce(patched, wrapped[0], `${wrapped.groups.jsx}(MTKtinrelayOutgoingExec,{${wrapped.groups.props},sourceThreadId:${context.conversationId},sourceTurnId:${sourceTurnExpression(context.conversationId, wrapped.groups.toolActivityTurnKey)}})`, "Tinrelay outgoing source turn context");
  return patchAssistantPresentations(patched);
}

function upgradeMainTurnAnchors(value, ship) {
  const legacy = legacyMainHelpers(ship);
  if (count(value, legacy) !== 1 || value.includes("MTKtinrelayOutgoingAnchorContract")) {
    throw new Error("Upstream changed: legacy Tinrelay outgoing main helper is not uniquely localized");
  }
  let patched = replaceOnce(value, legacy, mainHelpers(ship), "Tinrelay outgoing turn-anchor main helper");
  const lookup = "case`mtk-tinrelay-outgoing-lookup`:{let n=await MTKtinrelayOutgoingLookup(t);this.windowManager.sendMessageToWebContents(e,{type:`mtk-tinrelay-outgoing-result`,requestId:typeof t.requestId===`string`?t.requestId:``,ok:n!=null,event:n});break}";
  return replaceOnce(
    patched,
    lookup,
    legacyAnchorMainHandlers(),
    "Tinrelay outgoing turn-anchor main handler"
  );
}

function upgradeRendererAcknowledgedAnchors(value, hostBus) {
  const start = value.indexOf("function MTKtinrelayOutgoingAcceptance(");
  const end = value.indexOf("function Cb(", start);
  if (start < 0 || end <= start || value.slice(start, end) !== legacyAnchorRendererHelpers(hostBus)) {
    throw new Error("Upstream changed: ackless Tinrelay renderer helper is not uniquely localized");
  }
  return value.slice(0, start) + rendererHelpers(hostBus) + value.slice(end);
}

function upgradeMainAcknowledgedAnchors(value) {
  return replaceOnce(
    value,
    legacyAnchorMainHandlers(),
    currentMainHandlers(),
    "Tinrelay acknowledged-anchor main handler"
  );
}

function embeddedLocalShip(source) {
  const literal = '"(?:\\\\.|[^"\\\\])*"';
  const match = uniqueMatch(
    source,
    new RegExp(`const MTKtinrelayLocalShip=(?<ship>${literal});function MTKtinrelayPointerFromMessage\\(`, "g"),
    "embedded Tinrelay local ship"
  );
  const ship = JSON.parse(match.groups.ship);
  if (typeof ship !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(ship)) {
    throw new Error("Tinrelay pointer patch contains an invalid local ship");
  }
  return ship;
}

function helperSlice(source) {
  const start = source.indexOf("function MTKtinrelayOutgoingAcceptance(");
  const end = source.indexOf(rendererProfile(source).boundary, start);
  if (start < 0 || end <= start) throw new Error("Tinrelay outgoing renderer helper is not localized");
  return source.slice(start, end);
}

function activityHelperSlice(source) {
  const start = source.indexOf("const MTKtinrelayOutgoingLocalShip=");
  const end = source.indexOf("function ln(", start);
  if (start < 0 || end <= start) throw new Error("Tinrelay outgoing activity helper is not localized");
  return source.slice(start, end);
}

function mainHelperSlice(source) {
  const start = source.indexOf("const MTKtinrelayOutgoingContract=");
  const owners = [source.indexOf("var mQ=i.i(`electron-message-handler`)", start), source.indexOf("var pQ=i.i(`electron-message-handler`)", start), source.indexOf("var fQ=i.i(`electron-message-handler`)", start)].filter(index => index >= 0);
  if (start < 0 || owners.length !== 1 || owners[0] <= start) throw new Error("Tinrelay outgoing main helper is not localized");
  return source.slice(start, owners[0]);
}

function resolveHostBus(source) {
  const imported = uniqueMatch(source, /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g, "app-initial import");
  const appInitial = fs.readFileSync(path.resolve(path.dirname(renderer), imported.groups.relative), "utf8");
  const exported = exportedAs(appInitial, appInitial.includes("function ALs(){") || appInitial.includes("function zLs(){") ? "H" : "U");
  const binding = uniqueMatch(imported.groups.specifiers, new RegExp(`(?:^|,)${escapeRegExp(exported)} as (?<local>${id})(?=,|$)`, "g"), "host bus import");
  return binding.groups.local;
}

function rendererProfile(source) {
  if (source.includes("function Xb(") && source.includes("MTKtinrelayReact=t(x(),1)")) {
    return {jsx: "qb", boundary: "function Xb(", splitTurn: turnRenderer != null};
  }
  if (source.includes("function Yb(") && source.includes("MTKtinrelayReact=t(_e(),1)")) {
    return {jsx: "Kb", boundary: "function Yb(", splitTurn: turnRenderer != null};
  }
  if (source.includes("function Cb(")) return {jsx: "Tb", boundary: "function Cb(", splitTurn: false};
  throw new Error("Upstream changed: Tinrelay renderer profile is not recognized");
}

function jsxDialect(value, jsx) {
  return jsx === "Tb" ? value : value.replaceAll("(0,Tb.", `(0,${jsx}.`);
}

function mainStartup(source) {
  const startup = uniqueMatch(
    source,
    new RegExp("(?<prefix>await (?<electron>" + id + ")\\.app\\.whenReady\\(\\),)(?<log>" + id + "\\(`main app\\.whenReady resolved`," + id + "\\))", "g"),
    "Tinrelay outgoing app-ready startup"
  );
  const before = source.slice(0, startup.index);
  const candidates = [...before.matchAll(new RegExp(`(?:let |,)(?<disposers>${id})=new ${id}\\.${id};`, "g"))]
    .filter(match => before.slice(match.index, match.index + 300).includes(`${match.groups.disposers}.add(`));
  const owner = candidates.at(-1);
  if (owner == null && startup[0] === "await l.app.whenReady(),P(`main app.whenReady resolved`,R)") {
    startup.groups.disposers = "L";
    return startup;
  }
  if (owner == null || startup.index - owner.index > 5000) {
    throw new Error("Upstream changed: Tinrelay outgoing disposer owner is not adjacent to app readiness");
  }
  startup.groups.disposers = owner.groups.disposers;
  return startup;
}

function exportedAs(source, local) {
  const exports = source.slice(source.lastIndexOf("export{"));
  const match = uniqueMatch(exports, new RegExp(`(?:^|,)${escapeRegExp(local)} as (?<exported>${id})(?=,|\\})`, "g"), `${local} export`);
  return match.groups.exported;
}

function uniqueFile(pattern, directory = assets) {
  const files = fs.readdirSync(directory).filter(name => pattern.test(name)).map(name => path.join(directory, name));
  if (files.length !== 1) throw new Error(`Upstream changed: found ${files.length} owners for ${pattern}`);
  return files[0];
}

function optionalUniqueFile(pattern, directory = assets) {
  const files = fs.readdirSync(directory).filter(name => pattern.test(name)).map(name => path.join(directory, name));
  if (files.length > 1) throw new Error(`Upstream changed: found ${files.length} optional owners for ${pattern}`);
  return files[0] ?? null;
}

function uniqueMatch(value, pattern, label) {
  const matches = [...value.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} ${label} matches`);
  return matches[0];
}

function containingFunction(value, position) {
  if (position < 0) throw new Error("Upstream changed: containing function target is missing");
  for (let start = value.lastIndexOf("function ", position); start >= 0; start = value.lastIndexOf("function ", start - 1)) {
    const candidate = functionAt(value, start);
    if (candidate.end > position) return candidate;
  }
  throw new Error("Upstream changed: containing function is missing");
}

function functionAt(value, start) {
  if (start < 0 || !value.startsWith("function ", start)) throw new Error("function start is invalid");
  const body = functionBodyStart(value, start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = body; index < value.length; index += 1) {
    const character = value[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") { quote = character; continue; }
    if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) {
      return {start, end: index + 1, text: value.slice(start, index + 1)};
    }
  }
  throw new Error("function body is unterminated");
}

function functionBodyStart(value, start) {
  const parameters = value.indexOf("(", start);
  if (parameters < 0) throw new Error("function parameters are missing");
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = parameters; index < value.length; index += 1) {
    const character = value[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")" && --depth === 0) {
      const body = value.indexOf("{", index + 1);
      if (body < 0) throw new Error("function body is missing");
      return body;
    }
  }
  throw new Error("function parameters are unterminated");
}

function replaceOnce(value, before, after, label) {
  if (count(value, before) !== 1) throw new Error(`Upstream changed: ${label} is not unique`);
  return value.replace(before, after);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function moduleSyntaxCheck(file) {
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
