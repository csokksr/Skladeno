// Shortcuts (89), export (91), session tools (92).
// TZ: America/New_York
;(async function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
toast=()=>{};
// 1. palette and keys
const labels=scCommands().map(c=>c[0]);ok(labels.includes('Мій прогрес')&&SUBJECTS.every(s=>labels.includes(s.name)),'the palette lists pages and subjects');
ok(scFilter('прог').some(c=>c[1]==='analytics')&&scFilter('зззззз').length===0&&scFilter('').length===scCommands().length,'typing narrows the list, an empty query shows everything, nonsense shows nothing');
ok(scFilter('ПРОГРЕС').length>0&&scFilter('мій  прогрес').length>0,'case and extra spaces do not matter');
let went=null,opened=0,keys=0,prevented=0;const oldGo=go;go=s=>{went=s};const oldOpen=scOpen,oldKeys=scKeysOpen;scOpen=()=>{opened++};scKeysOpen=()=>{keys++};
const ev=(o)=>({key:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,target:{tagName:'BODY'},preventDefault(){prevented++},...o});
location.hash='#hub';$('#modal').open=false;
scKeydown(ev({key:'k',ctrlKey:true}));ok(opened===1&&prevented===1,'Ctrl+K opens the palette');
scKeydown(ev({key:'K',metaKey:true}));ok(opened===2,'Cmd+K too');
scKeydown(ev({key:'л',code:'KeyK',ctrlKey:true}));ok(opened===3,'Ctrl+K works on a Ukrainian layout (physical key)');
scKeydown(ev({key:'k',ctrlKey:true,shiftKey:true}));ok(opened===3,'Ctrl+Shift+K is not ours');
scKeydown(ev({key:'/'}));ok(went==='find','"/" opens search');
scKeydown(ev({key:'?',shiftKey:true}));ok(keys===1,'"?" opens the key help');
went=null;scKeydown(ev({key:'/',target:{tagName:'INPUT'}}));ok(went===null,'"/" typed in a field is just a character');
scKeydown(ev({key:'/',target:{tagName:'DIV',isContentEditable:true}}));ok(went===null,'and in editable text');
scKeydown(ev({key:'/',ctrlKey:true}));ok(went===null,'Ctrl+/ is not ours');
$('#modal').open=true;scKeydown(ev({key:'/'}));ok(went===null,'with a dialog open "/" does nothing');$('#modal').open=false;
for(const r of ['simulate','official-run','checkpoint']){location.hash='#'+r;went=null;const o=opened;scKeydown(ev({key:'/'}));scKeydown(ev({key:'k',ctrlKey:true}));ok(went===null&&opened===o,'during '+r+' both shortcuts are off')}
location.hash='#simulate';const k0=keys;scKeydown(ev({key:'?'}));ok(keys===k0+1,'but the help is still available in a test');
go=oldGo;scOpen=oldOpen;scKeysOpen=oldKeys;location.hash='#hub';
// palette keys
scItems=scFilter('');scActive=0;let pv=0;const pk=k=>scPalKey({key:k,preventDefault(){pv++}});
pk('ArrowDown');ok(scActive===1&&pv===1,'the arrow moves down');pk('ArrowUp');pk('ArrowUp');ok(scActive===scItems.length-1,'and wraps around at the top');pk('ArrowDown');ok(scActive===0,'and at the bottom');
$('#pal-q').value='zzzzzz';scPalInput();ok(scItems.length===0&&scActive===0,'a query with no match empties the list');pv=0;pk('ArrowDown');pk('ArrowUp');ok(scActive===0,'arrows on an empty list do nothing');went=null;go=s=>{went=s};pk('Enter');ok(went===null,'Enter on an empty list goes nowhere');go=oldGo;
$('#pal-q').value='план';scPalInput();ok(scItems.length>0&&scItems.every(c=>/план/.test(findKey(c[0]+' '+c[2]))),'typing filters through the handler');
scItems=scFilter('');scActive=0;went=null;go=s=>{went=s};$('#modal').close=()=>{};scGo(2);ok(went===scItems[2][1],'choosing an item goes to its page');go=oldGo;
// 2. CSV
ok(csvCell('abc')==='abc'&&csvCell('a;b')==='"a;b"'&&csvCell('a"b')==='"a""b"'&&csvCell('a\nb')==='"a\nb"','cells with separators and quotes are quoted');
ok(csvCell('=SUM(A1)')==="'=SUM(A1)"&&csvCell('+1')==="'+1"&&csvCell('-1')==="'-1"&&csvCell('@x')==="'@x"&&csvCell(5)==='5'&&csvCell(null)==='','formula starters are defused, numbers and blanks are fine');
const sub=SUBJECTS[0].id,qa=PQ.find(q=>!q.examOnly&&q.subject===sub).id;
P.records=[{id:'r1',title:'Українська мова · варіант 2',subject:sub,variant:2,ids:[qa],answers:{[qa]:0},started:Date.UTC(2026,10,10,9,0),finished:Date.UTC(2026,10,10,9,40),score:5,max:10},
 {id:'r2',title:'=Погана назва',subject:'all',variant:1,ids:[qa],answers:{},started:Date.UTC(2026,10,12,9,0),finished:Date.UTC(2026,10,12,11,0),score:60,max:120},
 {id:'r3',title:'Швидка',subject:sub,variant:1,short:true,ids:[qa],answers:{},finished:Date.UTC(2026,10,11,9,0),score:3,max:15}];P.official.records=[];
const rows=csvRows();ok(rows.length===4&&rows[0][0]==='Дата'&&rows[0].length===11&&rows.every(r=>r.length===11),'a header and one row per finished test, all rows have the same columns');
ok(rows[1][1]==='Пробник'&&rows[1][5]===5&&rows[1][6]===10&&rows[1][7]===50&&rows[1][10]===40,'score, maximum, percent and minutes are right');
ok(rows[2][1]==='Швидка перевірка'&&rows[3][1]==='Повна симуляція'&&rows[3][3]==='Усі предмети'&&rows[3][10]===120,'quick checks and full simulations are named, rows are by date');
const txt=csvText();ok(txt.charCodeAt(0)===0xfeff&&txt.split('\r\n').length===5&&txt.endsWith('\r\n'),'the file starts with a BOM and uses CRLF lines');ok(txt.includes("'=Погана назва"),'a title that looks like a formula is defused');
ok(/^2026-11-10 /.test(rows[1][0]),'dates are in the Kyiv time zone, sortable');
let saved=null;download=(n,t,ty)=>{saved={n,t,ty}};csvSave();ok(saved&&/^skladeno-rezultaty-\d{4}-\d{2}-\d{2}\.csv$/.test(saved.n)&&saved.ty==='text/csv','the CSV is saved under a dated name');
P.records=[];saved=null;csvSave();ok(saved===null,'without finished tests nothing is saved');
// 3. text report
const realForecast=stForecast;const rep=reportProgressText();ok(/^Звіт про прогрес · Складено · \d{4}-\d{2}-\d{2}/.test(rep)&&subjActive().every(s=>rep.includes(s.name+': розв’язано')),'the report names the four subjects of the exam');
ok(/точності ще немає/.test(rep),'a subject without answers says there is no accuracy yet, not 0%');
ok(/Останні 7 днів: завдань/.test(rep),'the week line says what it counts');
ok(/Серія днів:/.test(rep)&&/Останні пробники: ще не було/.test(rep)&&/Прогноз орієнтовний/.test(rep),'and the streak, the mocks and the honest note about the forecast');
P.answers={};S.answers={};const s0=SUBJECTS[0].id,qs0=PQ.filter(q=>q.subject===s0&&!q.examOnly).slice(0,4).map(q=>q.id);qs0.forEach((id,i)=>{P.answers[id]={value:0,score:i<3?1:0,max:1,first:i<3?1:0,attempts:1,at:1,due:1}});
stForecast=()=>({enough:true,scale:150,scaleLo:140,scaleHi:160});const rep2=reportProgressText();ok(/розв’язано 4 із \d+, точність 75%, орієнтовний прогноз 150 \(140–160\)/.test(rep2),'with enough data the report gives accuracy and the forecast range');stForecast=realForecast;P.answers={};
let printed=0,said='';toast=m=>{said=m};window.print=()=>{printed++};printPage();ok(printed===1&&said==='','the print button prints');
window.top={};printPage();ok(/друком браузера/.test(said),'inside a frame it also points to the browser print');window.top=undefined;
window.print=()=>{throw Error('x')};said='';printPage();ok(/недоступний/.test(said),'when printing throws, the user is told');toast=()=>{};
// 4. daily test
const d1=dailyIds('2026-11-15'),d2=dailyIds('2026-11-16');
ok(d1.length===12&&new Set(d1).size===12&&d1.every(id=>PM[id])&&JSON.stringify(d1)===JSON.stringify(dailyIds('2026-11-15')),'the daily set has 12 different tasks and is the same all day');
ok(JSON.stringify(d1)!==JSON.stringify(d2),'another day, another set');
ok(subjActive().every((s,i)=>d1.slice(i*3,i*3+3).every(id=>PM[id].subject===s.id)),'three tasks per subject, in subject order');
ok(d1.every(id=>!PQ.find(q=>q.id===id).examOnly),'tasks reserved for mocks are not used');
P.sessions={};P.answers={};S.answers={};dailyStart();ok(P.sessions[dailyKey()]&&P.sessions[dailyKey()].ids.length===12&&P.current===dailyKey(),'starting makes a practice session under today\'s key');
ok(P.sessions[dailyKey()].title==='Тест дня · '+pDay().split('-').reverse().join('.'),'the title carries the Kyiv date that the set was built from');
P.sessions[dailyKey()].index=5;dailyStart();ok(P.sessions[dailyKey()].index===5,'starting again keeps the place');
P.answers[dailyIds()[0]]={value:0,score:1,max:1,first:1,attempts:1,at:1,due:1};ok(dailyState().done===1&&dailyState().started,'progress is counted');
// 5. pomodoro
localStorage.removeItem(POMO_KEY);ok(pomoGet()===null,'no timer at start');
pomoStart();ok(pomoGet().phase==='work'&&pomoGet().end-Date.now()>24*60000,'start gives 25 minutes of work');
let heard=[];toast=m=>heard.push(m);
pomoSet({phase:'work',end:Date.now()-1000});heard=[];pomoTick();ok(pomoGet().phase==='rest'&&pomoGet().end-Date.now()>4*60000-2000&&/Час відпочити/.test(heard[0]),'when work ends, 5 minutes of rest begin and it is announced');
pomoSet({phase:'rest',end:Date.now()-1000});heard=[];pomoTick();ok(pomoGet()===null&&/Відпочинок закінчено/.test(heard[0]),'when rest ends, the timer stops and says so');
pomoSet({phase:'work',end:Date.now()-60*60000});heard=[];pomoTick();ok(pomoGet()===null&&heard.length===0,'a timer left from an hour ago is cleared without a false rest');
const wEnd=Date.now()-2*60000;pomoSet({phase:'work',end:wEnd});heard=[];pomoTick();ok(pomoGet().phase==='rest'&&pomoGet().end===wEnd+5*60000,'a work phase that ended 2 minutes ago leaves 3 minutes of rest counted from its real end');
pomoSet({phase:'rest',end:Date.now()-30*60000});heard=[];pomoTick();ok(pomoGet()===null&&heard.length===0,'an old rest phase is cleared silently');
localStorage.setItem(POMO_KEY,'{broken');ok(pomoGet()===null,'a broken record is ignored');localStorage.setItem(POMO_KEY,JSON.stringify({phase:'x',end:5}));ok(pomoGet()===null,'an unknown phase is ignored');
localStorage.setItem(POMO_KEY,JSON.stringify({phase:'work',end:1e20}));ok(pomoGet()===null,'an impossible time is ignored');pomoStop();ok(pomoGet()===null,'stop clears it');
ok(pomoClock(65000)==='1:05'&&pomoClock(-5)==='0:00','the clock text');
const realSet=localStorage.setItem;localStorage.setItem=()=>{throw Error('blocked')};heard=[];pomoStart();ok(/Не вдалося запустити/.test(heard[0])&&!heard.some(m=>/25 хвилин/.test(m)),'when storage is blocked the user is told and no countdown is promised');localStorage.setItem=realSet;
ok(!/залишилось/.test(pomoBox()),'the box on the page does not show a frozen countdown');toast=()=>{};
// 6. swipe
P.sessions={};const ids=PQ.filter(q=>!q.examOnly).slice(0,5).map(q=>q.id);pStart(ids,'s','sw');P.sessions.sw.index=2;location.hash='#practice';route='practice';
const touch=(dx,dy,target)=>{swipeStart={x:200,y:300,target:target||{closest(){return null}}};swipeEnd({changedTouches:[{clientX:200+dx,clientY:300+dy}]})};
localStorage.removeItem(SWIPE_KEY);touch(-120,10);ok(P.sessions.sw.index===3,'a swipe to the left goes to the next task');
touch(120,10);ok(P.sessions.sw.index===2,'to the right goes back');
touch(-30,0);ok(P.sessions.sw.index===2,'a short move is not a swipe');
touch(-120,100);ok(P.sessions.sw.index===2,'a mostly vertical move is a scroll');
touch(-120,0,{closest(){return {}}});ok(P.sessions.sw.index===2,'a swipe that starts in a field, a table or a scrolling strip is left alone');
window.visualViewport={scale:2};touch(-120,0);ok(P.sessions.sw.index===2,'a zoomed-in page is panned, not swiped');window.visualViewport=undefined;
swipeSet(false);touch(-120,0);ok(P.sessions.sw.index===2,'it can be switched off');swipeSet(true);
location.hash='#hub';touch(-120,0);ok(P.sessions.sw.index===2,'and it works only on task pages');location.hash='#practice';
swipeStart=null;swipeEnd({changedTouches:[{clientX:0,clientY:0}]});ok(P.sessions.sw.index===2,'a touch end without a start is ignored');
// 7. leaving the tab during a test
const mkExam=(id,stage)=>({id,stage:stage||1,finished:null,ids:[],answers:{}});
P.exam=mkExam('exam-1');leaves.key='';leaves.count=0;leaves.away=0;leaves.since=null;
document.visibilityState='hidden';leavesChange();ok(leaves.since&&leaves.key==='exam-1','leaving the tab during a mock is noticed');
leaves.since-=5000;document.visibilityState='visible';leavesChange();ok(leaves.count===1&&leaves.away>=5000&&/Виходів з вкладки під час цього тесту: 1/.test(leavesText()),'coming back counts one exit and the time away');
P.exam=mkExam('exam-1','break');document.visibilityState='hidden';leavesChange();const c1=leaves.count;document.visibilityState='visible';leavesChange();ok(leaves.count===c1,'the break of a full simulation does not count');
P.exam=mkExam('exam-2');document.visibilityState='hidden';leavesChange();ok(leaves.key==='exam-2'&&leaves.count===0,'a new mock, even of the same variant, starts a new count');document.visibilityState='visible';leavesChange();ok(leaves.count===1,'and counts its own exit');
P.exam=null;document.visibilityState='hidden';const c2=leaves.count;leavesChange();document.visibilityState='visible';leavesChange();ok(leaves.count===c2,'outside a mock nothing is counted');
P.exam={...mkExam('exam-3'),finished:Date.now()};ok(leavesKey()==='','a finished mock has no key');
leaves.count=0;ok(leavesText()==='','no exits, no text');P.exam=null;
// fullscreen
let fsFail=0;toast=()=>{fsFail++};document.fullscreenElement=null;document.documentElement.requestFullscreen=()=>Promise.reject(new Error('no'));fsToggle();await Promise.resolve();await Promise.resolve();ok(fsFail===1,'a refused full-screen request is reported, not lost');toast=()=>{};
log('fails',fails);
})();
