// Прогноз із вагами тем (DB.topicWeights, tools/build.py) і «де найдешевше взяти бали» (stPrice, stBest).
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const W=DB.topicWeights;
ok(W&&JSON.stringify(W).length>500,'таблиця ваг є в даних і не порожня');
for(const sid of ['ukr','math','eng','hist']){const sum=Object.values(W.w[sid]).reduce((a,b)=>a+b,0);ok(Math.abs(sum-1)<0.01,sid+': частки тем у сумі дають 1 (зараз '+sum.toFixed(3)+')')}
ok(W.tasks.hist>=300&&W.tasks.math>=200,'ваги пораховані з офіційних тестів НМТ ('+JSON.stringify(W.tasks)+')');
const topics=sid=>DB.quality.topics.filter(t=>t.subject===sid&&t.questions.some(id=>PM[id]));
const answerTopic=(t,right,at=Date.now())=>{for(const id of t.questions){const q=PM[id];if(!q||q.challenge)continue;P.answers[id]={value:0,score:right?q.type==='single'?1:pMax(q):0,max:pMax(q),first:right?pMax(q):0,attempts:1,at,due:at}}};
const clear=()=>{P.answers={};P.records=[]};
const flat=sid=>{const keep=DB.topicWeights;delete DB.topicWeights;try{return stPractice(sid)}finally{DB.topicWeights=keep}};

// 1. Правильно закрита важка тема піднімає прогноз вище за просте середнє, а легка тема — нижче.
const ts=topics('hist').slice().sort((a,b)=>W.w.hist[b.id]-W.w.hist[a.id]),heavy=ts[0],light=ts.at(-1);
clear();answerTopic(heavy,true);
let wp=stPractice('hist'),fp=flat('hist');
ok(wp.weighted&&!fp.weighted,'stPractice позначає, чи були ваги');
ok(wp.p>fp.p+0.005,'важка тема (вага '+W.w.hist[heavy.id]+') підіймає прогноз: '+wp.p.toFixed(3)+' > '+fp.p.toFixed(3));
clear();answerTopic(light,true);wp=stPractice('hist');fp=flat('hist');
ok(wp.p<fp.p,'легка тема (вага '+W.w.hist[light.id]+') майже не підіймає: '+wp.p.toFixed(3)+' < '+fp.p.toFixed(3));
// 2. Запасна формула без ваг: просте середнє за темами.
clear();answerTopic(heavy,true);
const rows=stTopicStats('hist'),mean=rows.reduce((s,r)=>s+r.acc,0)/rows.length;
ok(Math.abs(flat('hist').p-mean)<1e-9,'без таблиці ваг працює стара формула (просте середнє)');
// 3. Ціна біля порогу таблиці: +1 бал над порогом дає стрибок, у середині таблиці ціна мала, на максимумі нуль.
const s=NMT.subjects.math,below=s.threshold-1,mid=Math.round((s.threshold+s.max)/2);
ok(nmtScale('math',below)===0&&stPrice('math',below)>=100,'за один тестовий бал до порогу ціна ≥ 100 шкальних ('+stPrice('math',below).toFixed(1)+')');
ok(stPrice('math',mid)>0&&stPrice('math',mid)<stPrice('math',below)/5,'у середині таблиці ціна набагато менша ('+stPrice('math',mid).toFixed(2)+')');
ok(stPrice('math',s.max)===0,'на максимумі ціна нуль');
// 4. Три найвигідніші теми: впорядковані, з відомих предметів, лише там, де прогноз має досить даних.
clear();
for(const sid of ['ukr','math']){let n=0;for(const t of topics(sid)){if(n++>=8)break;answerTopic(t,n%3===0)}}
const best=stBest();
ok(best.length===3,'показано 3 теми ('+best.map(b=>b.id+':'+b.gain).join(' ')+')');
ok(best.every((b,i)=>i===0||best[i-1].gain>=b.gain),'теми впорядковані за цінністю');
ok(best.every(b=>['ukr','math'].includes(b.sid)),'лише предмети з достатньою кількістю даних');
ok(stBestHTML().includes('Де найдешевше взяти бали')&&(stBestHTML().match(/p-topic-row/g)||[]).length===3,'блок розмітки містить 3 рядки');
clear();ok(stBest().length===0&&stBestHTML()==='','без даних блок не показується');
log('fails',fails);
})();
