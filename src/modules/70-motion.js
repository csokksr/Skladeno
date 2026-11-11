/* Рух (Anime.js, src/vendor): лічильники, смуги прогресу, відповіді на тестах, перехід між завданнями, вікна, натискання, меню.
   Чому так: рух має пояснювати, що змінилося (нова сторінка, правильно чи ні, скільки накопичено), а не прикрашати.
   Тому: лише opacity/transform; блоки сторінок не з'являються каскадом (це шаблонний ефект): рух лише відповідає на дію
   або показує накопичене; за `prefers-reduced-motion` у режимі «Авто» нічого не рухається (див. налаштування «Анімації»).
   Якщо Anime.js не завантажився або щось пішло не так, сторінка лишається повністю видимою. */
(()=>{const A=window.anime;if(!A||!A.animate)return;
const {animate,stagger,spring,utils}=A,main=document.querySelector('#main');if(!main)return;
// Налаштування «Анімації» (71-motion-setting.js): data-motion=on рухає попри систему, off вимикає, auto слухає систему.
const RM=matchMedia('(prefers-reduced-motion: reduce)'),calm=()=>{const p=document.documentElement.dataset.motion;return p==='off'||(p!=='on'&&RM.matches)};
const clear=els=>els.forEach(e=>{e.style.opacity='';e.style.transform='';e.style.willChange=''});
const hide=els=>els.forEach(e=>{e.style.opacity='0';e.style.willChange='opacity,transform'});
/* Лічильники й смуги: числа «наростають», смуги виїжджають зліва. Лише при вході на сторінку. */
const counters=()=>{main.querySelectorAll('.p-status-strip strong,.p-stat-grid strong,.st-fc-grid strong,.p-result-score strong,.stat .value').forEach(el=>{
const m=/^(\D*)(\d+)(.*)$/.exec(el.textContent.trim());if(!m||el.children.length)return;const to=+m[2];if(to<2)return;
const o={v:0},fmt=v=>m[1]+Math.round(v)+m[3];el.textContent=fmt(0);
animate(o,{v:to,duration:Math.min(1100,500+to*3),ease:'outExpo',onUpdate:()=>{el.textContent=fmt(o.v)},onComplete:()=>{el.textContent=fmt(to)}})})};
const bars=()=>{main.querySelectorAll('.bar i,.st-scale i').forEach(i=>{if(!parseFloat(i.style.width))return;i.style.transformOrigin='0 50%';i.style.transform='scaleX(0)';
animate(i,{scaleX:[0,1],duration:900,delay:200,ease:'outQuart',onComplete:()=>{i.style.transform='';i.style.transformOrigin=''}})})};
/* Відповіді: правильна коротко «пульсує», хибна «струшується», пояснення виїжджає. Лише для щойно показаних станів. */
const optStates=()=>[...main.querySelectorAll('.p-option')].map(o=>o.classList.contains('is-correct')?'c':o.classList.contains('is-wrong')?'w':o.classList.contains('is-selected')?'s':'');
const answers=(prev)=>{const cur=optStates();if(prev.length!==cur.length)return;const opts=main.querySelectorAll('.p-option');
cur.forEach((s,i)=>{if(s===prev[i])return;const el=opts[i];
if(s==='c')animate(el,{scale:[1,1.02,1],duration:420,ease:'outQuad',onComplete:()=>{el.style.transform=''}});
else if(s==='w')animate(el,{translateX:[0,-7,7,-5,5,0],duration:380,ease:'outQuad',onComplete:()=>{el.style.transform=''}})});
if(!prev.some(s=>s==='c'||s==='w')&&cur.some(s=>s==='c'||s==='w')){const fb=main.querySelectorAll('.p-feedback,.p-explain,.feedback');
if(fb.length){hide([...fb]);animate([...fb],{opacity:[0,1],translateY:[10,0],duration:320,delay:stagger(60,{start:120}),ease:'outQuart',onComplete:()=>clear([...fb])});setTimeout(()=>clear([...fb]),2500)}}};
/* Спостерігач за #main: сторінки перемальовуються і через render(), і напряму (pPractice тощо), тому дивимось на сам DOM.
   Колбек виконується до першого кадру, тож «прихований» стан не мигає. */
/* Перехід між завданнями: нове виїжджає з боку, куди ти йдеш (вперед справа, назад зліва). Номер береться з підпису «N із M». */
const qNum=()=>{const m=/(\d+) із (\d+)/.exec(main.querySelector('.p-question .p-kicker')?.textContent||'');return m?+m[1]:0};
const dir=(prev,next)=>!prev||!next||prev===next?0:next>prev?1:-1;
const slide=d=>{const el=main.querySelector('.p-question');if(!el||!d)return;animate(el,{opacity:[.35,1],translateX:[d*28,0],duration:260,ease:'outQuart',onComplete:()=>clear([el])})};
const sig=()=>(main.textContent||'').slice(0,90);let lastHash=null,lastSig='',lastOpts=[],lastQ=0;
const onChange=()=>{const prevOpts=lastOpts,prevQ=lastQ,hashBefore=lastHash,sigBefore=lastSig,h=location.hash,s=sig();lastHash=h;lastSig=s;lastOpts=optStates();lastQ=qNum();
if(calm()||!main.children.length)return;
try{if(h!==hashBefore){counters();bars()}else if(dir(prevQ,lastQ))slide(dir(prevQ,lastQ));else if(s===sigBefore)answers(prevOpts)}catch(e){clear([...main.querySelectorAll('*')])}};
new MutationObserver(onChange).observe(main,{childList:true});
/* Діалоги (#modal): відкриваються з легким наближенням. */
const modal=document.querySelector('#modal');
if(modal)new MutationObserver(()=>{if(calm()||!modal.open)return;animate(modal,{opacity:[0,1],scale:[.97,1],duration:220,ease:'outQuart',onComplete:()=>{modal.style.transform='';modal.style.opacity=''}})}).observe(modal,{attributes:true,attributeFilter:['open']});
/* Для інших модулів: з'явитися зверху й зникнути вбік (опісля викликається done). Без Anime.js чи за prefers-reduced-motion done викликається одразу. */
window.skMotion={dir,
reveal:el=>{if(calm()||!el)return;animate(el,{opacity:[0,1],translateY:[-10,0],duration:260,ease:'outQuart',onComplete:()=>clear([el])})},
leave:(el,done)=>{if(calm()||!el){done();return}animate(el,{opacity:0,translateX:24,duration:180,ease:'inQuad',onComplete:done})}};
/* Натискання: короткий «відгук», що повертається пружиною. */
const PRESS='button:not(:disabled),.primary,.p-option:not(:disabled),a.p-subject-row,.p-topic-row,.p-resource-grid a,.st-today-card a';
let pressed=null;
const up=()=>{if(!pressed)return;const el=pressed;pressed=null;animate(el,{scale:1,duration:520,ease:spring({bounce:.5}),onComplete:()=>{el.style.transform=''}})};
document.addEventListener('pointerdown',e=>{if(calm()||e.button>0)return;const el=e.target.closest(PRESS);if(!el)return;pressed=el;animate(el,{scale:.97,duration:110,ease:'outQuad'})},true);
['pointerup','pointercancel','dragend'].forEach(t=>addEventListener(t,up,true));
/* Меню на вузькому екрані: пункти виїжджають по черзі. */
const g=document.querySelector('.gnav');
if(g)new MutationObserver(()=>{if(calm()||!g.classList.contains('is-open'))return;const items=g.querySelectorAll('.nav > *');
items.forEach(e=>{e.style.opacity='0'});animate(items,{opacity:[0,1],translateX:[-14,0],duration:380,delay:stagger(28,{start:60}),ease:'outQuart',onComplete:()=>clear([...items])});setTimeout(()=>clear([...items]),2000)}).observe(g,{attributes:true,attributeFilter:['class']});
/* Перемикання теми: плавна зміна кольорів замість різкого стрибка. */
document.addEventListener('click',e=>{if(calm()||!e.target.closest('[data-theme-set]'))return;const r=document.documentElement;r.classList.add('theme-fade');setTimeout(()=>r.classList.remove('theme-fade'),450)},true);
/* Знак бренду крутиться один раз за сесію. */
try{const mk=document.querySelector('.brand-mark');if(mk&&!calm()&&!sessionStorage.getItem('motion-brand')){sessionStorage.setItem('motion-brand','1');animate(mk,{rotate:[-180,0],scale:[.5,1],duration:900,ease:'outBack',onComplete:()=>{mk.style.transform=''}})}}catch(e){}
})();
