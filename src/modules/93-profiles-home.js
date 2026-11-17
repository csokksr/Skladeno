// Профілі на одному пристрої й видимість блоків головної.
// Профіль: активний лежить у звичайних ключах (прогрес і історія), решта зберігаються в skladeno-profiles. Перемикання перезавантажує сторінку.
// Спільне для всіх профілів: вигляд сайту (шрифт, міжряддя, тема, кольоровий режим, свайп), лічильник часу, Помодоро, історія пошуку,
// шаблони конструктора, журнал помилок, нагадування про резервну копію (skladeno-backup-at), секундомір.
// Онлайн-версія (артефакт) синхронізує прогрес з акаунтом, тож профілі там вимкнені.

/* 66. Профілі */
const PROF_KEY = 'skladeno-profiles',
  PROF_ACTIVE = 'skladeno-profile-active',
  PROF_MAX = 4,
  PROF_DEFAULT = 'Основний',
  PROF_BANNED = ['__proto__', 'constructor', 'prototype'];
const profClean = s =>
  String(s ?? '')
    .replace(/[<>"'&\\`\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
function profFresh() {
  return { active: PROF_DEFAULT, list: { [PROF_DEFAULT]: {} } };
}
// 'none' — запису ще немає, 'ok' — прочитано, 'bad' — запис є, але його не розібрати (тоді нічого не пишемо, щоб не затерти чужі профілі).
function profRead() {
  let raw = null;
  try {
    raw = localStorage.getItem(PROF_KEY);
  } catch {
    return { state: 'bad' };
  }
  if (raw === null) return { state: 'none', o: profFresh() };
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o.list !== 'object' || o.list === null || Array.isArray(o.list))
      return { state: 'bad' };
    const list = {};
    for (const [k, v] of Object.entries(o.list).slice(0, PROF_MAX)) {
      const n = profClean(k);
      if (!n || n !== k || PROF_BANNED.includes(n)) continue;
      list[n] = {
        p: typeof v?.p === 'string' ? v.p : null,
        s: typeof v?.s === 'string' ? v.s : null,
      };
    }
    const names = Object.keys(list);
    if (!names.length) return { state: 'bad' };
    return { state: 'ok', o: { active: names.includes(o.active) ? o.active : names[0], list } };
  } catch {
    return { state: 'bad' };
  }
}
function profGet() {
  const r = profRead();
  return r.o || profFresh();
}
// Ім’я активного профілю дублюється в окремому маленькому ключі: його перевіряє кожне збереження, а сам список може важити мегабайти.
function profPut(o) {
  try {
    localStorage.setItem(PROF_KEY, JSON.stringify(o));
    try {
      localStorage.setItem(PROF_ACTIVE, o.active);
    } catch {}
    return true;
  } catch {
    return false;
  }
}
const profActive = () => {
  try {
    return localStorage.getItem(PROF_ACTIVE) || PROF_DEFAULT;
  } catch {
    return PROF_DEFAULT;
  }
};
// Онлайн-версія: змінна webUid оголошена у веб-шарі, який вантажиться пізніше.
const profWeb = () => {
  try {
    return typeof webUid !== 'undefined';
  } catch {
    return false;
  }
};
const profCount = () => Object.keys(profGet().list).length;
// Незавершене відновлення з копії тримає знімок у журналі: поки воно не закінчилося, стан сховища не можна переносити.
function profBlocked() {
  if (profWeb())
    return 'Профілі доступні у файлі сайту, який можна зберегти на пристрій. Онлайн-версія синхронізує прогрес з акаунтом, і перемикання профілів перезаписало б його.';
  if (profRead().state === 'bad')
    return 'Дані профілів пошкоджено. Нічого не змінено: зроби резервну копію й напиши про це через «Знайшов помилку».';
  try {
    if (importRecoveryStatus === 'blocked' || localStorage.getItem(IMPORT_JOURNAL) !== null)
      return 'Триває або не завершено відновлення з копії. Спершу закінчи його, потім перемикай профілі.';
  } catch {}
  return '';
}
// Сторінка, що завантажилась під одним профілем, не пише в сховище, якщо активний профіль змінила інша вкладка: інакше вона затерла б його дані.
let profLoaded = profGet().active,
  profStale = false;
