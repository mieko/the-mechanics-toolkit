#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const root = path.resolve(process.argv[3] ?? "");
if (!new Set(["check", "apply"]).has(command) || !process.argv[3]) {
  throw new Error("usage: sidebar-action-collapse.mjs check|apply EXTRACTED_ASAR_ROOT");
}

const assets = path.join(root, "webview/assets");
const target = uniqueOwnershipAsset();
let source = fs.readFileSync(target, "utf8");
let state = inspectState(source);

if (command === "apply" && state === "needs-apply") {
  source = patchSource(source);
  fs.writeFileSync(target, source);
  syntaxCheck(target);
  state = inspectState(source);
  if (state !== "applied") throw new Error("sidebar action collapse transform did not verify");
}

process.stdout.write(`${JSON.stringify({
  state,
  storageKey: "the-mechanics-toolkit:sidebar-global-actions-collapsed:v1",
  target: path.relative(root, target)
}, null, 2)}\n`);

function inspectState(value) {
  if (value.includes('const MTK_SIDEBAR_ACTIONS_STORAGE_KEY=') &&
      (!hasDisclosurePointerCursor(value) || hasLegacyDisclosureOrder(value))) {
    return "needs-apply";
  }
  const build8378Markers = [
    'const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1"',
    "function MTKuseSidebarActionCollapse8378()",
    "function MTKsidebarActionDisclosure8378(",
    "function MTKsidebarCollapsedDestinations8378(",
    'className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary cursor-pointer"',
    "function Nhr(e){let t=(0,Lhr.c)(145),",
    "[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse8378()",
    "Te=MTKsidebarCollapsedDestinations8378(MTKsidebarActionsCollapsed,Te,Nx.projects);let Ee=Te.length>0",
    "MTKsidebarActionsCollapsed?null:(0,A4.jsx)(mkn,",
    '!E&&_e===`header_icon`?(0,A4.jsx)(kkn,{sidebarMode:se}):null,(0,A4.jsx)(MTKsidebarActionDisclosure8378,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "t[144]!==MTKsidebarActionsCollapsed",
    "t[144]=MTKsidebarActionsCollapsed,t[101]=He"
  ];
  if (value.includes("function MTKuseSidebarActionCollapse8378()")) {
    if (!build8378Markers.every(marker => value.includes(marker))) throw new Error("Unrecognized build-8378 sidebar collapse patch: partial markers");
    return "applied";
  }
  const build8109Markers = [
    'const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1"',
    "function MTKuseSidebarActionCollapse8109()",
    "function MTKsidebarActionDisclosure8109(",
    "function MTKsidebarCollapsedDestinations8109(",
    'className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary cursor-pointer"',
    "function par(e){let t=(0,_ar.c)(145),",
    "[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse8109()",
    "let De=MTKsidebarCollapsedDestinations8109(MTKsidebarActionsCollapsed,$Sn(Ee),Hy.projects),Oe;",
    "MTKsidebarActionsCollapsed?null:(0,M4.jsx)(tTn,",
    '!E&&be===`header_icon`?(0,M4.jsx)(yTn,{sidebarMode:ce}):null,(0,M4.jsx)(MTKsidebarActionDisclosure8109,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "t[144]!==MTKsidebarActionsCollapsed",
    "t[144]=MTKsidebarActionsCollapsed,t[101]=Ge"
  ];
  if (value.includes("function MTKuseSidebarActionCollapse8109()")) {
    if (!build8109Markers.every(marker => value.includes(marker))) throw new Error("Unrecognized build-8109 sidebar collapse patch: partial markers");
    return "applied";
  }
  const build7942Markers = [
    'const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1"',
    "function MTKuseSidebarActionCollapse7942()",
    "function MTKsidebarActionDisclosure7942(",
    'className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary cursor-pointer"',
    "function dar(e){let t=(0,har.c)(145),",
    "[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse7942()",
    "let MTKsidebarDestinations=ZSn(we),Te=MTKsidebarActionsCollapsed?[]:MTKsidebarDestinations",
    "MTKsidebarActionsCollapsed?null:(0,N4.jsx)($wn,",
    '!E&&ve===`header_icon`?(0,N4.jsx)(_Tn,{sidebarMode:ce}):null,(0,N4.jsx)(MTKsidebarActionDisclosure7942,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "t[144]!==MTKsidebarActionsCollapsed",
    "t[144]=MTKsidebarActionsCollapsed,t[101]=Ue"
  ];
  if (value.includes("function MTKuseSidebarActionCollapse7942()")) {
    if (!build7942Markers.every(marker => value.includes(marker))) throw new Error("Unrecognized build-7942 sidebar collapse patch: partial markers");
    return "applied";
  }
  const build7746Markers = [
    'const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1"',
    "function MTKuseSidebarActionCollapse7746()",
    "function MTKsidebarActionDisclosure7746(",
    'className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary cursor-pointer"',
    "function ear(e){let t=(0,iar.c)(145),",
    "[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse7746()",
    "let MTKsidebarDestinations=$Cn(we),Te=MTKsidebarActionsCollapsed?[]:MTKsidebarDestinations",
    "MTKsidebarActionsCollapsed?null:(0,O4.jsx)(zTn,",
    '!E&&ve===`header_icon`?(0,O4.jsx)(eEn,{sidebarMode:se}):null,(0,O4.jsx)(MTKsidebarActionDisclosure7746,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "t[144]!==MTKsidebarActionsCollapsed",
    "t[144]=MTKsidebarActionsCollapsed,t[101]=Ue"
  ];
  if (value.includes("function MTKuseSidebarActionCollapse7746()")) {
    if (!build7746Markers.every(marker => value.includes(marker))) throw new Error("Unrecognized build-7746 sidebar collapse patch: partial markers");
    return "applied";
  }
  const markers = [
    'const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1"',
    "function MTKuseSidebarActionCollapse(",
    "function MTKsidebarActionDisclosure(",
    "let[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse()",
    "let se=MTKsidebarActionsCollapsed?[]:oe,ce;",
    '"aria-expanded":!e',
    'children:(0,x7.jsx)("path",{d:"M6 3.5 10.5 8 6 12.5",stroke:"currentColor"',
    'className:"cursor-pointer"',
    "MTKsidebarActionsCollapsed?null:",
    "MTKsidebarActionDisclosure,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions}"
  ];
  const present = markers.map(marker => value.includes(marker));
  if (value.includes('function MTKsidebarActionDisclosure7345(')) {
    const currentMarkers = [
      'const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1"',
      'function MTKuseSidebarActionCollapse7345()',
      'function MTKsidebarActionDisclosure7345(',
      'function MTKsidebarCollapsedDestinations7345(',
      'className:"cursor-pointer"',
      'let t=(0,b$c.c)(115),',
      '[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse7345()',
      'let be=MTKsidebarCollapsedDestinations7345(MTKsidebarActionsCollapsed,ye,x6.projects)',
      'MTKsidebarActionsCollapsed?null:(0,h7.jsx)(gMc,',
      '!T&&Oe===`header_icon`?(0,h7.jsx)(DMc,{sidebarMode:re}):null,(0,h7.jsx)(MTKsidebarActionDisclosure7345,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
      't[114]!==MTKsidebarActionsCollapsed',
      't[114]=MTKsidebarActionsCollapsed,t[109]=Ve'
    ];
    if (!currentMarkers.every(marker => value.includes(marker))) {
      throw new Error("Unrecognized build-7345 sidebar collapse patch: partial markers");
    }
    return "applied";
  }
  if (present.every(Boolean)) {
    const matches = profiles(value).filter(profile =>
      (profile.appliedOwners ?? [profile.appliedOwner]).some(owner => value.includes(owner))
    );
    if (matches.length !== 1) {
      throw new Error("Unrecognized sidebar collapse patch: memo cache size changed");
    }
    if (count(value, "function MTKuseSidebarActionCollapse(") !== 1 ||
        count(value, "function MTKsidebarActionDisclosure(") !== 1) {
      throw new Error("Unrecognized sidebar collapse patch: helper ownership is ambiguous");
    }
    if (!value.includes("t[93]=MTKsidebarActionsCollapsed,t[81]=ke")) {
      throw new Error("Unrecognized sidebar collapse patch: header memo dependency is missing");
    }
    if (!value.includes(`function MTKsidebarActionDisclosure({collapsed:e,onToggle:t}){let n=${matches[0].intlHook}()`)) {
      throw new Error("Unrecognized sidebar collapse patch: localization hook ownership changed");
    }
    return "applied";
  }
  if (present.some(Boolean)) throw new Error("Unrecognized sidebar collapse patch: partial markers");

  if (current8378Contracts().every(contract => value.includes(contract))) return "needs-apply";
  if (current8109Contracts().every(contract => value.includes(contract))) return "needs-apply";
  if (current7942Contracts().every(contract => value.includes(contract))) return "needs-apply";
  if (current7746Contracts().every(contract => value.includes(contract))) return "needs-apply";
  if (current7345Contracts().every(contract => value.includes(contract))) return "needs-apply";
  const matches = profiles(value).filter(profile => profile.contracts.every(contract => value.includes(contract)));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} sidebar ownership profiles`);
  for (const contract of matches[0].contracts) {
    if (!value.includes(contract)) throw new Error(`Upstream changed: missing sidebar contract ${contract}`);
  }
  return "needs-apply";
}

function patchSource(value) {
  if (value.includes('const MTK_SIDEBAR_ACTIONS_STORAGE_KEY=')) {
    let patched = value;
    if (!hasDisclosurePointerCursor(patched)) patched = addPointerCursor(patched);
    if (hasLegacyDisclosureOrder(patched)) patched = moveDisclosureLast(patched);
    if (patched !== value) return patched;
  }
  if (current8378Contracts().every(contract => value.includes(contract))) return patch8378(value);
  if (current8109Contracts().every(contract => value.includes(contract))) return patch8109(value);
  if (current7942Contracts().every(contract => value.includes(contract))) return patch7942(value);
  if (current7746Contracts().every(contract => value.includes(contract))) return patch7746(value);
  if (current7345Contracts().every(contract => value.includes(contract))) return patch7345(value);
  const candidates = profiles(value).filter(profile => profile.contracts.every(contract => value.includes(contract)));
  if (candidates.length !== 1) throw new Error(`Upstream changed: found ${candidates.length} sidebar ownership profiles`);
  const profile = candidates[0];
  let helper = String.raw`const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1";function MTKreadSidebarActionsCollapsed(){try{return localStorage.getItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY)==="1"}catch{return!1}}function MTKuseSidebarActionCollapse(){let[e,t]=(0,fql.useState)(MTKreadSidebarActionsCollapsed);return fql.useEffect(()=>{let e=e=>{e.key===MTK_SIDEBAR_ACTIONS_STORAGE_KEY&&t(MTKreadSidebarActionsCollapsed)};return addEventListener("storage",e),()=>removeEventListener("storage",e)},[]),[e,fql.useCallback(()=>{t(e=>{let t=!e;try{localStorage.setItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY,t?"1":"0")}catch{}return t})},[])]}function MTKsidebarActionDisclosure({collapsed:e,onToggle:t}){let n=vd(),r=n.formatMessage(e?{id:"sidebarElectron.globalActions.show",defaultMessage:"Show navigation actions",description:"Accessible label and tooltip for expanding the sidebar navigation action group"}:{id:"sidebarElectron.globalActions.hide",defaultMessage:"Hide navigation actions",description:"Accessible label and tooltip for collapsing the sidebar navigation action group"}),i=(0,x7.jsx)("svg",{"aria-hidden":!0,className:"icon-xs transition-transform "+(e?"":"rotate-90"),viewBox:"0 0 16 16",fill:"none",children:(0,x7.jsx)("path",{d:"M6 3.5 10.5 8 6 12.5",stroke:"currentColor",strokeWidth:1.5,strokeLinecap:"round",strokeLinejoin:"round"})});return(0,x7.jsx)(uI,{tooltipContent:r,children:(0,x7.jsx)(tX,{color:"ghost",size:"compact",uniform:!0,className:"cursor-pointer","aria-label":r,"aria-expanded":!e,onClick:t,children:i})})}`;
  for (const [before, after] of profile.helperReplacements) helper = replaceOnce(helper, before, after, `${profile.name} helper alias ${before}`);

  let patched = replaceOnce(value, profile.owner, `${helper}${profile.appliedOwner}`, "sidebar owner and helper seam");
  patched = replaceOnce(
    patched,
    profile.stateBefore,
    profile.stateAfter,
    "sidebar collapse state"
  );
  patched = replaceOnce(
    patched,
    "let se=oe,ce;t[29]!==G",
    "let se=MTKsidebarActionsCollapsed?[]:oe,ce;t[29]!==G",
    "global destination projection"
  );
  patched = replaceOnce(
    patched,
    profile.headerBefore,
    profile.headerAfter,
    "header disclosure insertion"
  );
  patched = replaceOnce(
    patched,
    profile.newChatBefore,
    `MTKsidebarActionsCollapsed?null:${profile.newChatBefore}`,
    "new chat row projection"
  );
  patched = replaceOnce(
    patched,
    "t[78]!==!1||t[79]!==ne||t[80]!==ee?(",
    "t[78]!==!1||t[79]!==ne||t[80]!==ee||t[93]!==MTKsidebarActionsCollapsed?(",
    "header memo dependency"
  );
  patched = replaceOnce(
    patched,
    "t[79]=ne,t[80]=ee,t[81]=ke)",
    "t[79]=ne,t[80]=ee,t[93]=MTKsidebarActionsCollapsed,t[81]=ke)",
    "header memo assignment"
  );
  return patched;
}

