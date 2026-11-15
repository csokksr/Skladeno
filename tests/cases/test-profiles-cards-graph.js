// Profiles and hub blocks (93), own cards and speech (94), function graph and colour mode (95).
// TZ: America/New_York
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
let said=[];toast=m=>said.push(m);
// 1. profile names and store
ok(profClean('  Аня <b> "x" ')==='Аня b x'&&profClean('a'.repeat(40)).length===24,'a profile name loses markup and quotes and is cut to 24 characters');
localStorage.removeItem(PROF_KEY);localStorage.removeItem(PROF_ACTIVE);ok(profGet().active===PROF_DEFAULT&&Object.keys(profGet().list).length===1,'by default there is one profile');
localStorage.setItem(PROF_KEY,'{broken');ok(profGet().active===PROF_DEFAULT,'a broken store gives the default');
localStorage.setItem(PROF_KEY,JSON.stringify({active:'x',list:{'__proto__':{p:'a'},'Ok':{p:5,s:'s'},'<b>':{},['q'.repeat(30)]:{}}}));
const g=profGet();ok(Object.keys(g.list).join()==='Ok'&&g.list.Ok.p===null&&g.list.Ok.s==='s'&&g.active==='Ok','names that change when cleaned and prototype names are dropped, a bad active name falls back');
localStorage.removeItem(PROF_KEY);localStorage.removeItem(PROF_ACTIVE);
let r=profCreate('Аня');ok(r.ok&&profCount()===2,'a profile can be created');ok(!profCreate('аня').ok&&/вже є/.test(profCreate('аня').msg),'names are unique ignoring case');ok(/Введи назву/.test(profCreate('  ').msg),'an empty name is refused');
profCreate('Б');profCreate('В');ok(profCount()===4&&/не більше 4/.test(profCreate('Г').msg),'there are at most 4 profiles');
// switching
localStorage.setItem(PKEY,'{"mine":1}');localStorage.setItem(KEY,'{"hist":1}');let reloaded=0;const oc=confirm;
const sw=profSwitch('Аня',false);ok(sw.ok&&profGet().active==='Аня','switching makes the other profile active');
ok(localStorage.getItem(PKEY)===null&&localStorage.getItem(KEY)===null,'a new profile starts without progress');
ok(profGet().list[PROF_DEFAULT].p==='{"mine":1}'&&profGet().list[PROF_DEFAULT].s==='{"hist":1}','the previous profile\'s data waited in the store');
localStorage.setItem(PKEY,'{"anya":1}');localStorage.setItem(KEY,'{"anya-h":1}');
ok(profSwitch(PROF_DEFAULT,false).ok&&localStorage.getItem(PKEY)==='{"mine":1}'&&localStorage.getItem(KEY)==='{"hist":1}','and comes back unchanged');
ok(profGet().list['Аня'].p==='{"anya":1}'&&profGet().list[PROF_DEFAULT].p===null,'while the other waits in the store and the active one is not duplicated');
ok(!profSwitch(PROF_DEFAULT,false).ok&&!profSwitch('нема',false).ok,'switching to the active or to an unknown profile does nothing');
// storage failure rolls back
const before=localStorage.getItem(PROF_KEY),realSet=localStorage.setItem;let n=0;localStorage.setItem=(k,v)=>{if(k===PKEY)throw Error('quota');return realSet.call(localStorage,k,v)};
const bad=profSwitch('Аня',false);localStorage.setItem=realSet;ok(!bad.ok&&profGet().active===PROF_DEFAULT&&localStorage.getItem(PKEY)==='{"mine":1}','a failed write cancels the switch and leaves the data alone');
// delete
ok(!profDelete(PROF_DEFAULT).ok&&profDelete('Б').ok&&profCount()===3&&!profDelete('нема').ok,'the active profile cannot be deleted, others can');
// sync blocks it
window.webUid='u1';ok(!profCreate('Д').ok&&/синхронізує/.test(profCreate('Д').msg)&&!profSwitch('Аня',false).ok,'with account sync profiles are off');delete window.webUid;
localStorage.removeItem(PROF_KEY);localStorage.removeItem(PROF_ACTIVE);
// profile safety: banned names, corrupt store, recovery, stale pages, flush
ok(/недоступна/.test(profCreate('constructor').msg)&&/недоступна/.test(profCreate('__proto__').msg)&&/недоступна/.test(profCreate('Prototype').msg),'names that clash with object internals are refused up front');
localStorage.setItem(PROF_KEY,'{broken');ok(/пошкоджено/.test(profCreate('Нова').msg)&&localStorage.getItem(PROF_KEY)==='{broken'&&!profSwitch('x',false).ok,'a damaged store is never overwritten');localStorage.removeItem(PROF_KEY);localStorage.removeItem(PROF_ACTIVE);
profCreate('Т');importRecoveryStatus='blocked';ok(/відновлення/.test(profCreate('Т2').msg)&&!profSwitch('Т',false).ok&&!profDelete('Т').ok,'while a restore is unfinished nothing moves');importRecoveryStatus='';
localStorage.setItem(IMPORT_JOURNAL,'{}');ok(!profSwitch('Т',false).ok,'a restore journal blocks it too');localStorage.removeItem(IMPORT_JOURNAL);
const rs0=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k===PKEY||k===KEY)throw Error('q');return rs0.call(localStorage,k,v)};const noSave=profSwitch('Т',false,true);localStorage.setItem=rs0;pStorage=true;storageOK=true;
ok(/Не вдалося зберегти поточний прогрес/.test(noSave.msg)&&profGet().active===PROF_DEFAULT,'when the current progress cannot be saved the switch is refused and nothing changes');
const oldRuns=testsRuns;testsRuns=()=>[{kind:'exam'}];ok(/тест із таймером/.test(profSwitch('Т',false,true).msg),'a timed test blocks switching');testsRuns=oldRuns;
// stale page: another tab switched the profile
let sav=0;const baseWrites=localStorage.getItem(PKEY);localStorage.setItem(PROF_ACTIVE,'Т');localStorage.setItem(PKEY,'{"other":1}');said=[];pSave();ok(localStorage.getItem(PKEY)==='{"other":1}'&&/в іншій вкладці/.test(said.join()),'a page whose profile was changed elsewhere does not overwrite the other profile');
profStale=false;profStale=false;localStorage.setItem(PROF_ACTIVE,profLoaded);pSave();ok(localStorage.getItem(PKEY)!=='{"other":1}','with the same profile again, saving works');
// rollback restores the active name too
localStorage.removeItem(PROF_KEY);localStorage.removeItem(PROF_ACTIVE);profLoaded=PROF_DEFAULT;profStale=false;profCreate('Р');{const oo=profGet();oo.list['Р'].p='{"t":1}';profPut(oo)}localStorage.setItem(PKEY,'{"m":1}');const rs=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k===PKEY&&v!=='{"m":1}')throw Error('q');return rs.call(localStorage,k,v)};
const fail=profSwitch('Р',false);localStorage.setItem=rs;ok(!fail.ok&&profActive()===PROF_DEFAULT&&profGet().active===PROF_DEFAULT,'a failed switch puts back the stored active name as well');
// after a real switch the old page writes nothing until it is reloaded
localStorage.removeItem(PKEY);
localStorage.removeItem(PROF_KEY);localStorage.removeItem(PROF_ACTIVE);profLoaded=PROF_DEFAULT;profStale=false;
// 2. hub blocks
localStorage.removeItem(HUB_KEY);ok(hubHidden().length===0,'nothing is hidden at first');
hubSet(['st-forecast','h:Предмети']);ok(hubHidden().join()==='st-forecast,h:Предмети','a choice is stored');
localStorage.setItem(HUB_KEY,JSON.stringify(['ok',5,'x'.repeat(100),null]));ok(hubHidden().join()==='ok','only short text keys are kept');
localStorage.setItem(HUB_KEY,'{broken');ok(hubHidden().length===0,'a broken record is ignored');
const mkEl=(cls,head)=>({hidden:false,classList:{contains:c=>cls.includes(c)},matches:()=>false,querySelector:()=>head?{textContent:head}:null});
const els=[mkEl(['ob-card'],'Налаштуй план'),mkEl(['st-forecast'],'Де ти зараз'),mkEl(['p-section'],'Предмети'),mkEl(['p-alert'],'')];
const mainStub={children:els};
const bl=hubBlocks(mainStub);ok(bl.map(b=>b.key).join()==='ob-card,st-forecast,h:Предмети','blocks are told apart by a known class or by their heading, blocks without either are skipped');
hubSet(['st-forecast']);hubApply(mainStub);ok(els[1].hidden===true&&els[0].hidden===false,'a hidden block is hidden and the others stay');
hubSet(hubHidden().filter(k=>k!=='st-forecast'));hubApply(mainStub);ok(els[1].hidden===false&&hubHidden().length===0,'turning it on shows it again');
hubSet([...hubHidden(),'h:Предмети']);hubApply(mainStub);ok(els[2].hidden===true,'turning it off hides it');
localStorage.removeItem(HUB_KEY);
// 3. own cards: normalisation and learning
const day=i=>new Date(Date.parse(pDay()+'T12:00:00Z')+i*86400000).toISOString().slice(0,10);
const dirty=extNormal({cards:[{id:'cab12',f:' слово ',b:'переклад',l:'en',x:2,d:day(1)},{id:'bad id',f:'x',b:'y'},{id:'cab12',f:'дубль',b:'y'},{id:'cdef3',f:'',b:'y'},{id:'cghi4',f:'a'.repeat(400),b:'b'.repeat(900),x:9,d:'2026-13-45',l:'zz'},{id:'cjkl5',f:5,b:'y'},null]});
ok(dirty.cards.length===2&&dirty.cards[0].f==='слово'&&dirty.cards[0].l==='en'&&dirty.cards[0].x===2,'cards are cleaned: bad ids, duplicates, empty and non-text cards drop out');
ok(dirty.cards[1].f.length===300&&dirty.cards[1].b.length===600&&dirty.cards[1].x===0&&dirty.cards[1].l==='uk'&&dirty.cards[1].d===pDay(),'long text is cut, bad box, language and date get defaults');
ok(extNormal({cards:Array.from({length:400},(_,i)=>({id:'c'+i.toString(36).padStart(4,'0'),f:'f'+i,b:'b'})) }).cards.length===300,'at most 300 cards');
ok(extNormal({}).cards.length===0&&pNormal({schema:1,answers:{},ext:{cards:[{id:'cab12',f:'a',b:'b'}]}}).ext.cards.length===1,'cards pass through an imported progress');
P.ext=extFresh();P.answers={};
ok(!cardAdd('','x').ok&&!cardAdd('x','').ok,'both sides are required');
ok(!cardAdd('\u0001\u0002','y').ok&&P.ext.cards.length===0,'a card made only of control characters is refused, as extNormal would drop it anyway');
ok(cardAdd('apple','яблуко','en').ok&&P.ext.cards.length===1&&P.ext.cards[0].x===0&&P.ext.cards[0].d===pDay(),'a new card is due today in box 1');
ok(!cardAdd('Apple','яблуко').ok&&/вже є/.test(cardAdd('Apple','яблуко').msg),'the same card twice is refused');
const id=P.ext.cards[0].id;ok(/^c[0-9a-z]{3,12}$/.test(id),'the id has the allowed form');
cardGrade(id,true);ok(P.ext.cards[0].x===1&&P.ext.cards[0].d===day(1),'"knew" moves it to box 2 for tomorrow');
cardGrade(id,true);ok(P.ext.cards[0].x===2&&P.ext.cards[0].d===day(3),'then 3 days');
cardGrade(id,true);cardGrade(id,true);cardGrade(id,true);ok(P.ext.cards[0].x===4&&P.ext.cards[0].d===day(14),'the last box is 14 days and does not go higher');
cardGrade(id,false);ok(P.ext.cards[0].x===0&&P.ext.cards[0].d===pDay(),'"did not know" returns it to box 1 for today');
ok(cardsDue().length===1&&!cardGrade('nope',true),'due cards are listed, an unknown card is refused');
P.ext.cards[0].d=day(2);ok(cardsDue().length===0,'a card due later is not shown today');
ok(cardDelete(id)===1&&P.ext.cards.length===0&&cardDelete(id)===0,'a card can be deleted once');
cardsPage();ok(/Карток ще немає/.test($('#main')._h),'the page invites to add the first card');
cardAdd('<b>x</b>','"y"','uk');cardsPage();ok(!/<b>x<\/b>/.test($('#main')._h)&&/&lt;b&gt;x&lt;\/b&gt;/.test($('#main')._h),'card text is escaped on the page');P.ext.cards=[];
// 4. speech
ok(ttsOk()===false,'the test page has no speech engine');said=[];ttsSpeak('hello');ok(/недоступне/.test(said[0]),'without an engine the user is told');
let spoken=null,cancelled=0;window.speechSynthesis={getVoices:()=>[{lang:'en-GB'}],cancel(){cancelled++},speak(u){spoken=u}};window.SpeechSynthesisUtterance=function(t){this.text=t};
const timers=[];const oldTimeout=setTimeout;setTimeout=(f,ms)=>{timers.push([f,ms]);return 0};
ok(ttsOk(),'with an engine speech is available');ttsSpeak('  Hello  ⟦§b§world⟧ ');ok(spoken&&spoken.text==='Hello world'&&spoken.lang==='en-GB'&&cancelled===1,'markup is stripped, the voice is English and the previous speech is cancelled');
spoken=null;window.speechSynthesis.getVoices=()=>[{lang:'fr-FR'}];said=[];ttsSpeak('hello');ok(spoken===null&&/немає голосу/.test(said[0]),'without a matching voice nothing is spoken and the user is told');
window.speechSynthesis.getVoices=()=>[];said=[];timers.length=0;ttsSpeak('hello');ok(spoken&&timers.length===1,'an empty voice list is not trusted: it speaks and watches whether the speech starts');
timers[0][0]();ok(/не почалося/.test(said[0]),'if it never starts the user is told');
said=[];timers.length=0;ttsSpeak('hello');spoken.onstart();timers[0][0]();ok(said.length===0,'a short word that started and ended is not reported as a failure');
said=[];spoken.onerror({error:'canceled'});ok(said.length===0,'a cancelled speech is not an error');spoken.onerror({error:'synthesis-failed'});ok(/не почалося/.test(said[0]),'a real error is reported');
window.speechSynthesis.getVoices=()=>[{lang:'en-US'}];spoken=null;ttsSpeak('x'.repeat(3000));ok(spoken.text.length===1500,'long text is cut');
P.sessions={};route='practice';const eq=PQ.find(q=>q.subject==='eng'&&q.type==='single'),uq=PQ.find(q=>q.subject==='ukr'&&q.type==='single');
pStart([eq.id],'e','eng');spoken=null;said=[];ttsSpeakTask();const engText=(eq.passage?eq.passage+'. ':'')+eq.prompt,lat=(engText.match(/[A-Za-z]/g)||[]).length,cyr=(engText.match(/[А-Яа-яІіЇїЄєҐґ]/g)||[]).length;
ok(lat>=cyr?spoken!==null:/українською/.test(said[0]),'an English task is read, a task in Ukrainian is not');
let cx=0;window.speechSynthesis.cancel=()=>{cx++};location.hash='#hub';render();ok(cx>=1,'speech is cancelled when the page changes');
setTimeout=oldTimeout;delete window.speechSynthesis;delete window.SpeechSynthesisUtterance;
// 5. parser
const ev=(s,x=0)=>grParse(s)(x);const near=(a,b)=>Math.abs(a-b)<1e-9;
ok(ev('1+2*3')===7&&ev('(1+2)*3')===9&&ev('2^3^2')===512&&ev('-2^2')===-4&&ev('2^-1')===.5,'precedence: * over +, ^ is right-associative, unary minus is weaker than ^');
ok(ev('2x',3)===6&&ev('2(x+1)',3)===8&&ev('(x+1)(x-1)',3)===8&&ev('x(x+1)',2)===6&&ev('3sin(x)',0)===0,'implicit multiplication');
ok(near(ev('sin(pi/2)'),1)&&near(ev('ln(e)'),1)&&ev('log(1000)')===3&&ev('sqrt(16)')===4&&ev('abs(-3)')===3&&near(ev('exp(0)'),1)&&near(ev('π'),Math.PI),'functions and constants');
ok(ev('2,5*2')===5&&ev('1.5e2')===150&&ev('2e')===2*Math.E&&ev('x^2-4',3)===5,'a decimal comma, scientific notation, 2e as 2*e');
ok(ev('X^2',3)===9&&ev(' 1 + 1 ')===2&&ev('2·3')===6&&ev('5−2')===3,'case, spaces, ·, and the typographic minus');
ok(Number.isNaN(ev('sqrt(x)',-1))&&ev('1/x',0)===Infinity,'values outside the domain are NaN or infinite, not exceptions');
for(const bad of ['1 2','2 3x','','1+','(1+2','1+2)','foo(1)','sin 1','2 $ 3','x^','*3','1..2','a'.repeat(130),'('.repeat(80)+'1'+')'.repeat(80)]){let msg='';try{grParse(bad)}catch(e){msg=e.message}ok(msg!=='','"'+bad.slice(0,12)+'" is refused with a message')}
ok(!/eval|Function\(/.test(String(grParse)+String(grTokens)),'the parser does not use eval');
ok(ev('tg(0)')===0&&near(ev('arctg(1)'),Math.PI/4)&&ev('lg(100)')===2&&near(ev('arcsin(1)'),Math.PI/2)&&near(ev('ctg(pi/4)'),1)&&near(ev('arccos(1)'),0),'Ukrainian names of trigonometric and decimal-log functions work');
// 6. plotting
gr={f:'x^2-4',xmin:'-10',xmax:'10',ymin:'',ymax:''};let p=grPlot();ok(!p.err&&p.svg&&p.svg.includes('<path')&&p.roots.length===2&&near(Math.round(p.roots[0]*1e4)/1e4,-2)&&near(Math.round(p.roots[1]*1e4)/1e4,2),'x^2-4 has zeros at -2 and 2');
ok(/Нулі приблизно: -2, 2/.test(p.label)&&/Серед обчислених точок найменше значення приблизно -4/.test(p.label)&&p.rows[0][0]===-10&&p.rows.length===21,'the text equivalent names the zeros, the minimum and gives a table');
gr={f:'x^2',xmin:'-3',xmax:'4',ymin:'',ymax:''};p=grPlot();ok(p.roots.length===1&&Math.abs(p.roots[0])<1e-6,'a touching zero (x^2) is found');
gr={f:'(x-3.14)^2',xmin:'0',xmax:'6',ymin:'',ymax:''};p=grPlot();ok(p.roots.length===1&&Math.abs(p.roots[0]-3.14)<1e-6,'a touching zero off the grid is found');
gr={f:'x-3',xmin:'0',xmax:'3',ymin:'',ymax:''};p=grPlot();ok(p.roots.length===1&&Math.abs(p.roots[0]-3)<1e-9,'a zero exactly at the last point is found');
gr={f:'x^2+1',xmin:'-3',xmax:'3',ymin:'',ymax:''};p=grPlot();ok(p.roots.length===0&&/Нулів серед обчислених точок не знайдено/.test(p.label),'no zero is said as "none among the computed points", not as a fact about the function');
gr={f:'sin(x)',xmin:'0',xmax:'10',ymin:'',ymax:''};p=grPlot();ok(p.roots.length===4&&Math.abs(p.roots[1]-Math.PI)<1e-6,'sin(x) on [0;10] has zeros at 0, pi, 2pi and 3pi');
gr={f:'2^x',xmin:'20',xmax:'40',ymin:'',ymax:''};p=grPlot();ok(p.rows.find(r=>r[0]===31)[1]==='завелике (понад мільярд)'&&p.rows.find(r=>r[0]===25)[1]!=='не існує','a value over a billion is "too large", not "does not exist"');
gr={f:'x',xmin:'0',xmax:'1e-15',ymin:'',ymax:''};ok(/Межі x/.test(grPlot().err),'a tiny x interval is refused, it cannot freeze the page');gr={f:'x',xmin:'-1',xmax:'1',ymin:'0',ymax:'1e-15'};ok(/Межі y/.test(grPlot().err),'and a tiny y interval too');
gr={f:'x',xmin:'-1',xmax:'1',ymin:'-1e12',ymax:'1e12'};ok(/Межі y/.test(grPlot().err),'huge y limits are refused');
ok(grTicks(0,1e-6,1e-12).length<=60&&grTicks(-10,10,5).join()==='-10,-5,0,5,10','tick lists are capped and exact');ok(grNice(0)===1&&grNice(NaN)===1,'a degenerate range gives a safe step');
gr={f:'1/x',xmin:'-10',xmax:'10',ymin:'',ymax:''};p=grPlot();ok(!p.err&&p.roots.length===0,'1/x has no zero: a pole is not a root');ok(p.svg.includes('M'),'the line is drawn');
gr.f='sqrt(x)';gr.xmin='-5';gr.xmax='5';p=grPlot();ok(!p.err&&p.rows.find(r=>r[0]===-1)[1]==='не існує','outside the domain the table says the value does not exist');
gr.f='sqrt(-x^2-1)';p=grPlot();ok(p.err==='У цьому проміжку функція не має значень.','a function with no values on the interval says so');
gr={f:'x',xmin:'5',xmax:'1',ymin:'',ymax:''};ok(/Межі x/.test(grPlot().err),'reversed limits are refused');gr={f:'x',xmin:'-1',xmax:'1e9',ymin:'',ymax:''};ok(/Межі x/.test(grPlot().err),'huge limits are refused');
gr={f:'x',xmin:'-1',xmax:'1',ymin:'3',ymax:''};ok(/Межі y/.test(grPlot().err),'one y limit alone is refused');gr={f:'x',xmin:'-1',xmax:'1',ymin:'-2',ymax:'2'};ok(!grPlot().err,'both y limits work');
gr={f:'x+',xmin:'-1',xmax:'1',ymin:'',ymax:''};graphPage();ok(/role="alert"/.test($('#main')._h)&&/aria-invalid="true"/.test($('#main')._h),'a bad formula is shown as an error on the field');
gr={f:'<script>',xmin:'-1',xmax:'1',ymin:'',ymax:''};graphPage();ok(!/<script>/.test($('#main')._h),'the formula is escaped on the page');
gr={f:'x^2',xmin:'-3',xmax:'3',ymin:'',ymax:''};graphPage();ok(/role="img"/.test($('#main')._h)&&/aria-label="Графік функції y = x\^2/.test($('#main')._h),'the plot is an image with a text label');
ok(grNice(20)===5||grNice(20)===2,'tick steps are round numbers');ok(grFmt(1/3)==='0,333333'&&grFmt(1e-12)==='0'&&grFmt(-2)==='-2','numbers are written with a decimal comma');
// 7. colour mode
localStorage.removeItem(CVD_KEY);ok(!cvdOn(),'off by default');cvdSet(true);ok(cvdOn()&&document.documentElement.dataset.cvd==='on','on sets the page flag');cvdSet(false);ok(!cvdOn()&&!('cvd' in document.documentElement.dataset),'off removes it');
log('fails',fails);
})();
