#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { linuxBuild8881 } from "./profiles/linux.mjs";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: cross-task-attribution.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const id = "[$A-Z_a-z][$\\w]*";
const attributionNameMarker = '"data-mtk-palette-attribution-name":!0';
const assets = path.join(root, "webview/assets");
const owner = findOwner();
let state = inspectState(owner.source);

if (command === "apply" && state === "name-scope-upgrade") {
  const patched = upgradeAttributionName(owner.source);
  fs.writeFileSync(owner.file, patched);
  syntaxCheck(owner.file);
  state = inspectState(patched);
  if (state !== "applied") throw new Error("cross-task attribution name-scope upgrade did not verify");
}

if (command === "apply" && state === "label-capability-upgrade") {
  const patched = replaceOnce(owner.source, legacyHelper(), currentHelper(), "shared task-label helper upgrade");
  fs.writeFileSync(owner.file, patched);
  syntaxCheck(owner.file);
  state = inspectState(patched);
  if (state !== "applied") throw new Error("cross-task attribution label-capability upgrade did not verify");
}

if (command === "apply" && state === "plain-title-fallback-upgrade") {
  const patched = replaceOnce(owner.source, genericPlainTitleHelper(), currentHelper(), "plain task-title fallback upgrade");
  fs.writeFileSync(owner.file, patched);
  syntaxCheck(owner.file);
  state = inspectState(patched);
  if (state !== "applied") throw new Error("cross-task attribution plain-title fallback upgrade did not verify");
}

