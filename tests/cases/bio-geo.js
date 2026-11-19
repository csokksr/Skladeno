// Біологія й географія як предмети (tools/zno3_bank.py, src/zno3-bank.json): теми, формат тестів НМТ, шкала 100–200 і четвертий предмет на вибір.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const bio=PQ.filter(q=>q.subject==='bio'),geo=PQ.filter(q=>q.subject==='geo');
ok(SUB.bio&&SUB.geo&&bio.length>2000&&geo.length>1900,'предмети підключено: '+bio.length+' і '+geo.length+' завдань');
ok(bio.every(q=>q.source&&q.topicId&&PT[q.topicId])&&geo.every(q=>q.source&&q.topicId&&PT[q.topicId]),'кожне завдання офіційне й має тему');
ok(PSUB.bio.topics.every(t=>t.group&&PSUB.bio.groups.some(g=>g.id===t.group)),'теми біології згруповано за розділами програми');
ok(PSUB.bio.groups.length===5&&PSUB.geo.groups.length===6,'розділів програми: 5 у біології, 6 у географії');
// Прозорість: ключ без звірки з аркушем УЦОЯО позначено, звірений — ні.
const un=[...bio,...geo].filter(q=>q.keyUnverified).length;
ok(un>0&&un<bio.length+geo.length,'частину ключів звірено з аркушами, решту позначено: не звірено '+un);
ok(/не звірено/.test(pExplain(bio.find(q=>q.keyUnverified)))&&!/не звірено/.test(pExplain(bio.find(q=>!q.keyUnverified))),'сторінка називає незвірений ключ і мовчить про звірений');
// Тести НМТ: повні варіанти, 46 тестових балів, як у таблицях Додатка 5.
ok(stOfficial.bio.length>=10&&stOfficial.geo.length>=7,'варіанти пробників — справжні тести НМТ: '+stOfficial.bio.length+' і '+stOfficial.geo.length);
ok(stOfficial.bio.every(t=>t.length===34&&t.reduce((n,q)=>n+pMax(q),0)===46),'біологія: 34 завдання, 46 балів');
ok(stOfficial.geo.every(t=>t.length===30&&t.reduce((n,q)=>n+pMax(q),0)===46),'географія: 30 завдань, 46 балів');
// Шкала: поріг 7, максимум 46; значення з таблиці.
ok(NMT.subjects.bio.threshold===7&&NMT.subjects.bio.max===46&&nmtScale('bio',6)===0&&nmtScale('bio',7)===100&&nmtScale('bio',46)===200,'біологія: поріг 7, 46 → 200');
ok(nmtScale('geo',26)===151&&nmtScale('geo',38)===175,'географія: 26 → 151, 38 → 175');
// Правильні відповіді дають повний бал (ключі всіх типів читаються правильно).
for(const sid of ['bio','geo']){
  const t=stOfficial[sid][0],score=t.reduce((n,q)=>n+pGrade(q,q.type==='numeric'?String(q.answer):q.answer),0);
  ok(score===46,sid+': ключ першого варіанта дає 46 з 46');
}
// Четвертий предмет НМТ: англійська за замовчуванням, біологія й географія — на вибір.
ok(subjActive().map(s=>s.id).join()==='ukr,math,hist,eng','за замовчуванням четвертий предмет — англійська');
stSet('fourth','bio');
ok(P.study.fourth==='bio'&&subjActive().map(s=>s.id).join()==='ukr,math,hist,bio','після вибору четвертий предмет — біологія');
stSet('fourth','chem');ok(P.study.fourth==='bio','невідомий предмет не приймається');
ok(pMockSet('bio',1).length===34&&stVariants('all')>=3,'повна симуляція має варіанти й з біологією');
const comp=stCompetition(subjActive().map(s=>P.study.targets[s.id]));ok(comp>=100&&comp<=200,'конкурсний бал рахується з цілей чотирьох предметів: '+comp.toFixed(1));
pLaunchMock('all',1);
ok(P.exam.full&&P.exam.blocks.length===2&&P.exam.blocks[0].length===52&&P.exam.blocks[1].length===64&&P.exam.ids.some(id=>PM[id].subject==='bio')&&!P.exam.ids.some(id=>PM[id].subject==='eng'),'повна симуляція: 52 + 64 завдання, у другому блоці біологія замість англійської');
// Збережена симуляція з біологією проходить перевірку імпорту.
ok(!!pNormal(JSON.parse(JSON.stringify(P))).exam,'збережена симуляція з біологією читається');
// Прогноз з пробника.
P.exam=null;P.records=[];
const t0=stOfficial.bio[0],ans={};t0.forEach(q=>{ans[q.id]=q.answer});
P.records.push({id:'r1',subject:'bio',variant:1,ids:t0.map(q=>q.id),answers:ans,finished:Date.now(),score:46,max:46,title:'Біологія'});
const f=stForecast('bio');ok(f.basis==='mocks'&&f.raw===46&&f.scale===200,'прогноз з пробника: 46 → 200');
// Звіт посиланням: з біологією замість англійської і старі посилання з англійською.
const rd=rpData();ok(rd.subjects.map(s=>s.sid).join()==='ukr,math,hist,bio','звіт називає чотири предмети іспиту');
ok(rpClean(JSON.parse(JSON.stringify(rd))).subjects.length===4,'звіт з біологією проходить перевірку');
const old={...rd,subjects:rd.subjects.filter(s=>s.sid!=='bio').concat([{sid:'eng',scale:150,lo:140,hi:160,target:170,n:5,acc:60}])};
ok(rpClean(old).subjects.some(s=>s.sid==='eng'),'звіт зі старим посиланням (англійська) читається');
ok((()=>{try{rpClean({...rd,subjects:rd.subjects.filter(s=>s.sid!=='bio')});return false}catch(e){return !!e.rp}})(),'звіт без жодного предмета на вибір відхиляється');
// Тижневі знімки, записані до біології й географії, не втрачаються.
const w=weeklyNormal({snaps:[{day:'2026-11-01',at:1,subjects:{ukr:{n:1,a:1,m:1},math:{n:0,a:0,m:0},hist:{n:0,a:0,m:0},eng:{n:0,a:0,m:0}}}]});
ok(w.snaps.length===1&&w.snaps[0].subjects.bio.m===0,'знімок без біології й географії приймається з нулями');
log('fails',fails);
})();
