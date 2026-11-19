// Mistake reasons → advice and targeted practice; timed sprints against the НМТ pace.
const UI_REASON_TIPS = {
  knowledge: 'Повтори конспект теми, а потім розв’яжи ці завдання ще раз без підказки.',
  reading:
    'Перш ніж обирати, познач, що саме питають: «НЕ», «усі», «найменше», одиниці виміру. Дочитуй умову до кінця.',
  method: 'Перечитай покрокове пояснення й розв’яжи завдання знову, не дивлячись у нього.',
  calculation: 'Після відповіді роби швидку перевірку: підстав результат або оціни його приблизно.',
  attention: 'На останньому кроці порівнюй свою відповідь саме з тим, про що питали.',
  time: 'Тренуй темп у спринтах: 10 завдань у межах часу НМТ.',
};
function uiReasonIds(reason) {
  return Object.entries(P.coach.items)
    .filter(([id, x]) => x.reason === reason && PM[id])
    .map(([id]) => id);
}
function uiReasonPractice(reason) {
  const ids = uiReasonIds(reason);
  if (!ids.length) return;
  pStart(ids, 'Помилки: ' + COACH_REASONS[reason].toLowerCase(), 'reason-' + reason);
}
function uiReasons() {
  const rows = Object.entries(COACH_REASONS)
      .map(([id, label]) => ({ id, label, ids: uiReasonIds(id) }))
      .filter(r => r.ids.length)
      .sort((a, b) => b.ids.length - a.ids.length),
    top = rows[0]?.ids.length || 1;
  const body = rows.length
    ? `<div class="ui-reasons">${rows.map(r => `<article><div class="ui-reason-head"><strong>${esc(r.label)}</strong><span>${r.ids.length}</span></div><div class="ui-reason-bar"><i style="width:${Math.round((r.ids.length / top) * 100)}%"></i></div><p>${UI_REASON_TIPS[r.id]}</p><div class="p-actions"><button onclick="uiReasonPractice('${r.id}')">Розв’язати ці завдання (${r.ids.length})</button>${r.id === 'time' ? `<button onclick="uiSprintStart('${uiSprintSubject()}')">Спринт</button>` : ''}</div></article>`).join('')}</div>`
    : '<p>Поки причин немає. Після помилки в тренажері вибери, чому вона сталася, і тут з’явиться порада, що тренувати.</p>';
  return `<section class="p-section" id="ui-reasons"><div class="p-section-head"><div><h2>Чому я помиляюся</h2><p>Причини, які ти вибираєш після помилки. Найчастіша підкаже, що тренувати: теорію, уважність чи темп.</p></div></div>${body}</section>`;
}
function uiSprintSubject() {
  const slow = SUBJECTS.map(s => {
    const a = P.study.speed?.[s.id] || [];
    return { id: s.id, r: a.length ? uiMedian(a.slice(-60)) / UI_NORM[s.id] : 0 };
  }).sort((a, b) => b.r - a.r)[0];
  return slow?.id || SUBJECTS[0].id;
}
let uiSprint = null,
  uiSprintTimer = 0;
