// «Суперник — ти сам тиждень тому» (src/modules/97-weekly.js): щотижневий знімок, порівняння, нормалізація, злиття.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const today=pDay(),day=o=>weeklyDay(o,today);
const answer=(sid,count,right)=>{let i=0;for(const q of PQ.filter(q=>q.subject===sid&&q.type==='single'&&!P.answers[q.id]).slice(0,count)){const s=i++<right?1:0;P.answers[q.id]={value:0,score:s,max:1,first:s,attempts:1,at:Date.now(),due:Date.now()}}};
const reset=()=>{P.answers={};P.logs={};P.weekly={snaps:[]}};

// 1. Без відповідей знімка немає; з відповідями він один на 7 днів.
reset();ok(weeklyEnsure()===false&&P.weekly.snaps.length===0,'без відповідей знімок не робиться');
answer('ukr',20,10);ok(weeklyEnsure()===true&&P.weekly.snaps.length===1,'є відповіді: зроблено знімок');
ok(weeklyEnsure()===false&&P.weekly.snaps.length===1,'того ж дня другого знімка немає');
const s0=P.weekly.snaps[0].subjects.ukr;ok(s0.n===20&&s0.a===10&&s0.m===20,'знімок: 20 завдань, 10 з 20 балів за першими спробами');
// 2. Знімок віком <7 днів ще не порівнюється: показано, скільки чекати.
let c=weeklyCompare();ok(c.ref===null&&c.wait===7,'порівняння з’явиться через 7 днів');
ok(weeklyHTML().includes('Порівняння з’явиться через 7 днів'),'розмітка каже, скільки чекати');
// 3. Знімок 8 днів тому: порівняння за новими завданнями й журналом дій.
P.weekly.snaps[0].day=day(-8);
answer('ukr',10,9);answer('math',10,5);
P.logs[day(-8)]=5;P.logs[day(-9)]=5;P.logs[day(0)]=20;P.logs[day(-1)]=10;P.logs[day(-2)]=5;
c=weeklyCompare();
ok(c.ref&&c.days===8,'знімок віком 8 днів узято за опорний');
ok(c.added===20&&c.before===50,'нових завдань 20, точність до знімка 50%');
ok(c.fresh===70,'нові завдання: 14 з 20 балів = 70% ('+c.fresh+')');
ok(c.doneNow===35&&c.doneThen===10&&c.activeNow===3&&c.activeThen===2,'дії за тиждень: 35 проти 10, дні: 3 проти 2');
ok(c.rows.find(r=>r.sid==='ukr').fresh===90&&c.rows.find(r=>r.sid==='math').fresh===50,'за предметами: укр 90%, мат 50%');
ok(weeklyVerdict(c)==='Ти випереджаєш себе тижневої давності.','усі мірки кращі: вердикт «випереджаєш»');
const html=weeklyHTML(true);ok(html.includes('8 днів тому')&&html.includes('70%')&&html.includes('<table'),'розмітка з таблицею за предметами');
ok(P.weekly.snaps.length===2&&P.weekly.snaps.at(-1).day===today,'відкриття сторінки зробило новий знімок, бо старому 8 днів');
// 4. Гірший тиждень і змішаний.
P.logs={};P.logs[day(-8)]=30;P.logs[day(-9)]=30;
c=weeklyCompare();ok(c.doneNow===0&&weeklyVerdict(c)!=='Ти випереджаєш себе тижневої давності.','гірший тиждень не хвалиться');
for(const q of PQ.filter(q=>q.subject==='ukr'&&P.answers[q.id]&&P.answers[q.id].attempts===1).slice(20,30))P.answers[q.id].first=0;
// 5. Новий знімок лише через 7 днів, старі зберігаються (до 8).
ok(weeklyEnsure()===false&&P.weekly.snaps.length===2,'знімок свіжий: нового немає');
P.weekly.snaps[0].day=day(-15);P.weekly.snaps.at(-1).day=day(-8);ok(weeklyEnsure()===true&&P.weekly.snaps.length===3&&P.weekly.snaps.at(-1).day===today,'через 7+ днів зроблено наступний знімок');
// 6. Нормалізація відкидає пошкоджені знімки.
const good={day:day(-14),at:1,subjects:Object.fromEntries(SUBJECTS.map(s=>[s.id,{n:1,a:1,m:1}]))};
const n=weeklyNormal({snaps:[good,{...good,day:'bad'},{...good,day:day(-20),subjects:{...good.subjects,ukr:{n:1,a:5,m:2}}},{...good,day:day(-21),subjects:{ukr:good.subjects.ukr}},good]});
ok(n.snaps.length===1&&n.snaps[0].day===day(-14),'нормалізація: лишився один коректний знімок без дубліката');
ok(pNormal(JSON.parse(JSON.stringify(P))).weekly.snaps.length===3,'pNormal зберігає знімки');
// 7. Злиття за днем, локальний має перевагу.
const m=webMerge({platform:{weekly:{snaps:[{...good,at:111}]}}},{platform:{weekly:{snaps:[{...good,at:222},{...good,day:day(-7)}]}}}).platform.weekly.snaps;
ok(m.length===2&&m[0].day===day(-14)&&m[0].at===111,'webMerge: знімки за днем, локальний перемагає');
log('fails',fails);
})();
