export const linuxBuild8881 = {
  app: {
    name: "26.908.40834-8881-linux",
    marker: "hV=wm(Q,",
    seam: "function Jcs(){let e=(0,Zcs.c)(12),",
    patchedSeam: "function Jcs(){MTKusePaletteBootstrap();let e=(0,Zcs.c)(12),",
    fixedOwnerRoot: true,
    helperReplacements: [
      ["A_($)", "gm(Q)"],
      ["x$c.useEffect", "Qcs.useEffect"],
      ["e.get($g)", "e.get(b6)"],
      ["e($g)", "e(b6)"],
      ['Qg(e,"local")', 'P6(e,"local")']
    ]
  },
  archive: {
    owner: "function d6t({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
    applied: [
      "globalThis.__MTKsidebarArchiveProtected=MTKsidebarArchiveProtected",
      "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function d6t(",
      "archive:D||MTKsidebarArchiveProtected(_)?void 0:{id:`archive-thread`,message:void 0,onSelect:()=>{i()}}",
      "function E6t({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
      "archiveProtected:K1t(T,r).some(e=>{let t=T.get(hg,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
      "archiveProtected:K1t(ee,e).some(e=>{let t=ee.get(hg,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})",
      "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Oe||B)?Pe:t",
      "He=Ce&&!MTKsidebarArchiveProtected(se)?Me:null",
      "if(Ce&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
      "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:te&&!MTKsidebarArchiveProtected(e.task.id)?e=>d(["
    ],
    pristine: [
      "archive:D?void 0:{id:`archive-thread`,message:void 0,onSelect:()=>{i()}}",
      "function E6t({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
      "selectedThreadKeys:K1t(T,r),threadKey:r})",
      "selectedThreadKeys:K1t(ee,e),threadKey:e})",
      "archive:t!=null&&(Oe||B)?Pe:t",
      "He=Ce?Me:null",
      "if(Ce&&e.push({id:`archive-task`",
      "archive:n,getMenuItems:te?e=>d(["
    ],
    replacements: [
      [
        "function d6t({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
        "const MTKsidebarArchiveProtected=e=>globalThis.__MTKsidebarArchiveProtected?.(e)===!0;function d6t({scope:e,target:t,actions:n,onRename:r,onArchive:i,",
        "Linux build-8881 archive classifier bridge"
      ],
      [
        "archive:D?void 0:{id:`archive-thread`,message:void 0,onSelect:()=>{i()}}",
        "archive:D||MTKsidebarArchiveProtected(_)?void 0:{id:`archive-thread`,message:void 0,onSelect:()=>{i()}}",
        "Linux build-8881 local context archive item"
      ],
      [
        "function E6t({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i}){return r.length<2?e:",
        "function E6t({items:e,onArchive:t,onSelect:n,selectedThreadKeys:r,threadKey:i,archiveProtected:a}){return a&&(e=e.filter(e=>e.id!==`archive-thread`&&e.id!==`archive-task`)),r.length<2?e:",
        "Linux build-8881 bulk archive filter"
      ],
      [
        "selectedThreadKeys:K1t(T,r),threadKey:r})",
        "selectedThreadKeys:K1t(T,r),threadKey:r,archiveProtected:K1t(T,r).some(e=>{let t=T.get(hg,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
        "Linux build-8881 local protected selection"
      ],
      [
        "selectedThreadKeys:K1t(ee,e),threadKey:e})",
        "selectedThreadKeys:K1t(ee,e),threadKey:e,archiveProtected:K1t(ee,e).some(e=>{let t=ee.get(hg,e),n=t?.kind===`local`?t.conversationId:t?.kind===`remote`?t.task.id:null;return MTKsidebarArchiveProtected(n)})})",
        "Linux build-8881 unified protected selection"
      ],
      [
        "archive:t!=null&&(Oe||B)?Pe:t,getMenuItems:",
        "archive:MTKsidebarArchiveProtected(n)?null:t!=null&&(Oe||B)?Pe:t,getMenuItems:",
        "Linux build-8881 local inline archive"
      ],
      ["He=Ce?Me:null", "He=Ce&&!MTKsidebarArchiveProtected(se)?Me:null", "Linux build-8881 cloud inline archive"],
      [
        "if(Ce&&e.push({id:`archive-task`",
        "if(Ce&&!MTKsidebarArchiveProtected(se)&&e.push({id:`archive-task`",
        "Linux build-8881 cloud context archive item"
      ],
      [
        "archive:n,getMenuItems:te?e=>d([",
        "archive:MTKsidebarArchiveProtected(e.task.id)?null:n,getMenuItems:te&&!MTKsidebarArchiveProtected(e.task.id)?e=>d([",
        "Linux build-8881 remote row archive"
      ]
    ]
  },
  local: {
    name: "26.908.40834-8881-linux",
    cacheBefore: "function rc(e){let t=(0,uc.c)(93),",
    cacheAfter: "function rc(e){let t=(0,uc.c)(94),",
    rootBefore: 't[76]!==G||t[77]!==K||t[78]!==q||t[79]!==se||t[80]!==ce||t[81]!==ue||t[82]!==de||t[83]!==fe||t[84]!==pe||t[85]!==me||t[86]!==ge||t[87]!==_e||t[88]!==ve?(ye=(0,Q.jsxs)(`div`,{ref:te,className:`relative h-full min-h-0`,children:[G,K,q,se,ce,le,ue,de,fe,pe,me,ge,_e,ve]}),t[76]=G,t[77]=K,t[78]=q,t[79]=se,t[80]=ce,t[81]=ue,t[82]=de,t[83]=fe,t[84]=pe,t[85]=me,t[86]=ge,t[87]=_e,t[88]=ve,t[89]=ye):ye=t[89];',
    rootAfter: 't[76]!==G||t[77]!==K||t[78]!==q||t[79]!==se||t[80]!==ce||t[81]!==ue||t[82]!==de||t[83]!==fe||t[84]!==pe||t[85]!==me||t[86]!==ge||t[87]!==_e||t[88]!==ve||t[93]!==r?(ye=(0,Q.jsxs)(`div`,{ref:te,"data-mtk-palette-room-host":!0,"data-mtk-palette-thread-id":r,className:`relative h-full min-h-0`,children:[G,K,q,se,ce,le,ue,de,fe,pe,me,ge,_e,ve]}),t[76]=G,t[77]=K,t[78]=q,t[79]=se,t[80]=ce,t[81]=ue,t[82]=de,t[83]=fe,t[84]=pe,t[85]=me,t[86]=ge,t[87]=_e,t[88]=ve,t[93]=r,t[89]=ye):ye=t[89];'
  }
};
