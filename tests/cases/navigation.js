// Back link of a reviewed mock leads to its result; the session list stays bounded.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
pLaunchMock('math',1);P.exam.answers[P.exam.ids[0]]=0;pFinishStage();
const id=P.records[P.records.length-1].id;
pRecordView={id,index:0};route='result-review/'+id;pPractice();
const html=$('#main').innerHTML;
ok(html.includes('class="p-back" href="#result/'+id+'"'),'review of a finished mock links back to its result');
route='practice';pRecordView=null;
const ids=PQ.slice(0,5).map(q=>q.id);
for(let i=0;i<120;i++)pStart(ids,'t','bulk-'+i);
const n=Object.keys(P.sessions).length;
ok(n<=81&&P.sessions['bulk-119']&&P.current==='bulk-119','session list is capped ('+n+' kept, newest present)');
log('fails',fails);
})();
