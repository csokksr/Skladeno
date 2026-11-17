// Інструменти тесту: цифрові клавіші (їх можна вимкнути), позначка «повернутися» й фільтр навігатора, підказка про темп,
// оголошення часу, пряме посилання на завдання, фокус-режим.
const HOTKEYS_KEY='skladeno-hotkeys';
function hotkeysOn(){try{return localStorage.getItem(HOTKEYS_KEY)!=='off'}catch{return true}}
function hotkeysSet(on){try{if(on)localStorage.removeItem(HOTKEYS_KEY);else localStorage.setItem(HOTKEYS_KEY,'off')}catch{}toast(on?'Цифрові клавіші 1–8 увімкнено.':'Цифрові клавіші 1–8 вимкнено.');pSettings()}
const hotkeysSettingsBase=pSettings;pSettings=function(){hotkeysSettingsBase();const head=$('#main .p-page-head');if(!head)return;const on=hotkeysOn();
head.insertAdjacentHTML('afterend',`<section class="p-alert"><div><h2>Клавіші в завданнях</h2><p>У практиці цифри 1–8 обирають варіант відповіді, коли курсор не в полі введення. ${on?'Якщо вони заважають, наприклад при голосовому керуванні чи скрінрідері, їх можна вимкнути.':'Зараз вони вимкнені: варіант обирається мишею, дотиком або клавішами Tab і Enter.'}</p><div class="p-actions">${[[true,'Увімкнено'],[false,'Вимкнено']].map(([v,l])=>`<button aria-pressed="${on===v}" ${on===v?'class="primary"':''} onclick="hotkeysSet(${v})">${l}</button>`).join('')}</div></div></section>`)};

