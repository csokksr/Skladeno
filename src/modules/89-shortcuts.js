// Клавіші на всьому сайті: «/» відкриває пошук, Ctrl+K (Cmd+K) швидкий перехід, «?» довідка клавіш.
// Під час тесту з таймером «/» і Ctrl+K вимкнені: випадкове натискання не має виводити зі сторінки тесту.
const SC_LOCKED=['simulate','official-run','checkpoint'];
const scLocked=()=>SC_LOCKED.includes((location.hash.slice(1)||'hub').split('/')[0]);
const scTyping=t=>/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName||'')||!!t?.isContentEditable;
const scModalOpen=()=>!!$('#modal')?.open;

/* Команди швидкого переходу. Адреси є в маршрутизаторі сайту. */
function scCommands(){const base=[['Головна','hub','головна старт'],['Мої тести','tests','тести тренування практика конструктор'],['Пробні НМТ','mocks','пробник симуляція швидка перевірка'],['Офіційні тести','official','офіційні демоваріанти уцояо'],['Контрольний зріз','coach','зріз контроль'],
 ['Пошук','find','знайти шукати матеріали нотатки'],['Мій прогрес','analytics','аналітика статистика результати'],['Мій план','plan','розклад тиждень'],['Ритм навчання','rhythm','серія цілі підсумок відпустка календар'],['Стратегія НМТ','strategy','чекліст день іспиту'],['Матеріали','library','довідники картки формули'],['Налаштування','preferences','копія резервна пароль шрифт міжряддя скидання'],['Про сайт','about','довідка що нового приватність']];
 return [...base,...SUBJECTS.map(s=>[s.name,'subject/'+s.id,'предмет теми конспекти'])]}
let scItems=[],scActive=0;
function scFilter(q){const tokens=findKey(q).split(' ').filter(Boolean);return scCommands().filter(([label,,kw])=>{const k=findKey(label+' '+kw);return tokens.every(t=>k.includes(t))})}
function scPaint(){const ul=$('#pal-list');if(!ul)return;ul.innerHTML=scItems.length?scItems.map(([l],i)=>`<li role="option" id="pal-${i}" aria-selected="${i===scActive}" class="${i===scActive?'is-active':''}" onclick="scGo(${i})">${esc(l)}</li>`).join(''):'<li class="p-empty" role="presentation">Нічого не знайдено</li>';
 $('#pal-q')?.setAttribute('aria-activedescendant',scItems.length?'pal-'+scActive:'');$('#pal-'+scActive)?.scrollIntoView?.({block:'nearest'})}
function scGo(i){const it=scItems[i];if(!it)return;$('#modal').close();go(it[1])}
function scOpen(){if(scModalOpen())return;scItems=scFilter('');scActive=0;
 $('#modalbody').innerHTML=`<div class="p-section-head"><h2 id="pal-h">Швидкий перехід</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><input id="pal-q" type="text" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" aria-labelledby="pal-h" autocomplete="off" placeholder="Куди перейти?"><ul id="pal-list" class="pal-list" role="listbox" aria-label="Куди перейти"></ul><p class="p-caption">Стрілки вибирають, Enter відкриває, Esc закриває.</p>`;
 const q=$('#pal-q');q.addEventListener('input',scPalInput);q.addEventListener('keydown',scPalKey);
 scPaint();$('#modal').showModal();q.focus()}
function scPalInput(){scItems=scFilter($('#pal-q').value);scActive=0;scPaint()}
function scPalKey(e){if(e.key==='ArrowDown'){e.preventDefault();if(scItems.length)scActive=(scActive+1)%scItems.length;scPaint()}else if(e.key==='ArrowUp'){e.preventDefault();if(scItems.length)scActive=(scActive-1+scItems.length)%scItems.length;scPaint()}else if(e.key==='Enter'){e.preventDefault();scGo(scActive)}}

/* Довідка клавіш. */
function scKeysOpen(){if(scModalOpen())return;const row=([k,t])=>`<dt>${k}</dt><dd>${t}</dd>`;
 $('#modalbody').innerHTML=`<div class="p-section-head"><h2>Клавіші</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><h3>На всьому сайті</h3><dl class="about-keys">${[['/','відкрити пошук'],['Ctrl+K або Cmd+K','швидкий перехід на будь-яку сторінку'],['?','ця довідка']].map(row).join('')}</dl><p class="p-caption">Коли йде тест із таймером, «/» і Ctrl+K вимкнені.</p><h3>У завданнях</h3><dl class="about-keys">${[['1–8','обрати варіант відповіді (можна вимкнути в налаштуваннях)'],['Enter','перевірити відповідь (поза полем введення)'],['← і →','попереднє й наступне завдання'],['Esc','закрити вікно або вийти з фокус-режиму']].map(row).join('')}</dl>`;$('#modal').showModal()}

function scKeydown(e){const t=e.target;
 if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&(String(e.key).toLowerCase()==='k'||e.code==='KeyK')){if(scLocked())return;e.preventDefault();scOpen();return}
 if(scTyping(t)||e.ctrlKey||e.altKey||e.metaKey||scModalOpen())return;
 if(e.key==='/'){if(scLocked())return;e.preventDefault();go('find');setTimeout(()=>$('#find-query')?.focus(),80)}
 else if(e.key==='?'){e.preventDefault();scKeysOpen()}}
addEventListener('keydown',scKeydown);