if (command === "apply" && state === "needs-apply") {
  const details = inspectPristine(owner.source);
  const patched = patchAttribution(owner.source, owner.file, details);
  fs.writeFileSync(owner.file, patched);
  syntaxCheck(owner.file);
  state = inspectState(patched);
  if (state !== "applied") throw new Error("cross-task attribution transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  targets: [path.relative(root, owner.file)]
}, null, 2)}\n`);

function findOwner() {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const candidates = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (source.includes("localConversation.codexDelegationUserMessage.app") &&
        source.includes("defaultMessage:`Sent by {appName} from another task`") &&
        source.includes("sourceThreadId")) {
      const labelAt = source.indexOf("localConversation.codexDelegationUserMessage.app");
      if (containingFunction(source, labelAt).text.includes("sourceThreadId")) {
        candidates.push({ file, source });
      }
    }
  }
  if (candidates.length !== 1) {
    throw new Error(`Upstream changed: found ${candidates.length} cross-task attribution owners`);
  }
  return candidates[0];
}

function inspectState(source) {
  const legacyMarkers = [
    "var MTKdelegatedBubbleStyle=",
    "function MTKsender(",
    "const MTKcrossTaskStoreHook=",
    "MTKcrossTaskStoreScope=",
    "MTKstore.get(MTKtitleAtom,{hostId:",
    "messageBubbleStyle:MTKdelegatedBubbleStyle",
    '"data-user-message-bubble":!0,style:MTKbubbleStyleOverride'
  ];
  const present = legacyMarkers.map(marker => source.includes(marker));
  if (present.every(Boolean)) {
    if (count(source, "function MTKsender(") !== 1 || count(source, "messageBubbleStyle:MTKdelegatedBubbleStyle") !== 1) {
      throw new Error("Unrecognized attribution patch: helper or style handoff is ambiguous");
    }
    if (!source.includes("onLabelClick:")) throw new Error("Unrecognized attribution patch: source-task click-through is missing");
    if (source.includes("className:`w-full rounded-xl px-2 py-1`") || source.includes("`bg-text/5`) max-w-")) {
      throw new Error("Unrecognized attribution patch: rejected delegated-bubble prototype remains");
    }
    if (source.includes(currentHelper())) {
      if (source.includes(attributionNameMarker)) return "applied";
      if (source.includes("`Sent by ${MTKresolvedSender}`")) return "name-scope-upgrade";
      throw new Error("Unrecognized attribution patch: sender-name scope is partial");
    }
    if (source.includes(genericPlainTitleHelper())) return "plain-title-fallback-upgrade";
    if (count(source, "function MTKshortTaskTitle(") === 0 && source.includes(legacyHelper())) return "label-capability-upgrade";
    throw new Error("Unrecognized attribution patch: shared task-label helper is partial");
  }
  if (present.some(Boolean)) throw new Error("Unrecognized attribution patch: partial markers");
  inspectPristine(source);
  return "needs-apply";
}

function inspectPristine(source) {
  const labelAt = source.indexOf("localConversation.codexDelegationUserMessage.app");
  const delegation = containingFunction(source, labelAt);
  const profile = [
    linuxBuild8881.component,
    {
      delegation: "Cb", delegationCache: "wb", delegationJsx: "Tb",
      wrapper: "vb", wrapperCache: "yb", wrapperJsx: "bb",
      bubble: "Eg", bubbleCache: "Og", collapsedLines: "xb"
    },
    {
      delegation: "Yb", delegationCache: "Xb", delegationJsx: "Zb",
      wrapper: "Wb", wrapperCache: "Gb", wrapperJsx: "Kb",
      bubble: "$g", bubbleCache: "t_", collapsedLines: "qb"
    },
    {
      delegation: "Xb", delegationCache: "Zb", delegationJsx: "Qb",
      wrapper: "Gb", wrapperCache: "Kb", wrapperJsx: "qb",
      bubble: "e_", bubbleCache: "n_", collapsedLines: "Jb",
      bubbleDependency: [
        "t[41]!==J||t[42]!==fe||t[43]!==se||t[44]!==ye){",
        "t[41]!==J||t[42]!==fe||t[43]!==se||t[44]!==ye||t[127]!==MTKbubbleStyleOverride){"
      ],
      bubbleStorage: [
        "t[41]=J,t[42]=fe,t[43]=se,t[44]=ye,t[45]=be",
        "t[41]=J,t[42]=fe,t[43]=se,t[44]=ye,t[127]=MTKbubbleStyleOverride,t[45]=be"
      ]
    },
    {
      delegation: "rz", delegationCache: "iz", delegationJsx: "az",
      wrapper: "JR", wrapperCache: "YR", wrapperJsx: "XR",
      bubble: "l_", bubbleCache: "d_", collapsedLines: "ZR",
      bubbleCacheSize: 135,
      bubbleOwner: [
        "turnId:O,cwd:k,hostId:A}=e,",
        "turnId:O,cwd:k,hostId:A,messageBubbleStyle:MTKbubbleStyleOverride}=e,"
      ],
      bubbleDependency: [
        "t[43]!==_e||t[44]!==de||t[45]!==Ce){",
        "t[43]!==_e||t[44]!==de||t[45]!==Ce||t[135]!==MTKbubbleStyleOverride){"
      ],
      bubbleStorage: [
        "t[43]=_e,t[44]=de,t[45]=Ce,t[46]=we",
        "t[43]=_e,t[44]=de,t[45]=Ce,t[135]=MTKbubbleStyleOverride,t[46]=we"
      ]
    },
    {
      delegation: "rz", delegationCache: "iz", delegationJsx: "az",
      wrapper: "JR", wrapperCache: "YR", wrapperJsx: "XR",
      bubble: "__", bubbleCache: "y_", collapsedLines: "ZR",
      bubbleCacheSize: 135,
      bubbleOwner: [
        "turnId:k,cwd:A,hostId:j}=e,",
        "turnId:k,cwd:A,hostId:j,messageBubbleStyle:MTKbubbleStyleOverride}=e,"
      ],
      bubbleDependency: [
        "t[43]!==_e||t[44]!==fe||t[45]!==Ce){",
        "t[43]!==_e||t[44]!==fe||t[45]!==Ce||t[135]!==MTKbubbleStyleOverride){"
      ],
      bubbleStorage: [
        "t[43]=_e,t[44]=fe,t[45]=Ce,t[46]=we",
        "t[43]=_e,t[44]=fe,t[45]=Ce,t[135]=MTKbubbleStyleOverride,t[46]=we"
      ]
    }
  ].find(candidate => delegation.text.startsWith(`function ${candidate.delegation}(`) &&
    source.includes(`function ${candidate.bubble}(`) &&
    (candidate.marker == null || source.includes(candidate.marker)));
  if (profile == null) throw new Error("Upstream changed: attribution component family is unknown");
  const wrapper = functionAt(source, source.indexOf(`function ${profile.wrapper}(`));
  const bubble = functionAt(source, source.indexOf(`function ${profile.bubble}(`));
  for (const contract of [
    `function ${profile.delegation}(e){let t=(0,${profile.delegationCache}.c)(13),{conversationId:n,sourceThreadId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c}=e,`,
    `h=(0,${profile.delegationJsx}.jsx)(${profile.wrapper},{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m})`,
    `function ${profile.wrapper}(e){let t=(0,${profile.wrapperCache}.c)(16),{label:n,conversationId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c,onLabelClick:l}=e,`,
    `m=f?(0,${profile.wrapperJsx}.jsx)(${profile.bubble},{message:i,sentAtMs:a,collapsedLineCount:${profile.collapsedLines},compactActions:u,cwd:o,hostId:s,threadId:r}):null`,
    `function ${profile.bubble}(e){let t=(0,${profile.bubbleCache}.c)(${profile.bubbleCacheSize ?? 127}),`,
    '"data-user-message-bubble":!0,className:'
  ]) {
    if (!source.includes(contract)) throw new Error(`Upstream changed: attribution contract ${contract}`);
  }
  if (!new RegExp(`d=${id}\\(\\)\\?\`/hotkey-window/thread/\\$\\{r\\}\`:\`/local/\\$\\{r\\}\``).test(delegation.text)) {
    throw new Error("Upstream changed: attribution destination route");
  }
  return { delegation, wrapper, bubble, profile };
}

function patchAttribution(source, ownerFile, details) {
  const imports = resolveImports(source, ownerFile);
  let delegation = details.delegation.text;
  let wrapper = details.wrapper.text;
  let bubble = details.bubble.text;
  const profile = details.profile;

  delegation = replaceOnce(delegation, `function ${profile.delegation}(e){let t=(0,${profile.delegationCache}.c)(13),`, `function ${profile.delegation}(e){let t=(0,${profile.delegationCache}.c)(14),`, "delegation cache size");
  const labelEnd = ",t[1]=p):p=t[1];";
  const metadata =
    `let MTKstore=MTKcrossTaskStoreHook(MTKcrossTaskStoreScope),MTKtitle=MTKstore.get(MTKtitleAtom,{hostId:s??\`local\`,threadId:r}),` +
    `MTKresolvedSender=MTKsender(MTKtitle,null);${attributionLabel(profile.delegationJsx)}`;
  delegation = replaceOnce(delegation, labelEnd, labelEnd + metadata, "delegation metadata insertion");
  delegation = replaceOnce(
    delegation,
    "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m?(",
    "t[5]!==l||t[6]!==n||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==m||t[13]!==p?(",
    "delegation label dependency"
  );
  delegation = replaceOnce(
    delegation,
    "onLabelClick:m}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[12]=h)",
    "onLabelClick:m,messageBubbleStyle:MTKdelegatedBubbleStyle}),t[5]=l,t[6]=n,t[7]=o,t[8]=s,t[9]=i,t[10]=a,t[11]=m,t[13]=p,t[12]=h)",
    "delegated bubble style handoff"
  );

  wrapper = replaceOnce(wrapper, `function ${profile.wrapper}(e){let t=(0,${profile.wrapperCache}.c)(16),`, `function ${profile.wrapper}(e){let t=(0,${profile.wrapperCache}.c)(17),`, "wrapper cache size");
  wrapper = replaceOnce(wrapper, "compactActions:c,onLabelClick:l}=e,", "compactActions:c,onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "wrapper style prop");
  wrapper = replaceOnce(wrapper, "cwd:o,hostId:s,threadId:r})", "cwd:o,hostId:s,threadId:r,messageBubbleStyle:MTKbubbleStyleOverride})", "bubble style prop");
  wrapper = replaceOnce(
    wrapper,
    "t[5]!==u||t[6]!==r||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==f?(",
    "t[5]!==u||t[6]!==r||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==f||t[16]!==MTKbubbleStyleOverride?(",
    "wrapper style dependency"
  );
  wrapper = replaceOnce(wrapper, "t[10]=a,t[11]=f,t[12]=m)", "t[10]=a,t[11]=f,t[16]=MTKbubbleStyleOverride,t[12]=m)", "wrapper style storage");

  const bubbleCacheSize = profile.bubbleCacheSize ?? 127;
  bubble = replaceOnce(bubble, `function ${profile.bubble}(e){let t=(0,${profile.bubbleCache}.c)(${bubbleCacheSize}),`, `function ${profile.bubble}(e){let t=(0,${profile.bubbleCache}.c)(${bubbleCacheSize + 1}),`, "bubble cache size");
  const bubbleOwner = profile.bubbleOwner ?? (bubble.includes("cwd:D,hostId:O}=e,") ?
    ["cwd:D,hostId:O}=e,", "cwd:D,hostId:O,messageBubbleStyle:MTKbubbleStyleOverride}=e,"] :
    ["cwd:E,hostId:D}=e,", "cwd:E,hostId:D,messageBubbleStyle:MTKbubbleStyleOverride}=e,"]);
  bubble = replaceOnce(bubble, ...bubbleOwner, "bubble style destructuring");
  const bubbleDependency = profile.bubbleDependency ?? (bubble.includes("t[42]!==de||t[43]!==ae||t[44]!==_e){") ?
    ["t[42]!==de||t[43]!==ae||t[44]!==_e){", "t[42]!==de||t[43]!==ae||t[44]!==_e||t[127]!==MTKbubbleStyleOverride){"] :
    bubble.includes("t[42]!==de||t[43]!==oe||t[44]!==_e){") ?
      ["t[42]!==de||t[43]!==oe||t[44]!==_e){", "t[42]!==de||t[43]!==oe||t[44]!==_e||t[127]!==MTKbubbleStyleOverride){"] :
      ["t[42]!==fe||t[43]!==se||t[44]!==ve){", "t[42]!==fe||t[43]!==se||t[44]!==ve||t[127]!==MTKbubbleStyleOverride){"]);
  bubble = replaceOnce(bubble, ...bubbleDependency, "bubble style cache dependency");
  bubble = replaceOnce(bubble, '"data-user-message-bubble":!0,className:', '"data-user-message-bubble":!0,style:MTKbubbleStyleOverride,className:', "bubble semantic accent");
  const bubbleStorage = profile.bubbleStorage ?? (bubble.includes("t[42]=de,t[43]=ae,t[44]=_e,t[45]=ve") ?
    ["t[42]=de,t[43]=ae,t[44]=_e,t[45]=ve", "t[42]=de,t[43]=ae,t[44]=_e,t[127]=MTKbubbleStyleOverride,t[45]=ve"] :
    bubble.includes("t[42]=de,t[43]=oe,t[44]=_e,t[45]=ve") ?
      ["t[42]=de,t[43]=oe,t[44]=_e,t[45]=ve", "t[42]=de,t[43]=oe,t[44]=_e,t[127]=MTKbubbleStyleOverride,t[45]=ve"] :
      ["t[42]=fe,t[43]=se,t[44]=ve,t[45]=be", "t[42]=fe,t[43]=se,t[44]=ve,t[127]=MTKbubbleStyleOverride,t[45]=be"]);
  bubble = replaceOnce(bubble, ...bubbleStorage, "bubble style storage");

  const helper = currentHelper() +
    `const MTKcrossTaskStoreHook=${imports.storeHook},MTKcrossTaskStoreScope=${imports.storeScope};`;

  source = replaceOnce(source, details.bubble.text, bubble, "bubble component");
  source = replaceOnce(source, details.wrapper.text, wrapper, "delegation wrapper component");
  source = replaceOnce(source, details.delegation.text, helper + delegation, "delegation component");
  return replaceOnce(source, imports.before, imports.after, "attribution imports");
}

function upgradeAttributionName(source) {
  const oldLabel = uniqueMatch(
    source,
    /MTKresolvedSender!=null&&\(p=\(0,(?<jsx>[$A-Z_a-z][$\w]*)\.jsxs\)\(\k<jsx>\.Fragment,\{children:\[f,`Sent by \$\{MTKresolvedSender\}`\]\}\)\);/g,
    "whole-line attribution label"
  );
  return replaceOnce(source, oldLabel[0], attributionLabel(oldLabel.groups.jsx), "sender-name attribution scope");
}

function attributionLabel(jsx) {
  return `MTKresolvedSender!=null&&(p=(0,${jsx}.jsxs)(${jsx}.Fragment,{children:[f,\`Sent by \`,(0,${jsx}.jsx)(\`span\`,{${attributionNameMarker},children:MTKresolvedSender})]}));`;
}

function legacyHelper() {
  return "var MTKdelegatedBubbleStyle={backgroundColor:`var(--color-token-interactive-bg-accent-muted-context,rgba(51,156,255,.1))`};" +
    "function MTKsender(e,t){if(typeof e!==`string`)return null;let n=e.trim();if(n.length===0)return null;" +
    "let r=n.indexOf(` — `);return r>0?n.slice(0,r).trim():typeof t===`string`&&t.trim().length>0?`${t.trim()}/${n}`:null}";
}

function currentHelper() {
  return "var MTKdelegatedBubbleStyle={backgroundColor:`var(--color-token-interactive-bg-accent-muted-context,rgba(51,156,255,.1))`};" +
    "function MTKshortTaskTitle(e){if(typeof e!==`string`)return null;let t=e.trim();if(t.length===0)return null;" +
    "let n=t.indexOf(` — `);return n>0?t.slice(0,n).trim():t}" +
    "function MTKsender(e,t){let n=MTKshortTaskTitle(e);if(n==null)return null;return n!==e.trim()?n:" +
    "typeof t===`string`&&t.trim().length>0?`${t.trim()}/${n}`:n}";
}

function genericPlainTitleHelper() {
  return "var MTKdelegatedBubbleStyle={backgroundColor:`var(--color-token-interactive-bg-accent-muted-context,rgba(51,156,255,.1))`};" +
    "function MTKshortTaskTitle(e){if(typeof e!==`string`)return null;let t=e.trim();if(t.length===0)return null;" +
    "let n=t.indexOf(` — `);return n>0?t.slice(0,n).trim():t}" +
    "function MTKsender(e,t){let n=MTKshortTaskTitle(e);if(n==null)return null;return n!==e.trim()?n:" +
    "typeof t===`string`&&t.trim().length>0?`${t.trim()}/${n}`:null}";
}

function resolveImports(ownerSource, ownerFile) {
  const primaryImport = uniqueMatch(ownerSource, /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-primary-[^"]+\.js)";/g, "app-primary import");
  const initialImport = uniqueMatch(ownerSource, /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g, "app-initial import");
  const appPrimaryFile = ownedImport(ownerFile, primaryImport.groups.relative);
  const appInitialFile = ownedImport(ownerFile, initialImport.groups.relative);
  const appPrimary = fs.readFileSync(appPrimaryFile, "utf8");
  const appInitial = fs.readFileSync(appInitialFile, "utf8");
  if (appPrimary.includes(linuxBuild8881.titleOwner)) {
    return {
      before: primaryImport[0],
      after: `import{${primaryImport.groups.specifiers},${exportedAs(appPrimary, linuxBuild8881.titleAtom)} as MTKtitleAtom}from"${primaryImport.groups.relative}";`,
      storeHook: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, linuxBuild8881.storeHook)),
      storeScope: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, linuxBuild8881.storeScope))
    };
  }
  if (appPrimary.includes("pt=jm(xNn,{hostId:Je??`local`,threadId:n})??Ue?.title??null")) {
    return {
      before: primaryImport[0],
      after: `import{${primaryImport.groups.specifiers},${exportedAs(appPrimary, "xNn")} as MTKtitleAtom}from"${primaryImport.groups.relative}";`,
      storeHook: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, currentStoreHookInternal(appInitial))),
      storeScope: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, "Q"))
    };
  }
  if (appPrimary.includes("ft=rw(tOn,{hostId:qe??`local`,threadId:n})??He?.title??null")) {
    return {
      before: primaryImport[0],
      after: `import{${primaryImport.groups.specifiers},${exportedAs(appPrimary, "tOn")} as MTKtitleAtom}from"${primaryImport.groups.relative}";`,
      storeHook: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, currentStoreHookInternal(appInitial))),
      storeScope: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, "Q"))
    };
  }
  if (appPrimary.includes("Q2t=Jf(o_,(e,{get:t})=>{") &&
      appPrimary.includes("X2t({...n,localTitle:r})")) {
    return {
      before: primaryImport[0],
      after: `import{${primaryImport.groups.specifiers},${exportedAs(appPrimary, "Q2t")} as MTKtitleAtom}from"${primaryImport.groups.relative}";`,
      storeHook: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, currentStoreHookInternal(appInitial))),
      storeScope: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, "Q"))
    };
  }
  const titleMarker = appPrimary.indexOf("localTitle:r})})}));");
  if (titleMarker >= 0) {
    const beforeTitle = appPrimary.slice(Math.max(0, titleMarker - 1600), titleMarker);
    const candidates = [...beforeTitle.matchAll(new RegExp(`(?<atom>${id})=(?:iS|wx)\\((?<scope>${id}),`, "g"))];
    const titleSelector = candidates.at(-1);
    if (titleSelector == null || !beforeTitle.slice(titleSelector.index).includes("hasConversation")) {
      throw new Error("Upstream changed: current task-title selector owner is ambiguous");
    }
    const storeHookInternal = currentStoreHookInternal(appInitial);
    return {
      before: primaryImport[0],
      after: `import{${primaryImport.groups.specifiers},${exportedAs(appPrimary, titleSelector.groups.atom)} as MTKtitleAtom}from"${primaryImport.groups.relative}";`,
      storeHook: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, storeHookInternal)),
      storeScope: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, "Q"))
    };
  }
  const primaryInitialImport = uniqueMatch(appPrimary, /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g, "app-primary app-initial import");
  const titleExport = importedExport(primaryInitialImport.groups.specifiers, "ap", false);
  if (titleExport != null) {
    const storeHookInternal = currentStoreHookInternal(appInitial);
    return {
      before: initialImport[0],
      after: `import{${initialImport.groups.specifiers},${titleExport} as MTKtitleAtom}from"${initialImport.groups.relative}";`,
      storeHook: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, storeHookInternal)),
      storeScope: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, "Q"))
    };
  }
  return {
    before: primaryImport[0],
    after: `import{${primaryImport.groups.specifiers},${exportedAs(appPrimary, "SOn")} as MTKtitleAtom}from"${primaryImport.groups.relative}";`,
    storeHook: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, "pb")),
    storeScope: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, "Q"))
  };
}