function profMarkStale() {
  if (profStale) return;
  profStale = true;
  toast('Профіль змінено в іншій вкладці. Перезавантаж цю сторінку: зміни тут не зберігаються.');
}
const profPSaveBase = pSave;
pSave = function () {
  if (profStale || profActive() !== profLoaded) {
    profMarkStale();
    return;
  }
  return profPSaveBase.apply(this, arguments);
};
const profSaveBase = save;
save = function () {
  if (profStale || profActive() !== profLoaded) {
    profMarkStale();
    return;
  }
  return profSaveBase.apply(this, arguments);
};
addEventListener('storage', e => {
  if ((e.key === PROF_ACTIVE || e.key === PROF_KEY) && profActive() !== profLoaded) profMarkStale();
});
function profCreate(name) {
  name = profClean(name);
  const bl = profBlocked();
  if (bl) return { ok: false, msg: bl };
  const o = profGet();
  if (!name) return { ok: false, msg: 'Введи назву профілю.' };
  if (PROF_BANNED.includes(name.toLowerCase())) return { ok: false, msg: 'Така назва недоступна.' };
  if (Object.keys(o.list).some(k => k.toLowerCase() === name.toLowerCase()))
    return { ok: false, msg: 'Профіль із такою назвою вже є.' };
  if (Object.keys(o.list).length >= PROF_MAX)
    return { ok: false, msg: 'Профілів може бути не більше ' + PROF_MAX + '.' };
  if (safeUsage().chars > 2500000)
    return {
      ok: false,
      msg: 'У сховищі браузера мало місця для ще одного профілю. Зроби копію й скинь зайве.',
    };
  o.list[name] = { p: null, s: null };
  if (!profPut(o)) return { ok: false, msg: 'Не вдалося зберегти: сховище браузера недоступне.' };
  return { ok: true, name };
}
// Перемикання: поточні дані спершу кладуться у сховище профілів, лише потім підміняються звичайні ключі; будь-яка помилка повертає все назад (спочатку дані, потім список).
// flush: записати поточний стан у звичайні ключі перед перемиканням (за замовчуванням, коли сторінка перезавантажується; тести перемикають без нього).
function profSwitch(name, reload = true, flush = reload) {
  const bl = profBlocked();
  if (bl) return { ok: false, msg: bl };
  const o = profGet();
  if (!o.list[name] || name === o.active)
    return { ok: false, msg: 'Такого профілю немає або він уже активний.' };
  if (profStale || o.active !== profLoaded || profActive() !== profLoaded)
    return { ok: false, msg: 'Профіль уже змінено в іншій вкладці. Перезавантаж сторінку.' };
  if (flush && typeof testsRuns === 'function' && testsRuns().length)
    return { ok: false, msg: 'Іде тест із таймером. Заверши його, потім перемикай профіль.' };
  if (flush) {
    pSave();
    save();
    if (!(pStorage && storageOK))
      return {
        ok: false,
        msg: 'Не вдалося зберегти поточний прогрес: сховище браузера недоступне чи заповнене. Нічого не змінено.',
      };
  }
  let curP = null,
    curS = null;
  try {
    curP = localStorage.getItem(PKEY);
    curS = localStorage.getItem(KEY);
  } catch {
    return { ok: false, msg: 'Сховище браузера недоступне.' };
  }
  const before = JSON.stringify(o),
    prevActive = o.active,
    target = o.list[name];
  o.list[o.active] = { p: curP, s: curS };
  o.active = name;
  if (!profPut(o))
    return {
      ok: false,
      msg: 'Не вдалося зберегти: мало місця у сховищі браузера. Нічого не змінено.',
    };
  try {
    if (target.p === null) localStorage.removeItem(PKEY);
    else localStorage.setItem(PKEY, target.p);
    if (target.s === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, target.s);
  } catch {
    let back = true;
    try {
      if (curP !== null) localStorage.setItem(PKEY, curP);
      else localStorage.removeItem(PKEY);
    } catch {
      back = false;
    }
    try {
      if (curS !== null) localStorage.setItem(KEY, curS);
      else localStorage.removeItem(KEY);
    } catch {
      back = false;
    }
    try {
      localStorage.setItem(PROF_KEY, before);
      localStorage.setItem(PROF_ACTIVE, prevActive);
    } catch {
      back = false;
    }
    return {
      ok: false,
      msg: back
        ? 'Не вдалося перемкнути: мало місця у сховищі браузера. Нічого не змінено.'
        : 'Не вдалося перемкнути й повернути все назад. Зроби резервну копію й перезавантаж сторінку.',
    };
  }
  // Дані цього профілю тепер у звичайних ключах, тож у сховищі профілів їх дублювати не треба.
  const o2 = profGet();
  o2.list[name] = { p: null, s: null };
  profPut(o2);
  profLoaded = name;
  // Пам'ять цієї сторінки ще тримає дані старого профілю: до перезавантаження вона нічого не пише.
  if (reload) {
    profStale = true;
    location.reload();
  }
  return { ok: true };
}
function profDelete(name) {
  const bl = profBlocked();
  if (bl) return { ok: false, msg: bl };
  const o = profGet();
  if (name === o.active || !o.list[name])
    return { ok: false, msg: 'Активний профіль видалити не можна: спершу перемкнись на інший.' };
  delete o.list[name];
  return profPut(o) ? { ok: true } : { ok: false, msg: 'Не вдалося зберегти.' };
}
function profAddClick() {
  const r = profCreate($('#prof-name').value);
  if (!r.ok) {
    toast(r.msg);
    return;
  }
  toast('Профіль «' + r.name + '» створено. Перемкнись на нього, коли будеш готовий.');
  pSettings();
}
function profSwitchClick(name) {
  if (
    !confirm(
      'Перемкнутися на профіль «' +
        name +
        '»? Сторінка перезавантажиться, твій поточний прогрес збережеться в профілі «' +
        profGet().active +
        '».'
    )
  )
    return;
  const r = profSwitch(name);
  if (!r.ok) toast(r.msg);
}
function profDeleteClick(name) {
  if (
    !confirm(
      'Видалити профіль «' +
        name +
        '» разом з його прогресом? Скасувати це не можна. Спершу можна зробити його копію: перемкнись на нього й завантаж копію.'
    )
  )
    return;
  const r = profDelete(name);
  toast(r.ok ? 'Профіль видалено.' : r.msg);
  if (r.ok) pSettings();
}
const profSettingsBase = pSettings;
pSettings = function () {
  profSettingsBase();
  const f = $('#main .p-footer'),
    o = profGet(),
    names = Object.keys(o.list),
    bl = profBlocked();
  const rows = names
    .map(
      n =>
        `<li class="prof-row"><span>${esc(n)}${n === o.active ? ' <strong>(активний)</strong>' : ''}</span>${n === o.active || bl ? '' : `<button data-n="${esc(n)}" onclick="profSwitchClick(this.dataset.n)">Перемкнутися</button><button data-n="${esc(n)}" onclick="profDeleteClick(this.dataset.n)">Видалити</button>`}</li>`
    )
    .join('');
  const html = `<section class="panel gap" id="data-profiles"><h2>Профілі</h2><p class="gap">Кілька учнів на одному пристрої: у кожного свої відповіді, нотатки, план, цілі, власні картки й пробники. Профілів до ${PROF_MAX}. Зараз: «${esc(o.active)}». Копія прогресу містить лише активний профіль. Спільні для всіх: вигляд сайту, лічильник часу, Помодоро, історія пошуку, шаблони конструктора, журнал помилок і нагадування про резервну копію.</p>${bl ? `<p class="gap"><strong>Зараз недоступно.</strong> ${esc(bl)}</p>` : ''}<ul class="prof-list">${rows}</ul>${bl ? '' : `<div class="p-form-grid"><label>Новий профіль<input id="prof-name" maxlength="24" autocomplete="off"></label></div><div class="p-actions gap"><button onclick="profAddClick()">Створити профіль</button></div>`}</section>`;
  if (f) f.insertAdjacentHTML('beforebegin', html);
  else $('#main').insertAdjacentHTML('beforeend', html);
};

