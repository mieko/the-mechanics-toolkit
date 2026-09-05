#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: task-supervisor.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const target = uniqueAsset(/^app-initial-.*\.js$/);
let source = fs.readFileSync(target, "utf8");
let state = inspectState(source);

if (command === "apply" && state === "needs-apply") {
  source = patchSource(source);
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState(source);
  if (state !== "applied") throw new Error("task supervisor transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  config: "$CODEX_HOME/task-supervision.json",
  modes: ["on_start", "keep_alive"],
  selectorPrecedence: ["taskId", "titlePattern"],
  target: path.relative(root, target)
}, null, 2)}\n`);

function inspectState(value) {
  const profile = resolveProfile(value);
  const suffix = profile.build;
  const markers = [
    `const MTKtaskSupervisorConfigName${suffix}="task-supervision.json"`,
    `function MTKparseTaskSupervisorConfig${suffix}(`,
    `function MTKresolveTaskSupervisorRules${suffix}(`,
    `async function MTKstartTaskSupervisor${suffix}(`,
    `function MTKuseTaskSupervisor${suffix}(`,
    `${profile.composedRoot}MTKuseTaskSupervisor${suffix}();`
  ];
  const present = markers.map(marker => value.includes(marker));
  if (present.every(Boolean)) {
    if (count(value, `function MTKuseTaskSupervisor${suffix}(`) !== 1 ||
        count(value, `${profile.composedRoot}MTKuseTaskSupervisor${suffix}();`) !== 1) {
      throw new Error("Unrecognized task supervisor patch: ownership is ambiguous");
    }
    return "applied";
  }
  if (present.some(Boolean)) throw new Error("Unrecognized task supervisor patch: partial markers");
  if (count(value, profile.composedRoot) !== 1) {
    if (count(value, profile.stockRoot) === 1) {
      throw new Error("Task supervisor requires the attention-policy and palette bootstraps");
    }
    throw new Error(`Upstream changed: build-${suffix} task supervisor owner is unavailable`);
  }
  return "needs-apply";
}

function patchSource(value) {
  const profile = resolveProfile(value);
  const suffix = profile.build;
  let helper = String.raw`
const MTKtaskSupervisorConfigName7746="task-supervision.json",MTKtaskSupervisorLock7746="mechanics-toolkit-task-supervisor-v1";
function MTKtaskSupervisorPlainObject7746(e){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&Object.getPrototypeOf(e)===Object.prototype}
function MTKtaskSupervisorBase64Size7746(e){return Math.floor(e.length*3/4)-(e.endsWith("==")?2:+e.endsWith("="))}
function MTKtaskSupervisorMissing7746(e){return e instanceof Error&&("code"in e&&e.code==="ENOENT"||e.message.includes("No such file or directory")||e.message.includes("(os error 2)"))}
function MTKparseTaskSupervisorConfig7746(e){let t;try{t=typeof e==="string"?JSON.parse(e):e}catch{return null}if(!MTKtaskSupervisorPlainObject7746(t)||Object.keys(t).length!==1||!Array.isArray(t.tasks)||t.tasks.length>64)return null;let n=[],r=new Set;for(let e of t.tasks){if(!MTKtaskSupervisorPlainObject7746(e))return null;let t=Object.keys(e),i=new Set(["taskId","titlePattern","mode","prompt","idleSeconds"]);if(t.some(e=>!i.has(e)))return null;let a=typeof e.taskId==="string"?e.taskId:null,o=typeof e.titlePattern==="string"?e.titlePattern:null;if((a==null)===(o==null)||a!=null&&(a.length===0||a.length>128)||o!=null&&(o.length===0||o.length>512))return null;if(a!=null){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a)||r.has(a))return null;r.add(a)}let s=null;if(o!=null)try{s=new RegExp(o)}catch{return null}if(e.mode!=="on_start"&&e.mode!=="keep_alive")return null;let c=e.prompt??"continue";if(typeof c!=="string"||c.length===0||c.length>4096)return null;let l=e.idleSeconds??5;if(e.mode==="on_start"&&"idleSeconds"in e||!Number.isInteger(l)||l<5||l>300)return null;n.push({taskId:a,titlePattern:s,titlePatternSource:o,mode:e.mode,prompt:c,idleMs:l*1e3})}return n}
async function MTKloadTaskSupervisorConfig7746(e){try{let t=await e.sendRequest("config/read",{includeLayers:!0},{priority:"background",source:"task_supervisor"}),n=[...new Set((t.layers??[]).filter(e=>e?.name?.type==="user").map(e=>e.name.file).filter(e=>typeof e==="string"&&e.startsWith("/")&&e.endsWith("/config.toml")))];if(n.length!==1)return null;let r=n[0].slice(0,n[0].lastIndexOf("/")),i=r+"/"+MTKtaskSupervisorConfigName7746;try{let t=await e.sendRequest("fs/getMetadata",{path:r});if(!t.isDirectory||t.isSymlink)throw Error("unsafe task supervisor directory");let n=await e.sendRequest("fs/getMetadata",{path:i});if(!n.isFile||n.isSymlink)throw Error("unsafe task supervisor file");let{dataBase64:a}=await e.sendRequest("fs/readFile",{path:i});if(MTKtaskSupervisorBase64Size7746(a)>16384)throw Error("task supervisor config too large");return MTKparseTaskSupervisorConfig7746(new TextDecoder().decode(Uint8Array.from(atob(a),e=>e.charCodeAt(0))))}catch(e){if(MTKtaskSupervisorMissing7746(e))return null;throw e}}catch(e){console.warn("[task-supervisor] configuration disabled",e);return null}}
async function MTKlistTaskSupervisorThreads7746(e){let t=[],n=null;for(let r=0;r<20;r+=1){let i=await e.sendRequest("thread/list",{archived:!1,cursor:n,limit:100,modelProviders:null,sortKey:"updated_at",useStateDbOnly:!0},{priority:"background",source:"task_supervisor"});if(!Array.isArray(i.data))throw Error("invalid task supervisor thread list");t.push(...i.data),n=i.nextCursor??null;if(n==null)return t}throw Error("task supervisor thread list exceeded 2000 entries")}
function MTKresolveTaskSupervisorRules7746(e,t){let n=new Map(e.filter(e=>e.taskId!=null).map(e=>[e.taskId,e])),r=[],i=new Map;for(let a of t){if(a==null||typeof a.id!=="string")continue;let t=n.get(a.id);if(t!=null){r.push({rule:t,thread:a});continue}let o=typeof a.name==="string"?a.name:"",s=e.find(e=>e.titlePattern!=null&&e.titlePattern.test(o));s!=null&&(i.has(s)||i.set(s,[]),i.get(s).push(a))}for(let[e,t]of i)t.length===1?r.push({rule:e,thread:t[0]}):console.warn("[task-supervisor] titlePattern matched "+t.length+" tasks; skipping",e.titlePatternSource);return r}
async function MTKdiscoverTaskSupervisorTasks7746(e,t){let n=await MTKlistTaskSupervisorThreads7746(e),r=new Set(n.map(e=>e?.id).filter(e=>typeof e==="string"));for(let i of t)if(i.taskId!=null&&!r.has(i.taskId))try{let{thread:t}=await e.sendRequest("thread/read",{threadId:i.taskId,includeTurns:!1},{priority:"background",source:"task_supervisor"});t!=null&&n.push(t)}catch{}return MTKresolveTaskSupervisorRules7746(t,n)}
async function MTKstartTaskSupervisor7746(e,t,n=globalThis){if(t==null||t.length===0)return{dispose(){},states:new Map};let r=!1,i=new Map,a=n.setTimeout?.bind(n)??setTimeout,o=n.clearTimeout?.bind(n)??clearTimeout,s=n.crypto??crypto,c=n.console??console,h=n.performance?.now?.bind(n.performance)??(()=>Date.now()),l=e=>{e.timer!=null&&(o(e.timer),e.timer=null)},u=e=>{if(r||e.rule.mode!=="keep_alive"||e.tripped||e.sending||e.timer!=null||e.status!=="idle"&&e.status!=="notLoaded")return;e.timer=a(()=>{e.timer=null,void f(e)},e.rule.idleMs)},d=e=>{e.tripped=!0,l(e),c.warn("[task-supervisor] automatic recovery completed too quickly; fuse opened until human activity or restart",{threadId:e.thread.id})},f=async t=>{if(r||t.tripped||t.sending||t.status!=="idle"&&t.status!=="notLoaded")return;t.sending=!0;try{let{thread:n}=await e.sendRequest("thread/read",{threadId:t.thread.id,includeTurns:!1},{priority:"background",source:"task_supervisor"});if(r)return;if(n.status?.type==="notLoaded"){let r=await e.sendRequest("thread/resume",{threadId:t.thread.id,excludeTurns:!0},{priority:"critical",source:"task_supervisor"});n=r.thread}if(r||n.status?.type!=="idle"||t.status==="active"||n.canAcceptDirectInput===!1)return;t.status="starting",t.autoStartedAt=h();let i=s.randomUUID(),a=await e.sendRequest("turn/start",{threadId:t.thread.id,input:[{type:"text",text:t.rule.prompt,text_elements:[]}],clientUserMessageId:i,turnTrigger:"task_supervisor"},{priority:"critical",source:"task_supervisor"});t.autoTurnId=a.turn.id,t.status="active",c.info("[task-supervisor] started configured task",{threadId:t.thread.id,mode:t.rule.mode})}catch(e){t.autoStartedAt=null,t.rule.mode==="keep_alive"&&(t.tripped=!0),c.warn("[task-supervisor] start failed; supervision stopped until human activity or restart",{threadId:t.thread.id,error:e})}finally{t.sending=!1}},p=await MTKdiscoverTaskSupervisorTasks7746(e,t);for(let{rule:e,thread:t}of p){let n={rule:e,thread:t,status:t.status?.type??"notLoaded",timer:null,sending:!1,autoTurnId:null,autoStartedAt:null,tripped:!1};i.set(t.id,n)}let m=e.addNotificationCallback(["thread/status/changed","turn/started","turn/completed"],({method:e,params:t})=>{let n=i.get(t.threadId);if(n==null||r)return;if(e==="thread/status/changed"){n.status=t.status?.type??"systemError",n.status==="active"?l(n):n.status==="idle"&&u(n);return}if(e==="turn/started"){n.status="active",l(n);let e=t.turn?.id;if(n.sending||e!=null&&e===n.autoTurnId)e!=null&&(n.autoTurnId=e);else n.autoTurnId=null,n.autoStartedAt=null,n.tripped=!1;return}if(e==="turn/completed"){n.status="idle";let e=t.turn?.id;if(n.sending||e!=null&&e===n.autoTurnId){e!=null&&(n.autoTurnId=e);let t=n.autoStartedAt;n.autoStartedAt=null,t==null||h()-t<n.rule.idleMs?d(n):(n.tripped=!1,u(n));return}n.autoTurnId=null,n.autoStartedAt=null,n.tripped=!1,u(n)}});for(let e of i.values())e.rule.mode==="on_start"?void f(e):u(e);return{states:i,dispose(){if(r)return;r=!0,m?.();for(let e of i.values())l(e)}}}
function MTKuseTaskSupervisor7746(){let e=pb(Q);return ZOs.useEffect(()=>{let t=!1,n=null,r=null,i=new AbortController,a=()=>{r?.(),r=null};if(navigator.locks?.request==null)return console.warn("[task-supervisor] Web Locks unavailable; supervision disabled"),()=>{};return navigator.locks.request(MTKtaskSupervisorLock7746,{signal:i.signal},async()=>{if(t)return;e.get(Tb)==null&&await e.when(({get:e})=>e(Tb)!=null);let i=wb(e,"local"),o=await MTKloadTaskSupervisorConfig7746(i);if(t)return;n=await MTKstartTaskSupervisor7746(i,o),await new Promise(e=>{r=e}),n.dispose(),n=null}).catch(e=>{e?.name!=="AbortError"&&console.warn("[task-supervisor] owner failed",e)}),()=>{t=!0,i.abort(),a(),n?.dispose(),n=null}},[e]),null}
`;
  helper = helper.replaceAll("7746", suffix)
    .replaceAll("pb(Q)", `${profile.scope}(Q)`)
    .replaceAll("ZOs.useEffect", `${profile.react}.useEffect`)
    .replaceAll("e.get(Tb)", `e.get(${profile.ready})`)
    .replaceAll("e(Tb)", `e(${profile.ready})`)
    .replaceAll('wb(e,"local")', `${profile.manager}(e,"local")`);
  const rootOwner = profile.composedRoot;
  return replaceOnce(
    value,
    rootOwner,
    `${helper}${rootOwner}MTKuseTaskSupervisor${suffix}();`,
    `build-${suffix} task supervisor bootstrap`
  );
}

function resolveProfile(value) {
  const profiles = [
    {
      build: "7746",
      stockRoot: "function qOs(){let e=",
      composedRoot: "function qOs(){MTKuseAttentionBootstrap7746();MTKusePaletteBootstrap();",
      scope: "pb",
      react: "ZOs",
      ready: "Tb",
      manager: "wb"
    },
    {
      build: "7942",
      stockRoot: "function Oks(){let e=",
      composedRoot: "function Oks(){MTKuseAttentionBootstrap7942();MTKusePaletteBootstrap();",
      scope: "hb",
      react: "Mks",
      ready: "Db",
      manager: "Eb"
    }
  ];
  const matches = profiles.filter(profile =>
    value.includes(profile.stockRoot) || value.includes(profile.composedRoot) ||
    value.includes(`MTKtaskSupervisorConfigName${profile.build}`));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} task supervisor build profiles`);
  return matches[0];
}

function uniqueAsset(pattern) {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const matches = fs.readdirSync(assets).filter(name => pattern.test(name));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} assets matching ${pattern}`);
  return path.join(assets, matches[0]);
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
