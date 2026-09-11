#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const configPath = readOption("--config");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: task-visual-palette.mjs check|apply EXTRACTED_ASAR_ROOT [--config TOOLKIT_CONFIG]");
}

const assets = path.join(root, "webview/assets");
const appInitial = uniqueFile(/^app-initial-.*\.js$/);
const appPrimary = uniqueFile(/^app-primary-.*\.js$/);
const localPage = uniqueFile(/^local-conversation-page-.*\.js$/);
const delegation = uniqueFile(/^(?:subagent-activity-chip-group|conversation-blocks)-.*\.js$/);
const observerGateHelper = String.raw`const MTKpaletteSurfaceSelector="[data-app-action-sidebar-thread-row],[data-mtk-palette-room-host],[data-mtk-palette-source-id]";function MTKpaletteMutationRelevant(e){for(let t of e){if(t.type==="attributes")return!0;for(let e of[...t.addedNodes,...t.removedNodes])if((e.nodeType===1||e.nodeType===11)&&(e.nodeType===1&&e.matches(MTKpaletteSurfaceSelector)||e.querySelector?.(MTKpaletteSurfaceSelector)))return!0}return!1}`;
const universalSelectionOutlineCss = "[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-selected=true],[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active=true]{box-shadow:inset 0 0 0 1px var(--color-token-text-tertiary)!important}";
const previousThemeDerive = 'function MTKderive(e,t,n){let r=n?1:.72,i=n?"#101114":"#FAFAFA",a=n?"#282A30":"#E7E9ED",o=n?"#14161A":"#ECEEF1",s=n?"#F2F3F5":"#18191C"';
const currentThemeDerive = 'function MTKderive(e,t,n){let r=n?1:.56,i=n?"#101114":"#FCFCFD",a=n?"#282A30":"#F4F5F7",o=n?"#14161A":"#F7F8FA",s=n?"#F2F3F5":"#17191C"';

