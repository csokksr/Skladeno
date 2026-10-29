;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const ids=PQ.slice(0,12).map(q=>q.id);
// 1 pStart with dangling ids
P.sessions={};P.current=null;
try{pStart(['nope-1','nope-2'],'t','k-dang');ok(!P.sessions['k-dang']&&P.current===null,'all-dangling start does not create a session')}catch(e){ok(false,'dangling start threw '+e.message)}
try{pStart([ids[0],'nope-1',ids[1]],'t','k-mix');ok(P.sessions['k-mix']&&P.sessions['k-mix'].ids.join()===[ids[0],ids[1]].join(),'mixed start keeps only existing ids')}catch(e){ok(false,'mixed start threw '+e.message)}
// 5 reused key with different list resets index
P.sessions={};
pStart(ids.slice(0,10),'t','k-reuse');P.sessions['k-reuse'].index=7;
pStart(ids.slice(2,8),'t','k-reuse');
ok(P.sessions['k-reuse'].index===0,'reused key + different ids -> index 0 (got '+P.sessions['k-reuse'].index+')');
P.sessions['k-reuse'].index=3;pStart(ids.slice(2,8),'t','k-reuse');
ok(P.sessions['k-reuse'].index===3,'reused key + same ids -> index kept (got '+P.sessions['k-reuse'].index+')');
// 3 session keys with Cyrillic / long text survive a reload
for(const key of ['hist-Факт · Історія','hist-'+'я'.repeat(80),'today-review-0','t5-all']){
  P.sessions={};P.sessions[key]={ids:ids.slice(0,3),title:'Факт',index:1};P.current=key;
  const n=pNormal(JSON.parse(JSON.stringify(P)));
  ok(n.current===key&&n.sessions[key]&&n.sessions[key].index===1,'session key survives reload: '+key.slice(0,24));
}
const evil=JSON.parse('{"schema":1,"answers":{},"sessions":{"__proto__":{"ids":["'+ids[0]+'"],"index":0,"title":"x"},"a<b>":{"ids":["'+ids[0]+'"],"index":0,"title":"x"}},"current":null}');
const n2=pNormal(evil);
ok(Object.getPrototypeOf(n2.sessions)===Object.prototype&&!Object.keys(n2.sessions).some(k=>/[<>]/.test(k)||k==='__proto__'),'proto / markup keys rejected');
// pPractice with broken session does not throw
P.sessions={};P.sessions['broken']={ids:['nope-1',ids[0]],title:'b',index:0};P.current='broken';
try{location.hash='practice';route='practice';pPractice();ok(true,'pPractice with dangling id first does not throw')}catch(e){ok(false,'pPractice threw '+e.message)}
log('fails',fails);
})();
