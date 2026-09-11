#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: reasoning-retention.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const turn = uniqueOwner(source =>
  source.includes("preventAutoCollapse:kt||yr") || source.includes("preventAutoCollapse:Ot||yr") || source.includes("preventAutoCollapse:Dt||br") || source.includes("preventAutoCollapse:At||xr") || source.includes("preventAutoCollapse:Ot||Sr") || source.includes("function MTKuseReasoningRetention("),
  "local reasoning-collapse owner"
);
const thread = uniqueOwner(source =>
  source.includes("Ue.current=G},[e,c,G,b,fe])") || source.includes("qe.current=G},[e,l,G,x,pe])") || source.includes("We.current=ue},[e,u,ue,x,pe])") || source.includes("Ke.current=ce},[e,l,ce,x,q])") || source.includes("function MTKuseReasoningThreadRetention("),
  "local thread auto-collapse owner"
);
const collapse = uniqueOwner(source =>
  source.includes("preventAutoCollapse:i,persistedCollapsed:a") &&
    source.includes("isCollapsed:!r&&(a??!i)"),
  "agent-activity collapse contract"
);

let state = inspectState();
if (command === "apply" && state === "needs-apply") {
  const palette = paletteOwner();
  ensurePaletteBridge(palette);
  patchTurn(turn.file);
  patchThread(thread.file);
  syntaxCheck(palette.file);
  syntaxCheck(turn.file);
  syntaxCheck(thread.file);
  state = inspectState();
  if (state !== "applied") throw new Error("reasoning retention transform did not verify");
}

const palette = paletteOwner(false);
process.stdout.write(`${JSON.stringify({
  state,
  policy: ".codex/task-visual-palette.json",
  targets: [palette?.file, turn.file, thread.file].filter(Boolean).map(file => path.relative(root, file))
}, null, 2)}\n`);

function inspectState() {
  const source = fs.readFileSync(turn.file, "utf8");
  const turnMarkers = [
    source.includes("function MTKuseReasoningRetention("),
    source.includes("MTKreasoningRetained=MTKuseReasoningRetention(a)") || source.includes("MTKreasoningRetained=MTKuseReasoningRetention(c)") || source.includes("MTKreasoningRetained=MTKuseReasoningRetention(s)") || source.includes("MTKreasoningRetained=MTKuseReasoningRetention(o)"),
    source.includes("preventAutoCollapse:kt||yr||MTKreasoningRetained") || source.includes("preventAutoCollapse:Ot||yr||MTKreasoningRetained") || source.includes("preventAutoCollapse:Dt||br||MTKreasoningRetained") || source.includes("preventAutoCollapse:At||xr||MTKreasoningRetained") || source.includes("preventAutoCollapse:Ot||Sr||MTKreasoningRetained")
  ];
  const threadSource = fs.readFileSync(thread.file, "utf8");
  const threadMarkers = [
    threadSource.includes("function MTKuseReasoningThreadRetention("),
    threadSource.includes("MTKreasoningThreadRetained=MTKuseReasoningThreadRetention(e)"),
    threadSource.includes("if(!MTKreasoningThreadRetained)for(let t of i)EE(b,{conversationId:e,turnSearchKey:t},!0)") || threadSource.includes("if(!MTKreasoningThreadRetained)for(let t of i)bD(x,{conversationId:e,turnSearchKey:t},!0)") || threadSource.includes("if(!MTKreasoningThreadRetained)for(let t of i)wk(x,{conversationId:e,turnSearchKey:t},!0)"),
    threadSource.includes("[e,c,G,b,fe,MTKreasoningThreadRetained]") || threadSource.includes("[e,l,G,x,pe,MTKreasoningThreadRetained]") || threadSource.includes("[e,u,ue,x,pe,MTKreasoningThreadRetained]") || threadSource.includes("[e,l,ce,x,q,MTKreasoningThreadRetained]")
  ];
  const turnApplied = turnMarkers.every(Boolean);
  const threadApplied = threadMarkers.every(Boolean);
  if (turnMarkers.some(Boolean) && !turnApplied) throw new Error("Unrecognized reasoning retention patch: partial turn markers");
  if (threadMarkers.some(Boolean) && !threadApplied) throw new Error("Unrecognized reasoning retention patch: partial thread markers");
  if (turnApplied) {
    const palette = paletteOwner();
    const paletteSource = fs.readFileSync(palette.file, "utf8");
    for (const marker of [
      "keepReasoningOpen:t.keepReasoningOpen===!0",
      "function MTKreasoningShouldStayOpen(",
      "globalThis.__MTKreasoningShouldStayOpen=MTKreasoningShouldStayOpen",
      "globalThis.__MTKreasoningSubscribe="
    ]) {
      if (!paletteSource.includes(marker)) throw new Error(`Unrecognized reasoning retention patch: missing ${marker}`);
    }
    verifyCollapseContract();
    return threadApplied ? "applied" : "needs-apply";
  }
  if (threadApplied) throw new Error("Unrecognized reasoning retention patch: thread guard without turn retention");
  const legacy = source.includes("I=Fe!==void 0&&Fe,ot=bt(le)") && source.includes("preventAutoCollapse:kt||yr");
  const current = source.includes("ut=Re!==void 0&&Re,dt=Je(Fe)") && source.includes("preventAutoCollapse:Ot||yr");
  const build8378 = source.includes("function _i(e){let t=(0,Hi.c)(208),") && source.includes("preventAutoCollapse:Dt||br");
  const build8576 = source.includes("function _i(e){let t=(0,Hi.c)(208),") && source.includes("preventAutoCollapse:At||xr");
  const build8690 = source.includes("function bi(e){let t=(0,Ki.c)(216),") && source.includes("preventAutoCollapse:Ot||Sr");
  if ((!source.includes("function _i(e){let t=(0,Vi.c)(207),") && !build8378 && !build8576 && !build8690) || (!legacy && !current && !build8378 && !build8576 && !build8690)) {
    throw new Error("Upstream changed: missing reasoning turn ownership contract");
  }
  const currentThread = threadSource.includes("function zk({conversationId:e,") &&
    (threadSource.includes("qe.current=G},[e,l,G,x,pe])") || threadSource.includes("We.current=ue},[e,u,ue,x,pe])"));
  const build8690Thread = threadSource.includes("function Uj({conversationId:e,") && threadSource.includes("Ke.current=ce},[e,l,ce,x,q])");
  if ((!threadSource.includes("function GO({conversationId:e,") || !threadSource.includes("Ue.current=G},[e,c,G,b,fe])")) && !currentThread && !build8690Thread) {
    throw new Error("Upstream changed: missing local thread auto-collapse contract");
  }
  verifyCollapseContract();
  return "needs-apply";
}

