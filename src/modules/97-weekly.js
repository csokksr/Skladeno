/* «Суперник — ти сам тиждень тому». Раз на 7 днів сайт зберігає знімок відповідей (P.weekly.snaps: за предметом кількість завдань,
   бали першої спроби й максимум), а порівняння показує, що змінилося відтоді. Без сервера: усе в прогресі браузера.
   Журнал дій P.logs уже зберігає кожен день окремо, тож активність порівнюється за ним, а не копіюється в знімок. */
const WEEKLY_KEEP = 8;
const WEEKLY_DAY = /^\d{4}-\d{2}-\d{2}$/;
function weeklyFresh() {
  return { snaps: [] };
}
const weeklyFreshBase = pFresh;
pFresh = function () {
  return { ...weeklyFreshBase(), weekly: weeklyFresh() };
};
function weeklyNormal(raw) {
  let n = weeklyFresh(),
    seen = new Set();
  if (!raw || !Array.isArray(raw.snaps)) return n;
  let nat = v => Number.isSafeInteger(v) && v >= 0 && v <= 1e7;
  for (let s of raw.snaps) {
    if (!s || !WEEKLY_DAY.test(s.day) || seen.has(s.day) || !Number.isFinite(s.at) || !s.subjects)
      continue;
    let subjects = {},
      ok = true;
    for (let sub of SUBJECTS) {
      let x = s.subjects[sub.id];
      if (!x && ['bio', 'geo'].includes(sub.id)) {
        subjects[sub.id] = { n: 0, a: 0, m: 0 }; // знімки до появи біології й географії
        continue;
      }
      if (!x || !nat(x.n) || !nat(x.a) || !nat(x.m) || x.a > x.m || x.n > x.m) {
        ok = false;
        break;
      }
      subjects[sub.id] = { n: x.n, a: x.a, m: x.m };
    }
    if (!ok) continue;
    seen.add(s.day);
    n.snaps.push({ day: s.day, at: s.at, subjects });
  }
  n.snaps.sort((a, b) => (a.day < b.day ? -1 : 1));
  n.snaps = n.snaps.slice(-WEEKLY_KEEP);
  return n;
}
const weeklyNormalBase = pNormal;
pNormal = function (raw) {
  let n = weeklyNormalBase(raw);
  n.weekly = weeklyNormal(raw.weekly);
  return n;
};
// Верстви під час завантаження вже прочитали сховище: додаємо знімки до першого малювання.
try {
  P.weekly = weeklyNormal(JSON.parse(localStorage.getItem(PKEY) || 'null')?.weekly);
} catch {
  P.weekly = weeklyFresh();
}

// День зі зсувом; полудень UTC, щоб перехід на літній час не зсував дату.
function weeklyDay(offset, from = pDay()) {
  return new Date(Date.parse(from + 'T12:00:00Z') + offset * 864e5).toISOString().slice(0, 10);
}
const weeklyAge = (day, today = pDay()) =>
  Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(day + 'T12:00:00Z')) / 864e5);
// Знімок відповідей: за предметом n завдань, a балів за першими спробами з m можливих.
function weeklyStats() {
  let out = {};
  for (let s of SUBJECTS) out[s.id] = { n: 0, a: 0, m: 0 };
  for (let q of PQ) {
    let x = P.answers[q.id],
      o = out[q.subject];
    if (!x || !o) continue;
    o.n++;
    o.a += Math.min(x.first ?? x.score, x.max);
    o.m += x.max;
  }
  return out;
}
const weeklyTotal = subjects =>
  Object.values(subjects).reduce((t, x) => ({ n: t.n + x.n, a: t.a + x.a, m: t.m + x.m }), {
    n: 0,
    a: 0,
    m: 0,
  });
