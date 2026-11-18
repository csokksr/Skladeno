// «Ще на ту саму пастку» (src/modules/97-trap.js): добір нових завдань тієї самої теми й виду за позначеною причиною помилки.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
P.answers={};P.coach.items={};
// Три найбільші групи нових офіційних завдань математики (тема + вид).
const groups={};for(const q of PQ.filter(q=>q.subject==='math'&&q.year&&!q.challenge&&!q.examOnly))(groups[trapKey(q)]??=[]).push(q);
const [A,B,C]=Object.values(groups).sort((x,y)=>y.length-x.length).slice(0,3);
const wrong=(q,reason)=>{P.answers[q.id]={value:0,score:0,max:pMax(q),first:0,attempts:1,at:Date.now(),due:Date.now()};coachItem(q.id).reason=reason};
A.slice(0,3).forEach(q=>wrong(q,'reading'));wrong(B[0],'reading');C.slice(0,2).forEach(q=>wrong(q,'method'));
// Позначена причина без помилки першої спроби не рахується.
const right=B[1];P.answers[right.id]={value:0,score:pMax(right),max:pMax(right),first:pMax(right),attempts:1,at:Date.now(),due:Date.now()};coachItem(right.id).reason='reading';

ok(trapMarked('reading').length===4&&trapMarked('method').length===2,'позначені пастки: 4 за «прочитав умову», 2 за «спосіб»');
const rk=trapRank('reading');
ok(rk[0].key===trapKey(A[0])&&rk[0].n===3&&rk[1].key===trapKey(B[0])&&rk[1].n===1,'пастки від найчастішої: A (3), B (1)');
const pick=trapPick('reading',10);
ok(pick&&pick.length===10&&new Set(pick).size===10,'добірка: 10 різних завдань');
ok(pick.every(id=>!P.answers[id]&&[trapKey(A[0]),trapKey(B[0])].includes(trapKey(PM[id]))),'лише нові завдання з пасток A і B');
ok(trapKey(PM[pick[0]])===trapKey(A[0])&&trapKey(PM[pick[1]])===trapKey(B[0]),'пастки чергуються, а не беруться з однієї');
ok(pick.slice(0,6).every(id=>PM[id].year),'офіційні завдання йдуть першими');
const seeded=trapPick('method',10,B[0]);
ok(trapKey(PM[seeded[0]])===trapKey(B[0]),'пастка поточного завдання ставиться першою');
ok(trapPick('time')===null&&trapPick('attention')===null,'без позначених причин добірки немає');
P.answers[pick[0]]={value:0,score:0,max:1,first:0,attempts:1,at:1,due:1};
ok(!trapPick('reading',10).includes(pick[0]),'розв’язане завдання більше не потрапляє в добірку');
const html=trapHTML();
ok(html.includes('Неправильно прочитав умову')&&html.includes('позначено 4')&&html.includes("trapStart('reading')")&&!html.includes('Забракло часу'),'розмітка: причини з позначками й кнопка, інших немає');
P.coach.items={};ok(trapHTML().includes('Після помилки познач причину'),'без позначок показано підказку');
ok(trapTitle(trapKey(A[0])).includes(' · '),'назва пастки читається: '+trapTitle(trapKey(A[0])));
log('fails',fails);
})();