function uiSprintPick(sid, n = 10) {
  const aa = pAnswers(),
    pool = PQ.filter(q => q.subject === sid && q.type === 'single'),
    shuffle = a =>
      pSeedShuffle(
        a.map(q => q.id),
        Date.now()
      ),
    fresh = shuffle(pool.filter(q => !aa[q.id])),
    wrong = shuffle(pool.filter(q => aa[q.id] && aa[q.id].score < aa[q.id].max));
  return [...wrong.slice(0, 3), ...fresh].slice(0, n);
}
function uiSprintStart(sid) {
  if (!SUB[sid]) return;
  const ids = uiSprintPick(sid);
  if (!ids.length) {
    toast('Для спринту бракує нових завдань з цього предмета.');
    return;
  }
  const key = 'sprint-' + sid,
    now = Date.now();
  uiSprintStop();
  delete P.sessions[key];
  uiSprint = { key, sid, ids, started: now, limit: ids.length * UI_NORM[sid] * 1000, done: false };
  pStart(ids, SUB[sid].name + ' · спринт', key);
}
function uiSprintStats() {
  const s = uiSprint,
    rec = s.ids
      .map(id => pAnswerRecord(id))
      .filter(a => a && a.at >= s.started && a.at <= s.started + s.limit);
  return { checked: rec.length, right: rec.filter(a => a.score === a.max).length };
}
function uiSprintHTML() {
  const s = uiSprint,
    { checked, right } = uiSprintStats(),
    used = Date.now() - s.started,
    left = s.limit - used,
    over = left <= 0,
    finished = s.done || checked === s.ids.length || over;
  if (finished && !s.done) {
    s.done = true;
    s.used = Math.min(used, s.limit);
  }
  if (!finished)
    return `<div class="ui-sprint" role="timer" aria-live="off"><strong>${uiTime(Math.ceil(left / 1000))}</strong><span>Спринт · ${checked}/${s.ids.length} · правильно ${right}</span></div>`;
  const pace = checked ? Math.round(s.used / 1000 / checked) : 0,
    norm = UI_NORM[s.sid],
    verdict =
      over && checked < s.ids.length
        ? 'Час вийшов раніше, ніж ти закінчив: на НМТ у такому темпі частина завдань лишиться без відповіді.'
        : pace <= norm
          ? 'Ти вклався в норму НМТ.'
          : 'Повільніше за норму: тренуй ще.';
  return `<div class="ui-sprint ui-sprint-done" role="status"><strong>Спринт завершено: ${right} з ${s.ids.length}</strong><span>${checked ? `${uiTime(pace)} на завдання при нормі ${uiTime(norm)}. ` : ''}${verdict}</span><div class="p-actions"><button class="primary" onclick="uiSprintStart('${s.sid}')">Ще спринт</button>${right < checked ? `<button onclick="pReview('wrong','${s.sid}')">Розібрати помилки</button>` : ''}</div></div>`;
}
function uiSprintStop() {
  clearInterval(uiSprintTimer);
  uiSprintTimer = 0;
}
function uiSprintPaint() {
  const el = document.querySelector('.ui-sprint');
  if (!uiSprint || P.current !== uiSprint.key || !el || el.classList.contains('ui-sprint-done')) {
    uiSprintStop();
    return;
  }
  el.outerHTML = uiSprintHTML();
  if (uiSprint.done) uiSprintStop();
}
const uiSprintPractice = pPractice;
pPractice = function () {
  uiSprintPractice();
  if (!uiSprint || P.current !== uiSprint.key) return;
  const top = document.querySelector('.p-practice-top');
  if (!top) return;
  top.insertAdjacentHTML('afterend', uiSprintHTML());
  if (uiSprint.done) uiSprintStop();
  else if (!uiSprintTimer) uiSprintTimer = setInterval(uiSprintPaint, 1000);
};
const uiSprintCheck = pCheck;
pCheck = function () {
  uiSprintCheck();
  if (uiSprint && P.current === uiSprint.key) uiSprintPaint();
};
const uiSprintAnalytics = pAnalytics;
pAnalytics = function () {
  uiSprintAnalytics();
  const speed = [...document.querySelectorAll('#main .p-section')].find(
    s => s.querySelector('h2')?.textContent === 'Темп'
  );
  if (!speed) return;
  speed.insertAdjacentHTML(
    'beforeend',
    `<div class="p-actions">${SUBJECTS.map(s => `<button onclick="uiSprintStart('${s.id}')">Спринт · ${esc(s.name)}</button>`).join('')}</div><p class="p-caption">10 завдань з однією правильною відповіддю. Час — як на НМТ: ${SUBJECTS.map(s => esc(s.name.split(' ')[0].toLowerCase()) + ' ' + uiTime(UI_NORM[s.id] * 10)).join(', ')}.</p>`
  );
  speed.insertAdjacentHTML('afterend', uiReasons());
};
