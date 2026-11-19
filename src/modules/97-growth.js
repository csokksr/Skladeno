/* Приріст за блок. Перед блоком тем короткий зріз на 10 офіційних завдань, після блоку такий самий зріз з інших завдань
   тих самих тем; сайт показує «було → стало». Рахується перша спроба (P.answers[id].first): друге проходження тих самих
   завдань вимірювало б пам'ять, а не знання, тому зрізи складаються з різних завдань і діляться навпіл за типами. */
const GROWTH_MAX = 12;
const GROWTH_ID = /^g[0-9a-z]{3,12}$/;
function growthFresh() {
  return { blocks: [] };
}
const growthFreshBase = pFresh;
pFresh = function () {
  return { ...growthFreshBase(), growth: growthFresh() };
};
function growthTopics(sid) {
  return DB.quality.topics.filter(t => t.subject === sid);
}
// Зріз: завдання з PM, без повторів, 5–10 штук; done — знімок результату, коли всі відповіді вже є.
function growthCleanSlice(s, taken) {
  if (!s || !Array.isArray(s.ids) || s.ids.length < 5 || s.ids.length > 10) return null;
  if (new Set(s.ids).size !== s.ids.length || !s.ids.every(id => PM[id] && !taken.has(id)))
    return null;
  let out = { ids: [...s.ids], at: Number.isFinite(s.at) && s.at > 0 ? s.at : Date.now() };
  let d = s.done;
  if (
    d &&
    Number.isInteger(d.score) &&
    Number.isInteger(d.max) &&
    d.max > 0 &&
    d.score >= 0 &&
    d.score <= d.max
  )
    out.done = {
      score: d.score,
      max: d.max,
      at: Number.isFinite(d.at) && d.at > 0 ? d.at : out.at,
    };
  return out;
}
function growthNormal(raw) {
  let n = growthFresh();
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.blocks)) return n;
  let seen = new Set();
  for (let b of raw.blocks) {
    if (!b || !GROWTH_ID.test(b.id) || seen.has(b.id) || !SUB[b.sid] || !Array.isArray(b.topics))
      continue;
    let known = new Set(growthTopics(b.sid).map(t => t.id)),
      topics = [...new Set(b.topics)].filter(id => known.has(id)).slice(0, 4);
    if (!topics.length) continue;
    let taken = new Set(),
      before = growthCleanSlice(b.before, taken);
    if (!before) continue;
    before.ids.forEach(id => taken.add(id));
    let after = b.after ? growthCleanSlice(b.after, taken) : null;
    seen.add(b.id);
    n.blocks.push({
      id: b.id,
      sid: b.sid,
      topics,
      title: String(b.title || '').slice(0, 120),
      created: Number.isFinite(b.created) && b.created > 0 ? b.created : Date.now(),
      before,
      after,
    });
  }
  n.blocks = n.blocks.slice(-GROWTH_MAX);
  return n;
}
const growthNormalBase = pNormal;
pNormal = function (raw) {
  let n = growthNormalBase(raw);
  n.growth = growthNormal(raw.growth);
  return n;
};
// Верстви під час завантаження вже прочитали сховище: додаємо стан блоків до першого малювання.
try {
  P.growth = growthNormal(JSON.parse(localStorage.getItem(PKEY) || 'null')?.growth);
} catch {
  P.growth = growthFresh();
}

// Нові офіційні завдання тем блоку (ще без відповіді): лише з роком тесту, без складних і лише для іспиту.
function growthPool(sid, topicIds) {
  let seen = new Set(),
    out = [];
  for (let t of growthTopics(sid).filter(t => topicIds.includes(t.id)))
    for (let id of t.questions) {
      let q = PM[id];
      if (q && q.year && !q.challenge && !q.examOnly && !P.answers[id] && !seen.has(id)) {
        seen.add(id);
        out.push(q);
      }
    }
  return out;
}
// Перший зріз: кожен тип завдань ділиться навпіл, і половина лишається про запас для другого зрізу. Потрібно n ≥ 5 (до 10) у кожній.
function growthPick(sid, topicIds, seed) {
  let by = {};
  for (let q of pSeedShuffle(growthPool(sid, topicIds), seed)) (by[q.type] ??= []).push(q.id);
  let a = [],
    b = [];
  for (let list of Object.values(by)) list.forEach((id, i) => (i % 2 ? b : a).push(id));
  let n = Math.min(10, a.length, b.length);
  return n < 5 ? null : pSeedShuffle(a, seed + 1).slice(0, n);
}
// Результат зрізу за першими спробами; null, поки не всі завдання розв'язано.
function growthScore(slice) {
  if (!slice) return null;
  if (slice.done) return slice.done;
  let score = 0,
    max = 0,
    at = 0;
  for (let id of slice.ids) {
    let x = P.answers[id];
    if (!x) return null;
    score += Math.min(x.first ?? x.score, x.max);
    max += x.max;
    at = Math.max(at, x.at || 0);
  }
  return { score, max, at: at || Date.now() };
}
// Знімок результату лишається, навіть якщо відповіді потім скинуто.
function growthSync() {
  let changed = false;
  for (let b of P.growth.blocks)
    for (let k of ['before', 'after']) {
      let s = b[k];
      if (s && !s.done && (b[k] === b.before || b.before.done)) {
        let r = growthScore(s);
        if (r) {
          s.done = r;
          changed = true;
        }
      }
    }
  if (changed) pSave();
}
const growthPct = r => Math.round((100 * r.score) / r.max);
function growthResult(b) {
  let x = b.before?.done,
    y = b.after?.done;
  if (!x || !y) return null;
  return { before: x, after: y, delta: growthPct(y) - growthPct(x) };
}

