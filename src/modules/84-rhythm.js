// Ритм навчання (#rhythm): серія днів, щоденна й тижнева цілі, підсумок тижня, час роботи на сайті, ефективність за часом доби,
// калібрування впевненості, відпустка, експорт у календар. Окремо: чекліст дня іспиту на сторінці «Стратегія НМТ».
// Дані лежать у P.ext (потрапляють у копію й імпорт-гард): check, goal, vac (поточна відпустка), vacs (завершені), hours.
// Час на сайті живе окремо в localStorage (skladeno-time), щоб не переписувати весь прогрес щохвилини.
const EXT_DAY=86400000,EXT_DAYRE=/^\d{4}-\d{2}-\d{2}$/;
const EXT_CHECK=[['c1','Вимоги на сайті УЦОЯО перевірено'],['c2','За тиждень до іспиту: без нових тем, лише помилки, картки й 1–2 повні симуляції'],['c3','Напередодні виспатися'],['c4','Запрошення-перепустка й документ, указаний у ньому, з собою'],['c5','Прийти заздалегідь']];
// Дата справжня, а не лише схожа на дату.
const extDateOk=s=>typeof s==='string'&&EXT_DAYRE.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const extSpanOk=v=>!!v&&extDateOk(v.from)&&extDateOk(v.until)&&v.until>=v.from&&Date.parse(v.until+'T12:00:00Z')-Date.parse(v.from+'T12:00:00Z')<=60*EXT_DAY;
const EXT_CARDS_MAX=300;
function extFresh(){return {check:{},goal:{daily:10,weekly:2},vac:null,vacs:[],hours:{},cards:[]}}
function extNormal(r){const n=extFresh();if(!r||typeof r!=='object')return n;
 for(const [id] of EXT_CHECK)if(r.check?.[id]===true)n.check[id]=true;
 if([0,5,10,20,30].includes(r.goal?.daily))n.goal.daily=r.goal.daily;if([0,1,2,3,5].includes(r.goal?.weekly))n.goal.weekly=r.goal.weekly;
 if(extSpanOk(r.vac))n.vac={from:r.vac.from,until:r.vac.until,t:Number.isFinite(r.vac.t)&&r.vac.t>0?r.vac.t:Date.parse(r.vac.from+'T00:00:00Z')};
 if(Array.isArray(r.vacs))n.vacs=r.vacs.filter(extSpanOk).slice(-24).map(v=>({from:v.from,until:v.until}));
 if(r.hours&&typeof r.hours==='object')for(let h=0;h<24;h++){const x=r.hours[h];if(Array.isArray(x)&&Number.isSafeInteger(x[0])&&Number.isSafeInteger(x[1])&&x[0]>0&&x[0]<=1e6&&x[1]>=0&&x[1]<=x[0])n.hours[h]=[x[0],x[1]]}
 // Власні картки (94-own-cards.js): до 300, id c+латиниця/цифри, текст без керівних символів, коробка 0–4, дата наступного повторення.
 if(Array.isArray(r.cards)){const seen=new Set(),txt=(s,n)=>s.replace(/[\u0000-\u0008\u000b-\u001f]/g,'').trim().slice(0,n);
  for(const c of r.cards){if(n.cards.length>=EXT_CARDS_MAX)break;if(!c||typeof c.f!=='string'||typeof c.b!=='string'||typeof c.id!=='string'||!/^c[0-9a-z]{3,12}$/.test(c.id)||seen.has(c.id))continue;
   const f=txt(c.f,300),b=txt(c.b,600);if(!f||!b)continue;seen.add(c.id);n.cards.push({id:c.id,f,b,l:c.l==='en'?'en':'uk',x:Number.isInteger(c.x)&&c.x>=0&&c.x<=4?c.x:0,d:extDateOk(c.d)?c.d:pDay()})}}
 return n}
