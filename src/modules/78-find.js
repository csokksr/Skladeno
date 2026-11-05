// Search: results as a compact table, active filters as removable chips, results update while typing.
let findCaret=null,findTimer=null;
const findPageBase=findPage;findPage=function(){findPageBase();const s=findState(),q=$('#find-query');if(!q)return;
// Filters that are on right now, each with the route that switches it off.
const on=[];if(s.query)on.push(['«'+s.query+'»',{...s,query:'',page:0}]);if(s.subject)on.push([SUB[s.subject].name,{...s,subject:'',page:0}]);if(s.kind)on.push([FIND_KINDS[s.kind],{...s,kind:'',page:0}]);
if(on.length){const chips=`<div class="find-chips" role="group" aria-label="Активні фільтри"><span>Фільтри:</span>${on.map(([n,r])=>`<a class="chip" href="#${esc(findRoute(r))}" aria-label="Прибрати фільтр ${esc(n)}">${esc(n)} ×</a>`).join('')}<a class="chip chip-reset" href="#find">Скинути все</a></div>`;
(($('#main [role=status]')||$('#main .find-results'))||$('#main .p-section')).insertAdjacentHTML($('#main [role=status]')||$('#main .find-results')?'beforebegin':'afterend',chips)}
const res=$('#main .find-results'),arts=res?[...res.querySelectorAll('article')]:[];
if(arts.length){const table=document.createElement('table');table.className='find-table';
table.innerHTML='<caption class="sr-only">Результати пошуку</caption><thead><tr><th scope="col">Матеріал</th><th scope="col">Предмет</th><th scope="col">Знайдено</th><th scope="col">Дія</th></tr></thead><tbody></tbody>';
for(const a of arts){const [subject,kind]=a.querySelector('.p-kicker').textContent.split(' · '),tr=document.createElement('tr');
tr.innerHTML=`<td data-label="Матеріал">${esc(kind)}</td><td data-label="Предмет">${esc(subject)}</td><td data-label="Знайдено"><strong>${esc(a.querySelector('h2').textContent)}</strong><span>${esc(a.querySelector('p:not(.p-kicker)').textContent)}</span></td><td data-label="Дія"></td>`;
tr.lastElementChild.appendChild(a.querySelector('a,button'));table.tBodies[0].appendChild(tr)}
arts[0].parentNode.replaceChildren(table)}
// Results follow the typing; the caret and focus survive the redraw.
q.addEventListener('input',()=>{clearTimeout(findTimer);findTimer=setTimeout(()=>{findCaret=q.selectionStart;findSubmit()},300)});
if(findCaret!==null){q.focus();q.setSelectionRange(findCaret,findCaret);findCaret=null}};
