/* Злиття прогресу з двох пристроїв без втрат (синхронізація веб-версії, src/web/90-web.js).
   Чиста функція: приймає й повертає сирі об'єкти {platform: P, history: S}, нічого не змінює і не читає з DOM. */
function webMerge(local, remote) {
  const bad = k => k === '__proto__'; // ключі приходять з чужого JSON
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const arr = v => (Array.isArray(v) ? v : []);
  const union = (a, b) => [...new Set([...arr(a), ...arr(b)])];
  // Перемагає новіший `at`; при рівності лишається локальний. Повертає результат і ключі, де виграв віддалений.
  const answers = (l, r) => {
    const out = {}, won = new Set();
    for (const [id, a] of Object.entries(obj(l))) if (!bad(id)) out[id] = a;
    for (const [id, a] of Object.entries(obj(r))) {
      if (bad(id)) continue;
      if (!out[id] || (Number(a?.at) || 0) > (Number(out[id]?.at) || 0)) { out[id] = a; won.add(id); }
    }
    return { out, won };
  };
  // Локальні записи мають перевагу, з віддаленого додаються лише відсутні.
  const keepLocal = (l, r) => {
    const out = {};
    for (const [k, v] of Object.entries(obj(r))) if (!bad(k)) out[k] = v;
    for (const [k, v] of Object.entries(obj(l))) if (!bad(k)) out[k] = v;
    return out;
  };
  const maxByDay = (l, r) => {
    const out = {};
    for (const src of [obj(l), obj(r)]) for (const [d, n] of Object.entries(src)) if (!bad(d) && !(Number(out[d]) >= Number(n))) out[d] = n;
    return out;
  };
  const byKey = (l, r, key, cap) => {
    const seen = new Set(), out = [];
    for (const x of [...arr(l), ...arr(r)]) {
      const k = typeof key === 'function' ? key(x) : x?.[key];
      if (k === undefined || seen.has(k)) continue;
      seen.add(k); out.push(x);
    }
    return cap ? out.slice(-cap) : out;
  };

  const L = obj(local?.platform), R = obj(remote?.platform);
  const pa = answers(L.answers, R.answers);
  const srs = { ...obj(R.study?.srs), ...obj(L.study?.srs) };
  for (const id of pa.won) if (R.study?.srs?.[id] && !bad(id)) srs[id] = R.study.srs[id];
  const platform = {
    ...R, ...L,
    answers: pa.out,
    drafts: keepLocal(L.drafts, R.drafts),
    notes: keepLocal(L.notes, R.notes),
    pins: union(L.pins, R.pins),
    read: union(L.read, R.read),
    logs: maxByDay(L.logs, R.logs),
    records: byKey(L.records, R.records, 'id').sort((a, b) => (a.finished || 0) - (b.finished || 0)).slice(-30),
    sessions: { ...keepLocal({}, R.sessions), ...keepLocal(L.sessions, {}) },
  };
  if (L.study || R.study) platform.study = { ...obj(R.study), ...obj(L.study), srs };
  if (L.ext || R.ext) platform.ext = { ...obj(R.ext), ...obj(L.ext), cards: byKey(L.ext?.cards, R.ext?.cards, 'id', 300) };
  if (L.official || R.official) {
    const recs = byKey(L.official?.records, R.official?.records, r => r?.subject + ':' + r?.finished).sort((a, b) => (a.finished || 0) - (b.finished || 0)).slice(-30);
    platform.official = { ...obj(R.official), ...obj(L.official), records: recs };
  }

  const LH = local?.history, RH = remote?.history;
  if (!LH || !RH) return { platform, history: LH || RH || null };
  const ha = answers(LH.answers, RH.answers);
  const history = {
    ...RH, ...LH,
    answers: ha.out,
    drafts: keepLocal(LH.drafts, RH.drafts),
    notes: keepLocal(LH.notes, RH.notes),
    cursors: keepLocal(LH.cursors, RH.cursors),
    pins: union(LH.pins, RH.pins),
    read: union(LH.read, RH.read),
    days: maxByDay(LH.days, RH.days),
    history: byKey(LH.history, RH.history, 'at').sort((a, b) => a.at - b.at).slice(-100),
  };
  return { platform, history };
}
