// Підсумки пробників і тренувань: порівняння з попереднім, графік динаміки, час на завдання, швидка перевірка, бланк відповідей,
// історія спроб і попередження про відставання від графіка.
const INS_DAY=86400000,INS_SHORT_N=15,INS_SHORT_MIN=15;
const insLetter=i=>String.fromCharCode(65+i);
const insPct=r=>r.max?Math.round(100*r.score/r.max):0;
const insTitle=r=>(r.subject==='all'?'Повна симуляція':SUB[r.subject]?.name||'Пробник')+(r.short?' · швидка перевірка':'');
const insSame=(a,b)=>a.subject===b.subject&&!!a.short===!!b.short;
function insGroup(r){return P.records.filter(x=>x.finished&&insSame(x,r)).sort((a,b)=>a.finished-b.finished).slice(-12)}
function insPrev(r){return P.records.filter(x=>x.finished&&x.finished<r.finished&&insSame(x,r)).sort((a,b)=>b.finished-a.finished)[0]||null}
function insCompare(r){const p=insPrev(r);if(!p)return '';const a=insPct(r),b=insPct(p),d=a-b;
return `<p class="p-caption" id="ins-compare">Попередня спроба (${new Date(p.finished).toLocaleDateString('uk-UA')}): ${p.score} із ${p.max}, тобто ${b}%. Зараз ${a}%, ${d>0?'на '+d+' п. п. більше':d<0?'на '+(-d)+' п. п. менше':'без змін'}.${r.short?' Завдання в швидких перевірках щоразу інші.':p.variant!==r.variant?' Варіанти можуть різнитися за складністю.':''}</p>`}
function insTrend(list,title){const w=320,h=110,px=34,py=14,n=list.length,xs=i=>n===1?w/2:px+(w-px-12)*i/(n-1),ys=p=>h-py-(h-2*py)*p/100,pts=list.map((r,i)=>[Math.round(xs(i)*10)/10,Math.round(ys(insPct(r))*10)/10]);
return `<figure class="ins-trend"><figcaption>${esc(title)}</figcaption><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}, % балів: ${list.map(r=>insPct(r)).join(', ')}"><line class="ins-grid" x1="${px}" x2="${w-12}" y1="${ys(0)}" y2="${ys(0)}"/><line class="ins-grid" x1="${px}" x2="${w-12}" y1="${ys(100)}" y2="${ys(100)}"/><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none"/>${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5"><title>${new Date(list[i].finished).toLocaleDateString('uk-UA')}: ${insPct(list[i])}%</title></circle>`).join('')}<text x="2" y="${ys(100)+4}">100%</text><text x="2" y="${ys(0)+4}">0%</text></svg></figure>`}
function insTrends(){const seen=new Set(),out=[];for(const r of P.records){const k=r.subject+'|'+!!r.short;if(seen.has(k)||!r.finished)continue;seen.add(k);const g=insGroup(r);if(g.length>1)out.push(insTrend(g,insTitle(r)))}return out.join('')}
// Час на завдання: рахується, поки завдання відкрите в пробнику; пауза понад 5 хвилин рахується як 5.
let insTick=null;
function insFlush(e){if(insTick&&insTick.exam===e.id){e.times=e.times||{};e.times[insTick.id]=(e.times[insTick.id]||0)+Math.min(Date.now()-insTick.t,300000)}insTick=null}
const insFinalizeBase=pFinalize;pFinalize=function(e,auto=false){if(e&&!e.finished)insFlush(e);insFinalizeBase(e,auto);const r=e&&P.records.find(x=>x.id===e.id);if(r){if(e.short)r.short=true;if(e.times&&!r.times)r.times=structuredClone(e.times);pSave()}};
const insMS=ms=>{const s=Math.round(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function insTimes(r,times){const rows=r.ids.map((id,i)=>({n:i+1,ms:times[id]||0})).filter(x=>x.ms>0);if(!rows.length)return '';const total=rows.reduce((s,x)=>s+x.ms,0),top=[...rows].sort((a,b)=>b.ms-a.ms).slice(0,5);
return `<section class="p-section" id="ins-times"><h2>Час на завдання</h2><p class="p-caption">Загалом ${insMS(total)}, у середньому ${insMS(total/rows.length)} на завдання. Найдовше: ${top.map(x=>'№ '+x.n+' — '+insMS(x.ms)).join('; ')}.</p></section>`}
// pFinalize builds the record without our flags and opens the result at once, so the flag is taken from the finished exam.
const insResultBase=pResult;pResult=function(id){insResultBase(id);const r=P.records.find(x=>x.id===id),sc=$('.p-result-score');if(!r||!sc)return;if(P.exam?.id===r.id&&P.exam.short)r.short=true;
const g=insGroup(r),times=r.times||(P.exam?.id===r.id?P.exam.times:null);sc.insertAdjacentHTML('afterend',insCompare(r)+(g.length>1?insTrend(g,insTitle(r)):'')+(times?insTimes(r,times):''))};
// Швидка перевірка: 15 випадкових завдань варіанта за 15 хвилин. У прогноз бала не входить (завдань менше, ніж у предметі).
function pLaunchShort(sid){return testsGuard('exam',()=>{if(!SUB[sid])return;if(P.exam&&!P.exam.finished&&!confirm('Замінити незавершений пробник? Його відповіді буде втрачено.'))return;
const v=stNextVariant(sid),all=pMockSet(sid,v),ids=pSeedShuffle(all.map((_,i)=>i),Date.now()).slice(0,INS_SHORT_N).sort((a,b)=>a-b).map(i=>all[i]),now=Date.now();
P.exam={id:'exam-'+now,subject:sid,variant:v,full:false,short:true,ids,blocks:[ids],stage:1,index:0,answers:{},started:now,deadline:now+INS_SHORT_MIN*60000,title:SUB[sid].name+' · швидка перевірка',finished:null};pSave();go('simulate')})}
const insMocksBase=pMocks;pMocks=function(subject=''){insMocksBase(subject);if(subject)return;
const html=`<section class="p-section" id="ins-quick"><h2>Швидка перевірка</h2><p>${INS_SHORT_N} завдань з одного варіанта за ${INS_SHORT_MIN} хвилин. У прогноз бала не входить.</p><div class="p-actions">${SUBJECTS.map(s=>`<button onclick="pLaunchShort('${s.id}')">${esc(s.name)}</button>`).join('')}</div></section>`,tr=insTrends(),
 all=html+(tr?`<section class="p-section"><h2>Динаміка результатів</h2><div class="ins-trends">${tr}</div></section>`:''),f=$('#main .p-footer');if(f)f.insertAdjacentHTML('beforebegin',all);else $('#main').insertAdjacentHTML('beforeend',all)};
// Бланк відповідей: усі завдання блоку в одній таблиці; варіант із вибором відповідає кружечком, решта відкривається в завданні.
let insSheetOpen=false;
function insAnswerText(q,v){return q.type==='numeric'?String(v):q.type==='match'?v.map((x,j)=>(j+1)+'→'+(x>=0?insLetter(x):'?')).join(' '):q.type==='order'?v.map(insLetter).join(''):''}
function insSheet(){const c=pContext();if(!c?.exam||!P.exam)return;const e=P.exam,lock=!!e.finished||e.stage==='break';
const rows=c.ids.map((id,i)=>{const q=PM[id],v=e.answers[id];let cell;
if(q.type==='single'||q.type==='multi')cell=q.options.map((_,k)=>{const on=q.type==='single'?v===k:Array.isArray(v)&&v.includes(k);return `<button type="button" class="ins-bubble" aria-pressed="${on}" aria-label="Завдання ${i+1}, варіант ${insLetter(k)}" ${lock?'disabled':''} onclick="insSheetPick(${i},${k})">${insLetter(k)}</button>`}).join('');
else cell=`<span>${pValid(q,v)?esc(insAnswerText(q,v)):'—'}</span> <button type="button" class="textbtn" onclick="insSheetGo(${i})">Відкрити</button>`;
return `<div class="ins-sheet-row"><strong>${i+1}</strong><div>${cell}</div></div>`}).join('');
$('#modal').innerHTML=`<div class="row between"><h2>Бланк відповідей</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><p class="p-caption">Познач варіант кружечком. Завдання з іншим типом відповіді відкриваються кнопкою «Відкрити».</p><div class="ins-sheet">${rows}</div>`;
insSheetOpen=true;if(!$('#modal').open)$('#modal').showModal()}
function insSheetPick(i,k){if(pCheckExpiry()){$('#modal').close();return}P.exam.index=i;pChoose(k);insSheet()}
function insSheetGo(i){P.exam.index=i;pSave();insSheetOpen=false;$('#modal').close();pPractice()}
$('#modal').addEventListener('close',()=>{if(insSheetOpen){insSheetOpen=false;if(P.exam&&route.startsWith('simulate'))pPractice()}});
// Історія спроб одного завдання: до 10 останніх записів {at, s}.
// Історія тримається в тій відповіді, де її лишає перевірка: P.answers (звичайні завдання) або S.answers (завдання історії).
const insCheckBase=pCheck;pCheck=function(){const q=pQ(),oP=q&&P.answers[q.id],oS=q&&S.answers[q.id],nP=oP?.attempts||0,nS=oS?.attempts||0;insCheckBase();
const aP=q&&P.answers[q.id],aS=q&&S.answers[q.id],add=(a,o)=>{a.hist=(o?.hist||[]).concat([{at:a.at,s:a.score}]).slice(-10)};let done=false;
if(aP&&(aP.attempts||0)>nP){add(aP,oP);pSave();done=true}else if(aS&&(aS.attempts||0)>nS){add(aS,oS);save();done=true}
if(done)pPractice()};
const insNormBase=normaliseImport;normaliseImport=function(raw,lenient){const n=insNormBase(raw,lenient);for(const [id,a] of Object.entries(n.answers)){const h=guardHist(raw?.state?.answers?.[id]?.hist,a.max);if(h.length)a.hist=h}return n};
const insPracticeBase=pPractice;pPractice=function(){insPracticeBase();const c=pContext(),q=pQ();if(!c||!q)return;
if(c.exam&&P.exam&&!P.exam.finished&&P.exam.stage!=='break'){const e=P.exam;if(insTick&&(insTick.exam!==e.id||insTick.id!==q.id))insFlush(e);if(!insTick)insTick={exam:e.id,id:q.id,t:Date.now()}}else if(c.exam&&P.exam&&P.exam.stage==='break'&&insTick)insFlush(P.exam);
const acts=$('.p-practice-top .p-actions');if(c.exam&&acts)acts.insertAdjacentHTML('beforeend','<button onclick="insSheet()">Бланк</button>');
const a=!c.exam&&!c.record&&pAnswers()[q.id],qa=$('.p-question-actions');
if(a&&qa&&(a.attempts>1||a.hist?.length>1)){const h=a.hist||[];qa.insertAdjacentHTML('beforebegin',`<details class="ins-hist"><summary>Історія спроб (${a.attempts})</summary><ul>${h.map(x=>`<li>${new Date(x.at).toLocaleString('uk-UA')} — ${x.s} із ${a.max}</li>`).join('')}</ul>${a.attempts>h.length?`<p class="p-caption">У журналі останні ${h.length} із ${a.attempts} спроб.</p>`:''}</details>`)}};
// Відставання від графіка: за етапом підготовки (STUDY_PHASES) і за днями без занять.
function insActivity(n){let k=0;for(let i=0;i<n;i++){const d=new Date(Date.parse(pDay()+'T12:00:00Z')-i*INS_DAY).toISOString().slice(0,10);if((P.logs[d]||0)+(S.days?.[d]||0))k++}return k}
function insBehind(){const days=stDaysLeft();if(!days||(typeof extVacOn==='function'&&extVacOn())||(!Object.keys(pAnswers()).length&&!P.records.length))return '';const ph=stPhase(days),notes=[],
last=Math.max(0,...P.records.filter(r=>r.finished&&!r.short).map(r=>r.finished),...(P.official?.records||[]).filter(r=>r.finished).map(r=>r.finished)),since=last?Math.max(0,Math.floor((Date.now()-last)/INS_DAY)-(typeof extVacDaysSince==='function'?extVacDaysSince(last):0)):null;
if(since===null)notes.push(`Пробників ще не було, а на етапі «${ph.name}» їх рекомендовано кожні ${ph.mockEvery} днів.`);else if(since>ph.mockEvery)notes.push(`Останній пробник був ${stPlural(since,'день','дні','днів')} тому, а на етапі «${ph.name}» їх рекомендовано кожні ${ph.mockEvery} днів.`);
const act=insActivity(7)+(typeof extVacDaysSince==='function'?Math.min(7,extVacDaysSince(Date.now()-6*INS_DAY)):0);if(act<=3)notes.push(`Заняття були лише в ${act} із останніх 7 днів.`);
if(!notes.length)return '';
return `<section class="p-alert ins-behind"><div><h2>Ти відстаєш від графіка</h2><ul>${notes.map(n=>`<li>${n}</li>`).join('')}</ul><p>Як наздогнати: пройди швидку перевірку на ${INS_SHORT_MIN} хвилин і повертайся до занять щодня хоча б на ${P.plan.minutes} хвилин, як у плані.</p></div><a class="p-btn primary" href="#mocks">До швидкої перевірки</a></section>`}
const insTestsBase=testsPage;testsPage=function(){insTestsBase();$('#main .p-page-head')?.insertAdjacentHTML('afterend',(typeof extVacNotice==='function'?extVacNotice():'')+insBehind())};
const insPlanBase=pPlan;pPlan=function(){insPlanBase();$('#main .p-page-head')?.insertAdjacentHTML('afterend',insBehind())};
// Базові pNormal і normaliseImport працювали вже під час завантаження, тож журнал спроб, збережений раніше, читаємо ще раз.
function insReloadHist(){for(const [key,store] of [[PKEY,P],[KEY,S]])try{const raw=JSON.parse(restoreRead(key)||'null');for(const [id,a] of Object.entries(store.answers)){const h=guardHist(raw?.answers?.[id]?.hist,a.max);if(h.length)a.hist=h}}catch{}}
insReloadHist();
