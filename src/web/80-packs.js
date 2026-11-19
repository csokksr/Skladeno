/* Веб-збірка: тексти завдань і конспектів лежать у files/pack-<предмет>.json (fetch; хост артефактів не віддає .js як скрипти). Ядро даних (files/data.json) містить лише заглушки
   завдань без prompt, passage, explanation (поле _h називає відсутні поля) і тем без notes; options, left, right, rows мають
   лише заглушки потрібної довжини: прогрес перевіряється на старті, до гідратації, і йому потрібні тільки довжини.
   Пакет домальовує ці поля в тих самих об'єктах (PM, QM, PT і сирі завдання тем), тож решта коду бачить повні дані.
   Поки пакет не прийшов, читання такого поля тексту кидає помилку, а не дає порожнє значення: сторінка чекає пакет і малюється
   знову, а дія в обробнику просто не виконується, нічого не пишучи в прогрес. Головна й списки тем не потребують текстів. */
const PACK_NAMES = window.SKLADENO_PACKS || [],
  PACK_DONE = new Set(),
  PACK_WAIT = {};
const PACK_LIGHT = new Set([
  'hub',
  'growth',
  'report',
  'subject',
  'mocks',
  'analytics',
  'plan',
  'library',
  'tests',
  'rhythm',
  'about',
  'graph',
  'strategy',
  'topics',
  'topic',
  'cards',
  'history-archive',
  'advanced',
  'quality',
  'coach',
  'audit',
  'preferences',
]);
let PACK_RAW = null,
  PACK_MISS = false;
const PACK_ASKED = new Set(),
  PACK_DATA = {
    referenceCards: 'cards',
    historyGuides: 'guides',
    syllabusUnits: 'meta',
    officialSolutions: 'meta',
    officialMaps: 'meta',
  };