let state = inspectState();
if (command === "apply" && state !== "applied") {
  const attributionSource = fs.readFileSync(delegation, "utf8");
  if (!attributionSource.includes("function MTKsender(") || !attributionSource.includes("messageBubbleStyle:MTKdelegatedBubbleStyle")) {
    throw new Error("Palette apply requires the cross-task attribution mitigation first");
  }
  if (state === "needs-light-theme") {
    patchLightTheme(appInitial);
  } else if (state === "needs-observer-gate") {
    patchObserverGate(appInitial);
  } else if (state === "needs-archive-protection") {
    patchPaletteArchiveSchema(appInitial);
    patchReasoningPolicyBridge(appInitial);
    patchSidebarArchiveAffordances(appInitial, appPrimary);
  } else if (state === "needs-reasoning-policy-bridge") {
    patchReasoningPolicyBridge(appInitial);
  } else if (state === "needs-universal-selection-outline") {
    patchUniversalSelectionOutline(appInitial);
  } else if (state === "needs-model-pin-bridge") {
    patchModelPinPolicyBridge(appInitial);
  } else {
    patchAppInitial(appInitial, configuredWorkspaceRoot());
    patchBottomFade(appInitial, appPrimary);
    patchSidebarArchiveAffordances(appInitial, appPrimary);
    patchLocalPage(localPage);
    patchDelegation(delegation);
  }
  for (const file of [appInitial, appPrimary, localPage, delegation]) {
    moduleSyntaxCheck(file);
  }
  state = inspectState();
  if (state !== "applied") throw new Error("palette transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state: new Set(["needs-light-theme", "needs-observer-gate", "needs-archive-protection", "needs-reasoning-policy-bridge", "needs-universal-selection-outline", "needs-model-pin-bridge"]).has(state) ? "needs-apply" : state,
  targets: [appInitial, appPrimary, localPage, delegation].map(file => path.relative(root, file))
}, null, 2)}\n`);

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

function inspectState() {
  const appSource = fs.readFileSync(appInitial, "utf8");
  const appPrimarySource = fs.readFileSync(appPrimary, "utf8");
  const localSource = fs.readFileSync(localPage, "utf8");
  const delegationSource = fs.readFileSync(delegation, "utf8");
  for (const rejected of ["function MTKRoomSurface(", "MTKpaletteVisual=", "box-shadow:inset 1px 0 0", "[data-mtk-palette-mark=true]{background-color"]) {
    if (appSource.includes(rejected) || localSource.includes(rejected) || delegationSource.includes(rejected)) {
      throw new Error(`Unrecognized palette patch: rejected prototype marker ${rejected}`);
    }
  }
  if (appSource.includes("JSON.parse(k9e(e))") && appSource.includes("function k9e(e){j9e=e}")) {
    throw new Error("Unrecognized palette patch: captured minified decoder binding is present");
  }
  const applied = [
    appSource.includes("function MTKusePaletteBootstrap(") && appSource.includes("function MTKloadPaletteWhenReady(") && appSource.includes("function MTKacceptPaletteReload(") && appSource.includes('__MTK_RUNTIME_JSON_RELOAD__?.register("task-visual-palette.json"') && appSource.includes("JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(e),e=>e.charCodeAt(0))))") && !appSource.includes("JSON.parse(k9e(e))") && appSource.includes(".when(({get:") && appSource.includes("function MTKapplyPaletteSurfaces(") && appSource.includes("position:absolute;z-index:-1") && appSource.includes("opacity:var(--mtk-watermark-dark-opacity)") && appSource.includes("opacity:var(--mtk-watermark-light-opacity)") && appSource.includes("--mtk-user-bubble-strength") && appSource.includes("--mtk-generic-bubble-strength") && appSource.includes("selection:n?MTKmix") && appSource.includes("[data-user-message-bubble] *::selection") && appSource.includes("box-shadow:inset 0 0 0 1px var(--mtk-accent-dark)") && (appSource.includes('"data-mtk-palette-bottom-fade":!0') || appPrimarySource.includes('"data-mtk-palette-bottom-fade":!0')),
    localSource.includes('"data-mtk-palette-room-host":!0') && localSource.includes('"data-mtk-palette-thread-id"'),
    delegationSource.includes('"data-mtk-palette-source-title"') && delegationSource.includes('"data-mtk-palette-source-id"') && delegationSource.includes("messageBubbleStyle:MTKdelegatedBubbleStyle")
  ];
  if (applied.every(Boolean)) {
    if (appSource.includes(previousThemeDerive)) return "needs-light-theme";
    if (!appSource.includes(currentThemeDerive)) {
      throw new Error("Unrecognized palette patch: light-theme derivation is missing or changed");
    }
    const archiveProtection = inspectSidebarArchiveProtection(appSource, appPrimarySource);
    if (
      appSource.includes("function MTKqueueSidebar(e){if(!MTKpaletteMutationRelevant(e))return;") &&
      appSource.includes("const MTKpaletteSurfaceSelector=")
    ) {
      if (archiveProtection !== "applied") return "needs-archive-protection";
      if (!appSource.includes("function MTKreasoningShouldStayOpen(") ||
          !appSource.includes("globalThis.__MTKreasoningShouldStayOpen=MTKreasoningShouldStayOpen") ||
          !appSource.includes("globalThis.__MTKreasoningSubscribe=MTKreasoningSubscribe")) {
        return "needs-reasoning-policy-bridge";
      }
      if (!appSource.includes("function MTKmodelPinForTask(") ||
          !appSource.includes("globalThis.__MTKmodelPinForTask=MTKmodelPinForTask") ||
          !appSource.includes("globalThis.__MTKmodelPinSubscribe=MTKmodelPinSubscribe")) {
        return "needs-model-pin-bridge";
      }
      return appSource.includes(universalSelectionOutlineCss) ? "applied" : "needs-universal-selection-outline";
    }
    if (
      appSource.includes("function MTKqueueSidebar(){MTKsidebarQueued||(") &&
      !appSource.includes("MTKpaletteMutationRelevant")
    ) return "needs-observer-gate";
    throw new Error("Unrecognized palette patch: observer gate is partial or changed");
  }
  const pristine = [
    appProfile(appSource) != null && bottomFadeProfile(appSource, appPrimarySource) != null && !appSource.includes('"data-mtk-palette-bottom-fade":!0') && !appPrimarySource.includes('"data-mtk-palette-bottom-fade":!0'),
    localProfile(localSource) != null,
    !delegationSource.includes('"data-mtk-palette-source-id"') && delegationSource.includes("localConversation.codexDelegationUserMessage.app") && delegationSource.includes("sourceThreadId")
  ];
  if (pristine.every(Boolean) && inspectSidebarArchiveProtection(appSource, appPrimarySource) === "needs-apply") {
    return "needs-apply";
  }
  throw new Error(`Unrecognized palette patch state: applied=${applied.join(",")} pristine=${pristine.join(",")}`);
}

function uniqueFile(pattern) {
  const found = fs.readdirSync(assets).filter(name => pattern.test(name));
  if (found.length !== 1) throw new Error(`expected one ${pattern}, found ${found.length}`);
  return path.join(assets, found[0]);
}

function inspectSidebarArchiveProtection(source, primarySource) {
  const build8690Applied = [
    "globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected",
    "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function e3t(",
    "archive:D||MTKsidebarArchiveProtected(_)?void 0:{id:`archive-thread`,message:void 0,onSelect:()=>{i()}}",
    "function h3t({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
    "archiveProtected:R$t(T,r).some(e=>{let t=T.get(jt,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archiveProtected:R$t(ee,e).some(e=>{let t=ee.get(jt,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Oe||B)?Fe:t",
    "He=Ce&&!MTKsidebarArchiveProtected(se)?Me:null",
    "if(Ce&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d(["
  ];
  if (primarySource != null && build8690Applied.every(contract => source.includes(contract) || primarySource.includes(contract))) return "applied";

  const build8690NeedsApply = [
    "archive:D?void 0:{id:`archive-thread`,message:void 0,onSelect:()=>{i()}}",
    "function h3t({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
    "selectedThreadKeys:R$t(T,r),threadKey:r})",
    "selectedThreadKeys:R$t(ee,e),threadKey:e})",
    "archive:t!=null&&(Oe||B)?Fe:t",
    "He=Ce?Me:null",
    "if(Ce&&e.push({id:`archive-task`",
    "archive:n,getMenuItems:K?e=>d(["
  ];
  if (primarySource != null && build8690NeedsApply.every(contract => primarySource.includes(contract))) return "needs-apply";

  const build8576Applied = [
    "globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected",
    "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function WFn(",
    "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function aIn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
    "archiveProtected:Sjn(T,r).some(e=>{let t=T.get(Kt,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archiveProtected:Sjn(G,e).some(e=>{let t=G.get(Kt,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Ne:t",
    "Ve=Se&&!MTKsidebarArchiveProtected(se)?Me:null",
    "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d(["
  ];
  if (primarySource != null && build8576Applied.every(contract => source.includes(contract) || primarySource.includes(contract))) return "applied";

  const build8576NeedsApply = [
    "archive:w?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function aIn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
    "selectedThreadKeys:Sjn(T,r),threadKey:r})",
    "selectedThreadKeys:Sjn(G,e),threadKey:e})",
    "archive:t!=null&&(Ee||L)?Ne:t",
    "Ve=Se?Me:null",
    "if(Se&&e.push({id:`archive-task`",
    "archive:n,getMenuItems:K?e=>d(["
  ];
  if (primarySource != null && build8576NeedsApply.every(contract => primarySource.includes(contract))) return "needs-apply";

  const build8378Applied = [
    "globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected",
    "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function DPn(",
    "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function UPn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
    "archiveProtected:Qkn(T,r).some(e=>{let t=T.get($u,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archiveProtected:Qkn(G,e).some(e=>{let t=G.get($u,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Me:t",
    "Be=Se&&!MTKsidebarArchiveProtected(se)?je:null",
    "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d(["
  ];
  if (primarySource != null && build8378Applied.every(contract => source.includes(contract) || primarySource.includes(contract))) return "applied";

  const build8378NeedsApply = [
    "archive:w?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function UPn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
    "selectedThreadKeys:Qkn(T,r),threadKey:r})",
    "selectedThreadKeys:Qkn(G,e),threadKey:e})",
    "archive:t!=null&&(Ee||L)?Me:t",
    "Be=Se?je:null",
    "if(Se&&e.push({id:`archive-task`",
    "archive:n,getMenuItems:K?e=>d(["
  ];
  if (primarySource != null && build8378NeedsApply.every(contract => primarySource.includes(contract))) return "needs-apply";

  const build8109Applied = [
    "globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected",
    "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function UAn(",
    "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function ajn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
    "archiveProtected:HTn(T,r).some(e=>{let t=T.get(tm,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archiveProtected:HTn(K,e).some(e=>{let t=K.get(tm,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(De||L)?Ne:t",
    "Ve=Ce&&!MTKsidebarArchiveProtected(se)?Me:null",
    "if(Ce&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:q&&!MTKsidebarArchiveProtected(e.task.id)?e=>d(["
  ];
  if (primarySource != null && build8109Applied.every(contract => source.includes(contract) || primarySource.includes(contract))) return "applied";

  const build8109NeedsApply = [
    "archive:w?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function ajn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
    "selectedThreadKeys:HTn(T,r),threadKey:r})",
    "selectedThreadKeys:HTn(K,e),threadKey:e})",
    "archive:t!=null&&(De||L)?Ne:t",
    "Ve=Ce?Me:null",
    "if(Ce&&e.push({id:`archive-task`",
    "archive:n,getMenuItems:q?e=>d(["
  ];
  if (primarySource != null && build8109NeedsApply.every(contract => primarySource.includes(contract))) return "needs-apply";

  const build7942Applied = [
    "globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected",
    "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function VAn(",
    "archive:T||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function rjn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
    "archiveProtected:BTn(T,r).some(e=>{let t=T.get(pv,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
    "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Me:t",
    "onArchive:MTKsidebarArchiveProtected(se)?null:Ve,archiveAriaLabel:He",
    "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "archive:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d(["
  ];
  if (primarySource != null && build7942Applied.every(contract => source.includes(contract) || primarySource.includes(contract))) return "applied";

  const build7942NeedsApply = [
    "archive:T?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function rjn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
    "selectedThreadKeys:BTn(T,r),threadKey:r})",
    "archive:t!=null&&(Ee||L)?Me:t",
    "onArchive:Ve,archiveAriaLabel:He",
    "if(Se&&e.push({id:`archive-task`",
    "archive:n,getMenuItems:K?e=>d(["
  ];
  if (primarySource != null && build7942NeedsApply.every(contract => primarySource.includes(contract))) return "needs-apply";

  const build7746Applied = [
    "globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected",
    "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function JAn(",
    "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function ljn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
    "archiveProtected:CEn(T,r).some(e=>MTKsidebarArchiveProtected(gC(e)))",
    "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Me:t",
    "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "Be=Se&&!MTKsidebarArchiveProtected(se)?je:null",
    "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:q&&!MTKsidebarArchiveProtected(e.task.id)?"
  ];
  if (primarySource != null && build7746Applied.every(contract => source.includes(contract) || primarySource.includes(contract))) return "applied";

  const build7746NeedsApply = [
    "archive:w?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function ljn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
    "selectedThreadKeys:CEn(T,r),threadKey:r})",
    "archive:t!=null&&(Ee||L)?Me:t",
    "if(Se&&e.push({id:`archive-task`",
    "Be=Se?je:null",
    "archive:n,getMenuItems:q?"
  ];
  if (primarySource != null && build7746NeedsApply.every(contract => primarySource.includes(contract))) return "needs-apply";
  const build7345Applied = [
    "archive:S||MTKsidebarArchiveProtected(f)?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function cRc({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
    "archiveProtected:XMc(T,e).some(e=>MTKsidebarArchiveProtected(KNc(T.get(VN,e))))",
    "archiveProtected:XMc(V,e).some(e=>MTKsidebarArchiveProtected(KNc(V.get(VN,e))))",
    "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(De||L)?Ne:t",
    "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
    "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:H&&!MTKsidebarArchiveProtected(e.task.id)?"
  ];
  if (build7345Applied.every(contract => source.includes(contract))) return "applied";

  const build7345NeedsApply = [
    "archive:S?void 0:{id:`archive-thread`,onSelect:()=>i()}",
    "function cRc({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
    "selectedThreadKeys:XMc(T,e),threadKey:e})",
    "selectedThreadKeys:XMc(V,e),threadKey:e})",
    "archive:t!=null&&(De||L)?Ne:t",
    "if(Se&&e.push({id:`archive-task`",
    "archive:n,getMenuItems:H?e=>u(["
  ];
  if (build7345NeedsApply.every(contract => source.includes(contract))) return "needs-apply";

  const legacyApplied = source.includes("function Nkl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:") &&
    source.includes("archiveProtected:twl(T,e).some(e=>{let t=T.get(Rx,e);return t!=null&&MTKsidebarArchiveProtected(tEl(t))})");
  const currentApplied = source.includes("function zAl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:") &&
    source.includes("archiveProtected:sTl(V,e).some(e=>{let t=V.get(Lx,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})");
  const applied = [
    source.includes("function MTKsidebarArchiveProtected("),
    source.includes("protectSidebarArchive"),
    source.includes("...MTKsidebarArchiveProtected(n)?[]:[{id:`archive-thread`,onSelect:Ke}],...nt()?"),
    source.includes("archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Be||R)?Ke:t"),
    legacyApplied || currentApplied,
    legacyApplied || currentApplied
  ];
  if (applied.every(Boolean)) return "applied";

  const legacyNeedsApply = source.includes("function Nkl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:") &&
    source.includes("selectedThreadKeys:twl(T,e),threadKey:e})}");
  const currentNeedsApply = source.includes("function zAl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:") &&
    source.includes("selectedThreadKeys:sTl(V,e),threadKey:e})");
  const needsApply = [
    source.includes("{id:`archive-thread`,onSelect:Ke},...nt()?"),
    source.includes("archive:t!=null&&(Be||R)?Ke:t,getMenuItems:"),
    source.includes("ht=_e.renderActions??ut,gt;"),
    legacyNeedsApply || currentNeedsApply,
    legacyNeedsApply || currentNeedsApply
  ];
  const schemaNeedsApply = !source.includes("function MTKusePaletteBootstrap(") ||
    source.includes('Object.keys(r).some(e=>e!=="color"&&e!=="mark")');
  if (needsApply.every(Boolean) && schemaNeedsApply) return "needs-apply";
  throw new Error(
    `Unrecognized sidebar archive-protection state: build7942Applied=${build7942Applied.map(contract => source.includes(contract) || primarySource?.includes(contract)).join(",")} ` +
      `build7942NeedsApply=${build7942NeedsApply.map(contract => primarySource?.includes(contract)).join(",")} build7746Applied=${build7746Applied.map(contract => source.includes(contract) || primarySource?.includes(contract)).join(",")} ` +
      `build7746NeedsApply=${build7746NeedsApply.map(contract => primarySource?.includes(contract)).join(",")} applied=${applied.join(",")} ` +
      `needsApply=${needsApply.join(",")} schemaNeedsApply=${schemaNeedsApply}`
  );
}

function appProfile(source) {
  const profiles = [
    {
      name: "26.814.41407-6720",
      seam: "function USl(e){let t=(0,ZSl.c)(9),",
      patchedSeam: "function USl(e){MTKusePaletteBootstrap();let t=(0,ZSl.c)(9),",
      helperReplacements: [],
      bottomFadeBefore: '(0,e3c.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      bottomFadeAfter: '(0,e3c.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      name: "26.818.21641-6849",
      seam: "function Fjl(e){let t=(0,Gjl.c)(9),",
      patchedSeam: "function Fjl(e){MTKusePaletteBootstrap();let t=(0,Gjl.c)(9),",
      helperReplacements: [["Ss(Q)", "_s(Q)"], ["Y(Can)", "Y(Ysn)"], ["QSl.useEffect", "Kjl.useEffect"], ["e.get($g)", "e.get(Hg)"], ["e($g)", "e(Hg)"], ['Qg(e,"local")', 'Vg(e,"local")']],
      bottomFadeBefore: '(0,$nl.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      bottomFadeAfter: '(0,$nl.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      name: "26.818.31338-6892",
      seam: "function zMl(e){let t=(0,YMl.c)(9),",
      patchedSeam: "function zMl(e){MTKusePaletteBootstrap();let t=(0,YMl.c)(9),",
      helperReplacements: [["Ss(Q)", "vs(Q)"], ["Y(Can)", "Y(Xsn)"], ["QSl.useEffect", "XMl.useEffect"], ["e.get($g)", "e.get(Rg)"], ["e($g)", "e(Rg)"], ['Qg(e,"local")', 'Lg(e,"local")']],
      bottomFadeBefore: '(0,ril.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      bottomFadeAfter: '(0,ril.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      name: "26.818.41509-6962",
      seam: "function hYl(e){let t=(0,vYl.c)(93),",
      patchedSeam: "function hYl(e){MTKusePaletteBootstrap();let t=(0,vYl.c)(93),",
      helperReplacements: [["Ss(Q)", "ys(Q)"], ["Y(Can)", "Y(fS)"], ["QSl.useEffect", "yYl.useEffect"], ["e.get($g)", "e.get(Bg)"], ["e($g)", "e(Bg)"], ['Qg(e,"local")', 'zg(e,"local")']],
      bottomFadeBefore: '(0,ial.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      bottomFadeAfter: '(0,ial.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      name: "26.825.41651-7345",
      seam: "function g$c(e){let t=(0,b$c.c)(114),",
      patchedSeam: "function g$c(e){MTKusePaletteBootstrap();let t=(0,b$c.c)(114),",
      fixedOwnerRoot: true,
      helperReplacements: [["e.get($g)", "e.get(Fb)"], ["e($g)", "e(Fb)"], ['Qg(e,"local")', 'Pb(e,"local")']],
      bottomFadeBefore: '(0,Krc.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      bottomFadeAfter: '(0,Krc.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      name: "26.901.22334-7746",
      seam: "function qOs(){let e=(0,XOs.c)(12),",
      patchedSeam: "function qOs(){MTKusePaletteBootstrap();let e=(0,XOs.c)(12),",
      fixedOwnerRoot: true,
      helperReplacements: [["A_($)", "pb(Q)"], ["x$c.useEffect", "ZOs.useEffect"], ["e.get($g)", "e.get(Tb)"], ["e($g)", "e(Tb)"], ['Qg(e,"local")', 'wb(e,"local")']],
      bottomFadeBefore: null,
      bottomFadeAfter: null
    },
    {
      name: "26.901.41123-7942",
      seam: "function Oks(){let e=(0,jks.c)(12),",
      patchedSeam: "function Oks(){MTKusePaletteBootstrap();let e=(0,jks.c)(12),",
      fixedOwnerRoot: true,
      excludeMarker: "function Rb(e,t){let n=e.get(zb);",
      helperReplacements: [["A_($)", "hb(Q)"], ["x$c.useEffect", "Mks.useEffect"], ["e.get($g)", "e.get(Db)"], ["e($g)", "e(Db)"], ['Qg(e,"local")', 'Eb(e,"local")']],
      bottomFadeBefore: null,
      bottomFadeAfter: null
    },
    {
      name: "26.901.51231-8109",
      seam: "function Oks(){let e=(0,jks.c)(12),",
      patchedSeam: "function Oks(){MTKusePaletteBootstrap();let e=(0,jks.c)(12),",
      fixedOwnerRoot: true,
      marker: "function Rb(e,t){let n=e.get(zb);",
      helperReplacements: [["A_($)", "Db(Q)"], ["x$c.useEffect", "Mks.useEffect"], ["e.get($g)", "e.get(zb)"], ["e($g)", "e(zb)"], ['Qg(e,"local")', 'Rb(e,"local")']],
      bottomFadeBefore: null,
      bottomFadeAfter: null
    },
    {
      name: "26.903.71938-8576",
      seam: "function zLs(){let e=(0,HLs.c)(12),",
      patchedSeam: "function zLs(){MTKusePaletteBootstrap();let e=(0,HLs.c)(12),",
      fixedOwnerRoot: true,
      helperReplacements: [["A_($)", "ub(Q)"], ["x$c.useEffect", "OLs.useEffect"], ["e.get($g)", "e.get(Sb)"], ["e($g)", "e(Sb)"], ['Qg(e,"local")', 'xb(e,"local")']],
      bottomFadeBefore: null,
      bottomFadeAfter: null
    },
    {
      name: "26.903.61454-8378",
      seam: "function ALs(){let e=(0,NLs.c)(12),",
      patchedSeam: "function ALs(){MTKusePaletteBootstrap();let e=(0,NLs.c)(12),",
      fixedOwnerRoot: true,
      helperReplacements: [["A_($)", "db(Q)"], ["x$c.useEffect", "PLs.useEffect"], ["e.get($g)", "e.get(Cb)"], ["e($g)", "e(Cb)"], ['Qg(e,"local")', 'Sb(e,"local")']],
      bottomFadeBefore: null,
      bottomFadeAfter: null
    },
    {
      name: "26.908.31457-8690",
      seam: "function Ocs(){let e=(0,jcs.c)(12),",
      patchedSeam: "function Ocs(){MTKusePaletteBootstrap();let e=(0,jcs.c)(12),",
      fixedOwnerRoot: true,
      helperReplacements: [["A_($)", "vm(Q)"], ["x$c.useEffect", "Mcs.useEffect"], ["e.get($g)", "e.get(Am)"], ["e($g)", "e(Am)"], ['Qg(e,"local")', 'km(e,"local")']],
      bottomFadeBefore: null,
      bottomFadeAfter: null
    }
  ];
  const matches = profiles.filter(profile => source.includes(profile.seam) &&
    (profile.marker == null || source.includes(profile.marker)) &&
    (profile.excludeMarker == null || !source.includes(profile.excludeMarker)));
  return matches.length === 1 ? matches[0] : null;
}

function bottomFadeProfile(appSource, primarySource) {
  const profiles = [
    ...[appProfile(appSource)].filter(profile => profile?.bottomFadeBefore != null).map(profile => ({
      file: "app-initial",
      before: profile.bottomFadeBefore,
      after: profile.bottomFadeAfter
    })),
    {
      file: "app-primary",
      before: '(0,h3.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      after: '(0,h3.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      file: "app-primary",
      before: '(0,b3.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      after: '(0,b3.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      file: "app-primary",
      before: '(0,y3.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      after: '(0,y3.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      file: "app-primary",
      before: '(0,_3.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      after: '(0,_3.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    },
    {
      file: "app-primary",
      before: '(0,q3.jsx)(`div`,{"aria-hidden":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})',
      after: '(0,q3.jsx)(`div`,{"aria-hidden":!0,"data-mtk-palette-bottom-fade":!0,className:`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface extension:from-surface-secondary extension:via-surface-secondary`})'
    }
  ];
  const matches = profiles.filter(profile => (profile.file === "app-initial" ? appSource : primarySource).includes(profile.before));
  return matches.length === 1 ? matches[0] : null;
}

function localProfile(source) {
  const oldRoot = "t[54]!==W||t[55]!==G||t[56]!==ne||t[57]!==ie||t[58]!==ae||t[59]!==oe||t[60]!==ce||t[61]!==le||t[62]!==J?(de=(0,Q.jsxs)(`div`,{ref:te,className:`relative h-full min-h-0`,children:[W,G,ne,q,ie,ae,oe,ce,le,J]}),t[54]=W,t[55]=G,t[56]=ne,t[57]=ie,t[58]=ae,t[59]=oe,t[60]=ce,t[61]=le,t[62]=J,t[63]=de):de=t[63];";
  const newRoot = 't[57]!==G||t[58]!==K||t[59]!==ee||t[60]!==te||t[61]!==ne||t[62]!==re||t[63]!==ie||t[64]!==se||t[65]!==ce||t[66]!==le?(ue=(0,Q.jsxs)(`div`,{ref:W,className:`relative h-full min-h-0`,children:[G,K,ee,q,te,ne,re,ie,se,ce,le]}),t[57]=G,t[58]=K,t[59]=ee,t[60]=te,t[61]=ne,t[62]=re,t[63]=ie,t[64]=se,t[65]=ce,t[66]=le,t[67]=ue):ue=t[67];';
  const currentRoot = 't[57]!==K||t[58]!==q||t[59]!==ee||t[60]!==re||t[61]!==ie||t[62]!==ae||t[63]!==oe||t[64]!==ce||t[65]!==le||t[66]!==ue?(de=(0,Q.jsxs)(`div`,{ref:G,className:`relative h-full min-h-0`,children:[K,q,ee,te,re,ie,ae,oe,ce,le,ue]}),t[57]=K,t[58]=q,t[59]=ee,t[60]=re,t[61]=ie,t[62]=ae,t[63]=oe,t[64]=ce,t[65]=le,t[66]=ue,t[67]=de):de=t[67];';
  const profiles = [
    { name: "26.814.41407-6720", cacheBefore: "(0,go.c)(67)", cacheAfter: "(0,go.c)(68)", rootBefore: oldRoot,
      rootAfter: "t[54]!==W||t[55]!==G||t[56]!==ne||t[57]!==ie||t[58]!==ae||t[59]!==oe||t[60]!==ce||t[61]!==le||t[62]!==J||t[67]!==r?(de=(0,Q.jsxs)(`div`,{ref:te,\"data-mtk-palette-room-host\":!0,\"data-mtk-palette-thread-id\":r,className:`relative h-full min-h-0`,children:[W,G,ne,q,ie,ae,oe,ce,le,J]}),t[54]=W,t[55]=G,t[56]=ne,t[57]=ie,t[58]=ae,t[59]=oe,t[60]=ce,t[61]=le,t[62]=J,t[67]=r,t[63]=de):de=t[63];" },
    { name: "26.818.21641-6849", cacheBefore: "function xo(e){let t=(0,Do.c)(71),", cacheAfter: "function xo(e){let t=(0,Do.c)(72),", rootBefore: newRoot,
      rootAfter: 't[57]!==G||t[58]!==K||t[59]!==ee||t[60]!==te||t[61]!==ne||t[62]!==re||t[63]!==ie||t[64]!==se||t[65]!==ce||t[66]!==le||t[71]!==a?(ue=(0,Q.jsxs)(`div`,{ref:W,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":a,className:`relative h-full min-h-0`,children:[G,K,ee,q,te,ne,re,ie,se,ce,le]}),t[57]=G,t[58]=K,t[59]=ee,t[60]=te,t[61]=ne,t[62]=re,t[63]=ie,t[64]=se,t[65]=ce,t[66]=le,t[71]=a,t[67]=ue):ue=t[67];' }
    ,
    { name: "26.818.31338-6892", cacheBefore: "function xo(e){let t=(0,Do.c)(71),", cacheAfter: "function xo(e){let t=(0,Do.c)(72),", rootBefore: currentRoot,
      rootAfter: 't[57]!==K||t[58]!==q||t[59]!==ee||t[60]!==re||t[61]!==ie||t[62]!==ae||t[63]!==oe||t[64]!==ce||t[65]!==le||t[66]!==ue||t[71]!==r?(de=(0,Q.jsxs)(`div`,{ref:G,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[K,q,ee,te,re,ie,ae,oe,ce,le,ue]}),t[57]=K,t[58]=q,t[59]=ee,t[60]=re,t[61]=ie,t[62]=ae,t[63]=oe,t[64]=ce,t[65]=le,t[66]=ue,t[71]=r,t[67]=de):de=t[67];' }
    ,
    { name: "26.818.41509-6962", cacheBefore: "function Co(e){let t=(0,ko.c)(71),", cacheAfter: "function Co(e){let t=(0,ko.c)(72),",
      rootBefore: 't[57]!==K||t[58]!==ne||t[59]!==re||t[60]!==ae||t[61]!==se||t[62]!==ce||t[63]!==le||t[64]!==de||t[65]!==fe||t[66]!==pe?(me=(0,Q.jsxs)(`div`,{ref:G,className:`relative h-full min-h-0`,children:[K,ne,re,ie,ae,se,ce,le,de,fe,pe]}),t[57]=K,t[58]=ne,t[59]=re,t[60]=ae,t[61]=se,t[62]=ce,t[63]=le,t[64]=de,t[65]=fe,t[66]=pe,t[67]=me):me=t[67];',
      rootAfter: 't[57]!==K||t[58]!==ne||t[59]!==re||t[60]!==ae||t[61]!==se||t[62]!==ce||t[63]!==le||t[64]!==de||t[65]!==fe||t[66]!==pe||t[71]!==r?(me=(0,Q.jsxs)(`div`,{ref:G,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[K,ne,re,ie,ae,se,ce,le,de,fe,pe]}),t[57]=K,t[58]=ne,t[59]=re,t[60]=ae,t[61]=se,t[62]=ce,t[63]=le,t[64]=de,t[65]=fe,t[66]=pe,t[71]=r,t[67]=me):me=t[67];' }
    ,
    { name: "26.825.41651-7345", cacheBefore: "function yo(e){let t=(0,Do.c)(90),", cacheAfter: "function yo(e){let t=(0,Do.c)(91),",
      rootBefore: 't[74]!==oe||t[75]!==se||t[76]!==ce||t[77]!==ue||t[78]!==pe||t[79]!==me||t[80]!==he||t[81]!==ge||t[82]!==_e||t[83]!==ye||t[84]!==be||t[85]!==xe?(Ce=(0,Q.jsxs)(`div`,{ref:ae,className:`relative h-full min-h-0`,children:[oe,se,ce,le,ue,pe,me,he,ge,_e,ye,be,xe]}),t[74]=oe,t[75]=se,t[76]=ce,t[77]=ue,t[78]=pe,t[79]=me,t[80]=he,t[81]=ge,t[82]=_e,t[83]=ye,t[84]=be,t[85]=xe,t[86]=Ce):Ce=t[86];',
      rootAfter: 't[74]!==oe||t[75]!==se||t[76]!==ce||t[77]!==ue||t[78]!==pe||t[79]!==me||t[80]!==he||t[81]!==ge||t[82]!==_e||t[83]!==ye||t[84]!==be||t[85]!==xe||t[90]!==r?(Ce=(0,Q.jsxs)(`div`,{ref:ae,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[oe,se,ce,le,ue,pe,me,he,ge,_e,ye,be,xe]}),t[74]=oe,t[75]=se,t[76]=ce,t[77]=ue,t[78]=pe,t[79]=me,t[80]=he,t[81]=ge,t[82]=_e,t[83]=ye,t[84]=be,t[85]=xe,t[90]=r,t[86]=Ce):Ce=t[86];' }
    ,
    { name: "26.901.22334-7746", cacheBefore: "function $o(e){let t=(0,os.c)(88),", cacheAfter: "function $o(e){let t=(0,os.c)(89),",
      rootBefore: 't[72]!==ie||t[73]!==ae||t[74]!==oe||t[75]!==se||t[76]!==le||t[77]!==ue||t[78]!==de||t[79]!==me||t[80]!==he||t[81]!==ge||t[82]!==_e||t[83]!==ve?(ye=(0,Q.jsxs)(`div`,{ref:re,className:`relative h-full min-h-0`,children:[ie,ae,oe,se,ce,le,ue,de,me,he,ge,_e,ve]}),t[72]=ie,t[73]=ae,t[74]=oe,t[75]=se,t[76]=le,t[77]=ue,t[78]=de,t[79]=me,t[80]=he,t[81]=ge,t[82]=_e,t[83]=ve,t[84]=ye):ye=t[84];',
      rootAfter: 't[72]!==ie||t[73]!==ae||t[74]!==oe||t[75]!==se||t[76]!==le||t[77]!==ue||t[78]!==de||t[79]!==me||t[80]!==he||t[81]!==ge||t[82]!==_e||t[83]!==ve||t[88]!==r?(ye=(0,Q.jsxs)(`div`,{ref:re,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[ie,ae,oe,se,ce,le,ue,de,me,he,ge,_e,ve]}),t[72]=ie,t[73]=ae,t[74]=oe,t[75]=se,t[76]=le,t[77]=ue,t[78]=de,t[79]=me,t[80]=he,t[81]=ge,t[82]=_e,t[83]=ve,t[88]=r,t[84]=ye):ye=t[84];' }
    ,
    { name: "26.901.41123-7942", cacheBefore: "function $o(e){let t=(0,os.c)(88),", cacheAfter: "function $o(e){let t=(0,os.c)(89),",
      rootBefore: 't[72]!==G||t[73]!==K||t[74]!==q||t[75]!==J||t[76]!==ie||t[77]!==ae||t[78]!==oe||t[79]!==se||t[80]!==le||t[81]!==ue||t[82]!==de||t[83]!==fe?(pe=(0,Q.jsxs)(`div`,{ref:U,className:`relative h-full min-h-0`,children:[G,K,q,J,re,ie,ae,oe,se,le,ue,de,fe]}),t[72]=G,t[73]=K,t[74]=q,t[75]=J,t[76]=ie,t[77]=ae,t[78]=oe,t[79]=se,t[80]=le,t[81]=ue,t[82]=de,t[83]=fe,t[84]=pe):pe=t[84];',
      rootAfter: 't[72]!==G||t[73]!==K||t[74]!==q||t[75]!==J||t[76]!==ie||t[77]!==ae||t[78]!==oe||t[79]!==se||t[80]!==le||t[81]!==ue||t[82]!==de||t[83]!==fe||t[88]!==r?(pe=(0,Q.jsxs)(`div`,{ref:U,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[G,K,q,J,re,ie,ae,oe,se,le,ue,de,fe]}),t[72]=G,t[73]=K,t[74]=q,t[75]=J,t[76]=ie,t[77]=ae,t[78]=oe,t[79]=se,t[80]=le,t[81]=ue,t[82]=de,t[83]=fe,t[88]=r,t[84]=pe):pe=t[84];' }
    ,
    { name: "26.901.51231-8109", cacheBefore: "function $o(e){let t=(0,os.c)(88),", cacheAfter: "function $o(e){let t=(0,os.c)(89),",
      rootBefore: 't[72]!==W||t[73]!==G||t[74]!==K||t[75]!==q||t[76]!==ie||t[77]!==oe||t[78]!==se||t[79]!==ce||t[80]!==le||t[81]!==de||t[82]!==fe||t[83]!==pe?(he=(0,Q.jsxs)(`div`,{ref:ne,className:`relative h-full min-h-0`,children:[W,G,K,q,re,ie,oe,se,ce,le,de,fe,pe]}),t[72]=W,t[73]=G,t[74]=K,t[75]=q,t[76]=ie,t[77]=oe,t[78]=se,t[79]=ce,t[80]=le,t[81]=de,t[82]=fe,t[83]=pe,t[84]=he):he=t[84];',
      rootAfter: 't[72]!==W||t[73]!==G||t[74]!==K||t[75]!==q||t[76]!==ie||t[77]!==oe||t[78]!==se||t[79]!==ce||t[80]!==le||t[81]!==de||t[82]!==fe||t[83]!==pe||t[88]!==r?(he=(0,Q.jsxs)(`div`,{ref:ne,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[W,G,K,q,re,ie,oe,se,ce,le,de,fe,pe]}),t[72]=W,t[73]=G,t[74]=K,t[75]=q,t[76]=ie,t[77]=oe,t[78]=se,t[79]=ce,t[80]=le,t[81]=de,t[82]=fe,t[83]=pe,t[88]=r,t[84]=he):he=t[84];' }
    ,
    { name: "26.903.61454-8378", cacheBefore: "function $o(e){let t=(0,os.c)(88),", cacheAfter: "function $o(e){let t=(0,os.c)(89),",
      rootBefore: 't[72]!==K||t[73]!==q||t[74]!==re||t[75]!==ie||t[76]!==oe||t[77]!==se||t[78]!==ce||t[79]!==le||t[80]!==ue||t[81]!==de||t[82]!==fe||t[83]!==pe?(me=(0,Q.jsxs)(`div`,{ref:W,className:`relative h-full min-h-0`,children:[K,q,re,ie,ae,oe,se,ce,le,ue,de,fe,pe]}),t[72]=K,t[73]=q,t[74]=re,t[75]=ie,t[76]=oe,t[77]=se,t[78]=ce,t[79]=le,t[80]=ue,t[81]=de,t[82]=fe,t[83]=pe,t[84]=me):me=t[84];',
      rootAfter: 't[72]!==K||t[73]!==q||t[74]!==re||t[75]!==ie||t[76]!==oe||t[77]!==se||t[78]!==ce||t[79]!==le||t[80]!==ue||t[81]!==de||t[82]!==fe||t[83]!==pe||t[88]!==r?(me=(0,Q.jsxs)(`div`,{ref:W,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[K,q,re,ie,ae,oe,se,ce,le,ue,de,fe,pe]}),t[72]=K,t[73]=q,t[74]=re,t[75]=ie,t[76]=oe,t[77]=se,t[78]=ce,t[79]=le,t[80]=ue,t[81]=de,t[82]=fe,t[83]=pe,t[88]=r,t[84]=me):me=t[84];' }
    ,
    { name: "26.903.71938-8576", cacheBefore: "function $o(e){let t=(0,os.c)(88),", cacheAfter: "function $o(e){let t=(0,os.c)(89),",
      rootBefore: 't[72]!==re||t[73]!==Y||t[74]!==ie||t[75]!==ae||t[76]!==se||t[77]!==ce||t[78]!==le||t[79]!==ue||t[80]!==de||t[81]!==fe||t[82]!==pe||t[83]!==me?(he=(0,Q.jsxs)(`div`,{ref:J,className:`relative h-full min-h-0`,children:[re,Y,ie,ae,oe,se,ce,le,ue,de,fe,pe,me]}),t[72]=re,t[73]=Y,t[74]=ie,t[75]=ae,t[76]=se,t[77]=ce,t[78]=le,t[79]=ue,t[80]=de,t[81]=fe,t[82]=pe,t[83]=me,t[84]=he):he=t[84];',
      rootAfter: 't[72]!==re||t[73]!==Y||t[74]!==ie||t[75]!==ae||t[76]!==se||t[77]!==ce||t[78]!==le||t[79]!==ue||t[80]!==de||t[81]!==fe||t[82]!==pe||t[83]!==me||t[88]!==r?(he=(0,Q.jsxs)(`div`,{ref:J,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[re,Y,ie,ae,oe,se,ce,le,ue,de,fe,pe,me]}),t[72]=re,t[73]=Y,t[74]=ie,t[75]=ae,t[76]=se,t[77]=ce,t[78]=le,t[79]=ue,t[80]=de,t[81]=fe,t[82]=pe,t[83]=me,t[88]=r,t[84]=he):he=t[84];' }
    ,
    { name: "26.908.31457-8690", cacheBefore: "function rc(e){let t=(0,uc.c)(93),", cacheAfter: "function rc(e){let t=(0,uc.c)(94),",
      rootBefore: 't[76]!==W||t[77]!==G||t[78]!==K||t[79]!==q||t[80]!==ae||t[81]!==se||t[82]!==ce||t[83]!==le||t[84]!==ue||t[85]!==de||t[86]!==fe||t[87]!==pe||t[88]!==me?(he=(0,Q.jsxs)(`div`,{ref:j,className:`relative h-full min-h-0`,children:[W,G,K,q,ae,oe,se,ce,le,ue,de,fe,pe,me]}),t[76]=W,t[77]=G,t[78]=K,t[79]=q,t[80]=ae,t[81]=se,t[82]=ce,t[83]=le,t[84]=ue,t[85]=de,t[86]=fe,t[87]=pe,t[88]=me,t[89]=he):he=t[89];',
      rootAfter: 't[76]!==W||t[77]!==G||t[78]!==K||t[79]!==q||t[80]!==ae||t[81]!==se||t[82]!==ce||t[83]!==le||t[84]!==ue||t[85]!==de||t[86]!==fe||t[87]!==pe||t[88]!==me||t[93]!==r?(he=(0,Q.jsxs)(`div`,{ref:j,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[W,G,K,q,ae,oe,se,ce,le,ue,de,fe,pe,me]}),t[76]=W,t[77]=G,t[78]=K,t[79]=q,t[80]=ae,t[81]=se,t[82]=ce,t[83]=le,t[84]=ue,t[85]=de,t[86]=fe,t[87]=pe,t[88]=me,t[93]=r,t[89]=he):he=t[89];' }
  ];
  const matches = profiles.filter(profile => source.includes(profile.cacheBefore) && source.includes(profile.rootBefore));
  return matches.length === 1 ? matches[0] : null;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchAppInitial(file, workspaceRoot) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("function MTKuseTaskVisual(")) throw new Error("palette prototype already applied");
  const profile = appProfile(source);
  if (profile == null) throw new Error("unrecognized sidebar/bottom-fade ownership profile");

  let helper = String.raw`
