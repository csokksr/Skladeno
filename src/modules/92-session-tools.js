// Сесія навчання: «Помодоро», свайп між завданнями, повний екран, облік виходів із вкладки під час тесту.

/* 75. Помодоро: 25 хвилин роботи, потім 5 відпочинку. Стан у localStorage (skladeno-pomodoro), тож відлік іде й після переходу на іншу сторінку. */
const POMO_KEY='skladeno-pomodoro',POMO={work:25*60000,rest:5*60000};
function pomoGet(){try{const o=JSON.parse(localStorage.getItem(POMO_KEY)||'null');return o&&['work','rest'].includes(o.phase)&&Number.isFinite(o.end)&&Math.abs(o.end)<8.64e15?{phase:o.phase,end:o.end}:null}catch{return null}}
function pomoSet(o){let ok=true;try{if(o)localStorage.setItem(POMO_KEY,JSON.stringify(o));else localStorage.removeItem(POMO_KEY)}catch{ok=false}pomoPaint();return ok}
function pomoStart(){if(!pomoSet({phase:'work',end:Date.now()+POMO.work})){toast('Не вдалося запустити: сховище браузера недоступне.');return}toast('Помодоро: 25 хвилин роботи.')}
function pomoStop(){pomoSet(null);toast('Помодоро зупинено.')}
const pomoClock=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const pomoBanner=document.createElement('div');pomoBanner.id='pomo-banner';pomoBanner.className='test-banner';pomoBanner.hidden=true;document.querySelector('.gnav').after(pomoBanner);
function pomoAnnounce(text){toast(text);const el=$('#sr-live');if(el){el.textContent='';setTimeout(()=>{el.textContent=text},60)}}
// Фаза закінчується в p.end, а не тоді, коли про це дізналися: якщо сторінку було закрито, застарілий таймер гасне без оголошень.
function pomoTick(){const p=pomoGet();if(!p)return;const now=Date.now();if(now>=p.end){if(p.phase==='work'){const restEnd=p.end+POMO.rest;if(now>=restEnd)pomoSet(null);else{pomoSet({phase:'rest',end:restEnd});pomoAnnounce('Час відпочити: 5 хвилин.')}}else{pomoSet(null);if(now-p.end<60000)pomoAnnounce('Відпочинок закінчено. Можна починати знову.')}return}pomoPaint()}
function pomoPaint(){const p=pomoGet(),box=$('#pomo-box');if(box)box.innerHTML=pomoBox();pomoBanner.hidden=!p;if(!p){pomoBanner.innerHTML='';return}
 pomoBanner.innerHTML=`<div class="test-banner-in"><span>Помодоро: ${p.phase==='work'?'робота':'відпочинок'}, залишилось <span id="pomo-left">${pomoClock(p.end-Date.now())}</span></span><button class="textbtn" onclick="pomoStop()">Зупинити</button></div>`}
setInterval(()=>{const p=pomoGet();if(!p){if(!pomoBanner.hidden)pomoPaint();return}if(Date.now()>=p.end){pomoTick();return}const el=$('#pomo-left');if(el)el.textContent=pomoClock(p.end-Date.now())},1000);
setTimeout(pomoPaint,0);
addEventListener('storage',e=>{if(e.key===POMO_KEY||e.key===null)pomoPaint()});
function pomoBox(){const p=pomoGet();return p?`<p>Зараз: ${p.phase==='work'?'робота':'відпочинок'}. Скільки лишилось, видно зверху сторінки.</p><div class="p-actions"><button onclick="pomoStop()">Зупинити</button></div>`:'<p>25 хвилин роботи без відволікань, потім 5 хвилин відпочинку. Відлік видно зверху на кожній сторінці.</p><div class="p-actions"><button onclick="pomoStart();$(\'#pomo-box\').innerHTML=pomoBox()">Почати</button></div>'}
const sessRhythmBase=extPage;extPage=function(){sessRhythmBase();const f=$('#main .p-footer'),html=`<section class="p-section" id="pomo-section"><h2>Помодоро</h2><div id="pomo-box">${pomoBox()}</div></section>`;if(f)f.insertAdjacentHTML('beforebegin',html);else $('#main').insertAdjacentHTML('beforeend',html)};

