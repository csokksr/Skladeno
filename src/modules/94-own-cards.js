// Власні картки (#cards) і озвучування англійських слів.
// Картки лежать у P.ext.cards (потрапляють у копію; чистить extNormal). Повторення за коробками: 0 → щодня, далі 1, 3, 7, 14 днів.

const CARD_INT=[0,1,3,7,14];
const cardDay=i=>new Date(Date.parse(pDay()+'T12:00:00Z')+i*86400000).toISOString().slice(0,10);
function cardNewId(){const used=new Set(P.ext.cards.map(c=>c.id));let id;do id='c'+Date.now().toString(36).slice(-6)+Math.random().toString(36).slice(2,5);while(used.has(id));return id}
function cardAdd(f,b,l){const clean=(s,n)=>String(s||'').replace(/[\u0000-\u0008\u000b-\u001f]/g,'').trim().slice(0,n);f=clean(f,300);b=clean(b,600);
 if(!f||!b)return {ok:false,msg:'Заповни обидва боки картки.'};if(P.ext.cards.length>=EXT_CARDS_MAX)return {ok:false,msg:'Карток може бути не більше '+EXT_CARDS_MAX+'.'};
 if(P.ext.cards.some(c=>c.f.toLowerCase()===f.toLowerCase()&&c.b===b))return {ok:false,msg:'Така картка вже є.'};
 P.ext.cards.push({id:cardNewId(),f,b,l:l==='en'?'en':'uk',x:0,d:pDay()});pSave();return {ok:true}}
function cardDelete(id){const n=P.ext.cards.length;P.ext.cards=P.ext.cards.filter(c=>c.id!==id);if(P.ext.cards.length!==n)pSave();return n-P.ext.cards.length}
const cardsDue=()=>P.ext.cards.filter(c=>c.d<=pDay()).sort((a,b)=>a.d.localeCompare(b.d)||a.x-b.x);
// Відповідь: «знав» піднімає коробку й відсуває повторення, «не знав» повертає в коробку 0 на сьогодні.
function cardGrade(id,knew){const c=P.ext.cards.find(x=>x.id===id);if(!c)return false;c.x=knew?Math.min(4,c.x+1):0;c.d=cardDay(CARD_INT[c.x]);pSave();return true}
let cardShown=false,cardCurrent=null;
function cardNext(){const due=cardsDue();cardCurrent=due.find(c=>c.id!==cardCurrent)?.id||due[0]?.id||null;cardShown=false}

function cardsPage(){const due=cardsDue(),cur=P.ext.cards.find(c=>c.id===cardCurrent)||due[0]||null;if(cur&&cardCurrent!==cur.id)cardCurrent=cur.id;if(!cur)cardCurrent=null;
 const speak=c=>c.l==='en'&&ttsOk()?`<button type="button" class="textbtn" onclick="ttsSpeak(this.dataset.t,'en')" data-t="${esc(c.f)}" aria-label="Прослухати: ${esc(c.f)}">🔊 Прослухати</button>`:'';
 $('#main').innerHTML=pHeading('Повторення','Мої картки','Власні картки: слово чи питання з одного боку, відповідь з іншого. Повторення йде за коробками, щоб складне поверталося частіше.')
 +`<section class="p-section" id="cards-review"><h2>Повторення</h2>${!P.ext.cards.length?'<p class="p-empty">Карток ще немає. Додай першу нижче.</p>':!cur?`<p>На сьогодні все повторено. Карток: ${P.ext.cards.length}. Наступне повторення — завтра чи пізніше.</p>`
  :`<p class="p-caption">До повторення сьогодні: ${due.length}</p><article class="ref-card"><p class="p-kicker">Коробка ${cur.x+1} із 5 · ${cur.l==='en'?'English':'українська'}</p><h3 lang="${cur.l}">${esc(cur.f)}</h3>${speak(cur)}${cardShown?`<div class="ref-answer"><p>${esc(cur.b).replace(/\n/g,'<br>')}</p></div><div class="p-actions"><button class="primary" data-id="${esc(cur.id)}" onclick="cardAnswer(this.dataset.id,true)">Знав</button><button data-id="${esc(cur.id)}" onclick="cardAnswer(this.dataset.id,false)">Не знав</button></div>`:'<div class="p-actions"><button class="primary" onclick="cardReveal()">Відкрити відповідь</button></div>'}</article>`}</section>`
 +`<section class="p-section" id="cards-add"><h2>Нова картка</h2><form onsubmit="event.preventDefault();cardAddClick()"><div class="p-form-grid"><label>Лицьовий бік<textarea id="card-f" rows="2" maxlength="300"></textarea></label><label>Зворотний бік<textarea id="card-b" rows="3" maxlength="600"></textarea></label><label>Мова лицьового боку<select id="card-l"><option value="uk">Українська</option><option value="en">English (можна прослухати)</option></select></label></div><div class="p-actions gap"><button class="primary" type="submit">Додати картку</button></div></form></section>`
 +(P.ext.cards.length?`<section class="p-section" id="cards-list"><details><summary>Усі картки (${P.ext.cards.length})</summary><ul class="cards-list">${P.ext.cards.map(c=>`<li><span lang="${c.l}"><strong>${esc(c.f)}</strong> — ${esc(c.b)}</span> <small>коробка ${c.x+1}, повторення ${esc(c.d)}</small> <button class="textbtn" data-id="${esc(c.id)}" onclick="cardDeleteClick(this.dataset.id)" aria-label="Видалити картку ${esc(c.f)}">Видалити</button></li>`).join('')}</ul></details></section>`:'')
 +pFoot()}