const MTKpaletteRelativePath=".codex/task-visual-palette.json",MTKpaletteDefaults={canvas:11,userBubble:8,mappedBubble:40,genericBubble:16,sidebar:15,watermarkDark:9,watermarkLight:6},MTKpaletteRanges={canvas:[0,30],userBubble:[0,20],mappedBubble:[0,60],genericBubble:[0,30],sidebar:[0,35],watermarkDark:[0,20],watermarkLight:[0,20]};let MTKpalettePromiseKey=null,MTKpalettePromise=null,MTKsidebarObserver=null,MTKsidebarPalette=null,MTKsidebarQueued=!1;function MTKplainObject(e){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&Object.getPrototypeOf(e)===Object.prototype}function MTKjoinPath(e,t){return e.replace(/[\\/]+$/,"")+"/"+t}function MTKmissingFile(e){return e instanceof Error&&("code"in e&&e.code==="ENOENT"||e.message.includes("No such file or directory")||e.message.includes("(os error 2)"))}function MTKbase64Size(e){return Math.floor(e.length*3/4)-(e.endsWith("==")?2:+e.endsWith("="))}function MTKparseHex(e){return{r:parseInt(e.slice(1,3),16),g:parseInt(e.slice(3,5),16),b:parseInt(e.slice(5,7),16)}}function MTKhex(e){let t=n=>Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,"0");return("#"+t(e.r)+t(e.g)+t(e.b)).toUpperCase()}function MTKmix(e,t,n){let r=MTKparseHex(e),i=MTKparseHex(t);return MTKhex({r:r.r+(i.r-r.r)*n,g:r.g+(i.g-r.g)*n,b:r.b+(i.b-r.b)*n})}function MTKlum(e){let t=Object.values(MTKparseHex(e)).map(e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4});return.2126*t[0]+.7152*t[1]+.0722*t[2]}function MTKcontrast(e,t){let n=MTKlum(e),r=MTKlum(t);return(Math.max(n,r)+.05)/(Math.min(n,r)+.05)}function MTKderive(e,t,n){let r=n?1:.72,i=n?"#101114":"#FAFAFA",a=n?"#282A30":"#E7E9ED",o=n?"#14161A":"#ECEEF1",s=n?"#F2F3F5":"#18191C",c=MTKmix(i,e,t.canvas/100*r),l=MTKmix(a,e,t.mappedBubble/100*r),u=MTKmix(o,e,t.sidebar/100*r),d=MTKmix(o,e,(t.sidebar+5)/100*r),f=MTKmix(o,e,(t.sidebar+10)/100*r),p=n?MTKmix(e,"#FFFFFF",.19):MTKmix(e,"#111318",.18),m=n?MTKmix(e,"#FFFFFF",.38):MTKmix(e,"#111318",.34);return{canvas:c,bubble:l,row:u,hover:d,selected:f,accent:p,label:MTKcontrast(m,l)>=4.5?m:s,text:s}}function MTKvisualRule(e,t,n){let r=MTKderive(t.color,e,!0),i=MTKderive(t.color,e,!1);return{pattern:n,color:t.color,markDataUrl:t.markDataUrl??null,taskId:t.taskId??null,protectSidebarArchive:t.protectSidebarArchive===!0,dark:r,light:i,bubbleStyle:{backgroundColor:r.bubble,background:"light-dark("+i.bubble+","+r.bubble+")",boxShadow:"0 1px 8px color-mix(in srgb, "+r.accent+" 12%, transparent)"},attributionStyle:{color:"color-mix(in srgb, "+t.color+" 62%, var(--color-text) 38%)"}}}function MTKcalibration(e){if(e===void 0)return{...MTKpaletteDefaults};if(!MTKplainObject(e)||Object.keys(e).some(e=>!(e in MTKpaletteDefaults)))return null;let t={...MTKpaletteDefaults};for(let n of Object.keys(MTKpaletteDefaults)){if(e[n]===void 0)continue;let r=e[n],i=MTKpaletteRanges[n];if(typeof r!=="number"||!Number.isFinite(r)||r<i[0]||r>i[1])return null;t[n]=r}return t}async function MTKreadSafeFile(e,t,n,r){if(typeof n!=="string"||n.length===0||n.length>512||n.startsWith("/")||n.startsWith("\\")||/^[A-Za-z]:/.test(n)||n.includes("://")||n.includes("\\"))return null;let i=n.split("/");if(i.some(e=>e===""||e==="."||e===".."))return null;let a=t;try{for(let t=0;t<i.length;t++){a=MTKjoinPath(a,i[t]);let n=await e.sendRequest("fs/getMetadata",{path:a}),r=t===i.length-1;if(n.isSymlink||(r?!n.isFile:!n.isDirectory))return null}let{dataBase64:t}=await e.sendRequest("fs/readFile",{path:a});return MTKbase64Size(t)>r?null:t}catch{return null}}async function MTKfindPaletteFile(e,t){let n=MTKjoinPath(t,".codex"),r=MTKjoinPath(t,MTKpaletteRelativePath);try{let i=await e.sendRequest("fs/getMetadata",{path:n});if(!i.isDirectory||i.isSymlink)throw Error("unsafe palette directory");let a=await e.sendRequest("fs/getMetadata",{path:r});if(!a.isFile||a.isSymlink)throw Error("unsafe palette file");let{dataBase64:o}=await e.sendRequest("fs/readFile",{path:r});if(MTKbase64Size(o)>65536)throw Error("palette too large");return{ownerRoot:t,path:r,dataBase64:o}}catch(e){if(MTKmissingFile(e))return null;throw e}}async function MTKparsePalette(e,t,n){let r;try{r=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(e),e=>e.charCodeAt(0))))}catch{return null}if(!MTKplainObject(r)||Object.keys(r).some(e=>e!=="calibration"&&e!=="rules"))return null;let i=MTKcalibration(r.calibration);if(i==null||!MTKplainObject(r.rules))return null;let a=Object.entries(r.rules);if(a.length===0||a.length>64)return null;let o=[],s=new Set;for(let[e,r]of a){if(typeof e!=="string"||e.length===0||e.length>512||!MTKplainObject(r)||Object.keys(r).some(e=>e!=="color"&&e!=="mark"&&e!=="taskId"&&e!=="protectSidebarArchive")||typeof r.color!=="string"||!/^#[0-9A-Fa-f]{6}$/.test(r.color)||r.mark!==void 0&&typeof r.mark!=="string"||r.taskId!==void 0&&(typeof r.taskId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.taskId))||r.protectSidebarArchive!==void 0&&typeof r.protectSidebarArchive!=="boolean"||r.protectSidebarArchive===!0&&r.taskId===void 0)return null;let a;try{a=new RegExp(e)}catch{return null}if(r.taskId!==void 0&&(!a.test(r.taskId)||s.has(r.taskId)))return null;r.taskId!==void 0&&s.add(r.taskId);let c=null;if(r.mark!==void 0){if(!/\.svg$/i.test(r.mark))return null;let e=await MTKreadSafeFile(t,n,r.mark,65536);e!=null&&(c="data:image/svg+xml;base64,"+e)}o.push(MTKvisualRule(i,{color:r.color.toUpperCase(),markDataUrl:c,taskId:r.taskId,protectSidebarArchive:r.protectSidebarArchive},a))}return{calibration:i,rules:o,ownerRoot:n}}async function MTKloadPalette(e,t){try{let n=[...new Set(t.filter(e=>typeof e==="string"&&e.length>0))],r=[];for(let t of n){let n=await MTKfindPaletteFile(e,t);n!=null&&r.push(n)}if(r.length!==1)return null;let i=r[0];return await MTKparsePalette(i.dataBase64,e,i.ownerRoot)}catch{return null}}function MTKpaletteKey(e){return e.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]).filter(e=>typeof e==="string").sort().join("\0")}function MTKmatchPalette(e,t,n){if(e==null)return null;let r=typeof t==="string"?t:"",i=typeof n==="string"?n:"";for(let t of e.rules)if(t.pattern.test(r)||t.pattern.test(i))return t;return null}function MTKsidebarArchiveProtected(e,t=MTKsidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.protectSidebarArchive&&t.taskId===e)}function MTKensurePaletteStyle(){if(document.getElementById("mtk-task-visual-palette-style"))return;let e=document.createElement("style");e.id="mtk-task-visual-palette-style",e.textContent="[data-mtk-palette-room=true]{background-color:var(--mtk-room-dark)!important;isolation:isolate}[data-mtk-palette-mark=true]{background-color:var(--mtk-mark-dark);opacity:.075;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}[data-mtk-palette-row=true]{background-color:var(--mtk-row-dark)!important;box-shadow:inset 1px 0 0 var(--mtk-accent-dark)}[data-mtk-palette-row=true]:hover{background-color:var(--mtk-row-hover-dark)!important}[data-mtk-palette-row=true][data-app-action-sidebar-thread-selected=true],[data-mtk-palette-row=true][data-app-action-sidebar-thread-active=true]{background-color:var(--mtk-row-selected-dark)!important}html.electron-light [data-mtk-palette-room=true]{background-color:var(--mtk-room-light)!important}html.electron-light [data-mtk-palette-mark=true]{background-color:var(--mtk-mark-light);opacity:.05;filter:drop-shadow(0 1px 1px rgba(255,255,255,.5))}html.electron-light [data-mtk-palette-row=true]{background-color:var(--mtk-row-light)!important;box-shadow:inset 1px 0 0 var(--mtk-accent-light)}html.electron-light [data-mtk-palette-row=true]:hover{background-color:var(--mtk-row-hover-light)!important}html.electron-light [data-mtk-palette-row=true][data-app-action-sidebar-thread-selected=true],html.electron-light [data-mtk-palette-row=true][data-app-action-sidebar-thread-active=true]{background-color:var(--mtk-row-selected-light)!important}",document.head.appendChild(e)}function MTKclearSidebarRow(e){e.removeAttribute("data-mtk-palette-row");for(let t of["--mtk-row-dark","--mtk-row-light","--mtk-row-hover-dark","--mtk-row-hover-light","--mtk-row-selected-dark","--mtk-row-selected-light","--mtk-accent-dark","--mtk-accent-light"])e.style.removeProperty(t)}function MTKapplySidebar(e){for(let t of document.querySelectorAll("[data-app-action-sidebar-thread-row]")){let n=MTKmatchPalette(e,t.getAttribute("data-app-action-sidebar-thread-title"),t.getAttribute("data-app-action-sidebar-thread-id"));if(n==null){MTKclearSidebarRow(t);continue}t.setAttribute("data-mtk-palette-row","true"),t.style.setProperty("--mtk-row-dark",n.dark.row),t.style.setProperty("--mtk-row-light",n.light.row),t.style.setProperty("--mtk-row-hover-dark",n.dark.hover),t.style.setProperty("--mtk-row-hover-light",n.light.hover),t.style.setProperty("--mtk-row-selected-dark",n.dark.selected),t.style.setProperty("--mtk-row-selected-light",n.light.selected),t.style.setProperty("--mtk-accent-dark",n.dark.accent),t.style.setProperty("--mtk-accent-light",n.light.accent)}}function MTKqueueSidebar(){MTKsidebarQueued||(MTKsidebarQueued=!0,queueMicrotask(()=>{MTKsidebarQueued=!1,MTKsidebarPalette!=null&&MTKapplySidebar(MTKsidebarPalette)}))}function MTKinstallSidebar(e){if(e==null)return;MTKensurePaletteStyle(),MTKsidebarPalette=e,MTKapplySidebar(e),MTKsidebarObserver==null&&(MTKsidebarObserver=new MutationObserver(MTKqueueSidebar),MTKsidebarObserver.observe(document.body,{subtree:!0,childList:!0,attributes:!0,attributeFilter:["data-app-action-sidebar-thread-title","data-app-action-sidebar-thread-id","data-app-action-sidebar-thread-active","data-app-action-sidebar-thread-selected"]}))}function MTKuseTaskVisual(e,t){let n=Ss(Q),r=Y(Can),i=MTKpaletteKey(r),[a,o]=QSl.useState(null);return QSl.useEffect(()=>{let e=!1;if(i.length===0)return o(null),()=>{e=!0};let t=r.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]);return MTKpalettePromiseKey!==i&&(MTKpalettePromiseKey=i,MTKpalettePromise=MTKloadPalette(Qg(n,"local"),t)),MTKpalettePromise.then(t=>{e||(o(t),MTKinstallSidebar(t))}),()=>{e=!0}},[n,i]),MTKmatchPalette(a,e,t)}function MTKuseThreadVisual(e){let t=typeof e==="string"?Iy(e):null,n=bs(Zx,t),r=n?.kind==="local"?n.conversation?.title:n?.kind==="remote"?n.task?.title:null;return MTKuseTaskVisual(r,e)}
`;
  helper = helper.replace(previousThemeDerive, currentThemeDerive);
  if (!helper.includes(currentThemeDerive) || helper.includes(previousThemeDerive)) {
    throw new Error("unrecognized palette theme derivation");
  }

  const sidebarNullSafeHelper = helper
    .replace(
      'attributionStyle:{color:"color-mix(in srgb, "+t.color+" 62%, var(--color-text) 38%)"}',
      'attributionStyle:{color:"light-dark("+i.label+","+r.label+")"}'
    )
    .replace(
      'function MTKinstallSidebar(e){if(e==null)return;MTKensurePaletteStyle(),MTKsidebarPalette=e,MTKapplySidebar(e),',
      'function MTKinstallSidebar(e){if(MTKsidebarPalette=e,e==null){for(let e of document.querySelectorAll("[data-mtk-palette-row=true]"))MTKclearSidebarRow(e);return}MTKensurePaletteStyle(),MTKapplySidebar(e),'
    )
    .replace(
      'if(i.length===0)return o(null),()=>{e=!0};',
      'if(i.length===0)return o(null),MTKinstallSidebar(null),()=>{e=!0};'
    );
  if (
    sidebarNullSafeHelper === helper ||
    sidebarNullSafeHelper.includes("62%, var(--color-text)") ||
    sidebarNullSafeHelper.includes("function MTKinstallSidebar(e){if(e==null)return") ||
    !sidebarNullSafeHelper.includes("MTKinstallSidebar(null)")
  ) {
    throw new Error("unrecognized sidebar null-state helper");
  }

  const surfaceCss =
    '[data-user-message-bubble]{background-color:color-mix(in oklab,var(--color-text) var(--mtk-user-bubble-strength),transparent)!important}' +
    '[data-mtk-palette-source-id]:not([data-mtk-palette-delegation=true]) [data-user-message-bubble]{background-color:color-mix(in srgb,var(--color-token-interactive-label-accent-default,var(--color-token-text-link-foreground,#339cff)) var(--mtk-generic-bubble-strength),transparent)!important}' +
    universalSelectionOutlineCss +
    '[data-mtk-palette-row=true][data-app-action-sidebar-thread-selected=true],[data-mtk-palette-row=true][data-app-action-sidebar-thread-active=true]{box-shadow:inset 0 0 0 1px var(--mtk-accent-dark)!important}' +
    '[data-mtk-palette-room=true] ::selection{background-color:var(--mtk-selection-dark)}' +
    '[data-mtk-palette-room=true] [data-mtk-palette-bottom-fade]{--tw-gradient-from:var(--mtk-room-dark)!important;--tw-gradient-via:var(--mtk-room-dark)!important}' +
    '[data-mtk-palette-room=true][data-mtk-palette-mark=true]::before{content:"";position:absolute;z-index:-1;left:50%;top:48%;width:min(62vw,760px);height:min(62vw,760px);transform:translate(-50%,-50%);pointer-events:none;background-color:var(--mtk-mark-dark);opacity:var(--mtk-watermark-dark-opacity);-webkit-mask-image:var(--mtk-mark-image);mask-image:var(--mtk-mark-image);-webkit-mask-position:center;mask-position:center;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}' +
    '[data-mtk-palette-delegation=true]>button:first-child{color:var(--mtk-label-dark)!important}' +
    '[data-mtk-palette-delegation=true] [data-user-message-bubble]{background:var(--mtk-bubble-dark)!important;box-shadow:0 1px 8px color-mix(in srgb,var(--mtk-delegated-accent-dark) 12%,transparent)}' +
    '[data-mtk-palette-delegation=true] [data-user-message-bubble]::selection,[data-mtk-palette-delegation=true] [data-user-message-bubble] *::selection{background-color:var(--mtk-selection-dark)}' +
    'html.electron-light [data-mtk-palette-row=true][data-app-action-sidebar-thread-selected=true],html.electron-light [data-mtk-palette-row=true][data-app-action-sidebar-thread-active=true]{box-shadow:inset 0 0 0 1px var(--mtk-accent-light)!important}' +
    'html.electron-light [data-mtk-palette-room=true] ::selection{background-color:var(--mtk-selection-light)}' +
    'html.electron-light [data-mtk-palette-room=true] [data-mtk-palette-bottom-fade]{--tw-gradient-from:var(--mtk-room-light)!important;--tw-gradient-via:var(--mtk-room-light)!important}' +
    'html.electron-light [data-mtk-palette-room=true][data-mtk-palette-mark=true]::before{background-color:var(--mtk-mark-light);opacity:var(--mtk-watermark-light-opacity);filter:drop-shadow(0 1px 1px rgba(255,255,255,.5))}' +
    'html.electron-light [data-mtk-palette-delegation=true]>button:first-child{color:var(--mtk-label-light)!important}' +
    'html.electron-light [data-mtk-palette-delegation=true] [data-user-message-bubble]{background:var(--mtk-bubble-light)!important;box-shadow:0 1px 8px color-mix(in srgb,var(--mtk-delegated-accent-light) 12%,transparent)}' +
    'html.electron-light [data-mtk-palette-delegation=true] [data-user-message-bubble]::selection,html.electron-light [data-mtk-palette-delegation=true] [data-user-message-bubble] *::selection{background-color:var(--mtk-selection-light)}';
  const surfaceObserver = observerGateHelper + String.raw`function MTKremoveProperties(e,t){for(let n of t)e.style.removeProperty(n)}function MTKapplyCalibration(e){let t=document.documentElement;t.style.setProperty("--mtk-user-bubble-strength",e.calibration.userBubble+"%"),t.style.setProperty("--mtk-generic-bubble-strength",e.calibration.genericBubble+"%"),t.style.setProperty("--mtk-watermark-dark-opacity",e.calibration.watermarkDark/100),t.style.setProperty("--mtk-watermark-light-opacity",e.calibration.watermarkLight/100)}function MTKclearCalibration(){MTKremoveProperties(document.documentElement,["--mtk-user-bubble-strength","--mtk-generic-bubble-strength","--mtk-watermark-dark-opacity","--mtk-watermark-light-opacity"])}function MTKclearRoom(e){e.removeAttribute("data-mtk-palette-room"),e.removeAttribute("data-mtk-palette-mark"),MTKremoveProperties(e,["--mtk-room-dark","--mtk-room-light","--mtk-mark-dark","--mtk-mark-light","--mtk-mark-image"])}function MTKclearDelegation(e){e.removeAttribute("data-mtk-palette-delegation"),MTKremoveProperties(e,["--mtk-bubble-dark","--mtk-bubble-light","--mtk-label-dark","--mtk-label-light","--mtk-delegated-accent-dark","--mtk-delegated-accent-light"])}function MTKsidebarMetadata(e){for(let t of document.querySelectorAll("[data-app-action-sidebar-thread-row]"))if(t.getAttribute("data-app-action-sidebar-thread-id")===e)return{title:t.getAttribute("data-app-action-sidebar-thread-title"),id:e};return{title:null,id:e}}function MTKapplyPaletteSurfaces(e){MTKapplyCalibration(e),MTKapplySidebar(e);for(let t of document.querySelectorAll("[data-mtk-palette-room-host]")){let n=t.getAttribute("data-mtk-palette-thread-id"),r=MTKsidebarMetadata(n),i=MTKmatchPalette(e,r.title,r.id);if(i==null){MTKclearRoom(t);continue}t.setAttribute("data-mtk-palette-room","true"),t.style.setProperty("--mtk-room-dark",i.dark.canvas),t.style.setProperty("--mtk-room-light",i.light.canvas);if(i.markDataUrl==null)t.removeAttribute("data-mtk-palette-mark"),t.style.removeProperty("--mtk-mark-image");else{t.setAttribute("data-mtk-palette-mark","true"),t.style.setProperty("--mtk-mark-image",'url("'+i.markDataUrl+'")')}t.style.setProperty("--mtk-mark-dark",i.dark.accent),t.style.setProperty("--mtk-mark-light",i.light.accent)}for(let t of document.querySelectorAll("[data-mtk-palette-source-id]")){let n=MTKmatchPalette(e,t.getAttribute("data-mtk-palette-source-title"),t.getAttribute("data-mtk-palette-source-id"));if(n==null){MTKclearDelegation(t);continue}t.setAttribute("data-mtk-palette-delegation","true"),t.style.setProperty("--mtk-bubble-dark",n.dark.bubble),t.style.setProperty("--mtk-bubble-light",n.light.bubble),t.style.setProperty("--mtk-label-dark",n.dark.label),t.style.setProperty("--mtk-label-light",n.light.label),t.style.setProperty("--mtk-delegated-accent-dark",n.dark.accent),t.style.setProperty("--mtk-delegated-accent-light",n.light.accent)}}function MTKclearPaletteSurfaces(){MTKclearCalibration();for(let e of document.querySelectorAll("[data-mtk-palette-row=true]"))MTKclearSidebarRow(e);for(let e of document.querySelectorAll("[data-mtk-palette-room-host]"))MTKclearRoom(e);for(let e of document.querySelectorAll("[data-mtk-palette-source-id]"))MTKclearDelegation(e)}`;

  let domOnlyHelper = sidebarNullSafeHelper
    .replace(
      'label:MTKcontrast(m,l)>=4.5?m:s,text:s}}function MTKvisualRule',
      'label:MTKcontrast(m,l)>=4.5?m:s,selection:n?MTKmix("#20232A",e,.4):MTKmix("#F2F4F7",e,.34),text:s}}function MTKvisualRule'
    )
    .replace(
      ',bubbleStyle:{backgroundColor:r.bubble,background:"light-dark("+i.bubble+","+r.bubble+")",boxShadow:"0 1px 8px color-mix(in srgb, "+r.accent+" 12%, transparent)"},attributionStyle:{color:"light-dark("+i.label+","+r.label+")"}',
      ""
    )
    .replaceAll(";box-shadow:inset 1px 0 0 var(--mtk-accent-dark)", "")
    .replaceAll(";box-shadow:inset 1px 0 0 var(--mtk-accent-light)", "")
    .replace(
      '[data-mtk-palette-row=true]{background-color:var(--mtk-row-dark)!important}[data-mtk-palette-row=true]:hover{background-color:var(--mtk-row-hover-dark)!important}',
      '[data-mtk-palette-row=true]{position:relative}[data-mtk-palette-row=true]::before{content:\\\"\\\";position:absolute;z-index:1;inset-inline-start:12px;top:50%;width:9px;height:9px;border-radius:999px;transform:translateY(-50%);background-color:var(--mtk-sidebar-chip);box-shadow:0 0 0 1px color-mix(in srgb,var(--color-text) 18%,transparent);pointer-events:none}[data-mtk-palette-row=true][data-mtk-palette-sidebar-context=loose]{padding-inline-start:calc(var(--padding-row-cell-x,var(--padding-row-x)) + 14px)!important}[data-mtk-palette-row=true][data-mtk-palette-sidebar-context=loose]::before{inset-inline-start:8px}'
    )
    .replace(
      'html.electron-light [data-mtk-palette-row=true]{background-color:var(--mtk-row-light)!important}html.electron-light [data-mtk-palette-row=true]:hover{background-color:var(--mtk-row-hover-light)!important}',
      ""
    )
    .replace(
      'function MTKclearSidebarRow(e){e.removeAttribute("data-mtk-palette-row");for(let t of["--mtk-row-dark","--mtk-row-light","--mtk-row-hover-dark","--mtk-row-hover-light","--mtk-row-selected-dark","--mtk-row-selected-light","--mtk-accent-dark","--mtk-accent-light"])e.style.removeProperty(t)}',
      'function MTKclearSidebarRow(e){e.removeAttribute("data-mtk-palette-row"),e.removeAttribute("data-mtk-palette-sidebar-context");for(let t of["--mtk-row-selected-dark","--mtk-row-selected-light","--mtk-accent-dark","--mtk-accent-light","--mtk-sidebar-chip"])e.style.removeProperty(t)}'
    )
    .replace(
      't.setAttribute("data-mtk-palette-row","true"),t.style.setProperty("--mtk-row-dark",n.dark.row),t.style.setProperty("--mtk-row-light",n.light.row),t.style.setProperty("--mtk-row-hover-dark",n.dark.hover),t.style.setProperty("--mtk-row-hover-light",n.light.hover),t.style.setProperty("--mtk-row-selected-dark",n.dark.selected),t.style.setProperty("--mtk-row-selected-light",n.light.selected),t.style.setProperty("--mtk-accent-dark",n.dark.accent),t.style.setProperty("--mtk-accent-light",n.light.accent)',
      't.setAttribute("data-mtk-palette-row","true"),t.setAttribute("data-mtk-palette-sidebar-context",t.closest("[data-app-action-sidebar-project-list-id]")!=null?"project":"loose"),t.style.setProperty("--mtk-row-selected-dark",n.dark.selected),t.style.setProperty("--mtk-row-selected-light",n.light.selected),t.style.setProperty("--mtk-accent-dark",n.dark.accent),t.style.setProperty("--mtk-accent-light",n.light.accent),t.style.setProperty("--mtk-sidebar-chip",n.color)'
    )
    .replace('[data-mtk-palette-mark=true]{background-color:var(--mtk-mark-dark);opacity:.075;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}', "")
    .replace('html.electron-light [data-mtk-palette-mark=true]{background-color:var(--mtk-mark-light);opacity:.05;filter:drop-shadow(0 1px 1px rgba(255,255,255,.5))}', "")
    .replace(
      '",document.head.appendChild(e)}function MTKclearSidebarRow',
      `"+${JSON.stringify(surfaceCss)},document.head.appendChild(e)}function MTKclearSidebarRow`
    )
    .replace("function MTKqueueSidebar", surfaceObserver + "function MTKqueueSidebar")
    .replace(
      "function MTKqueueSidebar(){",
      "function MTKqueueSidebar(e){if(!MTKpaletteMutationRelevant(e))return;"
    )
    .replace(
      '["--mtk-room-dark","--mtk-room-light","--mtk-mark-dark","--mtk-mark-light","--mtk-mark-image"]',
      '["--mtk-room-dark","--mtk-room-light","--mtk-selection-dark","--mtk-selection-light","--mtk-mark-dark","--mtk-mark-light","--mtk-mark-image"]'
    )
    .replace(
      't.style.setProperty("--mtk-room-light",i.light.canvas);if',
      't.style.setProperty("--mtk-room-light",i.light.canvas),t.style.setProperty("--mtk-selection-dark",i.dark.selection),t.style.setProperty("--mtk-selection-light",i.light.selection);if'
    )
    .replace(
      '["--mtk-bubble-dark","--mtk-bubble-light","--mtk-label-dark","--mtk-label-light","--mtk-delegated-accent-dark","--mtk-delegated-accent-light"]',
      '["--mtk-bubble-dark","--mtk-bubble-light","--mtk-selection-dark","--mtk-selection-light","--mtk-label-dark","--mtk-label-light","--mtk-delegated-accent-dark","--mtk-delegated-accent-light"]'
    )
    .replace(
      't.style.setProperty("--mtk-bubble-light",n.light.bubble),t.style.setProperty("--mtk-label-dark"',
      't.style.setProperty("--mtk-bubble-light",n.light.bubble),t.style.setProperty("--mtk-selection-dark",n.dark.selection),t.style.setProperty("--mtk-selection-light",n.light.selection),t.style.setProperty("--mtk-label-dark"'
    )
    .replace("MTKsidebarPalette!=null&&MTKapplySidebar(MTKsidebarPalette)", "MTKsidebarPalette!=null&&MTKapplyPaletteSurfaces(MTKsidebarPalette)")
    .replace("MTKensurePaletteStyle(),MTKapplySidebar(e),", "MTKensurePaletteStyle(),MTKapplyPaletteSurfaces(e),")
    .replace(
      'if(MTKsidebarPalette=e,e==null){for(let e of document.querySelectorAll("[data-mtk-palette-row=true]"))MTKclearSidebarRow(e);return}',
      "if(MTKsidebarPalette=e,e==null){MTKclearPaletteSurfaces();return}"
    )
    .replace(
      'function MTKuseTaskVisual(e,t){let n=Ss(Q),r=Y(Can),i=MTKpaletteKey(r),[a,o]=QSl.useState(null);return QSl.useEffect(()=>{let e=!1;if(i.length===0)return o(null),MTKinstallSidebar(null),()=>{e=!0};let t=r.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]);return MTKpalettePromiseKey!==i&&(MTKpalettePromiseKey=i,MTKpalettePromise=MTKloadPalette(Qg(n,"local"),t)),MTKpalettePromise.then(t=>{e||(o(t),MTKinstallSidebar(t))}),()=>{e=!0}},[n,i]),MTKmatchPalette(a,e,t)}function MTKuseThreadVisual(e){let t=typeof e==="string"?Iy(e):null,n=bs(Zx,t),r=n?.kind==="local"?n.conversation?.title:n?.kind==="remote"?n.task?.title:null;return MTKuseTaskVisual(r,e)}',
      'async function MTKloadPaletteWhenReady(e,t){try{return e.get($g)==null&&await e.when(({get:e})=>e($g)!=null),await MTKloadPalette(Qg(e,"local"),t)}catch{return null}}function MTKusePaletteBootstrap(){let e=Ss(Q),t=Y(Can),n=MTKpaletteKey(t);return QSl.useEffect(()=>{let r=!1;if(n.length===0)return MTKinstallSidebar(null),()=>{r=!0};let i=t.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]);return MTKpalettePromiseKey!==n&&(MTKpalettePromiseKey=n,MTKpalettePromise=MTKloadPaletteWhenReady(e,i)),MTKpalettePromise.then(e=>{r||MTKinstallSidebar(e)}),()=>{r=!0}},[e,n]),null}'
    );
  for (const contract of ["MTKapplyPaletteSurfaces", "data-mtk-palette-delegation", "data-mtk-palette-sidebar-context", "--mtk-sidebar-chip", "::before", "::selection", "selection:n?MTKmix", "MTKclearPaletteSurfaces"]) {
    if (!domOnlyHelper.includes(contract)) throw new Error(`missing DOM-only palette contract ${contract}`);
  }
  if (domOnlyHelper.includes("box-shadow:inset 1px 0 0")) throw new Error("rejected sidebar accent remains");
  if (domOnlyHelper.includes("[data-mtk-palette-mark=true]{background-color")) {
    throw new Error("legacy whole-room mark opacity remains");
  }

  if (domOnlyHelper.includes("MTKuseTaskVisual") || domOnlyHelper.includes("MTKuseThreadVisual")) {
    throw new Error("obsolete palette React hooks remain");
  }
  domOnlyHelper = replaceOnce(
    domOnlyHelper,
    'function MTKsidebarArchiveProtected(e,t=MTKsidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.protectSidebarArchive&&t.taskId===e)}function MTKensurePaletteStyle()',
    'function MTKsidebarArchiveProtected(e,t=MTKsidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.protectSidebarArchive&&t.taskId===e)}globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected;function MTKensurePaletteStyle()',
    "palette archive classifier bridge"
  );
  domOnlyHelper = addReasoningPolicyBridge(domOnlyHelper, "MTK");
  domOnlyHelper = addModelPinPolicyBridge(domOnlyHelper, "MTK");
  if (profile.fixedOwnerRoot === true) {
    const bootstrap = /function MTKusePaletteBootstrap\(\)\{let e=Ss\(Q\),t=Y\(Can\),n=MTKpaletteKey\(t\);return QSl\.useEffect\(\(\)=>\{let r=!1;if\(n\.length===0\)return MTKinstallSidebar\(null\),\(\)=>\{r=!0\};let i=t\.filter\(e=>e\.projectKind==="local"\)\.flatMap\(e=>e\.rootPaths\?\?\[\]\);return MTKpalettePromiseKey!==n&&\(MTKpalettePromiseKey=n,MTKpalettePromise=MTKloadPaletteWhenReady\(e,i\)\),MTKpalettePromise\.then\(e=>\{r\|\|MTKinstallSidebar\(e\)\}\),\(\)=>\{r=!0\}\},\[e,n\]\),null\}/;
    const replacement = `function MTKusePaletteBootstrap(){let e=A_($),t=${JSON.stringify(workspaceRoot)};return x$c.useEffect(()=>{let n=!1;return MTKpalettePromiseKey!==t&&(MTKpalettePromiseKey=t,MTKpalettePromise=MTKloadPaletteWhenReady(e,[t])),MTKpalettePromise.then(e=>{n||MTKinstallSidebar(e)}),()=>{n=!0}},[e]),null}`;
    const matches = domOnlyHelper.match(bootstrap);
    if (matches == null) throw new Error(`${profile.name} fixed palette owner bootstrap is missing`);
    domOnlyHelper = domOnlyHelper.replace(bootstrap, replacement);
  }
  domOnlyHelper = addPaletteRuntimeReload(domOnlyHelper, profile.fixedOwnerRoot === true, workspaceRoot);
  for (const [before, after] of profile.helperReplacements) {
    domOnlyHelper = replaceOnce(domOnlyHelper, before, after, `${profile.name} helper alias ${before}`);
  }
  source = replaceOnce(source, profile.seam, domOnlyHelper + profile.patchedSeam, "sidebar palette bootstrap");
  fs.writeFileSync(file, source);
}