function current8378Contracts() {
  return [
    "function Nhr(e){let t=(0,Lhr.c)(144),",
    "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,",
    "t[60]=Te}else Te=t[60];let Ee=Te.length>0",
    '(0,A4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,A4.jsx)(FSn,{}),(0,A4.jsx)(Jq,{showCustomizeSidebarAction:je,children:(0,A4.jsx)(HOn,{})}),!E&&_e===`header_icon`?(0,A4.jsx)(kkn,{sidebarMode:se}):null]})',
    '(0,A4.jsx)(mkn,{showCustomizeSidebarAction:je,sidebarMode:se,showSearchNavItem:!1})',
    "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==_e||t[97]!==te||t[98]!==Me||t[99]!==je||t[100]!==se?(",
    "t[93]=m,t[94]=v,t[95]=E,t[96]=_e,t[97]=te,t[98]=Me,t[99]=je,t[100]=se,t[101]=He):He=t[101]"
  ];
}

function patch8378(value) {
  const helper = String.raw`const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1";function MTKreadSidebarActionsCollapsed8378(){try{return localStorage.getItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY)==="1"}catch{return!1}}function MTKuseSidebarActionCollapse8378(){let[e,t]=(0,k4.useState)(MTKreadSidebarActionsCollapsed8378);return k4.useEffect(()=>{let e=e=>{e.key===MTK_SIDEBAR_ACTIONS_STORAGE_KEY&&t(MTKreadSidebarActionsCollapsed8378())};return addEventListener("storage",e),()=>removeEventListener("storage",e)},[]),[e,k4.useCallback(()=>{t(e=>{let t=!e;try{localStorage.setItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY,t?"1":"0")}catch{}return t})},[])]}function MTKsidebarCollapsedDestinations8378(e,t,n){return e?t.filter(e=>e.id===n):t}function MTKsidebarActionDisclosure8378({collapsed:e,onToggle:t}){let n=JD(),r=n.formatMessage(e?{id:"sidebarElectron.globalActions.show",defaultMessage:"Show navigation actions",description:"Accessible label for expanding the sidebar navigation action group"}:{id:"sidebarElectron.globalActions.hide",defaultMessage:"Hide navigation actions",description:"Accessible label for collapsing the sidebar navigation action group"});return(0,A4.jsx)("button",{type:"button",title:r,"aria-label":r,"aria-expanded":!e,className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary",onClick:t,children:(0,A4.jsx)("svg",{"aria-hidden":!0,className:"icon-xs transition-transform "+(e?"":"rotate-90"),viewBox:"0 0 16 16",fill:"none",children:(0,A4.jsx)("path",{d:"M6 3.5 10.5 8 6 12.5",stroke:"currentColor",strokeWidth:1.5,strokeLinecap:"round",strokeLinejoin:"round"})})})}`;
  let patched = replaceOnce(value, "function Nhr(e){let t=(0,Lhr.c)(144),", `${addPointerCursor(helper)}function Nhr(e){let t=(0,Lhr.c)(145),`, "build-8378 sidebar owner");
  patched = replaceOnce(patched, "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,", "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse8378(),", "build-8378 sidebar state");
  patched = replaceOnce(patched, "t[60]=Te}else Te=t[60];let Ee=Te.length>0", "t[60]=Te}else Te=t[60];Te=MTKsidebarCollapsedDestinations8378(MTKsidebarActionsCollapsed,Te,Nx.projects);let Ee=Te.length>0", "build-8378 global destination projection");
  patched = replaceOnce(
    patched,
    '(0,A4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,A4.jsx)(FSn,{}),(0,A4.jsx)(Jq,{showCustomizeSidebarAction:je,children:(0,A4.jsx)(HOn,{})}),!E&&_e===`header_icon`?(0,A4.jsx)(kkn,{sidebarMode:se}):null]})',
    '(0,A4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,A4.jsx)(FSn,{}),(0,A4.jsx)(Jq,{showCustomizeSidebarAction:je,children:(0,A4.jsx)(HOn,{})}),!E&&_e===`header_icon`?(0,A4.jsx)(kkn,{sidebarMode:se}):null,(0,A4.jsx)(MTKsidebarActionDisclosure8378,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "build-8378 header disclosure"
  );
  patched = replaceOnce(patched, '(0,A4.jsx)(mkn,{showCustomizeSidebarAction:je,sidebarMode:se,showSearchNavItem:!1})', 'MTKsidebarActionsCollapsed?null:(0,A4.jsx)(mkn,{showCustomizeSidebarAction:je,sidebarMode:se,showSearchNavItem:!1})', "build-8378 global action block");
  patched = replaceOnce(patched, "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==_e||t[97]!==te||t[98]!==Me||t[99]!==je||t[100]!==se?(", "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==_e||t[97]!==te||t[98]!==Me||t[99]!==je||t[100]!==se||t[144]!==MTKsidebarActionsCollapsed?(", "build-8378 memo dependency");
  patched = replaceOnce(patched, "t[93]=m,t[94]=v,t[95]=E,t[96]=_e,t[97]=te,t[98]=Me,t[99]=je,t[100]=se,t[101]=He):He=t[101]", "t[93]=m,t[94]=v,t[95]=E,t[96]=_e,t[97]=te,t[98]=Me,t[99]=je,t[100]=se,t[144]=MTKsidebarActionsCollapsed,t[101]=He):He=t[101]", "build-8378 memo assignment");
  return patched;
}