const extFreshBase=pFresh;pFresh=function(){return {...extFreshBase(),ext:extFresh()}};
const extNormBase=pNormal;pNormal=function(raw){const n=extNormBase(raw);n.ext=extNormal(raw.ext);return n};
// Базові функції працювали вже під час завантаження, тож збережене читаємо ще раз.
try{P.ext=extNormal(JSON.parse(restoreRead(PKEY)||'null')?.ext)}catch{P.ext=extFresh()}
// Дні: ключі як у P.logs (за Києвом) і S.days; арифметика від pDay() у полудень UTC, без переходів на літній час.
const extDay=i=>new Date(Date.parse(pDay()+'T12:00:00Z')-i*EXT_DAY).toISOString().slice(0,10);
const extAct=d=>(P.logs[d]||0)+(S.days?.[d]||0);
const extKey=ms=>new Date(ms).toLocaleDateString('en-CA',{timeZone:'Europe/Kyiv'});
const extVacOn=()=>!!P.ext.vac&&pDay()<=P.ext.vac.until;
const extVacDay=d=>(!!P.ext.vac&&d>=P.ext.vac.from&&d<=P.ext.vac.until)||P.ext.vacs.some(v=>d>=v.from&&d<=v.until);
// Дні відпустки після моменту ms (для «скільки днів без пробника»).
function extVacDaysSince(ms){const from=extKey(ms);let n=0;for(let i=0;i<400;i++){const d=extDay(i);if(d<from)break;if(extVacDay(d)&&d<=pDay())n++}return n}
// Відпустка: після завершення терміни повторень, що припали на неї або пізніше, зсуваються на кількість днів паузи.
function extVacStart(n){if(P.ext.vac)return;const f=pDay();P.ext.vac={from:f,until:new Date(Date.parse(f+'T12:00:00Z')+(n-1)*EXT_DAY).toISOString().slice(0,10),t:Date.now()};pSave();toast('Відпустку почато: '+stPlural(n,'день','дні','днів')+'.');extPage()}
// Зсув лише для відповідей, дані до початку відпустки, строк яких припав на неї або пізніше. Робиться за кнопкою, а не під час малювання сторінки.
// Інтервали SM-2 (P.study.srs) не чіпаємо: поле d там означає день останньої оцінки, а не строк.
function extVacDays(){const v=P.ext.vac;if(!v)return 0;const today=pDay(),last=today<v.until?today:v.until;return Math.max(0,Math.round((Date.parse(last+'T12:00:00Z')-Date.parse(v.from+'T12:00:00Z'))/EXT_DAY)+(today>v.until?1:0))}
function extVacEnd(){const v=P.ext.vac;if(!v)return null;const days=extVacDays(),today=pDay();
 if(days>0)for(const a of [...Object.values(P.answers),...Object.values(S.answers)])if(a.at<v.t&&a.due>=v.t)a.due+=days*EXT_DAY;
 P.ext.vacs=[...P.ext.vacs,{from:v.from,until:today<v.until?today:v.until}].slice(-24);P.ext.vac=null;pSave();save();return days}
function extVacStop(){const d=extVacEnd();if(d===null)return;toast('Відпустку закінчено. Повторення зсунуто на '+stPlural(d,'день','дні','днів')+'.');extPage()}
function extVacNotice(){const v=P.ext.vac;if(!v||pDay()<=v.until)return '';const d=extVacDays();return `<section class="p-alert"><div><h2>Відпустка закінчилась</h2><p>Повторення, строк яких припав на відпустку, можна зсунути на ${stPlural(d,'день','дні','днів')}, щоб вони не накопичилися.</p></div><button class="primary" onclick="extVacStop()">Зсунути повторення</button></section>`}
// Серія: підряд дні із завданнями (дні відпустки не рвуть серію); якщо сьогодні ще нічого, рахуємо від учора.
function extStreak(){const on=d=>extAct(d)>0||extVacDay(d);let i=on(extDay(0))?0:1,cur=0;while(on(extDay(i))&&cur<3650){cur++;i++}
 const days=new Set([...Object.keys(P.logs),...Object.keys(S.days||{})].filter(k=>extAct(k)>0));let best=0,run=0,prev=null;for(const d of [...days].sort()){run=prev&&Math.round((Date.parse(d+'T12:00:00Z')-Date.parse(prev+'T12:00:00Z'))/EXT_DAY)===1?run+1:1;best=Math.max(best,run);prev=d}return {cur,best:Math.max(best,cur)}}
