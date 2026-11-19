// Real НМТ tests are the mock tests of every subject that has complete official tests, newest first, tasks in the original order.
const stOfficial = (() => {
  const out = {};
  for (const sid of ['math', 'ukr', 'eng', 'bio', 'geo'].filter(id => SUB[id])) {
    const by = {};
    for (const q of PQ)
      if (q.subject === sid && q.kind === 'НМТ') (by[q.test] = by[q.test] || []).push(q);
    const modal = {};
    for (const l of Object.values(by)) {
      const y = l[0].year;
      (modal[y] = modal[y] || {})[l.length] = ((modal[y] || {})[l.length] || 0) + 1;
    }
    out[sid] = Object.values(by)
      .filter(l => {
        const m = Object.entries(modal[l[0].year]).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
        return l.length == m;
      })
      .map(l => l.sort((a, b) => a.number - b.number))
      .sort((a, b) => b[0].year - a[0].year || a[0].test - b[0].test);
  }
  return out;
})();
const officialMockBase = pMockSet;
pMockSet = function (subject, variant = 1) {
  const t = stOfficial[subject]?.[variant - 1];
  return t ? t.map(q => q.id) : officialMockBase(subject, variant);
};
stVariants = function (sid) {
  const n = {
    ukr: stOfficial.ukr?.length || DB.ukrainianFiveOptionSets.length || 1,
    eng: stOfficial.eng?.length || PSUB.eng.mockSets?.length || 3,
    math: stOfficial.math?.length || 8,
    hist: stHistTests.length || 8,
    bio: stOfficial.bio?.length || 3,
    geo: stOfficial.geo?.length || 3,
  };
  return sid === 'all' ? Math.min(...subjActive().map(s => n[s.id] || 3)) : n[sid] || 3;
};
