#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const configPath = readOption("--config");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: task-attention-policy.mjs check|apply EXTRACTED_ASAR_ROOT [--config TOOLKIT_CONFIG]");
}

const assets = path.join(root, "webview/assets");
const target = uniqueAsset(/^app-initial-.*\.js$/);
const primaryTarget = uniqueAsset(/^app-primary-.*\.js$/);
let source = fs.readFileSync(target, "utf8");
let primarySource = fs.readFileSync(primaryTarget, "utf8");
let state = inspectState(source, primarySource);

if (command === "apply" && state === "needs-apply") {
  const workspaceRoot = configuredWorkspaceRoot();
  if (current7942Contracts(source, primarySource).every(Boolean)) {
    ({ appSource: source, primarySource } = patch7942(source, primarySource, workspaceRoot));
  } else if (current7746Contracts(source, primarySource).every(Boolean)) {
    ({ appSource: source, primarySource } = patch7746(source, primarySource, workspaceRoot));
  } else if (current7345Contracts().every(contract => source.includes(contract))) {
    source = patch7345(source, workspaceRoot);
  } else {
    source = patchSource(source);
  }
  fs.writeFileSync(target, source);
  fs.writeFileSync(primaryTarget, primarySource);
  syntaxCheck(target);
  syntaxCheck(primaryTarget);
  state = inspectState(source, primarySource);
  if (state !== "applied") throw new Error("task attention policy transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  policy: ".codex/task-attention-policy.json",
  targets: [target, primaryTarget].map(file => path.relative(root, file))
}, null, 2)}\n`);

function inspectState(value, primaryValue) {
  const build7942Markers = [
    value.includes('const MTKattentionRelativePath=".codex/task-attention-policy.json"'),
    value.includes("MTKattentionPolicyAtom=My(Q,null)"),
    value.includes("function MTKattentionIgnoredThread7942("),
    value.includes("function MTKacceptAttentionReload7942("),
    value.includes('__MTK_RUNTIME_JSON_RELOAD__?.register("task-attention-policy.json"'),
    value.includes("function MTKuseAttentionBootstrap7942("),
    value.includes("function Oks(){MTKuseAttentionBootstrap7942();"),
    primaryValue.includes("function MTKuseTaskAttention7942("),
    primaryValue.includes("MTKattentionIgnoredForTask=MTKuseTaskAttention7942(ft,n)"),
    primaryValue.includes("let kt=MTKattentionIgnoredForTask?{...Ot,unread:!1,unreadCount:0}:Ot"),
    primaryValue.includes("Nt=MTKattentionIgnoredForTask?[]:Mt==null?[]:[Mt]"),
    primaryValue.includes("let zt=MTKattentionIgnoredForTask?void 0:Rt"),
    primaryValue.includes("hasUnreadTurn:!MTKattentionIgnoredForTask&&!Tt&&$e===!0"),
    value.includes("s=s.filter(t=>!MTKattentionIgnoredThread7942(e,t,c))"),
    value.includes("[desktop-notifications] suppressed task-attention-policy turn-complete")
  ];
  if (build7942Markers.some(Boolean)) {
    if (!build7942Markers.every(Boolean)) throw new Error("Unrecognized build-7942 task attention patch: partial markers");
    return "applied";
  }
  const build7746Markers = [
    value.includes('const MTKattentionRelativePath=".codex/task-attention-policy.json"'),
    value.includes("MTKattentionPolicyAtom=ky(Q,null)"),
    value.includes("function MTKattentionIgnoredThread7746("),
    value.includes("function MTKacceptAttentionReload7746("),
    value.includes('__MTK_RUNTIME_JSON_RELOAD__?.register("task-attention-policy.json"'),
    value.includes("function MTKuseAttentionBootstrap7746("),
    value.includes("function qOs(){MTKuseAttentionBootstrap7746();"),
    primaryValue.includes("function MTKuseTaskAttention7746("),
    primaryValue.includes("MTKattentionIgnoredForTask=MTKuseTaskAttention7746(dt,n)"),
    primaryValue.includes("let Ot=MTKattentionIgnoredForTask?{...Dt,unread:!1,unreadCount:0}:Dt"),
    primaryValue.includes("Mt=MTKattentionIgnoredForTask?[]:jt==null?[]:[jt]"),
    primaryValue.includes("let Rt=MTKattentionIgnoredForTask?void 0:Lt"),
    primaryValue.includes("hasUnreadTurn:!MTKattentionIgnoredForTask&&!wt&&Qe===!0"),
    value.includes("s=s.filter(t=>!MTKattentionIgnoredThread7746(e,t,c))"),
    value.includes("[desktop-notifications] suppressed task-attention-policy turn-complete")
  ];
  if (build7746Markers.some(Boolean)) {
    if (!build7746Markers.every(Boolean)) throw new Error("Unrecognized build-7746 task attention patch: partial markers");
    return "applied";
  }
  if (value.includes("function MTKuseAttentionBootstrap7345(")) {
    const currentMarkers = [
      'const MTKattentionRelativePath=".codex/task-attention-policy.json"',
      "MTKattentionPolicyAtom=Qg($,null)",
      "function MTKattentionIgnoredThread7345(",
      "function MTKacceptAttentionReload7345(",
      '__MTK_RUNTIME_JSON_RELOAD__?.register("task-attention-policy.json"',
      "function MTKuseTaskAttention7345(",
      "function g$c(e){MTKuseAttentionBootstrap7345();",
      "MTKattentionIgnoredForTask=MTKuseTaskAttention7345(dt,n)",
      "let kt=MTKattentionIgnoredForTask?{...Ot,unread:!1,unreadCount:0}:Ot",
      "Nt=MTKattentionIgnoredForTask?[]:Mt==null?[]:[Mt]",
      "let zt=MTKattentionIgnoredForTask?void 0:Rt",
      "hasUnreadTurn:!MTKattentionIgnoredForTask&&!wt&&Qe===!0",
      "s=s.filter(t=>!MTKattentionIgnoredThread7345(e,t,c))",
      "[desktop-notifications] suppressed task-attention-policy turn-complete"
    ];
    if (!currentMarkers.every(marker => value.includes(marker))) {
      throw new Error("Unrecognized build-7345 task attention patch: partial markers");
    }
    return "applied";
  }
  const markers = [
    'const MTKattentionRelativePath=".codex/task-attention-policy.json"',
    "MTKattentionPolicyAtom=Ga(Q,null)",
    "function MTKloadAttentionPolicy(",
    "function MTKattentionIgnoredThread(",
    "function MTKacceptAttentionReload(",
    '__MTK_RUNTIME_JSON_RELOAD__?.register("task-attention-policy.json"',
    "function MTKuseAttentionBootstrap(",
    "function MTKuseTaskAttention(",
    "MTKuseAttentionBootstrap();",
    "MTKattentionIgnoredForTask=MTKuseTaskAttention(ut,n)",
    "let Ot=MTKattentionIgnoredForTask?{...Dt,unread:!1,unreadCount:0}:Dt",
    "Mt=MTKattentionIgnoredForTask?[]:jt==null?[]:[jt]",
    "let Rt=MTKattentionIgnoredForTask?void 0:Lt",
    "hasUnreadTurn:!MTKattentionIgnoredForTask&&!Ct&&Qe===!0",
    "s=s.filter(t=>!MTKattentionIgnoredThread(e,t,c))",
    "[desktop-notifications] suppressed task-attention-policy turn-complete"
  ];
  const present = markers.map(marker => value.includes(marker));
  if (present.every(Boolean)) {
    if (count(value, "function MTKloadAttentionPolicy(") !== 1 ||
        count(value, "MTKattentionPolicyAtom=Ga(Q,null)") !== 1 ||
        count(value, "function MTKattentionIgnoredThread(") !== 1 ||
        count(value, "s=s.filter(t=>!MTKattentionIgnoredThread(e,t,c))") !== 1 ||
        count(value, "function MTKuseTaskAttention(") !== 1 ||
        count(value, "MTKattentionIgnoredForTask=MTKuseTaskAttention(ut,n)") !== 1) {
      throw new Error("Unrecognized task attention patch: helper or row ownership is ambiguous");
    }
    const notifications = containingFunction(value, value.indexOf("[desktop-notifications] service starting"));
    if (count(notifications, "MTKattentionIgnored(") !== 1 ||
        !notifications.includes("e.getConversation(t.conversationId)")) {
      throw new Error("Unrecognized task attention patch: notification source ownership changed");
    }
    if (value.includes("function hYl(e){") && !value.includes("Bml(),SW(),H4a(),oTl(),nwl()")) {
      throw new Error("Unrecognized task attention patch: policy atom initializer is not owned by the sidebar bootstrap");
    }
    return "applied";
  }
  if (present.some(Boolean)) throw new Error("Unrecognized task attention patch: partial markers");

  if (current7942Contracts(value, primaryValue).every(Boolean)) return "needs-apply";
  if (current7746Contracts(value, primaryValue).every(Boolean)) return "needs-apply";
  if (current7345Contracts().every(contract => value.includes(contract))) return "needs-apply";
  const matches = profiles().filter(profile => profile.contracts.every(contract => value.includes(contract)));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} task attention ownership profiles`);
  for (const contract of matches[0].contracts) {
    if (!value.includes(contract)) throw new Error(`Upstream changed: missing task attention contract ${contract}`);
  }
  return "needs-apply";
}