function extWeekStart(){const d=new Date(Date.parse(pDay()+'T12:00:00Z')),off=(d.getUTCDay()+6)%7;return new Date(d.getTime()-off*EXT_DAY).toISOString().slice(0,10)}
function extTestsSince(key){return [...(P.records||[]).filter(r=>!r.short).map(r=>r.finished),...(P.official?.records||[]).map(r=>r.finished),...(P.coach?.results||[]).map(r=>r.finished)].filter(t=>Number.isFinite(t)&&extKey(t)>=key).length}
function extGoal(kind,v){const n=Number(v);if(kind==='daily'&&[0,5,10,20,30].includes(n))P.ext.goal.daily=n;else if(kind==='weekly'&&[0,1,2,3,5].includes(n))P.ext.goal.weekly=n;else return;pSave();extPage()}
// Підсумок тижня: останні 7 днів проти попередніх 7.
function extWeek(k){let tasks=0,active=0;for(let i=k*7;i<k*7+7;i++){const n=extAct(extDay(i));tasks+=n;if(n)active++}
 const from=extDay(k*7+6),to=extDay(k*7),mocks=(P.records||[]).filter(r=>!r.short&&r.finished&&extKey(r.finished)>=from&&extKey(r.finished)<=to);
 return {tasks,active,mocks:mocks.length,avg:mocks.length?Math.round(mocks.reduce((s,r)=>s+(r.max?100*r.score/r.max:0),0)/mocks.length):null}}
function extSummary(){const a=extWeek(0),b=extWeek(1),d=(x,y,u='')=>x===null||y===null?'':x>y?` (+${x-y}${u} до попереднього тижня)`:x<y?` (−${y-x}${u} до попереднього тижня)`:' (як і тиждень тому)';
 return `<ul><li>Завдань: ${a.tasks}${d(a.tasks,b.tasks)}</li><li>Днів із заняттями: ${a.active} із 7${d(a.active,b.active)}</li><li>Пробників: ${a.mocks}${d(a.mocks,b.mocks)}</li><li>${a.avg===null?'Середній результат пробників: пробників за тиждень не було':`Середній результат пробників: ${a.avg}%${d(a.avg,b.avg,' п. п.')}`}</li></ul>`}
// Час роботи на сайті: секунди, коли вкладка видима й була дія за останню хвилину. Лише цей браузер, окремий ключ (прогрес не переписується).
const EXT_TIME_KEY='skladeno-time';let extIdle=Date.now(),extTicks=0,extPend=0;
function extSecRead(){try{const o=JSON.parse(localStorage.getItem(EXT_TIME_KEY)||'{}'),n={};for(const k of Object.keys(o).filter(extDateOk).sort().slice(-60)){const v=o[k];if(Number.isFinite(v)&&v>0&&v<=86400)n[k]=Math.round(v)}return n}catch{return {}}}
function extSecFlush(){if(!extPend)return;const n=extSecRead(),d=pDay();n[d]=Math.min(86400,(n[d]||0)+extPend);extPend=0;try{localStorage.setItem(EXT_TIME_KEY,JSON.stringify(n))}catch{}}
for(const ev of ['pointerdown','keydown','scroll'])addEventListener(ev,()=>{extIdle=Date.now()},true);
addEventListener('pagehide',extSecFlush);
setInterval(()=>{if(document.visibilityState==='hidden'||Date.now()-extIdle>60000)return;extPend+=15;if(++extTicks%4===0)extSecFlush()},15000);
const extMin=s=>stPlural(Math.round(s/60),'хвилина','хвилини','хвилин');
function extTimeHtml(){extSecFlush();const s=extSecRead(),today=s[extDay(0)]||0;let week=0,days=0;for(let i=0;i<7;i++){const v=s[extDay(i)]||0;week+=v;if(v)days++}
 return `<p>Сьогодні: ${extMin(today)}. За 7 днів: ${extMin(week)}${days?', у середньому '+extMin(week/days)+' за день із заняттями':''}.</p><p class="p-caption">Рахується час, коли вкладка відкрита й була дія за останню хвилину. Облік почався з цієї версії й лишається лише в цьому браузері.</p>`}