// «Повернутися»: позначка біля завдання (у пробнику й у тренуванні), видима в навігаторі.
function navHolder(c){return c.exam?P.exam:c.record?null:P.sessions[P.current]}
function navFlagToggle(){const c=pContext(),q=pQ();if(!c||!q||c.record)return;const h=navHolder(c);if(!h)return;h.flags=h.flags||{};if(h.flags[q.id])delete h.flags[q.id];else h.flags[q.id]=true;if(!Object.keys(h.flags).length)delete h.flags;pSave();pPractice()}
let navFilter='all';
function navFilterSet(v){navFilter=v;const q=$('.qnav');if(q)q.dataset.filter=v;document.querySelectorAll('.nav-filter button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===v)))}
// Темп в пробнику: скільки завдань блоку мало бути заповнено за часом, що минув, і скільки заповнено.
function pacePlan(e,ids){const len=(e.short?15:e.full?120:60)*60000,start=e.deadline-len,frac=Math.min(1,Math.max(0,(Date.now()-start)/len)),expected=Math.floor(ids.length*frac),done=ids.filter(id=>pValid(PM[id],e.answers[id])).length;return {expected,done,diff:done-expected}}
function paceText(p){return p.diff>=0?`Темп у нормі: за часом мало бути ${p.expected}, заповнено ${p.done}.`:`Відстаєш на ${stPlural(-p.diff,'завдання','завдання','завдань')}: за часом мало бути ${p.expected}, заповнено ${p.done}.`}
setInterval(()=>{const el=$('#nav-pace'),e=P.exam;if(!el||!e||e.finished||e.stage==='break')return;const c=pContext();if(c?.exam)el.textContent=paceText(pacePlan(e,c.ids))},20000);
// Пряме посилання: #practice/<id> відкриває завдання в найновішому тренуванні, де воно є, або в новому.
function linkOpen(id){let key=Object.keys(P.sessions).reverse().find(k=>P.sessions[k].ids.includes(id));if(key)P.sessions[key].index=P.sessions[key].ids.indexOf(id);else{key='link-'+id;P.sessions[key]={ids:[id],title:'Завдання '+id,index:0}}
const s=P.sessions[key];delete P.sessions[key];P.sessions[key]=s;P.current=key;pSave()}
function linkCopy(){const q=pQ();if(!q)return;const url=location.href.split('#')[0]+'#practice/'+encodeURIComponent(q.id),done=()=>toast('Посилання скопійовано.'),fail=()=>toast('Не вдалося скопіювати. Адреса: '+url);
if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(done,fail);else fail()}
// Фокус-режим: без меню, шляху й підвалу. Esc або кнопка «Вийти» повертають їх; поза сторінками тесту режим вимикається сам.
const FOCUS_ROUTES=['practice','simulate','official-run','checkpoint'];
function focusSet(on){document.documentElement.dataset.focus=on?'on':'';if(on)toast('Меню сховано. Esc або кнопка «Показати меню» повертають його.')}
document.body.insertAdjacentHTML('beforeend','<button type="button" id="focus-exit" class="focus-exit" onclick="focusSet(false)">Показати меню</button>');
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.documentElement.dataset.focus==='on'&&!$('#modal').open)focusSet(false)});
const toolsRenderBase=render;render=function(){const h=location.hash.slice(1),m=/^practice\/([^/]+)$/.exec(h);
if(m){let id='';try{id=decodeURIComponent(m[1])}catch{}if(PM[id]){linkOpen(id);history.replaceState(null,'','#practice')}else{toast('Такого завдання немає.');history.replaceState(null,'','#hub')}}
if(!FOCUS_ROUTES.includes(location.hash.slice(1).split('/')[0]))document.documentElement.dataset.focus='';
toolsRenderBase()};
const toolsPracticeBase=pPractice;pPractice=function(){toolsPracticeBase();const c=pContext(),q=pQ(),qn=$('.qnav');if(!c||!q||!qn)return;
const flags=navHolder(c)?.flags||{},btns=[...qn.querySelectorAll('button')];let open=0,marked=0;
btns.forEach((b,i)=>{const id=c.ids[i],answered=/\b(done|miss|draft)\b/.test(b.className);b.dataset.answered=answered?'1':'0';if(!answered)open++;if(flags[id]){b.dataset.flag='1';marked++;b.setAttribute('aria-label',(b.getAttribute('aria-label')||'')+' — позначено, щоб повернутися')}});
const acts=$('.p-practice-top .p-actions');
if(acts){const mine=[];if(!c.record)mine.push(`<button aria-pressed="${!!flags[q.id]}" onclick="navFlagToggle()">${flags[q.id]?'⚑ Позначено':'⚐ Позначити, щоб повернутися'}</button>`);
if(!c.exam&&!c.record)mine.push('<button onclick="linkCopy()">Копіювати посилання</button>');mine.push('<button onclick="focusSet(true)">Без меню</button>');acts.insertAdjacentHTML('beforeend',mine.join(''))}
const pace=c.exam&&P.exam.stage!=='break'?`<p class="p-caption" id="nav-pace">${paceText(pacePlan(P.exam,c.ids))}</p>`:'';
qn.dataset.filter=navFilter;
qn.insertAdjacentHTML('beforebegin',pace+`<div class="nav-filter" role="group" aria-label="Фільтр навігатора">${[['all','Усі'],['open',`Без відповіді (${open})`],['flag',`Позначені (${marked})`]].map(([v,l])=>`<button data-f="${v}" aria-pressed="${navFilter===v}" onclick="navFilterSet('${v}')">${l}</button>`).join('')}</div>`)};
// Залишок часу для читачів з екрана: на 30, 20, 10, 5 хвилинах і за останню хвилину.
const timeSr=document.createElement('div');timeSr.className='sr-only';timeSr.setAttribute('role','status');timeSr.setAttribute('aria-live','polite');document.body.append(timeSr);
function timeCross(prev,now){return [30,20,10,5,1].find(t=>now<=t&&prev>t)||0}
const timeSeen={};
setInterval(()=>{for(const r of testsRuns()){const min=Math.ceil(r.left/60000),k=r.kind+r.title,prev=timeSeen[k];timeSeen[k]=min;if(prev===undefined)continue;const t=timeCross(prev,min);
if(t){timeSr.textContent='';setTimeout(()=>{timeSr.textContent=r.title+(t===1?': остання хвилина.':': залишилось '+stPlural(t,'хвилина','хвилини','хвилин')+'.')},60)}}},10000);
