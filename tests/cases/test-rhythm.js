// Rhythm page: ext data cleaning, streak, goals, weekly summary, vacation shift, calendar file, time of day, calibration, checklist.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
toast=()=>{};
const day=i=>new Date(Date.parse(pDay()+'T12:00:00Z')-i*86400000).toISOString().slice(0,10);
// 1. cleaning
const dirty={check:{c1:true,zzz:true,c2:1},goal:{daily:7,weekly:3},vac:{from:'2026-01-01',until:'bad'},vacs:[{from:'2026-02-01',until:'2026-02-05'},{from:'2026-13-45',until:'2026-13-46'},{from:'2026-01-01',until:'9999-01-01'}],hours:{3:[10,4],5:[2,9],7:[1.5,1],9:'x'}};
const c=extNormal(dirty);
ok(JSON.stringify(c.check)==='{"c1":true}'&&c.goal.daily===10&&c.goal.weekly===3&&c.vac===null,'unknown checks, unknown goal values and a broken vacation are dropped');
ok(c.vacs.length===1&&c.vacs[0].from==='2026-02-01','finished vacations keep only real dates and sane spans');
ok(extNormal({vac:{from:'2026-13-45',until:'2026-13-46'}}).vac===null&&extNormal({vac:{from:'2026-01-01',until:'9999-01-01'}}).vac===null,'an impossible or endless vacation is refused');
ok(JSON.stringify(c.hours)==='{"3":[10,4]}'&&extNormal(null).goal.daily===10,'hour buckets are checked, null gives the defaults');
const raw=JSON.parse(JSON.stringify(P));raw.ext={check:{c3:true},goal:{daily:20,weekly:1},vac:null,sec:{},hours:{}};
ok(pNormal(raw).ext.goal.daily===20&&pNormal(raw).ext.check.c3===true,'an imported progress keeps a clean ext');
ok(pNormal({schema:1,answers:{}}).ext.goal.daily===10,'a file without ext gets the defaults');
ok(pFresh().ext.goal.weekly===2,'a fresh progress has ext');
// 2. streak
P.logs={};S.days={};P.ext=extFresh();ok(extStreak().cur===0,'no work, no streak');
P.logs[day(0)]=3;P.logs[day(1)]=1;P.logs[day(2)]=5;P.logs[day(4)]=2;ok(extStreak().cur===3&&extStreak().best===3,'three days in a row');
delete P.logs[day(0)];ok(extStreak().cur===2,'a quiet today does not break the streak yet');
P.ext.vac={from:day(3),until:day(3)};ok(extStreak().cur===4,'a vacation day does not break it');
P.ext.vac=null;P.ext.vacs=[{from:day(3),until:day(3)}];ok(extStreak().cur===4,'and a finished vacation still does not');
// 3. goals
P.ext=extFresh();P.logs={};P.logs[day(0)]=4;extGoal('daily',20);ok(P.ext.goal.daily===20&&/Зараз: 4 із 20/.test($('#main').innerHTML),'daily goal is saved and shown with progress');
extGoal('daily',13);ok(P.ext.goal.daily===20,'a value outside the list is refused');
// 4. weekly summary
P.logs={};for(let i=0;i<3;i++)P.logs[day(i)]=10;for(let i=7;i<9;i++)P.logs[day(i)]=4;
const w0=extWeek(0),w1=extWeek(1);ok(w0.tasks===30&&w0.active===3&&w1.tasks===8&&w1.active===2,'this week against the previous one');
ok(/Завдань: 30 \(\+22 до попереднього тижня\)/.test(extSummary()),'the summary names the difference');
// 5. vacation shifts repetitions
const [a,b]=PQ.filter(q=>!q.examOnly).slice(0,2).map(q=>q.id),now=Date.now(),D=86400000;
P.ext=extFresh();P.answers={[a]:{value:0,score:1,max:1,first:1,attempts:1,at:now-5*D,due:now+2*D},[b]:{value:0,score:1,max:1,first:1,attempts:1,at:now-60*D,due:now-40*D}};
S.answers={};P.study.srs={[a]:{e:2.5,i:1,n:1,l:0,d:day(2)}};
P.ext.vac={from:day(3),until:day(1),t:now-3*D};const was=P.answers[a].due;
ok(extVacNotice().includes('Зсунути повторення'),'an ended vacation offers the shift as a button (nothing is written while drawing)');
ok(P.answers[a].due===was,'the notice alone changes nothing');
const days=extVacEnd();
ok(days===3&&P.answers[a].due===was+3*D&&P.answers[b].due===now-40*D,'repetitions due during or after the break move by its length, old overdue ones stay');
ok(P.study.srs[a].d===day(2),'spaced-repetition days stay as they are (they mean the last rating, not a due date)');
ok(P.ext.vac===null&&P.ext.vacs.length===1,'the vacation moves to the finished list');
P.answers[a].at=now;P.answers[a].due=now+D;P.ext.vac={from:pDay(),until:day(-3),t:now-3600000};const before=P.answers[a].due;extVacEnd();ok(P.answers[a].due===before,'an answer given during the break is not shifted');
P.ext.vac={from:pDay(),until:day(-4),t:now};ok(extVacOn()&&insBehind()==='','during a vacation there is no behind-schedule warning');
extVacStop();ok(P.ext.vac===null&&extVacNotice()==='','it can be ended early');
extVacStop();ok(true,'ending a vacation that is already over does nothing');
P.ext=extFresh();P.ext.vacs=[{from:day(5),until:day(2)}];P.records=[];P.logs={};
ok(extVacDaysSince(Date.now()-6*D)===4,'vacation days since a moment are counted');

