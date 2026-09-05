#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: cross-task-attribution.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const id = "[$A-Z_a-z][$\\w]*";
const assets = path.join(root, "webview/assets");
const owner = findOwner();
let state = inspectState(owner.source);

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
      candidates.push({ file, source });
    }
  }
  if (candidates.length !== 1) {
    throw new Error(`Upstream changed: found ${candidates.length} cross-task attribution owners`);
  }
  return candidates[0];
}

function inspectState(source) {
  const markers = [
    "var MTKdelegatedBubbleStyle=",
    "function MTKsender(",
    "MTKstore.get(MTKtitleAtom,{hostId:",
    "messageBubbleStyle:MTKdelegatedBubbleStyle",
    '"data-user-message-bubble":!0,style:MTKbubbleStyleOverride'
  ];
  const present = markers.map(marker => source.includes(marker));
  if (present.every(Boolean)) {
    if (count(source, "function MTKsender(") !== 1 || count(source, "messageBubbleStyle:MTKdelegatedBubbleStyle") !== 1) {
      throw new Error("Unrecognized attribution patch: helper or style handoff is ambiguous");
    }
    if (!source.includes("onLabelClick:")) throw new Error("Unrecognized attribution patch: source-task click-through is missing");
    if (source.includes("className:`w-full rounded-xl px-2 py-1`") || source.includes("`bg-text/5`) max-w-")) {
      throw new Error("Unrecognized attribution patch: rejected delegated-bubble prototype remains");
    }
    return "applied";
  }
  if (present.some(Boolean)) throw new Error("Unrecognized attribution patch: partial markers");
  inspectPristine(source);
  return "needs-apply";
}

function inspectPristine(source) {
  const labelAt = source.indexOf("localConversation.codexDelegationUserMessage.app");
  const delegation = containingFunction(source, labelAt);
  const wrapper = functionAt(source, source.indexOf("function vb("));
  const bubble = functionAt(source, source.indexOf("function Eg("));
  for (const contract of [
    "function Cb(e){let t=(0,wb.c)(13),{conversationId:n,sourceThreadId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c}=e,",
    "h=(0,Tb.jsx)(vb,{conversationId:n,label:p,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:l,onLabelClick:m})",
    "function vb(e){let t=(0,yb.c)(16),{label:n,conversationId:r,message:i,sentAtMs:a,cwd:o,hostId:s,compactActions:c,onLabelClick:l}=e,",
    "m=f?(0,bb.jsx)(Eg,{message:i,sentAtMs:a,collapsedLineCount:xb,compactActions:u,cwd:o,hostId:s,threadId:r}):null",
    "function Eg(e){let t=(0,Og.c)(127),",
    '"data-user-message-bubble":!0,className:'
  ]) {
    if (!source.includes(contract)) throw new Error(`Upstream changed: attribution contract ${contract}`);
  }
  if (!new RegExp(`d=${id}\\(\\)\\?\`/hotkey-window/thread/\\$\\{r\\}\`:\`/local/\\$\\{r\\}\``).test(delegation.text)) {
    throw new Error("Upstream changed: attribution destination route");
  }
  return { delegation, wrapper, bubble };
}

