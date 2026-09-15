#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const LEGACY_VISUAL_CSS = '@keyframes mtk-tinrelay-signal{0%{transform:scale(.82);opacity:.32}55%{opacity:.72}100%{transform:scale(1.18);opacity:.24}}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal{position:relative;overflow:hidden;isolation:isolate;background:#0B0C0E;border-color:#34383D;color:#F1F3F5}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{content:"";position:absolute;z-index:0;inset:-38%;pointer-events:none;background:repeating-radial-gradient(circle at 14% 82%,transparent 0 34px,rgba(116,124,134,.24) 35px 43px,transparent 44px 78px);animation:mtk-tinrelay-signal 18s ease-out infinite}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal{background:#34383D;border-color:#626971}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal::before{inset:0;transform-origin:7% 72%;background:repeating-radial-gradient(circle at 7% 72%,rgba(11,12,14,.82) 0 7px,transparent 8px 31px,rgba(11,12,14,.46) 32px 45px,transparent 46px 78px)}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal>*{position:relative;z-index:1}[data-mtk-tinrelay-pointer] .mtk-tinrelay-route{color:#A8ADB4}[data-mtk-tinrelay-pointer] .mtk-tinrelay-body{color:#F1F3F5}@media (prefers-reduced-motion:reduce){[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{animation:none;transform:scale(1);opacity:.34}}';
const SLOW_VISUAL_CSS = '@keyframes mtk-tinrelay-signal{0%,100%{opacity:.48}50%{opacity:.68}}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal{position:relative;overflow:hidden;isolation:isolate;background:#0B0C0E;border-color:#34383D;color:#F1F3F5}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{content:"";position:absolute;z-index:0;inset:-38%;pointer-events:none;background:repeating-radial-gradient(circle at 14% 82%,transparent 0 34px,rgba(116,124,134,.18) 35px 43px,transparent 44px 78px);animation:mtk-tinrelay-signal 18s ease-in-out infinite;will-change:opacity}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal{background:#303438;border-color:#626971}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal::before{inset:0;background:repeating-radial-gradient(circle at 7% 72%,rgba(11,12,14,.68) 0 7px,transparent 8px 31px,rgba(11,12,14,.32) 32px 45px,transparent 46px 78px)}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal>*{position:relative;z-index:1}[data-mtk-tinrelay-pointer] .mtk-tinrelay-route{color:#A8ADB4}[data-mtk-tinrelay-pointer] .mtk-tinrelay-body{color:#F1F3F5}[data-mtk-tinrelay-pointer] .mtk-tinrelay-body .whitespace-pre-wrap{white-space:normal}@media (prefers-reduced-motion:reduce){[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{animation:none;opacity:.58}}';
const ONE_SHOT_VISUAL_CSS = SLOW_VISUAL_CSS
  .replace("@keyframes mtk-tinrelay-signal{0%,100%{opacity:.48}50%{opacity:.68}}", "@keyframes mtk-tinrelay-signal{0%{transform:scale(1);opacity:.28}75%{opacity:.64}100%{transform:scale(1.12);opacity:0}}")
  .replace("inset:-38%;pointer-events:none", "inset:-38%;transform-origin:14% 82%;pointer-events:none")
  .replace("animation:mtk-tinrelay-signal 18s ease-in-out infinite;will-change:opacity", "animation:mtk-tinrelay-signal 1.6s ease-out 1 both;will-change:transform,opacity")
  .replace("inset:0;background:repeating-radial-gradient", "inset:0;transform-origin:7% 72%;background:repeating-radial-gradient")
  .replace("animation:none;opacity:.58", "animation:none;transform:scale(1);opacity:.58");
const CURRENT_BODY_CSS = '.mtk-tinrelay-body pre:first-child{margin-top:0}';
const LEGACY_BODY_CLASS = 'className:"mtk-tinrelay-body min-w-0 px-2 py-1"';
const CURRENT_BODY_CLASS = 'className:"mtk-tinrelay-body min-w-0 px-2"';
const OPTICAL_ALIGNMENT_CSS = '[data-mtk-tinrelay-pointer].mtk-tinrelay-signal{padding-top:calc(var(--spacing) * 1.5)}';
const PREVIOUS_CURRENT_VISUAL_CSS = `${ONE_SHOT_VISUAL_CSS}${CURRENT_BODY_CSS}`;
const PREVIOUS_CONTINUOUS_VISUAL_CSS = ONE_SHOT_VISUAL_CSS
  .replace("@keyframes mtk-tinrelay-signal{0%{transform:scale(1);opacity:.28}75%{opacity:.64}100%{transform:scale(1.12);opacity:0}}", "@keyframes mtk-tinrelay-signal{0%{transform:scale(1);opacity:0}15%{opacity:.28}50%{opacity:.52}85%{opacity:.28}100%{transform:scale(1.12);opacity:0}}")
  .replace("[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{content:", "[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before,[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::after{content:")
  .replace("animation:mtk-tinrelay-signal 1.6s ease-out 1 both;will-change:transform,opacity", "animation:mtk-tinrelay-signal 6s linear infinite;will-change:transform,opacity")
  .replace("[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal::before{", "[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal::before,[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal::after{")
  .replace("[data-mtk-tinrelay-pointer].mtk-tinrelay-signal>*{", "[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::after{animation-delay:-3s}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal>*{")
  .replace("[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{animation:none;transform:scale(1);opacity:.58}", "[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::before{animation:none;transform:scale(1);opacity:.58}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal::after{display:none}");
