// Налаштування «Анімації»: авто (як просить система), завжди, ніколи. Типово «авто»: коли система просить зменшити рух
// (у Windows це вимкнене «Показувати анімацію у Windows»), сайт не рухається. «Завжди» вмикає рух попри це за явним вибором.
const MOTION_KEY = 'skladeno-motion';
function motionPref() {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch {
    return 'auto';
  }
}
function motionApply() {
  document.documentElement.dataset.motion = motionPref();
}
function motionSet(v) {
  try {
    if (v === 'auto') localStorage.removeItem(MOTION_KEY);
    else localStorage.setItem(MOTION_KEY, v);
  } catch {}
  motionApply();
  toast(
    v === 'on'
      ? 'Анімації ввімкнено.'
      : v === 'off'
        ? 'Анімації вимкнено.'
        : 'Анімації: як просить система.'
  );
  pSettings();
}
motionApply();
const motionSettingsBase = pSettings;
pSettings = function () {
  motionSettingsBase();
  const head = $('#main .p-page-head');
  if (!head) return;
  const sys = matchMedia('(prefers-reduced-motion: reduce)').matches,
    pref = motionPref();
  const why =
    pref === 'on'
      ? 'Рух увімкнено попри системне налаштування.'
      : pref === 'off'
        ? 'Рух вимкнено.'
        : sys
          ? 'Твоя система просить зменшити рух (у Windows вимкнено «Показувати анімацію у Windows»), тому в режимі «Авто» сайт не рухається. Обери «Завжди», щоб побачити анімації.'
          : 'Система не обмежує рух, тому анімації працюють.';
  head.insertAdjacentHTML(
    'afterend',
    `<section class="p-alert"><div><h2>Анімації</h2><p>${why}</p><div class="p-actions">${[
      ['auto', 'Авто'],
      ['on', 'Завжди'],
      ['off', 'Ніколи'],
    ]
      .map(
        ([v, l]) =>
          `<button aria-pressed="${pref === v}" ${pref === v ? 'class="primary"' : ''} onclick="motionSet('${v}')">${l}</button>`
      )
      .join('')}</div></div></section>`
  );
};