// Ефективність за часом доби: частка правильних відповідей серед перевірок (локальний час пристрою).
const EXT_PARTS=[['Ніч (0–6)',0,6],['Ранок (6–12)',6,12],['День (12–18)',12,18],['Вечір (18–24)',18,24]];
function extHoursHtml(){const rows=EXT_PARTS.map(([name,a,b])=>{let n=0,g=0;for(let h=a;h<b;h++){const x=P.ext.hours[h];if(x){n+=x[0];g+=x[1]}}return {name,n,g}}),total=rows.reduce((s,r)=>s+r.n,0);
 if(total<10)return '<p class="p-empty">Мало даних: потрібно хоча б 10 перевірених завдань. Облік почався з цієї версії.</p>';
 const ok=rows.filter(r=>r.n>=5),best=ok.length>1?[...ok].sort((x,y)=>y.g/y.n-x.g/x.n)[0]:null;
 return `<ul class="p-topic-list">${rows.map(r=>`<li><div><strong>${r.name}</strong>: ${r.n?Math.round(100*r.g/r.n)+'% правильно':'—'} (перевірок: ${r.n})${r.n?bar(r.g,r.n):''}</div></li>`).join('')}</ul>${best?`<p class="p-caption">Найточніше: ${best.name}. Це лише твої перевірки, різниця може бути випадковою.</p>`:''}`}
const extCheckBase=pCheck;pCheck=function(){const q=pQ(),nP=q&&P.answers[q.id]?.attempts||0,nS=q&&S.answers[q.id]?.attempts||0;extCheckBase();if(!q)return;
 const a=(P.answers[q.id]?.attempts||0)>nP?P.answers[q.id]:(S.answers[q.id]?.attempts||0)>nS?S.answers[q.id]:null;if(!a)return;
 const h=new Date().getHours(),x=P.ext.hours[h]||[0,0];P.ext.hours[h]=[x[0]+1,x[1]+(a.score>=a.max?1:0)];pSave()};
// Калібрування: точність першої спроби за впевненістю, обраною перед відповіддю.
function extCalibHtml(){const aa=pAnswers(),rows=[[1,'Припускаю'],[2,'Маю сумніви'],[3,'Впевнений']].map(([v,l])=>{let n=0,g=0;for(const [id,it] of Object.entries(P.coach?.items||{})){const a=aa[id];if(it.confidence===v&&a){n++;if((a.first??a.score)>=a.max)g++}}return {l,n,g}}),total=rows.reduce((s,r)=>s+r.n,0);
 if(total<5)return '<p class="p-empty">Мало даних. Познач упевненість перед відповіддю в маршруті повторення, і тут з’явиться порівняння.</p>';
 const sure=rows[2];return `<ul class="p-topic-list">${rows.map(r=>`<li><div><strong>${r.l}</strong>: ${r.n?Math.round(100*r.g/r.n)+'% правильно':'—'} (завдань: ${r.n})${r.n?bar(r.g,r.n):''}</div></li>`).join('')}</ul>${sure.n?`<p class="p-caption">Упевнено, але з помилкою: ${sure.n-sure.g} із ${sure.n}. Такі завдання варто розібрати в першу чергу.</p>`:''}`}