function patchLightTheme(file) {
  let source = fs.readFileSync(file, "utf8");
  source = replaceOnce(source, previousThemeDerive, currentThemeDerive, "light palette derivation");
  fs.writeFileSync(file, source);
}

function addPaletteRuntimeReload(source, fixedOwnerRoot, workspaceRoot) {
  const dynamicBefore = 'function MTKusePaletteBootstrap(){let e=Ss(Q),t=Y(Can),n=MTKpaletteKey(t);return QSl.useEffect(()=>{let r=!1;if(n.length===0)return MTKinstallSidebar(null),()=>{r=!0};let i=t.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]);return MTKpalettePromiseKey!==n&&(MTKpalettePromiseKey=n,MTKpalettePromise=MTKloadPaletteWhenReady(e,i)),MTKpalettePromise.then(e=>{r||MTKinstallSidebar(e)}),()=>{r=!0}},[e,n]),null}';
  const dynamicAfter = 'async function MTKacceptPaletteReload(e,t,n,r){let i=await MTKloadPaletteWhenReady(e,t);return r()&&(i!=null||n?.initial===!0)?(MTKinstallSidebar(i),i!=null):!1}function MTKusePaletteBootstrap(){let e=Ss(Q),t=Y(Can),n=MTKpaletteKey(t);return QSl.useEffect(()=>{let r=!1;if(n.length===0)return MTKinstallSidebar(null),()=>{r=!0};let i=t.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]),a=globalThis.__MTK_RUNTIME_JSON_RELOAD__?.register("task-visual-palette.json",t=>MTKacceptPaletteReload(e,i,t,()=>!r));if(typeof a==="function")return()=>{r=!0,a()};return MTKpalettePromiseKey!==n&&(MTKpalettePromiseKey=n,MTKpalettePromise=MTKloadPaletteWhenReady(e,i)),MTKpalettePromise.then(e=>{r||MTKinstallSidebar(e)}),()=>{r=!0}},[e,n]),null}';
  if (!fixedOwnerRoot) return replaceOnce(source, dynamicBefore, dynamicAfter, "palette runtime reload callback");

  const fixedBefore = `function MTKusePaletteBootstrap(){let e=A_($),t=${JSON.stringify(workspaceRoot)};return x$c.useEffect(()=>{let n=!1;return MTKpalettePromiseKey!==t&&(MTKpalettePromiseKey=t,MTKpalettePromise=MTKloadPaletteWhenReady(e,[t])),MTKpalettePromise.then(e=>{n||MTKinstallSidebar(e)}),()=>{n=!0}},[e]),null}`;
  const fixedAfter = `async function MTKacceptPaletteReload(e,t,n,r){let i=await MTKloadPaletteWhenReady(e,t);return r()&&(i!=null||n?.initial===!0)?(MTKinstallSidebar(i),i!=null):!1}function MTKusePaletteBootstrap(){let e=A_($),t=${JSON.stringify(workspaceRoot)};return x$c.useEffect(()=>{let n=!1,r=globalThis.__MTK_RUNTIME_JSON_RELOAD__?.register("task-visual-palette.json",r=>MTKacceptPaletteReload(e,[t],r,()=>!n));if(typeof r==="function")return()=>{n=!0,r()};return MTKpalettePromiseKey!==t&&(MTKpalettePromiseKey=t,MTKpalettePromise=MTKloadPaletteWhenReady(e,[t])),MTKpalettePromise.then(e=>{n||MTKinstallSidebar(e)}),()=>{n=!0}},[e]),null}`;
  return replaceOnce(source, fixedBefore, fixedAfter, "fixed-owner palette runtime reload callback");
}