function verifyCollapseContract() {
  const source = fs.readFileSync(collapse.file, "utf8");
  for (const contract of ["preventAutoCollapse:i,persistedCollapsed:a", "isCollapsed:!r&&(a??!i)"]) {
    if (!source.includes(contract)) throw new Error(`Upstream changed: missing agent-activity contract ${contract}`);
  }
  if (!source.includes("onToggle:()=>{let e=!W;if(u==null){A(e);return}u(e)}") &&
      !source.includes("onToggle:()=>{let e=!G;if(u==null){j(e);return}u(e)}") &&
      !source.includes("onToggle:e=>{let t=!J;if(F.current=e,f==null){N(t);return}f(t)}") &&
      !source.includes("onToggle:e=>{let t=!Y;if(F.current=e,f==null){N(t);return}f(t)}") &&
      !source.includes("onToggle:e=>{let t=!J;if(P.current=e,d==null){M(t);return}d(t)}")) {
    throw new Error("Upstream changed: missing agent-activity toggle contract");
  }
}

function paletteOwner(required = true) {
  const owners = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (source.includes('MTKpaletteRelativePath=".codex/task-visual-palette.json"')) {
      owners.push({file, source});
    }
  }
  if (!required && owners.length === 0) return null;
  if (owners.length !== 1) throw new Error(`Reasoning retention requires exactly one task visual palette owner; found ${owners.length}`);
  return owners[0];
}

function ensurePaletteBridge(owner) {
  if (!owner.source.includes("function MTKreasoningShouldStayOpen(")) {
    throw new Error("Reasoning retention requires the current task-visual-palette patch first");
  }
}