const PREVIOUS_NEXT_VISUAL_CSS = `${PREVIOUS_CONTINUOUS_VISUAL_CSS}${CURRENT_BODY_CSS}`;
const PREVIOUS_CUSTOM_CARD_VISUAL_CSS = `${PREVIOUS_NEXT_VISUAL_CSS}${OPTICAL_ALIGNMENT_CSS}`;
const PREVIOUS_STOCK_BUBBLE_VISUAL_CSS = '@keyframes mtk-tinrelay-signal{0%{transform:scale(1);opacity:0}15%{opacity:.28}50%{opacity:.52}85%{opacity:.28}100%{transform:scale(1.12);opacity:0}}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal{width:100%}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal>.group{align-items:flex-start}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]{position:relative;overflow:hidden;isolation:isolate;background:#0B0C0E;box-shadow:inset 0 0 0 1px #34383D;color:#F1F3F5}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::before,[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::after{content:"";position:absolute;z-index:0;inset:-38%;transform-origin:14% 82%;pointer-events:none;background:repeating-radial-gradient(circle at 14% 82%,transparent 0 34px,rgba(116,124,134,.18) 35px 43px,transparent 44px 78px);animation:mtk-tinrelay-signal 6s linear infinite;will-change:transform,opacity}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]{background:#303438;box-shadow:inset 0 0 0 1px #626971}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]::before,[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]::after{inset:0;transform-origin:7% 72%;background:repeating-radial-gradient(circle at 7% 72%,rgba(11,12,14,.68) 0 7px,transparent 8px 31px,rgba(11,12,14,.32) 32px 45px,transparent 46px 78px)}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::after{animation-delay:-3s}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]>*{position:relative;z-index:1}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal .whitespace-pre-wrap{white-space:normal}@media (prefers-reduced-motion:reduce){[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::before{animation:none;transform:scale(1);opacity:.58}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::after{display:none}}';
const PREVIOUS_CRISP_VISUAL_CSS = "@keyframes mtk-tinrelay-signal{0%{transform:scale(1);opacity:0}15%{opacity:.28}50%{opacity:.52}85%{opacity:.28}100%{transform:scale(1.12);opacity:0}}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal{width:100%}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal>.group{align-items:flex-start}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]{position:relative;overflow:hidden;isolation:isolate;background:#050607!important;box-shadow:inset 0 0 0 1px #34383D;color:#F1F3F5!important}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::before,[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::after{content:\"\";position:absolute;z-index:0;inset:-38%;transform-origin:14% 82%;pointer-events:none;background:repeating-radial-gradient(circle at 14% 82%,transparent 0 35px,rgba(190,196,204,.22) 35px 37px,transparent 37px 78px);animation:mtk-tinrelay-signal 6s linear infinite;will-change:transform,opacity}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]{background:#303438!important;box-shadow:inset 0 0 0 1px #626971}[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]::before,[data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]::after{inset:0;transform-origin:7% 72%;background:repeating-radial-gradient(circle at 7% 72%,rgba(11,12,14,.68) 0 5px,transparent 5px 33px,rgba(11,12,14,.38) 33px 35px,transparent 35px 78px)}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::after{animation-delay:-3s}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]>*{position:relative;z-index:1}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal .whitespace-pre-wrap{white-space:normal}@media (prefers-reduced-motion:reduce){[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::before{animation:none;transform:scale(1);opacity:.58}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::after{display:none}}";
const PREVIOUS_VISIBLE_INCOMING_VISUAL_CSS = PREVIOUS_CRISP_VISUAL_CSS.replace(
  "rgba(190,196,204,.22) 35px 37px",
  "rgba(190,196,204,.34) 35px 37px"
);
const PREVIOUS_LIGHT_MODE_VISUAL_CSS = PREVIOUS_VISIBLE_INCOMING_VISUAL_CSS.replace(
  "rgba(11,12,14,.68) 0 5px,transparent 5px 33px,rgba(11,12,14,.38) 33px 35px,transparent 35px 78px",
  "transparent 0 35px,rgba(11,12,14,.52) 35px 37px,transparent 37px 78px"
);
const PREVIOUS_LIGHT_FOREGROUND_VISUAL_CSS = PREVIOUS_LIGHT_MODE_VISUAL_CSS.replace(
  "color:#F1F3F5!important}",
  "color:#F1F3F5!important}[data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble] *{color:#F1F3F5!important}"
);
const LIGHT_THEME_VISUAL_CSS = 'html.electron-light [data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]{background:#F7F8FA!important;box-shadow:inset 0 0 0 1px #C9D0D7;color:#1B1F23!important}html.electron-light [data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble] *{color:inherit!important}html.electron-light [data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::before,html.electron-light [data-mtk-tinrelay-pointer].mtk-tinrelay-signal [data-user-message-bubble]::after{background:repeating-radial-gradient(circle at 14% 82%,transparent 0 35px,rgba(69,78,88,.24) 35px 37px,transparent 37px 78px)}html.electron-light [data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]{background:#E3E7EB!important;box-shadow:inset 0 0 0 1px #B5BEC7;color:#171B1F!important}html.electron-light [data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]::before,html.electron-light [data-mtk-tinrelay-pointer][data-mtk-tinrelay-outgoing].mtk-tinrelay-signal [data-user-message-bubble]::after{background:repeating-radial-gradient(circle at 7% 72%,transparent 0 35px,rgba(52,62,72,.28) 35px 37px,transparent 37px 78px)}';
const NEXT_VISUAL_CSS = `${PREVIOUS_LIGHT_FOREGROUND_VISUAL_CSS}${LIGHT_THEME_VISUAL_CSS}`;

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const configPath = readOption("--config");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: tinrelay-pointer-presentation/incoming-transform.mjs check|apply EXTRACTED_ASAR_ROOT [--config TOOLKIT_CONFIG]");
}

const assets = path.join(root, "webview/assets");
const renderer = uniqueFile(/^(?:subagent-activity-chip-group|conversation-blocks)-.*\.js$/);
const main = uniqueFile(/^main-.*\.js$/, path.join(root, ".vite/build"));
let rendererSource = fs.readFileSync(renderer, "utf8");
let mainSource = fs.readFileSync(main, "utf8");
let state = inspectState();

if (command === "apply" && state === "legacy-presentation-applied") {
  rendererSource = migrateRendererPresentation(rendererSource);
  fs.writeFileSync(renderer, rendererSource);
  moduleSyntaxCheck(renderer);
  state = inspectState();
  if (state !== "applied") throw new Error("Tinrelay presentation migration did not verify");
} else if (command === "apply" && state === "needs-apply") {
  const config = configuredTinrelay();
  rendererSource = patchRenderer(rendererSource, config.localShip);
  mainSource = patchMain(mainSource, config);
  fs.writeFileSync(renderer, rendererSource);
  fs.writeFileSync(main, mainSource);
  moduleSyntaxCheck(renderer);
  moduleSyntaxCheck(main);
  state = inspectState();
  if (state !== "applied") throw new Error("Tinrelay pointer transform did not verify");
}

const embedded = new Set(["applied", "legacy-presentation-applied"]).has(state) ? embeddedConfiguration() : null;

process.stdout.write(`${JSON.stringify({
  state,
  contract: "tinrelay-local-pointer-v1",
  source: "any-delegated-message-with-exact-pointer-shape",
  client: embedded?.client ?? null,
  localShip: embedded?.localShip ?? null,
  targets: [renderer, main].map(file => path.relative(root, file))
}, null, 2)}\n`);

