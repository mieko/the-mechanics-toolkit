#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
const bootstrap = String.raw`const MTKpatchRegistryKey="__MTK_PATCH_REGISTRY__",MTKpatchRegistry=(()=>{let e=globalThis[MTKpatchRegistryKey];if(e===void 0){let t={};e={apiVersion:1,packages:t,register(e,n){if(typeof e!=="string"||!/^[a-z][A-Za-z0-9]*$/.test(e)||n==null||typeof n!=="object"||Array.isArray(n)||!Number.isInteger(n.version)||n.version<1)return!1;let r=t[e];return r!=null&&r.version!==n.version?!1:(t[e]=Object.freeze({...n}),!0)}};globalThis[MTKpatchRegistryKey]=e}return e?.apiVersion===1&&e.packages!=null&&typeof e.packages==="object"&&!Array.isArray(e.packages)&&typeof e.register==="function"?e:null})();`;
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: renderer-patch-registry/patch.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const appInitial = uniqueAsset(/^app-initial-.*\.js$/);
let state = inspectState();
if (command === "apply" && state === "needs-apply") {
  applyRegistry();
  syntaxCheckChanged();
  state = inspectState();
  if (state !== "applied") throw new Error("renderer patch registry transform did not verify");
}

const packages = activePackages().map(entry => entry.name).sort();
process.stdout.write(`${JSON.stringify({
  state,
  apiVersion: 1,
  packages,
  targets: registryTargets().map(file => path.relative(root, file)).sort()
}, null, 2)}\n`);

function activePackages() {
  const appSource = fs.readFileSync(appInitial, "utf8");
  const packages = [];
  addIf(packages, appSource.includes("function MTKusePaletteBootstrap("), {
    name: "taskVisualPalette",
    file: appInitial,
    call: `MTKpatchRegistry?.register("taskVisualPalette",{version:1,resolveTaskColor(e){try{let t=MTKmatchPalette(MTKsidebarPalette,e?.title,e?.taskId);return t?.color??null}catch{return null}}});`
  });
  addIf(packages, appSource.includes("function MTKsidebarActionDisclosure(") ||
    appSource.includes("function MTKsidebarActionDisclosure7345(") ||
    appSource.includes("function MTKsidebarActionDisclosure7746(") ||
    appSource.includes("function MTKsidebarActionDisclosure7942("), {
    name: "sidebarActionCollapse",
    file: appInitial,
    call: `MTKpatchRegistry?.register("sidebarActionCollapse",{version:1});`
  });
  addIf(packages, appSource.includes("function MTKattentionIgnoredThread(") ||
    appSource.includes("function MTKattentionIgnoredThread7345(") ||
    appSource.includes("function MTKattentionIgnoredThread7746(") ||
    appSource.includes("function MTKattentionIgnoredThread7942("), {
    name: "taskAttentionPolicy",
    file: appInitial,
    call: `MTKpatchRegistry?.register("taskAttentionPolicy",{version:1});`
  });
  addIf(packages, appSource.includes('requiredAccess:`codexLocal`,shortcutScope:`app`,commandMenuGroupKey:`panels`'), {
    name: "terminalToggle",
    file: appInitial,
    call: `MTKpatchRegistry?.register("terminalToggle",{version:1});`
  });

  for (const file of assetFiles()) {
    if (file === appInitial) continue;
    const source = fs.readFileSync(file, "utf8");
    addIf(packages, source.includes("function MTKsidebarActionDisclosure7746(") ||
      source.includes("function MTKsidebarActionDisclosure7942("), {
      name: "sidebarActionCollapse",
      file,
      anchor: source.includes("function MTKsidebarActionDisclosure7942(")
        ? "function MTKsidebarActionDisclosure7942("
        : "function MTKsidebarActionDisclosure7746(",
      call: `globalThis.__MTK_PATCH_REGISTRY__?.register?.("sidebarActionCollapse",{version:1});`
    });
    addIf(packages, source.includes("function MTKsender(") && source.includes("messageBubbleStyle:MTKdelegatedBubbleStyle"), {
      name: "crossTaskAttribution",
      file,
      anchor: "var MTKdelegatedBubbleStyle=",
      call: `globalThis.__MTK_PATCH_REGISTRY__?.register?.("crossTaskAttribution",{version:1});`
    });
  }
  const names = packages.map(entry => entry.name);
  if (new Set(names).size !== names.length) throw new Error(`Active package ownership is ambiguous: ${names.join(",")}`);
  return packages;
}