// 6. calendar file
const ics=extIcs('17:30',45);
ok(/^BEGIN:VCALENDAR\r\n/.test(ics)&&/END:VCALENDAR\r\n$/.test(ics)&&ics.split('BEGIN:VEVENT').length===3,'calendar has the exam day and the daily slot');
const ebefore=new Date(Date.parse(stExamDate()+'T12:00:00Z')-86400000).toISOString().slice(0,10).replace(/-/g,'');
ok(ics.includes('DTSTART:'+pDay().replace(/-/g,'')+'T173000')&&ics.includes('DURATION:PT45M')&&ics.includes('RRULE:FREQ=DAILY;UNTIL='+ebefore+'T235959')&&ics.includes('DTSTART;VALUE=DATE:'+stExamDate().replace(/-/g,'')),'times, length and the end date are right');
ok(extIcsEsc('a,b;c\\d')==='a\\,b\\;c\\\\d','text is escaped for the format');
const octets=s=>[...s].reduce((n,ch)=>n+(ch.codePointAt(0)<0x80?1:ch.codePointAt(0)<0x800?2:ch.codePointAt(0)<0x10000?3:4),0);
const phys=ics.split('\r\n');ok(phys.every(l=>octets(l)<=75)&&ics.replace(/\r\n /g,'').includes('SUMMARY:НМТ (дата з налаштувань сайту «Складено»)'),'long lines are folded at 75 octets and unfold back to the original');
// 7. time of day
P.ext=extFresh();ok(/Мало даних/.test(extHoursHtml()),'time of day needs enough data');
P.ext.hours={9:[10,9],21:[10,4]};ok(/Найточніше: Ранок/.test(extHoursHtml())&&/90% правильно/.test(extHoursHtml()),'the best part of the day is named');
const hq=PQ.find(q=>!q.examOnly&&q.type==='single'&&q.subject!=='hist').id;P.sessions={};P.answers={};P.drafts={};S.answers={};pStart([hq],'x','hr');route='practice';P.drafts[hq]=0;P.ext=extFresh();pCheck();
const hh=P.ext.hours[new Date().getHours()];ok(hh&&hh[0]===1,'a check is counted in its hour');
// 8. calibration
P.answers={};P.coach.items={};const ids=PQ.filter(q=>!q.examOnly).slice(0,8).map(q=>q.id);
ids.forEach((id,i)=>{P.coach.items[id]={confidence:i<3?3:i<5?2:1};P.answers[id]={value:0,score:i===0?0:1,max:1,first:i===0?0:1,attempts:1,at:1,due:1}});
const cal=extCalibHtml();ok(/Впевнений<\/strong>: 67% правильно \(завдань: 3\)/.test(cal)&&/Упевнено, але з помилкою: 1 із 3/.test(cal),'accuracy by confidence is counted from first attempts');
P.coach.items={};ok(/Мало даних/.test(extCalibHtml()),'few marked tasks give no verdict');
// 9. checklist
P.ext=extFresh();extCheckSet('c4',true);extCheckSet('zzz',true);ok(JSON.stringify(P.ext.check)==='{"c4":true}','a checked item is stored, an unknown one is not');
extCheckSet('c4',false);ok(Object.keys(P.ext.check).length===0,'and it can be unchecked');
// 10. page
route='rhythm';extPage();ok(/Серія днів/.test($('#main').innerHTML)&&/Календар/.test($('#main').innerHTML)&&/Відпустка/.test($('#main').innerHTML),'the page has its sections');
// 11. time on site (own storage key, progress is not rewritten)
localStorage.removeItem(EXT_TIME_KEY);const tick=__intervals.find(f=>/extIdle/.test(String(f)));ok(!!tick,'the time counter is running');
if(tick){const saved=JSON.stringify(P);tick();ok(localStorage.getItem(EXT_TIME_KEY)===null,'a tick alone writes nothing');extSecFlush();ok(extSecRead()[pDay()]===15,'the seconds are stored under the day');
ok(JSON.stringify(P)===saved,'and the progress object is untouched');localStorage.setItem(EXT_TIME_KEY,JSON.stringify({[pDay()]:-5,x:3,'2026-13-45':9}));ok(Object.keys(extSecRead()).length===0,'broken records are ignored')}
log('fails',fails);
})();