function current8109Contracts() {
  return [
    "function par(e){let t=(0,_ar.c)(144),",
    "[S,C]=(0,j4.useState)(0)",
    "(0,j4.useLayoutEffect)(Me,Ne)",
    "j4=n($(),1)",
    "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,",
    "let De=$Sn(Ee),Oe;",
    '(0,M4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,M4.jsx)(tvn,{}),(0,M4.jsx)(GY,{showCustomizeSidebarAction:Pe,children:(0,M4.jsx)(Dwn,{})}),!E&&be===`header_icon`?(0,M4.jsx)(yTn,{sidebarMode:ce}):null]})',
    '(0,M4.jsx)(tTn,{showCustomizeSidebarAction:Pe,sidebarMode:ce,showSearchNavItem:!1})',
    "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==be||t[97]!==ne||t[98]!==Fe||t[99]!==Pe||t[100]!==ce?(",
    "t[93]=m,t[94]=v,t[95]=E,t[96]=be,t[97]=ne,t[98]=Fe,t[99]=Pe,t[100]=ce,t[101]=Ge):Ge=t[101]"
  ];
}

function patch8109(value) {
  const helper = String.raw`const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1";function MTKreadSidebarActionsCollapsed8109(){try{return localStorage.getItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY)==="1"}catch{return!1}}function MTKuseSidebarActionCollapse8109(){let[e,t]=(0,j4.useState)(MTKreadSidebarActionsCollapsed8109);return j4.useEffect(()=>{let e=e=>{e.key===MTK_SIDEBAR_ACTIONS_STORAGE_KEY&&t(MTKreadSidebarActionsCollapsed8109())};return addEventListener("storage",e),()=>removeEventListener("storage",e)},[]),[e,j4.useCallback(()=>{t(e=>{let t=!e;try{localStorage.setItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY,t?"1":"0")}catch{}return t})},[])]}function MTKsidebarCollapsedDestinations8109(e,t,n){return e?t.filter(e=>e.id===n):t}function MTKsidebarActionDisclosure8109({collapsed:e,onToggle:t}){let n=me(),r=n.formatMessage(e?{id:"sidebarElectron.globalActions.show",defaultMessage:"Show navigation actions",description:"Accessible label for expanding the sidebar navigation action group"}:{id:"sidebarElectron.globalActions.hide",defaultMessage:"Hide navigation actions",description:"Accessible label for collapsing the sidebar navigation action group"});return(0,M4.jsx)("button",{type:"button",title:r,"aria-label":r,"aria-expanded":!e,className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary",onClick:t,children:(0,M4.jsx)("svg",{"aria-hidden":!0,className:"icon-xs transition-transform "+(e?"":"rotate-90"),viewBox:"0 0 16 16",fill:"none",children:(0,M4.jsx)("path",{d:"M6 3.5 10.5 8 6 12.5",stroke:"currentColor",strokeWidth:1.5,strokeLinecap:"round",strokeLinejoin:"round"})})})}`;
  let patched = replaceOnce(value, "function par(e){let t=(0,_ar.c)(144),", `${addPointerCursor(helper)}function par(e){let t=(0,_ar.c)(145),`, "build-8109 sidebar owner");
  patched = replaceOnce(patched, "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,", "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse8109(),", "build-8109 sidebar state");
  patched = replaceOnce(patched, "let De=$Sn(Ee),Oe;", "let De=MTKsidebarCollapsedDestinations8109(MTKsidebarActionsCollapsed,$Sn(Ee),Hy.projects),Oe;", "build-8109 global destination projection");
  patched = replaceOnce(
    patched,
    '(0,M4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,M4.jsx)(tvn,{}),(0,M4.jsx)(GY,{showCustomizeSidebarAction:Pe,children:(0,M4.jsx)(Dwn,{})}),!E&&be===`header_icon`?(0,M4.jsx)(yTn,{sidebarMode:ce}):null]})',
    '(0,M4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,M4.jsx)(tvn,{}),(0,M4.jsx)(GY,{showCustomizeSidebarAction:Pe,children:(0,M4.jsx)(Dwn,{})}),!E&&be===`header_icon`?(0,M4.jsx)(yTn,{sidebarMode:ce}):null,(0,M4.jsx)(MTKsidebarActionDisclosure8109,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "build-8109 header disclosure"
  );
  patched = replaceOnce(patched, '(0,M4.jsx)(tTn,{showCustomizeSidebarAction:Pe,sidebarMode:ce,showSearchNavItem:!1})', 'MTKsidebarActionsCollapsed?null:(0,M4.jsx)(tTn,{showCustomizeSidebarAction:Pe,sidebarMode:ce,showSearchNavItem:!1})', "build-8109 global action block");
  patched = replaceOnce(patched, "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==be||t[97]!==ne||t[98]!==Fe||t[99]!==Pe||t[100]!==ce?(", "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==be||t[97]!==ne||t[98]!==Fe||t[99]!==Pe||t[100]!==ce||t[144]!==MTKsidebarActionsCollapsed?(", "build-8109 memo dependency");
  patched = replaceOnce(patched, "t[93]=m,t[94]=v,t[95]=E,t[96]=be,t[97]=ne,t[98]=Fe,t[99]=Pe,t[100]=ce,t[101]=Ge):Ge=t[101]", "t[93]=m,t[94]=v,t[95]=E,t[96]=be,t[97]=ne,t[98]=Fe,t[99]=Pe,t[100]=ce,t[144]=MTKsidebarActionsCollapsed,t[101]=Ge):Ge=t[101]", "build-8109 memo assignment");
  return patched;
}

