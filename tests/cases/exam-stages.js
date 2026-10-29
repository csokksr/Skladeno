;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
// 6 break stage is read-only
pLaunchMock('all',1);route='simulate';
P.exam.stage='break';const before=JSON.stringify(P.exam.answers);
pChoose(0);pSet(1);
ok(JSON.stringify(P.exam.answers)===before,'no answer is written during the break');
P.exam=null;
// 7 expired exam with no answers leaves no record and does not navigate
pLaunchMock('math',1);P.records=[];route='home';location.hash='home';
P.exam.deadline=Date.now()-5000;
ok(pCheckExpiry()===true,'expiry detected');
ok(P.exam===null&&P.records.length===0&&location.hash==='home','empty expired exam is discarded: exam='+P.exam+' records='+P.records.length+' hash='+location.hash);
// ... with answers it is recorded, finish time = deadline, no hijack
pLaunchMock('math',1);route='home';location.hash='home';
const q=PM[P.exam.ids[0]];P.exam.answers[q.id]=q.type==='single'?q.answer:0;
const dl=Date.now()-5000;P.exam.deadline=dl;pCheckExpiry();
ok(P.records.length===1&&P.records[0].finished===dl&&location.hash==='home','answered expired exam recorded at its deadline, no navigation (finished='+(P.records[0]&&P.records[0].finished)+', hash='+location.hash+')');
// ... on the simulate page the user is taken to the result
pLaunchMock('math',2);route='simulate';location.hash='simulate';
const q2=PM[P.exam.ids[0]];P.exam.answers[q2.id]=q2.type==='single'?q2.answer:0;P.exam.deadline=Date.now()-1000;pCheckExpiry();
ok(location.hash.startsWith('result/'),'on the exam page the result opens ('+location.hash+')');
// manual finish still works
pLaunchMock('math',3);P.exam.answers[PM[P.exam.ids[0]].id]=0;pFinishStage();
ok(P.exam.finished&&location.hash.startsWith('result/'),'manual finish opens the result');
log('fails',fails);
})();