/* 67. Блоки головної: кожен можна сховати. Список ховається за ключами, видимими на самій головній; кнопка «Налаштувати головну» лишається завжди. */
const HUB_KEY = 'skladeno-hub-hidden',
  HUB_KNOWN = [
    ['ob-card', 'Налаштування плану'],
    ['st-today-card', 'План на сьогодні'],
    ['p-status-strip', 'Смуга статусу'],
    ['st-forecast', 'Де ти зараз'],
    ['p-bottom-grid', 'Швидкі дії та пробні тести'],
  ];
function hubHidden() {
  try {
    const a = JSON.parse(localStorage.getItem(HUB_KEY) || '[]');
    return Array.isArray(a)
      ? a.filter(x => typeof x === 'string' && x.length <= 80).slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
function hubSet(a) {
  try {
    if (a.length) localStorage.setItem(HUB_KEY, JSON.stringify(a.slice(0, 30)));
    else localStorage.removeItem(HUB_KEY);
  } catch {
    toast('Не вдалося зберегти вибір.');
  }
}
function hubBlocks(main = $('#main')) {
  const out = [];
  if (!main || !main.children) return out;
  for (const el of [...main.children]) {
    if (el.matches?.('header,footer,.hub-tools')) continue;
    const known = HUB_KNOWN.find(([c]) => el.classList.contains(c)),
      head = (el.querySelector('h1,h2,h3')?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
    const key = known ? known[0] : head ? 'h:' + head : '';
    if (key) out.push({ el, key, label: known ? known[1] : head });
  }
  return out;
}
function hubApply(main) {
  const hidden = hubHidden();
  for (const b of hubBlocks(main)) b.el.hidden = hidden.includes(b.key);
}
function hubToggle(key, visible) {
  const a = hubHidden().filter(k => k !== key);
  if (!visible) a.push(key);
  hubSet(a);
  hubApply();
  hubDialog();
}
function hubShowAll() {
  hubSet([]);
  hubApply();
  hubDialog();
}
function hubDialog() {
  const hidden = hubHidden(),
    blocks = hubBlocks();
  $('#modalbody').innerHTML =
    `<div class="p-section-head"><h2>Блоки головної</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><p>Познач те, що має бути на головній. Нічого не видаляється: схований блок можна повернути тут.</p><ul class="hub-list">${blocks.map(b => `<li><label><input type="checkbox" data-k="${esc(b.key)}" ${hidden.includes(b.key) ? '' : 'checked'} onchange="hubToggle(this.dataset.k,this.checked)"> ${esc(b.label)}</label></li>`).join('')}</ul><div class="p-actions"><button onclick="hubShowAll()">Показати все</button></div>`;
  if (!$('#modal').open) $('#modal').showModal();
}
const hubBase = pHub;
pHub = function () {
  hubBase();
  const f = $('#main .p-footer');
  if (f)
    f.insertAdjacentHTML(
      'beforebegin',
      '<div class="p-actions hub-tools"><button class="textbtn" onclick="hubDialog()">Налаштувати головну</button></div>'
    );
  const o = profGet();
  if (Object.keys(o.list).length > 1)
    $('#main .p-page-head')?.insertAdjacentHTML(
      'beforeend',
      `<p class="p-caption" id="prof-now">Профіль: ${esc(o.active)}. <a href="#preferences">Змінити</a></p>`
    );
  hubApply();
};
