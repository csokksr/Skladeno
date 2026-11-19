// Дані й надійність: копія з паролем (AES-GCM, ключ із пароля через PBKDF2), обсяг сховища, журнал помилок сторінки, сповіщення про відсутність мережі.
// Журнал помилок і налаштування шифрування не входять у прогрес: журнал лежить у localStorage `skladeno-errors`.

/* 46. Копія з паролем. Формат: {app,version:1,encrypted:true,kdf,iter,salt,iv,data}; data — зашифрований JSON звичайної копії. */
const ENC_ITER = 600000,
  ENC_MIN_PW = 8;
const encOk = () =>
  typeof crypto !== 'undefined' && !!crypto.subtle && typeof TextEncoder !== 'undefined';
function encB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192));
  return btoa(s);
}
function encUnB64(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw Error('Файл пошкоджено.');
  try {
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  } catch {
    throw Error('Файл пошкоджено.');
  }
}
async function encKey(pw, salt, iter) {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(pw).normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
async function encPack(obj, pw) {
  if (!encOk()) throw Error('Цей браузер не підтримує шифрування.');
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await encKey(pw, salt, ENC_ITER),
    ct = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(JSON.stringify(obj))
      )
    );
  return {
    app: 'skladeno',
    version: 1,
    encrypted: true,
    kdf: 'PBKDF2-SHA256',
    iter: ENC_ITER,
    salt: encB64(salt),
    iv: encB64(iv),
    data: encB64(ct),
  };
}
const encIsPacked = o => !!o && o.app === 'skladeno' && o.encrypted === true;
async function encUnpack(o, pw) {
  if (!encOk()) throw Error('Цей браузер не підтримує шифрування.');
  if (
    !encIsPacked(o) ||
    o.kdf !== 'PBKDF2-SHA256' ||
    !Number.isInteger(o.iter) ||
    o.iter < 100000 ||
    o.iter > 2000000 ||
    typeof o.data !== 'string' ||
    o.data.length > 30 * 1024 * 1024
  )
    throw Error('Файл пошкоджено.');
  const salt = encUnB64(o.salt),
    iv = encUnB64(o.iv),
    data = encUnB64(o.data);
  if (salt.length !== 16 || iv.length !== 12 || data.length < 17) throw Error('Файл пошкоджено.');
  let text;
  try {
    text = new TextDecoder().decode(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await encKey(pw, salt, o.iter), data)
    );
  } catch {
    throw Error('Неправильний пароль або файл пошкоджено.');
  }
  return JSON.parse(text);
}
async function encSave() {
  const a = $('#enc-pw').value,
    b = $('#enc-pw2').value;
  if (a.length < ENC_MIN_PW) {
    toast('Пароль має містити щонайменше ' + ENC_MIN_PW + ' символів.');
    return;
  }
  if (a !== b) {
    toast('Паролі не збігаються.');
    return;
  }
  const btn = $('#enc-save');
  btn.disabled = true;
  btn.textContent = 'Шифрую…';
  try {
    const packed = await encPack(pBackupData(), a),
      res = await download(
        'skladeno-progress-zakhyst-' + pDay() + '.json',
        JSON.stringify(packed),
        'application/json'
      );
    if (res === false) toast('Файл не збережено. Спробуй ще раз.');
    else {
      $('#enc-pw').value = '';
      $('#enc-pw2').value = '';
      toast('Копію з паролем створено. Збережи пароль окремо: без нього файл не відкрити.');
    }
  } catch (e) {
    toast('Не вдалося зашифрувати: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Завантажити копію з паролем';
  }
}
let encRaw = null,
  encPacked = null;
function encRestoreOpen(packed) {
  encPacked = packed;
  encRaw = null;
  $('#modalbody').innerHTML =
    `<div class="p-section-head"><h2>Копія з паролем</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><div id="enc-step"><p>Введи пароль, яким цю копію було захищено.</p><label for="enc-open-pw">Пароль</label><input id="enc-open-pw" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')encDecrypt()"><div class="p-actions"><button class="primary" id="enc-open" onclick="encDecrypt()">Розшифрувати</button></div><p class="p-status" id="enc-msg" role="status"></p></div>`;
  if (!$('#modal').open) $('#modal').showModal();
  $('#enc-open-pw').focus();
}
async function encDecrypt() {
  const pw = $('#enc-open-pw').value;
  if (!pw) {
    $('#enc-msg').textContent = 'Введи пароль.';
    return;
  }
  const btn = $('#enc-open'),
    mine = encPacked;
  btn.disabled = true;
  $('#enc-msg').textContent = 'Розшифровую…';
  try {
    const raw = await encUnpack(mine, pw);
    if (encPacked !== mine) return;
    encRaw = raw;
    const n = Object.keys(encRaw?.platform?.answers || {}).length;
    $('#enc-step').innerHTML =
      `<p>Розшифровано. У копії ${stPlural(n, 'нова відповідь', 'нові відповіді', 'нових відповідей')} і дані історії. Поточний прогрес буде замінено.</p><div class="p-actions"><button class="primary" onclick="encRestoreGo()">Відновити ›</button></div>`;
  } catch (e) {
    if (encPacked !== mine) return;
    encRaw = null;
    btn.disabled = false;
    $('#enc-msg').textContent = e.message;
  }
}
// Відновлення в окремому натисканні, щоб вікно підтвердження могло повторити дію.
function encRestoreGo() {
  try {
    if (pRestore(encRaw)) {
      encRaw = null;
      $('#modal').close();
      go('analytics');
      toast('Прогрес усіх предметів відновлено.');
    }
  } catch (e) {
    toast('Копію не прийнято: ' + e.message);
  }
}
$('#modal').addEventListener('close', () => {
  if (encPacked || encRaw) $('#modalbody').innerHTML = '';
  encRaw = null;
  encPacked = null;
});
// Копія з паролем з файлу або з тексту: звичайні копії йдуть шляхом, що був.
{
  const el = $('#p-import-file'),
    base = el && el.onchange;
  if (base)
    el.onchange = async e => {
      const f = e.target.files?.[0];
      if (!f || f.size > 10 * 1024 * 1024) return base(e);
      let packed = null;
      try {
        const o = JSON.parse(await f.text());
        if (encIsPacked(o)) packed = o;
      } catch {}
      e.target.value = '';
      if (packed) {
        encRestoreOpen(packed);
        return;
      }
      base({ target: { files: [f], value: '' } });
    };
}
const encImportBase = pImportText;
pImportText = function () {
  let o = null;
  try {
    o = JSON.parse($('#p-backup-paste').value);
  } catch {}
  if (encIsPacked(o)) {
    encRestoreOpen(o);
    return;
  }
  encImportBase();
};

/* 47. Обсяг сховища: localStorage лічимо за символами (браузери зазвичай дозволяють близько 5 мільйонів), загальний запас дає navigator.storage.estimate(). */
const SAFE_LS_LIMIT = 5000000;
function safeUsage() {
  let keys;
  try {
    keys =
      typeof localStorage.length === 'number'
        ? Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
        : [PKEY, KEY];
  } catch {
    keys = [];
  }
  let chars = 0;
  const rows = [];
  for (const k of keys) {
    let v = null;
    try {
      v = localStorage.getItem(k);
    } catch {}
    if (v === null) continue;
    const n = k.length + v.length;
    chars += n;
    rows.push([k, n]);
  }
  return { chars, rows: rows.sort((a, b) => b[1] - a[1]).slice(0, 4) };
}
const safeMB = n =>
  n < 104858 ? 'менше 0,1' : (n / 1048576).toFixed(n < 1048576 * 10 ? 1 : 0).replace('.', ',');
async function safeUsageHtml() {
  const u = safeUsage(),
    share = Math.min(100, Math.round((100 * u.chars) / SAFE_LS_LIMIT));
  let est = '';
  try {
    const e = await navigator.storage?.estimate?.();
    if (e && e.quota)
      est = `<p class="p-caption">Загальний запас сховища цього сайту в браузері: використано ${safeMB(e.usage || 0)} МБ із ${safeMB(e.quota)} МБ.</p>`;
  } catch {}
  return `<p>Прогрес і налаштування займають близько ${stPlural(u.chars, 'символу', 'символи', 'символів')} (≈${safeMB(u.chars * 2)} МБ). Браузери зазвичай дозволяють близько 5 мільйонів символів у такому сховищі, тож зараз заповнено приблизно ${share}%.</p>${bar(u.chars, SAFE_LS_LIMIT)}${share >= 70 ? '<p class="p-alert-text"><strong>Місця лишається мало.</strong> Зроби резервну копію й скинь прогрес предметів, якими не користуєшся.</p>' : ''}<p class="p-caption">Найбільші записи: ${u.rows.map(([k, n]) => esc(k) + ' — ' + safeMB(n * 2) + ' МБ').join('; ') || '—'}.</p>${est}`;
}

/* 48. Журнал помилок сторінки: до 10 останніх, лише назва помилки, місце в коді й розділ сайту. Прогрес і відповіді в нього не потрапляють. */
const ERR_KEY = 'skladeno-errors',
  ERR_MAX = 10;
function errList() {
  try {
    const a = JSON.parse(localStorage.getItem(ERR_KEY) || '[]');
    return Array.isArray(a)
      ? a
          .filter(
            x => x && typeof x.m === 'string' && Number.isFinite(x.at) && Math.abs(x.at) < 8.64e15
          )
          .slice(-ERR_MAX)
      : [];
  } catch {
    return [];
  }
}
// Текст помилки без адрес і шматків введених даних: посилання стають [url], уривок у повідомленні JSON.parse ховається.
const errClean = s =>
  String(s)
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/"[^"]*" is not valid JSON/g, '[json] is not valid JSON')
    .replace(/\s+/g, ' ')
    .slice(0, 160);