function current7942Contracts() {
  return [
    "function dar(e){let t=(0,har.c)(144),",
    "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,",
    "let Te=ZSn(we),Ee;",
    '(0,N4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,N4.jsx)(Z_n,{}),(0,N4.jsx)(JY,{showCustomizeSidebarAction:Me,children:(0,N4.jsx)(Twn,{})}),!E&&ve===`header_icon`?(0,N4.jsx)(_Tn,{sidebarMode:ce}):null]})',
    '(0,N4.jsx)($wn,{showCustomizeSidebarAction:Me,sidebarMode:ce,showSearchNavItem:!1})',
    "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==ve||t[97]!==ne||t[98]!==Ne||t[99]!==Me||t[100]!==ce?(",
    "t[93]=m,t[94]=v,t[95]=E,t[96]=ve,t[97]=ne,t[98]=Ne,t[99]=Me,t[100]=ce,t[101]=Ue):Ue=t[101]"
  ];
}

function patch7942(value) {
  const helper = String.raw`const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1";function MTKreadSidebarActionsCollapsed7942(){try{return localStorage.getItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY)==="1"}catch{return!1}}function MTKuseSidebarActionCollapse7942(){let[e,t]=(0,M4.useState)(MTKreadSidebarActionsCollapsed7942);return M4.useEffect(()=>{let e=e=>{e.key===MTK_SIDEBAR_ACTIONS_STORAGE_KEY&&t(MTKreadSidebarActionsCollapsed7942())};return addEventListener("storage",e),()=>removeEventListener("storage",e)},[]),[e,M4.useCallback(()=>{t(e=>{let t=!e;try{localStorage.setItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY,t?"1":"0")}catch{}return t})},[])]}function MTKsidebarActionDisclosure7942({collapsed:e,onToggle:t}){let n=Vl(),r=n.formatMessage(e?{id:"sidebarElectron.globalActions.show",defaultMessage:"Show navigation actions",description:"Accessible label for expanding the sidebar navigation action group"}:{id:"sidebarElectron.globalActions.hide",defaultMessage:"Hide navigation actions",description:"Accessible label for collapsing the sidebar navigation action group"});return(0,N4.jsx)("button",{type:"button",title:r,"aria-label":r,"aria-expanded":!e,className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary",onClick:t,children:(0,N4.jsx)("svg",{"aria-hidden":!0,className:"icon-xs transition-transform "+(e?"":"rotate-90"),viewBox:"0 0 16 16",fill:"none",children:(0,N4.jsx)("path",{d:"M6 3.5 10.5 8 6 12.5",stroke:"currentColor",strokeWidth:1.5,strokeLinecap:"round",strokeLinejoin:"round"})})})}`;
  let patched = replaceOnce(value, "function dar(e){let t=(0,har.c)(144),", `${addPointerCursor(helper)}function dar(e){let t=(0,har.c)(145),`, "build-7942 sidebar owner");
  patched = replaceOnce(patched, "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,", "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse7942(),", "build-7942 sidebar state");
  patched = replaceOnce(patched, "let Te=ZSn(we),Ee;", "let MTKsidebarDestinations=ZSn(we),Te=MTKsidebarActionsCollapsed?[]:MTKsidebarDestinations,Ee;", "build-7942 global destination projection");
  patched = replaceOnce(
    patched,
    '(0,N4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,N4.jsx)(Z_n,{}),(0,N4.jsx)(JY,{showCustomizeSidebarAction:Me,children:(0,N4.jsx)(Twn,{})}),!E&&ve===`header_icon`?(0,N4.jsx)(_Tn,{sidebarMode:ce}):null]})',
    '(0,N4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,N4.jsx)(Z_n,{}),(0,N4.jsx)(JY,{showCustomizeSidebarAction:Me,children:(0,N4.jsx)(Twn,{})}),!E&&ve===`header_icon`?(0,N4.jsx)(_Tn,{sidebarMode:ce}):null,(0,N4.jsx)(MTKsidebarActionDisclosure7942,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "build-7942 header disclosure"
  );
  patched = replaceOnce(patched, '(0,N4.jsx)($wn,{showCustomizeSidebarAction:Me,sidebarMode:ce,showSearchNavItem:!1})', 'MTKsidebarActionsCollapsed?null:(0,N4.jsx)($wn,{showCustomizeSidebarAction:Me,sidebarMode:ce,showSearchNavItem:!1})', "build-7942 new-chat row");
  patched = replaceOnce(patched, "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==ve||t[97]!==ne||t[98]!==Ne||t[99]!==Me||t[100]!==ce?(", "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==ve||t[97]!==ne||t[98]!==Ne||t[99]!==Me||t[100]!==ce||t[144]!==MTKsidebarActionsCollapsed?(", "build-7942 header memo dependency");
  patched = replaceOnce(patched, "t[93]=m,t[94]=v,t[95]=E,t[96]=ve,t[97]=ne,t[98]=Ne,t[99]=Me,t[100]=ce,t[101]=Ue):Ue=t[101]", "t[93]=m,t[94]=v,t[95]=E,t[96]=ve,t[97]=ne,t[98]=Ne,t[99]=Me,t[100]=ce,t[144]=MTKsidebarActionsCollapsed,t[101]=Ue):Ue=t[101]", "build-7942 header memo assignment");
  return patched;
}

