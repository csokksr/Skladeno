// The original history trainer still owns its store, but its screens are retired: old addresses lead to the shared pages.
const LEGACY_ROUTES = {
  quiz: () => (P.current ? 'practice' : 'subject/hist'),
  exam: () => 'mocks/hist',
  progress: () => 'analytics',
};
const legacyRender = render;
render = function () {
  const to = LEGACY_ROUTES[(location.hash.slice(1) || 'hub').split('/')[0]];
  if (to) {
    location.replace('#' + to());
    return;
  }
  legacyRender();
};
// Tasks saved in the old history trainer join the shared list once.
if (S.pins.length) {
  P.pins = [...new Set([...P.pins, ...S.pins.filter(id => PM[id])])];
  S.pins = [];
  save();
  pSave();
}