function patchBottomFade(appFile, primaryFile) {
  let appSource = fs.readFileSync(appFile, "utf8");
  let primarySource = fs.readFileSync(primaryFile, "utf8");
  const profile = bottomFadeProfile(appSource, primarySource);
  if (profile == null) throw new Error("unrecognized thread footer bottom-fade ownership profile");
  if (profile.file === "app-initial") {
    appSource = replaceOnce(appSource, profile.before, profile.after, "thread footer bottom fade");
    fs.writeFileSync(appFile, appSource);
  } else {
    primarySource = replaceOnce(primarySource, profile.before, profile.after, "thread footer bottom fade");
    fs.writeFileSync(primaryFile, primarySource);
  }
}

function patchUniversalSelectionOutline(file) {
  let source = fs.readFileSync(file, "utf8");
  const mappedOutline = "[data-mtk-palette-row=true][data-app-action-sidebar-thread-selected=true],[data-mtk-palette-row=true][data-app-action-sidebar-thread-active=true]{box-shadow:inset 0 0 0 1px var(--mtk-accent-dark)!important}";
  source = replaceOnce(
    source,
    mappedOutline,
    universalSelectionOutlineCss + mappedOutline,
    "universal sidebar selection outline"
  );
  fs.writeFileSync(file, source);
}

