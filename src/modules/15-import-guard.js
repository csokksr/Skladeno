// Backups and cloud sync arrive from outside: keep only well-formed keys, ids and short plain titles.
function guardText(v, n = 200) {
  return String(v ?? '')
    .replace(/[<>\u0000-\u001f]/g, '')
    .slice(0, n);
}
// Session keys are built from topic ids and, for history cards, from Ukrainian titles: allow letters, digits and plain punctuation, never markup, quotes or prototype names.
function guardKey(key) {
  return (
    typeof key === 'string' &&
    key.length >= 1 &&
    key.length <= 160 &&
    !/[<>"'&\\`\u0000-\u001f]/.test(key) &&
    !['__proto__', 'constructor', 'prototype'].includes(key)
  );
}
// Flags «повернутися»: only ids of the same run, only true.
function guardFlags(f, ids) {
  const out = {};
  if (f && typeof f === 'object' && Array.isArray(ids))
    for (const id of ids) if (f[id] === true) out[id] = true;
  return Object.keys(out).length ? { flags: out } : {};
}
function guardRun(e) {
  if (!e || typeof e !== 'object') return null;
  let started = Number.isFinite(e.started) ? e.started : Date.now(),
    subject = SUB[e.subject] || e.subject === 'all' ? e.subject : null;
  if (!subject) return null;
  e.id = /^exam-\d{1,16}$/.test(e.id) ? e.id : 'exam-' + started;
  e.subject = subject;
  if ('full' in e) e.full = subject === 'all';
  if ('flags' in e) {
    const g = guardFlags(e.flags, e.ids);
    if (g.flags) e.flags = g.flags;
    else delete e.flags;
  }
  for (const k of ['started', 'finished', 'deadline'])
    if (k in e && e[k] !== null)
      e[k] = Number.isFinite(e[k]) ? e[k] : k === 'started' ? started : null;
  e.variant = Math.max(1, Math.min(99, Math.trunc(Number(e.variant) || 1)));
  if ('short' in e) {
    if (e.short === true && subject !== 'all') e.short = true;
    else delete e.short;
  }
  e.title =
    (subject === 'all' ? 'Повна симуляція' : SUB[subject].name) +
    (e.short === true ? ' · швидка перевірка' : ' · варіант ' + e.variant);
  if ('times' in e) {
    const t = {};
    if (e.times && typeof e.times === 'object' && Array.isArray(e.ids))
      for (const id of e.ids) {
        const v = e.times[id];
        if (Number.isFinite(v) && v > 0) t[id] = Math.min(v, 3600000);
      }
    if (Object.keys(t).length) e.times = t;
    else delete e.times;
  }
  return e;
}
function guardPlatform(n) {
  for (let key of Object.keys(n.sessions)) {
    let s = n.sessions[key];
    if (!guardKey(key)) delete n.sessions[key];
    else
      n.sessions[key] = {
        ids: s.ids,
        title: guardText(s.title),
        index: s.index,
        ...guardFlags(s.flags, s.ids),
      };
  }
  if (!n.sessions[n.current]) n.current = null;
  if (n.exam) n.exam = guardRun(n.exam);
  n.records = n.records.map(guardRun).filter(Boolean);
  return n;
}
// Journal of attempts at one task: at most 10 entries {at, s}, score within the task's maximum.
function guardHist(h, max) {
  return Array.isArray(h)
    ? h
        .filter(x => x && Number.isFinite(x.at) && Number.isFinite(x.s) && x.s >= 0 && x.s <= max)
        .slice(-10)
        .map(x => ({ at: x.at, s: x.s }))
    : [];
}
const guardNormalBase = pNormal;
pNormal = function (raw) {
  const n = guardPlatform(guardNormalBase(raw));
  for (const [id, a] of Object.entries(n.answers)) {
    const h = guardHist(raw.answers?.[id]?.hist, a.max);
    if (h.length) a.hist = h;
  }
  return n;
};
try {
  P = guardPlatform(P);
} catch {}
