;(function(){
const log=(...a)=>console.log(...a);
function reload(){return pNormal(JSON.parse(JSON.stringify(P)))}
let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
for(const [sub,v] of [['all',1],['all',7],['all',8],['ukr',7],['ukr',8],['math',12],['math',13],['math',1]]){
  try{
    pLaunchMock(sub,v);
    let e=P.exam, lens=e.blocks.map(b=>b.length).join('+');
    let n=reload();
    let kept=!!n.exam;
    // also through the import path used by backups
    let viaClean; try{pCleanAttempt(JSON.parse(JSON.stringify(P.exam)),true);viaClean=true}catch(err){viaClean=err.message}
    ok(kept&&viaClean===true, `${sub} v${v} ids=${e.ids.length} blocks=${lens} reload=${kept} clean=${viaClean}`);
    if(sub==='all'){const sets=SUBJECTS.map(s=>pMockSet(s.id,v));const b0=sets[0].length+sets[1].length;ok(e.blocks[0].length===b0&&e.blocks[1].length===sets[2].length+sets[3].length,`  ${sub} v${v} block split ${b0}/${e.ids.length-b0} matches ukr+math / hist+eng`)}
  }catch(err){ok(false,`${sub} v${v} THREW ${err.message}`)}
}
log('fails',fails);
})();