function cardReveal(){cardShown=true;cardsPage()}
function cardAnswer(id,knew){cardGrade(id,knew);cardNext();cardsPage()}
function cardAddClick(){const r=cardAdd($('#card-f').value,$('#card-b').value,$('#card-l').value);if(!r.ok){toast(r.msg);return}toast('Картку додано.');cardCurrent=cardCurrent||null;cardsPage()}
function cardDeleteClick(id){const c=P.ext.cards.find(x=>x.id===id);if(!c||!confirm('Видалити картку «'+c.f.slice(0,60)+'»?'))return;cardDelete(id);toast('Картку видалено.');cardsPage()}
const cardsRenderBase=render;render=function(){if((location.hash.slice(1)||'hub')==='cards'){route='cards';document.documentElement.dataset.focus='';cardsPage();syncSiteNavigation();document.title='Мої картки · Складено';testsPaint();return}cardsRenderBase()};
const cardsCrumbsBase=siteCrumbs;siteCrumbs=function(){return (location.hash.slice(1)||'hub')==='cards'?[{label:'Головна',to:'hub'},{label:'Мої картки',to:'cards'}]:cardsCrumbsBase()};
const cardsRhythmBase=extPage;extPage=function(){cardsRhythmBase();$('#main .p-page-head')?.insertAdjacentHTML('afterend',`<p class="p-caption"><a href="#cards">Мої картки (${P.ext.cards.length}) ›</a> · <a href="#graph">Графік функцій ›</a></p>`)};

/* 73. Озвучування: речення читає голос пристрою, якщо він є для цієї мови. Нічого не завантажується з мережі. */
const ttsOk=()=>typeof window!=='undefined'&&'speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';
function ttsSpeak(text,lang='en'){if(!ttsOk()){toast('Озвучування недоступне в цьому браузері.');return}
 const t=String(text||'').replace(/⟦§[a-z]+§/g,'').replace(/[⟦⟧]/g,'').replace(/\s+/g,' ').trim().slice(0,1500);if(!t)return;
 const code=lang==='en'?'en-GB':lang,voices=speechSynthesis.getVoices?.()||[];
 if(voices.length&&!voices.some(v=>v.lang&&v.lang.toLowerCase().startsWith(code.slice(0,2)))){toast('На пристрої немає голосу для цієї мови.');return}
 // Chrome на першому виклику може віддати порожній список голосів, тож відсутність голосу видно лише за наслідком: мовлення не почалося.
 const nope=()=>toast('Озвучування не почалося: на пристрої, ймовірно, немає голосу для цієї мови.');
 let started=false;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang=code;u.rate=.9;u.onstart=()=>{started=true};u.onerror=e=>{if(e&&e.error&&!['canceled','interrupted'].includes(e.error))nope()};speechSynthesis.speak(u);
 setTimeout(()=>{if(!started)nope()},2000)}
// Мовлення не триває на іншій сторінці.
const ttsRenderBase=render;render=function(){try{if(ttsOk())speechSynthesis.cancel()}catch{}ttsRenderBase()};
const cardsRefBase=referencePage;referencePage=function(){cardsRefBase();const cards=refCards(),c=cards[Math.min(refIndex,cards.length-1)];
 if(!c||c.subject!=='eng'||c.kind!=='vocabulary'||!ttsOk())return;$('.ref-card .ref-nav')?.insertAdjacentHTML('beforebegin',`<p><button type="button" class="textbtn" data-t="${esc(c.title)}" onclick="ttsSpeak(this.dataset.t,'en')" aria-label="Прослухати: ${esc(c.title)}">🔊 Прослухати</button></p>`)};
const cardsPracticeBase=pPractice;pPractice=function(){cardsPracticeBase();const q=pQ(),c=pContext();if(!q||!c||q.subject!=='eng'||!ttsOk())return;const acts=$('.p-practice-top .p-actions');
 if(acts)acts.insertAdjacentHTML('beforeend','<button type="button" onclick="ttsSpeakTask()">🔊 Прослухати текст</button>')};
// Читається текст завдання, якщо він переважно англійський: українську умову англійський голос прочитав би незрозуміло.
function ttsSpeakTask(){const q=pQ();if(!q)return;const text=(q.passage?q.passage+'. ':'')+(q.prompt||''),lat=(text.match(/[A-Za-z]/g)||[]).length,cyr=(text.match(/[А-Яа-яІіЇїЄєҐґ]/g)||[]).length;
 if(lat<cyr||!lat){toast('Умова українською: озвучується лише англійський текст.');return}ttsSpeak(text,'en')}