function patchObserverGate(file) {
  let source = fs.readFileSync(file, "utf8");
  source = replaceOnce(
    source,
    "function MTKremoveProperties(e,t)",
    observerGateHelper + "function MTKremoveProperties(e,t)",
    "palette mutation relevance helper"
  );
  source = replaceOnce(
    source,
    "function MTKqueueSidebar(){",
    "function MTKqueueSidebar(e){if(!MTKpaletteMutationRelevant(e))return;",
    "palette observer relevance gate"
  );
  fs.writeFileSync(file, source);
}

function patchPaletteArchiveSchema(file) {
  let source = fs.readFileSync(file, "utf8");
  source = replaceOnce(
    source,
    "return{pattern:n,color:t.color,markDataUrl:t.markDataUrl??null,dark:r,light:i}",
    "return{pattern:n,color:t.color,markDataUrl:t.markDataUrl??null,taskId:t.taskId??null,protectSidebarArchive:t.protectSidebarArchive===!0,dark:r,light:i}",
    "palette archive metadata"
  );
  source = replaceOnce(
    source,
    'let o=[];for(let[e,r]of a){if(typeof e!=="string"||e.length===0||e.length>512||!MTKplainObject(r)||Object.keys(r).some(e=>e!=="color"&&e!=="mark")||typeof r.color!=="string"||!/^#[0-9A-Fa-f]{6}$/.test(r.color)||r.mark!==void 0&&typeof r.mark!=="string")return null;let a;try{a=new RegExp(e)}catch{return null}let s=null;if(r.mark!==void 0){if(!/\\.svg$/i.test(r.mark))return null;let e=await MTKreadSafeFile(t,n,r.mark,65536);e!=null&&(s="data:image/svg+xml;base64,"+e)}o.push(MTKvisualRule(i,{color:r.color.toUpperCase(),markDataUrl:s},a))}',
    'let o=[],s=new Set;for(let[e,r]of a){if(typeof e!=="string"||e.length===0||e.length>512||!MTKplainObject(r)||Object.keys(r).some(e=>e!=="color"&&e!=="mark"&&e!=="taskId"&&e!=="protectSidebarArchive")||typeof r.color!=="string"||!/^#[0-9A-Fa-f]{6}$/.test(r.color)||r.mark!==void 0&&typeof r.mark!=="string"||r.taskId!==void 0&&(typeof r.taskId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.taskId))||r.protectSidebarArchive!==void 0&&typeof r.protectSidebarArchive!=="boolean"||r.protectSidebarArchive===!0&&r.taskId===void 0)return null;let a;try{a=new RegExp(e)}catch{return null}if(r.taskId!==void 0&&(!a.test(r.taskId)||s.has(r.taskId)))return null;r.taskId!==void 0&&s.add(r.taskId);let c=null;if(r.mark!==void 0){if(!/\\.svg$/i.test(r.mark))return null;let e=await MTKreadSafeFile(t,n,r.mark,65536);e!=null&&(c="data:image/svg+xml;base64,"+e)}o.push(MTKvisualRule(i,{color:r.color.toUpperCase(),markDataUrl:c,taskId:r.taskId,protectSidebarArchive:r.protectSidebarArchive},a))}',
    "palette archive schema"
  );
  source = replaceOnce(
    source,
    'function MTKsidebarArchiveProtected(e,t=MTKsidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.protectSidebarArchive&&t.taskId===e)}function MTKensurePaletteStyle()',
    'function MTKsidebarArchiveProtected(e,t=MTKsidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.protectSidebarArchive&&t.taskId===e)}globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected;function MTKensurePaletteStyle()',
    "palette sidebar archive classifier"
  );
  fs.writeFileSync(file, source);
}

function patchReasoningPolicyBridge(file) {
  const source = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, addReasoningPolicyBridge(source, "MTK"));
}

function patchModelPinPolicyBridge(file) {
  const source = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, addModelPinPolicyBridge(source, "MTK"));
}

function addReasoningPolicyBridge(source, prefix) {
  const visualRuleBefore = `return{pattern:n,color:t.color,markDataUrl:t.markDataUrl??null,taskId:t.taskId??null,protectSidebarArchive:t.protectSidebarArchive===!0,dark:r,light:i}`;
  const visualRuleAfter = `return{pattern:n,color:t.color,markDataUrl:t.markDataUrl??null,taskId:t.taskId??null,protectSidebarArchive:t.protectSidebarArchive===!0,keepReasoningOpen:t.keepReasoningOpen===!0,dark:r,light:i}`;
  source = replaceOnce(source, visualRuleBefore, visualRuleAfter, "palette reasoning metadata");
  source = replaceOnce(
    source,
    'e!=="taskId"&&e!=="protectSidebarArchive")',
    'e!=="taskId"&&e!=="protectSidebarArchive"&&e!=="keepReasoningOpen")',
    "palette reasoning key"
  );
  source = replaceOnce(
    source,
    'r.protectSidebarArchive!==void 0&&typeof r.protectSidebarArchive!=="boolean"||r.protectSidebarArchive===!0&&r.taskId===void 0',
    'r.protectSidebarArchive!==void 0&&typeof r.protectSidebarArchive!=="boolean"||r.protectSidebarArchive===!0&&r.taskId===void 0||r.keepReasoningOpen!==void 0&&typeof r.keepReasoningOpen!=="boolean"||r.keepReasoningOpen===!0&&r.taskId===void 0',
    "palette reasoning validation"
  );
  source = replaceOnce(
    source,
    'protectSidebarArchive:r.protectSidebarArchive},a))',
    'protectSidebarArchive:r.protectSidebarArchive,keepReasoningOpen:r.keepReasoningOpen},a))',
    "palette reasoning projection"
  );
  const archiveBridge = `function ${prefix}sidebarArchiveProtected(e,t=${prefix}sidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.protectSidebarArchive&&t.taskId===e)}globalThis.__MTKsidebarArchiveProtected=${prefix}sidebarArchiveProtected;`;
  const reasoningBridge = `const ${prefix}reasoningListeners=new Set;function MTKreasoningShouldStayOpen(e,t=${prefix}sidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.keepReasoningOpen===!0&&t.taskId===e)}function ${prefix}reasoningSubscribe(e){return ${prefix}reasoningListeners.add(e),()=>${prefix}reasoningListeners.delete(e)}globalThis.__MTKreasoningShouldStayOpen=MTKreasoningShouldStayOpen;globalThis.__MTKreasoningSubscribe=${prefix}reasoningSubscribe;`;
  source = replaceOnce(source, archiveBridge, archiveBridge + reasoningBridge, "palette reasoning bridge");
  source = replaceOnce(
    source,
    `function ${prefix}installSidebar(e){if(${prefix}sidebarPalette=e,e==null){`,
    `function ${prefix}installSidebar(e){${prefix}sidebarPalette=e;for(let t of ${prefix}reasoningListeners)t();if(e==null){`,
    "palette reasoning update notification"
  );
  return source;
}

function addModelPinPolicyBridge(source, prefix) {
  const visualRuleBefore = `return{pattern:n,color:t.color,markDataUrl:t.markDataUrl??null,taskId:t.taskId??null,protectSidebarArchive:t.protectSidebarArchive===!0,keepReasoningOpen:t.keepReasoningOpen===!0,dark:r,light:i}`;
  const visualRuleAfter = `return{pattern:n,color:t.color,markDataUrl:t.markDataUrl??null,taskId:t.taskId??null,protectSidebarArchive:t.protectSidebarArchive===!0,keepReasoningOpen:t.keepReasoningOpen===!0,modelPin:t.modelPin??null,dark:r,light:i}`;
  source = replaceOnce(source, visualRuleBefore, visualRuleAfter, "palette model-pin metadata");
  source = replaceOnce(
    source,
    'e!=="taskId"&&e!=="protectSidebarArchive"&&e!=="keepReasoningOpen")',
    'e!=="taskId"&&e!=="protectSidebarArchive"&&e!=="keepReasoningOpen"&&e!=="modelPin")',
    "palette model-pin key"
  );
  source = replaceOnce(
    source,
    'r.keepReasoningOpen!==void 0&&typeof r.keepReasoningOpen!=="boolean"||r.keepReasoningOpen===!0&&r.taskId===void 0',
    'r.keepReasoningOpen!==void 0&&typeof r.keepReasoningOpen!=="boolean"||r.keepReasoningOpen===!0&&r.taskId===void 0||r.modelPin!==void 0&&(!MTKplainObject(r.modelPin)||Object.keys(r.modelPin).some(e=>e!=="model"&&e!=="reasoningEffort")||typeof r.modelPin.model!=="string"||r.modelPin.model.length===0||r.modelPin.model.length>128||typeof r.modelPin.reasoningEffort!=="string"||!MTKmodelPinEfforts.has(r.modelPin.reasoningEffort)||r.taskId===void 0)',
    "palette model-pin validation"
  );
  source = replaceOnce(
    source,
    'protectSidebarArchive:r.protectSidebarArchive,keepReasoningOpen:r.keepReasoningOpen},a))',
    'protectSidebarArchive:r.protectSidebarArchive,keepReasoningOpen:r.keepReasoningOpen,modelPin:r.modelPin},a))',
    "palette model-pin projection"
  );
  const reasoningBridge = `const ${prefix}reasoningListeners=new Set;function MTKreasoningShouldStayOpen(e,t=${prefix}sidebarPalette){return typeof e==="string"&&t!=null&&t.rules.some(t=>t.keepReasoningOpen===!0&&t.taskId===e)}function ${prefix}reasoningSubscribe(e){return ${prefix}reasoningListeners.add(e),()=>${prefix}reasoningListeners.delete(e)}globalThis.__MTKreasoningShouldStayOpen=MTKreasoningShouldStayOpen;globalThis.__MTKreasoningSubscribe=${prefix}reasoningSubscribe;`;
  const modelPinBridge = `const ${prefix}modelPinEfforts=new Set(["none","minimal","low","medium","high","xhigh","max","ultra","persistent"]),${prefix}modelPinListeners=new Set;function MTKmodelPinForTask(e,t=${prefix}sidebarPalette){if(typeof e!=="string"||t==null)return null;let n=t.rules.find(t=>t.taskId===e);return n?.modelPin??null}function ${prefix}modelPinSubscribe(e){return ${prefix}modelPinListeners.add(e),()=>${prefix}modelPinListeners.delete(e)}globalThis.__MTKmodelPinForTask=MTKmodelPinForTask;globalThis.__MTKmodelPinSubscribe=${prefix}modelPinSubscribe;`;
  source = replaceOnce(source, reasoningBridge, reasoningBridge + modelPinBridge, "palette model-pin bridge");
  source = replaceOnce(
    source,
    `function ${prefix}installSidebar(e){${prefix}sidebarPalette=e;for(let t of ${prefix}reasoningListeners)t();if(e==null){`,
    `function ${prefix}installSidebar(e){${prefix}sidebarPalette=e;for(let t of ${prefix}reasoningListeners)t();for(let t of ${prefix}modelPinListeners)t();if(e==null){`,
    "palette model-pin update notification"
  );
  return source;
}

