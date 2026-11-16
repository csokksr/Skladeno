// Test insights: type filter, builder memory, quick check, attempt history, per-task time, comparison, chart, sheet, behind-schedule warning, guard.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const qs=PQ.filter(q=>!q.examOnly);
// 1. type filter
const sid=SUBJECTS.find(s=>qs.some(q=>q.subject===s.id&&q.type==='multi')).id,topics=testsTopicList(sid).map(t=>t.id);
const multi=testsPool(sid,topics,'all','multi'),all=testsPool(sid,topics,'all');
ok(multi.length>0&&multi.length<all.length&&multi.every(id=>PM[id].type==='multi'),'type filter keeps only tasks of that type');
ok(testsPool(sid,topics,'all','all').length===all.length,'"all types" changes nothing');
// 2. builder memory
localStorage.removeItem(TESTS_MEM_KEY);ok(testsMem().last===null&&testsMem().templates.length===0,'memory starts empty');
testsMemSave({last:{sid,topics,pool:'new',count:10,type:'multi'},templates:[{name:'t1',sid,topics,pool:'all',count:20,type:'all'},{name:'bad',sid:'zzz'}]});
ok(testsMem().last.pool==='new'&&testsMem().templates.length===1,'last settings are read back and a template of an unknown subject is dropped');
localStorage.setItem(TESTS_MEM_KEY,'{broken');ok(testsMem().last===null,'a broken record is ignored');
// 3. guard: quick check, times, history
const [a,b,c]=qs.filter(q=>q.type==='single').slice(0,3).map(q=>q.id);
const ex={id:'exam-1',subject:qs[0].subject,variant:3,short:true,ids:[a,b],blocks:[[a,b]],answers:{},started:1,deadline:2,finished:null,times:{[a]:5000,[b]:99999999,zzz:4000,[c]:1000}};
const g=guardRun(structuredClone(ex));ok(g.short===true&&/швидка перевірка$/.test(g.title),'guard keeps the quick-check flag and its title');
ok(g.times[a]===5000&&g.times[b]===3600000&&!('zzz' in g.times)&&!(c in g.times),'guard keeps times only for the run\'s tasks and caps them at an hour');
ok(!('short' in guardRun({...structuredClone(ex),subject:'all',short:true})),'a full simulation cannot be marked short');
const raw=JSON.parse(JSON.stringify(P));raw.answers={[a]:{value:0,first:0,attempts:3,at:5,due:5,hist:[{at:1,s:0},{at:2,s:1},{at:'x',s:1},{at:3,s:99}]}};
const imp=pNormal(raw);ok(JSON.stringify(imp.answers[a].hist)===JSON.stringify([{at:1,s:0},{at:2,s:1}]),'import keeps only well-formed history entries');
// 4. attempt history: ordinary tasks keep it in P.answers, history tasks in S.answers
const hq=qs.find(q=>q.subject==='hist'&&q.type==='single'&&QM[q.id]).id,nq=qs.find(q=>q.subject!=='hist'&&q.type==='single').id;
P.sessions={};P.answers={};P.drafts={};S.answers={};S.drafts={};pStart([nq,hq],'x','hk');route='practice';
pSet(0,false);pCheck();ok(P.answers[nq]&&P.answers[nq].hist.length===1&&P.answers[nq].hist[0].s===P.answers[nq].score,'a check writes the first history entry');
P.drafts[nq]=1;pCheck();ok(P.answers[nq].hist.length===2&&P.answers[nq].attempts===2,'and the second one adds another');
P.sessions.hk.index=1;pSet(0,false);pCheck();ok(S.answers[hq]&&S.answers[hq].hist.length===1,'a history task keeps its history in the history store');
const sraw=JSON.parse(JSON.stringify({app:'istoria200',state:{...S,answers:{[hq]:{...S.answers[hq],hist:[{at:1,s:0},{at:'x',s:1}]}}}}));
ok(JSON.stringify(normaliseImport(sraw).answers[hq].hist)===JSON.stringify([{at:1,s:0}]),'import of the history store cleans the journal too');
// 5. quick check
P.exam=null;P.records=[];route='mocks';ok(!pLaunchShort('zzz'),'an unknown subject starts nothing');
const sub=SUBJECTS[0].id;pLaunchShort(sub);const e=P.exam;
ok(e&&e.short===true&&e.ids.length===15&&e.full===false&&e.deadline-e.started===15*60000&&/швидка перевірка$/.test(e.title),'quick check: 15 tasks, 15 minutes, own title');
ok(new Set(e.ids).size===15&&e.ids.every(id=>PM[id].subject===sub),'tasks are different and from the subject');
e.deadline=Date.now()+7.5*60000;const pp=pacePlan(e,e.ids);ok(pp.expected===7,'pace is counted against 15 minutes');
// 6. per-task time and result
route='simulate';pPractice();insTick.t-=400000;P.exam.index=1;pPractice();
ok(P.exam.times[e.ids[0]]===300000&&insTick.id===e.ids[1],'time on a task is added when the next task opens, a long pause counts as 5 minutes');
P.exam.answers[e.ids[0]]=0;insTick.t-=20000;pFinalize(P.exam,false);
const rec=P.records[P.records.length-1];ok(!!rec&&rec.short===true,'the finished record is stored with the quick-check flag');
ok(rec.times&&rec.times[e.ids[0]]===300000&&rec.times[e.ids[1]]>=20000,'the record keeps the times, the last task included');
// 7. comparison and chart
const mk=(id,fin,score,v)=>({id,title:'t',subject:sub,variant:v,ids:[a],answers:{},finished:fin,score,max:10});
P.records=[mk('r1',1000,4,1),mk('r2',2000,6,2),mk('r3',3000,8,3)];
ok(/Попередня спроба.*6 із 10, тобто 60%.*Зараз 80%, на 20 п\. п\. більше.*Варіанти можуть різнитися/.test(insCompare(P.records[2])),'comparison names the previous attempt and the difference');
ok(insCompare(P.records[0])==='','the first attempt has nothing to compare with');
const t=insTrend(insGroup(P.records[2]),'Тест');ok(/<polyline/.test(t)&&/aria-label="Тест, % балів: 40, 60, 80"/.test(t),'chart is an image with a text equivalent');
ok(insTrends().includes('ins-trend')&&insGroup({...P.records[0],short:true}).length===0,'charts exist per kind, short checks are separate');
// 8. answer sheet
P.exam=null;pLaunchShort(sub);route='simulate';const ie=P.exam,ix=ie.ids.findIndex(id=>PM[id].type==='single');
insSheet();ok(/Бланк відповідей/.test($('#modal').innerHTML)&&/ins-bubble/.test($('#modal').innerHTML),'the sheet lists the tasks with bubbles');
insSheetPick(ix,2);ok(ie.answers[ie.ids[ix]]===2,'a bubble records the answer');
ok(/aria-pressed="true"[^>]*aria-label="Завдання \d+, варіант C"/.test($('#modal').innerHTML)||/aria-label="Завдання \d+, варіант C"[^>]*aria-pressed="true"/.test($('#modal').innerHTML)||/aria-pressed="true"/.test($('#modal').innerHTML),'and shows it as chosen');
// 9. behind schedule
S.answers={};S.days={};P.exam=null;P.records=[];P.logs={};P.answers={[a]:{value:0,score:1,max:1,first:1,attempts:1,at:1,due:1}};
if(stDaysLeft()>0){const h=insBehind();ok(/Ти відстаєш від графіка/.test(h)&&/Пробників ще не було/.test(h)&&/Заняття були лише в 0 із останніх 7 днів/.test(h),'no mocks and no days of work give a warning with advice');
P.logs[pDay()]=1;P.records=[{...mk('x',Date.now(),5,1)}];for(const k of [1,2,3])P.logs[new Date(Date.parse(pDay()+'T12:00:00Z')-k*86400000).toISOString().slice(0,10)]=1;
ok(insBehind()==='','a recent mock and work on 4 of 7 days give no warning')}
P.answers={};P.records=[];ok(insBehind()==='','a brand-new user is not nagged');