function current7942Contracts(appValue, primaryValue) {
  return [
    ["function Oks(){MTKusePaletteBootstrap();let e=(0,jks.c)(12),", "function Oks(){let e=(0,jks.c)(12),"].some(contract => appValue.includes(contract)),
    appValue.includes("function Nhs(e,t){T.info(`[desktop-notifications] service starting`)"),
    appValue.includes("let a=RB(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=h(t.conversationId)"),
    appValue.includes("eqa,tqa=t((()=>{Z(),") && appValue.includes("eqa=Iy(Q,({get:e})=>"),
    appValue.includes("s=t===`work`?_fr({cloudThreadsAllowed:i,localThreadsAllowed:_F(e(VO)),threadKeys:o}):o;return r+"),
    primaryValue.includes("function Fjn(e){let t=(0,Ljn.c)(151),"),
    primaryValue.includes("ft=qw($Dn,{hostId:qe??`local`,threadId:n})??He?.title??null,pt=qw(gwe,n)??He?.threadSource"),
    primaryValue.includes("):Ot=t[25];let kt=Ot,At;t[26]"),
    primaryValue.includes("Nt=Mt==null?[]:[Mt]"),
    primaryValue.includes("):Rt=t[45];let zt=Rt,Bt;t[46]"),
    primaryValue.includes("hasUnreadTurn:!Tt&&$e===!0")
  ];
}