// name: пакет, який зняв би помилку; без нього (поле тексту) невідомо який, тож чекаємо всі.
function packMiss(k, name) {
  PACK_MISS = true;
  PACK_ASKED.add(name || '*');
  const e = new Error('pack not loaded: ' + k);
  e.packMiss = true;
  throw e;
}
function packGuard(o) {
  if (!o || !o._h) return;
  for (const k of o._h)
    Object.defineProperty(o, k, {
      configurable: true,
      enumerable: false,
      get() {
        return packMiss(k);
      },
      set(v) {
        Object.defineProperty(this, k, {
          value: v,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      },
    });
}
function packRaw() {
  if (PACK_RAW) return PACK_RAW;
  PACK_RAW = Object.create(null);
  for (const s of PB) for (const t of s.topics) for (const q of t.questions) PACK_RAW[q.id] = q;
  return PACK_RAW;
}
if (PACK_NAMES.length) {
  const raw = packRaw();
  for (const id in raw) packGuard(raw[id]);
  for (const q of Q) packGuard(q);
  for (const q of PQ) packGuard(q);
  for (const id in PT) packGuard(PT[id]);
}
// Довідкові картки (пакет cards) і розгорнуті пояснення історії (пакет guides): поки пакета немає, читання кидає помилку, як і в полів текстів.
const PACK_GUIDES = {},
  PACK_TOPIC = Object.create(null);
for (const s of PB) for (const t of s.topics) PACK_TOPIC[t.id] = s.id;
for (const k in PACK_DATA)
  if (PACK_NAMES.includes(PACK_DATA[k]))
    Object.defineProperty(DB, k, {
      configurable: true,
      enumerable: false,
      get() {
        return packMiss(k, PACK_DATA[k]);
      },
    });
if (PACK_NAMES.includes('guides'))
  HISTORY_GUIDES = new Proxy(PACK_GUIDES, {
    get(o, k) {
      if (typeof k === 'string' && !PACK_DONE.has('guides')) packMiss('historyGuides', 'guides');
      return o[k];
    },
  });
const PACK_RES = {};
// Домальовування порціями по 400 завдань між задачами браузера: довга задача блокує сторінку, а пакети важкі.
function SK_PACK(name, pack) {
  const raw = packRaw(),
    ids = Object.keys(pack.q);
  let i = 0;
  const step = () => {
    for (const end = Math.min(i + 400, ids.length); i < end; i++) {
      const id = ids[i],
        h = pack.q[id],
        m = PM[id],
        h0 = QM[id],
        r = raw[id];
      if (h0) Object.assign(h0, h);
      if (r) Object.assign(r, h);
      if (m) {
        Object.assign(m, h);
        if (m.subject === 'hist') {
          m.left = m.rows;
          m.right = m.options;
        }
      }
    }
    if (i < ids.length) {
      setTimeout(step, 0);
      return;
    }
    for (const id of Object.keys(pack.t)) if (PT[id]) Object.assign(PT[id], pack.t[id]);
    for (const k of Object.keys(pack.d || {}))
      Object.defineProperty(DB, k, {
        value: pack.d[k],
        writable: true,
        enumerable: true,
        configurable: true,
      });
    if (pack.d?.historyGuides) for (const g of pack.d.historyGuides) PACK_GUIDES[g.topic] = g;
    PACK_DONE.add(name);
    if (PACK_RES[name]) PACK_RES[name]();
  };
  step();
}
function packLoad(name) {
  if (PACK_DONE.has(name)) return Promise.resolve();
  return (
    PACK_WAIT[name] ||
    (PACK_WAIT[name] = new Promise((ok, fail) => {
      PACK_RES[name] = () => ok(undefined);
      fetch('files/pack-' + name + '.json')
        .then(r => {
          if (!r.ok) throw new Error('pack ' + name);
          return r.json();
        })
        .then(p => SK_PACK(name, p))
        .catch(e => {
          delete PACK_WAIT[name];
          fail(e);
        });
    }))
  );
}
function packAll() {
  return Promise.all(PACK_NAMES.map(packLoad));
}
function packFailed() {
  const m = $('#main');
  if (m)
    m.innerHTML =
      '<section class="p-section"><h1>Матеріали не завантажилися</h1><p>Перевір з’єднання й онови сторінку. Прогрес у браузері не втрачено.</p><p><button onclick="location.reload()">Оновити сторінку</button></p></section>';
}
const PACK_ROUTE = { reference: ['cards'] };
// Пакети, які потрібні сторінці: практика й симуляція беруть предмети своїх завдань, конспект — предмет теми; для решти маршрутів — усі.
function packNeeds() {
  const p = (location.hash.slice(1) || 'hub').split('/');
  let ids = null,
    sid = null;
  if (['practice', 'simulate', 'result-review'].includes(p[0])) ids = pContext()?.ids;
  else if (p[0] === 'lesson') sid = PACK_TOPIC[p[1]];
  const need = PACK_ROUTE[p[0]] || [
    ...new Set(sid ? [sid] : (ids || []).map(id => PM[id]?.subject)),
  ];
  return need.length && need.every(n => PACK_NAMES.includes(n)) ? need : PACK_NAMES;
}
if (PACK_NAMES.length) {
  const packRenderBase = render,
    done = n => PACK_DONE.has(n),
    wait = names => {
      const m = $('#main');
      if (m) m.innerHTML = '<p class="p-caption" role="status">Завантажую завдання…</p>';
      const at = location.hash;
      Promise.all(names.map(packLoad)).then(() => {
        if (location.hash === at) render();
      }, packFailed);
    };
  render = function () {
    if (PACK_NAMES.every(done)) {
      packRenderBase();
      return;
    }
    const need = PACK_LIGHT.has((location.hash.slice(1) || 'hub').split('/')[0]) ? [] : packNeeds();
    if (need.some(n => !done(n))) {
      wait(need);
      return;
    }
    // Сторінка не потребує всіх пакетів: малюємо й чекаємо решту лише тоді, коли вона все ж прочитала відсутнє поле.
    PACK_MISS = false;
    PACK_ASKED.clear();
    packRenderBase();
    if (PACK_MISS) wait(PACK_ASKED.has('*') ? PACK_NAMES : [...PACK_ASKED]);
  };
  // Спершу пакет поточної сторінки (на головній — останнього предмета), решта у фоні по одному: потрібний зараз пакет не ділить канал із рештою.
  (async () => {
    const need = packNeeds(),
      first =
        need.length < PACK_NAMES.length
          ? need
          : PACK_NAMES.includes(P.lastSubject)
            ? [P.lastSubject]
            : [];
    await Promise.all(first.map(packLoad)).catch(() => {});
    for (const n of PACK_NAMES)
      try {
        await packLoad(n);
      } catch {}
  })();
}
