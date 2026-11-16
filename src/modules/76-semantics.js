// Structure and states, applied after every page draw: repeated blocks become real lists, one primary action per page,
// toggle and current states are exposed to assistive technology. The pages themselves are built by the templates in app.js.
const SEM_UL='.p-subject-list,.p-topic-list,.p-bottom-grid,.p-resource-grid,.p-mock-grid,.gallery,.grid:has(>.topic)',SEM_OL='.qnav';
function semList(c,tag){if(c.tagName===tag.toUpperCase()||!c.children.length)return;const list=document.createElement(tag);for(const a of c.attributes)list.setAttribute(a.name,a.value);list.classList.add('sem-list');
for(const k of [...c.children]){const li=document.createElement('li');li.appendChild(k);list.appendChild(li)}c.replaceWith(list)}
// Pressed (selected) buttons keep their look; the others lose .primary so a page has one main action. Toggles with aria-pressed are not actions.
function semPrimary(main){[...main.querySelectorAll('.primary:not([aria-pressed])')].filter(e=>e.offsetParent!==null).slice(1).forEach(e=>e.classList.remove('primary'));
// After an answer is checked "Check" is gone, so the next step becomes the one main action.
const next=[...main.querySelectorAll('button')].find(b=>/^Далі/.test(b.textContent.trim())&&!b.disabled);if(next&&!main.querySelector('.primary')&&main.querySelector('.p-feedback'))next.classList.add('primary')}
function semStates(main){main.querySelectorAll('.p-option').forEach(o=>o.setAttribute('aria-pressed',String(o.classList.contains('is-selected'))));main.querySelectorAll('.tabs button,.p-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('on')||b.classList.contains('is-active'))));
main.querySelectorAll('.qnav button').forEach(b=>{if(b.classList.contains('current'))b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')})}
// A link that opens a new tab says so to screen readers.
function semExternal(main){main.querySelectorAll('a[target=_blank]:not([data-ext])').forEach(a=>{a.dataset.ext='1';a.insertAdjacentHTML('beforeend','<span class="sr-only"> (відкриється в новій вкладці)</span>')})}
function semApply(main){main.querySelectorAll(SEM_UL).forEach(c=>semList(c,'ul'));main.querySelectorAll(SEM_OL).forEach(c=>semList(c,'ol'));semPrimary(main);semStates(main);semExternal(main)}
(()=>{const main=document.querySelector('#main');if(!main)return;new MutationObserver(()=>semApply(main)).observe(main,{childList:true,subtree:true});semApply(main)})();
