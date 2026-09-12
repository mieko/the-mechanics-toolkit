export const linuxBuild8881 = {
  activityToggle: "onToggle:e=>{let t=!q;if(P.current=e,d==null){M(t);return}d(t)}",
  turn: {
    ownerFunction: "function bi(e){let t=(0,Ki.c)(216),",
    owner: "preventAutoCollapse:Mt||Sr",
    appliedOwner: "preventAutoCollapse:Mt||Sr||MTKreasoningRetained",
    decisionBefore: "let z=At,Mt=w(er,z)",
    decisionAfter: "let z=At,MTKreasoningRetained=MTKuseReasoningRetention(o),Mt=w(er,z)"
  },
  thread: {
    ownerFunction: "function Uj({conversationId:e,",
    owner: "Re.current=G},[e,l,G,y,K])",
    decisionBefore: "usesUnifiedTimeline:v}){let y=vd(Ft)",
    decisionAfter: "usesUnifiedTimeline:v}){let MTKreasoningThreadRetained=MTKuseReasoningThreadRetention(e),y=vd(Ft)",
    collapseBefore: "for(let t of i)wk(y,{conversationId:e,turnSearchKey:t},!0);Re.current=G},[e,l,G,y,K])",
    collapseAfter: "if(!MTKreasoningThreadRetained)for(let t of i)wk(y,{conversationId:e,turnSearchKey:t},!0);Re.current=G},[e,l,G,y,K,MTKreasoningThreadRetained])",
    appliedCollapse: "if(!MTKreasoningThreadRetained)for(let t of i)wk(y,{conversationId:e,turnSearchKey:t},!0)",
    appliedDependencies: "[e,l,G,y,K,MTKreasoningThreadRetained]"
  }
};