function patch7942(appValue, primaryValue, workspaceRoot) {
  let helper = String.raw`const MTKattentionRelativePath=".codex/task-attention-policy.json";let MTKattentionPromiseKey=null,MTKattentionPromise=null,MTKattentionPolicy=null;var MTKattentionPolicyAtom;const MTKattentionListeners=new Set;function MTKattentionPlainObject7942(e){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&Object.getPrototypeOf(e)===Object.prototype}function MTKattentionJoin7942(e,t){return e.replace(/[\\/]+$/,"" )+"/"+t}function MTKattentionMissing7942(e){return e instanceof Error&&("code"in e&&e.code==="ENOENT"||e.message.includes("No such file or directory")||e.message.includes("(os error 2)"))}function MTKattentionBase64Size7942(e){return Math.floor(e.length*3/4)-(e.endsWith("==")?2:+e.endsWith("="))}async function MTKfindAttentionFile7942(e,t){let n=MTKattentionJoin7942(t,".codex"),r=MTKattentionJoin7942(t,MTKattentionRelativePath);try{let i=await e.sendRequest("fs/getMetadata",{path:n});if(!i.isDirectory||i.isSymlink)throw Error("unsafe attention policy directory");let a=await e.sendRequest("fs/getMetadata",{path:r});if(!a.isFile||a.isSymlink)throw Error("unsafe attention policy file");let{dataBase64:o}=await e.sendRequest("fs/readFile",{path:r});if(MTKattentionBase64Size7942(o)>16384)throw Error("attention policy too large");return o}catch(e){if(MTKattentionMissing7942(e))return null;throw e}}function MTKparseAttentionPolicy7942(e){let t;try{t=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(e),e=>e.charCodeAt(0))))}catch{return null}if(!MTKattentionPlainObject7942(t)||Object.keys(t).length!==1||!Array.isArray(t.ignore)||t.ignore.length>64)return null;let n=[];for(let e of t.ignore){if(typeof e!=="string"||e.length===0||e.length>512)return null;try{n.push(new RegExp(e))}catch{return null}}return n}async function MTKloadAttentionPolicy7942(e,t){try{let n=await MTKfindAttentionFile7942(e,t);return n==null?null:MTKparseAttentionPolicy7942(n)}catch{return null}}function MTKattentionMatch7942(e,t,n){if(e==null)return!1;let r=typeof t==="string"?t:"",i=typeof n==="string"?n:"";return e.some(e=>e.test(r)||e.test(i))}function MTKattentionIgnored7942(e,t){return MTKattentionMatch7942(MTKattentionPolicy,e,t)}function MTKattentionIgnoredThread7942(e,t,n){let r=e(XU,t),i=$P(t);return r?.kind==="local"?MTKattentionMatch7942(n,r.conversation?.title??r.pendingWorktree?.label,i?.kind==="local"?i.threadId:null):r?.kind==="remote"?MTKattentionMatch7942(n,r.task.title,r.task.id):!1}function MTKinstallAttentionPolicy7942(e,t){MTKattentionPolicy=e,t.set(MTKattentionPolicyAtom,e);for(let e of MTKattentionListeners)e()}function MTKattentionSubscribe7942(e){return MTKattentionListeners.add(e),()=>MTKattentionListeners.delete(e)}async function MTKloadAttentionWhenReady7942(e,t){try{return e.get(Db)==null&&await e.when(({get:e})=>e(Db)!=null),await MTKloadAttentionPolicy7942(Eb(e,"local"),t)}catch{return null}}function MTKuseAttentionBootstrap7942(){let e=hb(Q),t=${JSON.stringify(workspaceRoot)};return Mks.useEffect(()=>{let n=!1;return MTKattentionPromiseKey!==t&&(MTKattentionPromiseKey=t,MTKattentionPromise=MTKloadAttentionWhenReady7942(e,t)),MTKattentionPromise.then(t=>{n||MTKinstallAttentionPolicy7942(t,e)}),()=>{n=!0}},[e]),globalThis.__MTKattentionIgnored=MTKattentionIgnored7942,globalThis.__MTKattentionSubscribe=MTKattentionSubscribe7942,null}`;
  helper = addFixedAttentionRuntimeReload(helper, "7942", "hb(Q)", "Mks", workspaceRoot, ",globalThis.__MTKattentionIgnored=MTKattentionIgnored7942,globalThis.__MTKattentionSubscribe=MTKattentionSubscribe7942");
  const roots = [
    "function Oks(){MTKusePaletteBootstrap();let e=(0,jks.c)(12),",
    "function Oks(){let e=(0,jks.c)(12),"
  ];
  const root = roots.find(contract => appValue.includes(contract));
  if (root == null) throw new Error("Upstream changed: build-7942 attention bootstrap owner is unrecognized");
  let appPatched = replaceOnce(appValue, root, helper + root.replace("function Oks(){", "function Oks(){MTKuseAttentionBootstrap7942();"), "build-7942 attention bootstrap");
  appPatched = replaceOnce(appPatched, "eqa,tqa=t((()=>{Z(),", "eqa,tqa=t((()=>{Z(),MTKattentionPolicyAtom=My(Q,null),", "build-7942 attention atom");
  appPatched = replaceOnce(
    appPatched,
    "s=t===`work`?_fr({cloudThreadsAllowed:i,localThreadsAllowed:_F(e(VO)),threadKeys:o}):o;return r+",
    "s=t===`work`?_fr({cloudThreadsAllowed:i,localThreadsAllowed:_F(e(VO)),threadKeys:o}):o,c=e(MTKattentionPolicyAtom);c!=null&&(s=s.filter(t=>!MTKattentionIgnoredThread7942(e,t,c)));return r+",
    "build-7942 Dock badge projection"
  );
  appPatched = replaceOnce(
    appPatched,
    "let a=RB(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=h(t.conversationId)",
    "let a=RB(e.getConversation(t.conversationId));if(MTKattentionIgnored7942(a,t.conversationId)){T.debug(`[desktop-notifications] suppressed task-attention-policy turn-complete`,{safe:{conversationId:t.conversationId},sensitive:{}});return}let{navigationPath:o,navigateToNotification:s}=h(t.conversationId)",
    "build-7942 native notification projection"
  );

  const primaryHelper = 'function MTKuseTaskAttention7942(e,t){let n=globalThis.__MTKattentionSubscribe??(()=>()=>{});return Rjn.useSyncExternalStore(n,()=>globalThis.__MTKattentionIgnored?.(e,t)===!0,()=>!1)}';
  let primaryPatched = replaceOnce(primaryValue, "function Fjn(e){let t=(0,Ljn.c)(151),", `${primaryHelper}function Fjn(e){let t=(0,Ljn.c)(151),`, "build-7942 task attention hook");
  primaryPatched = replaceOnce(primaryPatched, "ft=qw($Dn,{hostId:qe??`local`,threadId:n})??He?.title??null,pt=qw(gwe,n)??He?.threadSource", "ft=qw($Dn,{hostId:qe??`local`,threadId:n})??He?.title??null,MTKattentionIgnoredForTask=MTKuseTaskAttention7942(ft,n),pt=qw(gwe,n)??He?.threadSource", "build-7942 local title");
  primaryPatched = replaceOnce(primaryPatched, "):Ot=t[25];let kt=Ot,At;t[26]", "):Ot=t[25];let kt=MTKattentionIgnoredForTask?{...Ot,unread:!1,unreadCount:0}:Ot,At;t[26]", "build-7942 status projection");
  primaryPatched = replaceOnce(primaryPatched, "Nt=Mt==null?[]:[Mt]", "Nt=MTKattentionIgnoredForTask?[]:Mt==null?[]:[Mt]", "build-7942 approval projection");
  primaryPatched = replaceOnce(primaryPatched, "):Rt=t[45];let zt=Rt,Bt;t[46]", "):Rt=t[45];let zt=MTKattentionIgnoredForTask?void 0:Rt,Bt;t[46]", "build-7942 waiting projection");
  primaryPatched = replaceOnce(primaryPatched, "hasUnreadTurn:!Tt&&$e===!0", "hasUnreadTurn:!MTKattentionIgnoredForTask&&!Tt&&$e===!0", "build-7942 hover-card unread projection");
  return { appSource: appPatched, primarySource: primaryPatched };
}