function current7746Contracts() {
  return [
    "function ear(e){let t=(0,iar.c)(144),",
    "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,",
    "let Te=$Cn(we),Ee;",
    '(0,O4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,O4.jsx)(uyn,{}),(0,O4.jsx)(yJ,{showCustomizeSidebarAction:Me,children:(0,O4.jsx)(pTn,{})}),!E&&ve===`header_icon`?(0,O4.jsx)(eEn,{sidebarMode:se}):null]})',
    '(0,O4.jsx)(zTn,{showCustomizeSidebarAction:Me,sidebarMode:se,showSearchNavItem:!1})',
    "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==ve||t[97]!==te||t[98]!==Ne||t[99]!==Me||t[100]!==se?(",
    "t[93]=m,t[94]=v,t[95]=E,t[96]=ve,t[97]=te,t[98]=Ne,t[99]=Me,t[100]=se,t[101]=Ue):Ue=t[101]"
  ];
}

function patch7746(value) {
  const helper = String.raw`const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1";function MTKreadSidebarActionsCollapsed7746(){try{return localStorage.getItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY)==="1"}catch{return!1}}function MTKuseSidebarActionCollapse7746(){let[e,t]=(0,D4.useState)(MTKreadSidebarActionsCollapsed7746);return D4.useEffect(()=>{let e=e=>{e.key===MTK_SIDEBAR_ACTIONS_STORAGE_KEY&&t(MTKreadSidebarActionsCollapsed7746())};return addEventListener("storage",e),()=>removeEventListener("storage",e)},[]),[e,D4.useCallback(()=>{t(e=>{let t=!e;try{localStorage.setItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY,t?"1":"0")}catch{}return t})},[])]}function MTKsidebarActionDisclosure7746({collapsed:e,onToggle:t}){let n=Aa(),r=n.formatMessage(e?{id:"sidebarElectron.globalActions.show",defaultMessage:"Show navigation actions",description:"Accessible label for expanding the sidebar navigation action group"}:{id:"sidebarElectron.globalActions.hide",defaultMessage:"Hide navigation actions",description:"Accessible label for collapsing the sidebar navigation action group"});return(0,O4.jsx)("button",{type:"button",title:r,"aria-label":r,"aria-expanded":!e,className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary",onClick:t,children:(0,O4.jsx)("svg",{"aria-hidden":!0,className:"icon-xs transition-transform "+(e?"":"rotate-90"),viewBox:"0 0 16 16",fill:"none",children:(0,O4.jsx)("path",{d:"M6 3.5 10.5 8 6 12.5",stroke:"currentColor",strokeWidth:1.5,strokeLinecap:"round",strokeLinejoin:"round"})})})}`;
  let patched = replaceOnce(value, "function ear(e){let t=(0,iar.c)(144),", `${addPointerCursor(helper)}function ear(e){let t=(0,iar.c)(145),`, "build-7746 sidebar owner");
  patched = replaceOnce(patched, "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,", "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse7746(),", "build-7746 sidebar state");
  patched = replaceOnce(patched, "let Te=$Cn(we),Ee;", "let MTKsidebarDestinations=$Cn(we),Te=MTKsidebarActionsCollapsed?[]:MTKsidebarDestinations,Ee;", "build-7746 global destination projection");
  patched = replaceOnce(
    patched,
    '(0,O4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,O4.jsx)(uyn,{}),(0,O4.jsx)(yJ,{showCustomizeSidebarAction:Me,children:(0,O4.jsx)(pTn,{})}),!E&&ve===`header_icon`?(0,O4.jsx)(eEn,{sidebarMode:se}):null]})',
    '(0,O4.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,O4.jsx)(uyn,{}),(0,O4.jsx)(yJ,{showCustomizeSidebarAction:Me,children:(0,O4.jsx)(pTn,{})}),!E&&ve===`header_icon`?(0,O4.jsx)(eEn,{sidebarMode:se}):null,(0,O4.jsx)(MTKsidebarActionDisclosure7746,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "build-7746 header disclosure"
  );
  patched = replaceOnce(patched, '(0,O4.jsx)(zTn,{showCustomizeSidebarAction:Me,sidebarMode:se,showSearchNavItem:!1})', 'MTKsidebarActionsCollapsed?null:(0,O4.jsx)(zTn,{showCustomizeSidebarAction:Me,sidebarMode:se,showSearchNavItem:!1})', "build-7746 new-chat row");
  patched = replaceOnce(patched, "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==ve||t[97]!==te||t[98]!==Ne||t[99]!==Me||t[100]!==se?(", "t[93]!==m||t[94]!==v||t[95]!==E||t[96]!==ve||t[97]!==te||t[98]!==Ne||t[99]!==Me||t[100]!==se||t[144]!==MTKsidebarActionsCollapsed?(", "build-7746 header memo dependency");
  patched = replaceOnce(patched, "t[93]=m,t[94]=v,t[95]=E,t[96]=ve,t[97]=te,t[98]=Ne,t[99]=Me,t[100]=se,t[101]=Ue):Ue=t[101]", "t[93]=m,t[94]=v,t[95]=E,t[96]=ve,t[97]=te,t[98]=Ne,t[99]=Me,t[100]=se,t[144]=MTKsidebarActionsCollapsed,t[101]=Ue):Ue=t[101]", "build-7746 header memo assignment");
  return patched;
}

