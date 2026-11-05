// Last layer: a failure while drawing one page must not leave an empty screen. Progress is untouched by a failed draw.
function safeRenderFailed(){const main=$('#main');if(!main)return;main.innerHTML='<section class="p-section"><h1>Сторінку не вдалося показати</h1><p>Прогрес не втрачено. Повернись на головну або перевір резервну копію в налаштуваннях.</p><div class="p-actions"><a class="primary" href="#home">На головну ›</a><a href="#preferences">Налаштування ›</a></div></section>'}
const safeRenderBase=render;render=function(){try{safeRenderBase()}catch(e){console.error(e);safeRenderFailed()}};
// Keyboard and screen-reader continuity: a check or choice redraws the whole page, so keep focus on the same option and announce the result.
function safeAnnounce(text){const el=$('#sr-live');if(!el||!text)return;el.textContent='';setTimeout(()=>{el.textContent=text},60)}
const safePracticeBase=pPractice;
pPractice=function(){
 const a=document.activeElement,options=[...document.querySelectorAll('.p-option')],at=a&&a.classList&&a.classList.contains('p-option')?options.indexOf(a):-1,wasShown=!!document.querySelector('.p-feedback');
 safePracticeBase();
 if(at>=0){const o=document.querySelectorAll('.p-option')[at];if(o&&!o.disabled)o.focus()}
 const fb=document.querySelector('.p-feedback');if(fb&&!wasShown)safeAnnounce((fb.querySelector('h3')||fb).textContent.trim());
};
let safeLastBase=null;
const safeFocusBase=render;
render=function(){
 safeFocusBase();
 const base=(location.hash.slice(1)||'hub').split('/')[0];
 if(safeLastBase!==null&&safeLastBase!==base){const h=$('#main h1')||$('#main h2');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}
 safeLastBase=base;
};
