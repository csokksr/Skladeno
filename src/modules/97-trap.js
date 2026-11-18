/* «Ще на ту саму пастку». Якщо ти позначив причину помилки (P.coach.items[id].reason), сайт добирає нові завдання з тієї самої
   пастки: тієї ж теми й того ж виду завдання. Спершу пастки, де цю причину позначено найчастіше. Нічого нового не зберігається:
   працює на вже позначених причинах і на відповідях. */
const TRAP_TYPES = {
  single: 'з однією відповіддю',
  multi: 'з кількома відповідями',
  match: 'на відповідність',
  numeric: 'з числовою відповіддю',
  order: 'на послідовність',
};
// Пастка = тема + вид завдання (формат для англійської, інакше тип).
const trapKey = q => q.topicId + '|' + (q.format || q.type);
function trapTitle(key) {
  let [topic, kind] = key.split('|'),
    t = PT[topic]?.title || T[Number(topic.slice(5)) - 1]?.title || topic;
  return t + ' · ' + (TRAP_TYPES[kind] || kind);
}
// Завдання, у яких причину позначено, а перша спроба була помилковою (пастка справді спрацювала).
function trapMarked(reason) {
  return Object.entries(P.coach.items)
    .filter(
      ([id, x]) =>
        x.reason === reason && PM[id] && P.answers[id] && P.answers[id].first < P.answers[id].max
    )
    .map(([id]) => PM[id]);
}
// Пастки за причиною, від найчастіших; seed (завдання) ставить його пастку першою.
function trapRank(reason, seed) {
  let count = {};
  for (let q of trapMarked(reason)) count[trapKey(q)] = (count[trapKey(q)] || 0) + 1;
  let keys = Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1));
  if (seed) {
    let k = trapKey(seed);
    keys = [k, ...keys.filter(x => x !== k)];
  }
  return keys.map(key => ({ key, n: count[key] || 0 }));
}
// До n нових завдань з перших трьох пасток по черзі, щоб не брати все з однієї; офіційні завдання йдуть першими. null, якщо менше 3.
function trapPick(reason, n = 10, seed = null) {
  let ranks = trapRank(reason, seed).slice(0, 3),
    lists = ranks.map(r =>
      PQ.filter(q => trapKey(q) === r.key && !P.answers[q.id] && !q.challenge && !q.examOnly)
        .sort((a, b) => (b.year ? 1 : 0) - (a.year ? 1 : 0) || (a.id < b.id ? -1 : 1))
        .map(q => q.id)
    ),
    out = [];
  for (let i = 0; out.length < n && lists.some(l => i < l.length); i++)
    for (let l of lists) if (i < l.length && out.length < n) out.push(l[i]);
  return out.length >= 3 ? out : null;
}
function trapStart(reason, seedId) {
  let ids = trapPick(reason, 10, PM[seedId] || null);
  if (!ids) {
    toast('Для цієї причини поки замало нових завдань тієї самої пастки.');
    return;
  }
  pStart(ids, 'Та сама пастка · ' + COACH_REASONS[reason], 'trap-' + reason);
}
// Блок на сторінці маршруту: за кожною причиною, яку ти позначав, головні пастки й кнопка.
function trapHTML() {
  let rows = Object.entries(COACH_REASONS)
    .map(([id, label]) => ({ id, label, ranks: trapRank(id), n: trapMarked(id).length }))
    .filter(r => r.n);
  if (!rows.length)
    return '<section class="p-section"><h2>Ще на ту саму пастку</h2><p class="p-caption">Після помилки познач причину під завданням, і тут з’являться добірки нових завдань саме на цю пастку.</p></section>';
  return `<section class="p-section st-trap"><div class="p-section-head"><div><h2>Ще на ту саму пастку</h2><p class="p-caption">Нові завдання тієї самої теми й виду, де ти позначив причину помилки. Причину ти вказуєш сам, сайт її не вгадує.</p></div></div><div class="p-topic-list">${rows
    .map(r => {
      let ids = trapPick(r.id);
      return `<div class="p-topic-row"><h3>${esc(r.label)}<small> · позначено ${r.n}</small></h3><span>${esc(trapTitle(r.ranks[0].key))}</span>${ids ? `<button onclick="trapStart('${r.id}')">Тренувати (${ids.length}) ›</button>` : '<span class="p-caption">нових завдань замало</span>'}</div>`;
    })
    .join('')}</div></section>`;
}
const trapCoachBase = coachPage;
coachPage = function () {
  trapCoachBase();
  $('#main').insertAdjacentHTML('beforeend', trapHTML());
};
// Під завданням з помилкою і позначеною причиною: кнопка «Ще на цю пастку».
const trapPracticeBase = pPractice;
pPractice = function () {
  trapPracticeBase.apply(this, arguments);
  let q = pQ(),
    cx = pContext();
  if (!q || !cx || cx.exam || cx.record) return;
  let x = P.coach.items[q.id],
    a = P.answers[q.id];
  if (!x?.reason || !a || a.first >= a.max) return;
  let ids = trapPick(x.reason, 10, q);
  if (ids)
    $('#p-answer-area')?.nextElementSibling?.insertAdjacentHTML(
      'beforeend',
      `<p><button onclick="trapStart('${x.reason}','${q.id}')">Ще ${stPlural(ids.length, 'завдання', 'завдання', 'завдань')} на цю пастку ›</button></p>`
    );
};