function inspectState() {
  const packages = activePackages();
  const files = new Map(registryTargets(packages).map(file => [file, fs.readFileSync(file, "utf8")]));
  const appSource = files.get(appInitial);
  const bootstrapCount = count(appSource, bootstrap);
  const packageCounts = packages.map(entry => count(files.get(entry.file), entry.call));
  const knownNames = new Set(packages.map(entry => entry.name));
  const registrations = [];
  for (const file of assetFiles()) {
    const source = files.get(file) ?? fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:MTKpatchRegistry\?\.register|globalThis\.__MTK_PATCH_REGISTRY__\?\.register\?\.)\("(?<name>[A-Za-z][A-Za-z0-9]*)"/g)) {
      if (!knownNames.has(match.groups.name)) throw new Error(`Orphaned patch registration ${match.groups.name} in ${path.basename(file)}`);
      registrations.push(match.groups.name);
    }
  }
  for (const entry of packages) {
    const nameCount = registrations.filter(name => name === entry.name).length;
    const exactCount = count(files.get(entry.file), entry.call);
    const previousCount = (entry.previousCalls ?? []).reduce((sum, call) => sum + count(files.get(entry.file), call), 0);
    if (nameCount > 1 || (nameCount === 1 && exactCount !== 1 && previousCount !== 1)) {
      throw new Error(`Unrecognized ${entry.name} registration: names=${nameCount} exact=${exactCount}`);
    }
  }
  if (bootstrapCount === 1 && packageCounts.every(value => value === 1)) return "applied";
  if (bootstrapCount <= 1 && packageCounts.every(value => value === 0 || value === 1)) return "needs-apply";
  throw new Error(`Unrecognized registry state: bootstrap=${bootstrapCount} packages=${packageCounts.join(",")}`);
}

function applyRegistry() {
  const packages = activePackages();
  let appSource = fs.readFileSync(appInitial, "utf8");
  if (!appSource.includes(bootstrap)) {
    appSource = `${bootstrap}${appSource}`;
  }
  for (const entry of packages.filter(entry => entry.file === appInitial)) {
    if (!appSource.includes(entry.call)) {
      appSource = replaceOnce(appSource, bootstrap, `${bootstrap}${entry.call}`, `${entry.name} registration`);
    }
  }
  fs.writeFileSync(appInitial, appSource);

  for (const entry of packages.filter(entry => entry.file !== appInitial)) {
    let source = fs.readFileSync(entry.file, "utf8");
    if (!source.includes(entry.call)) {
      const previous = (entry.previousCalls ?? []).filter(call => source.includes(call));
      if (previous.length > 1) throw new Error(`Unrecognized ${entry.name} registration upgrade state`);
      source = previous.length === 1
        ? replaceOnce(source, previous[0], entry.call, `${entry.name} registration upgrade`)
        : replaceOnce(source, entry.anchor, `${entry.call}${entry.anchor}`, `${entry.name} registration`);
      fs.writeFileSync(entry.file, source);
    }
  }
}

function registryTargets(packages = activePackages()) {
  return [...new Set([appInitial, ...packages.map(entry => entry.file)])];
}

function syntaxCheckChanged() {
  for (const file of registryTargets()) syntaxCheck(file);
}

function addIf(entries, condition, entry) {
  if (condition) entries.push(entry);
}

function assetFiles() {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  return fs.readdirSync(assets).filter(name => name.endsWith(".js")).map(name => path.join(assets, name));
}

function uniqueAsset(pattern) {
  const matches = assetFiles().filter(file => pattern.test(path.basename(file)));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} assets matching ${pattern}`);
  return matches[0];
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