function patchSidebarArchiveAffordances(file, primaryFile) {
  let source = fs.readFileSync(file, "utf8");
  let primarySource = fs.readFileSync(primaryFile, "utf8");
  if (primarySource.includes("function e3t({scope:e,target:t,actions:n,onRename:r,onArchive:i,")) {
    primarySource = replaceOnce(
      primarySource,
      "function e3t({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function e3t({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "build-8690 archive classifier bridge"
    );
    primarySource = replaceOnce(primarySource, "archive:D?void 0:{id:`archive-thread`,message:void 0,onSelect:()=>{i()}}", "archive:D||MTKsidebarArchiveProtected(_)?void 0:{id:`archive-thread`,message:void 0,onSelect:()=>{i()}}", "build-8690 local context archive item");
    primarySource = replaceOnce(
      primarySource,
      "function h3t({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
      "function h3t({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
      "build-8690 bulk archive filter"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:R$t(T,r),threadKey:r})",
      "selectedThreadKeys:R$t(T,r),threadKey:r,archiveProtected:R$t(T,r).some(e=>{let t=T.get(jt,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-8690 local protected selection"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:R$t(ee,e),threadKey:e})",
      "selectedThreadKeys:R$t(ee,e),threadKey:e,archiveProtected:R$t(ee,e).some(e=>{let t=ee.get(jt,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-8690 unified protected selection"
    );
    primarySource = replaceOnce(primarySource, "archive:t!=null&&(Oe||B)?Fe:t,getMenuItems:", "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Oe||B)?Fe:t,getMenuItems:", "build-8690 local inline archive");
    primarySource = replaceOnce(primarySource, "He=Ce?Me:null", "He=Ce&&!MTKsidebarArchiveProtected(se)?Me:null", "build-8690 cloud inline archive");
    primarySource = replaceOnce(primarySource, "if(Ce&&e.push({id:`archive-task`", "if(Ce&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`", "build-8690 cloud context archive item");
    primarySource = replaceOnce(
      primarySource,
      "archive:n,getMenuItems:K?e=>d([",
      "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d([",
      "build-8690 remote row archive"
    );
    fs.writeFileSync(primaryFile, primarySource);
    return;
  }
  if (primarySource.includes("function WFn({scope:e,target:t,actions:n,onRename:r,onArchive:i,")) {
    primarySource = replaceOnce(
      primarySource,
      "function WFn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function WFn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "build-8576 archive classifier bridge"
    );
    primarySource = replaceOnce(primarySource, "archive:w?void 0:{id:`archive-thread`,onSelect:()=>i()}", "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}", "build-8576 local context archive item");
    primarySource = replaceOnce(
      primarySource,
      "function aIn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
      "function aIn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
      "build-8576 bulk archive filter"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:Sjn(T,r),threadKey:r})",
      "selectedThreadKeys:Sjn(T,r),threadKey:r,archiveProtected:Sjn(T,r).some(e=>{let t=T.get(Kt,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-8576 local protected selection"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:Sjn(G,e),threadKey:e})",
      "selectedThreadKeys:Sjn(G,e),threadKey:e,archiveProtected:Sjn(G,e).some(e=>{let t=G.get(Kt,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-8576 unified protected selection"
    );
    primarySource = replaceOnce(primarySource, "archive:t!=null&&(Ee||L)?Ne:t,getMenuItems:", "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Ne:t,getMenuItems:", "build-8576 local inline archive");
    primarySource = replaceOnce(primarySource, "Ve=Se?Me:null", "Ve=Se&&!MTKsidebarArchiveProtected(se)?Me:null", "build-8576 cloud inline archive");
    primarySource = replaceOnce(primarySource, "if(Se&&e.push({id:`archive-task`", "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`", "build-8576 cloud context archive item");
    primarySource = replaceOnce(
      primarySource,
      "archive:n,getMenuItems:K?e=>d([",
      "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d([",
      "build-8576 remote row archive"
    );
    fs.writeFileSync(primaryFile, primarySource);
    return;
  }
  if (primarySource.includes("function DPn({scope:e,target:t,actions:n,onRename:r,onArchive:i,")) {
    primarySource = replaceOnce(
      primarySource,
      "function DPn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function DPn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "build-8378 archive classifier bridge"
    );
    primarySource = replaceOnce(primarySource, "archive:w?void 0:{id:`archive-thread`,onSelect:()=>i()}", "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}", "build-8378 local context archive item");
    primarySource = replaceOnce(
      primarySource,
      "function UPn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
      "function UPn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
      "build-8378 bulk archive filter"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:Qkn(T,r),threadKey:r})",
      "selectedThreadKeys:Qkn(T,r),threadKey:r,archiveProtected:Qkn(T,r).some(e=>{let t=T.get($u,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-8378 local protected selection"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:Qkn(G,e),threadKey:e})",
      "selectedThreadKeys:Qkn(G,e),threadKey:e,archiveProtected:Qkn(G,e).some(e=>{let t=G.get($u,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-8378 unified protected selection"
    );
    primarySource = replaceOnce(primarySource, "archive:t!=null&&(Ee||L)?Me:t,getMenuItems:", "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Me:t,getMenuItems:", "build-8378 local inline archive");
    primarySource = replaceOnce(primarySource, "Be=Se?je:null", "Be=Se&&!MTKsidebarArchiveProtected(se)?je:null", "build-8378 cloud inline archive");
    primarySource = replaceOnce(primarySource, "if(Se&&e.push({id:`archive-task`", "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`", "build-8378 cloud context archive item");
    primarySource = replaceOnce(
      primarySource,
      "archive:n,getMenuItems:K?e=>d([",
      "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d([",
      "build-8378 remote row archive"
    );
    fs.writeFileSync(primaryFile, primarySource);
    return;
  }
  if (primarySource.includes("function UAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,")) {
    primarySource = replaceOnce(
      primarySource,
      "function UAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function UAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "build-8109 archive classifier bridge"
    );
    primarySource = replaceOnce(primarySource, "archive:w?void 0:{id:`archive-thread`,onSelect:()=>i()}", "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}", "build-8109 local context archive item");
    primarySource = replaceOnce(
      primarySource,
      "function ajn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
      "function ajn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
      "build-8109 bulk archive filter"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:HTn(T,r),threadKey:r})",
      "selectedThreadKeys:HTn(T,r),threadKey:r,archiveProtected:HTn(T,r).some(e=>{let t=T.get(tm,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-8109 local protected selection"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:HTn(K,e),threadKey:e})",
      "selectedThreadKeys:HTn(K,e),threadKey:e,archiveProtected:HTn(K,e).some(e=>{let t=K.get(tm,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-8109 unified protected selection"
    );
    primarySource = replaceOnce(primarySource, "archive:t!=null&&(De||L)?Ne:t,getMenuItems:", "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(De||L)?Ne:t,getMenuItems:", "build-8109 local inline archive");
    primarySource = replaceOnce(primarySource, "Ve=Ce?Me:null", "Ve=Ce&&!MTKsidebarArchiveProtected(se)?Me:null", "build-8109 cloud inline archive");
    primarySource = replaceOnce(primarySource, "if(Ce&&e.push({id:`archive-task`", "if(Ce&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`", "build-8109 cloud context archive item");
    primarySource = replaceOnce(
      primarySource,
      "archive:n,getMenuItems:q?e=>d([",
      "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:q&&!MTKsidebarArchiveProtected(e.task.id)?e=>d([",
      "build-8109 remote row archive"
    );
    fs.writeFileSync(primaryFile, primarySource);
    return;
  }
  if (primarySource.includes("function VAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,")) {
    primarySource = replaceOnce(
      primarySource,
      "function VAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function VAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "build-7942 archive classifier bridge"
    );
    primarySource = replaceOnce(primarySource, "archive:T?void 0:{id:`archive-thread`,onSelect:()=>i()}", "archive:T||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}", "build-7942 local context archive item");
    primarySource = replaceOnce(
      primarySource,
      "function rjn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
      "function rjn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
      "build-7942 bulk archive filter"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:BTn(T,r),threadKey:r})",
      "selectedThreadKeys:BTn(T,r),threadKey:r,archiveProtected:BTn(T,r).some(e=>{let t=T.get(pv,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
      "build-7942 local protected selection"
    );
    primarySource = replaceOnce(primarySource, "archive:t!=null&&(Ee||L)?Me:t,getMenuItems:", "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Me:t,getMenuItems:", "build-7942 local inline archive");
    primarySource = replaceOnce(primarySource, "onArchive:Ve,archiveAriaLabel:He", "onArchive:MTKsidebarArchiveProtected(se)?null:Ve,archiveAriaLabel:He", "build-7942 remote inline archive");
    primarySource = replaceOnce(primarySource, "if(Se&&e.push({id:`archive-task`", "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`", "build-7942 remote context archive item");
    primarySource = replaceOnce(
      primarySource,
      "archive:n,getMenuItems:K?e=>d([",
      "archive:n,getMenuItems:K&&!MTKsidebarArchiveProtected(e.task.id)?e=>d([",
      "build-7942 remote row archive"
    );
    fs.writeFileSync(primaryFile, primarySource);
    return;
  }
  if (primarySource.includes("function JAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,")) {
    primarySource = replaceOnce(
      primarySource,
      "function JAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function JAn({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
      "build-7746 archive classifier bridge"
    );
    primarySource = replaceOnce(primarySource, "archive:w?void 0:{id:`archive-thread`,onSelect:()=>i()}", "archive:w||MTKsidebarArchiveProtected(m)?void 0:{id:`archive-thread`,onSelect:()=>i()}", "build-7746 local context archive item");
    primarySource = replaceOnce(
      primarySource,
      "function ljn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
      "function ljn({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
      "build-7746 bulk archive filter"
    );
    primarySource = replaceOnce(
      primarySource,
      "selectedThreadKeys:CEn(T,r),threadKey:r})",
      "selectedThreadKeys:CEn(T,r),threadKey:r,archiveProtected:CEn(T,r).some(e=>MTKsidebarArchiveProtected(gC(e)))})",
      "build-7746 local protected selection"
    );
    primarySource = replaceOnce(primarySource, "archive:t!=null&&(Ee||L)?Me:t,getMenuItems:", "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Ee||L)?Me:t,getMenuItems:", "build-7746 local inline archive");
    primarySource = replaceOnce(primarySource, "if(Se&&e.push({id:`archive-task`", "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`", "build-7746 remote context archive item");
    primarySource = replaceOnce(primarySource, "Be=Se?je:null", "Be=Se&&!MTKsidebarArchiveProtected(se)?je:null", "build-7746 remote inline archive");
    primarySource = replaceOnce(
      primarySource,
      "archive:n,getMenuItems:q?e=>u([",
      "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:q&&!MTKsidebarArchiveProtected(e.task.id)?e=>u([",
      "build-7746 remote row archive"
    );
    fs.writeFileSync(primaryFile, primarySource);
    return;
  }
  if (source.includes("function cRc({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:")) {
    source = replaceOnce(
      source,
      "archive:S?void 0:{id:`archive-thread`,onSelect:()=>i()}",
      "archive:S||MTKsidebarArchiveProtected(f)?void 0:{id:`archive-thread`,onSelect:()=>i()}",
      "build-7345 local context archive item"
    );
    source = replaceOnce(
      source,
      "function cRc({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
      "function cRc({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
      "build-7345 bulk archive filter"
    );
    source = replaceOnce(
      source,
      "selectedThreadKeys:XMc(T,e),threadKey:e})",
      "selectedThreadKeys:XMc(T,e),threadKey:e,archiveProtected:XMc(T,e).some(e=>MTKsidebarArchiveProtected(KNc(T.get(VN,e))))})",
      "build-7345 local protected selection"
    );
    source = replaceOnce(
      source,
      "selectedThreadKeys:XMc(V,e),threadKey:e})",
      "selectedThreadKeys:XMc(V,e),threadKey:e,archiveProtected:XMc(V,e).some(e=>MTKsidebarArchiveProtected(KNc(V.get(VN,e))))})",
      "build-7345 remote protected selection"
    );
    source = replaceOnce(
      source,
      "archive:t!=null&&(De||L)?Ne:t,getMenuItems:",
      "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(De||L)?Ne:t,getMenuItems:",
      "build-7345 local inline archive"
    );
    source = replaceOnce(
      source,
      "if(Se&&e.push({id:`archive-task`",
      "if(Se&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
      "build-7345 remote context archive item"
    );
    source = replaceOnce(
      source,
      "archive:n,getMenuItems:H?e=>u([",
      "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:H&&!MTKsidebarArchiveProtected(e.task.id)?e=>u([",
      "build-7345 remote inline archive"
    );
    fs.writeFileSync(file, source);
    return;
  }
  const current = source.includes("function zAl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:");
  source = replaceOnce(
    source,
    current
      ? "function zAl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:"
      : "function Nkl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
    current
      ? "function zAl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:"
      : "function Nkl({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
    "sidebar bulk archive filter"
  );
  source = replaceOnce(
    source,
    "{id:`archive-thread`,onSelect:Ke},...nt()?",
    "...MTKsidebarArchiveProtected(n)?[]:[{id:`archive-thread`,onSelect:Ke}],...nt()?",
    "sidebar row context archive item"
  );
  source = replaceOnce(
    source,
    current ? "selectedThreadKeys:sTl(V,e),threadKey:e})" : "selectedThreadKeys:twl(T,e),threadKey:e})}",
    current
      ? "selectedThreadKeys:sTl(V,e),threadKey:e,archiveProtected:sTl(V,e).some(e=>{let t=V.get(Lx,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})"
      : "selectedThreadKeys:twl(T,e),threadKey:e,archiveProtected:twl(T,e).some(e=>{let t=T.get(Rx,e);return t!=null&&MTKsidebarArchiveProtected(tEl(t))})})}",
    "sidebar bulk protected selection"
  );
  source = replaceOnce(
    source,
    "archive:t!=null&&(Be||R)?Ke:t,getMenuItems:",
    "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Be||R)?Ke:t,getMenuItems:",
    "sidebar row inline archive action"
  );
  fs.writeFileSync(file, source);
}

function patchLocalPage(file) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("data-mtk-palette-room-host")) throw new Error("room prototype already applied");
  const profile = localProfile(source);
  if (profile == null) throw new Error("unrecognized local conversation page-shell ownership profile");
  source = replaceOnce(source, profile.cacheBefore, profile.cacheAfter, "local page memo cache size");
  source = replaceOnce(source, profile.rootBefore, profile.rootAfter, "local page root surface");
  fs.writeFileSync(file, source);
}