function inspectState() {
  const rendererBaseMarkers = [
    "function MTKtinrelayPointerFromMessage(",
    "function MTKtinrelayPointerView(",
    "messageNode:MTKtinrelayPointerNode(",
    "data-mtk-tinrelay-pointer",
    '.dispatchMessage("mtk-tinrelay-pointer-inspect"',
    '.subscribe("mtk-tinrelay-pointer-result"'
  ];
  const mainBaseMarkers = [
    "const MTKtinrelayClient=",
    ",MTKtinrelayLocalShip=",
    "function MTKtinrelayMainPointer(",
    "async function MTKtinrelayInspect(",
    "case`mtk-tinrelay-pointer-inspect`:",
    "type:`mtk-tinrelay-pointer-result`"
  ];
  const rendererPatched = rendererBaseMarkers.every(marker => rendererSource.includes(marker));
  const mainPatched = mainBaseMarkers.every(marker => mainSource.includes(marker));
  if (rendererPatched && mainPatched) {
    if (rendererSource.includes(JSON.stringify(LEGACY_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(SLOW_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(PREVIOUS_CURRENT_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(PREVIOUS_NEXT_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(PREVIOUS_CUSTOM_CARD_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(PREVIOUS_STOCK_BUBBLE_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(PREVIOUS_CRISP_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(PREVIOUS_VISIBLE_INCOMING_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(PREVIOUS_LIGHT_MODE_VISUAL_CSS)) ||
        rendererSource.includes(JSON.stringify(PREVIOUS_LIGHT_FOREGROUND_VISUAL_CSS)) ||
        rendererSource.includes(LEGACY_BODY_CLASS) ||
        !rendererSource.includes("function MTKtinrelayMessageView(") ||
        !rendererSource.includes("function MTKtinrelayDeliveryFromMessage(") ||
        !rendererSource.includes("function MTKtinrelayDeliveryView(") ||
        !rendererSource.includes("function MTKtinrelayScrollSnapshot(") ||
        !rendererSource.includes("&&Math.max(0,-t.scrollTop)<=Math.max(1,t.clientHeight)&&t.scrollTo") ||
        !rendererSource.includes("MTKtinrelayScheduleScroll(d.current)")) {
      inspectAppliedRendererBase(rendererSource);
      inspectAppliedMain(mainSource);
      embeddedConfiguration();
      return "legacy-presentation-applied";
    }
    inspectAppliedRenderer(rendererSource);
    inspectAppliedMain(mainSource);
    embeddedConfiguration();
    return "applied";
  }
  if (rendererBaseMarkers.some(marker => rendererSource.includes(marker)) ||
      mainBaseMarkers.some(marker => mainSource.includes(marker))) {
    throw new Error("Upstream changed: Tinrelay pointer patch is partial");
  }
  inspectPristineRenderer(rendererSource);
  inspectPristineMain(mainSource);
  return "needs-apply";
}

function inspectPristineRenderer(source) {
  const profile = incomingRendererProfile(source);
  const message = functionAt(source, source.indexOf(`function ${profile.message}(`));
  const delegation = functionAt(source, source.indexOf(`function ${profile.delegation}(`));
  if (!message.text.includes(`collapsedLineCount:${profile.collapsedLines}`) || !message.text.includes("threadId:r") ||
      !delegation.text.includes("sourceThreadId:r") || !delegation.text.includes("message:i") ||
      count(delegation.text, `(0,${profile.delegationJsx}.jsx)(${profile.message},`) !== 1) {
    throw new Error("Upstream changed: delegated message renderer contract is not recognized");
  }
  if (!source.includes(profile.moduleBefore)) {
    throw new Error("Upstream changed: delegated message renderer module owner is not recognized");
  }
  resolveHostBus(source);
}

function inspectAppliedRenderer(source) {
  inspectAppliedRendererBase(source);
  const helpers = helperSlice(source);
  const profile = incomingRendererProfile(source);
  const hostBus = resolveHostBus(source);
  if (!helpers.includes(`const MTKtinrelayHostBus=${hostBus};`)) {
    throw new Error("Tinrelay renderer host bus is not captured outside component-local bindings");
  }
  for (const contract of [
    "function MTKtinrelayAddress(",
    'function MTKtinrelayEnvelope(e,t){if(typeof e!=="string"',
    'function MTKtinrelayPointerFromMessage(e)',
    'function MTKtinrelayDeliveryFromMessage(e)',
    'children:["📡 ",u]',
    'MTKtinrelayAddress(r.transmission.authorLabel,r.transmission.senderShip)',
    'MTKtinrelayAddress(r.transmission.attentionLabel,r.transmission.localShip)',
    'MTKtinrelayAddress(null,n.sender_ship)',
    'function MTKtinrelayMessageView(',
    'function MTKtinrelayDeliveryView(',
    `(0,${profile.helperJsx}.jsx)(${profile.messageComponent},{message:e,sentAtMs:r,collapsedLineCount:6,compactActions:!1,cwd:null,hostId:"local"})`,
    "function MTKtinrelayPointerNode(e,t)",
    "MTKtinrelayPointerView,{pointerText:e,sentAtMs:t}",
    'data-user-message-bubble',
    'function MTKtinrelayEnsureStyle()',
    'mtk-tinrelay-signal',
    '@media (prefers-reduced-motion:reduce)',
    'background:#050607!important',
    'box-shadow:inset 0 0 0 1px #34383D',
    'repeating-radial-gradient',
    'circle at 14% 82%',
    'circle at 7% 72%',
    'transparent 0 35px,rgba(11,12,14,.52) 35px 37px,transparent 37px 78px',
    'rgba(190,196,204,.34) 35px 37px',
    '@keyframes mtk-tinrelay-signal{0%{transform:scale(1);opacity:0}15%{opacity:.28}50%{opacity:.52}85%{opacity:.28}100%{transform:scale(1.12);opacity:0}}',
    'animation:mtk-tinrelay-signal 6s linear infinite',
    'mtk-tinrelay-signal [data-user-message-bubble]::after{animation-delay:-3s}',
    'will-change:transform,opacity',
    'transform-origin:14% 82%',
    'transform-origin:7% 72%',
    'background:#303438!important',
    '.mtk-tinrelay-signal .whitespace-pre-wrap{white-space:normal}',
    'color:#F1F3F5',
    'mtk-tinrelay-signal [data-user-message-bubble] *{color:#F1F3F5!important}',
    'mtk-tinrelay-signal>.group{align-items:flex-start}',
    'function MTKtinrelayScrollSnapshot()',
    'Math.max(0,-e.scrollTop)<=Math.max(1,e.clientHeight)',
    'setTimeout(()=>{let t=e.element',
    'MTKtinrelayScheduleScroll(d.current)',
    `(0,${profile.helperJsx}.jsx)(MTKtinrelayMessageView,{body:`
  ]) {
    if (!helpers.includes(contract)) throw new Error(`Tinrelay renderer postcondition missing: ${contract}`);
  }
  if (!["MTKtinrelayReact=t(x(),1)", "MTKtinrelayReact=t(Wo(),1)", "MTKtinrelayReact=t(ic(),1)", "MTKtinrelayReact=t(Mc(),1)", "MTKtinrelayReact=t(r(),1)",
    "MTKtinrelayReact=t(_e(),1)"].some(marker => source.includes(marker))) {
    throw new Error("Tinrelay renderer React owner is not initialized");
  }
  if (source.includes("dangerouslySetInnerHTML") &&
      helperSlice(source).includes("dangerouslySetInnerHTML")) {
    throw new Error("Tinrelay body must not use an HTML injection surface");
  }
  for (const forbidden of [
    "MTKoutboundFormattedText",
    "markdown",
    "innerHTML",
    "window.open",
    "eval(",
    "From: ",
    "To: ",
    "Attention: ",
    "Local ID: "
  ]) {
    if (helpers.includes(forbidden)) throw new Error(`Tinrelay renderer uses forbidden surface: ${forbidden}`);
  }
  for (const retired of ["Hide transmission", "Show transmission", "aria-expanded", "bg-surface-secondary/50", "linear-gradient(110deg"]) {
    if (helpers.includes(retired)) throw new Error(`Tinrelay renderer retains retired disclosure surface: ${retired}`);
  }
}

function inspectAppliedRendererBase(source) {
  const profile = incomingRendererProfile(source);
  const message = functionAt(source, source.indexOf(`function ${profile.message}(`));
  const delegation = functionAt(source, source.indexOf(`function ${profile.delegation}(`));
  for (const contract of ["messageNode:MTKmessageNode", "MTKmessageNode??(f?"]) {
    if (!message.text.includes(contract) && !delegation.text.includes(contract)) {
      throw new Error(`Tinrelay renderer postcondition missing: ${contract}`);
    }
  }
  if (!delegation.text.includes("messageNode:MTKtinrelayPointerNode(")) {
    throw new Error("Tinrelay renderer postcondition missing: pointer presentation call");
  }
  resolveHostBus(source);
}

function inspectPristineMain(source) {
  for (const contract of [
    'let x=require("node:child_process")',
    "case`show-plan-summary`:break;case`update-diff-if-open`:break;",
    "case`electron-add-new-workspace-root-option`:"
  ]) {
    if (count(source, contract) !== 1) {
      throw new Error(`Upstream changed: Tinrelay main-process contract is not unique: ${contract}`);
    }
  }
  if (count(source, "var dQ=i.i(`electron-message-handler`)") +
      count(source, "var mQ=i.i(`electron-message-handler`)") +
      count(source, "var pQ=i.i(`electron-message-handler`)") +
      count(source, "var fQ=i.i(`electron-message-handler`)") !== 1) {
    throw new Error("Upstream changed: Tinrelay main helper owner is not unique");
  }
}

function inspectAppliedMain(source) {
  inspectAppliedMainBase(source);
  const helpers = mainHelperSlice(source);
  for (const contract of [
    'typeof a==="string"&&a.length>0&&typeof o==="string"&&o===a',
    'a===null&&(o===void 0||o===null)',
    "authorLabel:a"
  ]) {
    if (!helpers.includes(contract)) throw new Error(`Tinrelay main postcondition missing: ${contract}`);
  }
}

function inspectAppliedMainBase(source) {
  const helpers = mainHelperSlice(source);
  for (const contract of [
    'x.execFile(MTKtinrelayClient,["--ship",e.local_ship,"inbox","show",e.local_id]',
    "shell:!1",
    "timeout:8e3",
    "maxBuffer:1048576",
    "signed_transmission",
    "recipient_ship!==t.local_ship",
    "sender_ship!==t.sender_ship",
    "attention_label!==t.attention_label"
  ]) {
    if (!helpers.includes(contract)) throw new Error(`Tinrelay main base postcondition missing: ${contract}`);
  }
  for (const forbidden of ["execSync", "spawn(", "shell:!0", "stderr", "process.env["]) {
    if (helpers.includes(forbidden)) throw new Error(`Tinrelay main helper uses forbidden surface: ${forbidden}`);
  }
  if (count(source, "case`mtk-tinrelay-pointer-inspect`:") !== 1) {
    throw new Error("Tinrelay main message handler is not unique");
  }
}

function incomingRendererProfile(value) {
  if (value.includes("function rz(") && value.includes("function JR(")) {
    const build8881Before = "var YR,XR,ZR,QR=e((()=>{YR=i(),vl(),C_(),XR=Z(),ZR=2}))";
    const build8881After = "var YR,MTKtinrelayReact,XR,ZR,QR=e((()=>{YR=i(),vl(),C_(),MTKtinrelayReact=t(r(),1),XR=Z(),ZR=2}))";
    if (value.includes(build8881Before) || value.includes(build8881After)) {
      return {
        cache: "YR", collapsedLines: "ZR", delegation: "rz", delegationJsx: "az",
        helperJsx: "XR", jsx: "XR", message: "JR", messageComponent: "__",
        moduleBefore: build8881Before, moduleAfter: build8881After,
        labelClass: "text-size-chat-sm flex max-w-full items-center gap-1 px-1 py-0.5 text-codex-description"
      };
    }
    const moduleBefore = "var YR,XR,ZR,QR=e((()=>{YR=i(),Il(),h_(),XR=Z(),ZR=2}))";
    const moduleAfter = "var YR,MTKtinrelayReact,XR,ZR,QR=e((()=>{YR=i(),Il(),h_(),MTKtinrelayReact=t(r(),1),XR=Z(),ZR=2}))";
    if (value.includes(moduleBefore) || value.includes(moduleAfter)) {
      return {
        cache: "YR", collapsedLines: "ZR", delegation: "rz", delegationJsx: "az",
        helperJsx: "XR", jsx: "XR", message: "JR", messageComponent: "l_", moduleBefore, moduleAfter,
        labelClass: "text-size-chat-sm flex max-w-full items-center gap-1 px-1 py-0.5 text-codex-description"
      };
    }
  }
  if (value.includes("function Gb(") && value.includes("function Xb(")) {
    const moduleBefore = "var Kb,qb,Jb,Yb=e((()=>{Kb=Qo(),hu(),o_(),qb=X(),Jb=2}))";
    const moduleAfter = "var Kb,MTKtinrelayReact,qb,Jb,Yb=e((()=>{Kb=Qo(),hu(),o_(),MTKtinrelayReact=t(x(),1),qb=X(),Jb=2}))";
    if (value.includes(moduleBefore) || value.includes(moduleAfter)) {
      return {
        cache: "Kb", collapsedLines: "Jb", delegation: "Xb", delegationJsx: "Qb",
        helperJsx: "qb", jsx: "qb", message: "Gb", messageComponent: "e_", moduleBefore, moduleAfter
      };
    }
  }
  if (value.includes("function Wb(") && value.includes("function Yb(")) {
    const moduleBefore = "var Gb,Kb,qb,Jb=e((()=>{Gb=mr(),ke(),a_(),Kb=X(),qb=2}))";
    const moduleAfter = "var Gb,MTKtinrelayReact,Kb,qb,Jb=e((()=>{Gb=mr(),ke(),a_(),MTKtinrelayReact=t(_e(),1),Kb=X(),qb=2}))";
    return {
      cache: "Gb", collapsedLines: "qb", delegation: "Yb", delegationJsx: "Zb",
      helperJsx: "Kb", jsx: "Kb", message: "Wb", messageComponent: "$g", moduleBefore, moduleAfter
    };
  }
  const profiles = [
    {cache:"un",initializer:"Hn",jsx:"Y",react:"Wo"},
    {cache:"wt",initializer:"js",jsx:"X",react:"ic"},
    {cache:"Ua",initializer:"Wc",jsx:"z",react:"Mc"}
  ];
  for (const profile of profiles) {
    const moduleBefore = `var yb,bb,xb,Sb=e((()=>{yb=${profile.cache}(),${profile.initializer}(),Mg(),bb=${profile.jsx}(),xb=2}))`;
    const moduleAfter = `var yb,MTKtinrelayReact,bb,xb,Sb=e((()=>{yb=${profile.cache}(),${profile.initializer}(),Mg(),MTKtinrelayReact=t(${profile.react}(),1),bb=${profile.jsx}(),xb=2}))`;
    if (!value.includes(moduleBefore) && !value.includes(moduleAfter)) continue;
    return {
      cache:"yb", collapsedLines:"xb", delegation:"Cb", delegationJsx:"Tb", helperJsx:"Tb", jsx:"bb",
      message:"vb", messageComponent:"Eg", moduleBefore,
      moduleAfter
    };
  }
  if (value.includes("function Wb(") && value.includes("function MTKtinrelayPointerFromMessage(")) {
    return {
      cache:"Gb", collapsedLines:"qb", delegation:"Yb", delegationJsx:"Zb",
      helperJsx:"Kb", jsx:"Kb", message:"Wb", messageComponent:"$g",
      moduleBefore:"var Gb,Kb,qb,Jb=e((()=>{Gb=mr(),ke(),a_(),Kb=X(),qb=2}))",
      moduleAfter:"var Gb,MTKtinrelayReact,Kb,qb,Jb=e((()=>{Gb=mr(),ke(),a_(),MTKtinrelayReact=t(_e(),1),Kb=X(),qb=2}))"
    };
  }
  throw new Error("Upstream changed: delegated message renderer profile is not recognized");
}

function patchRenderer(value, localShip) {
  const hostBus = resolveHostBus(value);
  const profile = incomingRendererProfile(value);
  let patched = replaceOnce(value, profile.moduleBefore, profile.moduleAfter, "delegated message module owner");

  const messageStart = patched.indexOf(`function ${profile.message}(`);
  const message = functionAt(patched, messageStart);
  const cache = new RegExp(`let t=\\(0,${escapeRegExp(profile.cache)}\\.c\\)\\((?<size>\\d+)\\)`).exec(message.text);
  if (cache == null) throw new Error("Upstream changed: delegated message cache owner is missing");
  const cacheSize = Number(cache.groups.size);
  let messageAfter = message.text.replace(cache[0], `let t=(0,${profile.cache}.c)(${cacheSize + 1})`);
  if (messageAfter.includes("paletteSourceId:MTKsourceId}=e")) {
    messageAfter = replaceOnce(
      messageAfter,
      "paletteSourceId:MTKsourceId}=e",
      "paletteSourceId:MTKsourceId,messageNode:MTKmessageNode}=e",
      "composed delegated message-node property"
    );
  } else {
    messageAfter = replaceOnce(
      messageAfter,
      "compactActions:c,onLabelClick:l}=e",
      "compactActions:c,onLabelClick:l,messageNode:MTKmessageNode}=e",
      "stock delegated message-node property"
    );
  }
  messageAfter = replaceOnce(
    messageAfter,
      `?(m=f?(0,${profile.jsx}.jsx)(${profile.messageComponent},{`,
    `||t[${cacheSize}]!==MTKmessageNode?(m=MTKmessageNode??(f?(0,${profile.jsx}.jsx)(${profile.messageComponent},{`,
    "delegated message-node branch"
  );
  messageAfter = replaceOnce(
    messageAfter,
    "):null,t[5]=u",
    `):null),t[${cacheSize}]=MTKmessageNode,t[5]=u`,
    "delegated message-node cache"
  );
  patched = patched.slice(0, message.start) + messageAfter + patched.slice(message.end);

  const delegationStart = patched.indexOf(`function ${profile.delegation}(`);
  const delegation = functionAt(patched, delegationStart);
  const delegationAfter = replaceOnce(
    delegation.text,
    `(${profile.message},{conversationId:n,label:p,message:i,`,
    `(${profile.message},{conversationId:n,label:p,message:i,messageNode:MTKtinrelayPointerNode(i,a),`,
    "Tinrelay pointer presentation"
  );
  patched = patched.slice(0, delegation.start) + delegationAfter + patched.slice(delegation.end);
  patched = patched.slice(0, delegation.start) + rendererHelpers(hostBus, localShip, profile) + patched.slice(delegation.start);
  patched = patchTinrelayLabelOwner(patched, profile);
  return patched;
}

function rendererHelpers(hostBus, localShip, profile = {jsx:"Tb", messageComponent:"Eg"}) {
  const jsx = profile.helperJsx ?? profile.jsx;
  return `${pointerHelpers(localShip, jsx)}${scrollHelpers()}${presentationHelpers(hostBus, jsx, profile.messageComponent)}`;
}

function pointerHelpers(localShip, jsx = "Tb") {
  return String.raw`const MTKtinrelayLocalShip=${JSON.stringify(localShip)};function MTKtinrelayEnvelope(e,t){if(typeof e!=="string"||e.includes("\r"))return null;let n=e.endsWith("\n")?e.slice(0,-1):e,r=n.indexOf("\n");if(r<0||n.indexOf("\n",r+1)>=0||n.slice(0,r)!==t)return null;let i;try{i=JSON.parse(n.slice(r+1))}catch{return null}return i==null||typeof i!=="object"||Array.isArray(i)?null:i}function MTKtinrelayPointerFromMessage(e){let r=MTKtinrelayEnvelope(e,"TINRELAY LOCAL POINTER");if(r==null)return null;let i=["attention_label","contract","kind","local_id","local_ship","sender_ship"];if(Object.keys(r).sort().join("\0")!==i.join("\0")||r.contract!=="tinrelay-local-pointer-v1"||r.kind!=="transmission"||typeof r.local_id!=="string"||!/^tr_[0-9a-f]{32}$/.test(r.local_id)||r.local_ship!==MTKtinrelayLocalShip||typeof r.sender_ship!=="string"||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(r.sender_ship)||typeof r.attention_label!=="string")return null;return r}function MTKtinrelayDeliveryFromMessage(e){let r=MTKtinrelayEnvelope(e,"TINRELAY MESSAGE DELIVERY");if(r==null)return null;let i=["attention_label","author_label","body","contract","kind","local_id","local_ship","sender_ship"];if(Object.keys(r).sort().join("\0")!==i.join("\0")||r.contract!=="tinrelay-message-delivery-v1"||r.kind!=="transmission"||typeof r.local_id!=="string"||!/^tr_[0-9a-f]{32}$/.test(r.local_id)||r.local_ship!==MTKtinrelayLocalShip||typeof r.sender_ship!=="string"||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(r.sender_ship)||typeof r.attention_label!=="string"||r.author_label!==null&&(typeof r.author_label!=="string"||r.author_label.length===0)||typeof r.body!=="string")return null;return r}function MTKtinrelayPointerNode(e,t){let n=MTKtinrelayDeliveryFromMessage(e);return n==null?MTKtinrelayPointerFromMessage(e)==null?null:(0,${jsx}.jsx)(MTKtinrelayPointerView,{pointerText:e,sentAtMs:t}):(0,${jsx}.jsx)(MTKtinrelayDeliveryView,{delivery:n,sentAtMs:t})}function MTKtinrelayAddress(e,t){return(typeof e==="string"&&e.length>0?e:"")+"@"+t}`;
}

function scrollHelpers() {
  return 'function MTKtinrelayScrollSnapshot(){let e=[...document.querySelectorAll(".thread-scroll-container")].find(e=>e.clientHeight>0&&e.getClientRects().length>0);return e==null?null:{element:e,follow:Math.max(0,-e.scrollTop)<=Math.max(1,e.clientHeight)}}function MTKtinrelayScheduleScroll(e){e?.follow===!0&&setTimeout(()=>{let t=e.element;t.isConnected&&t.clientHeight>0&&Math.max(0,-t.scrollTop)<=Math.max(1,t.clientHeight)&&t.scrollTo({behavior:"instant",top:0})},32)}';
}

function presentationHelpers(hostBus, jsx = "Tb", messageComponent = "Eg") {
  return `const MTKtinrelayHostBus=${hostBus};function MTKtinrelayEnsureStyle(){if(document.getElementById("mtk-tinrelay-signal-style"))return;let e=document.createElement("style");e.id="mtk-tinrelay-signal-style",e.textContent=${JSON.stringify(NEXT_VISUAL_CSS)},document.head.appendChild(e)}function MTKtinrelayMessageView({body:e,outgoing:t,screenReaderStatus:n,sentAtMs:r}){MTKtinrelayEnsureStyle();return(0,${jsx}.jsxs)("div",{"data-mtk-tinrelay-pointer":!0,"data-mtk-tinrelay-outgoing":t||void 0,className:"mtk-tinrelay-signal w-full",children:[n==null?null:(0,${jsx}.jsx)("span",{"aria-label":n,className:"sr-only",children:n}),(0,${jsx}.jsx)(${messageComponent},{message:e,sentAtMs:r,collapsedLineCount:6,compactActions:!1,cwd:null,hostId:"local"})]})}function MTKtinrelayIncomingView(e,t,n){return(0,${jsx}.jsxs)("div",{className:"flex w-full flex-col items-end justify-end gap-1",children:[(0,${jsx}.jsxs)("div",{className:"text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description",children:["📡 ",e]}),(0,${jsx}.jsx)(MTKtinrelayMessageView,{body:t,outgoing:!1,sentAtMs:n})]})}function MTKtinrelayDeliveryView({delivery:e,sentAtMs:t}){let n=MTKtinrelayAddress(e.author_label,e.sender_ship)+" → "+MTKtinrelayAddress(e.attention_label,e.local_ship);return MTKtinrelayIncomingView(n,e.body,t)}function MTKtinrelayPointerView({pointerText:e,sentAtMs:t}){let n=MTKtinrelayPointerFromMessage(e),[r,i]=MTKtinrelayReact.useState({status:"loading"}),a=MTKtinrelayReact.useRef(null),o=MTKtinrelayReact.useRef(!1),d=MTKtinrelayReact.useRef(null);MTKtinrelayReact.useEffect(()=>{let s=MTKtinrelayHostBus.subscribe("mtk-tinrelay-pointer-result",e=>{if(e?.requestId!==a.current)return;a.current=null;if(e.ok!==!0||e.transmission==null){i({status:"error",error:typeof e.error==="string"?e.error:"Tinrelay inspection failed."});return}let t=e.transmission;t.localId===n.local_id&&t.localShip===n.local_ship&&t.senderShip===n.sender_ship&&t.attentionLabel===n.attention_label&&(t.authorLabel===null||typeof t.authorLabel==="string"&&t.authorLabel.length>0)&&typeof t.body==="string"?(i({status:"ready",transmission:t}),MTKtinrelayScheduleScroll(d.current)):i({status:"error",error:"Tinrelay inspection did not match this pointer."})});if(!o.current){o.current=!0,d.current=MTKtinrelayScrollSnapshot();let c=crypto.randomUUID();a.current=c,MTKtinrelayHostBus.dispatchMessage("mtk-tinrelay-pointer-inspect",{requestId:c,pointerText:e})}return s},[n.local_id,n.local_ship,n.sender_ship,n.attention_label]);let u=r.status==="ready"?MTKtinrelayAddress(r.transmission.authorLabel,r.transmission.senderShip)+" → "+MTKtinrelayAddress(r.transmission.attentionLabel,r.transmission.localShip):"Tinrelay transmission from "+MTKtinrelayAddress(null,n.sender_ship),c=r.status==="ready"?r.transmission.body:r.status==="error"?r.error:"Inspecting…",l=r.status==="error"?"Tinrelay inspection failed":null;return l==null?MTKtinrelayIncomingView(u,c,t):(0,${jsx}.jsxs)("div",{className:"flex w-full flex-col items-end justify-end gap-1",children:[(0,${jsx}.jsxs)("div",{className:"text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description",children:["📡 ",u]}),(0,${jsx}.jsx)(MTKtinrelayMessageView,{body:c,outgoing:!1,screenReaderStatus:l,sentAtMs:t})]})}`;
}


function migrateRendererPresentation(value) {
  let patched = value;
  if (patched.includes(JSON.stringify(LEGACY_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(LEGACY_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay visual presentation"
    );
  } else if (patched.includes(JSON.stringify(SLOW_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(SLOW_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay visual presentation cadence"
    );
  } else if (patched.includes(JSON.stringify(PREVIOUS_CURRENT_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(PREVIOUS_CURRENT_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay continuous signal wake"
    );
  } else if (patched.includes(JSON.stringify(PREVIOUS_CUSTOM_CARD_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(PREVIOUS_CUSTOM_CARD_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay stock message-bubble presentation"
    );
  } else if (patched.includes(JSON.stringify(PREVIOUS_STOCK_BUBBLE_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(PREVIOUS_STOCK_BUBBLE_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay crisp directional skin"
    );
  } else if (patched.includes(JSON.stringify(PREVIOUS_NEXT_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(PREVIOUS_NEXT_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay optical vertical alignment"
    );
  } else if (patched.includes(JSON.stringify(PREVIOUS_CRISP_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(PREVIOUS_CRISP_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay incoming wave contrast"
    );
  } else if (patched.includes(JSON.stringify(PREVIOUS_VISIBLE_INCOMING_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(PREVIOUS_VISIBLE_INCOMING_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay outgoing wave simplification"
    );
  } else if (patched.includes(JSON.stringify(PREVIOUS_LIGHT_MODE_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(PREVIOUS_LIGHT_MODE_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay light-mode foreground"
    );
  } else if (patched.includes(JSON.stringify(PREVIOUS_LIGHT_FOREGROUND_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(PREVIOUS_LIGHT_FOREGROUND_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay light-mode palette"
    );
  } else if (patched.includes(JSON.stringify(ONE_SHOT_VISUAL_CSS))) {
    patched = replaceOnce(
      patched,
      JSON.stringify(ONE_SHOT_VISUAL_CSS),
      JSON.stringify(NEXT_VISUAL_CSS),
      "Tinrelay signal wake and code-block spacing"
    );
  } else if (!patched.includes(JSON.stringify(NEXT_VISUAL_CSS))) {
    throw new Error("Upstream changed: Tinrelay visual presentation is not recognized");
  }
  const legacyBodyCount = count(patched, LEGACY_BODY_CLASS);
  if (legacyBodyCount > 0) {
    patched = patched.split(LEGACY_BODY_CLASS).join(CURRENT_BODY_CLASS);
  }
  if (!patched.includes("function MTKtinrelayScrollSnapshot(")) {
    patched = replaceOnce(
      patched,
      'function MTKtinrelayEnsureStyle()',
      'function MTKtinrelayScrollSnapshot(){let e=[...document.querySelectorAll(".thread-scroll-container")].find(e=>e.clientHeight>0&&e.getClientRects().length>0);return e==null?null:{element:e,follow:Math.max(0,-e.scrollTop)<=Math.max(1,e.clientHeight)}}function MTKtinrelayScheduleScroll(e){e?.follow===!0&&setTimeout(()=>{let t=e.element;t.isConnected&&t.clientHeight>0&&Math.max(0,-t.scrollTop)<=Math.max(1,t.clientHeight)&&t.scrollTo({behavior:"instant",top:0})},32)}function MTKtinrelayEnsureStyle()',
      "Tinrelay scroll helpers"
    );
    patched = replaceOnce(
      patched,
      'a=MTKtinrelayReact.useRef(null),o=MTKtinrelayReact.useRef(!1);MTKtinrelayReact.useEffect(',
      'a=MTKtinrelayReact.useRef(null),o=MTKtinrelayReact.useRef(!1),d=MTKtinrelayReact.useRef(null);MTKtinrelayReact.useEffect(',
      "Tinrelay incoming scroll snapshot ref"
    );
    patched = replaceOnce(
      patched,
      '?i({status:"ready",transmission:t}):i({status:"error",error:"Tinrelay inspection did not match this pointer."})',
      '?(i({status:"ready",transmission:t}),MTKtinrelayScheduleScroll(d.current)):i({status:"error",error:"Tinrelay inspection did not match this pointer."})',
      "Tinrelay incoming settled scroll"
    );
    patched = replaceOnce(
      patched,
      'if(!o.current){o.current=!0;let c=crypto.randomUUID();',
      'if(!o.current){o.current=!0,d.current=MTKtinrelayScrollSnapshot();let c=crypto.randomUUID();',
      "Tinrelay incoming pre-hoist snapshot"
    );
  } else if (!patched.includes("&&Math.max(0,-t.scrollTop)<=Math.max(1,t.clientHeight)&&t.scrollTo")) {
    patched = replaceOnce(
      patched,
      't.isConnected&&t.clientHeight>0&&t.scrollTo({behavior:"instant",top:0})',
      't.isConnected&&t.clientHeight>0&&Math.max(0,-t.scrollTop)<=Math.max(1,t.clientHeight)&&t.scrollTo({behavior:"instant",top:0})',
      "Tinrelay settled scroll follow check"
    );
  }
  if (!patched.includes("function MTKtinrelayMessageView(")) {
    const styleStart = patched.indexOf("function MTKtinrelayEnsureStyle()");
    const pointerStart = patched.indexOf("function MTKtinrelayPointerView(", styleStart);
    const pointer = functionAt(patched, pointerStart);
    if (styleStart < 0 || pointerStart < styleStart) {
      throw new Error("Upstream changed: Tinrelay custom presentation is not localized");
    }
    patched = patched.slice(0, styleStart) + presentationHelpers(resolveHostBus(patched)) + patched.slice(pointer.end);
  }
  if (!patched.includes("function MTKtinrelayDeliveryFromMessage(") ||
      !patched.includes("function MTKtinrelayDeliveryView(")) {
    const profile = incomingRendererProfile(patched);
    const start = patched.indexOf("const MTKtinrelayLocalShip=");
    const pointerStart = patched.indexOf("function MTKtinrelayPointerView(", start);
    const pointer = functionAt(patched, pointerStart);
    const ship = uniqueMatch(
      patched.slice(start, pointer.start),
      /const MTKtinrelayLocalShip=(?<ship>"(?:\\.|[^"\\])*");/g,
      "embedded renderer Tinrelay ship"
    ).groups.ship;
    patched = patched.slice(0, start) +
      rendererHelpers(resolveHostBus(patched), JSON.parse(ship), profile) +
      patched.slice(pointer.end);
  }
  return patched;
}

function patchMain(value, config) {
  const helperOwner = ["var dQ=i.i(`electron-message-handler`)", "var mQ=i.i(`electron-message-handler`)", "var pQ=i.i(`electron-message-handler`)",
    "var fQ=i.i(`electron-message-handler`)"].find(owner => value.includes(owner));
  if (helperOwner == null) throw new Error("Upstream changed: Tinrelay main helper owner is not recognized");
  let patched = replaceOnce(
    value,
    helperOwner,
    `${mainHelpers(config)}${helperOwner}`,
    "Tinrelay main helper owner"
  );
  patched = replaceOnce(
    patched,
    "case`electron-add-new-workspace-root-option`:",
    "case`mtk-tinrelay-pointer-inspect`:{let n;try{let r=await MTKtinrelayInspect(t);n={type:`mtk-tinrelay-pointer-result`,requestId:t.requestId,ok:!0,transmission:r}}catch(r){n={type:`mtk-tinrelay-pointer-result`,requestId:typeof t.requestId===`string`?t.requestId:``,ok:!1,error:r instanceof Error?r.message:`Tinrelay inspection failed.`}}this.windowManager.sendMessageToWebContents(e,n);break}case`electron-add-new-workspace-root-option`:",
    "Tinrelay main message handler"
  );
  return patched;
}

function mainHelpers(config) {
  return String.raw`const MTKtinrelayClient=${JSON.stringify(config.client)},MTKtinrelayLocalShip=${JSON.stringify(config.localShip)};function MTKtinrelayMainPointer(e){if(typeof e?.requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(e.requestId)||typeof e.pointerText!=="string"||e.pointerText.includes("\r"))throw Error("Invalid local Tinrelay pointer.");let t=e.pointerText.endsWith("\n")?e.pointerText.slice(0,-1):e.pointerText,n=t.split("\n");if(n.length!==2||n[0]!=="TINRELAY LOCAL POINTER")throw Error("Invalid local Tinrelay pointer.");let r;try{r=JSON.parse(n[1])}catch{throw Error("Invalid local Tinrelay pointer.")}let i=["attention_label","contract","kind","local_id","local_ship","sender_ship"];if(r==null||typeof r!=="object"||Array.isArray(r)||Object.keys(r).sort().join("\0")!==i.join("\0")||r.contract!=="tinrelay-local-pointer-v1"||r.kind!=="transmission"||typeof r.local_id!=="string"||!/^tr_[0-9a-f]{32}$/.test(r.local_id)||r.local_ship!==MTKtinrelayLocalShip||typeof r.sender_ship!=="string"||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(r.sender_ship)||typeof r.attention_label!=="string")throw Error("Invalid local Tinrelay pointer.");return r}function MTKtinrelayExec(e){return new Promise((t,n)=>{x.execFile(MTKtinrelayClient,["--ship",e.local_ship,"inbox","show",e.local_id],{encoding:"utf8",maxBuffer:1048576,shell:!1,timeout:8e3,windowsHide:!0},(r,i)=>{if(r){n(Error(r.code==="ENOENT"?"Tinrelay client is unavailable.":"Tinrelay could not inspect this transmission."));return}t(i)})})}async function MTKtinrelayInspect(e){let t=MTKtinrelayMainPointer(e),n=await MTKtinrelayExec(t),r;try{r=JSON.parse(n)}catch{throw Error("Tinrelay returned an invalid inspection.")}if(r==null||typeof r!=="object"||Array.isArray(r)||r.contract!=="tinrelay-inspected-inbox-v1"||r.kind!=="transmission"||r.signed_transmission==null||typeof r.signed_transmission!=="object"||Array.isArray(r.signed_transmission))throw Error("Tinrelay inspection did not match this pointer.");let i=r.signed_transmission,a=r.author_label,o=i.from_label,s=typeof a==="string"&&a.length>0&&typeof o==="string"&&o===a||a===null&&(o===void 0||o===null);if(r.local_id!==t.local_id||r.recipient_ship!==t.local_ship||r.sender_ship!==t.sender_ship||r.attention_label!==t.attention_label||!s||r.sender_ship!==i.sender_ship||r.recipient_ship!==i.recipient_ship||r.attention_label!==i.to_label||typeof i.body!=="string")throw Error("Tinrelay inspection did not match this pointer.");return{localId:r.local_id,localShip:r.recipient_ship,senderShip:r.sender_ship,attentionLabel:r.attention_label,authorLabel:a,body:i.body}}`;
}

function patchTinrelayLabelOwner(value, profile = incomingRendererProfile(value)) {
  const start = value.indexOf(`function ${profile.message}(`);
  const message = functionAt(value, start);
  if (message.text.includes("MTKmessageNode?null:")) return value;
  const cache = new RegExp(`let t=\\(0,${escapeRegExp(profile.cache)}\\.c\\)\\((?<size>\\d+)\\)`).exec(message.text);
  if (cache == null) throw new Error("Upstream changed: delegated message label cache owner is missing");
  const cacheSize = Number(cache.groups.size);
  let after = message.text.replace(cache[0], `let t=(0,${profile.cache}.c)(${cacheSize + 1})`);
  const labelClass = profile.labelClass ?? "text-size-chat-sm flex items-center gap-1 px-1 py-0.5 text-codex-description";
  const mergeMatch = new RegExp(`className:(?<merge>[$A-Z_a-z][$\\w]*)\\(${escapeRegExp("`" + labelClass + "`")}`).exec(message.text);
  if (mergeMatch == null) throw new Error("Upstream changed: delegated message class merge owner is missing");
  const merge = mergeMatch.groups.merge;
  const before = `t[2]!==n||t[3]!==l?(p=l?(0,${profile.jsx}.jsx)(\`button\`,{type:\`button\`,className:${merge}(\`${labelClass}\`,\`cursor-interaction rounded-md hover:text-default\`),onClick:l,children:n}):(0,${profile.jsx}.jsx)(\`div\`,{className:\`${labelClass}\`,children:n}),t[2]=n,t[3]=l,t[4]=p):p=t[4]`;
  const replacement = `t[2]!==n||t[3]!==l||t[${cacheSize}]!==MTKmessageNode?(p=MTKmessageNode?null:l?(0,${profile.jsx}.jsx)(\`button\`,{type:\`button\`,className:${merge}(\`${labelClass}\`,\`cursor-interaction rounded-md hover:text-default\`),onClick:l,children:n}):(0,${profile.jsx}.jsx)(\`div\`,{className:\`${labelClass}\`,children:n}),t[2]=n,t[3]=l,t[${cacheSize}]=MTKmessageNode,t[4]=p):p=t[4]`;
  after = replaceOnce(after, before, replacement, "Tinrelay stock delegated-label suppression");
  return value.slice(0, message.start) + after + value.slice(message.end);
}


function resolveHostBus(source) {
  const busImports = [...source.matchAll(/import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/message-bus-[^"]+\.js)";/g)];
  if (busImports.length === 1) {
    const busSource = fs.readFileSync(path.resolve(path.dirname(renderer), busImports[0].groups.relative), "utf8");
    const singleton = uniqueMatch(busSource, /,(?<internal>[$A-Z_a-z][$\w]*)=[$A-Z_a-z][$\w]*\.getInstance\(\),/g, "message bus singleton").groups.internal;
    const exported = exportedAs(busSource, singleton);
    return uniqueMatch(
      busImports[0].groups.specifiers,
      new RegExp(`(?:^|,)${escapeRegExp(exported)} as (?<local>[$A-Z_a-z][$\\w]*)(?=,|$)`, "g"),
      "renderer message-bus import"
    ).groups.local;
  }
  const imported = uniqueMatch(
    source,
    /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g,
    "app-initial import"
  );
  const appInitial = fs.readFileSync(path.resolve(path.dirname(renderer), imported.groups.relative), "utf8");
  const exported = exportedAs(appInitial, appInitial.includes("function ALs(){") || appInitial.includes("function zLs(){") ? "H" : "U");
  const binding = uniqueMatch(
    imported.groups.specifiers,
    new RegExp(`(?:^|,)${escapeRegExp(exported)} as (?<local>[$A-Z_a-z][$\\w]*)(?=,|$)`, "g"),
    "renderer host-bus import"
  );
  return binding.groups.local;
}

function exportedAs(source, internal) {
  const exports = source.slice(source.lastIndexOf("export{"));
  return uniqueMatch(
    exports,
    new RegExp(`(?:^|,)${escapeRegExp(internal)} as (?<exported>[$A-Z_a-z][$\\w]*)(?=,|\\})`, "g"),
    `export for ${internal}`
  ).groups.exported;
}

function helperSlice(source) {
  const start = source.indexOf("const MTKtinrelayLocalShip=");
  const end = source.indexOf(`function ${incomingRendererProfile(source).delegation}(`, start);
  if (start < 0 || end < 0) throw new Error("Tinrelay renderer helper boundary is missing");
  return source.slice(start, end);
}

function mainHelperSlice(source) {
  const start = source.indexOf("const MTKtinrelayClient=");
  const boundaries = ["var dQ=i.i(`electron-message-handler`)", "var mQ=i.i(`electron-message-handler`)", "var pQ=i.i(`electron-message-handler`)",
    "var fQ=i.i(`electron-message-handler`)"]
    .map(marker => source.indexOf(marker, start))
    .filter(index => index >= 0);
  const end = boundaries.length === 1 ? boundaries[0] : -1;
  if (start < 0 || end < 0) throw new Error("Tinrelay main helper boundary is missing");
  return source.slice(start, end);
}

function functionAt(source, start) {
  if (start < 0) throw new Error("function owner is missing");
  const open = functionBodyStart(source, start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "`" || char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error("unterminated function owner");
}

function functionBodyStart(source, start) {
  const parameters = source.indexOf("(", start);
  if (parameters < 0) throw new Error("function parameters are missing");
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = parameters; index < source.length; index += 1) {
    const char = source[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "`" || char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")" && --depth === 0) {
      const body = source.indexOf("{", index + 1);
      if (body < 0) throw new Error("function body is missing");
      return body;
    }
  }
  throw new Error("unterminated function parameters");
}

function uniqueFile(pattern, directory = assets) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`missing extracted directory: ${directory}`);
  }
  const found = fs.readdirSync(directory).filter(name => pattern.test(name));
  if (found.length !== 1) throw new Error(`expected one ${pattern}, found ${found.length}`);
  return path.join(directory, found[0]);
}

function replaceOnce(value, before, after, label) {
  const first = value.indexOf(before);
  if (first < 0 || value.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Upstream changed: ${label} is not unique`);
  }
  return value.slice(0, first) + after + value.slice(first + before.length);
}

function uniqueMatch(value, pattern, label) {
  const matches = [...value.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Upstream changed: ${label} matches ${matches.length}`);
  return matches[0];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function readOption(name) {
  const index = process.argv.indexOf(name, 4);
  if (index < 0) return null;
  if (index !== process.argv.length - 2 || !process.argv[index + 1]) {
    throw new Error(`usage: ${name} must be followed by one value`);
  }
  return path.resolve(process.argv[index + 1]);
}

function configuredTinrelay() {
  if (configPath == null) throw new Error("tinrelay-pointer-presentation apply requires --config TOOLKIT_CONFIG");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read toolkit config: ${error.message}`);
  }
  if (config == null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Toolkit config must be a JSON object");
  }
  const tinrelay = config.tinrelay;
  if (tinrelay == null || typeof tinrelay !== "object" || Array.isArray(tinrelay) ||
      Object.keys(tinrelay).some(key => key !== "client" && key !== "localShip")) {
    throw new Error("Toolkit config tinrelay must contain only client and localShip");
  }
  const client = tinrelay.client;
  const localShip = tinrelay.localShip;
  if (typeof client !== "string" || !path.isAbsolute(client) || path.parse(client).root === path.resolve(client)) {
    throw new Error("Toolkit config tinrelay.client must be an absolute non-root path");
  }
  if (!validShip(localShip)) {
    throw new Error("Toolkit config tinrelay.localShip must be a lowercase DNS-style ship name");
  }
  return {client: path.resolve(client), localShip};
}

function embeddedConfiguration() {
  const literal = '"(?:\\\\.|[^"\\\\])*"';
  const renderer = uniqueMatch(
    rendererSource,
    new RegExp(`const MTKtinrelayLocalShip=(?<ship>${literal});function MTKtinrelay(?:Envelope|PointerFromMessage)\\(`, "g"),
    "embedded renderer Tinrelay configuration"
  ).groups;
  const main = uniqueMatch(
    mainSource,
    new RegExp(`const MTKtinrelayClient=(?<client>${literal}),MTKtinrelayLocalShip=(?<ship>${literal});function MTKtinrelayMainPointer\\(`, "g"),
    "embedded main Tinrelay configuration"
  ).groups;
  const config = {client: JSON.parse(main.client), localShip: JSON.parse(main.ship)};
  if (JSON.parse(renderer.ship) !== config.localShip || !path.isAbsolute(config.client) || !validShip(config.localShip)) {
    throw new Error("Upstream changed: embedded Tinrelay configuration is inconsistent");
  }
  return config;
}

function validShip(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
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