let growthDraft = { sid: 'ukr', topics: [] };
function growthSubject(sid) {
  if (!SUB[sid]) return;
  growthDraft = { sid, topics: [] };
  growthPage();
}
function growthToggle(id) {
  let t = growthDraft.topics,
    i = t.indexOf(id);
  if (i >= 0) t.splice(i, 1);
  else if (t.length < 4) t.push(id);
  else toast('У блоці до 4 тем.');
  growthPage();
}
function growthCreate() {
  let { sid, topics } = growthDraft;
  if (!topics.length) {
    toast('Познач хоча б одну тему блоку.');
    return;
  }
  if (P.growth.blocks.length >= GROWTH_MAX) {
    toast('Блоків уже ' + GROWTH_MAX + '. Видали старий, щоб почати новий.');
    return;
  }
  let seed = Date.now() % 1000003,
    before = growthPick(sid, topics, seed);
  if (!before) {
    toast('У цих темах замало нових офіційних завдань для двох зрізів. Додай тему.');
    return;
  }
  let titles = growthTopics(sid)
    .filter(t => topics.includes(t.id))
    .map(t => t.title);
  P.growth.blocks.push({
    id: 'g' + seed.toString(36),
    sid,
    topics: [...topics],
    title: titles.join(' · ').slice(0, 120),
    created: Date.now(),
    before: { ids: before, at: Date.now() },
    after: null,
  });
  P.growth.blocks.splice(0, Math.max(0, P.growth.blocks.length - GROWTH_MAX));
  let b = P.growth.blocks.at(-1);
  growthDraft = { sid, topics: [] };
  pSave();
  growthStart(b.id, 'before');
}
function growthStart(id, which) {
  let b = P.growth.blocks.find(b => b.id === id),
    s = b?.[which];
  if (!s) return;
  if (which === 'after' && !b.before.done) {
    toast('Спершу заверши зріз до блоку.');
    return;
  }
  pStart(
    s.ids,
    (which === 'before' ? 'Зріз до блоку · ' : 'Зріз після блоку · ') + b.title,
    'growth-' + id + '-' + which
  );
}
// Другий зріз добирається, коли перший пройдено: з тих завдань тем, що ще нові (теми вже вивчали), з тим самим складом за типами.
function growthPlanAfter(id) {
  let b = P.growth.blocks.find(b => b.id === id);
  if (!b || b.after || !b.before.done) return;
  let need = {},
    n = b.before.ids.length;
  for (let q of b.before.ids) need[PM[q].type] = (need[PM[q].type] || 0) + 1;
  let pool = pSeedShuffle(
      growthPool(b.sid, b.topics).filter(q => !b.before.ids.includes(q.id)),
      Date.now() % 1000003
    ),
    ids = [];
  for (let q of pool)
    if (need[q.type] > 0) {
      need[q.type]--;
      ids.push(q.id);
    }
  for (let q of pool) if (ids.length < n && !ids.includes(q.id)) ids.push(q.id);
  if (ids.length < n) {
    toast('У темах блоку не лишилося досить нових завдань для другого зрізу.');
    return;
  }
  b.after = { ids, at: Date.now() };
  pSave();
  growthStart(id, 'after');
}
function growthDelete(id) {
  if (!confirm('Видалити блок і його результати?')) return;
  P.growth.blocks = P.growth.blocks.filter(b => b.id !== id);
  pSave();
  growthPage();
}
const growthTopicHref = id => (id.startsWith('hist-') ? '#topic/' + id.slice(5) : '#lesson/' + id);
function growthBlockHTML(b) {
  let res = growthResult(b),
    sub = SUB[b.sid].name,
    x = b.before.done,
    y = b.after?.done,
    done = k => (b[k]?.ids || []).filter(id => P.answers[id]).length,
    steps = [];
  steps.push(
    x
      ? `<li class="is-done">Зріз до блоку: ${x.score} з ${x.max} (${growthPct(x)}%)</li>`
      : `<li>Зріз до блоку: ${done('before')} з ${b.before.ids.length} завдань <button class="primary" onclick="growthStart('${b.id}','before')">${done('before') ? 'Продовжити' : 'Почати'} ›</button></li>`
  );
  steps.push(
    `<li class="${x ? '' : 'is-wait'}">Вивчи теми блоку: ${b.topics.map(t => `<a href="${growthTopicHref(t)}">${esc(growthTopics(b.sid).find(z => z.id === t)?.title || t)}</a>`).join(', ')}</li>`
  );
  steps.push(
    y
      ? `<li class="is-done">Зріз після блоку: ${y.score} з ${y.max} (${growthPct(y)}%)</li>`
      : `<li class="${x ? '' : 'is-wait'}">Зріз після блоку: ${b.after ? done('after') + ' з ' + b.after.ids.length + ' завдань ' : 'інші завдання з тих самих тем '}${x ? `<button ${b.after ? 'class="primary"' : ''} onclick="${b.after ? `growthStart('${b.id}','after')` : `growthPlanAfter('${b.id}')`}">${done('after') ? 'Продовжити' : 'Почати'} ›</button>` : '<span class="p-caption">стане доступним після першого зрізу</span>'}</li>`
  );
  let verdict = res
    ? `<p class="p-growth-result"><strong>Було ${growthPct(res.before)}% → стало ${growthPct(res.after)}%</strong> (${res.delta > 0 ? '+' : ''}${res.delta} в. п.). ${res.delta > 0 ? 'Блок дав приріст.' : res.delta === 0 ? 'Результат не змінився: повтори теми й спробуй ще один блок.' : 'Результат знизився: повернись до помилок цих тем.'} Зрізи малі (${res.before.max} і ${res.after.max} балів), тож різницю в кілька відсотків не варто читати як точну.</p>`
    : '';
  return `<section class="p-section p-growth-block"><div class="p-section-head"><div><h2>${esc(b.title)}</h2><p class="p-caption">${esc(sub)} · ${new Date(b.created).toLocaleDateString('uk-UA')}</p></div><button onclick="growthDelete('${b.id}')" aria-label="Видалити блок">Видалити</button></div><ol class="p-growth-steps">${steps.join('')}</ol>${verdict}</section>`;
}
function growthPage() {
  growthSync();
  let d = growthDraft,
    list = growthTopics(d.sid),
    fresh = id => growthPool(d.sid, [id]).length,
    blocks = [...P.growth.blocks].reverse();
  $('#main').innerHTML =
    pHeading(
      'Вимір прогресу',
      'Приріст за блок',
      'Зріз на 10 офіційних завдань до блоку тем і інший зріз після нього покажуть, чого блок навчив. Зараховується лише перша спроба.'
    ) +
    `<section class="p-section"><div class="p-section-head"><h2>Новий блок</h2></div><div class="p-actions" role="group" aria-label="Предмет">${SUBJECTS.map(s => `<button ${s.id === d.sid ? 'class="primary" aria-pressed="true"' : 'aria-pressed="false"'} onclick="growthSubject('${s.id}')">${s.name}</button>`).join('')}</div><p class="p-caption">Познач до 4 тем. Біля теми число нових офіційних завдань: для двох зрізів потрібно щонайменше 10.</p><div class="p-topic-list">${list.map(t => `<label class="p-topic-row"><input type="checkbox" ${d.topics.includes(t.id) ? 'checked' : ''} onchange="growthToggle('${t.id}')"><h3>${esc(t.title)}</h3><span>${fresh(t.id)} нових</span></label>`).join('')}</div><div class="p-actions"><button class="primary" onclick="growthCreate()">Почати зріз до блоку ›</button></div></section>` +
    (blocks.length
      ? blocks.map(growthBlockHTML).join('')
      : '<p class="p-caption">Блоків ще немає.</p>');
}
// Короткий рядок на головній і в плані: останній виміряний приріст або наступний крок.
function growthHubHTML() {
  let bs = P.growth.blocks,
    last = [...bs].reverse().find(b => growthResult(b)),
    open = [...bs].reverse().find(b => !b.after?.done),
    r = last && growthResult(last),
    text = r
      ? `Останній блок: було ${growthPct(r.before)}% → стало ${growthPct(r.after)}% (${r.delta > 0 ? '+' : ''}${r.delta} в. п.).`
      : open
        ? `Блок «${esc(open.title)}»: ${open.before.done ? 'час на зріз після блоку' : 'пройди зріз до блоку'}.`
        : 'Зріз до блоку тем і інший після нього покажуть, чого блок навчив.';
  return `<section class="p-section st-growth"><div class="p-section-head"><div><h2>Приріст за блок</h2><p class="p-caption">${text}</p></div><a href="#growth">Відкрити ›</a></div></section>`;
}

const growthRenderBase = render;
render = function () {
  if ((location.hash.slice(1) || 'hub').split('/')[0] === 'growth') {
    route = 'growth';
    growthPage();
    document.title = 'Приріст за блок · Складено';
    syncSiteNavigation();
    return;
  }
  growthRenderBase();
};
const growthCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return (location.hash.slice(1) || 'hub').split('/')[0] === 'growth'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Приріст за блок', to: 'growth' },
      ]
    : growthCrumbsBase();
};
