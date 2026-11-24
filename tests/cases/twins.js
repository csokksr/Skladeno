// Однакові завдання різних років (TWIN, tools/build.py twin_index): повтори сховані зі списків і пулів, у справжніх тестах лишаються.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const ids=Object.keys(TWIN);
ok(ids.length>100,'індекс повторів не порожній: '+ids.length);
ok(ids.every(t=>PM[t]&&PM[TWIN[t]]&&!TWIN[TWIN[t]]&&PM[t].subject===PM[TWIN[t]].subject),'повтор і залишене завдання існують, одного предмета, ланцюжків немає');
ok(PQ.every(q=>!TWIN[q.id])&&PQA.length-PQ.length===ids.length,'пул практики без повторів, повний список їх містить');
ok(PB.every(s=>s.topics.every(t=>t.questions.every(q=>!TWIN[q.id]))),'списки завдань тем без повторів');
ok(SUBJECTS.every(s=>pSubStats(s.id).total===PQ.filter(q=>q.subject===s.id).length),'підрахунок по предмету рахує завдання без повторів');
const inReal=new Set([...Object.values(stOfficial).flat(2),...stHistTests.flat()].map(q=>q.id));
ok(ids.some(t=>inReal.has(t)),'справжні тести лишаються повними: в них є й повтори');
ok(PM[ids[0]].prompt===PM[TWIN[ids[0]]].prompt,'повтор і залишене завдання мають однаковий текст');
// Повтор, відповідений у справжньому тесті, зараховується й залишеному завданню.
const keep={P:P.answers,S:S.answers};P.answers={};S.answers={};
const hist=ids.find(t=>PM[t].subject==='hist'),other=ids.find(t=>PM[t].subject!=='hist');
P.answers[other]={value:0,score:1,max:1,first:1,attempts:1,at:1,due:1};S.answers[hist]={value:0,score:1,max:1,first:1,attempts:1,at:2,due:2};
twinCredit();
ok(P.answers[TWIN[other]]?.at===1&&P.answers[TWIN[other]]!==P.answers[other],'відповідь на повтор копіюється на залишене (практика)');
ok(S.answers[TWIN[hist]]?.at===2,'те саме для історії');
P.answers[TWIN[other]].at=99;twinCredit();
ok(P.answers[TWIN[other]].at===99,'вже наявну відповідь не перезаписує');
P.answers=keep.P;S.answers=keep.S;
log('fails',fails);
})();