// Календар (.ics): дата НМТ із налаштувань сайту й щоденний час для занять до цієї дати.
function extIcsEsc(s){return String(s).replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n')}
// Рядки календаря довші за 75 октетів складаються (RFC 5545, 3.1): CRLF і пробіл; символ не розрізається.
function extIcsFold(line){const out=[];let cur='',bytes=0;for(const ch of line){const b=ch.codePointAt(0)<0x80?1:ch.codePointAt(0)<0x800?2:ch.codePointAt(0)<0x10000?3:4;if(bytes+b>(out.length?74:75)){out.push(cur);cur='';bytes=0}cur+=ch;bytes+=b}out.push(cur);return out.join('\r\n ')}
function extIcs(time,minutes){const exam=stExamDate(),ymd=s=>s.replace(/-/g,''),next=new Date(Date.parse(exam+'T12:00:00Z')+EXT_DAY).toISOString().slice(0,10),stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,''),hm=time.replace(':','')+'00',
 L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Складено//UK','CALSCALE:GREGORIAN',
 'BEGIN:VEVENT','UID:exam-'+exam+'@skladeno','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+ymd(exam),'DTEND;VALUE=DATE:'+ymd(next),'SUMMARY:'+extIcsEsc('НМТ (дата з налаштувань сайту «Складено»)'),'DESCRIPTION:'+extIcsEsc('Перевір дату й вимоги на сайті УЦОЯО.'),'END:VEVENT'];
 const before=new Date(Date.parse(exam+'T12:00:00Z')-EXT_DAY).toISOString().slice(0,10);
 if(pDay()<=before)L.push('BEGIN:VEVENT','UID:study-'+pDay()+'@skladeno','DTSTAMP:'+stamp,'DTSTART:'+ymd(pDay())+'T'+hm,'DURATION:PT'+minutes+'M','RRULE:FREQ=DAILY;UNTIL='+ymd(before)+'T235959','SUMMARY:'+extIcsEsc('Підготовка до НМТ'),'END:VEVENT');
 L.push('END:VCALENDAR');return L.map(extIcsFold).join('\r\n')+'\r\n'}
function extIcsSave(){const t=$('#ext-time')?.value;if(!/^\d{2}:\d{2}$/.test(t||'')){toast('Вкажи час занять.');return}download('skladeno-nmt.ics',extIcs(t,P.plan.minutes),'text/calendar')}
function extGoalRow(kind,label,now,opts,unit){const g=P.ext.goal[kind];return `<div class="p-form-grid"><label>${label}<select onchange="extGoal('${kind}',this.value)">${opts.map(v=>`<option value="${v}" ${g===v?'selected':''}>${v?v+' '+unit:'без цілі'}</option>`).join('')}</select></label></div>${g?`<p>Зараз: ${now} із ${g}${now>=g?'. Ціль виконано.':''}</p>${bar(Math.min(now,g),g)}`:''}`}
function extPage(){const st=extStreak(),vac=P.ext.vac;
 $('#main').innerHTML=pHeading('Ритм навчання','Серія, цілі й підсумок тижня','Скільки днів підряд ти займаєшся, чи виконано цілі та що змінилося за тиждень.')+extVacNotice()
 +`<section class="p-section"><h2>Серія днів</h2><p>Зараз підряд: ${stPlural(st.cur,'день','дні','днів')}. Найдовша: ${stPlural(st.best,'день','дні','днів')}.</p><p class="p-caption">День зараховано, якщо в ньому було хоча б одне перевірене завдання. Дні відпустки серію не рвуть.</p></section>`
 +`<section class="p-section"><h2>Цілі</h2>${extGoalRow('daily','Завдань на день',extAct(extDay(0)),[0,5,10,20,30],'завдань')}${extGoalRow('weekly','Тестів на тиждень',extTestsSince(extWeekStart()),[0,1,2,3,5],'тестів')}<p class="p-caption">Тест — це пробник, офіційний демоваріант або контрольний зріз, завершений від понеділка. Швидкі перевірки не рахуються.</p></section>`
 +`<section class="p-section"><h2>Тиждень проти попереднього</h2>${extSummary()}</section>`
 +`<section class="p-section"><h2>Час на сайті</h2>${extTimeHtml()}</section>`
 +`<section class="p-section"><h2>Ефективність за часом доби</h2>${extHoursHtml()}</section>`
 +`<section class="p-section"><h2>Упевненість і точність</h2>${extCalibHtml()}</section>`
 +`<section class="p-section"><h2>Відпустка</h2>${vac&&pDay()<=vac.until?`<p>Триває до ${stDateLabel(vac.until)}. Серія не рветься, нагадування про відставання вимкнено. Після завершення терміни повторень, що припали на відпустку, зсунуться на її тривалість.</p><div class="p-actions"><button onclick="extVacStop()">Закінчити зараз</button></div>`:`<p>Пауза на кілька днів без втрати серії й накопичених повторень.</p><div class="p-actions">${[3,7,14].map(n=>`<button onclick="extVacStart(${n})">${n} днів</button>`).join('')}</div>`}</section>`
 +`<section class="p-section"><h2>Календар</h2><p>Файл .ics: дата НМТ (${stDateLabel(stExamDate())}, зміни її в плані) і щоденний час для занять до дня перед нею, ${P.plan.minutes} хвилин.</p><div class="p-form-grid"><label>Час занять<input id="ext-time" type="time" value="17:00"></label></div><div class="p-actions"><button onclick="extIcsSave()">Завантажити календар</button></div></section>`
 +pFoot()}