function patchDelegation(file) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("data-mtk-palette-source-id")) throw new Error("delegation palette prototype already applied");
  if (source.includes("function rz(e){let t=(0,iz.c)(14),")) {
    source = replaceOnce(source, "function rz(e){let t=(0,iz.c)(14),", "function rz(e){let t=(0,iz.c)(16),", "build-8690 delegation palette cache size");
    source = replaceOnce(
      source,
      "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p?(h=(0,az.jsx)(JR,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[12]=h):h=t[12]",
      "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p||t[14]!==MTKtitle||t[15]!==r?(h=(0,az.jsx)(JR,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle,paletteSourceTitle:MTKtitle,paletteSourceId:r}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[14]=MTKtitle,t[15]=r,t[12]=h):h=t[12]",
      "build-8690 delegated provenance attributes handoff"
    );
    source = replaceOnce(source, "function JR(e){let t=(0,YR.c)(17),", "function JR(e){let t=(0,YR.c)(19),", "build-8690 delegation wrapper palette cache size");
    source = replaceOnce(source, "onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride,paletteSourceTitle:MTKsourceTitle,paletteSourceId:MTKsourceId}=e,", "build-8690 delegation provenance props");
    source = replaceOnce(
      source,
      "t[13]!==p||t[14]!==m?(h=(0,XR.jsxs)(`div`,{className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[15]=h):h=t[15]",
      "t[13]!==p||t[14]!==m||t[17]!==MTKsourceTitle||t[18]!==MTKsourceId?(h=(0,XR.jsxs)(`div`,{\"data-mtk-palette-source-title\":MTKsourceTitle??void 0,\"data-mtk-palette-source-id\":MTKsourceId??void 0,className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[17]=MTKsourceTitle,t[18]=MTKsourceId,t[15]=h):h=t[15]",
      "build-8690 delegation provenance DOM surface"
    );
    fs.writeFileSync(file, source);
    return;
  }
  if (source.includes("function Xb(e){let t=(0,Zb.c)(14),")) {
    source = replaceOnce(source, "function Xb(e){let t=(0,Zb.c)(14),", "function Xb(e){let t=(0,Zb.c)(16),", "build-8576 delegation palette cache size");
    source = replaceOnce(
      source,
      "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p?(h=(0,Qb.jsx)(Gb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[12]=h):h=t[12]",
      "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p||t[14]!==MTKtitle||t[15]!==r?(h=(0,Qb.jsx)(Gb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle,paletteSourceTitle:MTKtitle,paletteSourceId:r}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[14]=MTKtitle,t[15]=r,t[12]=h):h=t[12]",
      "build-8576 delegated provenance attributes handoff"
    );
    source = replaceOnce(source, "function Gb(e){let t=(0,Kb.c)(17),", "function Gb(e){let t=(0,Kb.c)(19),", "build-8576 delegation wrapper palette cache size");
    source = replaceOnce(source, "onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride,paletteSourceTitle:MTKsourceTitle,paletteSourceId:MTKsourceId}=e,", "build-8576 delegation provenance props");
    source = replaceOnce(
      source,
      "t[13]!==p||t[14]!==m?(h=(0,qb.jsxs)(`div`,{className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[15]=h):h=t[15]",
      "t[13]!==p||t[14]!==m||t[17]!==MTKsourceTitle||t[18]!==MTKsourceId?(h=(0,qb.jsxs)(`div`,{\"data-mtk-palette-source-title\":MTKsourceTitle??void 0,\"data-mtk-palette-source-id\":MTKsourceId??void 0,className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[17]=MTKsourceTitle,t[18]=MTKsourceId,t[15]=h):h=t[15]",
      "build-8576 delegation provenance DOM surface"
    );
    fs.writeFileSync(file, source);
    return;
  }
  if (source.includes("function Yb(e){let t=(0,Xb.c)(14),")) {
    source = replaceOnce(source, "function Yb(e){let t=(0,Xb.c)(14),", "function Yb(e){let t=(0,Xb.c)(16),", "build-8378 delegation palette cache size");
    source = replaceOnce(
      source,
      "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p?(h=(0,Zb.jsx)(Wb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[12]=h):h=t[12]",
      "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p||t[14]!==MTKtitle||t[15]!==r?(h=(0,Zb.jsx)(Wb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle,paletteSourceTitle:MTKtitle,paletteSourceId:r}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[14]=MTKtitle,t[15]=r,t[12]=h):h=t[12]",
      "build-8378 delegated provenance attributes handoff"
    );
    source = replaceOnce(source, "function Wb(e){let t=(0,Gb.c)(17),", "function Wb(e){let t=(0,Gb.c)(19),", "build-8378 delegation wrapper palette cache size");
    source = replaceOnce(source, "onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride,paletteSourceTitle:MTKsourceTitle,paletteSourceId:MTKsourceId}=e,", "build-8378 delegation provenance props");
    source = replaceOnce(
      source,
      "t[13]!==p||t[14]!==m?(h=(0,Kb.jsxs)(`div`,{className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[15]=h):h=t[15]",
      "t[13]!==p||t[14]!==m||t[17]!==MTKsourceTitle||t[18]!==MTKsourceId?(h=(0,Kb.jsxs)(`div`,{\"data-mtk-palette-source-title\":MTKsourceTitle??void 0,\"data-mtk-palette-source-id\":MTKsourceId??void 0,className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[17]=MTKsourceTitle,t[18]=MTKsourceId,t[15]=h):h=t[15]",
      "build-8378 delegation provenance DOM surface"
    );
    fs.writeFileSync(file, source);
    return;
  }
  if (source.includes("function Cb(e){let t=(0,wb.c)(14),")) {
    source = replaceOnce(source, "function Cb(e){let t=(0,wb.c)(14),", "function Cb(e){let t=(0,wb.c)(16),", "build-7746 delegation palette cache size");
    source = replaceOnce(
      source,
      "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p?(h=(0,Tb.jsx)(vb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[12]=h):h=t[12]",
      "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p||t[14]!==MTKtitle||t[15]!==r?(h=(0,Tb.jsx)(vb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle,paletteSourceTitle:MTKtitle,paletteSourceId:r}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[14]=MTKtitle,t[15]=r,t[12]=h):h=t[12]",
      "build-7746 delegated provenance attributes handoff"
    );
    source = replaceOnce(source, "function vb(e){let t=(0,yb.c)(17),", "function vb(e){let t=(0,yb.c)(19),", "build-7746 delegation wrapper palette cache size");
    source = replaceOnce(source, "onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride,paletteSourceTitle:MTKsourceTitle,paletteSourceId:MTKsourceId}=e,", "build-7746 delegation provenance props");
    source = replaceOnce(
      source,
      "t[13]!==p||t[14]!==m?(h=(0,bb.jsxs)(`div`,{className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[15]=h):h=t[15]",
      "t[13]!==p||t[14]!==m||t[17]!==MTKsourceTitle||t[18]!==MTKsourceId?(h=(0,bb.jsxs)(`div`,{\"data-mtk-palette-source-title\":MTKsourceTitle??void 0,\"data-mtk-palette-source-id\":MTKsourceId??void 0,className:`flex w-full flex-col items-end justify-end gap-1`,children:[p,m]}),t[13]=p,t[14]=m,t[17]=MTKsourceTitle,t[18]=MTKsourceId,t[15]=h):h=t[15]",
      "build-7746 delegation provenance DOM surface"
    );
    fs.writeFileSync(file, source);
    return;
  }
  if (source.includes("function SI(e){let t=(0,CI.c)(13),")) {
    source = replaceOnce(source, "function SI(e){let t=(0,CI.c)(13),", "function SI(e){let t=(0,CI.c)(15),", "build-7345 delegation cache size");
    source = replaceOnce(
      source,
      "t[5]!==c||t[6]!==a||t[7]!==o||t[8]!==r||t[9]!==i||t[10]!==p||t[12]!==f?(m=(0,wI.jsx)(_I,{label:f,message:r,sentAtMs:i,cwd:a,hostId:o,compactActions:c,onLabelClick:p,messageBubbleStyle:MTKdelegatedBubbleStyle}),t[5]=c,t[6]=a,t[7]=o,t[8]=r,t[9]=i,t[10]=p,t[12]=f,t[11]=m):m=t[11]",
      "t[5]!==c||t[6]!==a||t[7]!==o||t[8]!==r||t[9]!==i||t[10]!==p||t[12]!==f||t[13]!==MTKtitle||t[14]!==n?(m=(0,wI.jsx)(_I,{label:f,message:r,sentAtMs:i,cwd:a,hostId:o,compactActions:c,onLabelClick:p,messageBubbleStyle:MTKdelegatedBubbleStyle,paletteSourceTitle:MTKtitle,paletteSourceId:n}),t[5]=c,t[6]=a,t[7]=o,t[8]=r,t[9]=i,t[10]=p,t[12]=f,t[13]=MTKtitle,t[14]=n,t[11]=m):m=t[11]",
      "build-7345 delegated provenance attributes handoff"
    );
    source = replaceOnce(source, "function _I(e){let t=(0,vI.c)(16),", "function _I(e){let t=(0,vI.c)(18),", "build-7345 delegation wrapper cache size");
    source = replaceOnce(source, "onLabelClick:c,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "onLabelClick:c,messageBubbleStyle:MTKbubbleStyleOverride,paletteSourceTitle:MTKsourceTitle,paletteSourceId:MTKsourceId}=e,", "build-7345 delegation provenance props");
    source = replaceOnce(
      source,
      "t[12]!==f||t[13]!==p?(m=(0,yI.jsxs)(`div`,{className:`flex w-full flex-col items-end justify-end gap-1`,children:[f,p]}),t[12]=f,t[13]=p,t[14]=m):m=t[14]",
      "t[12]!==f||t[13]!==p||t[16]!==MTKsourceTitle||t[17]!==MTKsourceId?(m=(0,yI.jsxs)(`div`,{\"data-mtk-palette-source-title\":MTKsourceTitle??void 0,\"data-mtk-palette-source-id\":MTKsourceId??void 0,className:`flex w-full flex-col items-end justify-end gap-1`,children:[f,p]}),t[12]=f,t[13]=p,t[16]=MTKsourceTitle,t[17]=MTKsourceId,t[14]=m):m=t[14]",
      "build-7345 delegation provenance DOM surface"
    );
    fs.writeFileSync(file, source);
    return;
  }
  if (source.includes("function OC(e){let t=(0,kC.c)(13),")) {
    source = replaceOnce(source, "function OC(e){let t=(0,kC.c)(13),", "function OC(e){let t=(0,kC.c)(15),", "delegation cache size");
    source = replaceOnce(
      source,
      "t[5]!==c||t[6]!==a||t[7]!==o||t[8]!==r||t[9]!==i||t[10]!==p||t[12]!==f?(m=(0,AC.jsx)(CC,{label:f,message:r,sentAtMs:i,cwd:a,hostId:o,compactActions:c,onLabelClick:p,messageBubbleStyle:MTKdelegatedBubbleStyle}),t[5]=c,t[6]=a,t[7]=o,t[8]=r,t[9]=i,t[10]=p,t[12]=f,t[11]=m):m=t[11]",
      "t[5]!==c||t[6]!==a||t[7]!==o||t[8]!==r||t[9]!==i||t[10]!==p||t[12]!==f||t[13]!==MTKtitle||t[14]!==n?(m=(0,AC.jsx)(CC,{label:f,message:r,sentAtMs:i,cwd:a,hostId:o,compactActions:c,onLabelClick:p,messageBubbleStyle:MTKdelegatedBubbleStyle,paletteSourceTitle:MTKtitle,paletteSourceId:n}),t[5]=c,t[6]=a,t[7]=o,t[8]=r,t[9]=i,t[10]=p,t[12]=f,t[13]=MTKtitle,t[14]=n,t[11]=m):m=t[11]",
      "delegated provenance attributes handoff"
    );
    source = replaceOnce(source, "function CC(e){let t=(0,wC.c)(16),", "function CC(e){let t=(0,wC.c)(18),", "delegation wrapper cache size");
    source = replaceOnce(source, "onLabelClick:c,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "onLabelClick:c,messageBubbleStyle:MTKbubbleStyleOverride,paletteSourceTitle:MTKsourceTitle,paletteSourceId:MTKsourceId}=e,", "delegation provenance props");
    source = replaceOnce(
      source,
      "t[12]!==f||t[13]!==p?(m=(0,TC.jsxs)(`div`,{className:`flex w-full flex-col items-end justify-end gap-1`,children:[f,p]}),t[12]=f,t[13]=p,t[14]=m):m=t[14]",
      "t[12]!==f||t[13]!==p||t[16]!==MTKsourceTitle||t[17]!==MTKsourceId?(m=(0,TC.jsxs)(`div`,{\"data-mtk-palette-source-title\":MTKsourceTitle??void 0,\"data-mtk-palette-source-id\":MTKsourceId??void 0,className:`flex w-full flex-col items-end justify-end gap-1`,children:[f,p]}),t[12]=f,t[13]=p,t[16]=MTKsourceTitle,t[17]=MTKsourceId,t[14]=m):m=t[14]",
      "delegation provenance DOM surface"
    );
    fs.writeFileSync(file, source);
    return;
  }
  if (!source.includes("function tw(e){let t=(0,nw.c)(13),")) {
    throw new Error("unrecognized delegation provenance ownership profile");
  }
  source = replaceOnce(source, "function tw(e){let t=(0,nw.c)(13),", "function tw(e){let t=(0,nw.c)(15),", "delegation cache size");
  source = replaceOnce(
    source,
    "t[5]!==l||t[6]!==a||t[7]!==o||t[8]!==r||t[9]!==i||t[10]!==b||t[11]!==y?(x=(0,rw.jsx)(XC,{label:y,message:r,sentAtMs:i,cwd:a,hostId:o,compactActions:l,onLabelClick:b,messageBubbleStyle:MTKdelegatedBubbleStyle}),t[5]=l,t[6]=a,t[7]=o,t[8]=r,t[9]=i,t[10]=b,t[11]=y,t[12]=x):x=t[12]",
    "t[5]!==l||t[6]!==a||t[7]!==o||t[8]!==r||t[9]!==i||t[10]!==b||t[11]!==y||t[13]!==g||t[14]!==n?(x=(0,rw.jsx)(XC,{label:y,message:r,sentAtMs:i,cwd:a,hostId:o,compactActions:l,onLabelClick:b,messageBubbleStyle:MTKdelegatedBubbleStyle,paletteSourceTitle:g,paletteSourceId:n}),t[5]=l,t[6]=a,t[7]=o,t[8]=r,t[9]=i,t[10]=b,t[11]=y,t[13]=g,t[14]=n,t[12]=x):x=t[12]",
    "delegated provenance attributes handoff"
  );
  source = replaceOnce(source, "function XC(e){let t=(0,ZC.c)(16),", "function XC(e){let t=(0,ZC.c)(18),", "delegation wrapper cache size");
  source = replaceOnce(source, "onLabelClick:c,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "onLabelClick:c,messageBubbleStyle:MTKbubbleStyleOverride,paletteSourceTitle:MTKsourceTitle,paletteSourceId:MTKsourceId}=e,", "delegation provenance props");
  source = replaceOnce(
    source,
    "t[12]!==f||t[13]!==p?(m=(0,QC.jsxs)(`div`,{className:`flex w-full flex-col items-end justify-end gap-1`,children:[f,p]}),t[12]=f,t[13]=p,t[14]=m):m=t[14]",
    "t[12]!==f||t[13]!==p||t[16]!==MTKsourceTitle||t[17]!==MTKsourceId?(m=(0,QC.jsxs)(`div`,{\"data-mtk-palette-source-title\":MTKsourceTitle??void 0,\"data-mtk-palette-source-id\":MTKsourceId??void 0,className:`flex w-full flex-col items-end justify-end gap-1`,children:[f,p]}),t[12]=f,t[13]=p,t[16]=MTKsourceTitle,t[17]=MTKsourceId,t[14]=m):m=t[14]",
    "delegation provenance DOM surface"
  );
  fs.writeFileSync(file, source);
}

function readOption(name) {
  const index = process.argv.indexOf(name, 4);
  if (index < 0) return null;
  if (index !== process.argv.length - 2 || !process.argv[index + 1]) {
    throw new Error(`usage: ${name} must be followed by one value`);
  }
  return path.resolve(process.argv[index + 1]);
}

function configuredWorkspaceRoot() {
  if (configPath == null) throw new Error("task-visual-palette apply requires --config TOOLKIT_CONFIG");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read toolkit config: ${error.message}`);
  }
  if (config == null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Toolkit config must be a JSON object");
  }
  const workspaceRoot = config.workspaceRoot;
  if (typeof workspaceRoot !== "string" || !path.isAbsolute(workspaceRoot) || path.parse(workspaceRoot).root === path.resolve(workspaceRoot)) {
    throw new Error("Toolkit config workspaceRoot must be an absolute non-root path");
  }
  return path.resolve(workspaceRoot);
}