function patchSource(value) {
  const candidates = profiles().filter(profile => profile.contracts.every(contract => value.includes(contract)));
  if (candidates.length !== 1) throw new Error(`Upstream changed: found ${candidates.length} task attention ownership profiles`);
  const profile = candidates[0];
  let helper = String.raw`const MTKattentionRelativePath=".codex/task-attention-policy.json";let MTKattentionPromiseKey=null,MTKattentionPromise=null,MTKattentionPolicy=null;var MTKattentionPolicyAtom;const MTKattentionListeners=new Set;function MTKattentionPlainObject(e){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&Object.getPrototypeOf(e)===Object.prototype}function MTKattentionJoin(e,t){return e.replace(/[\\/]+$/,"" )+"/"+t}function MTKattentionMissing(e){return e instanceof Error&&("code"in e&&e.code==="ENOENT"||e.message.includes("No such file or directory")||e.message.includes("(os error 2)"))}function MTKattentionBase64Size(e){return Math.floor(e.length*3/4)-(e.endsWith("==")?2:+e.endsWith("="))}function MTKattentionKey(e){return e.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]).filter(e=>typeof e==="string").sort().join("\0")}async function MTKfindAttentionFile(e,t){let n=MTKattentionJoin(t,".codex"),r=MTKattentionJoin(t,MTKattentionRelativePath);try{let i=await e.sendRequest("fs/getMetadata",{path:n});if(!i.isDirectory||i.isSymlink)throw Error("unsafe attention policy directory");let a=await e.sendRequest("fs/getMetadata",{path:r});if(!a.isFile||a.isSymlink)throw Error("unsafe attention policy file");let{dataBase64:o}=await e.sendRequest("fs/readFile",{path:r});if(MTKattentionBase64Size(o)>16384)throw Error("attention policy too large");return o}catch(e){if(MTKattentionMissing(e))return null;throw e}}function MTKparseAttentionPolicy(e){let t;try{t=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(e),e=>e.charCodeAt(0))))}catch{return null}if(!MTKattentionPlainObject(t)||Object.keys(t).length!==1||!Array.isArray(t.ignore)||t.ignore.length>64)return null;let n=[];for(let e of t.ignore){if(typeof e!=="string"||e.length===0||e.length>512)return null;try{n.push(new RegExp(e))}catch{return null}}return n}async function MTKloadAttentionPolicy(e,t){try{let n=[...new Set(t.filter(e=>typeof e==="string"&&e.length>0))],r=[];for(let t of n){let n=await MTKfindAttentionFile(e,t);n!=null&&r.push(n)}return r.length===1?MTKparseAttentionPolicy(r[0]):null}catch{return null}}function MTKattentionMatch(e,t,n){if(e==null)return!1;let r=typeof t==="string"?t:"",i=typeof n==="string"?n:"";return e.some(e=>e.test(r)||e.test(i))}function MTKattentionIgnored(e,t){return MTKattentionMatch(MTKattentionPolicy,e,t)}function MTKattentionIgnoredThread(e,t,n){let r=e(Rx,t);return r?.kind==="local"?r.conversation!=null&&MTKattentionMatch(n,r.conversation.title,r.conversation.id):r?.kind==="remote"?MTKattentionMatch(n,r.task.title,r.task.id):!1}function MTKinstallAttentionPolicy(e,t){MTKattentionPolicy=e,t.set(MTKattentionPolicyAtom,e);for(let e of MTKattentionListeners)e()}function MTKattentionSubscribe(e){return MTKattentionListeners.add(e),()=>MTKattentionListeners.delete(e)}function MTKuseTaskAttention(e,t){return YEl.useSyncExternalStore(MTKattentionSubscribe,()=>MTKattentionIgnored(e,t),()=>!1)}async function MTKloadAttentionWhenReady(e,t){try{return e.get(Hg)==null&&await e.when(({get:e})=>e(Hg)!=null),await MTKloadAttentionPolicy(Vg(e,"local"),t)}catch{return null}}function MTKuseAttentionBootstrap(){let e=_s(Q),t=Y(Ysn),n=MTKattentionKey(t);return Kjl.useEffect(()=>{let r=!1;if(n.length===0)return MTKinstallAttentionPolicy(null,e),()=>{r=!0};let i=t.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]);return MTKattentionPromiseKey!==n&&(MTKattentionPromiseKey=n,MTKattentionPromise=MTKloadAttentionWhenReady(e,i)),MTKattentionPromise.then(t=>{r||MTKinstallAttentionPolicy(t,e)}),()=>{r=!0}},[e,n]),null}`;
  helper = addDynamicAttentionRuntimeReload(helper);
  for (const [before, after] of profile.helperReplacements) helper = replaceOnce(helper, before, after, `${profile.name} helper alias ${before}`);

  const rootSeam = profile.rootSeams.find(seam => value.includes(seam));
  if (rootSeam == null) throw new Error("Upstream changed: app bootstrap owner is unrecognized");
  const patchedRoot = rootSeam.replace(profile.rootPrefix, `${profile.rootPrefix}MTKuseAttentionBootstrap();`);
  let patched = replaceOnce(value, rootSeam, helper + patchedRoot, "attention bootstrap seam");
  patched = replaceOnce(
    patched,
    profile.atomBefore,
    profile.atomAfter,
    "global unread policy atom ownership"
  );
  if (profile.bootstrapDependencyBefore != null) {
    patched = replaceOnce(
      patched,
      profile.bootstrapDependencyBefore,
      profile.bootstrapDependencyAfter,
      "policy atom bootstrap dependency"
    );
  }
  patched = replaceOnce(
    patched,
    profile.titleBefore,
    profile.titleAfter,
    "local task title ownership"
  );
  patched = replaceOnce(
    patched,
    profile.badgeBefore,
    profile.badgeAfter,
    "global unread task count ownership"
  );
  patched = replaceOnce(
    patched,
    "t[27]=$e,t[28]=Dt):Dt=t[28];let Ot=Dt,kt;t[29]",
    "t[27]=$e,t[28]=Dt):Dt=t[28];let Ot=MTKattentionIgnoredForTask?{...Dt,unread:!1,unreadCount:0}:Dt,kt;t[29]",
    "task status attention projection"
  );
  patched = replaceOnce(
    patched,
    "Mt=jt==null?[]:[jt]",
    "Mt=MTKattentionIgnoredForTask?[]:jt==null?[]:[jt]",
    "approval attention projection"
  );
  patched = replaceOnce(
    patched,
    "let Rt=Lt,zt;",
    "let Rt=MTKattentionIgnoredForTask?void 0:Lt,zt;",
    "waiting pill projection"
  );
  patched = replaceOnce(
    patched,
    "hasUnreadTurn:!Ct&&Qe===!0",
    "hasUnreadTurn:!MTKattentionIgnoredForTask&&!Ct&&Qe===!0",
    "hover-card unread projection"
  );
  patched = replaceOnce(
    patched,
    profile.notificationBefore,
    profile.notificationAfter,
    "turn-complete notification source policy"
  );
  return patched;
}

function addDynamicAttentionRuntimeReload(source) {
  const before = 'function MTKuseAttentionBootstrap(){let e=_s(Q),t=Y(Ysn),n=MTKattentionKey(t);return Kjl.useEffect(()=>{let r=!1;if(n.length===0)return MTKinstallAttentionPolicy(null,e),()=>{r=!0};let i=t.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]);return MTKattentionPromiseKey!==n&&(MTKattentionPromiseKey=n,MTKattentionPromise=MTKloadAttentionWhenReady(e,i)),MTKattentionPromise.then(t=>{r||MTKinstallAttentionPolicy(t,e)}),()=>{r=!0}},[e,n]),null}';
  const after = 'async function MTKacceptAttentionReload(e,t,n,r){let i=await MTKloadAttentionWhenReady(e,t);return r()&&(i!=null||n?.initial===!0)?(MTKinstallAttentionPolicy(i,e),i!=null):!1}function MTKuseAttentionBootstrap(){let e=_s(Q),t=Y(Ysn),n=MTKattentionKey(t);return Kjl.useEffect(()=>{let r=!1;if(n.length===0)return MTKinstallAttentionPolicy(null,e),()=>{r=!0};let i=t.filter(e=>e.projectKind==="local").flatMap(e=>e.rootPaths??[]),a=globalThis.__MTK_RUNTIME_JSON_RELOAD__?.register("task-attention-policy.json",t=>MTKacceptAttentionReload(e,i,t,()=>!r));if(typeof a==="function")return()=>{r=!0,a()};return MTKattentionPromiseKey!==n&&(MTKattentionPromiseKey=n,MTKattentionPromise=MTKloadAttentionWhenReady(e,i)),MTKattentionPromise.then(t=>{r||MTKinstallAttentionPolicy(t,e)}),()=>{r=!0}},[e,n]),null}';
  return replaceOnce(source, before, after, "attention runtime reload callback");
}

function addFixedAttentionRuntimeReload(source, suffix, stateExpression, hookOwner, workspaceRoot, bridge) {
  const rootExpression = JSON.stringify(workspaceRoot);
  const before = `function MTKuseAttentionBootstrap${suffix}(){let e=${stateExpression},t=${rootExpression};return ${hookOwner}.useEffect(()=>{let n=!1;return MTKattentionPromiseKey!==t&&(MTKattentionPromiseKey=t,MTKattentionPromise=MTKloadAttentionWhenReady${suffix}(e,t)),MTKattentionPromise.then(t=>{n||MTKinstallAttentionPolicy${suffix}(t,e)}),()=>{n=!0}},[e])${bridge},null}`;
  const after = `async function MTKacceptAttentionReload${suffix}(e,t,n,r){let i=await MTKloadAttentionWhenReady${suffix}(e,t);return r()&&(i!=null||n?.initial===!0)?(MTKinstallAttentionPolicy${suffix}(i,e),i!=null):!1}function MTKuseAttentionBootstrap${suffix}(){let e=${stateExpression},t=${rootExpression};return ${hookOwner}.useEffect(()=>{let n=!1,r=globalThis.__MTK_RUNTIME_JSON_RELOAD__?.register("task-attention-policy.json",r=>MTKacceptAttentionReload${suffix}(e,t,r,()=>!n));if(typeof r==="function")return()=>{n=!0,r()};return MTKattentionPromiseKey!==t&&(MTKattentionPromiseKey=t,MTKattentionPromise=MTKloadAttentionWhenReady${suffix}(e,t)),MTKattentionPromise.then(t=>{n||MTKinstallAttentionPolicy${suffix}(t,e)}),()=>{n=!0}},[e])${bridge},null}`;
  return replaceOnce(source, before, after, `build-${suffix} attention runtime reload callback`);
}