function current7345Contracts() {
  return [
    "function g$c(e){",
    '(0,h7.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,h7.jsx)(xEc,{}),(0,h7.jsx)(VEc,{showCustomizeSidebarAction:Ee,children:(0,h7.jsx)(qjc,{})}),!T&&Oe===`header_icon`?(0,h7.jsx)(DMc,{sidebarMode:re}):null]})',
    '(0,h7.jsx)(gMc,{showCustomizeSidebarAction:Ee,sidebarMode:re,showSearchNavItem:!1})',
    "t[107]!==le||t[108]!==se?(",
    "t[107]=le,t[108]=se,t[109]=Ve):Ve=t[109]"
  ];
}

function patch7345(value) {
  const helper = String.raw`const MTK_SIDEBAR_ACTIONS_STORAGE_KEY="the-mechanics-toolkit:sidebar-global-actions-collapsed:v1";function MTKreadSidebarActionsCollapsed7345(){try{return localStorage.getItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY)==="1"}catch{return!1}}function MTKuseSidebarActionCollapse7345(){let[e,t]=(0,x$c.useState)(MTKreadSidebarActionsCollapsed7345);return x$c.useEffect(()=>{let e=e=>{e.key===MTK_SIDEBAR_ACTIONS_STORAGE_KEY&&t(MTKreadSidebarActionsCollapsed7345)};return addEventListener("storage",e),()=>removeEventListener("storage",e)},[]),[e,x$c.useCallback(()=>{t(e=>{let t=!e;try{localStorage.setItem(MTK_SIDEBAR_ACTIONS_STORAGE_KEY,t?"1":"0")}catch{}return t})},[])]}function MTKsidebarCollapsedDestinations7345(e,t,n){return e?t.filter(e=>e.id===n):t}function MTKsidebarActionDisclosure7345({collapsed:e,onToggle:t}){let n=Gc(),r=n.formatMessage(e?{id:"sidebarElectron.globalActions.show",defaultMessage:"Show navigation actions",description:"Accessible label and tooltip for expanding the sidebar navigation action group"}:{id:"sidebarElectron.globalActions.hide",defaultMessage:"Hide navigation actions",description:"Accessible label and tooltip for collapsing the sidebar navigation action group"}),i=(0,h7.jsx)("svg",{"aria-hidden":!0,className:"icon-xs transition-transform "+(e?"":"rotate-90"),viewBox:"0 0 16 16",fill:"none",children:(0,h7.jsx)("path",{d:"M6 3.5 10.5 8 6 12.5",stroke:"currentColor",strokeWidth:1.5,strokeLinecap:"round",strokeLinejoin:"round"})}),a=(0,h7.jsx)(hR,{"aria-label":r,"aria-expanded":!e,color:"ghost",size:"compact",uniform:!0,onClick:t,children:i});return(0,h7.jsx)(nz,{side:"bottom",tooltipContent:r,children:a})}`;
  const owners = [...value.matchAll(/function g\$c\(e\)\{(?:MTKusePaletteBootstrap\(\);)?let t=\(0,b\$c\.c\)\(114\),/g)];
  if (owners.length !== 1) throw new Error(`Upstream changed: found ${owners.length} build-7345 sidebar owners`);
  const owner = owners[0][0];
  let patched = replaceOnce(value, owner, addPointerCursor(helper) + owner.replace("(114),", "(115),"), "build-7345 sidebar owner");
  patched = replaceOnce(patched, "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,", "{desktopNavItemsEnabled:n,sidebarTriggerState:r}=e,[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse7345(),", "build-7345 sidebar state");
  patched = replaceOnce(patched, "let be=ye,xe=be.length>0", "let be=MTKsidebarCollapsedDestinations7345(MTKsidebarActionsCollapsed,ye,x6.projects),xe=be.length>0", "build-7345 global destination projection");
  patched = replaceOnce(
    patched,
    '(0,h7.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,h7.jsx)(xEc,{}),(0,h7.jsx)(VEc,{showCustomizeSidebarAction:Ee,children:(0,h7.jsx)(qjc,{})}),!T&&Oe===`header_icon`?(0,h7.jsx)(DMc,{sidebarMode:re}):null]})',
    '(0,h7.jsxs)(`div`,{className:`ms-auto flex items-center gap-1`,children:[(0,h7.jsx)(xEc,{}),(0,h7.jsx)(VEc,{showCustomizeSidebarAction:Ee,children:(0,h7.jsx)(qjc,{})}),!T&&Oe===`header_icon`?(0,h7.jsx)(DMc,{sidebarMode:re}):null,(0,h7.jsx)(MTKsidebarActionDisclosure7345,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})]})',
    "build-7345 header disclosure"
  );
  patched = replaceOnce(patched, '(0,h7.jsx)(gMc,{showCustomizeSidebarAction:Ee,sidebarMode:re,showSearchNavItem:!1})', 'MTKsidebarActionsCollapsed?null:(0,h7.jsx)(gMc,{showCustomizeSidebarAction:Ee,sidebarMode:re,showSearchNavItem:!1})', "build-7345 global action block");
  patched = replaceOnce(patched, "t[107]!==le||t[108]!==se?(", "t[107]!==le||t[108]!==se||t[114]!==MTKsidebarActionsCollapsed?(", "build-7345 memo dependency");
  patched = replaceOnce(patched, "t[107]=le,t[108]=se,t[109]=Ve):Ve=t[109]", "t[107]=le,t[108]=se,t[114]=MTKsidebarActionsCollapsed,t[109]=Ve):Ve=t[109]", "build-7345 memo assignment");
  return patched;
}

function profiles(value) {
  const common = ["let se=oe,ce;", "defaultMessage:`Projects`", "defaultMessage:`New chat`", "defaultMessage:`Pull requests`", "defaultMessage:`Sites`", "defaultMessage:`Scheduled`", "defaultMessage:`Plugins`"];
  return [
    {
      name: "26.818.21641-6849",
      owner: "function cql(e){let t=(0,dql.c)(93),",
      appliedOwner: "function cql(e){let t=(0,dql.c)(94),",
      stateBefore: "L2();let[w,T]=(0,fql.useState)(!1),E=w,",
      stateAfter: "L2();let[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse(),[w,T]=(0,fql.useState)(!1),E=w,",
      headerBefore: '(0,x7.jsx)(Jgl,{}),(0,x7.jsx)(dvl,{showCustomizeSidebarAction:ve,children:(0,x7.jsx)(Bxl,{})})',
      headerAfter: '(0,x7.jsx)(Jgl,{}),(0,x7.jsx)(dvl,{showCustomizeSidebarAction:ve,children:(0,x7.jsx)(Bxl,{})}),(0,x7.jsx)(MTKsidebarActionDisclosure,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})',
      newChatBefore: '(0,x7.jsx)(lSl,{chatGptFeatureAccessStatus:l,showCustomizeSidebarAction:ve,sidebarMode:W,showSearchNavItem:!1})',
      helperReplacements: [],
      intlHook: "vd",
      contracts: ["function cql(e){let t=(0,dql.c)(93),", "let ae=Yyl(ie),oe;", '(0,x7.jsx)(lSl,{chatGptFeatureAccessStatus:l,showCustomizeSidebarAction:ve,sidebarMode:W,showSearchNavItem:!1})', ...common]
    },
    {
      name: "26.818.31338-6892",
      owner: "function lJl(e){let t=(0,fJl.c)(93),",
      appliedOwner: "function lJl(e){let t=(0,fJl.c)(94),",
      stateBefore: "L2();let[w,T]=(0,pJl.useState)(!1),E=w,",
      stateAfter: "L2();let[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse(),[w,T]=(0,pJl.useState)(!1),E=w,",
      headerBefore: '(0,x7.jsx)(Q_l,{}),(0,x7.jsx)(hyl,{showCustomizeSidebarAction:ve,children:(0,x7.jsx)(WSl,{})})',
      headerAfter: '(0,x7.jsx)(Q_l,{}),(0,x7.jsx)(hyl,{showCustomizeSidebarAction:ve,children:(0,x7.jsx)(WSl,{})}),(0,x7.jsx)(MTKsidebarActionDisclosure,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})',
      newChatBefore: '(0,x7.jsx)(pCl,{chatGptFeatureAccessStatus:l,showCustomizeSidebarAction:ve,sidebarMode:W,showSearchNavItem:!1})',
      helperReplacements: [["fql.useState", "pJl.useState"], ["fql.useEffect", "pJl.useEffect"], ["fql.useCallback", "pJl.useCallback"], ["vd()", "hd()"], ["(0,x7.jsx)(uI", "(0,x7.jsx)(aI"], ["(0,x7.jsx)(tX", "(0,x7.jsx)(nX"]],
      intlHook: "hd",
      contracts: ["function lJl(e){let t=(0,fJl.c)(93),", "let ae=$bl(ie),oe;", "defaultMessage:`Library`", "defaultMessage:`Security`", '(0,x7.jsx)(pCl,{chatGptFeatureAccessStatus:l,showCustomizeSidebarAction:ve,sidebarMode:W,showSearchNavItem:!1})', ...common]
    },
    {
      name: "26.818.41509-6962",
      owner: "function hYl(e){let t=(0,vYl.c)(93),",
      appliedOwner: "function hYl(e){let t=(0,vYl.c)(94),",
      stateBefore: "s4();let[w,T]=(0,yYl.useState)(!1),E=w,",
      stateAfter: "s4();let[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse(),[w,T]=(0,yYl.useState)(!1),E=w,",
      headerBefore: '(0,x7.jsx)(iyl,{}),(0,x7.jsx)(xbl,{showCustomizeSidebarAction:ve,children:(0,x7.jsx)(XCl,{})})',
      headerAfter: '(0,x7.jsx)(iyl,{}),(0,x7.jsx)(xbl,{showCustomizeSidebarAction:ve,children:(0,x7.jsx)(XCl,{})}),(0,x7.jsx)(MTKsidebarActionDisclosure,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})',
      newChatBefore: '(0,x7.jsx)(ywl,{chatGptFeatureAccessStatus:l,showCustomizeSidebarAction:ve,sidebarMode:W,showSearchNavItem:!1})',
      helperReplacements: [["fql.useState", "yYl.useState"], ["fql.useEffect", "yYl.useEffect"], ["fql.useCallback", "yYl.useCallback"], ["vd()", "_d()"], ["(0,x7.jsx)(tX", "(0,x7.jsx)(aX"]],
      intlHook: "_d",
      contracts: ["function hYl(e){let t=(0,vYl.c)(93),", "let ae=aSl(ie),oe;", "defaultMessage:`Library`", "defaultMessage:`Security`", '(0,x7.jsx)(ywl,{chatGptFeatureAccessStatus:l,showCustomizeSidebarAction:ve,sidebarMode:W,showSearchNavItem:!1})', ...common]
    },
    {
      name: "26.818.41509-6962-after-palette",
      owner: "function hYl(e){MTKusePaletteBootstrap();let t=(0,vYl.c)(93),",
      appliedOwner: "function hYl(e){MTKusePaletteBootstrap();let t=(0,vYl.c)(94),",
      appliedOwners: [
        "function hYl(e){MTKusePaletteBootstrap();let t=(0,vYl.c)(94),",
        "function hYl(e){MTKuseAttentionBootstrap();MTKusePaletteBootstrap();let t=(0,vYl.c)(94),"
      ],
      stateBefore: "s4();let[w,T]=(0,yYl.useState)(!1),E=w,",
      stateAfter: "s4();let[MTKsidebarActionsCollapsed,MTKtoggleSidebarActions]=MTKuseSidebarActionCollapse(),[w,T]=(0,yYl.useState)(!1),E=w,",
      headerBefore: '(0,x7.jsx)(iyl,{}),(0,x7.jsx)(xbl,{showCustomizeSidebarAction:ve,children:(0,x7.jsx)(XCl,{})})',
      headerAfter: '(0,x7.jsx)(iyl,{}),(0,x7.jsx)(xbl,{showCustomizeSidebarAction:ve,children:(0,x7.jsx)(XCl,{})}),(0,x7.jsx)(MTKsidebarActionDisclosure,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})',
      newChatBefore: '(0,x7.jsx)(ywl,{chatGptFeatureAccessStatus:l,showCustomizeSidebarAction:ve,sidebarMode:W,showSearchNavItem:!1})',
      helperReplacements: [["fql.useState", "yYl.useState"], ["fql.useEffect", "yYl.useEffect"], ["fql.useCallback", "yYl.useCallback"], ["vd()", "_d()"], ["(0,x7.jsx)(tX", "(0,x7.jsx)(aX"]],
      intlHook: "_d",
      contracts: ["function hYl(e){MTKusePaletteBootstrap();let t=(0,vYl.c)(93),", "let ae=aSl(ie),oe;", "defaultMessage:`Library`", "defaultMessage:`Security`", '(0,x7.jsx)(ywl,{chatGptFeatureAccessStatus:l,showCustomizeSidebarAction:ve,sidebarMode:W,showSearchNavItem:!1})', ...common]
    }
  ];
}

function uniqueAsset(pattern) {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) {
    throw new Error(`Missing extracted assets directory: ${assets}`);
  }
  const matches = fs.readdirSync(assets).filter(name => pattern.test(name));
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} assets matching ${pattern}`);
  return path.join(assets, matches[0]);
}

function uniqueOwnershipAsset() {
  if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) throw new Error(`Missing extracted assets directory: ${assets}`);
  const candidates = fs.readdirSync(assets).filter(name => /^app-(?:initial|primary)-.*\.js$/.test(name));
  const matches = candidates.filter(name => {
    const value = fs.readFileSync(path.join(assets, name), "utf8");
    return current8378Contracts().every(contract => value.includes(contract)) ||
      current7942Contracts().every(contract => value.includes(contract)) ||
      current8109Contracts().every(contract => value.includes(contract)) ||
      value.includes("function Nhr(e){let t=(0,Lhr.c)(145),") ||
      value.includes("function par(e){let t=(0,_ar.c)(145),") ||
      value.includes("function dar(e){let t=(0,har.c)(145),") ||
      value.includes("function ear(e){let t=(0,iar.c)(144),") ||
      value.includes("function ear(e){let t=(0,iar.c)(145),") ||
      current7345Contracts().every(contract => value.includes(contract)) ||
      profiles(value).some(profile => profile.contracts.every(contract => value.includes(contract)) || (profile.appliedOwners ?? [profile.appliedOwner]).some(owner => value.includes(owner)));
  });
  if (matches.length !== 1) throw new Error(`Upstream changed: found ${matches.length} sidebar ownership assets`);
  return path.join(assets, matches[0]);
}

function replaceOnce(value, before, after, label) {
  const first = value.indexOf(before);
  if (first < 0 || value.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Upstream changed: ${label} is not unique`);
  }
  return value.slice(0, first) + after + value.slice(first + before.length);
}