/* 76. Свайп між завданнями: горизонтальний рух пальцем понад 70 px при малому вертикальному зсуві. Можна вимкнути в налаштуваннях. */
const SWIPE_KEY='skladeno-swipe';
const swipeOn=()=>{try{return localStorage.getItem(SWIPE_KEY)!=='off'}catch{return true}};
function swipeSet(on){try{if(on)localStorage.removeItem(SWIPE_KEY);else localStorage.setItem(SWIPE_KEY,'off')}catch{}toast(on?'Свайп між завданнями ввімкнено.':'Свайп між завданнями вимкнено.');pSettings()}
let swipeStart=null;
document.addEventListener('touchstart',e=>{const t=e.touches?.[0];swipeStart=t&&e.touches.length===1?{x:t.clientX,y:t.clientY,target:e.target}:null},{passive:true});
function swipeEnd(e){const s=swipeStart;swipeStart=null;if(!s||!swipeOn())return;const t=e.changedTouches?.[0];if(!t)return;
 const base=(location.hash.slice(1)||'hub').split('/')[0];if(!['practice','simulate','result-review'].includes(base)||scModalOpen())return;
 if(s.target?.closest?.('input,textarea,select,table,.tablewrap,.p-breadcrumb,svg,math,.dt-zoom,[contenteditable],.p-match-grid'))return;
 if(window.visualViewport&&window.visualViewport.scale>1.05)return;
 const dx=t.clientX-s.x,dy=t.clientY-s.y;if(Math.abs(dx)<70||Math.abs(dy)>Math.abs(dx)/2)return;const c=pContext();if(!c)return;pNav(c.index+(dx<0?1:-1))}
document.addEventListener('touchend',swipeEnd,{passive:true});
const sessSettingsBase=pSettings;pSettings=function(){sessSettingsBase();const f=$('#main .p-footer'),on=swipeOn(),
 html=`<section class="p-alert" id="swipe-setting"><div><h2>Свайп між завданнями</h2><p>На телефоні рух пальцем вліво й вправо переходить до наступного й попереднього завдання.</p><div class="p-actions">${[[true,'Увімкнено'],[false,'Вимкнено']].map(([v,l])=>`<button aria-pressed="${on===v}" ${on===v?'class="primary"':''} onclick="swipeSet(${v})">${l}</button>`).join('')}</div></div></section>`;
 if(f)f.insertAdjacentHTML('beforebegin',html);else $('#main').insertAdjacentHTML('beforeend',html)};

/* 77. Повний екран: кнопка в завданнях і пробнику (якщо вікно це дозволяє). */
const fsAvailable=()=>typeof document!=='undefined'&&document.fullscreenEnabled===true;
function fsToggle(){const fail=()=>toast('Повний екран тут недоступний.');try{const p=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();if(p&&p.catch)p.catch(fail)}catch{fail()}}
document.addEventListener('fullscreenchange',()=>{const b=document.getElementById('fs-btn');if(b){b.setAttribute('aria-pressed',String(!!document.fullscreenElement));b.textContent=document.fullscreenElement?'Вийти з повного екрана':'На весь екран'}});

/* 78. Виходи з вкладки під час тесту з таймером: лічильник у пам'яті сторінки (до її закриття), показ у пробнику. Це лише облік для самого тебе. */
const leaves={key:'',count:0,away:0,since:null};
// Ключ — id поточного пробника: повторне проходження того самого варіанта починає облік заново, перерва повної симуляції не рахується.
function leavesKey(){const e=P.exam;return e&&!e.finished&&e.stage!=='break'?e.id:''}
function leavesChange(){const key=leavesKey();
 if(document.visibilityState==='hidden'){if(key){if(leaves.key!==key){leaves.key=key;leaves.count=0;leaves.away=0}leaves.since=Date.now()}}
 else if(leaves.since&&key&&leaves.key===key){leaves.count++;leaves.away+=Date.now()-leaves.since;leaves.since=null;toast('Ти виходив(ла) з вкладки під час тесту: разів '+leaves.count+', разом '+Math.round(leaves.away/1000)+' с.');const n=$('#leave-note');if(n)n.textContent=leavesText()}
  else leaves.since=null}
document.addEventListener('visibilitychange',leavesChange);
const leavesText=()=>leaves.count?'Виходів з вкладки під час цього тесту: '+leaves.count+' (разом '+Math.round(leaves.away/1000)+' с).':'';
const sessPracticeBase=pPractice;pPractice=function(){sessPracticeBase();const c=pContext();if(!c)return;const acts=$('.p-practice-top .p-actions');
 if(acts&&fsAvailable())acts.insertAdjacentHTML('beforeend',`<button id="fs-btn" aria-pressed="${!!document.fullscreenElement}" onclick="fsToggle()">${document.fullscreenElement?'Вийти з повного екрана':'На весь екран'}</button>`);
 if(c.exam&&P.exam&&!P.exam.finished){const key=leavesKey();if(leaves.key!==key){leaves.key=key;leaves.count=0;leaves.away=0}
  $('#main .qnav')?.insertAdjacentHTML('beforebegin',`<p class="p-caption" id="leave-note" role="status">${esc(leavesText())}</p>`)}};
