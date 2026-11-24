// Repeats of one official task (TWIN: repeat id -> kept id) are hidden from every list and pool. A repeat answered inside a real test
// counts for the kept task too, so the pool does not offer it as new. Both stores: P.answers and the history store S.answers.
function twinCredit() {
  for (const [twin, kept] of Object.entries(TWIN))
    for (const store of [P.answers, S.answers])
      if (store?.[twin] && !store[kept]) store[kept] = structuredClone(store[twin]);
}
const twinPSave = pSave,
  twinSave = save;
pSave = function () {
  twinCredit();
  return twinPSave.apply(this, arguments);
};
save = function () {
  twinCredit();
  return twinSave.apply(this, arguments);
};