function patchTurn(file) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("function MTKuseReasoningRetention(")) return;
  if (source.includes("function bi(e){let t=(0,Ki.c)(216),")) {
    const helper = "const MTKreasoningNoopSubscribe=()=>()=>{};function MTKuseReasoningRetention(e){let t=globalThis.__MTKreasoningSubscribe??MTKreasoningNoopSubscribe;return Ji.useSyncExternalStore(t,()=>globalThis.__MTKreasoningShouldStayOpen?.(e)===!0,()=>!1)}";
    source = replaceOnce(source, "function bi(e){let t=(0,Ki.c)(216),", `${helper}function bi(e){let t=(0,Ki.c)(216),`, "build-8690 reasoning turn hook");
    source = replaceOnce(source, "let z=Dt,Ot=D(er,z)", "let z=Dt,MTKreasoningRetained=MTKuseReasoningRetention(o),Ot=D(er,z)", "build-8690 reasoning task decision");
    source = replaceOnce(source, "preventAutoCollapse:Ot||Sr", "preventAutoCollapse:Ot||Sr||MTKreasoningRetained", "build-8690 reasoning auto-collapse gate");
    fs.writeFileSync(file, source);
    return;
  }
  if (source.includes("function _i(e){let t=(0,Hi.c)(208),")) {
    const helper = "const MTKreasoningNoopSubscribe=()=>()=>{};function MTKuseReasoningRetention(e){let t=globalThis.__MTKreasoningSubscribe??MTKreasoningNoopSubscribe;return Wi.useSyncExternalStore(t,()=>globalThis.__MTKreasoningShouldStayOpen?.(e)===!0,()=>!1)}";
    source = replaceOnce(source, "function _i(e){let t=(0,Hi.c)(208),", `${helper}function _i(e){let t=(0,Hi.c)(208),`, "build-8378 reasoning turn hook");
    if (source.includes("preventAutoCollapse:At||xr")) {
      source = replaceOnce(source, "let z=Dt,At=E(qn,z)", "let z=Dt,MTKreasoningRetained=MTKuseReasoningRetention(s),At=E(qn,z)", "build-8576 reasoning task decision");
      source = replaceOnce(source, "preventAutoCollapse:At||xr", "preventAutoCollapse:At||xr||MTKreasoningRetained", "build-8576 reasoning auto-collapse gate");
    } else {
      source = replaceOnce(source, "let V=Tt,Dt=R(Kn,V)", "let V=Tt,MTKreasoningRetained=MTKuseReasoningRetention(s),Dt=R(Kn,V)", "build-8378 reasoning task decision");
      source = replaceOnce(source, "preventAutoCollapse:Dt||br", "preventAutoCollapse:Dt||br||MTKreasoningRetained", "build-8378 reasoning auto-collapse gate");
    }
    fs.writeFileSync(file, source);
    return;
  }
  const helper = "const MTKreasoningNoopSubscribe=()=>()=>{};function MTKuseReasoningRetention(e){let t=globalThis.__MTKreasoningSubscribe??MTKreasoningNoopSubscribe;return Ui.useSyncExternalStore(t,()=>globalThis.__MTKreasoningShouldStayOpen?.(e)===!0,()=>!1)}";
  source = replaceOnce(source, "function _i(e){let t=(0,Vi.c)(207),", `${helper}function _i(e){let t=(0,Vi.c)(207),`, "reasoning turn hook");
  if (source.includes("ut=Re!==void 0&&Re,dt=Je(Fe)")) {
    source = replaceOnce(source, "ut=Re!==void 0&&Re,dt=Je(Fe)", "ut=Re!==void 0&&Re,MTKreasoningRetained=MTKuseReasoningRetention(c),dt=Je(Fe)", "reasoning task decision");
    source = replaceOnce(source, "preventAutoCollapse:Ot||yr", "preventAutoCollapse:Ot||yr||MTKreasoningRetained", "reasoning auto-collapse gate");
  } else {
    source = replaceOnce(source, "I=Fe!==void 0&&Fe,ot=bt(le)", "I=Fe!==void 0&&Fe,MTKreasoningRetained=MTKuseReasoningRetention(a),ot=bt(le)", "reasoning task decision");
    source = replaceOnce(source, "preventAutoCollapse:kt||yr", "preventAutoCollapse:kt||yr||MTKreasoningRetained", "reasoning auto-collapse gate");
  }
  fs.writeFileSync(file, source);
}