function current7746Contracts(appValue, primaryValue) {
  return [
    ["function qOs(){MTKusePaletteBootstrap();let e=(0,XOs.c)(12),", "function qOs(){let e=(0,XOs.c)(12),"].some(contract => appValue.includes(contract)),
    appValue.includes("function Wms(e,t){T.info(`[desktop-notifications] service starting`)"),
    appValue.includes("let a=BB(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=h(t.conversationId)"),
    appValue.includes("wDi=[],TDi=CD(Q,`inbox-items`") && appValue.includes("EDi=Ny(Q,({get:e})=>"),
    appValue.includes("s=t===`work`?pfr({cloudThreadsAllowed:i,localThreadsAllowed:vF(e(WO)),threadKeys:o}):o;return r+"),
    primaryValue.includes("function pkn(e){let t=(0,hkn.c)(139),"),
    primaryValue.includes("dt=Rl(SOn,{hostId:Ke??`local`,threadId:n})??Ve?.title??null,ft=Rl(Wme,n)??Ve?.threadSource"),
    primaryValue.includes("let Ot=Dt,kt;"),
    primaryValue.includes("Mt=jt==null?[]:[jt]"),
    primaryValue.includes("let Rt=Lt,zt;"),
    primaryValue.includes("hasUnreadTurn:!wt&&Qe===!0")
  ];
}

function patch7746(appValue, primaryValue, workspaceRoot) {
  let helper = String.raw`const MTKattentionRelativePath=".codex/task-attention-policy.json";let MTKattentionPromiseKey=null,MTKattentionPromise=null,MTKattentionPolicy=null;var MTKattentionPolicyAtom;const MTKattentionListeners=new Set;function MTKattentionPlainObject7746(e){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&Object.getPrototypeOf(e)===Object.prototype}function MTKattentionJoin7746(e,t){return e.replace(/[\\/]+$/,"" )+"/"+t}function MTKattentionMissing7746(e){return e instanceof Error&&("code"in e&&e.code==="ENOENT"||e.message.includes("No such file or directory")||e.message.includes("(os error 2)"))}function MTKattentionBase64Size7746(e){return Math.floor(e.length*3/4)-(e.endsWith("==")?2:+e.endsWith("="))}async function MTKfindAttentionFile7746(e,t){let n=MTKattentionJoin7746(t,".codex"),r=MTKattentionJoin7746(t,MTKattentionRelativePath);try{let i=await e.sendRequest("fs/getMetadata",{path:n});if(!i.isDirectory||i.isSymlink)throw Error("unsafe attention policy directory");let a=await e.sendRequest("fs/getMetadata",{path:r});if(!a.isFile||a.isSymlink)throw Error("unsafe attention policy file");let{dataBase64:o}=await e.sendRequest("fs/readFile",{path:r});if(MTKattentionBase64Size7746(o)>16384)throw Error("attention policy too large");return o}catch(e){if(MTKattentionMissing7746(e))return null;throw e}}function MTKparseAttentionPolicy7746(e){let t;try{t=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(e),e=>e.charCodeAt(0))))}catch{return null}if(!MTKattentionPlainObject7746(t)||Object.keys(t).length!==1||!Array.isArray(t.ignore)||t.ignore.length>64)return null;let n=[];for(let e of t.ignore){if(typeof e!=="string"||e.length===0||e.length>512)return null;try{n.push(new RegExp(e))}catch{return null}}return n}async function MTKloadAttentionPolicy7746(e,t){try{let n=await MTKfindAttentionFile7746(e,t);return n==null?null:MTKparseAttentionPolicy7746(n)}catch{return null}}function MTKattentionMatch7746(e,t,n){if(e==null)return!1;let r=typeof t==="string"?t:"",i=typeof n==="string"?n:"";return e.some(e=>e.test(r)||e.test(i))}function MTKattentionIgnored7746(e,t){return MTKattentionMatch7746(MTKattentionPolicy,e,t)}function MTKattentionIgnoredThread7746(e,t,n){let r=e(aW,t);return r?.kind==="local"?MTKattentionMatch7746(n,r.catalogTitle??r.summary?.title,r.conversationId):r?.kind==="remote"?MTKattentionMatch7746(n,r.task.title,r.task.id):!1}function MTKinstallAttentionPolicy7746(e,t){MTKattentionPolicy=e,t.set(MTKattentionPolicyAtom,e);for(let e of MTKattentionListeners)e()}function MTKattentionSubscribe7746(e){return MTKattentionListeners.add(e),()=>MTKattentionListeners.delete(e)}async function MTKloadAttentionWhenReady7746(e,t){try{return e.get(Tb)==null&&await e.when(({get:e})=>e(Tb)!=null),await MTKloadAttentionPolicy7746(wb(e,"local"),t)}catch{return null}}function MTKuseAttentionBootstrap7746(){let e=pb(Q),t=${JSON.stringify(workspaceRoot)};return ZOs.useEffect(()=>{let n=!1;return MTKattentionPromiseKey!==t&&(MTKattentionPromiseKey=t,MTKattentionPromise=MTKloadAttentionWhenReady7746(e,t)),MTKattentionPromise.then(t=>{n||MTKinstallAttentionPolicy7746(t,e)}),()=>{n=!0}},[e]),globalThis.__MTKattentionIgnored=MTKattentionIgnored7746,globalThis.__MTKattentionSubscribe=MTKattentionSubscribe7746,null}`;
  helper = addFixedAttentionRuntimeReload(helper, "7746", "pb(Q)", "ZOs", workspaceRoot, ",globalThis.__MTKattentionIgnored=MTKattentionIgnored7746,globalThis.__MTKattentionSubscribe=MTKattentionSubscribe7746");
  const roots = [
    "function qOs(){MTKusePaletteBootstrap();let e=(0,XOs.c)(12),",
    "function qOs(){let e=(0,XOs.c)(12),"
  ];
  const root = roots.find(contract => appValue.includes(contract));
  if (root == null) throw new Error("Upstream changed: build-7746 attention bootstrap owner is unrecognized");
  let appPatched = replaceOnce(appValue, root, helper + root.replace("function qOs(){", "function qOs(){MTKuseAttentionBootstrap7746();"), "build-7746 attention bootstrap");
  appPatched = replaceOnce(appPatched, "wDi=[],TDi=CD(Q,`inbox-items`", "wDi=[],MTKattentionPolicyAtom=ky(Q,null),TDi=CD(Q,`inbox-items`", "build-7746 attention atom");
  appPatched = replaceOnce(
    appPatched,
    "s=t===`work`?pfr({cloudThreadsAllowed:i,localThreadsAllowed:vF(e(WO)),threadKeys:o}):o;return r+",
    "s=t===`work`?pfr({cloudThreadsAllowed:i,localThreadsAllowed:vF(e(WO)),threadKeys:o}):o,c=e(MTKattentionPolicyAtom);c!=null&&(s=s.filter(t=>!MTKattentionIgnoredThread7746(e,t,c)));return r+",
    "build-7746 Dock badge projection"
  );
  appPatched = replaceOnce(
    appPatched,
    "let a=BB(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=h(t.conversationId)",
    "let a=BB(e.getConversation(t.conversationId));if(MTKattentionIgnored7746(a,t.conversationId)){T.debug(`[desktop-notifications] suppressed task-attention-policy turn-complete`,{safe:{conversationId:t.conversationId},sensitive:{}});return}let{navigationPath:o,navigateToNotification:s}=h(t.conversationId)",
    "build-7746 native notification projection"
  );

  const primaryHelper = 'function MTKuseTaskAttention7746(e,t){let n=globalThis.__MTKattentionSubscribe??(()=>()=>{});return D4.useSyncExternalStore(n,()=>globalThis.__MTKattentionIgnored?.(e,t)===!0,()=>!1)}';
  let primaryPatched = replaceOnce(primaryValue, "function pkn(e){let t=(0,hkn.c)(139),", `${primaryHelper}function pkn(e){let t=(0,hkn.c)(139),`, "build-7746 task attention hook");
  primaryPatched = replaceOnce(primaryPatched, "dt=Rl(SOn,{hostId:Ke??`local`,threadId:n})??Ve?.title??null,ft=Rl(Wme,n)??Ve?.threadSource", "dt=Rl(SOn,{hostId:Ke??`local`,threadId:n})??Ve?.title??null,MTKattentionIgnoredForTask=MTKuseTaskAttention7746(dt,n),ft=Rl(Wme,n)??Ve?.threadSource", "build-7746 local title");
  primaryPatched = replaceOnce(primaryPatched, "):Dt=t[25];let Ot=Dt,kt;t[26]", "):Dt=t[25];let Ot=MTKattentionIgnoredForTask?{...Dt,unread:!1,unreadCount:0}:Dt,kt;t[26]", "build-7746 status projection");
  primaryPatched = replaceOnce(primaryPatched, "Mt=jt==null?[]:[jt]", "Mt=MTKattentionIgnoredForTask?[]:jt==null?[]:[jt]", "build-7746 approval projection");
  primaryPatched = replaceOnce(primaryPatched, "):Lt=t[45];let Rt=Lt,zt;t[46]", "):Lt=t[45];let Rt=MTKattentionIgnoredForTask?void 0:Lt,zt;t[46]", "build-7746 waiting projection");
  primaryPatched = replaceOnce(primaryPatched, "hasUnreadTurn:!wt&&Qe===!0", "hasUnreadTurn:!MTKattentionIgnoredForTask&&!wt&&Qe===!0", "build-7746 hover-card unread projection");
  return { appSource: appPatched, primarySource: primaryPatched };
}