function patchAttribution(source, ownerFile, details) {
  const imports = resolveImports(source, ownerFile);
  let delegation = details.delegation.text;
  let wrapper = details.wrapper.text;
  let bubble = details.bubble.text;

  delegation = replaceOnce(delegation, "function Cb(e){let t=(0,wb.c)(13),", "function Cb(e){let t=(0,wb.c)(14),", "delegation cache size");
  const labelEnd = ",t[1]=p):p=t[1];";
  const metadata =
    `let MTKstore=${imports.storeHook}(${imports.storeScope}),MTKtitle=MTKstore.get(MTKtitleAtom,{hostId:s??\`local\`,threadId:r}),` +
    "MTKresolvedSender=MTKsender(MTKtitle,null);MTKresolvedSender!=null&&(p=(0,Tb.jsxs)(Tb.Fragment,{children:[f,`Sent by ${MTKresolvedSender}`]}));";
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

  wrapper = replaceOnce(wrapper, "function vb(e){let t=(0,yb.c)(16),", "function vb(e){let t=(0,yb.c)(17),", "wrapper cache size");
  wrapper = replaceOnce(wrapper, "compactActions:c,onLabelClick:l}=e,", "compactActions:c,onLabelClick:l,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "wrapper style prop");
  wrapper = replaceOnce(wrapper, "cwd:o,hostId:s,threadId:r})", "cwd:o,hostId:s,threadId:r,messageBubbleStyle:MTKbubbleStyleOverride})", "bubble style prop");
  wrapper = replaceOnce(
    wrapper,
    "t[5]!==u||t[6]!==r||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==f?(",
    "t[5]!==u||t[6]!==r||t[7]!==o||t[8]!==s||t[9]!==i||t[10]!==a||t[11]!==f||t[16]!==MTKbubbleStyleOverride?(",
    "wrapper style dependency"
  );
  wrapper = replaceOnce(wrapper, "t[10]=a,t[11]=f,t[12]=m)", "t[10]=a,t[11]=f,t[16]=MTKbubbleStyleOverride,t[12]=m)", "wrapper style storage");

  bubble = replaceOnce(bubble, "function Eg(e){let t=(0,Og.c)(127),", "function Eg(e){let t=(0,Og.c)(128),", "bubble cache size");
  bubble = replaceOnce(bubble, "cwd:E,hostId:D}=e,", "cwd:E,hostId:D,messageBubbleStyle:MTKbubbleStyleOverride}=e,", "bubble style destructuring");
  const currentBubble = bubble.includes("t[42]!==de||t[43]!==oe||t[44]!==_e){");
  const bubbleDependency = currentBubble ?
    ["t[42]!==de||t[43]!==oe||t[44]!==_e){", "t[42]!==de||t[43]!==oe||t[44]!==_e||t[127]!==MTKbubbleStyleOverride){"] :
    ["t[42]!==fe||t[43]!==se||t[44]!==ve){", "t[42]!==fe||t[43]!==se||t[44]!==ve||t[127]!==MTKbubbleStyleOverride){"];
  bubble = replaceOnce(bubble, ...bubbleDependency, "bubble style cache dependency");
  bubble = replaceOnce(bubble, '"data-user-message-bubble":!0,className:', '"data-user-message-bubble":!0,style:MTKbubbleStyleOverride,className:', "bubble semantic accent");
  const bubbleStorage = currentBubble ?
    ["t[42]=de,t[43]=oe,t[44]=_e,t[45]=ve", "t[42]=de,t[43]=oe,t[44]=_e,t[127]=MTKbubbleStyleOverride,t[45]=ve"] :
    ["t[42]=fe,t[43]=se,t[44]=ve,t[45]=be", "t[42]=fe,t[43]=se,t[44]=ve,t[127]=MTKbubbleStyleOverride,t[45]=be"];
  bubble = replaceOnce(bubble, ...bubbleStorage, "bubble style storage");

  const helper =
    "var MTKdelegatedBubbleStyle={backgroundColor:`var(--color-token-interactive-bg-accent-muted-context,rgba(51,156,255,.1))`};" +
    "function MTKsender(e,t){if(typeof e!==`string`)return null;let n=e.trim();if(n.length===0)return null;" +
    "let r=n.indexOf(` — `);return r>0?n.slice(0,r).trim():typeof t===`string`&&t.trim().length>0?`${t.trim()}/${n}`:null}";

  source = replaceOnce(source, details.bubble.text, bubble, "bubble component");
  source = replaceOnce(source, details.wrapper.text, wrapper, "delegation wrapper component");
  source = replaceOnce(source, details.delegation.text, helper + delegation, "delegation component");
  return replaceOnce(source, imports.before, imports.after, "attribution imports");
}

function resolveImports(ownerSource, ownerFile) {
  const primaryImport = uniqueMatch(ownerSource, /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-primary-[^"]+\.js)";/g, "app-primary import");
  const initialImport = uniqueMatch(ownerSource, /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g, "app-initial import");
  const appPrimaryFile = ownedImport(ownerFile, primaryImport.groups.relative);
  const appInitialFile = ownedImport(ownerFile, initialImport.groups.relative);
  const appPrimary = fs.readFileSync(appPrimaryFile, "utf8");
  const appInitial = fs.readFileSync(appInitialFile, "utf8");
  const primaryInitialImport = uniqueMatch(appPrimary, /import\{(?<specifiers>[^}]+)\}from"(?<relative>\.\/app-initial-[^"]+\.js)";/g, "app-primary app-initial import");
  const titleExport = importedExport(primaryInitialImport.groups.specifiers, "ap", false);
  if (titleExport != null) {
    return {
      before: initialImport[0],
      after: `import{${initialImport.groups.specifiers},${titleExport} as MTKtitleAtom}from"${initialImport.groups.relative}";`,
      storeHook: importedLocal(initialImport.groups.specifiers, exportedAs(appInitial, "hb")),
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

function ownedImport(ownerFile, relative) {
  const file = path.resolve(path.dirname(ownerFile), relative);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error("App import escaped extraction root");
  return file;
}

function exportedAs(source, internal) {
  return uniqueMatch(source, new RegExp(`(?:^|,)${escapeRegExp(internal)} as (?<export>${id})(?=,|\\})`, "g"), `export for ${internal}`).groups.export;
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