// Раз на 7 днів, і лише коли вже є відповіді: порожній знімок нічого б не порівнював.
function weeklyEnsure() {
  let last = P.weekly.snaps.at(-1),
    today = pDay();
  if (last && weeklyAge(last.day, today) < 7) return false;
  let subjects = weeklyStats();
  if (!weeklyTotal(subjects).n) return false;
  P.weekly.snaps.push({ day: today, at: Date.now(), subjects });
  P.weekly.snaps = P.weekly.snaps.slice(-WEEKLY_KEEP);
  pSave();
  return true;
}
// Дні з діями за 7 днів, що закінчуються в `end`.
function weeklyActive(end) {
  let n = 0;
  for (let i = 0; i < 7; i++) if ((P.logs[weeklyDay(-i, end)] || 0) > 0) n++;
  return n;
}
// Дій (перевірених відповідей) за 7 днів, що закінчуються в `end`.
function weeklySum(end) {
  let n = 0;
  for (let i = 0; i < 7; i++) n += P.logs[weeklyDay(-i, end)] || 0;
  return n;
}
const weeklyPct = (a, m) => (m ? Math.round((100 * a) / m) : null);
// Порівняння з найновішим знімком віком від 7 днів. До цього часу показується, скільки лишилося чекати.
function weeklyCompare() {
  let today = pDay(),
    ref = [...P.weekly.snaps].reverse().find(s => weeklyAge(s.day, today) >= 7);
  if (!ref) {
    let first = P.weekly.snaps[0];
    return { ref: null, wait: first ? 7 - weeklyAge(first.day, today) : null };
  }
  let now = weeklyStats(),
    t0 = weeklyTotal(ref.subjects),
    t1 = weeklyTotal(now),
    rows = SUBJECTS.map(s => {
      let a = ref.subjects[s.id],
        b = now[s.id],
        dm = b.m - a.m;
      return {
        sid: s.id,
        name: s.short || s.name,
        added: b.n - a.n,
        before: weeklyPct(a.a, a.m),
        fresh: dm > 0 ? weeklyPct(b.a - a.a, dm) : null,
      };
    }),
    dm = t1.m - t0.m;
  return {
    ref,
    days: weeklyAge(ref.day, today),
    added: t1.n - t0.n,
    before: weeklyPct(t0.a, t0.m),
    fresh: dm >= 10 ? weeklyPct(t1.a - t0.a, dm) : null, // менше 10 балів — надто мало, щоб судити про точність
    doneNow: weeklySum(today),
    doneThen: weeklySum(ref.day),
    activeNow: weeklyActive(today),
    activeThen: weeklyActive(ref.day),
    rows,
  };
}
// Підсумок за трьома мірками: дій за тиждень не менше, точність нових не нижча, активних днів не менше.
function weeklyVerdict(c) {
  let marks = [];
  marks.push(c.doneNow >= c.doneThen);
  if (c.fresh !== null && c.before !== null) marks.push(c.fresh >= c.before);
  marks.push(c.activeNow >= c.activeThen);
  let up = marks.filter(Boolean).length;
  return up === marks.length
    ? 'Ти випереджаєш себе тижневої давності.'
    : up === 0
      ? 'Цього тижня виходить слабше, ніж було: почни з короткого заняття.'
      : 'Результат змішаний: частина мірок краща, частина гірша.';
}
function weeklyHTML(full = false) {
  weeklyEnsure();
  let c = weeklyCompare(),
    head = '<div class="p-section-head"><div><h2>Ти проти себе тиждень тому</h2>';
  if (!c.ref) {
    let text =
      c.wait === null
        ? 'Знімок з’явиться, коли розв’яжеш перші завдання.'
        : `Перший знімок зроблено. Порівняння з’явиться через ${stPlural(Math.max(1, c.wait), 'день', 'дні', 'днів')}.`;
    return `<section class="p-section st-weekly">${head}<p class="p-caption">${text}</p></div></div></section>`;
  }
  let sign = n => (n > 0 ? '+' : '') + n,
    li = [
      `<li>Відповідей за тиждень: <strong>${c.doneNow}</strong> проти ${c.doneThen} тоді; нових завдань відтоді <strong>${sign(c.added)}</strong></li>`,
      c.fresh === null
        ? '<li>Точність нових завдань: замало даних для порівняння</li>'
        : `<li>Нові завдання з першої спроби: <strong>${c.fresh}%</strong> проти ${c.before}% раніше</li>`,
      `<li>Днів із заняттями за тиждень: <strong>${c.activeNow}</strong> проти ${c.activeThen} тоді</li>`,
    ].join('');
  let rows = full
    ? `<div class="tablewrap"><table class="speed-table"><caption class="p-caption">За предметами з ${c.ref.day}</caption><thead><tr><th scope="col">Предмет</th><th scope="col">Нових завдань</th><th scope="col">Нові з першої спроби</th></tr></thead><tbody>${c.rows.map(r => `<tr><th scope="row">${esc(r.name)}</th><td>${sign(r.added)}</td><td>${r.fresh === null ? '—' : r.fresh + '%'}</td></tr>`).join('')}</tbody></table></div>`
    : '';
  return `<section class="p-section st-weekly">${head}<p class="p-caption">Порівняння зі знімком ${stPlural(c.days, 'день', 'дні', 'днів')} тому. ${weeklyVerdict(c)}</p></div></div><ul class="st-weekly-list">${li}</ul>${rows}</section>`;
}