function addPointerCursor(value) {
  const nativeButton = '"aria-expanded":!e,className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary",onClick:t';
  if (value.includes(nativeButton)) {
    return replaceOnce(value, nativeButton, '"aria-expanded":!e,className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary cursor-pointer",onClick:t', "sidebar disclosure pointer cursor");
  }
  if (value.includes("function MTKsidebarActionDisclosure7345(")) {
    return replaceOnce(value, 'color:"ghost",size:"compact",uniform:!0,onClick:t,children:i', 'color:"ghost",size:"compact",uniform:!0,className:"cursor-pointer",onClick:t,children:i', "build-7345 disclosure pointer cursor");
  }
  return replaceOnce(value, 'color:"ghost",size:"compact",uniform:!0,"aria-label":r,"aria-expanded":!e,onClick:t', 'color:"ghost",size:"compact",uniform:!0,className:"cursor-pointer","aria-label":r,"aria-expanded":!e,onClick:t', "sidebar disclosure pointer cursor");
}

function hasDisclosurePointerCursor(value) {
  if (["8378", "8109", "7942", "7746"].some(build => value.includes(`function MTKsidebarActionDisclosure${build}(`))) {
    return value.includes('"aria-expanded":!e,className:"flex size-8 items-center justify-center rounded-md text-secondary hover:bg-tertiary hover:text-primary cursor-pointer",onClick:t');
  }
  if (value.includes("function MTKsidebarActionDisclosure7345(")) {
    return value.includes('color:"ghost",size:"compact",uniform:!0,className:"cursor-pointer",onClick:t,children:i');
  }
  return value.includes('color:"ghost",size:"compact",uniform:!0,className:"cursor-pointer","aria-label":r,"aria-expanded":!e,onClick:t');
}

