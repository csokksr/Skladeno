// The recall panel moves due dates: "nothing" -> now, "partly" -> within a day, "most" -> unchanged; and never later than before.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const id=Object.keys(PT).find(k=>PT[k].questions.length>=3&&!PT[k].questions.some(q=>QM[q.id]));
const [a,b,c]=PT[id].questions.map(q=>q.id),week=7*86400000;
const set=()=>{for(const x of [a,b])P.answers[x]={value:0,score:1,max:1,first:1,attempts:1,at:Date.now(),due:Date.now()+week};P.answers[c]={value:0,score:1,max:1,first:1,attempts:1,at:Date.now(),due:Date.now()+3600000}};
set();learnRecallRate(id,2);
ok(P.answers[a].due-Date.now()>week-5000,'"most" leaves due dates alone');
learnRecallRate(id,1);
ok(P.answers[a].due-Date.now()<=86400000&&P.answers[b].due-Date.now()<=86400000,'"partly" pulls a week-away task to within a day');
ok(P.answers[c].due-Date.now()>3000000&&P.answers[c].due-Date.now()<=3600000,'"partly" never pushes an earlier due date later');
set();P.study.srs[a]={e:2.5,i:20,n:4,l:0,d:''};learnRecallRate(id,1);
ok(P.study.srs[a].n===4&&P.study.srs[a].i===20,'"partly" keeps the SM-2 interval');
learnRecallRate(id,0);
ok(P.answers[a].due<=Date.now(),'"nothing" makes answered tasks due now');
ok(P.study.srs[a].n===0&&P.study.srs[a].i===0,'"nothing" restarts the SM-2 interval');
// Looking at a wrong answer must not create a coach item (the confident-wrong note reads, never writes).
pStart([a],'t','learn-view');P.answers[a]={value:0,score:0,max:1,first:0,attempts:1,at:Date.now(),due:Date.now()+600000};P.coach.items={};
try{pPractice();pPractice()}catch(e){ok(false,'pPractice threw '+e.message)}
ok(Object.keys(P.coach.items).length===0,'viewing a wrong answer adds no coach item');
log('fails',fails);
})();
