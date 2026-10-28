/* Глобальна навігація: на вузькому екрані меню розгортається на весь екран і закривається після переходу чи Esc. */
(()=>{const g=document.querySelector('.gnav'),b=g&&g.querySelector('.gnav-toggle');if(!b)return;
const set=o=>{g.classList.toggle('is-open',o);b.setAttribute('aria-expanded',String(o));b.setAttribute('aria-label',o?'Закрити меню':'Меню');document.documentElement.classList.toggle('gnav-locked',o)};
b.addEventListener('click',()=>set(!g.classList.contains('is-open')));
g.querySelector('.nav').addEventListener('click',e=>{if(e.target.closest('a'))set(false)});
addEventListener('hashchange',()=>set(false));
addEventListener('keydown',e=>{if(e.key==='Escape'&&g.classList.contains('is-open')){set(false);b.focus()}});
matchMedia('(min-width:1080px)').addEventListener('change',e=>{if(e.matches)set(false)})})();
