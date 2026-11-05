// Memorisation techniques that the base app lacks: free recall after a lesson, and hypercorrection of confident errors.
// Spaced repetition, confidence ratings, interleaving and flashcards already live in app.js and 10-study.js.
// `rate` is the start of the rating call, e.g. learnRecallRate('ukr-sounds'; the panel appends ,0) / ,1) / ,2).
function learnPanel(titles,rate){return `<aside class="p-recall" id="p-recall"><strong>Пригадай без підглядання</strong><p>Не гортай угору й напиши своїми словами, що пам’ятаєш про цю тему. Спроба пригадати запам’ятовується краще за перечитування, навіть коли вийшло погано.</p><textarea id="p-recall-text" aria-label="Що я пам’ятаю про тему" placeholder="Правила, приклади, винятки…"></textarea><button class="primary" onclick="learnRecallShow()">Звірити з конспектом</button><div id="p-recall-check" hidden><p>Чи згадав ти кожне з цього?</p><ul>${titles.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><p>Наскільки повно вийшло?</p><div class="p-actions">${[[0,'Майже нічого'],[1,'Частково'],[2,'Майже все']].map(([v,l])=>`<button onclick="${rate},${v})">${l}</button>`).join('')}</div></div></aside>`}
const learnLessonBase=pLesson;pLesson=function(id){learnLessonBase(id);const t=PT[id],r=$('.p-reading');if(!t||pTab!=='theory'||!r)return;
r.insertAdjacentHTML('beforeend',learnPanel(t.notes.map(n=>n.title),`learnRecallRate('${id}'`))};
// History topics have their own page: the panel lists the sections of the topic guide.
const learnTopicBase=topic;topic=function(){learnTopicBase();const id=Number(route.split('/')[1]),g=HISTORY_GUIDES[id],c=$('#topic-content');if(!g||tab!=='theory'||!c||!$('.history-outline'))return;
c.insertAdjacentHTML('beforeend',learnPanel(g.sections.map(s=>s.title),`learnHistRate(${id}`))};
function learnRecallShow(){$('#p-recall-check').hidden=false;$('#p-recall-check').scrollIntoView({block:'nearest'})}
// Weak recall brings the answered tasks back sooner: nothing → now (and the SM-2 interval restarts), partly → within a day.
function learnMove(ids,level){const now=Date.now(),limit=level===0?now:now+86400000;let moved=0;
if(level<2)for(const id of ids){const a=pAnswerRecord(id),s=P.study.srs[id];if(a&&a.due>limit){a.due=limit;moved++}if(level===0&&s){s.n=0;s.i=0}}
if(moved||level===0){pSave();if(ids.some(id=>QM[id]))save()}return moved}
function learnRecallDone(level,moved,start){return `<p>${level===2?'Добре. Повернися до теми за кілька днів і спробуй ще раз без підглядання.':moved?`${level===0?'Повернуто до повторення':'Повернеться до повторення за добу'}: ${stPlural(moved,'завдання','завдання','завдань')}.`:'Завдань цієї теми для повторення ще немає. Виконай їх, і вони з’являться в плані.'}</p>${level<2?`<div class="p-actions"><button class="primary" onclick="${start}">Виконати завдання теми ›</button></div>`:''}`}
function learnRecallRate(id,level){$('#p-recall-check').innerHTML=learnRecallDone(level,learnMove(PT[id].questions.map(q=>q.id),level),`pStartTopic('${id}')`)}
function learnHistRate(topic,level){$('#p-recall-check').innerHTML=learnRecallDone(level,learnMove(Object.keys(QM).filter(id=>QM[id].topic===topic),level),`startTopic(${topic})`)}
// A confident wrong answer is the easiest to correct, but only if the right one is read attentively.
const learnPracticeBase=pPractice;pPractice=function(){learnPracticeBase();const q=pQ(),cx=pContext();if(!q||!cx||cx.exam||cx.record||!pLocked(q))return;const a=pAnswerRecord(q.id),s=$('#p-answer-area')?.nextElementSibling;
if(a&&a.score<a.max&&(P.coach.items[q.id]||{}).confidence===3&&s&&s.querySelector('h2'))s.querySelector('h2').insertAdjacentHTML('afterend','<p class="p-hyper"><strong>Ти був упевнений, а відповідь хибна.</strong> Саме такі помилки виправляються найкраще, якщо уважно прочитати правильну відповідь і пояснення нижче.</p>')};