function patchThread(file) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("function MTKuseReasoningThreadRetention(")) return;
  if (source.includes("function Uj({conversationId:e,")) {
    const helper = "const MTKreasoningThreadNoopSubscribe=()=>()=>{};function MTKuseReasoningThreadRetention(e){let t=globalThis.__MTKreasoningSubscribe??MTKreasoningThreadNoopSubscribe;return qj.useSyncExternalStore(t,()=>globalThis.__MTKreasoningShouldStayOpen?.(e)===!0,()=>!1)}";
    source = replaceOnce(source, "function Uj({conversationId:e,", `${helper}function Uj({conversationId:e,`, "build-8690 reasoning thread hook");
    source = replaceOnce(source, "usesUnifiedTimeline:b}){let x=rc(zl)", "usesUnifiedTimeline:b}){let MTKreasoningThreadRetained=MTKuseReasoningThreadRetention(e),x=rc(zl)", "build-8690 reasoning thread decision");
    source = replaceOnce(
      source,
      "for(let t of i)wk(x,{conversationId:e,turnSearchKey:t},!0);Ke.current=ce},[e,l,ce,x,q])",
      "if(!MTKreasoningThreadRetained)for(let t of i)wk(x,{conversationId:e,turnSearchKey:t},!0);Ke.current=ce},[e,l,ce,x,q,MTKreasoningThreadRetained])",
      "build-8690 next-turn auto-collapse gate"
    );
    fs.writeFileSync(file, source);
    return;
  }
  if (source.includes("function zk({conversationId:e,")) {
    const helper = "const MTKreasoningThreadNoopSubscribe=()=>()=>{};function MTKuseReasoningThreadRetention(e){let t=globalThis.__MTKreasoningSubscribe??MTKreasoningThreadNoopSubscribe;return Uk.useSyncExternalStore(t,()=>globalThis.__MTKreasoningShouldStayOpen?.(e)===!0,()=>!1)}";
    source = replaceOnce(source, "function zk({conversationId:e,", `${helper}function zk({conversationId:e,`, "build-8378 reasoning thread hook");
    const threadDecision = source.includes("usesUnifiedTimeline:b}){let x=s(ps)") ? [
      "usesUnifiedTimeline:b}){let x=s(ps)",
      "usesUnifiedTimeline:b}){let MTKreasoningThreadRetained=MTKuseReasoningThreadRetention(e),x=s(ps)"
    ] : [
      "usesUnifiedTimeline:b}){let x=ve(ds)",
      "usesUnifiedTimeline:b}){let MTKreasoningThreadRetained=MTKuseReasoningThreadRetention(e),x=ve(ds)"
    ];
    source = replaceOnce(source, ...threadDecision, "current reasoning thread decision");
    const nextTurnGate = source.includes("We.current=ue},[e,u,ue,x,pe])") ? [
      "for(let t of i)bD(x,{conversationId:e,turnSearchKey:t},!0);We.current=ue},[e,u,ue,x,pe])",
      "if(!MTKreasoningThreadRetained)for(let t of i)bD(x,{conversationId:e,turnSearchKey:t},!0);We.current=ue},[e,u,ue,x,pe,MTKreasoningThreadRetained])"
    ] : [
      "for(let t of i)bD(x,{conversationId:e,turnSearchKey:t},!0);qe.current=G},[e,l,G,x,pe])",
      "if(!MTKreasoningThreadRetained)for(let t of i)bD(x,{conversationId:e,turnSearchKey:t},!0);qe.current=G},[e,l,G,x,pe,MTKreasoningThreadRetained])"
    ];
    source = replaceOnce(source, ...nextTurnGate, "current next-turn auto-collapse gate");
    fs.writeFileSync(file, source);
    return;
  }
  const helper = "const MTKreasoningThreadNoopSubscribe=()=>()=>{};function MTKuseReasoningThreadRetention(e){let t=globalThis.__MTKreasoningSubscribe??MTKreasoningThreadNoopSubscribe;return YO.useSyncExternalStore(t,()=>globalThis.__MTKreasoningShouldStayOpen?.(e)===!0,()=>!1)}";
  source = replaceOnce(source, "function GO({conversationId:e,", `${helper}function GO({conversationId:e,`, "reasoning thread hook");
  source = replaceOnce(source, "usesUnifiedTimeline:y}){let b=Fo(Mr)", "usesUnifiedTimeline:y}){let MTKreasoningThreadRetained=MTKuseReasoningThreadRetention(e),b=Fo(Mr)", "reasoning thread decision");
  source = replaceOnce(
    source,
    "for(let t of i)EE(b,{conversationId:e,turnSearchKey:t},!0);Ue.current=G},[e,c,G,b,fe])",
    "if(!MTKreasoningThreadRetained)for(let t of i)EE(b,{conversationId:e,turnSearchKey:t},!0);Ue.current=G},[e,c,G,b,fe,MTKreasoningThreadRetained])",
    "next-turn auto-collapse gate"
  );
  fs.writeFileSync(file, source);
}

function uniqueOwner(predicate, label) {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const owners = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (predicate(source)) owners.push({file, source});
  }
  if (owners.length !== 1) throw new Error(`Upstream changed: found ${owners.length} ${label}s`);
  return owners[0];
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
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