const extRenderBase=render;render=function(){if((location.hash.slice(1)||'hub')==='rhythm'){route='rhythm';document.documentElement.dataset.focus='';extPage();syncSiteNavigation();document.title='Ритм навчання · Складено';testsPaint();return}extRenderBase()};
const extCrumbsBase=siteCrumbs;siteCrumbs=function(){return (location.hash.slice(1)||'hub')==='rhythm'?[{label:'Головна',to:'hub'},{label:'Ритм навчання',to:'rhythm'}]:extCrumbsBase()};
const extPlanBase=pPlan;pPlan=function(){extPlanBase();const st=extStreak(),g=P.ext.goal.daily;$('#main .p-page-head')?.insertAdjacentHTML('afterend',extVacNotice()+`<p class="p-caption">Серія: ${stPlural(st.cur,'день','дні','днів')}.${g?` Сьогодні ${extAct(extDay(0))} із ${g} завдань.`:''} <a href="#rhythm">Ритм і цілі ›</a></p>`)};
// Чекліст дня іспиту: пункти з тексту сторінки «Стратегія НМТ» і «Про сайт», позначки зберігаються.
function extCheckSet(id,on){if(!EXT_CHECK.some(([k])=>k===id))return;if(on)P.ext.check[id]=true;else delete P.ext.check[id];pSave();const el=$('#ext-check-count');if(el)el.textContent=Object.keys(P.ext.check).length+' із '+EXT_CHECK.length}
function extCheckReset(){P.ext.check={};pSave();uiStrategyPage()}
const extStrategyBase=uiStrategyPage;uiStrategyPage=function(){extStrategyBase();
 $('#main .p-actions')?.insertAdjacentHTML('beforebegin',`<section class="p-section" id="ext-check"><h2>Чекліст дня іспиту</h2><p class="p-caption">Позначено: <span id="ext-check-count">${Object.keys(P.ext.check).length} із ${EXT_CHECK.length}</span></p><ul class="ext-check">${EXT_CHECK.map(([id,t])=>`<li><label><input type="checkbox" ${P.ext.check[id]?'checked':''} onchange="extCheckSet('${id}',this.checked)"> ${esc(t)}</label></li>`).join('')}</ul><div class="p-actions"><button onclick="extCheckReset()">Зняти всі позначки</button></div></section>`)};