function current7345Contracts() {
  return [
    "function g$c(e){",
    "function tIc(e){let t=(0,rIc.c)(142),",
    "dt=k_(J_r,n)??Ve?.title??null,ft=k_(OH,n)??Ve?.threadSource",
    "let kt=Ot,At;t[29]",
    "Nt=Mt==null?[]:[Mt]",
    "let zt=Rt,Bt;",
    "hasUnreadTurn:!wt&&Qe===!0",
    "function dvl(e,t){F.info(`[desktop-notifications] service starting`)",
    "let a=q3n(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=m(t.conversationId)",
    "$ua,eda=t((()=>{Q(),",
    "s=t===`work`?FVn({cloudThreadsAllowed:i,localThreadsAllowed:Qk(e(DS)),threadKeys:o}):o;return r+"
  ];
}

function patch7345(value, workspaceRoot) {
  let helper = String.raw`const MTKattentionRelativePath=".codex/task-attention-policy.json";let MTKattentionPromiseKey=null,MTKattentionPromise=null,MTKattentionPolicy=null;var MTKattentionPolicyAtom;const MTKattentionListeners=new Set;function MTKattentionPlainObject7345(e){return e!=null&&typeof e==="object"&&!Array.isArray(e)&&Object.getPrototypeOf(e)===Object.prototype}function MTKattentionJoin7345(e,t){return e.replace(/[\\/]+$/,"" )+"/"+t}function MTKattentionMissing7345(e){return e instanceof Error&&("code"in e&&e.code==="ENOENT"||e.message.includes("No such file or directory")||e.message.includes("(os error 2)"))}function MTKattentionBase64Size7345(e){return Math.floor(e.length*3/4)-(e.endsWith("==")?2:+e.endsWith("="))}async function MTKfindAttentionFile7345(e,t){let n=MTKattentionJoin7345(t,".codex"),r=MTKattentionJoin7345(t,MTKattentionRelativePath);try{let i=await e.sendRequest("fs/getMetadata",{path:n});if(!i.isDirectory||i.isSymlink)throw Error("unsafe attention policy directory");let a=await e.sendRequest("fs/getMetadata",{path:r});if(!a.isFile||a.isSymlink)throw Error("unsafe attention policy file");let{dataBase64:o}=await e.sendRequest("fs/readFile",{path:r});if(MTKattentionBase64Size7345(o)>16384)throw Error("attention policy too large");return o}catch(e){if(MTKattentionMissing7345(e))return null;throw e}}function MTKparseAttentionPolicy7345(e){let t;try{t=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(e),e=>e.charCodeAt(0))))}catch{return null}if(!MTKattentionPlainObject7345(t)||Object.keys(t).length!==1||!Array.isArray(t.ignore)||t.ignore.length>64)return null;let n=[];for(let e of t.ignore){if(typeof e!=="string"||e.length===0||e.length>512)return null;try{n.push(new RegExp(e))}catch{return null}}return n}async function MTKloadAttentionPolicy7345(e,t){try{let n=await MTKfindAttentionFile7345(e,t);return n==null?null:MTKparseAttentionPolicy7345(n)}catch{return null}}function MTKattentionMatch7345(e,t,n){if(e==null)return!1;let r=typeof t==="string"?t:"",i=typeof n==="string"?n:"";return e.some(e=>e.test(r)||e.test(i))}function MTKattentionIgnored7345(e,t){return MTKattentionMatch7345(MTKattentionPolicy,e,t)}function MTKattentionIgnoredThread7345(e,t,n){let r=e(VN,t);if(r?.kind==="local"){let t=r.conversationId,i=t==null?null:e(AH,{hostId:r.hostId??r.summary?.hostId??"local",threadId:t})??r.catalogTitle??r.summary?.title;return MTKattentionMatch7345(n,i,t)}return r?.kind==="remote"?MTKattentionMatch7345(n,r.task.title,r.task.id):!1}function MTKinstallAttentionPolicy7345(e,t){MTKattentionPolicy=e,t.set(MTKattentionPolicyAtom,e);for(let e of MTKattentionListeners)e()}function MTKattentionSubscribe7345(e){return MTKattentionListeners.add(e),()=>MTKattentionListeners.delete(e)}function MTKuseTaskAttention7345(e,t){return x$c.useSyncExternalStore(MTKattentionSubscribe7345,()=>MTKattentionIgnored7345(e,t),()=>!1)}async function MTKloadAttentionWhenReady7345(e,t){try{return e.get(Fb)==null&&await e.when(({get:e})=>e(Fb)!=null),await MTKloadAttentionPolicy7345(Pb(e,"local"),t)}catch{return null}}function MTKuseAttentionBootstrap7345(){let e=A_($),t=${JSON.stringify(workspaceRoot)};return x$c.useEffect(()=>{let n=!1;return MTKattentionPromiseKey!==t&&(MTKattentionPromiseKey=t,MTKattentionPromise=MTKloadAttentionWhenReady7345(e,t)),MTKattentionPromise.then(t=>{n||MTKinstallAttentionPolicy7345(t,e)}),()=>{n=!0}},[e]),null}`;
  helper = addFixedAttentionRuntimeReload(helper, "7345", "A_($)", "x$c", workspaceRoot, "");
  const roots = [
    "function g$c(e){MTKusePaletteBootstrap();let t=(0,b$c.c)(115),",
    "function g$c(e){MTKusePaletteBootstrap();let t=(0,b$c.c)(114),",
    "function g$c(e){let t=(0,b$c.c)(115),",
    "function g$c(e){let t=(0,b$c.c)(114),"
  ];
  const root = roots.find(root => value.includes(root));
  if (root == null) throw new Error("Upstream changed: build-7345 attention bootstrap owner is unrecognized");
  let patched = replaceOnce(value, root, helper + root.replace("function g$c(e){", "function g$c(e){MTKuseAttentionBootstrap7345();"), "build-7345 attention bootstrap");
  patched = replaceOnce(patched, "$ua,eda=t((()=>{Q(),", "$ua,eda=t((()=>{Q(),MTKattentionPolicyAtom=Qg($,null),", "build-7345 attention atom");
  patched = replaceOnce(patched, "dt=k_(J_r,n)??Ve?.title??null,ft=k_(OH,n)??Ve?.threadSource", "dt=k_(J_r,n)??Ve?.title??null,MTKattentionIgnoredForTask=MTKuseTaskAttention7345(dt,n),ft=k_(OH,n)??Ve?.threadSource", "build-7345 local title");
  patched = replaceOnce(patched, "let kt=Ot,At;t[29]", "let kt=MTKattentionIgnoredForTask?{...Ot,unread:!1,unreadCount:0}:Ot,At;t[29]", "build-7345 status projection");
  patched = replaceOnce(patched, "Nt=Mt==null?[]:[Mt]", "Nt=MTKattentionIgnoredForTask?[]:Mt==null?[]:[Mt]", "build-7345 approval projection");
  patched = replaceOnce(patched, "let zt=Rt,Bt;", "let zt=MTKattentionIgnoredForTask?void 0:Rt,Bt;", "build-7345 waiting projection");
  patched = replaceOnce(patched, "hasUnreadTurn:!wt&&Qe===!0", "hasUnreadTurn:!MTKattentionIgnoredForTask&&!wt&&Qe===!0", "build-7345 hover-card projection");
  patched = replaceOnce(patched, "s=t===`work`?FVn({cloudThreadsAllowed:i,localThreadsAllowed:Qk(e(DS)),threadKeys:o}):o;return r+", "s=t===`work`?FVn({cloudThreadsAllowed:i,localThreadsAllowed:Qk(e(DS)),threadKeys:o}):o,c=e(MTKattentionPolicyAtom);c!=null&&(s=s.filter(t=>!MTKattentionIgnoredThread7345(e,t,c)));return r+", "build-7345 Dock badge projection");
  patched = replaceOnce(patched, "let a=q3n(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=m(t.conversationId)", "let a=q3n(e.getConversation(t.conversationId));if(MTKattentionIgnored7345(a,t.conversationId)){F.debug(`[desktop-notifications] suppressed task-attention-policy turn-complete`,{safe:{conversationId:t.conversationId},sensitive:{}});return}let{navigationPath:o,navigateToNotification:s}=m(t.conversationId)", "build-7345 native notification projection");
  return patched;
}

