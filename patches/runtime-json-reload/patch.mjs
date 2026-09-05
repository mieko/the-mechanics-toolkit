#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const configPath = readOption("--config");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: runtime-json-reload/patch.mjs check|apply EXTRACTED_ASAR_ROOT [--config TOOLKIT_CONFIG]");
}

const assets = path.join(root, "webview/assets");
const renderer = uniqueFile(/^app-initial-.*\.js$/, assets);
const main = uniqueFile(/^main-.*\.js$/, path.join(root, ".vite/build"));
const runtimeFiles = Object.freeze([
  "task-attention-policy.json",
  "task-visual-palette.json"
]);
let rendererSource = fs.readFileSync(renderer, "utf8");
let mainSource = fs.readFileSync(main, "utf8");
let state = inspectState();

if (command === "apply" && state === "needs-apply") {
  const workspaceRoot = configuredWorkspaceRoot();
  rendererSource = patchRenderer(rendererSource, workspaceRoot);
  mainSource = patchMain(mainSource, workspaceRoot);
  fs.writeFileSync(renderer, rendererSource);
  fs.writeFileSync(main, mainSource);
  syntaxCheck(renderer);
  syntaxCheck(main);
  state = inspectState();
  if (state !== "applied") throw new Error("runtime JSON reload transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  directory: ".codex",
  files: runtimeFiles,
  targets: [renderer, main].map(file => path.relative(root, file)).sort()
}, null, 2)}\n`);

function inspectState() {
  const rendererMarkers = [
    'const MTKruntimeJsonFiles=new Set(["task-attention-policy.json","task-visual-palette.json"])',
    "function MTKruntimeJsonRegister(",
    "function MTKinstallRuntimeJsonReload(",
    'U.subscribe("mtk-runtime-json-changed"',
    'U.dispatchMessage("mtk-runtime-json-watch",{})',
    "U=H.getInstance(),MTKinstallRuntimeJsonReload(),"
  ];
  const mainMarkers = [
    "const MTKruntimeJsonFs=require(\"node:fs\")",
    "function MTKstartRuntimeJsonWatch(",
    "function MTKcloseRuntimeJsonWatch(",
    'MTKruntimeJsonFs.watch(n,{persistent:!1}',
    'type:"mtk-runtime-json-changed"',
    'case`mtk-runtime-json-watch`:MTKstartRuntimeJsonWatch(e,this.windowManager);break'
  ];
  const rendererApplied = rendererMarkers.every(marker => rendererSource.includes(marker));
  const mainApplied = mainMarkers.every(marker => mainSource.includes(marker));
  if (rendererApplied && mainApplied) return "applied";
  if (rendererMarkers.some(marker => rendererSource.includes(marker)) ||
      mainMarkers.some(marker => mainSource.includes(marker))) {
    throw new Error("Upstream changed: runtime JSON reload patch is partial");
  }
  inspectPristineRenderer();
  inspectPristineMain();
  return "needs-apply";
}

function inspectPristineRenderer() {
  for (const contract of [
    "U=H.getInstance(),y((e,t)=>{U.dispatchMessage(e,t)})",
    "export{"
  ]) {
    if (count(rendererSource, contract) !== 1) {
      throw new Error(`Upstream changed: runtime JSON renderer contract is not unique: ${contract}`);
    }
  }
  if (!/(?:\{|,)U as [$A-Z_a-z][$\w]*(?=,|})/.test(rendererSource.slice(rendererSource.lastIndexOf("export{")))) {
    throw new Error("Upstream changed: renderer host bus is not exported from app-initial");
  }
}

function inspectPristineMain() {
  for (const contract of [
    "var mQ=i.i(`electron-message-handler`)",
    "case`show-plan-summary`:break;case`update-diff-if-open`:break;",
    "case`electron-add-new-workspace-root-option`:"
  ]) {
    if (count(mainSource, contract) !== 1) {
      throw new Error(`Upstream changed: runtime JSON main-process contract is not unique: ${contract}`);
    }
  }
}

function patchRenderer(value, workspaceRoot) {
  const helper = rendererHelper(workspaceRoot);
  let patched = helper + value;
  patched = replaceOnce(
    patched,
    "U=H.getInstance(),y((e,t)=>{U.dispatchMessage(e,t)})",
    "U=H.getInstance(),MTKinstallRuntimeJsonReload(),y((e,t)=>{U.dispatchMessage(e,t)})",
    "renderer host-bus initialization"
  );
  return patched;
}

function rendererHelper(workspaceRoot) {
  return String.raw`const MTKruntimeJsonFiles=new Set(["task-attention-policy.json","task-visual-palette.json"]),MTKruntimeJsonAcceptors=new Map;let MTKruntimeJsonInstalled=!1;function MTKruntimeJsonQueue(e,t=!1){let n=MTKruntimeJsonAcceptors.get(e);if(n!=null)if(n.running)n.queued=!0,n.initial=n.initial||t;else{n.running=!0;let r=t;Promise.resolve().then(()=>n.accept(Object.freeze({initial:r}))).catch(()=>!1).finally(()=>{n.running=!1;if(MTKruntimeJsonAcceptors.get(e)!==n)return;if(n.queued){let t=n.initial;n.queued=!1,n.initial=!1,MTKruntimeJsonQueue(e,t)}})}}function MTKruntimeJsonRegister(e,t){if(!MTKruntimeJsonFiles.has(e)||typeof t!=="function")return null;let n={accept:t,running:!1,queued:!1,initial:!1};MTKruntimeJsonAcceptors.set(e,n),queueMicrotask(()=>{MTKruntimeJsonAcceptors.get(e)===n&&MTKruntimeJsonQueue(e,!0)});return()=>{MTKruntimeJsonAcceptors.get(e)===n&&MTKruntimeJsonAcceptors.delete(e)}}function MTKinstallRuntimeJsonReload(){if(MTKruntimeJsonInstalled)return;MTKruntimeJsonInstalled=!0;let e=globalThis.__MTK_RUNTIME_JSON_RELOAD__;if(e!==void 0&&e?.version!==1)return;globalThis.__MTK_RUNTIME_JSON_RELOAD__=Object.freeze({version:1,register:MTKruntimeJsonRegister,workspaceRoot:${JSON.stringify(workspaceRoot)}}),U.subscribe("mtk-runtime-json-changed",e=>{MTKruntimeJsonFiles.has(e?.fileName)&&MTKruntimeJsonQueue(e.fileName,!1)}),U.dispatchMessage("mtk-runtime-json-watch",{})}`;
}

function patchMain(value, workspaceRoot) {
  let patched = replaceOnce(
    value,
    "var mQ=i.i(`electron-message-handler`)",
    mainHelper(workspaceRoot) + "var mQ=i.i(`electron-message-handler`)",
    "main-process runtime JSON helper owner"
  );
  patched = replaceOnce(
    patched,
    "case`electron-add-new-workspace-root-option`:",
    "case`mtk-runtime-json-watch`:MTKstartRuntimeJsonWatch(e,this.windowManager);break;case`electron-add-new-workspace-root-option`:",
    "main-process runtime JSON message handler"
  );
  return patched;
}

function mainHelper(workspaceRoot) {
  return String.raw`const MTKruntimeJsonFs=require("node:fs"),MTKruntimeJsonPath=require("node:path"),MTKruntimeJsonRoot=${JSON.stringify(workspaceRoot)},MTKruntimeJsonNames=new Set(["task-attention-policy.json","task-visual-palette.json"]),MTKruntimeJsonWatchers=new Map;function MTKcloseRuntimeJsonWatch(e){let t=MTKruntimeJsonWatchers.get(e);if(t!=null){MTKruntimeJsonWatchers.delete(e);for(let e of t.timers.values())clearTimeout(e);t.timers.clear();try{t.watcher.close()}catch{}}}function MTKscheduleRuntimeJsonChange(e,t){let n=e.timers.get(t);n!==void 0&&clearTimeout(n),e.timers.set(t,setTimeout(()=>{e.timers.delete(t);try{e.windowManager.sendMessageToWebContents(e.webContents,{type:"mtk-runtime-json-changed",fileName:t})}catch{}},180))}function MTKstartRuntimeJsonWatch(e,t){if(e==null||!Number.isInteger(e.id)||MTKruntimeJsonWatchers.has(e.id))return;let n=MTKruntimeJsonPath.join(MTKruntimeJsonRoot,".codex");try{let r=MTKruntimeJsonFs.lstatSync(n);if(!r.isDirectory()||r.isSymbolicLink())return;let i={webContents:e,windowManager:t,watcher:null,timers:new Map},a=MTKruntimeJsonFs.watch(n,{persistent:!1},(e,t)=>{let n=t==null?null:Buffer.isBuffer(t)?t.toString("utf8"):String(t);n==null?MTKruntimeJsonNames.forEach(e=>MTKscheduleRuntimeJsonChange(i,e)):MTKruntimeJsonNames.has(n)&&MTKscheduleRuntimeJsonChange(i,n)});i.watcher=a,MTKruntimeJsonWatchers.set(e.id,i),a.on("error",()=>MTKcloseRuntimeJsonWatch(e.id)),e.once("destroyed",()=>MTKcloseRuntimeJsonWatch(e.id))}catch{}}`;
}

function configuredWorkspaceRoot() {
  if (configPath == null) throw new Error("runtime-json-reload apply requires --config TOOLKIT_CONFIG");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read toolkit config: ${error.message}`);
  }
  if (config == null || typeof config !== "object" || Array.isArray(config) ||
      typeof config.workspaceRoot !== "string" || !path.isAbsolute(config.workspaceRoot) ||
      config.workspaceRoot.includes("\0")) {
    throw new Error("runtime-json-reload requires an absolute workspaceRoot in toolkit config");
  }
  return path.normalize(config.workspaceRoot);
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (value == null || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return path.resolve(value);
}

function uniqueFile(pattern, directory) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`Missing extracted directory: ${directory}`);
  }
  const matches = fs.readdirSync(directory).filter(name => pattern.test(name));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} files matching ${pattern}`);
  return path.join(directory, matches[0]);
}

function replaceOnce(value, before, after, label) {
  const first = value.indexOf(before);
  if (first < 0 || value.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Upstream changed: ${label} is not unique`);
  }
  return value.slice(0, first) + after + value.slice(first + before.length);
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
