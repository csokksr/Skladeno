// Результати назовні: експорт пробників у CSV, друк результату й плану, текстовий звіт про прогрес. Окремо: «Тест дня» у центрі тестів.

/* 68. CSV: крапка з комою між полями й BOM, щоб Excel і Google Таблиці відкрили кирилицю. Клітинки, що починаються на = + - @, захищені від формул. */
const csvCell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[";\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const csvDate=ms=>Number.isFinite(ms)?new Date(ms).toLocaleString('sv-SE',{timeZone:'Europe/Kyiv'}).slice(0,16):'';
function csvRows(){const head=['Дата','Вид','Тест','Предмет','Варіант','Бали','Максимум','Відсотки','Заповнено','Завдань','Хвилин'],rows=[];
 for(const r of (P.records||[]).filter(r=>r.finished)){const done=r.ids.filter(id=>pValid(PM[id],r.answers[id])).length;
  rows.push([r.finished,r.short?'Швидка перевірка':r.subject==='all'?'Повна симуляція':'Пробник',r.title,r.subject==='all'?'Усі предмети':SUB[r.subject]?.name||'',r.variant??'',r.score,r.max,r.max?Math.round(100*r.score/r.max):'',done,r.ids.length,Number.isFinite(r.started)?Math.round((r.finished-r.started)/60000):''])}
 for(const r of (P.official?.records||[]).filter(r=>r.finished&&OFFICIAL_PAPERS[r.subject])){const s=offScore(r);
  rows.push([r.finished,'Офіційний демоваріант','Офіційний демоваріант · '+offName(r.subject),SUB[offSub(r.subject)]?.name||'','',s.score,s.max,s.max?Math.round(100*s.score/s.max):'','','',Number.isFinite(r.started)?Math.round((r.finished-r.started)/60000):''])}
 rows.sort((a,b)=>a[0]-b[0]);return [head,...rows.map(r=>[csvDate(r[0]),...r.slice(1)])]}
function csvText(){return '﻿'+csvRows().map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n'}
function csvSave(){if(csvRows().length<2){toast('Завершених тестів ще немає.');return}download('skladeno-rezultaty-'+pDay()+'.csv',csvText(),'text/csv')}

/* 69. Друк: кнопка в результаті й плані, стилі друку в 86-states.css. */
function printPage(){let framed=false;try{framed=window.self!==window.top}catch{framed=true}
 try{window.print()}catch{toast('Друк у цьому вікні недоступний. Скористайся друком браузера (Ctrl+P).');return}
 if(framed)toast('Якщо вікно друку не з’явилося, скористайся друком браузера (Ctrl+P): тут його може бути заблоковано.')}

/* 70. Текстовий звіт про прогрес для копіювання (вставити в лист чи повідомлення). */
function reportProgressText(){const days=stDaysLeft(),st=extStreak(),w=extWeek(0),lines=['Звіт про прогрес · Складено · '+pDay(),'До НМТ: '+(days?stPlural(days,'день','дні','днів')+' (за датою з налаштувань: '+stDateLabel(stExamDate())+')':'дата настала або не задана'),''];
 for(const s of SUBJECTS){const x=pSubStats(s.id),f=stForecast(s.id);lines.push(s.name+': розв’язано '+x.done+' із '+x.total+(x.done?', точність '+x.accuracy+'%':', точності ще немає')+(f.enough?', орієнтовний прогноз '+f.scale+' ('+f.scaleLo+'–'+f.scaleHi+')':', прогнозу ще немає (замало даних)'))}
 const mocks=(P.records||[]).filter(r=>r.finished&&!r.short).sort((a,b)=>b.finished-a.finished).slice(0,3);
 lines.push('','Останні пробники: '+(mocks.length?mocks.map(r=>r.title+' — '+r.score+' із '+r.max+' ('+new Date(r.finished).toLocaleDateString('uk-UA',{timeZone:'Europe/Kyiv'})+')').join('; '):'ще не було'));
 lines.push('Серія днів: '+st.cur+' (найдовша '+st.best+')','Останні 7 днів: завдань '+w.tasks+', днів із заняттями '+w.active+' із 7, пробників '+w.mocks);
 lines.push('','Прогноз орієнтовний: він спирається на власні відповіді й пробники в цьому сайті, а не на офіційні дані.');return lines.join('\n')}
function reportCopy2(){const box=$('#progress-report');if(!box)return;box.select?.();const done=()=>toast('Звіт скопійовано.'),fail=()=>toast('Не вдалося скопіювати. Виділи текст і скопіюй вручну.');
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(box.value).then(done,fail);else{try{document.execCommand('copy')?done():fail()}catch{fail()}}}
const exportRhythmBase=extPage;extPage=function(){exportRhythmBase();const f=$('#main .p-footer');
 const html=`<section class="p-section" id="data-export"><h2>Звіт і таблиця</h2><p>Текстовий звіт для копіювання й файл усіх завершених тестів, який відкривається в Excel чи Google Таблицях.</p><label for="progress-report">Звіт про прогрес</label><textarea id="progress-report" readonly rows="10">${esc(reportProgressText())}</textarea><div class="p-actions gap"><button onclick="reportCopy2()">Копіювати звіт</button><button onclick="csvSave()">Завантажити результати (CSV)</button><button onclick="printPage()">Друк</button></div></section>`;
 if(f)f.insertAdjacentHTML('beforebegin',html);else $('#main').insertAdjacentHTML('beforeend',html)};
const exportResultBase=pResult;pResult=function(id){exportResultBase(id);const sc=$('.p-result-score');if(sc&&P.records.some(r=>r.id===id))sc.insertAdjacentHTML('beforeend','<div class="p-actions no-print"><button onclick="printPage()">Друк</button></div>')};
const exportPlanBase=pPlan;pPlan=function(){exportPlanBase();$('#main .p-page-head')?.insertAdjacentHTML('beforeend','<div class="p-actions no-print"><button onclick="printPage()">Друк плану</button></div>')};

/* 79. Тест дня: 3 завдання з кожного предмета, добір залежить лише від дати, тож усі дні різні, а повторне відкриття того самого дня продовжує той самий набір. */
function dailyIds(day=pDay()){const seed=Number(day.replace(/-/g,''));return SUBJECTS.flatMap((s,i)=>pSeedShuffle(PQ.filter(q=>q.subject===s.id&&!q.examOnly).map(q=>q.id),seed*7+i+1).slice(0,3))}
function dailyKey(day=pDay()){return 'daily-'+day}
function dailyState(){const ids=dailyIds(),aa=pAnswers();return {ids,done:ids.filter(id=>aa[id]).length,started:!!P.sessions[dailyKey()]}}
function dailyStart(){pStart(dailyIds(),'Тест дня · '+pDay().split('-').reverse().join('.'),dailyKey());go('practice')}
const exportTestsBase=testsPage;testsPage=function(){exportTestsBase();const grid=$('#main .p-bottom-grid'),d=dailyState();
 const card=`<li><article class="p-feature" id="daily-card"><h3>Тест дня</h3><p>${d.ids.length} завдань, по 3 з кожного предмета. Набір однаковий увесь день і змінюється наступного.${d.done?' Опрацьовано '+d.done+' із '+d.ids.length+'.':''}</p><div class="p-actions"><button onclick="dailyStart()">${d.done===d.ids.length?'Переглянути':d.started||d.done?'Продовжити':'Почати'}</button></div></article></li>`;
 if(grid)grid.insertAdjacentHTML('afterbegin',card)};