// 10. review findings: journal survives a reload, a quick check survives a reload, it does not count as the day's mock, a break is not task time
P.answers={};S.answers={};P.sessions={};pStart([nq,hq],'x','hk2');route='practice';P.drafts[nq]=0;pCheck();P.sessions.hk2.index=1;pSet(0,false);pCheck();
localStorage.setItem(PKEY,JSON.stringify(P));localStorage.setItem(KEY,JSON.stringify(S));delete P.answers[nq].hist;delete S.answers[hq].hist;insReloadHist();
ok(P.answers[nq].hist&&P.answers[nq].hist.length===1&&S.answers[hq].hist&&S.answers[hq].hist.length===1,'the attempt journal is read back from storage after a reload');
P.exam=null;pLaunchShort(SUBJECTS[0].id);const back=pNormal(JSON.parse(JSON.stringify(P)));ok(back.exam&&back.exam.short===true&&back.exam.ids.length===15&&/швидка перевірка$/.test(back.exam.title),'an unfinished quick check survives a restore');
P.exam=null;P.records=[{...mk('q1',Date.now(),5,1),short:true}];ok(!stMockDone({sid:sub}),'a quick check does not count as the mock of the day');P.records=[mk('q2',Date.now(),5,1)];ok(stMockDone({sid:sub}),'a real mock is');
P.exam=null;pLaunchShort(sub);route='simulate';pPractice();const be=P.exam;be.stage='break';insTick.t-=200000;pPractice();ok(be.times&&be.times[be.ids[0]]>=200000&&insTick===null,'the break stage closes the running timer');
log('fails',fails);
})();