function profiles() {
  const rowContracts = ["let Ot=Dt,kt;", "Mt=jt==null?[]:[jt]", "let Rt=Lt,zt;", "hasUnreadTurn:!Ct&&Qe===!0"];
  return [
    {
      name: "26.818.21641-6849",
      rootPrefix: "function Fjl(e){",
      rootSeams: ["function Fjl(e){MTKusePaletteBootstrap();let t=(0,Gjl.c)(9),", "function Fjl(e){let t=(0,Gjl.c)(9),"],
      titleBefore: "ut=hs(F7t,n)??Ve?.title??null,dt=hs(bk,n)??Ve?.threadSource",
      titleAfter: "ut=hs(F7t,n)??Ve?.title??null,MTKattentionIgnoredForTask=MTKuseTaskAttention(ut,n),dt=hs(bk,n)??Ve?.threadSource",
      notificationBefore: "let a=sx(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=m(t.conversationId)",
      notificationAfter: "let a=sx(e.getConversation(t.conversationId));if(MTKattentionIgnored(a,t.conversationId)){Np.debug(`[desktop-notifications] suppressed task-attention-policy turn-complete`,{safe:{conversationId:t.conversationId},sensitive:{}});return}let{navigationPath:o,navigateToNotification:s}=m(t.conversationId)",
      atomBefore: "zv(),bS(),s2a=Za(Q,({get:e})=>",
      atomAfter: "zv(),bS(),MTKattentionPolicyAtom=Ga(Q,null),s2a=Za(Q,({get:e})=>",
      badgeBefore: "s=t===`work`?_Xt({cloudThreadsAllowed:i,localThreadsAllowed:Gy(e(tv)),threadKeys:o}):o;return r+",
      badgeAfter: "s=t===`work`?_Xt({cloudThreadsAllowed:i,localThreadsAllowed:Gy(e(tv)),threadKeys:o}):o,c=e(MTKattentionPolicyAtom);c!=null&&(s=s.filter(t=>!MTKattentionIgnoredThread(e,t,c)));return r+",
      helperReplacements: [],
      contracts: ["function Fjl(e){", "function KEl(e){let t=(0,JEl.c)(142),", "ut=hs(F7t,n)??Ve?.title??null,dt=hs(bk,n)??Ve?.threadSource", "function wuu(e,t){Np.info(`[desktop-notifications] service starting`)", "let a=sx(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=m(t.conversationId)", "zv(),bS(),s2a=Za(Q,({get:e})=>", "s=t===`work`?_Xt({cloudThreadsAllowed:i,localThreadsAllowed:Gy(e(tv)),threadKeys:o}):o;return r+", ...rowContracts]
    },
    {
      name: "26.818.31338-6892",
      rootPrefix: "function zMl(e){",
      rootSeams: ["function zMl(e){MTKusePaletteBootstrap();let t=(0,YMl.c)(9),", "function zMl(e){let t=(0,YMl.c)(9),"],
      titleBefore: "ut=gs(I7t,n)??Ve?.title??null,dt=gs(hk,n)??Ve?.threadSource",
      titleAfter: "ut=gs(I7t,n)??Ve?.title??null,MTKattentionIgnoredForTask=MTKuseTaskAttention(ut,n),dt=gs(hk,n)??Ve?.threadSource",
      notificationBefore: "let a=ox(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=m(t.conversationId)",
      notificationAfter: "let a=ox(e.getConversation(t.conversationId));if(MTKattentionIgnored(a,t.conversationId)){Np.debug(`[desktop-notifications] suppressed task-attention-policy turn-complete`,{safe:{conversationId:t.conversationId},sensitive:{}});return}let{navigationPath:o,navigateToNotification:s}=m(t.conversationId)",
      atomBefore: "Ux(),Pv(),yS(),g2a=Za(Q,({get:e})=>",
      atomAfter: "Ux(),Pv(),yS(),MTKattentionPolicyAtom=Ga(Q,null),g2a=Za(Q,({get:e})=>",
      badgeBefore: "s=t===`work`?vXt({cloudThreadsAllowed:i,localThreadsAllowed:Wy(e(X_)),threadKeys:o}):o;return r+",
      badgeAfter: "s=t===`work`?vXt({cloudThreadsAllowed:i,localThreadsAllowed:Wy(e(X_)),threadKeys:o}):o,c=e(MTKattentionPolicyAtom);c!=null&&(s=s.filter(t=>!MTKattentionIgnoredThread(e,t,c)));return r+",
      helperReplacements: [["YEl.useSyncExternalStore", "$Dl.useSyncExternalStore"], ["_s(Q)", "vs(Q)"], ["Y(Ysn)", "Y(Xsn)"], ["Kjl.useEffect", "XMl.useEffect"], ["e.get(Hg)", "e.get(Rg)"], ["e(Hg)", "e(Rg)"], ['Vg(e,"local")', 'Lg(e,"local")'], ["e(Rx,t)", "e(Lx,t)"]],
      contracts: ["function zMl(e){", "function XDl(e){let t=(0,QDl.c)(142),", "ut=gs(I7t,n)??Ve?.title??null,dt=gs(hk,n)??Ve?.threadSource", "function Tdu(e,t){Np.info(`[desktop-notifications] service starting`)", "let a=ox(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=m(t.conversationId)", "Ux(),Pv(),yS(),g2a=Za(Q,({get:e})=>", "s=t===`work`?vXt({cloudThreadsAllowed:i,localThreadsAllowed:Wy(e(X_)),threadKeys:o}):o;return r+", ...rowContracts]
    },
    {
      name: "26.818.41509-6962",
      rootPrefix: "function hYl(e){",
      rootSeams: ["function hYl(e){MTKusePaletteBootstrap();let t=(0,vYl.c)(94),", "function hYl(e){MTKusePaletteBootstrap();let t=(0,vYl.c)(93),", "function hYl(e){let t=(0,vYl.c)(93),"],
      titleBefore: "ut=_s(V7t,n)??Ve?.title??null,dt=_s(Sk,n)??Ve?.threadSource",
      titleAfter: "ut=_s(V7t,n)??Ve?.title??null,MTKattentionIgnoredForTask=MTKuseTaskAttention(ut,n),dt=_s(Sk,n)??Ve?.threadSource",
      notificationBefore: "let a=ax(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=m(t.conversationId)",
      notificationAfter: "let a=ax(e.getConversation(t.conversationId));if(MTKattentionIgnored(a,t.conversationId)){Np.debug(`[desktop-notifications] suppressed task-attention-policy turn-complete`,{safe:{conversationId:t.conversationId},sensitive:{}});return}let{navigationPath:o,navigateToNotification:s}=m(t.conversationId)",
      atomBefore: "Ux(),Lv(),bS(),V4a=Za(Q,({get:e})=>",
      atomAfter: "Ux(),Lv(),bS(),MTKattentionPolicyAtom=Ga(Q,null),V4a=Za(Q,({get:e})=>",
      bootstrapDependencyBefore: "Bml(),SW(),oTl(),nwl()",
      bootstrapDependencyAfter: "Bml(),SW(),H4a(),oTl(),nwl()",
      badgeBefore: "s=t===`work`?CXt({cloudThreadsAllowed:i,localThreadsAllowed:Uy(e($_)),threadKeys:o}):o;return r+",
      badgeAfter: "s=t===`work`?CXt({cloudThreadsAllowed:i,localThreadsAllowed:Uy(e($_)),threadKeys:o}):o,c=e(MTKattentionPolicyAtom);c!=null&&(s=s.filter(t=>!MTKattentionIgnoredThread(e,t,c)));return r+",
      helperReplacements: [["YEl.useSyncExternalStore", "yYl.useSyncExternalStore"], ["_s(Q)", "ys(Q)"], ["Y(Ysn)", "Y(fS)"], ["Kjl.useEffect", "yYl.useEffect"], ["e.get(Hg)", "e.get(Bg)"], ["e(Hg)", "e(Bg)"], ['Vg(e,"local")', 'zg(e,"local")'], ['let r=e(Rx,t);return r?.kind==="local"?r.conversation!=null&&MTKattentionMatch(n,r.conversation.title,r.conversation.id):', 'let r=e(Lx,t);return r?.kind==="local"?r.conversationId!=null&&MTKattentionMatch(n,r.catalogTitle??r.summary?.title,r.conversationId):']],
      contracts: ["function hYl(e){", "function nkl(e){let t=(0,ikl.c)(142),", "ut=_s(V7t,n)??Ve?.title??null,dt=_s(Sk,n)??Ve?.threadSource", "function jfu(e,t){Np.info(`[desktop-notifications] service starting`)", "let a=ax(e.getConversation(t.conversationId)),{navigationPath:o,navigateToNotification:s}=m(t.conversationId)", "Ux(),Lv(),bS(),V4a=Za(Q,({get:e})=>", "s=t===`work`?CXt({cloudThreadsAllowed:i,localThreadsAllowed:Uy(e($_)),threadKeys:o}):o;return r+", ...rowContracts]
    }
  ];
}