function currentStoreHookInternal(source) {
  const marker = source.indexOf("sidebarElectron.recentChats");
  if (marker >= 0) {
    const owner = containingFunction(source, marker).text;
    const current = [...owner.matchAll(new RegExp(`let e=\\(0,${id}\\.c\\)\\(12\\),t=(?<hook>${id})\\(Q\\),`, "g"))];
    if (current.length === 1) return current[0].groups.hook;
    if (current.length > 1) throw new Error("Upstream changed: current store hook owner is ambiguous");
  }
  return "hb";
}

function ownedImport(ownerFile, relative) {
  const file = path.resolve(path.dirname(ownerFile), relative);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error("App import escaped extraction root");
  return file;
}

function exportedAs(source, internal) {
  const specifiers = uniqueMatch(source, /export\{(?<specifiers>[^}]+)\}/g, "module export list").groups.specifiers;
  return uniqueMatch(specifiers, new RegExp(`(?:^|,)${escapeRegExp(internal)} as (?<export>${id})(?=,|$)`, "g"), `export for ${internal}`).groups.export;
}

function importedLocal(specifiers, exported) {
  return uniqueMatch(specifiers, new RegExp(`(?:^|,)${escapeRegExp(exported)} as (?<local>${id})(?=,|$)`, "g"), `existing import for ${exported}`).groups.local;
}

function importedExport(specifiers, local, required = true) {
  const matches = [...specifiers.matchAll(new RegExp(`(?:^|,)(?<export>${id}) as ${escapeRegExp(local)}(?=,|$)`, "g"))];
  if (matches.length === 1) return matches[0].groups.export;
  if (!required && matches.length === 0) return null;
  throw new Error(`Upstream changed: found ${matches.length} existing imports for local ${local}`);
}

function containingFunction(source, position) {
  let start = source.lastIndexOf("function ", position);
  while (start >= 0) {
    const candidate = functionAt(source, start);
    if (position < candidate.end) return candidate;
    start = source.lastIndexOf("function ", start - 1);
  }
  throw new Error("Could not locate containing function");
}

function functionAt(source, start) {
  if (start < 0 || !source.startsWith("function ", start)) throw new Error("Function start is missing");
  const open = source.indexOf("{", start);
  let quote = null;
  let escaped = false;
  let depth = 1;
  for (let index = open + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error("Function did not terminate");
}

function uniqueMatch(source, pattern, label) {
  const regex = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + "g");
  const matches = [...source.matchAll(regex)];
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function count(value, needle) {
  return value.split(needle).length - 1;
}