function disclosureOrders() {
  return [
    [
      '(0,A4.jsx)(MTKsidebarActionDisclosure8378,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions}),!E&&_e===`header_icon`?(0,A4.jsx)(kkn,{sidebarMode:se}):null',
      '!E&&_e===`header_icon`?(0,A4.jsx)(kkn,{sidebarMode:se}):null,(0,A4.jsx)(MTKsidebarActionDisclosure8378,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})'
    ],
    [
      '(0,M4.jsx)(MTKsidebarActionDisclosure8109,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions}),!E&&be===`header_icon`?(0,M4.jsx)(yTn,{sidebarMode:ce}):null',
      '!E&&be===`header_icon`?(0,M4.jsx)(yTn,{sidebarMode:ce}):null,(0,M4.jsx)(MTKsidebarActionDisclosure8109,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})'
    ],
    [
      '(0,N4.jsx)(MTKsidebarActionDisclosure7942,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions}),!E&&ve===`header_icon`?(0,N4.jsx)(_Tn,{sidebarMode:ce}):null',
      '!E&&ve===`header_icon`?(0,N4.jsx)(_Tn,{sidebarMode:ce}):null,(0,N4.jsx)(MTKsidebarActionDisclosure7942,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})'
    ],
    [
      '(0,O4.jsx)(MTKsidebarActionDisclosure7746,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions}),!E&&ve===`header_icon`?(0,O4.jsx)(eEn,{sidebarMode:se}):null',
      '!E&&ve===`header_icon`?(0,O4.jsx)(eEn,{sidebarMode:se}):null,(0,O4.jsx)(MTKsidebarActionDisclosure7746,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})'
    ],
    [
      '(0,h7.jsx)(MTKsidebarActionDisclosure7345,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions}),!T&&Oe===`header_icon`?(0,h7.jsx)(DMc,{sidebarMode:re}):null',
      '!T&&Oe===`header_icon`?(0,h7.jsx)(DMc,{sidebarMode:re}):null,(0,h7.jsx)(MTKsidebarActionDisclosure7345,{collapsed:MTKsidebarActionsCollapsed,onToggle:MTKtoggleSidebarActions})'
    ]
  ];
}

function hasLegacyDisclosureOrder(value) {
  return disclosureOrders().some(([legacy]) => value.includes(legacy));
}

function moveDisclosureLast(value) {
  const matches = disclosureOrders().filter(([legacy]) => value.includes(legacy));
  if (matches.length !== 1) throw new Error(`Unrecognized sidebar disclosure order: found ${matches.length} legacy layouts`);
  return replaceOnce(value, matches[0][0], matches[0][1], "sidebar disclosure final position");
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