function containingFunction(value, position) {
  let start = value.lastIndexOf("function ", position);
  while (start >= 0) {
    const body = extractFunction(value, start);
    if (position < body.end) return body.text;
    start = value.lastIndexOf("function ", start - 1);
  }
  throw new Error("Could not locate containing function");
}

function extractFunction(value, start) {
  const parameters = value.indexOf("(", start);
  let depth = 0;
  let bodyStart = -1;
  for (let i = parameters; i < value.length; i += 1) {
    if (value[i] === "(") depth += 1;
    else if (value[i] === ")" && --depth === 0) {
      bodyStart = value.indexOf("{", i + 1);
      break;
    }
  }
  if (bodyStart < 0) throw new Error("Function parameters did not terminate");
  let quote = null;
  let escaped = false;
  depth = 1;
  for (let i = bodyStart + 1; i < value.length; i += 1) {
    const char = value[i];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      return { end: i + 1, text: value.slice(start, i + 1) };
    }
  }
  throw new Error("Function did not terminate");
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

function readOption(name) {
  const index = process.argv.indexOf(name, 4);
  if (index < 0) return null;
  if (index !== process.argv.length - 2 || !process.argv[index + 1]) {
    throw new Error(`usage: ${name} must be followed by one value`);
  }
  return path.resolve(process.argv[index + 1]);
}

function configuredWorkspaceRoot() {
  if (configPath == null) throw new Error("task-attention-policy apply requires --config TOOLKIT_CONFIG");
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
