export const linuxBuild8881 = {
  dynamic: {
    owner: "function Cz(",
    renderer: "Ih(o)?.render?.(o,l,i,c)",
    before: "function Cz(e){let t=(0,wz.c)(16),{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s}=e,c=a===void 0||a,l=s===void 0?`row`:s;if(Bn(`off`,n)===`stopped`)return null;let u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l?(u=Ih(o)?.render?.(o,l,i,c),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[4]=u):u=t[4]",
    after: "function Cz(e){let t=(0,wz.c)(17),{conversationId:n,enableTimelineTargets:r,agentActivityIcon:i,isLeadingSummaryPart:a,item:o,variant:s,sourceTurnId:h}=e,c=a===void 0||a,l=s===void 0?`row`:s;if(Bn(`off`,n)===`stopped`)return null;let u;t[0]!==i||t[1]!==c||t[2]!==o||t[3]!==l||t[16]!==h?(u=Ih(o)?.render?.(o,l,i,c,{conversationId:n,turnId:h}),t[0]=i,t[1]=c,t[2]=o,t[3]=l,t[16]=h,t[4]=u):u=t[4]",
    call: "(e=(0,$.jsx)(Cz,{agentActivityIcon:Y,conversationId:d,enableTimelineTargets:Se,item:n}),t[354]=Y,t[355]=d,t[356]=Se,t[357]=n,t[358]=e)",
    parentBefore: "function NW(e){let t=(0,JW.c)(371),",
    parentAfter: "function NW(e){let t=(0,JW.c)(372),",
    parentTurn: "turnId:C,",
    callDependencyBefore: "t[357]!==n?",
    callDependencyAfter: "t[357]!==n||t[371]!==C?",
    callBodyBefore: "enableTimelineTargets:Se,item:n}",
    callBodyAfter: "enableTimelineTargets:Se,item:n,sourceTurnId:C}",
    callStorageBefore: "t[357]=n,t[358]=e",
    callStorageAfter: "t[357]=n,t[371]=C,t[358]=e",
    helperBoundary: "function Cz(",
    react: "t(r(),1)",
    jsx: "Tz"
  },
  taskImports: {
    appRoot: "function Jcs(){",
    taskOwner: "hV=wm(Q,",
    storeHook: "Lm",
    storeScope: "Q",
    taskAtom: "hV",
    localThreadKey: "TA",
    remoteThreadKey: "EA",
    titleAtom: "G2t",
    titleOwner: "G2t=Ll(Hc,(e,{get:t})=>{",
    titleHelper: "U2t({...n,localTitle:r})"
  },
  turn: {
    owner: "function bi(e){let t=(0,Ki.c)(216),",
    marker: "turnId:f,",
    conversationId: "o",
    turnId: "f",
    boundary: "let Ha=za.length,Ua={"
  }
};