function errLog(kind, e) {
  try {
    if (e && e.packMiss) return;
    const isErr = e && typeof e === 'object' && 'message' in e,
      msg =
        kind === 'promise' && !isErr
          ? 'Необроблена відмова (текст приховано)'
          : errClean(isErr ? e.message : e);
    if (!msg || /ResizeObserver loop/.test(msg)) return;
    const where =
        String((e && e.stack) || '')
          .split('\n')
          .find(l => /:\d+:\d+/.test(l)) || '',
      clean = where.replace(/[?#][^\s)]*?(?=:\d+:\d+\)?\s*$)/, ''),
      loc = (clean.match(/([^/\\\s(]+:\d+):\d+\)?\s*$/) || [])[1] || '',
      list = errList(),
      k = ['render', 'error', 'promise'].includes(kind) ? kind : 'error',
      s = loc.slice(0, 60),
      last = list[list.length - 1];
    if (last && last.k === k && last.m === msg && last.s === s) last.at = Date.now();
    else
      list.push({
        at: Date.now(),
        k,
        m: msg,
        s,
        r: (location.hash.slice(1) || 'hub').split('/')[0].slice(0, 24),
      });
    localStorage.setItem(ERR_KEY, JSON.stringify(list.slice(-ERR_MAX)));
  } catch {}
}
addEventListener('error', e => errLog('error', e.error || e.message));
addEventListener('unhandledrejection', e => errLog('promise', e.reason));
const errLine = x =>
  new Date(x.at).toISOString().slice(0, 16).replace('T', ' ') +
  ' ' +
  String(x.k).slice(0, 12) +
  ' [' +
  String(x.r || '').slice(0, 24) +
  '] ' +
  String(x.m).slice(0, 160) +
  (x.s ? ' (' + String(x.s).slice(0, 60) + ')' : '');
const errReportBase = reportText;
reportText = function (q) {
  const t = errReportBase(q),
    j = errList();
  if (!j.length) return t;
  const i = t.lastIndexOf('\n\nЩо не так:');
  return (
    (i < 0 ? t : t.slice(0, i)) +
    '\n\nПомилки сторінки (останні ' +
    j.length +
    '):\n' +
    j.map(x => '- ' + errLine(x)).join('\n') +
    (i < 0 ? '' : t.slice(i))
  );
};
function errClear() {
  try {
    localStorage.removeItem(ERR_KEY);
  } catch {}
  pSettings();
}

/* 49. Немає мережі (лише веб-версія): прогрес лишається в браузері, але синхронізація, зображення історії й PDF потребують мережі. */
const netBanner = document.createElement('div');
netBanner.id = 'net-banner';
netBanner.className = 'test-banner';
netBanner.setAttribute('role', 'status');
netBanner.hidden = true;
document.querySelector('.gnav').after(netBanner);
// Змінна webUid оголошена у веб-шарі, що вантажиться пізніше: до кінця завантаження сторінки звертатися до неї не можна.
const netIsWeb = () => {
  try {
    return typeof webUid !== 'undefined';
  } catch {
    return false;
  }
};
function netOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
function netPaint() {
  const off = netIsWeb() && netOffline();
  netBanner.hidden = !off;
  netBanner.innerHTML = off
    ? '<div class="test-banner-in"><span>Немає мережі. Прогрес зберігається в цьому браузері. Зображення завдань історії, PDF і синхронізація з акаунтом запрацюють, коли мережа повернеться.</span></div>'
    : '';
}
addEventListener('offline', netPaint);
addEventListener('online', () => {
  netPaint();
  if (netIsWeb()) {
    toast('Мережа повернулася.');
    if (typeof webSchedule === 'function') webSchedule();
  }
});
setTimeout(netPaint, 0);

const safeSettingsBase = pSettings;
pSettings = function () {
  safeSettingsBase();
  const f = $('#main .p-footer'),
    j = errList();
  const enc = encOk()
    ? `<p class="gap">Файл відкриється лише з паролем, без нього його не відновити. Пароль ніде не зберігається, його не можна скинути.</p><div class="p-form-grid"><label>Пароль (від ${ENC_MIN_PW} символів)<input id="enc-pw" type="password" autocomplete="new-password"></label><label>Повтори пароль<input id="enc-pw2" type="password" autocomplete="new-password"></label></div><div class="p-actions gap"><button id="enc-save" onclick="encSave()">Завантажити копію з паролем</button></div>`
    : '<p class="gap">Цей браузер не підтримує шифрування (потрібне захищене з’єднання).</p>';
  const html =
    `<section class="panel gap" id="data-enc"><h2>Копія з паролем</h2>${enc}</section><section class="panel gap" id="data-usage"><h2>Обсяг сховища</h2><div id="data-usage-body"><p class="p-caption">Рахую…</p></div></section>` +
    `<section class="panel gap" id="data-errors"><h2>Журнал помилок сторінки</h2>${j.length ? `<p class="gap">Останні помилки (${j.length}) додаються до повідомлення про помилку в завданні. Прогрес і відповіді в них не потрапляють.</p><details><summary>Показати</summary><ul>${j.map(x => `<li>${esc(errLine(x))}</li>`).join('')}</ul></details><div class="p-actions gap"><button onclick="errClear()">Очистити журнал</button></div>` : '<p class="gap">Помилок не було.</p>'}</section>`;
  if (f) f.insertAdjacentHTML('beforebegin', html);
  else $('#main').insertAdjacentHTML('beforeend', html);
  safeUsageHtml()
    .then(h => {
      const el = $('#data-usage-body');
      if (el) el.innerHTML = h;
    })
    .catch(() => {
      const el = $('#data-usage-body');
      if (el) el.textContent = 'Не вдалося порахувати обсяг.';
    });
};
