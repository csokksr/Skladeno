'use strict';
// Load before either progress store. A pending import rolls back to its prior snapshot.
const IMPORT_JOURNAL = 'skladeno-import-pending-v1',
  IMPORT_KEYS = ['skladeno-prep-v1', 'istoria200-complete-v4'];
let importRecoveryStatus = '',
  importPrevious = null;
// Lookup tables keyed by ids that can come from a backup: no inherited names («constructor», «__proto__») may pass an `if(PM[id])` test.
const Obj0 = entries => Object.assign(Object.create(null), Object.fromEntries(entries));
// A store that fails to load is replaced by a fresh one and then overwritten on the next save: keep the unreadable text under «<key>-corrupt» first.
function pFontSize() {
  try {
    return Number(localStorage.getItem('skladeno-font') || 16);
  } catch {
    return 16;
  }
}
function keepCorrupt(key) {
  try {
    let raw = localStorage.getItem(key);
    if (raw === null) return;
    if (localStorage.getItem(key + '-corrupt') === null)
      localStorage.setItem(key + '-corrupt', raw);
    if (!keepCorrupt.told) {
      keepCorrupt.told = true;
      setTimeout(
        () =>
          toast(
            'Частину збереженого прогресу не вдалося прочитати. Копію збережено в браузері, новий прогрес записується окремо.'
          ),
        400
      );
    }
  } catch {}
}
function restoreSnapshotValid(value) {
  return (
    value &&
    typeof value === 'object' &&
    IMPORT_KEYS.every(
      k =>
        Object.hasOwn(value, k) &&
        (value[k] === null || (typeof value[k] === 'string' && value[k].length <= 10 * 1024 * 1024))
    )
  );
}
function restoreWriteSnapshot(snapshot) {
  for (let key of IMPORT_KEYS) {
    let value = snapshot[key];
    if (localStorage.getItem(key) !== value) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    if (localStorage.getItem(key) !== value) throw Error('Storage verification failed');
  }
}
function restoreTryRecovery() {
  try {
    let text = localStorage.getItem(IMPORT_JOURNAL);
    if (text === null) {
      importRecoveryStatus = '';
      importPrevious = null;
      return true;
    }
    let pending = JSON.parse(text);
    if (pending?.version !== 1 || !restoreSnapshotValid(pending.previous))
      throw Error('Invalid import journal');
    importPrevious = pending.previous;
    restoreWriteSnapshot(importPrevious);
    localStorage.removeItem(IMPORT_JOURNAL);
    if (localStorage.getItem(IMPORT_JOURNAL) !== null) throw Error('Journal removal failed');
    importRecoveryStatus = 'recovered';
    importPrevious = null;
    return true;
  } catch {
    try {
      localStorage.getItem(IMPORT_JOURNAL);
    } catch {
      importRecoveryStatus = 'unavailable';
      importPrevious = null;
      return false;
    }
    importRecoveryStatus = 'blocked';
    return false;
  }
}
function restoreRead(key) {
  return importRecoveryStatus === 'blocked' && importPrevious && IMPORT_KEYS.includes(key)
    ? importPrevious[key]
    : localStorage.getItem(key);
}
function restoreCommit(platform, history) {
  if (importRecoveryStatus === 'blocked' || localStorage.getItem(IMPORT_JOURNAL) !== null)
    throw Error(
      'Незавершене відновлення. Спершу віднови попередній прогрес або збережи його резервну копію.'
    );
  let previous = Object.fromEntries(IMPORT_KEYS.map(k => [k, localStorage.getItem(k)])),
    next = {
      [IMPORT_KEYS[0]]: JSON.stringify(platform),
      [IMPORT_KEYS[1]]: JSON.stringify(history),
    },
    started = false;
  try {
    const journal = JSON.stringify({ version: 1, previous });
    localStorage.setItem(IMPORT_JOURNAL, journal);
    started = true;
    if (localStorage.getItem(IMPORT_JOURNAL) !== journal) throw Error('Journal write failed');
    restoreWriteSnapshot(next);
    localStorage.removeItem(IMPORT_JOURNAL);
    if (localStorage.getItem(IMPORT_JOURNAL) !== null) throw Error('Journal removal failed');
    importRecoveryStatus = '';
    importPrevious = null;
  } catch {
    if (started) {
      importPrevious = previous;
      let recovered = restoreTryRecovery();
      throw Error(
        recovered
          ? 'Копію не відновлено: браузер не зберіг усі дані. Попередній прогрес збережено.'
          : 'Копію не відновлено. Попередній прогрес захищено, але браузер ще не дозволив завершити його відновлення. Створи резервну копію та повтори відновлення.'
      );
    }
    throw Error(
      'Не вдалося створити захисну копію перед імпортом. Поточний прогрес не змінено. Перевір вільне місце й можливість збереження в браузері.'
    );
  }
}
restoreTryRecovery();

('use strict');
function dataFailed() {
  const m = document.querySelector('#main');
  if (m)
    m.innerHTML =
      '<section class="p-section"><h1>Дані не завантажилися</h1><p>Перевір з’єднання й онови сторінку. Прогрес у браузері не втрачено.</p></section>';
  throw new Error('data script missing');
}
const DB =
    window.SKLADENO_DATA ||
    (document.querySelector('#data')
      ? JSON.parse(document.querySelector('#data').textContent)
      : dataFailed()),
  T = DB.topics,
  Q = DB.questions,
  F = T.flatMap(t => t.facts),
  QM = Obj0(Q.map(q => [q.id, q])),
  FM = Obj0(F.map(f => [f.id, f])),
  KEY = 'istoria200-complete-v4';
// Identical images are stored once (tools/build.py dedupe_assets): the other keys point to the same value.
for (const [k, canon] of Object.entries(DB.assetAlias || {})) DB.assets[k] = DB.assets[canon];
const fresh = () => ({
  schema: 4,
  answers: {},
  drafts: {},
  cursors: {},
  pins: [],
  read: [],
  notes: {},
  lastTopic: 1,
  session: null,
  mock: null,
  history: [],
  days: {},
});
let S = fresh(),
  storageOK = true;
try {
  const x = JSON.parse(restoreRead(KEY) || 'null');
  if (x?.schema === 4) S = normaliseImport({ app: 'istoria200', state: x }, true);
} catch {
  S = fresh();
  storageOK = false;
  keepCorrupt(KEY);
}
const $ = s => document.querySelector(s),
  esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    ),
  letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є'],
  names = {
    D: 'Дати',
    P: 'Персоналії',
    T: 'Поняття',
    C: 'Культура',
    G: 'Географія',
    L: 'Зв’язки й пояснення',
    M: 'Комбіновані',
    I: 'Зображення',
  };
let route = '',
  tab = 'theory',
  search = '',
  topicSearch = '',
  kind = '',
  galleryKind = 'C',
  onlyImages = false,
  shown = 60,
  lastBase = '';
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
    storageOK = true;
    $('#save-status').textContent = 'Збережено в браузері';
    $('#storage-error').classList.add('hidden');
  } catch {
    storageOK = false;
    $('#save-status').textContent = 'Збереження недоступне';
    $('#storage-error').textContent =
      'Браузер заблокував збереження або сховище заповнене. Експортуй прогрес у налаштуваннях, перш ніж закривати сторінку.';
    $('#storage-error').classList.remove('hidden');
  }
}
function toast(s) {
  $('#sr-live').textContent = '';
  setTimeout(() => {
    $('#sr-live').textContent = s;
  }, 60);
  $('#toast').textContent = s;
  $('#toast').classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => $('#toast').classList.add('hidden'),
    Math.min(9000, Math.max(3300, String(s).length * 70))
  );
}
function go(s) {
  if (location.hash === '#' + s) render();
  else location.hash = s;
}
function pct(a, b) {
  return b ? Math.round((a / b) * 100) : 0;
}
function bar(a, b) {
  return `<div class="bar"><i style="width:${pct(a, b)}%"></i></div>`;
}
function stat(l, v, s) {
  return `<div class="stat"><label class="muted">${l}</label><div class="value">${v}</div><small>${s}</small></div>`;
}
function head(k, h, p = '') {
  return `<h1>${h}</h1>${p ? `<p class="u-lead muted">${p}</p>` : ''}`;
}
function foot() {
  return `<div class="footer">Авторський навчальний тренажер за 32 темами програми УЦОЯО. «200» у назві означає мету підготовки. Тренажер не гарантує цього результату. <a href="#sources">Програма й джерела ›</a></div>`;
}
function wrongIds() {
  return Object.keys(S.answers).filter(id => QM[id] && S.answers[id].score < S.answers[id].max);
}
function stats(id) {
  let ids = T[id - 1].questions,
    done = ids.filter(x => S.answers[x]),
    right = done.filter(x => S.answers[x].score === S.answers[x].max);
  return {
    done: done.length,
    right: right.length,
    wrong: done.length - right.length,
    total: ids.length,
  };
}
function card(t) {
  let s = stats(t.id);
  return `<button class="topic" onclick="openTopic(${t.id})"><div class="row between"><span>ТЕМА ${String(t.id).padStart(2, '0')}</span><span class="tag ${s.done ? 'purple' : ''}">${s.done ? s.done + ' опрацьовано' : 'Почати'}</span></div><h2>${esc(t.title)}</h2><div><div class="u-mb8 row between"><span>${stPlural(s.total, 'завдання', 'завдання', 'завдань')} · ${t.facts.length} фактів</span><span>${pct(s.right, s.total)}%</span></div>${bar(s.right, s.total)}</div></button>`;
}
function render() {
  route = location.hash.slice(1) || 'home';
  let base = route.split('/')[0];
  if (
    ![
      'topics',
      'topic',
      'quiz',
      'review',
      'gallery',
      'map',
      'exam',
      'progress',
      'sources',
      'settings',
    ].includes(base)
  ) {
    go('home');
    return;
  }
  if (base !== lastBase) {
    search = '';
    kind = '';
    shown = 60;
    lastBase = base;
  }
  document
    .querySelectorAll('[data-page]')
    .forEach(a =>
      a.classList.toggle(
        'on',
        a.dataset.page === (['topic', 'quiz'].includes(base) ? 'topics' : base)
      )
    );
  $('#wrongcount').textContent = wrongIds().length;
  $('#crumb').textContent =
    {
      topics: 'Усі теми',
      topic: 'Навчальна тема',
      quiz: 'Тренування',
      review: 'Повторення',
      gallery: 'Культура й люди',
      map: 'Географія',
      exam: 'Пробний тест',
      progress: 'Мій прогрес',
      sources: 'Програма й джерела',
      settings: 'Налаштування',
    }[base] + ' / Історія України';
  ({
    topics: topics,
    topic: topic,
    quiz: quiz,
    review: review,
    gallery: gallery,
    map: mapPage,
    exam: exam,
    progress: progress,
    sources: sources,
    settings: settings,
  })[base]();
  if (!storageOK) save();
}
function topics() {
  let ts = T.filter(t => historyMatches(historyTopicText(t.id), topicSearch));
  $('#main').innerHTML =
    head(
      'Історія України',
      'Усі теми',
      'Знайди тему, подію, людину чи поняття. Кожна тема містить конспект і щонайменше 30 завдань.'
    ) +
    `<div class="search"><input id="topic-search" type="search" aria-label="Пошук тем" placeholder="Пошук теми або факту…" value="${esc(topicSearch)}"><span class="small muted">Тем: ${ts.length}</span></div><div class="grid">${ts.map(card).join('')}</div>${ts.length ? '' : '<div class="empty">Тем за цим запитом немає.</div>'}${foot()}`;
  $('#topic-search').oninput = e => {
    topicSearch = e.target.value;
    let p = e.target.selectionStart;
    topics();
    $('#topic-search').focus();
    $('#topic-search').setSelectionRange(p, p);
  };
}
function openTopic(id) {
  if (!T[id - 1]) return;
  S.lastTopic = id;
  tab = 'theory';
  search = '';
  kind = '';
  save();
  go('topic/' + id);
}
function setTab(x) {
  tab = x;
  search = '';
  kind = '';
  topic();
}

function factCard(f) {
  return `<article class="fact">${f.image ? `<img src="${DB.assets[f.image]}" alt="${esc(f.label)}" onclick="showFact('${f.id}')" tabindex="0" role="button" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showFact('${f.id}')}">` : ''}<span class="tag">${names[f.kind]}</span><h3>${esc(f.label)}</h3><p>${esc(f.text)}</p><div class="facttools"><button class="${S.read.includes(f.id) ? 'read' : ''}" onclick="readFact('${f.id}')">${S.read.includes(f.id) ? '✓ Опрацьовано' : 'Позначити вивченим'}</button><button onclick="practiceFact('${f.id}')">Перевірити ›</button></div></article>`;
}
function topic() {
  let id = Number(route.split('/')[1]),
    t = T[id - 1];
  if (!t) {
    go('topics');
    return;
  }
  let s = stats(id);
  $('#main').innerHTML =
    `<a class="p-back" href="#topics">← Усі теми</a>` +
    pHeading('Тема ' + id + ' / 32', esc(t.title)) +
    `<div class="p-actions p-lesson-actions"><button class="primary" onclick="startTopic(${id})">${s.done ? 'Продовжити тести' : 'Почати тести'} ›</button><span class="p-caption">${stPlural(t.facts.length, 'факт', 'факти', 'фактів')} · ${stPlural(s.total, 'завдання', 'завдання', 'завдань')} · ${s.done} опрацьовано</span></div><div class="p-tabs">${[
      ['theory', 'Конспект'],
      ['dates', 'Хронологія'],
      ['visuals', 'Культура й люди'],
      ['coverage', 'Чекліст теми'],
      ['notes', 'Мої нотатки'],
    ]
      .map(
        ([v, n]) =>
          `<button class="${tab === v ? 'is-active' : ''}" onclick="setTab('${v}')">${n}</button>`
      )
      .join('')}</div><div id="topic-content"></div>${foot()}`;
  let el = $('#topic-content');
  if (tab === 'theory') {
    let list = t.facts.filter(
      f =>
        (!kind || f.kind === kind) &&
        (!search || (f.label + ' ' + f.text).toLowerCase().includes(search.toLowerCase()))
    );
    el.innerHTML = `<div class="search"><input id="fact-search" type="search" aria-label="Пошук у конспекті" placeholder="Знайти в конспекті…" value="${esc(search)}"><select id="kind" aria-label="Категорія"><option value="">Усі категорії</option>${['D', 'T', 'P', 'C', 'G', 'L'].map(k => `<option value="${k}" ${kind === k ? 'selected' : ''}>${names[k]} (${t.facts.filter(f => f.kind === k).length})</option>`).join('')}</select></div><div class="panel">${list.map(factCard).join('') || '<div class="empty">Фактів не знайдено.</div>'}</div>`;
    $('#fact-search').oninput = e => {
      search = e.target.value;
      let p = e.target.selectionStart;
      topic();
      $('#fact-search').focus();
      $('#fact-search').setSelectionRange(p, p);
    };
    $('#kind').onchange = e => {
      kind = e.target.value;
      topic();
    };
  }
  if (tab === 'dates') {
    let ds = t.facts
      .filter(f => f.kind === 'D')
      .sort((a, b) => historyYear(a.label) - historyYear(b.label));
    el.innerHTML = ds.length
      ? `<div class="panel"><div class="u-mb24 notice">Дати в порядку переліку програми. Послідовності відпрацьовуються окремим типом завдань.</div><div class="timeline">${ds.map(f => `<div class="timeitem"><strong>${esc(f.label)}</strong><p>${esc(f.text)}</p></div>`).join('')}</div></div>`
      : '<div class="empty">Вступна тема не має окремого переліку дат. Потренуйся визначати століття й періоди.</div>';
  }
  if (tab === 'visuals') {
    let fs = t.facts.filter(f => 'PC'.includes(f.kind));
    el.innerHTML = `<p class="u-mb16 muted small">${fs.length} карток · ${fs.filter(f => f.image).length} зі зображеннями. Відкрий картку, щоб прочитати пояснення або перейти до завдань.</p><div class="gallery">${fs.map(visual).join('')}</div>${fs.length ? '' : '<div class="empty">У цій темі немає окремого переліку персоналій або пам’яток. Дивись сусідні розділи.</div>'}`;
  }
  if (tab === 'coverage') {
    el.innerHTML = `<div class="panel"><h2>Що є в темі</h2><div class="tablewrap gap"><table><thead><tr><th>Категорія</th><th>Фактів</th><th>Позначено вивченими</th></tr></thead><tbody>${['D', 'P', 'T', 'C', 'G'].map(k => `<tr><td>${names[k]}</td><td>${t.facts.filter(f => f.kind === k).length}</td><td>${t.facts.filter(f => f.kind === k && S.read.includes(f.id)).length}</td></tr>`).join('')}</tbody></table></div><div class="row gap"><button onclick="startTopic(${id},'new')">Невиконані</button><button onclick="startTopic(${id},'wrong')">Помилки теми</button><button onclick="go('sources')">Повна програма</button></div><p class="small muted gap">У таблиці показано матеріали цієї теми в тренажері. Позначка «вивчено» в конспекті й перевірені відповіді зберігаються окремо.</p></div>`;
  }
  if (tab === 'notes') {
    el.innerHTML = `<div class="panel"><h2>Нотатки до теми</h2><p class="u-mt12 u-mb16 muted small">Записуй тут те, що хочеш запам’ятати або уточнити. Нотатки зберігаються автоматично та входять до резервної копії.</p><textarea id="notes" aria-label="Нотатки до теми" placeholder="Мої висновки й асоціації…">${esc(S.notes[id] || '')}</textarea></div>`;
    $('#notes').oninput = e => {
      S.notes[id] = e.target.value;
      save();
    };
  }
}
function readFact(id) {
  S.read = S.read.includes(id) ? S.read.filter(x => x !== id) : [...S.read, id];
  save();
  topic();
}
function visual(f) {
  return `<button class="visual" onclick="showFact('${f.id}')">${f.image ? `<img src="${DB.assets[f.image]}" alt="${esc(f.label)}" loading="lazy">` : ''}<div><span class="tag">${names[f.kind]} · тема ${f.topic}</span><h2>${esc(f.label)}</h2><p>${esc(f.text)}</p></div></button>`;
}
function showFact(id) {
  let f = FM[id];
  if (!f) return;
  $('#modalbody').innerHTML =
    `<div class="row between"><span class="eyebrow muted">${names[f.kind]} · тема ${f.topic}</span><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><h2 class="u-mt16">${esc(f.label)}</h2>${f.image ? `<img src="${DB.assets[f.image]}" alt="${esc(f.label)}">` : ''}<p>${esc(f.text)}</p><div class="row gap"><button class="green" onclick="$('#modal').close();practiceFact('${id}')">До завдань ›</button><button onclick="$('#modal').close();openTopic(${f.topic})">До конспекту</button></div>${f.image ? '<p class="small muted">Ілюстрації взято з довідника ЛРЦОЯО, ЕСУ, Wikimedia Commons, IGotoWorld та ресурсу «На Урок». Посилання є в розділі джерел.</p>' : ''}`;
  $('#modal').showModal();
}
function gallery() {
  let fs = F.filter(
    f =>
      f.kind === galleryKind &&
      (!onlyImages || f.image) &&
      (!search || (f.label + ' ' + f.text).toLowerCase().includes(search.toLowerCase()))
  );
  $('#main').innerHTML =
    head(
      'Історія України',
      'Персоналії, пам’ятки й мистецтво',
      'На картках є короткі відомості про людей і пам’ятки. Відкрий картку, щоб розглянути зображення або перейти до завдань.'
    ) +
    `<div class="p-tabs">${[
      ['C', 'Пам’ятки й мистецтво'],
      ['P', 'Персоналії'],
    ]
      .map(
        ([v, n]) =>
          `<button class="${galleryKind === v ? 'is-active' : ''}" onclick="galleryKind='${v}';shown=60;gallery()">${n}</button>`
      )
      .join(
        ''
      )}</div><div class="search"><input id="gallery-search" aria-label="Пошук у галереї" type="search" value="${esc(search)}" placeholder="Знайти пам’ятку, автора чи людину…"><label class="small"><input type="checkbox" id="only-images" ${onlyImages ? 'checked' : ''}> Лише зі зображеннями</label><button onclick="startVisual()">Візуальний тест ›</button></div><p class="u-mb16 muted small">${fs.length} карток · зі зображеннями: ${fs.filter(f => f.image).length}</p><div class="gallery">${fs.slice(0, shown).map(visual).join('')}</div>${fs.length > shown ? '<button class="gap" onclick="shown+=60;gallery()">Показати ще 60</button>' : ''}${fs.length ? '' : '<div class="empty">Карток не знайдено.</div>'}${foot()}`;
  $('#gallery-search').oninput = e => {
    search = e.target.value;
    let p = e.target.selectionStart;
    shown = 60;
    gallery();
    $('#gallery-search').focus();
    $('#gallery-search').setSelectionRange(p, p);
  };
  $('#only-images').onchange = e => {
    onlyImages = e.target.checked;
    gallery();
  };
}

function max(q) {
  return q.type === 'single' ? 1 : q.type === 'match' ? 4 : 3;
}
function grade(q, v) {
  if (q.type === 'single') return v === q.correct ? 1 : 0;
  if (q.type === 'match') return q.correct.reduce((n, x, i) => n + (v?.[i] === x ? 1 : 0), 0);
  if (q.type === 'multi')
    return (Array.isArray(v) ? v : []).filter(x => q.correct.includes(x)).length;
  if (q.type === 'order') {
    if (JSON.stringify(v) === JSON.stringify(q.correct)) return 3;
    return (v?.[0] === q.correct[0] ? 1 : 0) + (v?.[3] === q.correct[3] ? 1 : 0);
  }
  return 0;
}
function valid(q, v) {
  if (q.type === 'single') return Number.isInteger(v) && v >= 0 && v < q.options.length;
  if (!Array.isArray(v)) return false;
  let n = q.type === 'multi' ? 3 : 4,
    lim = q.type === 'match' ? 5 : q.type === 'multi' ? 7 : 4;
  return (
    v.length === n &&
    new Set(v).size === n &&
    v.every(x => Number.isInteger(x) && x >= 0 && x < lim)
  );
}
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function begin(ids, title, mode = 'learn', cursor = '') {
  if (!ids.length) {
    toast('У цьому наборі поки немає завдань.');
    return;
  }
  S.session = { ids, title, mode, index: Math.min(S.cursors[cursor] || 0, ids.length - 1), cursor };
  save();
  go('quiz');
}
function startTopic(id, filter = 'all') {
  let t = T[id - 1];
  if (!t) return;
  S.lastTopic = id;
  let ids = t.questions;
  if (filter === 'new') ids = ids.filter(id => !S.answers[id]);
  if (filter === 'wrong')
    ids = ids.filter(id => S.answers[id] && S.answers[id].score < S.answers[id].max);
  begin(ids, 'Тема ' + id + ' · ' + t.title, 'learn', 't' + id + '-' + filter);
}
function practiceFact(id) {
  begin(
    Q.filter(q => q.facts.includes(id)).map(q => q.id),
    'Факт · ' + FM[id].label
  );
}
function startVisual() {
  begin(
    shuffle(Q.filter(q => q.image && FM[q.facts[0]]?.kind === galleryKind).map(q => q.id)),
    'Візуальна пам’ять'
  );
}
function startReview(filter = 'wrong') {
  let ids =
    filter === 'wrong'
      ? wrongIds()
      : filter === 'pins'
        ? S.pins.filter(x => QM[x])
        : Object.keys(S.answers).filter(x => QM[x] && S.answers[x].due <= Date.now());
  begin(
    shuffle(ids),
    filter === 'wrong'
      ? 'Повторення помилок'
      : filter === 'pins'
        ? 'Збережені завдання'
        : 'Відкладене повторення'
  );
}
function current() {
  return S.session && QM[S.session.ids[S.session.index]];
}
function isMock() {
  return S.session?.mode === 'mock';
}
function value(q) {
  return isMock()
    ? S.mock?.answers[q.id]
    : S.drafts[q.id] !== undefined
      ? S.drafts[q.id]
      : S.answers[q.id]?.value;
}
function locked(q) {
  return isMock() ? !!S.mock?.finished : !!S.answers[q.id]?.checked;
}
function setValue(v) {
  let q = current();
  if (!q || locked(q)) return;
  if (isMock()) S.mock.answers[q.id] = v;
  else S.drafts[q.id] = v;
  save();
  quiz();
}
function choose(i) {
  let q = current();
  if (!q || locked(q)) return;
  if (q.type === 'single') setValue(i);
  if (q.type === 'multi') {
    let v = Array.isArray(value(q)) ? [...value(q)] : [];
    if (v.includes(i)) v = v.filter(x => x !== i);
    else if (v.length < 3) v.push(i);
    else {
      toast('Обери рівно три відповіді.');
      return;
    }
    setValue(v);
  }
}
function chooseMatch(i, x) {
  let q = current(),
    v = Array.isArray(value(q)) ? [...value(q)] : [-1, -1, -1, -1];
  v[i] = x === '' ? -1 : Number(x);
  setValue(v);
}
function moveOrder(i, delta) {
  let q = current(),
    v = Array.isArray(value(q)) ? [...value(q)] : [0, 1, 2, 3],
    j = i + delta;
  if (j < 0 || j > 3) return;
  [v[i], v[j]] = [v[j], v[i]];
  setValue(v);
}
function check() {
  let q = current();
  if (!q || locked(q) || isMock()) return;
  let v = value(q);
  if (q.type === 'order' && v === undefined) v = [0, 1, 2, 3];
  if (!valid(q, v)) {
    toast(
      q.type === 'match'
        ? 'Заповни чотири відповідності без повторення варіантів.'
        : q.type === 'multi'
          ? 'Обери рівно три відповіді.'
          : 'Спочатку обери відповідь.'
    );
    return;
  }
  let score = grade(q, v),
    old = S.answers[q.id],
    attempts = (old?.attempts || 0) + 1;
  S.answers[q.id] = {
    value: structuredClone(v),
    score,
    max: max(q),
    first: old?.first ?? score,
    checked: true,
    attempts,
    at: Date.now(),
    due: Date.now() + (score === max(q) ? Math.min(14, attempts * 2) * 86400000 : 0),
  };
  delete S.drafts[q.id];
  let day = pDay();
  S.days[day] = (S.days[day] || 0) + 1;
  save();
  quiz();
}
function retry() {
  let q = current();
  if (!q || isMock() || !S.answers[q.id]) return;
  S.answers[q.id].checked = false;
  S.drafts[q.id] =
    q.type === 'single'
      ? null
      : q.type === 'order'
        ? [0, 1, 2, 3]
        : q.type === 'match'
          ? [-1, -1, -1, -1]
          : [];
  save();
  quiz();
}
function navQ(i) {
  let ss = S.session;
  if (!ss) return;
  ss.index = Math.max(0, Math.min(ss.ids.length - 1, i));
  if (ss.cursor) S.cursors[ss.cursor] = ss.index;
  save();
  quiz();
  window.scrollTo(0, 0);
}
function pin() {
  let q = current();
  S.pins = S.pins.includes(q.id) ? S.pins.filter(x => x !== q.id) : [...S.pins, q.id];
  save();
  quiz();
}
function newMock() {
  if (
    S.mock &&
    !S.mock.finished &&
    !confirm('Замінити незавершений пробний тест новим? Відповіді цього тесту буде втрачено.')
  )
    return;
  let singles = [],
    seen = new Set();
  for (let q of shuffle(Q.filter(q => q.type === 'single'))) {
    if (!seen.has(q.topic)) {
      singles.push(q);
      seen.add(q.topic);
    }
    if (singles.length === 20) break;
  }
  let ids = [
    ...singles,
    ...shuffle(Q.filter(q => q.type === 'match')).slice(0, 4),
    ...shuffle(Q.filter(q => q.type === 'order')).slice(0, 3),
    ...shuffle(Q.filter(q => q.type === 'multi')).slice(0, 3),
  ].map(q => q.id);
  S.mock = {
    id: Date.now(),
    ids,
    answers: {},
    started: Date.now(),
    expires: Date.now() + 3600000,
    finished: null,
  };
  begin(ids, 'Пробний тест · структура НМТ-2026', 'mock');
}
function resumeMock() {
  if (!S.mock) return;
  let index = isMock() ? S.session.index : 0;
  S.session = {
    ids: S.mock.ids,
    title: S.mock.finished ? 'Розбір пробного тесту' : 'Пробний тест · структура НМТ-2026',
    mode: 'mock',
    index,
    cursor: '',
  };
  save();
  go('quiz');
}
function finishMock(auto = false) {
  let m = S.mock;
  if (!m || m.finished) return;
  let n = m.ids.filter(id => valid(QM[id], m.answers[id])).length;
  if (
    !auto &&
    !confirm(`Завершити тест? Заповнено ${n} із 30. Після завершення змінювати відповіді не можна.`)
  )
    return;
  m.finished = Date.now();
  m.score = m.ids.reduce((s, id) => s + grade(QM[id], m.answers[id]), 0);
  S.history.push({ id: m.id, at: m.finished, score: m.score, answered: n });
  S.history = S.history.slice(-100);
  save();
  go('exam');
  if (auto) toast('Час вичерпано. Тест завершено, результат збережено.');
}
function updateTimer() {
  let el = $('#timer'),
    m = S.mock;
  if (!el || !m) return;
  if (m.finished) {
    el.textContent = 'Тест завершено';
    return;
  }
  let n = Math.max(0, Math.ceil((m.expires - Date.now()) / 1000));
  el.textContent = Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
}

function quiz() {
  let ss = S.session,
    q = current();
  if (!ss || !q) {
    $('#main').innerHTML =
      head('Тренування', 'Обери тему для початку') +
      '<button class="primary gap" onclick="go(\'topics\')">До всіх тем</button>';
    return;
  }
  let mock = isMock(),
    show = locked(q),
    v = value(q),
    score = show ? grade(q, v) : 0,
    done = ss.ids.filter(id => (mock ? valid(QM[id], S.mock.answers[id]) : S.answers[id])).length;
  $('#main').innerHTML =
    `<div class="row between"><button class="textbtn small" onclick="go('${mock ? 'exam' : 'topic/' + q.topic}')">← ${mock ? 'До пробного тесту' : 'До конспекту'}</button>${mock ? '<span class="tag purple" id="timer">Таймер</span>' : '<span class="tag">Відповіді зберігаються автоматично</span>'}</div><div class="u-mt20 u-mb20 row between"><div><div class="eyebrow muted">${esc(ss.title)}</div><p class="u-mt8 small muted">Завдання ${ss.index + 1} з ${ss.ids.length} · ${names[q.category]} · тема ${q.topic}</p></div><button class="${S.pins.includes(q.id) ? 'pinned' : ''}" onclick="pin()" aria-label="Зберегти завдання">${S.pins.includes(q.id) ? '★' : '☆'} <span class="desktop">Зберегти</span></button></div><div class="q-layout"><section class="panel q-card"><span class="tag purple">${{ single: 'Одна відповідь', match: 'Відповідності', multi: 'Три з семи', order: 'Послідовність' }[q.type]} · до ${max(q)} б.</span><h2>${esc(q.prompt)}</h2>${q.passage ? `<div class="passage">${esc(q.passage)}</div>` : ''}${q.image ? `<img class="qimg" src="${DB.assets[q.image]}" alt="Зображення до завдання" onclick="zoomQ()" tabindex="0" onkeydown="if(event.key==='Enter')zoomQ()">` : ''}${q.map ? mapSVG(q.map, true) : ''}<div id="options"></div>${show ? `<div class="feedback ${score === max(q) ? '' : 'bad'}" role="status"><h3>${score === max(q) ? '✓ Правильно' : 'Пояснення відповіді'} · ${score}/${max(q)}</h3>${esc(q.explanation)}<div class="row gap"><button onclick="go('topic/${q.topic}')">До конспекту ›</button>${mock ? '' : '<button onclick="retry()">Відповісти ще раз</button>'}</div></div>` : ''}<div class="row between actions"><button ${ss.index === 0 ? 'disabled' : ''} onclick="navQ(${ss.index - 1})">← Назад</button><div class="row">${!mock && !show ? '<button class="green" onclick="check()">Перевірити</button>' : ''}${ss.index < ss.ids.length - 1 ? `<button class="primary" onclick="navQ(${ss.index + 1})">Далі ›</button>` : `<button class="primary" onclick="${mock && !S.mock.finished ? 'finishMock()' : "go('" + (mock ? 'exam' : 'progress') + "')"}">${mock && !S.mock.finished ? 'Завершити тест' : 'Переглянути прогрес'} ›</button>`}</div></div></section><aside class="u-p16 panel qside"><div class="eyebrow muted">Завдання тренування</div><div class="u-mt12 u-mb8 row between"><strong>${done}/${ss.ids.length}</strong><small class="muted">${mock ? 'заповнено' : 'опрацьовано'}</small></div>${bar(done, ss.ids.length)}<div class="u-mt16 qnav">${ss.ids
      .map((id, i) => {
        let a = S.answers[id],
          c = mock
            ? valid(QM[id], S.mock.answers[id])
              ? 'draft'
              : ''
            : a
              ? a.score === a.max
                ? 'done'
                : 'miss'
              : S.drafts[id] != null
                ? 'draft'
                : '';
        return `<button class="${c} ${i === ss.index ? 'current' : ''}" onclick="navQ(${i})" aria-label="Завдання ${i + 1}" ${i === ss.index ? 'aria-current="step"' : ''}>${i + 1}</button>`;
      })
      .join(
        ''
      )}</div><p class="small muted gap">${mock ? 'Правильні відповіді й пояснення відкриються після завершення тесту.' : 'Зеленим позначено правильні відповіді, персиковим помилки, бузковим чернетки.'}</p>${mock && !S.mock.finished ? '<button class="u-w100 u-mark gap" onclick="finishMock()">Завершити тест</button>' : '<button class="u-w100 gap" onclick="go(\'topics\')">Змінити тему</button>'}<p class="small muted gap">1–7: вибір · Enter: перевірити · ← →: перехід</p></aside></div>${foot()}`;
  let el = $('#options');
  if (q.type === 'single' || q.type === 'multi') {
    let selected = i => (q.type === 'single' ? v === i : (v || []).includes(i)),
      correct = i => (q.type === 'single' ? q.correct === i : q.correct.includes(i));
    el.innerHTML = `<div class="choices" role="${q.type === 'single' ? 'radiogroup' : 'group'}" aria-label="Варіанти відповіді">${q.options.map((o, i) => `<button role="${q.type === 'single' ? 'radio' : 'checkbox'}" aria-checked="${selected(i)}" class="choice ${selected(i) ? 'selected' : ''} ${show && correct(i) ? 'correct' : ''} ${show && selected(i) && !correct(i) ? 'wrong' : ''}" ${show ? 'disabled' : ''} onclick="choose(${i})"><b>${q.type === 'single' ? letters[i] : selected(i) ? '✓' : i + 1}</b><span>${esc(o)}</span></button>`).join('')}</div>`;
  }
  if (q.type === 'match') {
    v = Array.isArray(v) ? v : [];
    el.innerHTML = `<div class="matchopts">${q.options.map((o, i) => `<p><b>${letters[i]}.</b> ${esc(o)}</p>`).join('')}</div>${q.rows.map((r, i) => `<div class="matchrow"><label for="match-${i}">${i + 1}. ${esc(r)}</label><select id="match-${i}" ${show ? 'disabled' : ''} onchange="chooseMatch(${i},this.value)"><option value="">Обрати</option>${q.options.map((o, j) => `<option value="${j}" ${v[i] === j ? 'selected' : ''}>${letters[j]}</option>`).join('')}</select></div>`).join('')}`;
  }
  if (q.type === 'order') {
    v = Array.isArray(v) ? v : [0, 1, 2, 3];
    el.innerHTML =
      '<p class="u-mb16 small muted">Розташуй події від найдавнішої до найпізнішої за допомогою стрілок.</p>' +
      v
        .map(
          (x, i) =>
            `<div class="orderrow"><span class="tag">${i + 1}</span><span>${esc(q.options[x])}</span><button ${show || i === 0 ? 'disabled' : ''} onclick="moveOrder(${i},-1)" aria-label="Перемістити вище">↑</button><button ${show || i === 3 ? 'disabled' : ''} onclick="moveOrder(${i},1)" aria-label="Перемістити нижче">↓</button></div>`
        )
        .join('') +
      (mock && !show
        ? `<button class="gap" onclick="setValue(${JSON.stringify(v)})">Зберегти цей порядок</button>`
        : '');
  }
  if (mock) updateTimer();
  let cur = $('.qnav .current');
  if (cur) {
    let wrap = $('.qnav');
    wrap.scrollTop = Math.max(0, cur.offsetTop - wrap.offsetTop - 90);
  }
}
function zoomQ() {
  let q = current();
  $('#modalbody').innerHTML =
    `<div class="row between"><h2>Зображення до завдання</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><img src="${DB.assets[q.image]}" alt="Зображення до завдання">`;
  $('#modal').showModal();
}
function review() {
  let bad = wrongIds(),
    due = Object.keys(S.answers).filter(id => QM[id] && S.answers[id].due <= Date.now()),
    pins = S.pins.filter(id => QM[id]);
  $('#main').innerHTML =
    head(
      'Тренування',
      'Повторення',
      'Після правильної відповіді завдання зникне зі списку помилок. Результат першої спроби залишиться в статистиці.'
    ) +
    `<div class="grid gap">${[
      [bad, 'Помилки', 'wrong'],
      [due, 'Час повторити', 'due'],
      [pins, 'Збережене', 'pins'],
    ]
      .map(
        ([ids, n, k]) =>
          `<div class="panel"><span class="eyebrow muted">${n}</span><div class="u-big u-mt12 u-mb12">${ids.length}</div><button class="${k === 'wrong' ? 'green' : ''}" ${!ids.length ? 'disabled' : ''} onclick="startReview('${k}')">Почати повторення ›</button></div>`
      )
      .join('')}</div><div class="panel gap"><h2>Помилки за темами</h2>${
      bad.length
        ? `<div class="tablewrap gap"><table>${T.filter(t => stats(t.id).wrong)
            .map(
              t =>
                `<tr><td><button class="textbtn" onclick="startTopic(${t.id},'wrong')">${t.id}. ${esc(t.title)} ›</button></td><td>${stats(t.id).wrong}</td></tr>`
            )
            .join('')}</table></div>`
        : '<p class="muted gap">Поки немає невиправлених помилок. Обери тему, щоб продовжити.</p>'
    }</div>${foot()}`;
}

function exam() {
  let m = S.mock;
  $('#main').innerHTML =
    head(
      'Історія України',
      'Пробний тест',
      '20 завдань з однією відповіддю, 4 на відповідність, 3 на послідовність і 3 з вибором трьох відповідей. Максимум: 54 тестові бали.'
    ) +
    `<div class="two gap"><div class="panel"><span class="tag purple">${m?.finished ? 'Останній результат' : '30 завдань · 60 хвилин практики'}</span>${m?.finished ? `<div class="score gap">${m.score}<small> / 54</small></div><p class="muted gap">${pct(m.score, 54)}% тестових балів, за шкалою 100–200: ${nmtText('hist', m.score)} (таблиця НМТ-2026).</p>` : `<h2 class="gap">Перевір себе за форматом НМТ</h2><p class="muted gap">До завершення відповіді можна змінювати. Пояснення відкриються після тесту. Відповіді зберігаються під час переходів. Таймер при цьому не зупиняється.</p>`}<div class="row gap">${m ? `<button class="green" onclick="resumeMock()">${m.finished ? 'Розібрати відповіді' : 'Продовжити тест'} ›</button>` : ''}<button class="${m ? '' : 'primary'}" onclick="newMock()">Новий пробний тест</button></div></div><div class="panel"><h2>Як рахуються бали</h2><div class="fact"><b>Одна відповідь</b><p>1 бал за правильний варіант.</p></div><div class="fact"><b>Відповідності</b><p>По 1 балу за пару, максимум 4.</p></div><div class="fact"><b>Послідовність</b><p>3 за весь порядок; інакше по 1 за правильні першу й останню позиції.</p></div><div class="fact"><b>Три з семи</b><p>По 1 балу за кожен правильний вибір серед трьох обраних.</p></div></div></div><div class="notice gap">Структура й оцінювання відповідають опису УЦОЯО для НМТ-2026. У тренажері на цей тест відведено 60 хвилин. Це навчальне налаштування; офіційний НМТ не встановлює окремого часу для цього предметного блоку. Умови наступних сесій перевіряй на testportal.gov.ua.</div><div class="panel gap"><h2>Історія пробних тестів</h2>${
      S.history.length
        ? `<div class="tablewrap gap"><table><tr><th>Дата</th><th>Результат</th><th>Заповнено</th></tr>${[
            ...S.history,
          ]
            .reverse()
            .map(
              h =>
                `<tr><td>${new Date(h.at).toLocaleString('uk-UA')}</td><td>${h.score}/54</td><td>${h.answered}/30</td></tr>`
            )
            .join('')}</table></div>`
        : '<p class="muted gap">Тут збережуться завершені спроби.</p>'
    }</div>${foot()}`;
}
function progress() {
  let ids = Object.keys(S.answers).filter(id => QM[id]),
    right = ids.filter(id => S.answers[id].score === S.answers[id].max),
    total = ids.reduce((s, id) => s + S.answers[id].max, 0),
    first = ids.reduce((s, id) => s + S.answers[id].first, 0),
    last = ids.reduce((s, id) => s + S.answers[id].score, 0);
  $('#main').innerHTML =
    head(
      'Результати тренувань',
      'Твій прогрес',
      'Результати залишаються в цьому браузері. Експортуй копію для іншого пристрою або перед очищенням даних.'
    ) +
    `<div class="stats gap">${stat('ОПРАЦЬОВАНО', ids.length + ' / ' + Q.length, pct(ids.length, Q.length) + '% банку')}${stat('ПРАВИЛЬНО ЗАРАЗ', right.length, pct(right.length, ids.length) + '% опрацьованих')}${stat('ПЕРША СПРОБА', first + ' / ' + total, 'тестових балів в опрацьованих')}${stat('ОСТАННІ ВІДПОВІДІ', last + ' / ' + total, 'з урахуванням повторення')}</div><div class="panel gap"><div class="sectionhead"><h2>Прогрес за темами</h2><button onclick="exportData()">Експорт ↓</button></div><div class="tablewrap"><table><thead><tr><th>Тема</th><th>Опрацьовано</th><th>Правильно</th><th>Помилки</th><th>Дія</th></tr></thead><tbody>${T.map(
      t => {
        let s = stats(t.id);
        return `<tr><td><button class="textbtn" onclick="openTopic(${t.id})">${t.id}. ${esc(t.title)}</button></td><td>${s.done}/${s.total}</td><td>${s.right}</td><td>${s.wrong}</td><td><button onclick="startTopic(${t.id})">Тести ›</button></td></tr>`;
      }
    ).join(
      ''
    )}</tbody></table></div></div><div class="two gap"><div class="panel"><h2>Результати за категоріями</h2><div class="tablewrap gap"><table>${[
      'D',
      'T',
      'P',
      'C',
      'G',
      'L',
    ]
      .map(k => {
        let qs = Q.filter(q => q.category === k),
          a = qs.filter(q => S.answers[q.id]);
        return `<tr><td>${names[k]}</td><td>${a.filter(q => S.answers[q.id].score === S.answers[q.id].max).length}/${qs.length}</td></tr>`;
      })
      .join('')}</table></div></div><div class="panel"><h2>Останні дні практики</h2>${
      Object.entries(S.days)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 10)
        .map(
          ([d, n]) =>
            `<div class="row between fact"><span>${d}</span><strong>${n} перевірок</strong></div>`
        )
        .join('') ||
      '<p class="muted gap">Після першого перевіреного завдання тут з’явиться запис про заняття.</p>'
    }<button class="gap" onclick="go('review')">До повторення ↻</button></div></div>${foot()}`;
}
function project(p) {
  return [(p[1] - 21.5) * 32, (53.2 - p[2]) * 47];
}
function mapSVG(indices, task = false, chooseHandler = 'choose') {
  if (!DB.geo) return '';
  let ps = indices || DB.geo.points.map((_, i) => i),
    outline =
      DB.geo.outline
        .map(
          (p, i) =>
            (i ? 'L' : 'M') +
            ((p[0] - 21.5) * 32).toFixed(1) +
            ',' +
            ((53.2 - p[1]) * 47).toFixed(1)
        )
        .join(' ') + 'Z';
  return `<svg class="map" viewBox="0 0 630 470" role="img" aria-label="Картосхема України в сучасних міжнародно визнаних межах"><path d="${outline}"/>${ps
    .map((id, i) => {
      let p = DB.geo.points[id],
        [x, y] = project(p);
      return `<g tabindex="0" role="button" aria-label="${task ? 'Позначка ' + letters[i] : esc(p[0])}" onclick="${task ? chooseHandler + '(' + i + ')' : 'showPoint(' + id + ')'}" onkeydown="if(event.key==='Enter'){${task ? chooseHandler + '(' + i + ')' : 'showPoint(' + id + ')'}}"><circle cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${y}">${task ? letters[i] : id + 1}</text></g>`;
    })
    .join('')}</svg>`;
}
function showPoint(id) {
  let p = DB.geo.points[id];
  $('#point-info').innerHTML =
    `<span class="tag">${id + 1} · тема ${p[3]}</span><h2 class="u-mt12 u-mb12">${esc(p[0])}</h2><p>${esc(p[4])}</p><button class="gap" onclick="openTopic(${p[3]})">Відкрити тему ›</button>`;
}
function mapPage() {
  if (!DB.geo) {
    $('#main').innerHTML =
      head('Географія', 'Картографічний довідник') +
      '<p class="muted gap">Географічні факти доступні в конспектах тем.</p>';
    return;
  }
  $('#main').innerHTML =
    head(
      'Історична географія',
      'Міста й місця на карті',
      'Античні міста, княжі центри, гетьманські резиденції та культурні осередки на сучасній карті.'
    ) +
    `<div class="notice gap">Навчальна схема із сучасними міжнародно визнаними межами України, включно з Кримом. Вона не відтворює кордонів історичної епохи. Координати позначок приблизні.</div><div class="two gap"><div class="panel">${mapSVG()}<div class="row gap">${DB.geo.points.map((p, i) => `<button class="pill" onclick="showPoint(${i})">${i + 1}. ${esc(p[0])}</button>`).join('')}</div></div><div class="panel" id="point-info"><h2>Обери позначку</h2><p class="muted gap">Натисни позначку на карті або назву міста, щоб прочитати пов’язані з ним відомості.</p><button class="green gap" onclick="begin(Q.filter(q=>q.map).map(q=>q.id),'Історична географія')">Картографічне тренування ›</button></div></div>${foot()}`;
}

function sources() {
  let counts = Object.fromEntries(
    ['D', 'P', 'T', 'C', 'G', 'L'].map(k => [k, F.filter(f => f.kind === k).length])
  );
  $('#main').innerHTML =
    head(
      'Про матеріали',
      'Програма й джерела',
      'Історичний розділ охоплює 32 теми програми. Конспекти й завдання написано для цього тренажера.'
    ) +
    `<div class="two gap"><div class="panel"><h2>Програма УЦОЯО</h2><ul class="u-pl20"><li><a href="https://testportal.gov.ua/progist/" target="_blank" rel="noopener">Програма з історії України — УЦОЯО</a></li><li class="u-mt12"><a href="https://testportal.gov.ua/wp-content/uploads/2016/12/Programa_2020_istoriya.pdf" target="_blank" rel="noopener">Оригінал програми, наказ МОН №696 від 26.06.2018</a></li><li class="u-mt12"><a href="https://testportal.gov.ua/istoriya-ukrayiny-2026/" target="_blank" rel="noopener">Структура й оцінювання НМТ-2026</a></li><li class="u-mt12"><a href="https://lv.testportal.gov.ua/traneeHistory/edusite/index.html" target="_blank" rel="noopener">Довідник ЛРЦОЯО: дати, терміни, персоналії, пам’ятки</a></li></ul><p class="small muted gap">Програма зазначає: дати створення культурних пам’яток не обов’язкові для запам’ятовування. Вчися впізнавати пам’ятку за зображенням, знати її назву, автора та історичний контекст.</p></div><div class="panel"><h2>Що містить банк</h2><div class="tablewrap gap"><table>${Object.entries(
      counts
    )
      .map(([k, n]) => `<tr><td>${names[k]}</td><td>${n}</td></tr>`)
      .join(
        ''
      )}<tr><td>Завдання</td><td>${Q.length}</td></tr><tr><td>Зображення</td><td>${Object.keys(DB.assets).length}</td></tr></table></div></div></div><div class="panel gap"><h2>Як користуватися матеріалами</h2><p class="muted gap">Конспект містить короткі опорні факти. Тести тренують упізнавання, відповідності, хронологію та роботу зі зображеннями. Для розгорнутого пояснення процесів поєднуй конспект із підручником. В атласі є 11 історичних картосхем із поясненнями та вправами; окрема карта міст допомагає орієнтуватися в сучасній географії. Звертай увагу на легенду й часові межі кожної історичної карти.</p><p class="muted gap">Відсоток виконання означає прогрес у цьому банку. Цей показник не підтверджує засвоєння всіх умінь програми й не гарантує 200 балів. Повноту добірки історичних джерел і карт ще має перевірити фахівець з історії.</p><p class="muted gap">У програмі 2018 року є умовні й неточні дати: тут для виборів 2010 року наведено січень–лютий; для Порошенка розрізнено вибори 25 травня та інавгурацію в червні. Створення УПА позначено традиційною датою, формування відбувалося поступово. Дату 9 травня 1945 року наведено як хронологію цієї програми.</p></div><div class="panel gap"><h2>Ілюстрації та картосхеми</h2><p class="muted gap">Основний набір ілюстрацій узято з відкритого довідника Львівського регіонального центру оцінювання якості освіти. Додаткові зображення: <a href="https://esu.com.ua/article-59572" target="_blank" rel="noopener">Вірменський собор — ЕСУ</a>; <a href="https://ua.igotoworld.com/ua/poi_object/2296_chasovnya-treh-svyatiteley.htm" target="_blank" rel="noopener">каплиця Трьох Святителів — IGotoWorld</a>; ікона Горошковича — Wikimedia Commons; <a href="https://naurok.com.ua/test/povist-minulih-lit-118165.html" target="_blank" rel="noopener">пам’ятник засновникам Києва — «На Урок»</a>. Контур України побудовано за географічними даними Natural Earth. Зображення вбудовані та працюють без інтернету.</p></div><div class="panel gap"><h2>Текст програми</h2><p class="small muted gap">Користуйся офіційним PDF програми: у ньому немає помилок розпізнавання.</p><button class="gap" onclick="auditPDF('hist')">Відкрити офіційну програму PDF ›</button></div>${foot()}`;
}
function download(name, text, type = 'application/json') {
  let b = new Blob([text], { type }),
    u = URL.createObjectURL(b),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
}
function exportData() {
  download(
    'istoria200-progress-' + pDay() + '.json',
    JSON.stringify({ app: 'istoria200', exportedAt: new Date().toISOString(), state: S }, null, 2)
  );
  toast('Резервну копію підготовлено.');
}
function settings() {
  $('#main').innerHTML =
    head(
      'Налаштування',
      'Збереження та резервна копія',
      'Відповіді й чернетки зберігаються в цьому браузері. Прогрес у завантаженому файлі та на сайті зберігається окремо. Щоб перенести його, завантаж резервну копію й відкрий її в потрібній версії тренажера.'
    ) +
    `<div class="two gap"><div class="panel"><h2>Резервна копія</h2><p class="muted gap">Копія містить відповіді, закладки, нотатки, позиції в темах і результати пробних тестів.</p><div class="row gap"><button class="green" onclick="exportData()">Експорт прогресу ↓</button><button onclick="$('#import-file').click()">Імпорт копії ↑</button></div><p class="small muted gap">Імпорт замінює поточний прогрес після перевірки файлу й підтвердження.</p></div><div class="panel"><h2>Стан сховища</h2><p class="gap ${storageOK ? 'success' : ''}">${storageOK ? '✓ Збереження доступне' : 'Збереження недоступне'}</p><p class="muted small gap">Очищення даних браузера або приватний режим можуть видалити локальні результати. Експортуй копію перед такими діями.</p><button class="gap" onclick="exportLegacy()">Зберегти дані попередньої версії</button><p class="small muted gap">Дані попереднього тренажера можна зберегти окремим файлом. Через відмінності між версіями вони не переносяться в поточний банк завдань.</p></div></div><div class="panel gap"><h2>Скинути поточний прогрес</h2><p class="muted gap">Спочатку збережи копію. Скидання стосується лише цієї версії тренажера.</p><button class="u-mark gap" onclick="resetProgress()">Скинути дані</button></div>${foot()}`;
}
function exportLegacy() {
  let raw = localStorage.getItem('study-nmt-ukraine-history-v3');
  if (!raw) {
    toast('У цьому браузері не знайдено даних попередньої версії.');
    return;
  }
  download('history-legacy-progress.json', raw);
  toast('Дані попередньої версії експортовано.');
}
function resetProgress() {
  if (!confirm('Скинути прогрес цієї версії? Спочатку збережи резервну копію.')) return;
  S = fresh();
  save();
  go('home');
  toast('Прогрес скинуто.');
}

function backupText() {
  return JSON.stringify(
    { app: 'istoria200', exportedAt: new Date().toISOString(), state: S },
    null,
    2
  );
}
const settingsBase = settings;
settings = function () {
  settingsBase();
  let row = document.createElement('div');
  row.className = 'row gap';
  row.innerHTML =
    '<button onclick="backupDialog()">Показати код копії</button><button onclick="backupDialog(true)">Вставити код копії</button>';
  $('#main .panel').append(row);
};
function backupDialog(importing = false) {
  $('#modalbody').innerHTML =
    `<div class="row between"><h2>${importing ? 'Відновити з коду' : 'Код резервної копії'}</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><p class="muted gap">${importing ? 'Встав повний код збереженої копії. Після перевірки можна буде замінити поточний прогрес.' : 'Якщо файл не завантажується, скопіюй цей код у текстовий файл або нотатки. У ньому збережено твої відповіді, чернетки й нотатки до тем. Код можна вставити в тренажер на іншому пристрої.'}</p><textarea id="backup-code" aria-label="Код резервної копії" spellcheck="false" class="u-code-area" ${importing ? '' : 'readonly'}></textarea><div class="row gap">${importing ? '<button class="green" onclick="restoreBackupCode()">Перевірити й відновити</button>' : '<button class="green" onclick="copyBackupCode()">Скопіювати код</button><button onclick="exportData()">Завантажити файл копії</button>'}</div>`;
  if (!importing) $('#backup-code').value = backupText();
  $('#modal').showModal();
  $('#backup-code').focus();
}
async function copyBackupCode() {
  let el = $('#backup-code');
  el.select();
  try {
    await navigator.clipboard.writeText(el.value);
    toast('Код скопійовано.');
  } catch {
    toast('Код виділено. Натисни Ctrl+C або «Копіювати».');
  }
}
function restoreBackupCode() {
  try {
    let raw = $('#backup-code').value;
    if (raw.length > 5 * 1024 * 1024) throw Error('Копія перевищує 5 МБ.');
    let next = normaliseImport(JSON.parse(raw));
    if (
      !confirm(
        `Відновити ${Object.keys(next.answers).length} відповідей і замінити поточний прогрес?`
      )
    )
      return;
    restoreApplyHistory(next);
    $('#modal').close();
    go('progress');
    toast('Прогрес відновлено.');
  } catch (e) {
    toast('Копію не прийнято: ' + e.message);
  }
}

let atlasMode = 'historical';
const geographicPage = mapPage;
function atlasTabs() {
  return `<div class="p-tabs"><button class="${atlasMode === 'historical' ? 'is-active' : ''}" onclick="atlasMode='historical';mapPage()">Історичні картосхеми</button><button class="${atlasMode === 'points' ? 'is-active' : ''}" onclick="atlasMode='points';mapPage()">Міста й місця</button></div>`;
}
mapPage = function () {
  if (atlasMode === 'points') {
    geographicPage();
    $('#main').insertAdjacentHTML('afterbegin', atlasTabs());
    return;
  }
  let maps = DB.historicalMaps || [];
  $('#main').innerHTML =
    head(
      'Історична географія',
      'Історичні карти',
      'Розглянь легенду й позначення, а потім прочитай пояснення до карти. У завданнях можна перевірити, чи впізнаєш події та місця.'
    ) +
    atlasTabs() +
    `<div class="row between gap"><p class="muted small">${maps.length} картосхем${maps.some(m => m.questions.length) ? ' · ' + maps.reduce((n, m) => n + m.questions.length, 0) + ' авторські вправи' : ''}</p>${maps.some(m => m.questions.length) ? `<button class="green" onclick="begin(DB.historicalMaps.flatMap(m=>m.questions),'Історичні картосхеми')">Тест за картами ›</button>` : ''}</div><div class="notice gap">Карти відтворюють конкретні історичні сюжети й умовні позначення свого джерела. Їхні кордони та назви стосуються показаного періоду. Добірка поки не охоплює всіх картографічних завдань програми.</div><div class="grid gap">${maps.map(m => `<article class="panel"><button class="u-bare" onclick="showFact('${m.id}')" aria-label="Розглянути карту: ${esc(m.title)}"><img src="${DB.assets[m.image]}" alt="${esc(m.title)}" class="u-atlas-img"></button><span class="tag gap">Тема ${m.topic}</span><h2 class="u-mt12 u-mb12 u-fs-xl">${esc(m.title)}</h2><div class="row"><button onclick="showFact('${m.id}')">Розібрати карту</button>${m.questions.length ? `<button class="green" onclick="practiceFact('${m.id}')">До завдань ›</button>` : ''}</div></article>`).join('')}</div><p class="small muted gap">Картографічні ілюстрації: <a href="https://lv.testportal.gov.ua/traneeHistory/edusite/maps.html" target="_blank" rel="noopener">Львівський регіональний центр оцінювання якості освіти</a>. Пояснення та вправи написано для цього тренажера.</p>${foot()}`;
};

/* Складено: предмети, практика і симуляції. Старий прогрес історії зберігається окремо. */
const PB = DB.subjects || [],
  PSUB = Obj0(PB.map(s => [s.id, s]));
const HQ = Q.map(q => ({
  ...q,
  subject: 'hist',
  topicId: 'hist-' + q.topic,
  answer: q.correct,
  left: q.rows,
  right: q.options,
}));
const PQ = [
  ...HQ,
  ...PB.flatMap(s =>
    s.topics.flatMap(t => t.questions.map(q => ({ ...q, subject: s.id, topicId: t.id })))
  ),
  ...(DB.advanced || []),
  ...(DB.auditQuestions || []),
  ...(DB.visualBank || []),
];
const PM = Obj0(PQ.map(q => [q.id, q])),
  PT = Obj0(PB.flatMap(s => s.topics.map(t => [t.id, t])));
const SUBJECTS = [
  {
    id: 'ukr',
    name: 'Українська мова',
    short: 'Українська',
    mark: 'Аа',
    color: '#b94932',
    description: 'Правопис, будова мови та робота з реченням.',
  },
  {
    id: 'math',
    name: 'Математика',
    short: 'Математика',
    mark: 'ƒx',
    color: '#284c9b',
    description: 'Пояснення, приклади й задачі для самостійного розв’язання.',
  },
  {
    id: 'hist',
    name: 'Історія України',
    short: 'Історія',
    mark: 'І',
    color: '#7b542d',
    description: 'Хронологія, історичні події, персоналії та пам’ятки.',
  },
  {
    id: 'eng',
    name: 'Англійська мова',
    short: 'Англійська',
    mark: 'En',
    color: '#3c6958',
    description: 'Читання, граматика й лексика у форматі тесту.',
  },
  {
    id: 'bio',
    name: 'Біологія',
    short: 'Біологія',
    mark: 'Бі',
    color: '#4f7a2c',
    description: 'Офіційні завдання ЗНО та НМТ за темами програми. Без конспекту й розборів.',
  },
  {
    id: 'geo',
    name: 'Географія',
    short: 'Географія',
    mark: 'Ге',
    color: '#2f6d8a',
    description: 'Офіційні завдання ЗНО та НМТ за темами програми. Без конспекту й розборів.',
  },
].filter(s => !['bio', 'geo'].includes(s.id) || PSUB[s.id]); // біологія й географія з’являються лише разом із даними
const SUB = Obj0(SUBJECTS.map(s => [s.id, s])),
  PKEY = 'skladeno-prep-v1';
// НМТ: три обов’язкові предмети й один на вибір. Четвертим можна обрати англійську, біологію чи географію;
// прогноз, конкурсний бал, план і повна симуляція рахуються за цими чотирма, решта предметів доступні для практики й пробників.
const CORE_SUBJECTS = ['ukr', 'math', 'hist'],
  FOURTH_SUBJECTS = ['eng', 'bio', 'geo'].filter(id => SUB[id]);
function subjFourth() {
  return FOURTH_SUBJECTS.includes(P.study?.fourth) ? P.study.fourth : 'eng';
}
function subjActive() {
  return [...CORE_SUBJECTS, subjFourth()].map(id => SUB[id]);
}
// Предмети з авторськими конспектами, вправами й картами програми; біологія й географія мають лише офіційні завдання.
const AUTHORED_SUBJECTS = SUBJECTS.filter(s => ['ukr', 'math', 'hist', 'eng'].includes(s.id));
function pFresh() {
  return {
    schema: 1,
    answers: {},
    drafts: {},
    pins: [],
    notes: {},
    read: [],
    sessions: {},
    current: null,
    exam: null,
    records: [],
    logs: {},
    plan: { minutes: 45, days: {} },
    lastSubject: 'ukr',
  };
}
let P = pFresh(),
  pTab = 'theory',
  pQuery = '',
  pFilter = 'all',
  pStorage = true;
function pMax(q) {
  return q.type === 'numeric'
    ? 2
    : q.type === 'match'
      ? q.answer.length
      : q.type === 'single'
        ? 1
        : 3;
}
function pNumber(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return NaN;
  let s = String(v).trim().replace(/−/g, '-').replace(/,/g, '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}
function pValid(q, v) {
  if (!q) return false;
  if (q.type === 'numeric') return Number.isFinite(pNumber(v));
  if (q.type === 'single') return Number.isInteger(v) && v >= 0 && v < q.options.length;
  if (!Array.isArray(v)) return false;
  let n = q.type === 'multi' ? 3 : q.answer.length,
    lim = q.type === 'match' ? q.right.length : q.type === 'order' ? 4 : 7;
  return (
    v.length === n &&
    new Set(v).size === n &&
    v.every(x => Number.isInteger(x) && x >= 0 && x < lim)
  );
}
function pGrade(q, v) {
  if (q.type === 'match')
    return q.answer.reduce((n, a, i) => n + (Array.isArray(v) && v[i] === a ? 1 : 0), 0);
  if (q.type === 'multi')
    return Array.isArray(v) && v.length <= 3
      ? new Set(v.filter(x => q.answer.includes(x))).size
      : 0;
  if (!pValid(q, v)) return 0;
  if (q.type === 'single') return v === q.answer ? 1 : 0;
  if (q.type === 'numeric')
    return Math.abs(pNumber(v) - pNumber(q.answer)) <= (q.tolerance ?? 1e-8) ? 2 : 0;
  if (q.type === 'order')
    return JSON.stringify(v) === JSON.stringify(q.answer)
      ? 3
      : (v[0] === q.answer[0] ? 1 : 0) + (v[3] === q.answer[3] ? 1 : 0);
  return 0;
}
function pSavedTime(value) {
  let n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 8640000000000000 ? n : Date.now();
}
function pNormal(raw) {
  if (!raw || raw.schema !== 1 || typeof raw.answers !== 'object' || Array.isArray(raw.answers))
    throw Error('Невідомий формат прогресу.');
  let n = pFresh();
  for (const [id, a] of Object.entries(raw.answers || {})) {
    let q = PM[id];
    if (q && pValid(q, a?.value))
      n.answers[id] = {
        value: a.value,
        score: pGrade(q, a.value),
        max: pMax(q),
        first: Math.min(pMax(q), Math.max(0, Number(a.first) || 0)),
        attempts:
          Number.isSafeInteger(Number(a.attempts)) && Number(a.attempts) > 0
            ? Number(a.attempts)
            : 1,
        at: pSavedTime(a.at),
        due: pSavedTime(a.due),
      };
  }
  for (const [id, v] of Object.entries(raw.drafts || {}))
    if (PM[id] && (v === null || typeof v === 'string' || Number.isInteger(v) || Array.isArray(v)))
      n.drafts[id] = v;
  n.pins = Array.isArray(raw.pins) ? raw.pins.filter(id => PM[id]) : [];
  n.read = Array.isArray(raw.read) ? raw.read.filter(id => PT[id]) : [];
  for (const [id, v] of Object.entries(raw.notes || {}))
    if ((PT[id] || PM[id]) && typeof v === 'string') n.notes[id] = v.slice(0, 30000);
  for (const [key, ss] of Object.entries(raw.sessions || {}))
    if (guardKey(key) && ss && Array.isArray(ss.ids) && ss.ids.length && ss.ids.every(id => PM[id]))
      n.sessions[key] = {
        ...ss,
        index: Math.max(0, Math.min(ss.ids.length - 1, Math.trunc(Number(ss.index) || 0))),
      };
  n.current = n.sessions[raw.current] ? raw.current : null;
  n.records = Array.isArray(raw.records)
    ? raw.records
        .filter(
          r =>
            r &&
            Array.isArray(r.ids) &&
            r.ids.every(id => PM[id]) &&
            r.answers &&
            typeof r.answers === 'object' &&
            Number.isFinite(r.finished)
        )
        .slice(-30)
    : [];
  if (
    raw.exam &&
    Array.isArray(raw.exam.ids) &&
    raw.exam.ids.length &&
    raw.exam.ids.every(id => PM[id]) &&
    typeof raw.exam.answers === 'object' &&
    Number.isFinite(raw.exam.deadline)
  ) {
    n.exam = raw.exam;
    n.exam.index = Math.max(0, Math.min(n.exam.ids.length - 1, Number(n.exam.index) || 0));
  }
  if (raw.plan && [20, 30, 45, 60, 90].includes(raw.plan.minutes))
    n.plan = {
      minutes: raw.plan.minutes,
      days: raw.plan.days && typeof raw.plan.days === 'object' ? raw.plan.days : {},
    };
  for (const [d, v] of Object.entries(raw.logs || {}))
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isInteger(v) && v >= 0) n.logs[d] = v;
  n.lastSubject = SUB[raw.lastSubject] ? raw.lastSubject : 'ukr';
  return n;
}
try {
  const raw = JSON.parse(restoreRead(PKEY) || 'null');
  if (raw) P = pNormal(raw);
} catch {
  pStorage = false;
  keepCorrupt(PKEY);
}
function pSave() {
  try {
    localStorage.setItem(PKEY, JSON.stringify(P));
    pStorage = true;
    $('#save-status').textContent = 'Збережено на цьому пристрої';
  } catch {
    pStorage = false;
    $('#save-status').textContent = 'Зроби резервну копію';
    if (Date.now() - (window.pSaveWarnAt || 0) > 15000) {
      window.pSaveWarnAt = Date.now();
      toast('Браузер не зберіг прогрес. Створи резервну копію в налаштуваннях.');
    }
  }
}
function pDay() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
}
function pAnswers() {
  return {
    ...Object.fromEntries(Object.entries(S.answers).map(([id, a]) => [id, a])),
    ...P.answers,
  };
}
function pSubStats(id) {
  let qs = PQ.filter(q => q.subject === id),
    aa = pAnswers(),
    done = qs.filter(q => aa[q.id]),
    good = done.filter(q => aa[q.id].score === aa[q.id].max);
  return {
    total: qs.length,
    done: done.length,
    good: good.length,
    accuracy: pct(good.length, done.length),
  };
}
function pFoot() {
  return '<footer class="p-footer"><a href="#library">Матеріали й джерела ›</a></footer>';
}
const P_MENU_LABELS = [
  'Прогрес',
  'Матеріали',
  'Знайди потрібне',
  'На іспиті',
  'Розклад підготовки',
  'Тренування у форматі іспиту',
];
function pHeading(k, title, desc = '') {
  return `<header class="p-page-head"><h1>${title}</h1>${k && !P_MENU_LABELS.includes(k) ? `<p class="p-meta">${k}</p>` : ''}${desc ? `<p class="p-lead">${desc}</p>` : ''}</header>`;
}
function pSubjectRows() {
  return SUBJECTS.map((s, i) => {
    let st = pSubStats(s.id);
    return `<a class="p-subject-row" href="#subject/${s.id}" style="--subject:${s.color}"><span class="p-number">0${i + 1}</span><span class="p-subject-mark">${s.mark}</span><div><h3>${s.name}</h3></div><div class="p-row-meta"><strong>${st.done} / ${st.total}</strong><span>опрацьовано</span></div><span class="p-arrow">›</span></a>`;
  }).join('');
}
function pHub() {
  let aa = pAnswers(),
    done = Object.keys(aa).filter(id => PM[id]).length,
    due = PQ.filter(q => aa[q.id] && aa[q.id].due <= Date.now()).length,
    ss = P.current && P.sessions[P.current],
    last = SUB[PM[ss?.ids?.[ss.index]]?.subject || P.lastSubject],
    day = Object.values(P.logs).reduce((a, b) => a + b, 0);
  $('#main').innerHTML =
    `<section class="p-hero"><div><h1>Готуйся до НМТ<br><em>у своєму темпі.</em></h1><p class="p-lead">Обери предмет і тему, прочитай конспект та виконай завдання. Після перевірки розбери помилки за поясненнями.</p><div class="p-actions"><button class="primary" onclick="${ss ? 'pResume()' : `go('subject/${last.id}')`}">${ss ? 'Продовжити заняття' : 'Почати з ' + { ukr: 'української', math: 'математики', hist: 'історії', eng: 'англійської', bio: 'біології', geo: 'географії' }[last.id]} <span>›</span></button><a href="#mocks">Обрати пробний тест ›</a></div></div><aside class="p-session-card"><p class="p-kicker">Наступне заняття</p><div class="p-session-time">${P.plan.minutes}<span>хв</span></div><h3>${last.name}</h3><p>${ss ? esc(ss.title) : 'Прочитай конспект теми й перейди до завдань із поясненнями.'}</p><div class="p-rule"></div><a href="#plan">Мій план до НМТ ›</a></aside></section><div class="p-status-strip"><span><strong>${done}</strong> завдань опрацьовано</span><span><strong>${due}</strong> чекають повторення</span><span><strong>${P.records.filter(r => r.finished).length}</strong> завершених пробників</span><a href="#analytics">Подивитися прогрес ›</a></div><section class="p-section"><div class="p-section-head"><div><h2>Предмети, до яких ти готуєшся</h2></div><span class="p-caption">Твій предмет на вибір: ${SUB[subjFourth()].name.toLowerCase()}</span></div><div class="p-subject-list">${pSubjectRows()}</div></section><section class="p-bottom-grid"><article class="p-feature"><h2>Потренуйся<br>з таймером.</h2><p>Предметні пробники та повна симуляція: два блоки по 120 хвилин, перерва й розбір після завершення.</p><a class="p-link" href="#mocks">Обрати пробний НМТ ›</a></article><article class="p-note"><h2>Виправ свої помилки</h2><p>Перший результат залишається в статистиці. Повторні спроби показують, що ти вже засвоїв.</p><button onclick="pReview('wrong')">Повторити завдання з помилками ›</button></article></section>${pFoot()}`;
}
let pQuerySubject = '';
function pSubject(id) {
  let s = SUB[id];
  if (!s) {
    go('hub');
    return;
  }
  if (pQuerySubject !== id) {
    pQuery = '';
    pQuerySubject = id;
  }
  P.lastSubject = id;
  pSave();
  let st = pSubStats(id),
    bank = PSUB[id];
  $('#main').innerHTML =
    pHeading(
      'Предмет / ' + (CORE_SUBJECTS.includes(id) ? 'Обов’язковий' : 'На вибір'),
      s.name,
      s.description
    ) +
    `<div class="p-subject-toolbar"><div><strong>${st.done} / ${st.total}</strong><span> опрацьовано · ${st.accuracy}% правильних серед виконаних</span></div><div class="p-actions"><button onclick="pReview('wrong','${id}')">Помилки</button><button class="primary" onclick="pStartMixed('${id}')">Змішана практика ›</button></div></div><div class="p-section-head"><h2>Теми для підготовки</h2><a href="#mocks/${id}">Пробні тести з предмета ›</a></div>${
      id === 'hist'
        ? `<div class="p-history-tools"><a href="#gallery">Пам’ятки та персоналії ›</a><a href="#map">Історичні карти ›</a><a href="#sources">Програма УЦОЯО ›</a></div><div class="p-topic-list">${T.map(t => pTopicRow('hist-' + t.id, t.title, t.questions, t.id)).join('')}</div>`
        : `<div class="p-search"><input id="p-topic-search" type="search" placeholder="Знайти тему…" aria-label="Пошук тем" value="${esc(pQuery)}"></div><div class="p-topic-list">${
            bank.topics
              .filter(t => (t.title + ' ' + t.summary).toLowerCase().includes(pQuery.toLowerCase()))
              .map(
                (t, i, a) =>
                  (t.group && t.group !== a[i - 1]?.group
                    ? `<h3 class="p-group-title">${esc(bank.groups?.find(g => g.id === t.group)?.title || '')}</h3>`
                    : '') +
                  pTopicRow(
                    t.id,
                    t.title,
                    t.questions.map(q => q.id),
                    i + 1
                  )
              )
              .join('') ||
            '<p class="empty">Тему не знайдено. Спробуй інше слово або очисть пошук.</p>'
          }</div>`
    }${pFoot()}`;
  if ($('#p-topic-search'))
    $('#p-topic-search').oninput = e => {
      pQuery = e.target.value;
      let n = e.target.selectionStart;
      pSubject(id);
      $('#p-topic-search').focus();
      $('#p-topic-search').setSelectionRange(n, n);
    };
}
function pTopicRow(id, title, ids, i) {
  let aa = pAnswers(),
    n = ids.filter(x => aa[x]).length,
    isHist = id.startsWith('hist-');
  return `<a class="p-topic-row" href="#${isHist ? 'topic/' + id.slice(5) : 'lesson/' + id}"><span class="p-number">${String(i).padStart(2, '0')}</span><div><h3>${esc(title)}</h3><p>${stPlural(ids.length, 'завдання', 'завдання', 'завдань')}${P.read.includes(id) ? ' · конспект опрацьовано' : ''}</p></div><div class="p-topic-progress"><span>${n}/${ids.length}</span>${bar(n, ids.length)}</div><span class="p-arrow">›</span></a>`;
}
function pLesson(id) {
  let t = PT[id];
  if (!t) {
    go('hub');
    return;
  }
  let q = PM[t.questions[0].id],
    subject = q.subject;
  $('#main').innerHTML =
    `<a class="p-back" href="#subject/${subject}">← ${SUB[subject].name}</a>` +
    pHeading('Конспект і практика', esc(t.title), esc(t.summary)) +
    `<div class="p-actions p-lesson-actions"><button class="primary" onclick="pStartTopic('${id}')">Виконати завдання теми ›</button><button onclick="pStartTopic('${id}','new')">Лише невиконані</button><button onclick="pStartTopic('${id}','wrong')">Помилки</button><button onclick="pToggleRead('${id}')">${P.read.includes(id) ? '✓ Конспект опрацьовано' : 'Позначити опрацьованим'}</button></div><div class="p-tabs"><button class="${pTab === 'theory' ? 'is-active' : ''}" onclick="pTab='theory';pLesson('${id}')">Конспект</button><button class="${pTab === 'notes' ? 'is-active' : ''}" onclick="pTab='notes';pLesson('${id}')">Мої нотатки</button><span>${stPlural(t.questions.length, 'завдання', 'завдання', 'завдань')}${t.notes.length ? ' з поясненнями' : ''}</span></div>${pTab === 'theory' ? `<div class="p-reading">${t.notes.length ? '' : '<aside class="p-alert"><div><strong>Конспекту до цієї теми немає</strong><p>Тут лише офіційні завдання ЗНО й НМТ, без написаних пояснень: після перевірки видно правильну відповідь. Теорію бери з підручника за темою програми.</p></div></aside>'}${t.notes.map((n, i) => `<article class="p-rule-block"><h2>${esc(n.title)}</h2><p>${esc(n.text)}</p>${n.example ? `<div class="p-example"><span>Приклад</span><p>${esc(n.example)}</p></div>` : ''}</article>`).join('')}<aside class="p-study-tip"><strong>Перевір себе на завданнях теми</strong><p>${t.notes.length ? 'Після кожної відповіді — пояснення.' : 'Після кожної відповіді видно правильну відповідь.'}</p><button class="primary" onclick="pStartTopic('${id}')">Перейти до завдань ›</button></aside></div>` : `<div class="panel"><label for="p-notes">Власні приклади, складні місця й запитання</label><textarea id="p-notes" placeholder="Що я зрозумів? Де ще помиляюся?">${esc(P.notes[id] || '')}</textarea><p class="small muted">Нотатки зберігаються автоматично й входять до резервної копії.</p></div>`}${pFoot()}`;
  if ($('#p-notes'))
    $('#p-notes').oninput = e => {
      P.notes[id] = e.target.value;
      pSave();
    };
}
function pToggleRead(id) {
  P.read = P.read.includes(id) ? P.read.filter(x => x !== id) : [...P.read, id];
  pSave();
  pLesson(id);
}
function pStart(ids, title, key) {
  ids = ids.filter(id => PM[id]);
  if (!ids.length) {
    toast('За цим фільтром завдань немає. Обери інший фільтр або тему.');
    return;
  }
  let old = P.sessions[key],
    same = old && old.ids.length === ids.length && old.ids.every((id, i) => id === ids[i]);
  delete P.sessions[key];
  P.sessions[key] = {
    ids,
    title,
    index: same ? Math.max(0, Math.min(ids.length - 1, old.index || 0)) : 0,
  };
  for (let k of Object.keys(P.sessions)) {
    if (Object.keys(P.sessions).length <= 80) break;
    if (k !== key && k !== P.current) delete P.sessions[k];
  }
  P.current = key;
  pSave();
  go('practice');
}
function pStartTopic(id, filter = 'all') {
  let t = PT[id];
  if (!t) return;
  let ids = t.questions
    .map(q => q.id)
    .filter(id =>
      filter === 'new'
        ? !P.answers[id]
        : filter === 'wrong'
          ? P.answers[id] && P.answers[id].score < P.answers[id].max
          : true
    );
  pStart(ids, t.title, id + '-' + filter);
}
function pStartMixed(id) {
  let ids = pSeedShuffle(
    PQ.filter(q => q.subject === id).map(q => q.id),
    Date.now()
  ).slice(0, 20);
  pStart(ids, SUB[id].name + ' · 20 завдань', 'mixed-' + id);
}
function pResume() {
  go('practice');
}
function pReview(mode = 'wrong', subject = '') {
  let aa = pAnswers(),
    ids = PQ.filter(
      q =>
        (!subject || q.subject === subject) &&
        (mode === 'pins'
          ? P.pins.includes(q.id)
          : mode === 'due'
            ? aa[q.id] && aa[q.id].due <= Date.now()
            : aa[q.id] && aa[q.id].score < aa[q.id].max)
    ).map(q => q.id);
  pStart(
    ids,
    mode === 'pins'
      ? 'Збережені завдання'
      : mode === 'due'
        ? 'Завдання для повторення'
        : 'Робота над помилками',
    'review-' + mode + '-' + subject
  );
}
function pSeedShuffle(a, seed) {
  a = [...a];
  let x = (Number(seed) || 1) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    x = (1664525 * x + 1013904223) >>> 0;
    let j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let pRecordView = null;
function pContext() {
  let isExam = route.startsWith('simulate'),
    rec = pRecordView && route.startsWith('result-review');
  if (rec) {
    let r = P.records.find(x => x.id === pRecordView.id);
    return r
      ? {
          ids: r.ids,
          index: pRecordView.index,
          title: r.title,
          answers: r.answers,
          finished: true,
          record: true,
        }
      : null;
  }
  if (isExam) {
    let e = P.exam;
    return e
      ? {
          ids: e.full ? e.blocks[e.stage === 2 ? 1 : 0] : e.ids,
          index: e.index,
          title: e.title,
          answers: e.answers,
          exam: true,
          finished: !!e.finished,
        }
      : null;
  }
  return P.current ? P.sessions[P.current] : null;
}
function pQ() {
  let c = pContext();
  return c && PM[c.ids[c.index]];
}
function pVal(q) {
  let c = pContext();
  return c?.exam || c?.record
    ? c.answers[q.id]
    : P.drafts[q.id] !== undefined
      ? P.drafts[q.id]
      : P.answers[q.id]?.value;
}
function pLocked(q) {
  let c = pContext();
  return c?.record || c?.exam
    ? !!c.finished || (c.exam && P.exam.stage === 'break')
    : !!P.answers[q.id] && P.drafts[q.id] === undefined;
}
function pSet(v, redraw = true) {
  let c = pContext(),
    q = pQ();
  if (!c || !q || pLocked(q)) return;
  if (c.exam && pCheckExpiry()) return;
  if (c.exam) P.exam.answers[q.id] = v;
  else P.drafts[q.id] = v;
  pSave();
  if (redraw) pPractice();
}
function pChoose(i) {
  let q = pQ(),
    v = pVal(q);
  if (q.type === 'single') pSet(i);
  else if (q.type === 'multi') {
    v = Array.isArray(v) ? [...v] : [];
    if (v.includes(i)) v = v.filter(x => x !== i);
    else if (v.length < 3) v.push(i);
    else return toast('Обери не більш як три варіанти.');
    pSet(v);
  }
}
function pMatch(i, s) {
  let q = pQ(),
    v = Array.isArray(pVal(q)) ? [...pVal(q)] : q.left.map(() => -1),
    x = s === '' ? -1 : Number(s);
  if (x >= 0 && v.some((z, j) => j !== i && z === x)) {
    toast('Цей варіант уже використано в іншій парі.');
    pPractice();
    return;
  }
  v[i] = x;
  pSet(v);
}
function pOrder(i, d) {
  let q = pQ(),
    v = Array.isArray(pVal(q)) ? [...pVal(q)] : [0, 1, 2, 3],
    j = i + d;
  if (j < 0 || j >= 4) return;
  [v[i], v[j]] = [v[j], v[i]];
  pSet(v);
}
function pCheck() {
  let c = pContext(),
    q = pQ();
  if (!q || c.exam || c.record || pLocked(q)) return;
  let v = pVal(q);
  if (q.type === 'order' && v === undefined) v = [0, 1, 2, 3];
  if (!pValid(q, v)) {
    toast(
      q.type === 'numeric'
        ? 'Введи число. Для десяткових дробів підійде кома або крапка.'
        : q.type === 'match'
          ? 'Заповни всі пари без повторення варіантів.'
          : q.type === 'multi'
            ? 'Обери рівно три відповіді.'
            : 'Спочатку обери відповідь.'
    );
    return;
  }
  let old = P.answers[q.id],
    score = pGrade(q, v),
    attempts = (old?.attempts || 0) + 1;
  P.answers[q.id] = {
    value: structuredClone(v),
    score,
    max: pMax(q),
    first: old?.first ?? score,
    attempts,
    at: Date.now(),
    due: Date.now() + (score === pMax(q) ? Math.min(14, attempts * 2) * 86400000 : 0),
  };
  delete P.drafts[q.id];
  P.logs[pDay()] = (P.logs[pDay()] || 0) + 1;
  pSave();
  pPractice();
}
function pRetry() {
  let q = pQ();
  if (!q) return;
  P.drafts[q.id] =
    q.type === 'single'
      ? null
      : q.type === 'numeric'
        ? ''
        : q.type === 'order'
          ? [0, 1, 2, 3]
          : q.type === 'match'
            ? q.left.map(() => -1)
            : [];
  pSave();
  pPractice();
}
function pNav(i) {
  let c = pContext();
  if (!c) return;
  if (c.exam && pCheckExpiry()) return;
  i = Math.max(0, Math.min(c.ids.length - 1, i));
  if (c.exam) P.exam.index = i;
  else if (c.record) pRecordView.index = i;
  else P.sessions[P.current].index = i;
  pSave();
  pPractice();
  window.scrollTo(0, 0);
}
function pPin() {
  let q = pQ();
  P.pins = P.pins.includes(q.id) ? P.pins.filter(x => x !== q.id) : [...P.pins, q.id];
  pSave();
  pPractice();
}
function pCorrect(q) {
  if (q.type === 'single')
    return pMark(q, q.answer) + (q.options[q.answer] ? ' — ' + q.options[q.answer] : '');
  if (q.type === 'numeric') return String(q.answer);
  if (q.type === 'match')
    return q.left
      .map(
        (x, i) =>
          `${i + 1} — ${pMark(q, q.answer[i])}${q.right[q.answer[i]] ? ' (' + q.right[q.answer[i]] + ')' : ''}`
      )
      .join('\n');
  if (q.type === 'multi')
    return (
      q.answer.map(i => i + 1).join(', ') +
      (q.answer.every(i => q.options[i]) ? ' — ' + q.answer.map(i => q.options[i]).join('; ') : '')
    );
  return q.answer.map(i => pMark(q, i)).join(' → ');
}
function pPractice() {
  let c = pContext();
  if (c?.exam && pCheckExpiry()) return;
  if (c && !c.exam && !c.record && c.ids.some(id => !PM[id])) {
    c.ids = c.ids.filter(id => PM[id]);
    c.index = Math.max(0, Math.min(c.index || 0, c.ids.length - 1));
    pSave();
  }
  if (!c || !c.ids.length || !PM[c.ids[c.index]]) {
    $('#main').innerHTML =
      pHeading(
        'Практика',
        'Спочатку обери тему',
        'Обери предмет і тему, щоб почати. Відповіді та місце, на якому ти зупинився, зберігаються.'
      ) +
      '<a class="primary" href="#hub">До предметів ›</a>' +
      pFoot();
    return;
  }
  if (c.exam && P.exam.stage === 'break') {
    pBreak();
    return;
  }
  let q = PM[c.ids[c.index]],
    v = pVal(q),
    locked = pLocked(q),
    show = locked,
    sub = SUB[q.subject],
    title = PT[q.topicId]?.title || T[(q.topic || 1) - 1]?.title || sub.name,
    done = c.ids.filter(id =>
      c.exam || c.record ? pValid(PM[id], c.answers[id]) : pAnswerRecord(id)
    ).length;
  $('#main').innerHTML =
    `<div class="p-practice-top"><a class="p-back" href="#${c.exam ? 'mocks' : c.record ? 'result/' + pRecordView.id : q.subject === 'hist' ? 'topic/' + q.topic : 'lesson/' + q.topicId}">← ${c.exam ? 'Пробні НМТ' : c.record ? 'До результату' : sub.name}</a><div class="p-actions">${c.exam ? '<span class="p-timer" id="p-timer" role="timer">Таймер</span>' : c.record ? '<span class="tag">Завершений пробник</span>' : '<span class="p-caption">Чернетка зберігається автоматично</span>'}<button onclick="pPin()" aria-label="Зберегти завдання">${P.pins.includes(q.id) ? '★ Збережено' : '☆ Зберегти'}</button></div></div><div class="p-practice"><section class="p-question"><div class="p-kicker">${esc(c.title)} / ${c.index + 1} із ${c.ids.length}</div><div class="p-question-meta"><span>${{ single: 'Одна відповідь', numeric: 'Коротка відповідь', match: 'Відповідності', order: 'Послідовність', multi: 'Три з семи' }[q.type]}</span><span>До ${pMax(q)} б.</span>${q.source ? `<span class="p-source">${esc(q.source)}</span>` : ''}</div>${q.passage ? `<article class="p-passage" lang="${q.subject === 'eng' ? 'en' : 'uk'}">${esc(q.passage)}</article>` : ''}<h2 class="p-prompt" lang="${q.subject === 'eng' ? 'en' : 'uk'}">${esc(pDisplayPrompt(q, c))}</h2>${pImgs(q)}${q.map ? mapSVG(q.map, true, 'pChoose') : ''}<div id="p-answer-area">${pAnswerHTML(q, v, show)}</div>${show ? `<div class="p-feedback ${pGrade(q, v) === pMax(q) ? 'is-correct' : 'is-wrong'}"><h3>${pGrade(q, v) === pMax(q) ? 'Правильно' : 'Розбір відповіді'} · ${pGrade(q, v)}/${pMax(q)}</h3><p class="p-correct-answer"><strong>Правильна відповідь:</strong> ${esc(pCorrect(q))}</p>${pExplain(q)}${!c.record && !c.exam ? '<button onclick="pRetry()">Спробувати ще раз ›</button>' : ''}</div>` : ''}<div class="p-question-actions"><button ${c.index === 0 ? 'disabled' : ''} onclick="pNav(${c.index - 1})">← Назад</button><div class="p-actions">${!c.exam && !c.record && !show ? '<button class="primary" onclick="pCheck()">Перевірити</button>' : ''}${c.index < c.ids.length - 1 ? `<button onclick="pNav(${c.index + 1})">Далі ›</button>` : c.exam ? '<button class="primary" onclick="pFinishStage()">Завершити блок ›</button>' : `<a href="#${c.record ? 'result/' + pRecordView.id : 'analytics'}">До результатів ›</a>`}</div></div>${!c.exam ? `<details class="p-note-question"><summary>Моя нотатка до завдання</summary><textarea id="p-question-note" aria-label="Нотатка до завдання">${esc(P.notes[q.id] || '')}</textarea></details>` : ''}</section><aside class="p-exam-nav"><p class="p-kicker">${c.exam ? 'Навігація блоку' : 'Завдання теми'}</p><h3>${done} / ${c.ids.length}</h3><p class="p-caption">${c.exam ? 'заповнено' : 'опрацьовано'}</p>${bar(done, c.ids.length)}<div class="qnav">${c.ids
      .map((id, i) => {
        let a = pAnswerRecord(id),
          state =
            c.exam || c.record
              ? pValid(PM[id], c.answers[id])
                ? 'draft'
                : ''
              : a
                ? a.score === a.max
                  ? 'done'
                  : 'miss'
                : P.drafts[id] != null
                  ? 'draft'
                  : '';
        return `<button class="${state} ${i === c.index ? 'current' : ''}" onclick="pNav(${i})" aria-label="Завдання ${i + 1}${{ done: ' — правильно', miss: ' — є помилка', draft: ' — відповідь введено' }[state] || ''}" ${i === c.index ? 'aria-current="step"' : ''}>${i + 1}</button>`;
      })
      .join(
        ''
      )}</div><p class="p-caption">${c.exam ? 'Під час пробника правильні відповіді приховані. Можна змінювати відповіді в межах поточного блоку.' : 'Перевірені відповіді збережено у прогресі. Щоб змінити відповідь, натисни «Спробувати ще раз».'}</p>${c.exam ? '<button onclick="pFinishStage()">Завершити блок</button>' : `<a href="#subject/${q.subject}">Обрати іншу тему ›</a>`}<div class="p-rule"></div><p class="p-caption">${esc(title)}</p>${q.subject === 'math' ? '<button onclick="pFormulaDialog()">Формули ›</button>' : ''}</aside></div>${pFoot()}`;
  if ($('#p-numeric')) $('#p-numeric').oninput = e => pSet(e.target.value, false);
  if ($('#p-question-note'))
    $('#p-question-note').oninput = e => {
      P.notes[q.id] = e.target.value;
      pSave();
    };
  pTimer();
}
function pAnswerHTML(q, v, show) {
  if (q.type === 'single' || q.type === 'multi')
    return `<div class="p-options" role="${q.type === 'single' ? 'radiogroup' : 'group'}" aria-label="Варіанти відповіді">${q.options
      .map((o, i) => {
        let chosen = q.type === 'single' ? v === i : Array.isArray(v) && v.includes(i),
          correct = q.type === 'single' ? q.answer === i : q.answer.includes(i);
        return `<button class="p-option ${chosen ? 'is-selected' : ''} ${show && correct ? 'is-correct' : ''} ${show && chosen && !correct ? 'is-wrong' : ''}" role="${q.type === 'single' ? 'radio' : 'checkbox'}" aria-checked="${chosen}" ${show ? 'disabled' : ''} onclick="pChoose(${i})"><span>${pMark(q, i)}</span><span>${pOptHTML(q, i)}</span></button>`;
      })
      .join('')}</div>`;
  if (q.type === 'numeric')
    return `<div class="p-numeric"><label for="p-numeric">Відповідь числом</label><input id="p-numeric" inputmode="decimal" autocomplete="off" value="${esc(v ?? '')}" ${show ? 'disabled' : ''} placeholder="Наприклад: −2,5"><p class="p-caption">Кома й крапка рівнозначні. Дроби перед введенням перетвори на десяткові.</p></div>`;
  if (q.type === 'match')
    return `<div class="p-match-options">${q.right.map((o, i) => `<p><strong>${pMark(q, i)}.</strong> ${pOptHTML(q, i)}</p>`).join('')}</div><div class="p-matches">${q.left.map((l, i) => `<div class="matchrow"><label for="p-match-${i}">${i + 1}. ${pRowHTML(q, i)}</label><select id="p-match-${i}" ${show ? 'disabled' : ''} onchange="pMatch(${i},this.value)"><option value="">Обрати</option>${q.right.map((_, j) => `<option value="${j}" ${v?.[i] === j ? 'selected' : ''}>${pMark(q, j)}</option>`).join('')}</select></div>`).join('')}</div>`;
  if (q.type === 'order') {
    v = Array.isArray(v) ? v : [0, 1, 2, 3];
    return (
      '<p class="p-caption">Розташуй події від найдавнішої до найпізнішої.</p>' +
      v
        .map(
          (x, i) =>
            `<div class="orderrow"><span>${i + 1}.</span><span>${pOptHTML(q, x)}</span><button ${show || !i ? 'disabled' : ''} onclick="pOrder(${i},-1)" aria-label="Перемістити пункт ${i + 1} вище">↑</button><button ${show || i === 3 ? 'disabled' : ''} onclick="pOrder(${i},1)" aria-label="Перемістити пункт ${i + 1} нижче">↓</button></div>`
        )
        .join('') +
      (!show ? `<button onclick="pSet(${JSON.stringify(v)})">Підтвердити цей порядок</button>` : '')
    );
  }
  return '';
}

function pDisplayPrompt(q, c) {
  if (q.format === 'matching' && q.groupId && c.exam) {
    let n = c.ids.filter(id => PM[id].groupId === q.groupId).length;
    return (
      'Обери заголовок або опис, що відповідає тексту. У цьому блоці ' +
      n +
      ' текстів і ' +
      q.options.length +
      ' варіантів; зайвих варіантів: ' +
      (q.options.length - n) +
      '.'
    );
  }
  return q.prompt;
}

/* Фіксовані авторські пробники за формою НМТ-2026. */
const EXAMINFO = {
  ukr: { count: 30, max: 45, detail: '10 із 4 варіантів · 15 із 5 варіантів · 5 відповідностей' },
  math: {
    count: 22,
    max: 32,
    detail: '15 з вибором відповіді · 3 відповідності · 4 короткі відповіді',
  },
  hist: {
    count: 30,
    max: 54,
    detail: '20 з вибором відповіді · 4 відповідності · 3 послідовності · 3 «три з семи»',
  },
  eng: { count: 32, max: 32, detail: '5 із вибором відповіді · 11 відповідностей · 16 пропусків' },
  // Біологія й географія: справжні тести НМТ 2023–2026 з офіційного сайту; у біології завдання з трьома підпунктами розкладено на три.
  bio: {
    count: 34,
    max: 46,
    detail: '24 з вибором відповіді · 4 відповідності · 2 завдання з трьох питань (по одному балу)',
  },
  geo: {
    count: 30,
    max: 46,
    detail: '20 з вибором відповіді · 4 короткі відповіді · 6 «три з семи»',
  },
};
function pPick(pool, n, seed) {
  if (pool.length < n) throw Error('Недостатньо завдань для пробника: ' + n);
  return pSeedShuffle(pool, seed).slice(0, n);
}
function pEngUnits() {
  let qs = PQ.filter(q => q.subject === 'eng' && !q.examOnly),
    units = [];
  for (const q of qs) {
    if (q.type === 'match') {
      q.left.forEach((row, i) => {
        let id = q.id + '-unit-' + i;
        if (!PM[id])
          PM[id] = {
            ...q,
            id,
            type: 'single',
            prompt: row,
            passage: [q.passage, q.prompt].filter(Boolean).join('\n\n'),
            options: q.right,
            answer: q.answer[i],
            format: 'matching',
            examOnly: true,
            group: q.id,
          };
        units.push(PM[id]);
      });
    } else if (q.format === 'matching') units.push(q);
  }
  return units;
}
const ENGUNITS = pEngUnits();
function pMockSet(subject, variant = 1) {
  if (subject === 'eng' && PSUB.eng.mockSets?.[variant - 1])
    return [...PSUB.eng.mockSets[variant - 1]];
  let pool = PQ.filter(q => q.subject === subject && !q.challenge),
    seed = 202600 + variant * 101 + subject.length * 7,
    items = [];
  let take = (type, n, offset) =>
    pPickBalanced(
      pool.filter(q => q.type === type),
      n,
      seed + offset
    );
  if (subject === 'ukr') {
    let four = pPickBalanced(
      pool.filter(q => q.type === 'single' && q.options.length === 4),
      10,
      seed + 1
    );
    let five = DB.ukrainianFiveOptionSets[variant - 1].map(id => PM[id]);
    items = [...four, ...five, ...take('match', 5, 2)];
  }
  if (subject === 'math')
    items = [...take('single', 15, 3), ...take('match', 3, 4), ...take('numeric', 4, 5)];
  if (subject === 'hist')
    items = [
      ...take('single', 20, 6),
      ...take('match', 4, 7),
      ...take('order', 3, 8),
      ...take('multi', 3, 9),
    ];
  if (subject === 'eng') {
    let read = pool.filter(q => q.type === 'single' && q.format === 'reading'),
      gaps = pool.filter(q => q.type === 'single' && q.format === 'gapfill');
    items = [
      ...pPick(read, 5, seed),
      ...pPick(ENGUNITS, 11, seed + 1),
      ...pPick(gaps, 16, seed + 2),
    ];
  }
  return items.map(q => q.id);
}
function pMocks(subject = '') {
  let e = P.exam;
  $('#main').innerHTML =
    pHeading(
      'Тренування у форматі іспиту',
      'Пробні НМТ',
      'Обери тест з одного предмета або повну симуляцію з чотирьох. Після завершення зможеш переглянути відповіді й пояснення.'
    ) +
    `${e && !e.finished ? `<div class="p-alert"><div><strong>Є незавершений пробник</strong><p>${esc(e.title)}. Таймер продовжує відлік, навіть коли сторінку закрито.</p></div><button class="primary" onclick="go('simulate')">Повернутися ›</button></div>` : ''}<section class="p-full-exam"><div><h2>Повний тест<br>зі ${subjActive().reduce((n, s) => n + EXAMINFO[s.id].count, 0)} завдань</h2><p>Українська + математика: 120 хв.<br>Перерва: 20 хв.<br>Історія + ${SUB[subjFourth()].name.toLowerCase()}: 120 хв.</p><p class="p-caption">Результати й пояснення з’являться після завершення. У межах одного блоку можна перемикатися між предметами.</p></div><div class="p-mock-variants">${stVariantList(
      'all'
    )
      .map(
        v =>
          `<button class="${v === 1 ? 'primary' : ''}" onclick="pLaunchMock('all',${v})">Варіант ${String(v).padStart(2, '0')} ›</button>`
      )
      .join(
        ''
      )}</div></section><div class="p-tabs">${[['', 'Усі предмети'], ...SUBJECTS.map(s => [s.id, s.short])].map(([id, n]) => `<a href="#mocks${id ? '/' + id : ''}" class="${subject === id ? 'is-active' : ''}">${n}</a>`).join('')}</div><div class="p-mock-grid">${SUBJECTS.filter(
      s => !subject || s.id === subject
    )
      .map(
        s =>
          `<article class="p-mock-card" style="--subject:${s.color}"><h2>${s.name}</h2><p>${EXAMINFO[s.id].detail}</p><div class="p-mock-facts"><strong>${EXAMINFO[s.id].count}<span>завдань</span></strong><strong>${EXAMINFO[s.id].max}<span>тестових балів</span></strong><strong>60<span>хв тренування</span></strong></div><div class="p-actions">${stVariantList(
            s.id
          )
            .map(v => `<button onclick="pLaunchMock('${s.id}',${v})">Варіант ${v} ›</button>`)
            .join('')}</div></article>`
      )
      .join(
        ''
      )}</div><section class="p-section"><div class="p-section-head"><h2>Твої завершені пробники</h2></div>${
      P.records.length
        ? `<div class="p-topic-list">${[...P.records]
            .reverse()
            .map(
              r =>
                `<a class="p-topic-row" href="#result/${r.id}"><div><h3>${esc(r.title)}</h3><p>${new Date(r.finished).toLocaleString('uk-UA')}</p></div><strong>${r.score} / ${r.max}</strong><span>Розбір ›</span></a>`
            )
            .join('')}</div>`
        : '<p class="p-empty">Перший результат з’явиться після завершення тесту.</p>'
    }</section><aside class="p-study-tip"><h3>Звір свій рівень з офіційним тестом</h3><p>Пробники мають ту саму кількість завдань, форми й оцінювання, що й НМТ-2026. Раз на кілька тижнів проходь і офіційний демоваріант УЦОЯО — це найточніший орієнтир.</p><a href="https://testportal.gov.ua/demonstratsijnyj-variant-nmt-2026/" target="_blank" rel="noopener">Офіційні демонстраційні варіанти ›</a></aside>${pFoot()}`;
}
function pLaunchMock(subject, variant) {
  if (
    P.exam &&
    !P.exam.finished &&
    !confirm('Замінити незавершений пробник? Його відповіді буде втрачено.')
  )
    return;
  let full = subject === 'all',
    sets = full ? subjActive().map(s => pMockSet(s.id, variant)) : [pMockSet(subject, variant)],
    ids = sets.flat(),
    split = full ? sets[0].length + sets[1].length : 0,
    blocks = full ? [ids.slice(0, split), ids.slice(split)] : [ids],
    now = Date.now();
  P.exam = {
    id: 'exam-' + now,
    subject,
    variant,
    full,
    ids,
    blocks,
    stage: 1,
    index: 0,
    answers: {},
    started: now,
    deadline: now + (full ? 120 : 60) * 60000,
    title: (full ? 'Повна симуляція' : SUB[subject].name) + ' · варіант ' + variant,
    finished: null,
  };
  pSave();
  go('simulate');
}
function pCheckExpiry() {
  let e = P.exam;
  if (!e || e.finished) return false;
  if (e.stage === 'break') {
    if (Date.now() >= e.deadline) {
      pBeginBlock2();
      return true;
    }
    return false;
  }
  if (Date.now() >= e.deadline) {
    pFinishStage(true);
    return true;
  }
  return false;
}
function pFinishStage(auto = false) {
  let e = P.exam;
  if (!e || e.finished || e.stage === 'break') return;
  let ids = e.full ? e.blocks[e.stage === 2 ? 1 : 0] : e.ids,
    n = ids.filter(id => pValid(PM[id], e.answers[id])).length;
  if (
    !auto &&
    !confirm(
      `Завершити ${e.full ? 'блок' : 'тест'}? Заповнено ${n} із ${ids.length}. Після завершення змінювати ці відповіді не можна.`
    )
  )
    return;
  if (e.full && e.stage === 1) {
    let end = e.deadline;
    e.stage = 'break';
    e.index = 0;
    e.deadline = (auto ? end : Date.now()) + 20 * 60000;
    pSave();
    pPractice();
    return;
  }
  pFinalize(e, auto);
}
function pBreak() {
  let e = P.exam;
  $('#main').innerHTML =
    pHeading(
      'Перший блок завершено',
      'Перерва перед другим блоком',
      'До другого блоку є час відпочити. Відійди від екрана, випий води або трохи розімнися.'
    ) +
    `<div class="p-break"><div class="p-session-time" id="p-timer">20:00</div><p>Наступний блок: історія України та ${SUB[subjFourth()].name.toLowerCase()}. На нього відведено 120 хвилин.</p><p class="p-caption">Другий блок почнеться автоматично після завершення перерви. До першого повернутися вже не можна.</p><button class="primary" onclick="pBeginBlock2(true)">Почати другий блок раніше ›</button></div>${pFoot()}`;
  pTimer();
}
function pBeginBlock2(early = false) {
  let e = P.exam;
  if (!e || e.stage !== 'break') return;
  let start = early ? Date.now() : e.deadline;
  e.stage = 2;
  e.index = 0;
  e.deadline = start + 120 * 60000;
  pSave();
  go('simulate');
  if (route === 'simulate') pPractice();
}
function pFinalize(e, auto = false) {
  if (e.finished) return;
  if (auto && !Object.keys(e.answers).length) {
    P.exam = null;
    pSave();
    if (route.startsWith('simulate')) go('mocks');
    return;
  }
  e.finished = auto ? Math.min(Date.now(), e.deadline) : Date.now();
  let r = {
    id: e.id,
    title: e.title,
    subject: e.subject,
    variant: e.variant,
    ids: e.ids,
    answers: structuredClone(e.answers),
    started: e.started,
    finished: e.finished,
    score: e.ids.reduce((s, id) => s + pGrade(PM[id], e.answers[id]), 0),
    max: e.ids.reduce((s, id) => s + pMax(PM[id]), 0),
  };
  if (!P.records.some(x => x.id === r.id)) P.records.push(r);
  P.records = P.records.slice(-30);
  pSave();
  if (!auto || route.startsWith('simulate')) go('result/' + r.id);
  else toast('Час пробника вичерпано, результат збережено в розділі «Пробні НМТ».');
}
function pTimer() {
  let e = P.exam,
    el = $('#p-timer');
  if (!el || !e || e.finished) return;
  let sec = Math.max(0, Math.ceil((e.deadline - Date.now()) / 1000));
  el.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  el.classList.toggle('is-urgent', sec < 300);
}
function pResult(id) {
  let r = P.records.find(x => x.id === id);
  if (!r) {
    go('mocks');
    return;
  }
  let bad = r.ids.filter(id => pGrade(PM[id], r.answers[id]) < pMax(PM[id]));
  $('#main').innerHTML =
    pHeading(
      'Результат пробного тесту',
      esc(r.title),
      'Тестові бали за цю спробу та їх переведення у шкалу 100–200 за таблицями НМТ-2026.'
    ) +
    `<div class="p-result-score"><strong>${r.score}<span> / ${r.max}</span></strong><p>тестових балів · ${r.ids.filter(id => pValid(PM[id], r.answers[id])).length} із ${r.ids.length} заповнено</p></div><div class="p-subject-list">${SUBJECTS.filter(
      s => r.ids.some(id => PM[id].subject === s.id)
    )
      .map(s => {
        let ids = r.ids.filter(id => PM[id].subject === s.id),
          score = ids.reduce((n, id) => n + pGrade(PM[id], r.answers[id]), 0),
          mx = ids.reduce((n, id) => n + pMax(PM[id]), 0);
        return `<div class="p-subject-row"><span class="p-subject-mark" style="--subject:${s.color}">${s.mark}</span><div><h3>${s.name}</h3><p>${stPlural(ids.length, 'завдання', 'завдання', 'завдань')}</p></div><strong>${score} / ${mx}</strong><a href="#subject/${s.id}">До підготовки ›</a></div>`;
      })
      .join(
        ''
      )}</div><div class="p-actions p-section"><button class="primary" onclick="pOpenRecord('${r.id}')">Переглянути всі відповіді ›</button><button ${!bad.length ? 'disabled' : ''} onclick="pMockMistakes('${r.id}')">Повторити завдання з помилками (${bad.length})</button><a href="#mocks">Інші пробники ›</a></div><h2>Теми для наступного заняття</h2><div class="p-topic-list">${
      pWeakTopics(bad)
        .slice(0, 6)
        .map(
          x =>
            `<a class="p-topic-row" href="#${x.id.startsWith('hist-') ? 'topic/' + x.id.slice(5) : 'lesson/' + x.id}"><h3>${esc(x.title)}</h3><span>${stPlural(x.n, 'завдання', 'завдання', 'завдань')} із втраченими балами ›</span></a>`
        )
        .join('') ||
      '<p class="p-empty">Усі завдання виконано на повний бал. Перевір результат на офіційному демоваріанті.</p>'
    }</div>${pFoot()}`;
}
function pWeakTopics(ids) {
  let a = {};
  ids.forEach(id => {
    let q = PM[id];
    if (!q) return;
    let t = q.topicId;
    a[t] ??= {
      id: t,
      title: PT[t]?.title || T[Number(t.slice(5)) - 1]?.title || SUB[q.subject].name,
      n: 0,
    };
    a[t].n++;
  });
  return Object.values(a).sort((a, b) => b.n - a.n);
}
function pOpenRecord(id) {
  pRecordView = { id, index: 0 };
  go('result-review/' + id);
}
function pMockMistakes(id) {
  let r = P.records.find(x => x.id === id);
  if (!r) return;
  let ids = r.ids.filter(id => pGrade(PM[id], r.answers[id]) < pMax(PM[id]));
  for (let qid of ids) coachPrepareRecall(qid);
  save();
  pSave();
  pStart(ids, r.title + ' · помилки', 'mistakes-' + id);
}
setInterval(() => {
  if (P.exam && !P.exam.finished) {
    if (!pCheckExpiry()) pTimer();
  }
}, 1000);

function pPickBalanced(pool, n, seed) {
  let groups = {};
  for (let q of pool) (groups[q.topicId] ??= []).push(q);
  let keys = pSeedShuffle(Object.keys(groups), seed),
    queues = Object.fromEntries(keys.map((k, i) => [k, pSeedShuffle(groups[k], seed + i * 17)])),
    out = [];
  while (out.length < n) {
    let moved = false;
    for (let k of keys) {
      if (queues[k].length) {
        out.push(queues[k].shift());
        moved = true;
        if (out.length === n) break;
      }
    }
    if (!moved) throw Error('Недостатньо завдань для збалансованого пробника.');
  }
  return out;
}

/* Import is validated before replacing either subject store. */
const pBaseNormal = pNormal;
// null is a saved blank single choice; undefined means an invalid or absent draft.
function pDraftSafe(q, v) {
  if (v === null && q.type === 'single') return null;
  if (v === undefined || v === null) return undefined;
  if (q.type === 'single')
    return Number.isInteger(v) && v >= 0 && v < q.options.length ? v : undefined;
  if (q.type === 'numeric')
    return typeof v === 'string' && v.length < 60 && (v === '' || Number.isFinite(pNumber(v)))
      ? v
      : undefined;
  if (!Array.isArray(v)) return undefined;
  if (q.type === 'match')
    return v.length === q.answer.length &&
      v.every(x => Number.isInteger(x) && x >= -1 && x < q.right.length) &&
      new Set(v.filter(x => x >= 0)).size === v.filter(x => x >= 0).length
      ? v
      : undefined;
  if (q.type === 'multi')
    return v.length <= 3 &&
      new Set(v).size === v.length &&
      v.every(x => Number.isInteger(x) && x >= 0 && x < 7)
      ? v
      : undefined;
  return pValid(q, v) ? v : undefined;
}
function pMockCount(subject, variant, fallback) {
  try {
    return pMockSet(subject, Number(variant) || 1).length;
  } catch {
    return fallback;
  }
}
function pCleanAttempt(raw, exam = false) {
  if (
    !raw ||
    !Array.isArray(raw.ids) ||
    !raw.ids.length ||
    new Set(raw.ids).size !== raw.ids.length ||
    !raw.ids.every(id => PM[id]) ||
    typeof raw.answers !== 'object' ||
    !raw.answers ||
    Array.isArray(raw.answers)
  )
    throw Error('Пошкоджений пробний тест у копії.');
  let r = { ...raw, answers: {}, title: String(raw.title || 'Пробний НМТ').slice(0, 200) };
  for (let id of r.ids) {
    let v = pDraftSafe(PM[id], raw.answers[id]);
    if (v !== undefined && v !== null) r.answers[id] = v;
  }
  r.score = r.ids.reduce((s, id) => s + pGrade(PM[id], r.answers[id]), 0);
  r.max = r.ids.reduce((s, id) => s + pMax(PM[id]), 0);
  if (exam) {
    if (!Number.isFinite(r.deadline) || ![1, 2, 'break'].includes(r.stage))
      throw Error('Пошкоджений таймер пробника.');
    if (r.full) {
      let fourth = r.ids.map(id => PM[id].subject).find(s => FOURTH_SUBJECTS.includes(s)) || 'eng',
        n = s => pMockCount(s, r.variant, EXAMINFO[s].count),
        b0 = [n('ukr') + n('math'), 52],
        b1 = [n('hist') + n(fourth), 30 + EXAMINFO[fourth].count];
      if (
        !Array.isArray(r.blocks) ||
        r.blocks.length !== 2 ||
        !b0.includes(r.blocks[0]?.length) ||
        !b1.includes(r.blocks[1]?.length) ||
        JSON.stringify(r.blocks.flat()) !== JSON.stringify(r.ids)
      )
        throw Error('Пошкоджено блоки повної симуляції.');
    } else if (
      !SUB[r.subject] ||
      (!(r.short === true && r.ids.length === 15) &&
        ![pMockCount(r.subject, r.variant, 0), EXAMINFO[r.subject]?.count].includes(r.ids.length))
    )
      throw Error('Некоректний предметний пробник.');
    let current = r.full ? r.blocks[r.stage === 2 ? 1 : 0] : r.ids;
    r.index = Math.max(0, Math.min(current.length - 1, Math.trunc(Number(r.index) || 0)));
  }
  return r;
}
pNormal = function (raw) {
  let n = pBaseNormal(raw);
  for (let [id, v] of Object.entries(n.drafts)) {
    let safe = pDraftSafe(PM[id], v);
    if (safe === undefined) delete n.drafts[id];
    else n.drafts[id] = safe;
  }
  n.records = n.records.flatMap(r => {
    try {
      return [pCleanAttempt(r)];
    } catch {
      return [];
    }
  });
  if (n.exam) {
    try {
      n.exam = pCleanAttempt(n.exam, true);
    } catch {
      n.exam = null;
    }
  }
  return n;
};

function pAnalytics() {
  let aa = pAnswers(),
    done = PQ.filter(q => aa[q.id]),
    right = done.filter(q => aa[q.id].score === aa[q.id].max),
    first = done.reduce((s, q) => s + (aa[q.id].first ?? aa[q.id].score), 0),
    possible = done.reduce((s, q) => s + pMax(q), 0),
    bad = done.filter(q => aa[q.id].score < aa[q.id].max).map(q => q.id);
  $('#main').innerHTML =
    pHeading(
      'Зворотний зв’язок',
      'Твої результати',
      'Прогрес ґрунтується на виконаних завданнях. Перші спроби й виправлені відповіді показано окремо.'
    ) +
    `<div class="p-stat-grid"><article><span>Опрацьовано</span><strong>${done.length}<small> / ${PQ.length}</small></strong></article><article><span>Правильних останніх відповідей</span><strong>${pct(right.length, done.length)}<small>%</small></strong></article><article><span>Бали за першу спробу</span><strong>${first}<small> / ${possible}</small></strong></article><article><span>Потребують розбору</span><strong>${bad.length}</strong></article></div><div class="p-subject-list">${pSubjectRows()}</div><div class="p-actions p-section"><button class="primary" onclick="pReview('wrong')">Повторити завдання з помилками ›</button><button onclick="pReview('due')">Час повторити</button><button onclick="pReview('pins')">Збережені завдання (${P.pins.length})</button><a href="#progress">Деталі з історії ›</a></div><div class="p-section-head"><h2>Теми для повторення</h2></div><div class="p-topic-list">${
      pWeakTopics(bad)
        .slice(0, 12)
        .map(
          x =>
            `<a class="p-topic-row" href="#${x.id.startsWith('hist-') ? 'topic/' + x.id.slice(5) : 'lesson/' + x.id}"><h3>${esc(x.title)}</h3><span>${x.n} невиправлених ›</span></a>`
        )
        .join('') ||
      '<p class="p-empty">Після перших відповідей тут з’являться конкретні теми для повторення.</p>'
    }</div><section class="p-section"><h2>Останні пробники</h2>${
      P.records.length
        ? `<div class="p-topic-list">${[...P.records]
            .reverse()
            .slice(0, 5)
            .map(
              r =>
                `<a class="p-topic-row" href="#result/${r.id}"><h3>${esc(r.title)}</h3><span>${r.score}/${r.max} ›</span></a>`
            )
            .join('')}</div>`
        : '<p class="p-empty">Тут з’являться результати завершених пробних тестів.</p>'
    }</section>${pFoot()}`;
}
const PWEEK = [
  ['Понеділок', 'ukr', 'fourth'],
  ['Вівторок', 'math', 'hist'],
  ['Середа', 'fourth', 'ukr'],
  ['Четвер', 'hist', 'math'],
  ['П’ятниця', 'ukr', 'fourth'],
  ['Субота', 'math', 'hist'],
  ['Неділя', 'review', 'mock'],
];
function pPlan() {
  let week = new Date();
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  let weekid = week.toLocaleDateString('en-CA');
  $('#main').innerHTML =
    pHeading(
      'Розклад підготовки',
      'Твій план на тиждень',
      'План розділяє щоденний час між двома предметами. Якщо день завантажений, попрацюй з одним предметом і повтори 5 помилок.'
    ) +
    `<div class="p-plan-settings"><label for="p-plan-minutes">Час на навчання за день</label><select id="p-plan-minutes" onchange="P.plan.minutes=Number(this.value);pSave();pPlan()">${[20, 30, 45, 60, 90].map(v => `<option value="${v}" ${P.plan.minutes === v ? 'selected' : ''}>${v} хвилин</option>`).join('')}</select><p class="p-caption">Починай після своїх обов’язкових занять. Обери час, коли зможеш зосередитися.</p></div><div class="p-plan-grid">${PWEEK.map(
      ([day, a, b], i) => {
        let k = weekid + '-' + i,
          checked = !!P.plan.days[k],
          mins = Math.floor(P.plan.minutes / 2),
          labels = { review: 'Розбір помилок', mock: 'План на наступний тиждень' },
          res = id => (id === 'fourth' ? subjFourth() : id),
          name = id => SUB[res(id)]?.name || labels[id];
        return `<article class="p-plan-day ${checked ? 'is-complete' : ''}"><div class="p-section-head"><p class="p-kicker">${day}</p><label class="p-check"><input type="checkbox" ${checked ? 'checked' : ''} onchange="pPlanCheck('${k}',this.checked)"> Виконано</label></div><h3>${name(a)}</h3><p>${mins} хв · ${a === 'review' ? 'виправ 5–10 помилок' : '1 правило + 8–12 завдань'}</p><h3>${name(b)}</h3><p>${P.plan.minutes - mins} хв · ${b === 'mock' ? 'переглянь результати й обери дві теми' : 'практика й короткий розбір'}</p><div class="p-actions"><a href="#${a === 'review' ? 'analytics' : 'subject/' + res(a)}">Почати ›</a><a href="#${b === 'mock' ? 'analytics' : 'subject/' + res(b)}">${b === 'mock' ? 'Переглянути прогрес' : SUB[res(b)].short} ›</a></div></article>`;
      }
    ).join(
      ''
    )}</div><div class="p-bottom-grid"><article class="p-feature"><h2>Як працювати з темою</h2><ol class="p-steps"><li>Прочитай конспект і розбери приклад.</li><li>Закрий конспект і поясни правило з пам’яті.</li><li>Виконай 10–15 завдань без підглядання.</li><li>Запиши причину кожної помилки.</li><li>Повернися до складного через кілька днів.</li></ol></article><article class="p-note"><h2>Щотижневий огляд</h2><p>У неділю переглянь прогрес. Обери дві найслабші теми на наступний тиждень. Раз на 1–2 тижні виділи окремий час на пробник. Повну симуляцію не вміщуй у коротке щоденне заняття.</p><a href="#analytics">Відкрити прогрес ›</a></article></div>${pFoot()}`;
}
function pPlanCheck(k, v) {
  P.plan.days[k] = v;
  pSave();
  pPlan();
}
function pFormulaDialog() {
  let s = PSUB.math;
  $('#modalbody').innerHTML =
    `<div class="p-section-head"><h2>Математичний довідник</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><p class="p-caption">Навчальні формули. На справжньому НМТ використовують офіційний довідковий матеріал УЦОЯО.</p>${s.topics.map(t => `<section class="p-rule-block"><h3>${esc(t.title)}</h3>${t.notes.map(n => `<p><strong>${esc(n.title)}.</strong> ${esc(n.text)}</p>`).join('')}</section>`).join('')}<a href="https://testportal.gov.ua/matematyka-2026/" target="_blank" rel="noopener">Офіційні довідкові матеріали ›</a>`;
  $('#modal').showModal();
}
function pLibrary() {
  let sources = PB.flatMap(s => s.sources || []),
    seen = new Set();
  sources = sources.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
  $('#main').innerHTML =
    pHeading(
      'Матеріали для навчання',
      'Довідники та джерела',
      'Тут зібрано конспекти й формули, а також посилання на першоджерела. Авторські вправи допоможуть потренуватися; для незалежної перевірки пройди офіційні демонстраційні варіанти.'
    ) +
    `<div class="p-resource-grid"><article class="p-feature"><h2>Офіційні демоваріанти</h2><p>Чотири предмети, оригінальні завдання й правильні відповіді на сайті Українського центру оцінювання якості освіти.</p><a href="https://testportal.gov.ua/demonstratsijnyj-variant-nmt-2026/" target="_blank" rel="noopener">Відкрити демонстраційні тести ›</a></article><article class="p-note"><h2>Формули та приклади</h2><p>Алгебра, функції, ймовірність, планіметрія й стереометрія. Доступні також під час математичної практики.</p><button onclick="pFormulaDialog()">Відкрити довідник ›</button></article><article class="p-note"><h2>Пам’ятки, персоналії та карти</h2><p>Пам’ятки й мистецтво, персоналії та 11 історичних карт із завданнями.</p><div class="p-actions"><a href="#gallery">Галерея ›</a><a href="#map">Карти ›</a></div></article></div><section class="p-section"><h2>Зміст і межі матеріалів</h2><div class="p-reading"><p>Усі чотири предмети містять авторські навчальні завдання з поясненнями. Історичний банк має 32 теми; нові предмети згруповано за основними розділами шкільної програми. Конспекти допомагають пригадати матеріал перед практикою, але не замінюють повного підручника. Частина математичних завдань варіює числа в межах одного способу розв’язання.</p><p>Пробники відтворюють форми, кількість завдань і тестові бали моделі 2026 року. Їхню складність не калібровано на реальній вибірці учасників. Повний незалежний предметний аудит банку ще не завершено; абсолютної повноти й результату 200 балів платформа не гарантує.</p><p>Офіційні правила НМТ-2027 перевіряй після оприлюднення УЦОЯО. Поточний симулятор позначено як модель 2026 року. Тестові бали переводяться у шкалу 100–200 за таблицями НМТ-2026 (Додаток 5 до Порядку прийому).</p></div></section><div class="p-section-head"><h2>Першоджерела</h2><a href="#sources">Докладні джерела історії ›</a></div><div class="p-topic-list">${[{ title: 'УЦОЯО: основне про НМТ-2026', url: 'https://testportal.gov.ua/osnovne-pro-nmt-2026/' }, ...sources].map(s => `<a class="p-topic-row" href="${esc(s.url)}" target="_blank" rel="noopener"><h3>${esc(s.title)}</h3><span>›</span></a>`).join('')}</div>${pFoot()}`;
}
function pBackupData() {
  return {
    app: 'skladeno',
    version: 1,
    exported: new Date().toISOString(),
    platform: P,
    history: { app: 'istoria200', state: S },
  };
}
function pBackup() {
  let text = JSON.stringify(pBackupData());
  let blob = new Blob([text], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'skladeno-progress-' + pDay() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast('Якщо завантаження заблоковане, скористайся текстовою копією.');
}
function pBackupDialog() {
  let code = JSON.stringify(pBackupData());
  $('#modalbody').innerHTML =
    `<div class="p-section-head"><h2>Резервна копія всіх предметів</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><p>Збережи цей код у власному файлі або встав його на іншому пристрої.</p><label for="p-backup-code">Код резервної копії</label><textarea id="p-backup-code" readonly>${esc(code)}</textarea><button onclick="pCopyBackup()">Копіювати код</button><hr><label for="p-backup-paste">Відновити зі збереженого коду</label><textarea id="p-backup-paste" placeholder="Встав повний код резервної копії"></textarea><button class="primary" onclick="pImportText()">Перевірити й відновити ›</button>`;
  $('#modal').showModal();
}
async function pCopyBackup() {
  try {
    await navigator.clipboard.writeText($('#p-backup-code').value);
    toast('Код скопійовано.');
  } catch {
    $('#p-backup-code').focus();
    $('#p-backup-code').select();
    toast('Натисни Ctrl+C, щоб скопіювати виділений код.');
  }
}
function pRestore(raw) {
  if (raw?.app !== 'skladeno' || raw.version !== 1) throw Error('Це не резервна копія «Складено».');
  let next = pNormal(raw.platform),
    old = normaliseImport(raw.history);
  if (
    !confirm(
      `Відновити ${Object.keys(next.answers).length} нових відповідей і ${Object.keys(old.answers).length} відповідей з історії? Поточний прогрес буде замінено.`
    )
  )
    return false;
  restoreCommit(next, old);
  P = next;
  S = old;
  pStorage = true;
  storageOK = true;
  $('#save-status').textContent = 'Збережено на цьому пристрої';
  $('#storage-error').classList.add('hidden');
  return true;
}
function pImportText() {
  try {
    let raw = JSON.parse($('#p-backup-paste').value);
    if (pRestore(raw)) {
      $('#modal').close();
      go('analytics');
      toast('Усі предмети й історичний прогрес відновлено.');
    }
  } catch (e) {
    toast('Код не прийнято: ' + e.message);
  }
}
function pSettings() {
  let count = Object.keys(P.answers).length + Object.keys(S.answers).length;
  $('#main').innerHTML =
    pHeading(
      'Дані та налаштування',
      'Збереження прогресу',
      'Відповіді зберігаються в цьому браузері на цьому пристрої. Резервна копія дає змогу перенести відповіді з усіх предметів, нотатки, пробники й план.'
    ) +
    `<section class="panel"><h2>${count} збережених відповідей</h2><p class="gap">Створи резервну копію, перш ніж очищати дані браузера або переходити на інший пристрій.</p><div class="p-actions gap"><button class="primary" onclick="pBackup()">Завантажити копію JSON</button><button onclick="pBackupDialog()">Копіювати або вставити код</button><button onclick="$('#p-import-file').click()">Відновити з файлу</button></div></section><section class="panel gap"><h2>Попередній тренажер історії</h2><p class="gap">Відповіді попередньої версії збережено та враховано у спільному прогресі. Для старої резервної копії використай відповідний імпорт.</p><button class="gap" onclick="go('settings')">Налаштування та старі копії історії ›</button></section><section class="panel gap"><h2>Налаштування тексту</h2><label for="p-text-size">Розмір навчального тексту</label><select id="p-text-size" onchange="document.documentElement.style.fontSize=this.value+'px';try{localStorage.setItem('skladeno-font',this.value)}catch(e){}">${[16, 18, 20].map(n => `<option value="${n}" ${pFontSize() === n ? 'selected' : ''}>${n} px</option>`).join('')}</select><p class="p-caption gap">Масштаб браузера також можна змінити клавішами Ctrl + / Ctrl −.</p></section>${pFoot()}`;
}
const oldRender = render;
render = function () {
  let hash = location.hash.slice(1) || 'hub',
    parts = hash.split('/'),
    base = parts[0];
  route = hash;
  if (base === 'result-review' && parts[1] && pRecordView?.id !== parts[1])
    pRecordView = { id: parts[1], index: 0 };
  let pages = {
    hub: () => pHub(),
    subject: () => pSubject(parts[1]),
    lesson: () => pLesson(parts[1]),
    practice: pPractice,
    mocks: () => pMocks(parts[1] || ''),
    simulate: pPractice,
    result: () => pResult(parts[1]),
    'result-review': pPractice,
    analytics: pAnalytics,
    plan: pPlan,
    library: pLibrary,
    preferences: pSettings,
  };
  if (base === 'home') {
    go('hub');
    return;
  }
  if (!pages[base]) {
    oldRender();
    return;
  }
  document
    .querySelectorAll('[data-page]')
    .forEach(a => a.classList.toggle('on', a.dataset.page === base));
  document
    .querySelectorAll('[data-subject]')
    .forEach(a => a.classList.toggle('on', a.dataset.subject === parts[1]));
  $('#crumb').textContent =
    {
      hub: 'Мій простір',
      subject: SUB[parts[1]]?.name || 'Предмет',
      lesson: 'Конспект',
      practice: 'Практика',
      mocks: 'Пробні НМТ',
      simulate: 'Симуляція НМТ',
      result: 'Результат',
      analytics: 'Мій прогрес',
      plan: 'Мій план',
      library: 'Матеріали',
      preferences: 'Налаштування',
    }[base] || 'Складено';
  let allAnswers = pAnswers();
  $('#wrongcount').textContent = PQ.filter(
    q => allAnswers[q.id] && allAnswers[q.id].score < allAnswers[q.id].max
  ).length;
  pages[base]();
  document.title = ($('#crumb').textContent || 'Підготовка до НМТ') + ' · Складено';
};
foot = pFoot;
try {
  const raw = JSON.parse(restoreRead(PKEY) || 'null');
  if (raw) P = pNormal(raw);
  let size = Number(localStorage.getItem('skladeno-font'));
  if ([16, 18, 20].includes(size)) document.documentElement.style.fontSize = size + 'px';
} catch {
  pStorage = false;
  keepCorrupt(PKEY);
}
document.addEventListener('keydown', e => {
  if (
    !['practice', 'simulate', 'result-review'].includes(route.split('/')[0]) ||
    $('#modal').open ||
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
    e.ctrlKey ||
    e.altKey ||
    e.metaKey
  )
    return;
  let q = pQ();
  if (!q) return;
  if (
    /^[1-8]$/.test(e.key) &&
    (typeof hotkeysOn !== 'function' || hotkeysOn()) &&
    ['single', 'multi'].includes(q.type) &&
    Number(e.key) <= q.options.length
  ) {
    e.preventDefault();
    pChoose(Number(e.key) - 1);
  }
  if (e.key === 'Enter' && !['BUTTON', 'A', 'SUMMARY'].includes(e.target.tagName)) {
    e.preventDefault();
    pCheck();
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    pNav(pContext().index + 1);
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    pNav(pContext().index - 1);
  }
});
$('#p-import-file').onchange = async e => {
  let f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    if (f.size > 10 * 1024 * 1024) throw Error('Файл завеликий.');
    if (pRestore(JSON.parse(await f.text()))) {
      go('analytics');
      toast('Прогрес усіх предметів відновлено.');
    }
  } catch (err) {
    toast('Файл не прийнято: ' + err.message);
  }
};

/* History keeps its original store so both interfaces always show the same work. */
function pAnswerRecord(id) {
  return QM[id] ? S.answers[id] : P.answers[id];
}
pAnswers = function () {
  let merged = { ...P.answers };
  for (let [id, a] of Object.entries(S.answers)) merged[id] = a;
  return merged;
};
const pCoreVal = pVal,
  pCoreLocked = pLocked,
  pCoreSet = pSet,
  pCoreCheck = pCheck,
  pCoreRetry = pRetry,
  pCorePin = pPin;
function pHistoryPractice(q) {
  let c = pContext();
  return q?.subject === 'hist' && QM[q.id] && c && !c.exam && !c.record;
}
pVal = function (q) {
  return pHistoryPractice(q)
    ? S.drafts[q.id] !== undefined
      ? S.drafts[q.id]
      : S.answers[q.id]?.value
    : pCoreVal(q);
};
pLocked = function (q) {
  return pHistoryPractice(q)
    ? !!S.answers[q.id] && S.answers[q.id].checked !== false && S.drafts[q.id] === undefined
    : pCoreLocked(q);
};
pSet = function (v, redraw = true) {
  let q = pQ();
  if (!pHistoryPractice(q)) return pCoreSet(v, redraw);
  if (pLocked(q)) return;
  S.drafts[q.id] = v;
  delete P.drafts[q.id];
  save();
  if (redraw) pPractice();
};
pCheck = function () {
  let q = pQ();
  if (!pHistoryPractice(q)) return pCoreCheck();
  if (pLocked(q)) return;
  let v = pVal(q);
  if (q.type === 'order' && v === undefined) v = [0, 1, 2, 3];
  if (!pValid(q, v)) {
    toast(
      q.type === 'match'
        ? 'Заповни всі відповідності.'
        : q.type === 'multi'
          ? 'Обери рівно три відповіді.'
          : 'Спочатку обери відповідь.'
    );
    return;
  }
  let old = S.answers[q.id],
    score = pGrade(q, v),
    attempts = (old?.attempts || 0) + 1;
  S.answers[q.id] = {
    value: structuredClone(v),
    score,
    max: pMax(q),
    first: old?.first ?? score,
    attempts,
    checked: true,
    at: Date.now(),
    due: Date.now() + (score === pMax(q) ? Math.min(14, attempts * 2) * 86400000 : 0),
  };
  delete S.drafts[q.id];
  delete P.answers[q.id];
  delete P.drafts[q.id];
  S.days[pDay()] = (S.days[pDay()] || 0) + 1;
  save();
  pSave();
  pPractice();
};
pRetry = function () {
  let q = pQ();
  if (!pHistoryPractice(q)) return pCoreRetry();
  if (!S.answers[q.id]) return;
  S.answers[q.id].checked = false;
  S.drafts[q.id] =
    q.type === 'single'
      ? null
      : q.type === 'order'
        ? [0, 1, 2, 3]
        : q.type === 'match'
          ? q.left.map(() => -1)
          : [];
  delete P.answers[q.id];
  delete P.drafts[q.id];
  save();
  pPractice();
};
pPin = function () {
  let q = pQ();
  pCorePin();
  if (q?.subject === 'hist') {
    S.pins = P.pins.filter(id => PM[id]?.subject === 'hist');
    save();
  }
};
P.pins = [...new Set([...P.pins, ...S.pins])];

/* Both the menu and the breadcrumb use real links with stable URLs. */
function siteCrumbs() {
  let path = (location.hash.slice(1) || 'hub').split('/'),
    base = path[0],
    root = { label: 'Головна', to: 'hub' },
    hist = { label: 'Історія України', to: 'subject/hist' },
    crumbs = [root],
    subject = id => ({ label: SUB[id]?.name || 'Предмет', to: 'subject/' + id });
  if (base === 'home' || base === 'hub') return [root];
  if (base === 'subject') return [root, subject(path[1])];
  if (base === 'lesson') {
    let t = PT[path[1]],
      q = t && PM[t.questions[0]?.id];
    return t && q ? [root, subject(q.subject), { label: t.title, to: 'lesson/' + t.id }] : [root];
  }
  if (base === 'topic') {
    let t = T[Number(path[1]) - 1];
    return t ? [root, hist, { label: t.title, to: 'topic/' + t.id }] : [root, hist];
  }
  if (base === 'practice' || base === 'quiz') {
    let q = base === 'quiz' ? current() : pQ();
    if (q) {
      let sid = base === 'quiz' ? 'hist' : q.subject,
        t = PT[q.topicId];
      return [
        root,
        subject(sid),
        {
          label:
            base === 'quiz'
              ? T[q.topic - 1]?.title || 'Практика'
              : t?.title || (sid === 'hist' ? T[q.topic - 1]?.title : 'Практика'),
          to:
            base === 'quiz' || sid === 'hist'
              ? 'topic/' + q.topic
              : t
                ? 'lesson/' + t.id
                : 'subject/' + sid,
        },
        { label: 'Завдання', to: base },
      ];
    }
  }
  const labels = {
    'history-archive': 'Архів Освіта.ua',
    mocks: 'Пробні НМТ',
    simulate: 'Пробний тест',
    analytics: 'Прогрес',
    plan: 'Мій план',
    library: 'Матеріали',
    preferences: 'Налаштування',
    gallery: 'Пам’ятки та персоналії',
    map: 'Карти',
    sources: 'Джерела з історії',
    review: 'Повторення історії',
    progress: 'Прогрес з історії',
    exam: 'Пробний тест з історії',
    settings: 'Копії прогресу з історії',
    result: 'Результат пробника',
    'result-review': 'Розбір пробника',
  };
  if (['gallery', 'map', 'sources', 'review', 'exam', 'history-archive'].includes(base))
    crumbs.push(hist);
  if (base === 'progress') crumbs.push({ label: 'Прогрес', to: 'analytics' });
  if (base === 'settings') crumbs.push({ label: 'Налаштування', to: 'preferences' });
  if (['simulate', 'result', 'result-review'].includes(base))
    crumbs.push({ label: 'Пробні НМТ', to: 'mocks' });
  crumbs.push({ label: labels[base] || 'Головна', to: path.join('/') });
  if (base === 'mocks' && SUB[path[1]])
    crumbs.push({ label: SUB[path[1]].name, to: 'mocks/' + path[1] });
  return crumbs.filter((c, i, a) => i === 0 || c.to !== a[i - 1].to);
}
function syncSiteNavigation() {
  let crumbs = siteCrumbs(),
    path = (location.hash.slice(1) || 'hub').split('/'),
    base = path[0],
    active = base === 'home' ? 'hub' : base,
    sid = '';
  if (base === 'subject') sid = path[1];
  else if (base === 'lesson') sid = PM[PT[path[1]]?.questions[0]?.id]?.subject || '';
  else if (
    ['topic', 'quiz', 'gallery', 'map', 'sources', 'review', 'exam', 'history-archive'].includes(
      base
    )
  )
    sid = 'hist';
  else if (base === 'practice') sid = pQ()?.subject || '';
  if (['simulate', 'result', 'result-review'].includes(base)) active = 'mocks';
  if (base === 'progress') active = 'analytics';
  document.querySelectorAll('.nav a').forEach(a => {
    let on = a.dataset.subject ? sid === a.dataset.subject : a.dataset.page === active;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  let el = $('#crumb');
  el.innerHTML = crumbs
    .map(
      (c, i) =>
        `${i ? '<span class="p-crumb-sep" aria-hidden="true">/</span>' : ''}<a href="#${esc(c.to)}" ${i === crumbs.length - 1 ? 'aria-current="page"' : ''}>${esc(c.label)}</a>`
    )
    .join('');
  el.setAttribute('aria-label', 'Шлях по сайту');
  document.title = (crumbs.at(-1)?.label || 'Підготовка до НМТ') + ' · Складено';
}
const navigationRender = render;
render = function () {
  navigationRender();
  syncSiteNavigation();
};
const navigationPractice = pPractice;
pPractice = function () {
  navigationPractice();
  syncSiteNavigation();
};
document.addEventListener('click', e => {
  let a = e.target.closest?.('.nav a,.brand,.sitefoot a,.p-breadcrumb a,.p-mobile-brand');
  if (!a || e.button > 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  let href = a.getAttribute('href');
  if (!href?.startsWith('#') || href === '#') return;
  e.preventDefault();
  go(href.slice(1));
  $('#main').focus({ preventScroll: true });
});
document.addEventListener('keydown', e => {
  if (e.key !== ' ') return;
  let a = e.target.closest?.('.nav a,.p-breadcrumb a');
  if (!a) return;
  e.preventDefault();
  a.click();
});

let HISTORY_GUIDES = Object.fromEntries((DB.historyGuides || []).map(g => [g.topic, g]));
let historyMode = 'guide',
  historyFind = '',
  historyLastTopic = 0,
  historyCatalogFind = '',
  historyArchiveYear = 'all',
  historyArchiveQuery = '';
function historyNormalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’'`ʼ«»„“”]/g, '')
    .replace(/заст(?:ій|ою|оєм)/g, 'заст')
    .replace(/реформ[а-яіїєґ]*/g, 'реформ')
    .replace(/косиг[а-яіїєґ]*/g, 'косиг')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function historyMatches(text, query) {
  let s = historyNormalize(text);
  return historyNormalize(query)
    .split(' ')
    .filter(Boolean)
    .every(w => s.includes(w));
}
function historyTopicText(id) {
  let t = T[id - 1],
    g = HISTORY_GUIDES[id];
  return [
    t.title,
    ...t.facts.map(f => f.label + ' ' + f.text),
    ...(g?.sections || []).map(s => s.title + ' ' + s.text + ' ' + (s.bullets || []).join(' ')),
    ...(g?.tables || []).map(x => x.title + ' ' + x.rows.flat().join(' ')),
    ...(g?.pitfalls || []),
  ].join(' ');
}
function historySection(s) {
  return `<article class="history-section" id="${esc(s.id)}"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>${s.example ? `<p class="p-example">${esc(s.example)}</p>` : ''}${s.bullets?.length ? `<ul>${s.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</article>`;
}
function historyTable(t) {
  return `<section class="history-table"><h2>${esc(t.title)}</h2><div class="tablewrap"><table><thead><tr>${t.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}
function historyScroll(id) {
  document.getElementById(id)?.scrollIntoView({
    behavior:
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
        document.documentElement.dataset.motion !== 'on') ||
      document.documentElement.dataset.motion === 'off'
        ? 'auto'
        : 'smooth',
    block: 'start',
  });
}
function historyGuideUI(id) {
  let g = HISTORY_GUIDES[id],
    t = T[id - 1];
  if (!g) return;
  let sections = g.sections.filter(s =>
      historyMatches(s.title + ' ' + s.text + ' ' + (s.bullets || []).join(' '), historyFind)
    ),
    tables = g.tables.filter(x =>
      historyMatches(x.title + ' ' + x.rows.flat().join(' '), historyFind)
    ),
    facts = t.facts.filter(f => historyMatches(f.label + ' ' + f.text, historyFind));
  let el = $('#topic-content');
  el.innerHTML = `<div class="history-tools"><div class="p-tabs"><button class="${historyMode === 'guide' ? 'is-active' : ''}" onclick="historyMode='guide';historyGuideUI(${id})">Розгорнутий конспект</button><button class="${historyMode === 'cards' ? 'is-active' : ''}" onclick="historyMode='cards';historyGuideUI(${id})">Короткі картки</button><button onclick="setTab('coverage')">Що потрібно вміти</button></div>${HISTORY_GUIDES[id]?.extraQuestionIds?.length ? `<button class="primary" onclick="startHistoryDeep(${id})">Перевірити розуміння ›</button>` : ''}</div><div class="p-search"><input id="history-find" type="search" value="${esc(historyFind)}" placeholder="Знайти реформу, ознаку періоду, причину події…" aria-label="Пошук у повному конспекті"></div>${
    historyMode === 'guide'
      ? `<div class="history-reading-layout"><aside class="history-outline"><p class="p-kicker">У цій темі</p>${g.sections.map(s => `<button onclick="historyScroll('${esc(s.id)}')">${esc(s.title)}</button>`).join('')}<a href="#history-archive">Оригінальні завдання Освіта.ua ›</a></aside><div class="history-reading">${sections.map(historySection).join('')}${tables.map(historyTable).join('')}${g.pitfalls.length && !historyFind ? `<section class="history-pitfalls"><h2>Не переплутай</h2><ul>${g.pitfalls.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section>` : ''}${!sections.length && !tables.length ? '<p class="p-empty">У розгорнутому тексті збігів немає. Перевір короткі картки або зміни запит.</p>' : ''}${historyFind && facts.length ? `<section class="panel"><h2>Збіги у картках (${facts.length})</h2>${facts.map(factCard).join('')}</section>` : ''}<section class="history-next"><h2>Перевір, чи зрозумів матеріал</h2><p>${T[id - 1].questions.length} офіційних завдань ЗНО та НМТ з цієї теми — у тому вигляді, у якому їх отримували учасники. Відповіді зберігаються разом з іншою практикою.</p><button class="primary" onclick="pStart(T[${id}-1].questions,'Офіційні завдання · '+T[${id}-1].title,'t${id}-official')">Розв’язувати офіційні завдання ›</button></section><details class="history-sources"><summary>Джерела та завдання для звіряння</summary><ul>${g.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}${(
          DB.historyCatalog?.themes || []
        )
          .filter(c => c.topics.includes(id))
          .map(
            c =>
              `<li><a href="${esc(c.url)}" target="_blank" rel="noopener">Освіта.ua: ${esc(c.title)}</a></li>`
          )
          .join('')}</ul></details></div></div>`
      : `<div class="panel"><p class="p-caption">${facts.length} карток. Розгорнуті пояснення, таблиці та порівняння містяться в сусідній вкладці.</p>${facts.map(factCard).join('') || '<p class="p-empty">Карток за цим запитом немає.</p>'}</div>`
  }`;
  $('#history-find').oninput = e => {
    historyFind = e.target.value;
    let pos = e.target.selectionStart;
    historyGuideUI(id);
    $('#history-find').focus();
    $('#history-find').setSelectionRange(pos, pos);
  };
}
function historyChecklistStart(ids, title, key) {
  if (ids.every(id => QM[id])) begin(ids, title);
  else pStart(ids, title, 'checklist-' + key);
}
function historyChecklist(id) {
  let g = HISTORY_GUIDES[id];
  if (!g) return '';
  return `<section class="history-checklist"><h2>Що потрібно пояснити й застосувати</h2><p>Для кожного пункту є пояснення та вправи. Лічильник показує перевірені відповіді, а не повноту знань.</p>${g.checklist
    .map(c => {
      let done = c.questionIds.filter(q => {
        let a = pAnswerRecord(q);
        return a && a.checked !== false && a.score === a.max;
      }).length;
      return `<article><div><h3>${esc(c.text)}</h3><p>${done}/${c.questionIds.length} вправ виконано на повний бал</p></div><div class="p-actions"><button onclick="tab='theory';historyMode='guide';historyFind='';topic();historyScroll('${esc(c.sectionIds[0])}')">Прочитати</button><button onclick="historyChecklistStart(${esc(JSON.stringify(c.questionIds))},${esc(JSON.stringify('Самоперевірка · ' + T[id - 1].title))},'${c.id}')">Потренувати</button></div></article>`;
    })
    .join('')}</section>`;
}
function startHistoryDeep(id) {
  let g = HISTORY_GUIDES[id];
  if (g?.extraQuestionIds?.length) {
    if (g.extraQuestionIds.every(id => QM[id]))
      begin(g.extraQuestionIds, 'Розуміння теми · ' + T[id - 1].title, 'learn', 't' + id + '-deep');
    else pStart(g.extraQuestionIds, 'Розуміння теми · ' + T[id - 1].title, 't' + id + '-deep');
  }
}
function historyYear(label) {
  let s = String(label),
    bc = /до\s*(?:н\.?\s*е|нашої\s+ери)/i.test(s),
    m = s.match(/\d+|\b[IVXLCDM]+\b/),
    n;
  if (!m) return Infinity;
  if (/^\d+$/.test(m[0])) n = Number(m[0]);
  else {
    let v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    n = [...m[0]].reduce((sum, c, i, a) => sum + (v[c] < (v[a[i + 1]] || 0) ? -v[c] : v[c]), 0);
  }
  if (/тис|тисячоліт/i.test(s)) n *= 1000;
  else if (/ст\.|століт/i.test(s) && n < 100) n = bc ? n * 100 : (n - 1) * 100 + 1;
  return bc ? -n : n;
}
const historyTopicBase = topic;
topic = function () {
  let id = Number(route.split('/')[1]);
  if (id !== historyLastTopic) {
    historyLastTopic = id;
    historyMode = 'guide';
    historyFind = '';
    tab = 'theory';
  }
  historyTopicBase();
  if (HISTORY_GUIDES[id]) {
    if (tab === 'theory') historyGuideUI(id);
    if (tab === 'coverage')
      $('#topic-content').insertAdjacentHTML('afterbegin', historyChecklist(id));
    if (tab === 'dates') {
      let note = $('#topic-content .notice');
      if (note)
        note.textContent =
          'Орієнтири хронології теми. Для порівняння подій дивись розгорнутий конспект.';
    }
  }
};
function historyFilterRows() {
  let shown = 0;
  document.querySelectorAll('#main .p-topic-row[href^="#topic/"]').forEach(a => {
    let id = Number(a.getAttribute('href').split('/')[1]),
      ok = historyMatches(historyTopicText(id), historyCatalogFind);
    a.hidden = !ok;
    if (ok) shown++;
  });
  let count = $('#history-search-count');
  if (count) count.textContent = 'Знайдено тем: ' + shown;
}
const historySubjectBase = pSubject;
pSubject = function (id) {
  historySubjectBase(id);
  if (id !== 'hist') return;
  let list = $('#main .p-topic-list');
  if (!list) return;
  list.insertAdjacentHTML(
    'beforebegin',
    `<div class="p-search"><input id="history-topic-find" type="search" value="${esc(historyCatalogFind)}" placeholder="Знайти в усіх конспектах: Косигін, мезоліт, земства…" aria-label="Пошук у всіх темах історії"><span id="history-search-count" class="p-caption"></span></div><div class="history-external"><a href="#history-archive">Архів Освіта.ua за роками й темами ›</a><a href="#sources">Зміст і джерела курсу ›</a></div>`
  );
  $('#history-topic-find').oninput = e => {
    historyCatalogFind = e.target.value;
    historyFilterRows();
  };
  historyFilterRows();
};
function historyArchive() {
  let c = DB.historyCatalog;
  if (!c) return;
  let papers = c.papers.filter(
      p =>
        (historyArchiveYear === 'all' || p.year === Number(historyArchiveYear)) &&
        historyMatches(p.title, historyArchiveQuery)
    ),
    themes = c.themes.filter(t => historyMatches(t.title, historyArchiveQuery));
  $('#main').innerHTML =
    pHeading(
      'Історія України / Оригінальні завдання',
      'Архів Освіта.ua',
      'Посилання ведуть на сайт ЗНО-ОНЛАЙН. Власні вправи тренажера й оригінальні завдання з архіву доповнюють одне одного.'
    ) +
    `<div class="history-archive-lead"><div><h2>Усі завдання з історії</h2><p>На момент перевірки каталог Освіта.ua містив ${c.totalQuestionsAtCheck.toLocaleString('uk-UA')} завдання. Перевірено 17 жовтня 2026 року; сайт може доповнювати банк.</p><p>Тексти оригінальних завдань і пояснень не імпортовано. Окремі функції на сайті можуть вимагати реєстрації.</p></div><a class="primary" href="${esc(c.allQuestionsUrl)}" target="_blank" rel="noopener">Відкрити весь банк ›</a></div><div class="p-search"><input id="history-archive-find" type="search" placeholder="Рік або тема…" aria-label="Пошук в архіві" value="${esc(historyArchiveQuery)}"><select id="history-archive-year" aria-label="Рік тесту"><option value="all">Усі роки</option>${[
      ...new Set(c.papers.map(p => p.year)),
    ]
      .sort((a, b) => b - a)
      .map(
        y =>
          `<option ${String(y) === historyArchiveYear ? 'selected' : ''} value="${y}">${y}</option>`
      )
      .join(
        ''
      )}</select></div><section class="history-archive-section"><h2>Тести за роками</h2><div class="history-archive-grid">${papers.map(p => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><strong>${esc(p.title)}</strong><span>Відкрити оригінал ›</span></a>`).join('') || '<p class="p-empty">Тестів за цим запитом немає.</p>'}</div></section><section class="history-archive-section"><h2>Тематичні добірки та візуальні завдання</h2><div class="history-archive-grid">${themes.map(t => `<a href="${esc(t.url)}" target="_blank" rel="noopener"><strong>${esc(t.title)}</strong><span>${stPlural(t.count, 'завдання', 'завдання', 'завдань')} на сайті ›</span></a>`).join('') || '<p class="p-empty">Добірок за цим запитом немає.</p>'}</div></section>${pFoot()}`;
  $('#history-archive-find').oninput = e => {
    historyArchiveQuery = e.target.value;
    let pos = e.target.selectionStart;
    historyArchive();
    $('#history-archive-find').focus();
    $('#history-archive-find').setSelectionRange(pos, pos);
  };
  $('#history-archive-year').onchange = e => {
    historyArchiveYear = e.target.value;
    historyArchive();
  };
}
const historySourcesBase = sources;
sources = function () {
  historySourcesBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    `<section class="history-coverage-summary"><h2>Розгорнуті пояснення за 32 темами</h2><p>До кожного розділу додано порівняння, причинно-наслідкові зв’язки та перелік умінь із вправами. Короткі картки залишаються для повторення.</p><div class="p-actions"><a href="#subject/hist">Перейти до конспектів ›</a><a href="#history-archive">Оригінальні тести Освіта.ua ›</a></div><details><summary>Переглянути склад доповнень</summary><div class="tablewrap"><table><thead><tr><th>Тема</th><th>Розділів конспекту</th><th>Пунктів самоперевірки</th><th>Нових вправ</th></tr></thead><tbody>${(DB.historyGuides || []).map(g => `<tr><td><a href="#topic/${g.topic}">${g.topic}. ${esc(T[g.topic - 1].title)}</a></td><td>${g.sections.length}</td><td>${g.checklist.length}</td><td>${g.extraQuestionIds.length}</td></tr>`).join('')}</tbody></table></div></details><p class="p-caption">Це перелік матеріалів тренажера, а не твердження про поелементну перевірку всіх завдань зовнішнього банку.</p></section>`
  );
};
const historyArchiveRender = render;
render = function () {
  if ((location.hash.slice(1) || 'hub') === 'history-archive') {
    route = 'history-archive';
    historyArchive();
    syncSiteNavigation();
    return;
  }
  historyArchiveRender();
};

/* Advanced practice is separate from model NMT mocks. */
function advancedStart(subject) {
  pStart(
    (DB.advanced || []).filter(q => q.subject === subject).map(q => q.id),
    SUB[subject].name + ' · складна практика',
    'advanced-' + subject
  );
}
function advancedPage() {
  let qs = DB.advanced || [];
  $('#main').innerHTML =
    pHeading(
      'Зрозуміти, а не вгадати',
      'Складна практика',
      'Аналіз умов, кілька кроків розв’язання та висновки з тексту. Ці вправи не використовуються для прогнозу бала НМТ.'
    ) +
    `<div class="p-resource-grid">${AUTHORED_SUBJECTS.map(s => {
      let list = qs.filter(q => q.subject === s.id),
        a = pAnswers(),
        done = list.filter(q => a[q.id]);
      return `<article class="p-note"><p class="p-kicker">${s.name}</p><h2>${stPlural(list.length, 'завдання', 'завдання', 'завдань')}</h2><p>Опрацьовано ${done.length}.</p><button class="primary" onclick="advancedStart('${s.id}')">Почати тренування ›</button></article>`;
    }).join(
      ''
    )}</div><section class="p-section"><h2>Перед складними завданнями</h2><p>Запиши хід думок на папері. Після перевірки порівняй і відповідь, і спосіб розв’язання. Дроби 4/7 та 4/3 вводь як 0,571429 і 1,333333.</p>${(DB.supplements || []).map(n => `<details class="p-rule-block"><summary><strong>${esc(SUB[n.subject].short)} · ${esc(n.title)}</strong></summary><div class="p-reading"><p>${esc(n.text)}</p><p><strong>Приклад.</strong> ${esc(n.example)}</p></div></details>`).join('')}</section><a href="#coverage">Склад матеріалів і межі перевірки ›</a>${pFoot()}`;
}
function coveragePage() {
  let hist = T.map(t => ({
    title: t.title,
    route: 'topic/' + t.id,
    notes: HISTORY_GUIDES[t.id]?.sections.length || 0,
    questions: PQ.filter(q => q.subject === 'hist' && q.topic === t.id).length,
  }));
  $('#main').innerHTML =
    pHeading(
      'Перевірка змісту / 18.10.2026',
      'Що є в програмі',
      'Фактичний склад цього файлу. Кількість тем і вправ сама по собі не доводить повноти покриття офіційної програми.'
    ) +
    `<aside class="p-study-tip"><h2>Предметний аудит ще не завершено</h2><p>Структуру пробників звірено з моделлю НМТ-2026. Поелементна перевірка всіх дат, персоналій, пам’яток, мовних норм та математичних умінь ще потрібна. Правила 2027 року не позначено затвердженими.</p><p>Довідник наголосів охоплює 233 словоформи переліку ЛРЦОЯО, хронологія — 178 програмних орієнтирів, портретна добірка — 54 діячі. Ще потрібна повна звірка правописних винятків, англійських лексичних тем, усіх підкреслених персоналій, пам’яток і географічних орієнтирів. Наявність матеріалу не означає, що його достатність уже перевірена.</p><a href="https://testportal.gov.ua/programy-nmt/" target="_blank" rel="noopener">Офіційні програми УЦОЯО ›</a></aside>${SUBJECTS.map(
      s => {
        let rows =
          s.id === 'hist'
            ? hist
            : PSUB[s.id].topics.map(t => ({
                title: t.title,
                route: 'lesson/' + t.id,
                notes: t.notes.length,
                questions: t.questions.length,
              }));
        return `<section class="p-section"><h2>${s.name}</h2><div class="tablewrap"><table><thead><tr><th>Розділ</th><th>Блоків конспекту</th><th>Вправ у темі</th></tr></thead><tbody>${rows.map(t => `<tr><td><a href="#${t.route}">${esc(t.title)}</a></td><td>${t.notes}</td><td>${t.questions}</td></tr>`).join('')}</tbody></table></div><p>Окремо: ${(DB.advanced || []).filter(q => q.subject === s.id).length} нових вправ складної практики.</p></section>`;
      }
    ).join(
      ''
    )}<section class="p-section"><h2>Як працювати з одним файлом</h2><ol><li>Збережи HTML на пристрій і відкрий у браузері. Переглядач вкладень може не виконувати скрипти.</li><li>Конспекти, вправи, ілюстрації, формули, 7 довідкових PDF, 4 офіційні демоваріанти 2026 з умовами, ключами й авторськими розборами та 4 тести НМТ-2025 з умовами й ключами вбудовано. Інші матеріали зовнішніх архівів за посиланнями потребують інтернету.</li><li>Прогрес зберігається в браузері, а не всередині HTML. Перед перенесенням або перейменуванням файлу експортуй резервну копію.</li><li>Перевір експорт та імпорт на своєму пристрої. Якщо браузер обмежує локальне сховище або завантаження JSON, користуйся текстовим кодом резервної копії.</li></ol><a href="#preferences">Зробити резервну копію ›</a></section>${pFoot()}`;
}
const advancedRenderBase = render;
render = function () {
  let base = location.hash.slice(1) || 'hub';
  if (['advanced', 'coverage'].includes(base)) {
    route = base;
    base === 'advanced' ? advancedPage() : coveragePage();
    syncSiteNavigation();
    return;
  }
  advancedRenderBase();
};
const advancedCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  let base = location.hash.slice(1);
  if (['advanced', 'coverage'].includes(base))
    return [
      { label: 'Мій простір', to: 'hub' },
      { label: base === 'advanced' ? 'Складна практика' : 'Склад матеріалів', to: base },
    ];
  return advancedCrumbsBase();
};
const advancedLibraryBase = pLibrary;
pLibrary = function () {
  advancedLibraryBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<div class="p-actions p-section"><a class="primary" href="#advanced">Складна практика ›</a><a href="#coverage">Склад матеріалів і автономна робота ›</a></div>'
  );
};

/* Every unit records the precise bounded gap, its lesson, and its practice IDs. */
function auditPractice(id) {
  let u = [...DB.auditUnits, ...(DB.syllabusUnits || [])].find(u => u.id === id);
  if (u) pStart(u.questionIds, u.title, 'audit-' + id);
}
function auditPDF(id, download = false) {
  let d = DB.officialDocs.find(d => d.id === id);
  if (!d) return;
  if (!d.data.startsWith('data:')) {
    if (download) {
      let a = document.createElement('a');
      a.href = d.data;
      a.download = 'ucoyao-' + id + '.pdf';
      a.click();
    } else window.open(d.data, '_blank');
    return;
  }
  let raw = atob(d.data.slice(d.data.indexOf(',') + 1)),
    bytes = Uint8Array.from(raw, c => c.charCodeAt(0)),
    url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  if (download) {
    let a = document.createElement('a');
    a.href = url;
    a.download = 'ucoyao-' + id + '.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    let opened = window.open(url, '_blank');
    if (!opened) toast('Браузер не відкрив PDF. Скористайся кнопкою «Зберегти PDF».');
    setTimeout(() => URL.revokeObjectURL(url), 300000);
  }
}
function auditPage(subject = '') {
  let units = [...(DB.auditUnits || []), ...(DB.syllabusUnits || [])].filter(
      u => !subject || u.subject === subject
    ),
    answers = pAnswers();
  $('#main').innerHTML =
    pHeading(
      'Звірка змісту та доповнення',
      'Поглиблені конспекти',
      'Тут зібрано конкретні прогалини коротких конспектів, пояснення та вправи для перевірки. Це завершений етап доповнення, а не висновок про повну безпомилковість курсу.'
    ) +
    `<section class="p-section"><h2>Офіційні документи всередині файлу</h2><p>Сім оригінальних PDF від УЦОЯО, ЛРЦОЯО та МОН, зокрема правопис 2026 року й повний перелік наголосів. В автономному HTML вони вбудовані й доступні без інтернету; на сайті відкриваються окремими файлами. Відкрий у браузері або збережи окремо. Програми задають обсяг матеріалу; вони не замінюють підручник. Формат пробників поки відповідає НМТ-2026.</p><div class="p-resource-grid">${DB.officialDocs.map(d => `<article class="p-note"><h3>${esc(d.title)}</h3><p>${esc(d.note)}</p><div class="p-actions"><button onclick="auditPDF('${d.id}')">Відкрити PDF</button><button onclick="auditPDF('${d.id}',true)">Зберегти PDF</button></div><a class="p-caption" href="${esc(d.url)}" target="_blank" rel="noopener">Офіційне джерело ›</a></article>`).join('')}</div></section><div class="p-tabs">${[['', 'Усі предмети'], ...AUTHORED_SUBJECTS.map(s => [s.id, s.short])].map(([id, label]) => `<a href="#audit${id ? '/' + id : ''}" class="${id === subject ? 'is-active' : ''}">${label}</a>`).join('')}</div><section class="p-section">${units
      .map(u => {
        let done = u.questionIds.filter(id => answers[id]),
          ok = done.filter(id => answers[id].score === answers[id].max);
        return `<article class="p-rule-block"><p class="p-kicker">${SUB[u.subject].name} · предметна перевірка</p><h2>${esc(u.title)}</h2><p><strong>Що доповнено.</strong> ${esc(u.gap)}</p><details><summary>Прочитати пояснення та приклади</summary><div class="p-reading">${u.notes.map(n => `<h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><div class="p-example"><p>${esc(n.example)}</p></div>`).join('')}</div></details><p class="p-caption">${u.questionIds.length} вправ · опрацьовано ${done.length} · правильно ${ok.length}. Перевірено пояснення й ключі цієї добірки; повноту всього розділу ще не засвідчено.</p><div class="p-actions">${u.questionIds.length ? `<button class="primary" onclick="auditPractice('${u.id}')">Перевірити знання ›</button>` : ''}<a href="#${u.subject === 'hist' ? 'topic/' + u.topicId.slice(5) : 'lesson/' + u.topicId}">До основної теми ›</a></div></article>`;
      })
      .join('')}</section>${pFoot()}`;
}
const curriculumRender = render;
render = function () {
  let parts = (location.hash.slice(1) || 'hub').split('/');
  if (parts[0] === 'audit') {
    route = parts.join('/');
    auditPage(SUB[parts[1]] ? parts[1] : '');
    syncSiteNavigation();
    return;
  }
  curriculumRender();
};
const curriculumCrumbs = siteCrumbs;
siteCrumbs = function () {
  let p = location.hash.slice(1).split('/');
  return p[0] === 'audit'
    ? [
        { label: 'Мій простір', to: 'hub' },
        { label: 'Поглиблені конспекти', to: 'audit' },
        ...(SUB[p[1]] ? [{ label: SUB[p[1]].name, to: p.join('/') }] : []),
      ]
    : curriculumCrumbs();
};
const curriculumLibrary = pLibrary;
pLibrary = function () {
  curriculumLibrary();
  let units = [...DB.auditUnits, ...DB.syllabusUnits];
  $('#main').insertAdjacentHTML(
    'afterbegin',
    `<section class="p-alert"><div><h2>Офіційні програми та поглиблені пояснення</h2><p>${units.length} доповнених блоків, ${units.reduce((n, u) => n + u.questionIds.length, 0)} вправ і ${DB.officialDocs.length} довідкових PDF. В автономному файлі все доступне без інтернету.</p></div><a class="primary" href="#audit">Відкрити ›</a></section>`
  );
};
const curriculumCoverage = coveragePage;
coveragePage = function () {
  curriculumCoverage();
  let units = [...DB.auditUnits, ...DB.syllabusUnits];
  $('#main').insertAdjacentHTML(
    'afterbegin',
    `<section class="p-alert"><div><h2>Предметна звірка та доповнення</h2><p>Додано ${units.length} конкретних блоків пояснень та ${units.reduce((n, u) => n + u.questionIds.length, 0)} пов’язаних вправ. Оригінальні програми чотирьох предметів усередині автономного файлу. Повна перевірка кожного пункту програми ще не завершена.</p></div><a href="#audit">Переглянути доповнення ›</a></section>`
  );
};
const curriculumFormulas = pFormulaDialog;
pFormulaDialog = function () {
  curriculumFormulas();
  $('#modalbody').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-rule-block"><h3>Офіційний довідник УЦОЯО</h3><p>Оригінальний PDF УЦОЯО. Для роботи без інтернету збережи його або відкрий автономну версію тренажера.</p><button onclick="auditPDF(\'formulas\')">Відкрити офіційний довідник ›</button></section>'
  );
};

/* Authored coverage and official certification are intentionally separate states. */
function qualityPage(sid = '') {
  let rows = DB.quality.items.filter(x => !sid || x.subject === sid),
    aa = pAnswers(),
    done = rows.filter(
      x => x.questionIds.length && x.questionIds.every(id => aa[id] && aa[id].score === aa[id].max)
    ).length;
  $('#main').innerHTML =
    pHeading(
      'Перевірка повноти',
      'Карта навчальних умінь',
      'Карта показує зв’язок наших конспектів і вправ. Звірка кожної вимоги офіційної програми ще триває; кількість виконаних вправ не засвідчує повне покриття програми.'
    ) +
    `<div class="p-tabs">${[['', 'Усі'], ...AUTHORED_SUBJECTS.map(s => [s.id, s.short])].map(([id, label]) => `<a href="#quality${id ? '/' + id : ''}" class="${id === sid ? 'is-active' : ''}">${label}</a>`).join('')}</div><div class="p-stat-grid"><article><span>Умінь у карті</span><strong>${rows.length}</strong></article><article><span>Вправи виконано правильно</span><strong>${done}</strong></article><article><span>Без підібраної практики</span><strong>${rows.filter(x => !x.questionIds.length).length}</strong></article><article><span>Звірено з усіма вимогами УЦОЯО</span><strong>0</strong></article></div><section class="p-section"><h2>Що вже перевірено</h2><p>${DB.quality.bank.total} навчальних завдань: унікальні ідентифікатори, допустимі ключі, відсутність однакових варіантів усередині завдання та робочі посилання. ${DB.quality.bank.families.length} груп подібних формулювань позначено для подальшого урізноманітнення. Ці технічні перевірки не доводять предметної правильності ключів.</p><a href="#audit">Відкрити офіційні програми та вже доповнені блоки ›</a></section><section class="p-section">${DB.quality.topics
      .filter(t => (sid ? t.subject === sid : AUTHORED_SUBJECTS.some(s => s.id === t.subject)))
      .map(
        t =>
          `<details class="p-rule-block"><summary>${esc(t.title)} · ${t.questions.length} вправ</summary>${rows
            .filter(x => x.topicId === t.id)
            .map(x => {
              let ids = x.questionIds,
                ok = ids.filter(id => aa[id] && aa[id].score === aa[id].max).length;
              return `<article class="p-note"><h3>${esc(x.title)}</h3><p>${ids.length ? `${ok}/${ids.length} підібраних вправ виконано правильно` : 'Практику ще не підібрано; це не висновок про відсутність вправ у банку.'}</p><p class="p-caption">${x.linkMethod === 'explicit' ? 'Зв’язок із вправами задано вручну.' : 'Попередній добір за текстом: потрібна предметна перевірка зв’язку.'} Відповідність офіційній програмі: перевірка триває.</p><div class="p-actions"><a href="#${x.lesson}">Конспект ›</a>${ids.length ? `<button onclick="qualityPractice('${x.id}')">Підібрані вправи ›</button>` : ''}</div></article>`;
            })
            .join('')}</details>`
      )
      .join('')}</section>${pFoot()}`;
}
function qualityPractice(id) {
  let x = DB.quality.items.find(x => x.id === id);
  if (x?.questionIds.length) pStart(x.questionIds, x.title, 'skill-' + id);
}
const qualityRender = render;
render = function () {
  let p = location.hash.slice(1).split('/');
  if (p[0] === 'quality') {
    route = p.join('/');
    qualityPage(SUB[p[1]] ? p[1] : '');
    syncSiteNavigation();
    return;
  }
  qualityRender();
};
const qualityCrumbs = siteCrumbs;
siteCrumbs = function () {
  return location.hash.startsWith('#quality')
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Карта умінь', to: 'quality' },
      ]
    : qualityCrumbs();
};
const qualityCoverage = coveragePage;
coveragePage = function () {
  qualityCoverage();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Карта умінь і статус перевірки</h2><p>У кожної теми видно конспект, пов’язані вправи й незавершені перевірки.</p></div><a class="primary" href="#quality">Переглянути карту ›</a></section>'
  );
};

/* A transparent study route, separate checkpoints, and delayed retrieval practice. */
const CB = Obj0((DB.controlBank || []).map(q => [q.id, q]));
const COACH_REASONS = {
  knowledge: 'Не знав правила або факту',
  reading: 'Неправильно прочитав умову',
  method: 'Не знайшов спосіб розв’язання',
  calculation: 'Помилка в обчисленні',
  attention: 'Неуважність',
  time: 'Забракло часу',
};
function coachFresh() {
  return { items: {}, events: [], control: null, results: [] };
}
const coachFreshBase = pFresh;
pFresh = function () {
  return { ...coachFreshBase(), coach: coachFresh() };
};
function coachCleanControl(r) {
  if (
    !r ||
    !Array.isArray(r.ids) ||
    ![8, 32].includes(r.ids.length) ||
    new Set(r.ids).size !== r.ids.length ||
    !r.ids.every(id => CB[id]) ||
    !Number.isFinite(r.started) ||
    !Number.isFinite(r.deadline) ||
    r.deadline <= r.started ||
    r.deadline - r.started > 3600000 ||
    !r.answers ||
    typeof r.answers !== 'object' ||
    Array.isArray(r.answers)
  )
    throw Error('Пошкоджено контрольний зріз.');
  let subjects = new Set(r.ids.map(id => CB[id].subject));
  if ((r.ids.length === 8 && subjects.size !== 1) || (r.ids.length === 32 && subjects.size !== 4))
    throw Error('Неповний склад контрольної добірки.');
  let answers = {};
  for (let [id, v] of Object.entries(r.answers)) {
    if (!r.ids.includes(id) || !pValid(CB[id], v))
      throw Error('Пошкоджено відповідь контрольного зрізу.');
    answers[id] = v;
  }
  let n = {
    ids: [...r.ids],
    answers,
    started: r.started,
    deadline: r.deadline,
    index: Math.max(0, Math.min(r.ids.length - 1, Math.trunc(Number(r.index) || 0))),
    finished: Number.isFinite(r.finished) && r.finished >= r.started ? r.finished : null,
  };
  return n;
}
function coachNormal(raw) {
  let n = coachFresh();
  if (raw === undefined) return n;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw Error('Пошкоджено дані маршруту.');
  for (let [id, v] of Object.entries(raw.items || {})) {
    if (!PM[id]) continue;
    if (!v || typeof v !== 'object') continue;
    n.items[id] = {
      reason: COACH_REASONS[v.reason] ? v.reason : '',
      streak: Math.max(0, Math.min(5, Math.trunc(Number(v.streak) || 0))),
      lastDay: /^\d{4}-\d{2}-\d{2}$/.test(v.lastDay) ? v.lastDay : '',
      confidence: [1, 2, 3].includes(v.confidence) ? v.confidence : 0,
    };
  }
  if (!Array.isArray(raw.events) || !Array.isArray(raw.results))
    throw Error('Пошкоджено журнал маршруту.');
  n.events = raw.events.slice(-2000).flatMap(e =>
    !e ||
    !PM[e.id] ||
    !Number.isFinite(e.at) ||
    !Number.isInteger(e.score) ||
    e.score < 0 ||
    e.score > pMax(PM[e.id])
      ? []
      : [
          {
            id: e.id,
            at: e.at,
            score: e.score,
            max: pMax(PM[e.id]),
            confidence: [1, 2, 3].includes(e.confidence) ? e.confidence : 0,
          },
        ]
  );
  if (raw.control)
    try {
      n.control = coachCleanControl(raw.control);
    } catch {}
  n.results = raw.results.slice(-30).flatMap(r => {
    try {
      let c = coachCleanControl(r);
      return c.finished ? [c] : [];
    } catch {
      return [];
    }
  });
  return n;
}
const coachNormalBase = pNormal;
pNormal = function (raw) {
  let n = coachNormalBase(raw);
  n.coach = coachNormal(raw.coach);
  return n;
};
// Earlier migration layers have already loaded the old stores; load the added state before first render.
try {
  let original = JSON.parse(localStorage.getItem(PKEY) || 'null');
  P.coach = coachNormal(original?.coach);
} catch {
  P.coach = coachFresh();
  pStorage = false;
  keepCorrupt(PKEY);
}
function coachItem(id) {
  return (
    P.coach.items[id] || (P.coach.items[id] = { reason: '', streak: 0, lastDay: '', confidence: 0 })
  );
}
function coachConfidence(id, value) {
  if (!PM[id] || ![1, 2, 3].includes(value)) return;
  coachItem(id).confidence = value;
  pSave();
  pPractice();
}
function coachReason(id, value) {
  if (!PM[id] || !COACH_REASONS[value]) return;
  coachItem(id).reason = value;
  pSave();
  pPractice();
}
const coachCheckBase = pCheck;
pCheck = function () {
  let q = pQ(),
    cx = pContext();
  if (!q || !cx || cx.exam || cx.record || pLocked(q)) return coachCheckBase();
  let previous = pAnswerRecord(q.id)?.attempts || 0;
  coachCheckBase();
  let a = pAnswerRecord(q.id);
  if (!a || (a.attempts || 0) <= previous) return;
  let x = coachItem(q.id),
    good = a.score === a.max,
    day = pDay();
  if (good && x.lastDay !== day) {
    x.streak = Math.min(5, x.streak + 1);
    x.lastDay = day;
  } else if (!good) {
    x.streak = 0;
    x.lastDay = '';
  }
  P.coach.events.push({
    id: q.id,
    at: Date.now(),
    score: a.score,
    max: a.max,
    confidence: x.confidence,
  });
  P.coach.events = P.coach.events.slice(-2000);
  if (QM[q.id]) save();
  pSave();
};
const coachPracticeBase = pPractice;
pPractice = function () {
  coachPracticeBase();
  let q = pQ(),
    cx = pContext();
  if (!q || !cx || cx.exam || cx.record) return;
  if (q.diagram) $('#p-answer-area').insertAdjacentHTML('beforebegin', coachDiagram(q, pLocked(q)));
  let a = pAnswerRecord(q.id),
    locked = pLocked(q),
    x = P.coach.items[q.id] || { reason: '', streak: 0, lastDay: '', confidence: 0 };
  $('#p-answer-area').insertAdjacentHTML(
    locked ? 'afterend' : 'beforebegin',
    `<section class="p-section"><h2>${locked ? 'Закріплення знань' : 'Оціни впевненість перед відповіддю'}</h2>${
      locked
        ? `<p>${uiDueText(a.due)}</p>${
            a.score < a.max
              ? `<p>Що спричинило помилку? Це твоя оцінка, а не автоматичний діагноз.</p><div class="p-actions">${Object.entries(
                  COACH_REASONS
                )
                  .map(
                    ([id, label]) =>
                      `<button ${x.reason === id ? 'class="primary" aria-pressed="true"' : 'aria-pressed="false"'} onclick="coachReason('${q.id}','${id}')">${label}</button>`
                  )
                  .join(
                    ''
                  )}</div><p><a href="#${q.subject === 'hist' ? 'topic/' + q.topicId.slice(5) : 'lesson/' + q.topicId}">Повернутися до пояснення теми ›</a></p>`
              : '<p>Повторення в той самий день не подовжує інтервал.</p>'
          }`
        : `<div class="p-actions">${[
            [1, 'Припускаю'],
            [2, 'Маю сумніви'],
            [3, 'Впевнений'],
          ]
            .map(
              ([v, l]) =>
                `<button aria-pressed="${x.confidence === v}" ${x.confidence === v ? 'class="primary"' : ''} onclick="coachConfidence('${q.id}',${v})">${l}</button>`
            )
            .join('')}</div>`
    }</section>`
  );
};
// The text description reads the figure aloud, so sighted users see it only after answering; screen readers always get it.
function coachDiagram(q, reveal = false) {
  return `<figure class="p-note"><svg viewBox="0 0 360 270" role="img" aria-label="${esc(q.diagram.description)}" class="u-diagram">${q.diagram.body}</svg>${reveal ? `<figcaption>${esc(q.diagram.description)}</figcaption>` : ''}</figure>`;
}
// Diagrams also appear in timed model tests and result review, without exposing keys.
const coachAnswerBase = pAnswerHTML;
pAnswerHTML = function (q, v, show) {
  return (
    (q.diagram && (pContext()?.exam || pContext()?.record)
      ? coachDiagram(q, !!pContext()?.record)
      : '') + coachAnswerBase(q, v, show)
  );
};
function coachScore(r) {
  return r.ids.reduce((s, id) => s + (r.answers[id] === CB[id].answer ? 1 : 0), 0);
}
function coachStart(sid = '') {
  if (P.coach.control && !confirm('Замінити незавершений контрольний зріз?')) return;
  let on = subjActive().map(s => s.id),
    ids = DB.controlBank
      .filter(q => (sid ? q.subject === sid : on.includes(q.subject)))
      .map(q => q.id);
  if (![8, 32].includes(ids.length)) return;
  let used = P.coach.results.some(r => r.ids.some(id => ids.includes(id)));
  if (
    used &&
    !confirm(
      'Ця добірка вже була пройдена: повторний результат залежить від знайомства із завданнями. Почати повторно?'
    )
  )
    return;
  let now = Date.now();
  P.coach.control = {
    ids,
    answers: {},
    index: 0,
    started: now,
    deadline: now + (sid ? 1200000 : 3600000),
    finished: null,
  };
  pSave();
  go('checkpoint');
}
function coachControlSet(v) {
  let r = P.coach.control;
  if (!r || r.finished) return;
  if (Date.now() >= r.deadline) {
    coachFinish(true);
    return;
  }
  let q = CB[r.ids[r.index]];
  if (pValid(q, v)) r.answers[q.id] = v;
  pSave();
  coachCheckpoint();
}
function coachControlNav(i) {
  let r = P.coach.control;
  if (!r) return;
  r.index = Math.max(0, Math.min(r.ids.length - 1, i));
  pSave();
  coachCheckpoint();
}
function coachFinish(auto = false) {
  let r = P.coach.control;
  if (!r || r.finished) return;
  if (
    !auto &&
    !confirm(
      `Завершити зріз? Заповнено ${Object.keys(r.answers).length} із ${r.ids.length}. Після завершення відповіді змінити не можна.`
    )
  )
    return;
  r.finished = Date.now();
  P.coach.results.push(structuredClone(r));
  P.coach.results = P.coach.results.slice(-30);
  P.coach.control = null;
  pSave();
  go('checkpoint-result/' + (P.coach.results.length - 1));
}
function coachCheckpoint() {
  let r = P.coach.control;
  if (!r) {
    go('coach');
    return;
  }
  if (Date.now() >= r.deadline) {
    coachFinish(true);
    return;
  }
  let q = CB[r.ids[r.index]],
    v = r.answers[q.id];
  $('#main').innerHTML =
    pHeading(
      'Окрема добірка',
      'Діагностичний зріз',
      `${r.index + 1} із ${r.ids.length} · ${SUB[q.subject].name}. Ключі відкриються після завершення.`
    ) +
    `<p class="p-timer" id="coach-clock" role="timer">Залишилось ${Math.ceil((r.deadline - Date.now()) / 60000)} хв</p><section class="p-section"><h2>${esc(q.prompt)}</h2><div class="p-options" role="radiogroup" aria-label="Варіанти відповіді">${q.options.map((o, i) => `<button class="p-option ${v === i ? 'is-selected' : ''}" role="radio" aria-checked="${v === i}" onclick="coachControlSet(${i})"><span>${String.fromCharCode(65 + i)}</span><span>${esc(o)}</span></button>`).join('')}</div><div class="p-actions"><button ${r.index === 0 ? 'disabled' : ''} onclick="coachControlNav(${r.index - 1})">← Назад</button><button ${r.index === r.ids.length - 1 ? 'disabled' : ''} onclick="coachControlNav(${r.index + 1})">Далі ›</button><button onclick="coachFinish()">Завершити зріз</button></div><div class="qnav">${r.ids.map((id, i) => `<button class="${r.answers[id] !== undefined ? 'draft' : ''} ${r.index === i ? 'current' : ''}" aria-label="Завдання ${i + 1}" onclick="coachControlNav(${i})">${i + 1}</button>`).join('')}</div></section>${pFoot()}`;
}
function coachResult(index) {
  let r = P.coach.results[Number(index)];
  if (!r) {
    go('coach');
    return;
  }
  let prior = P.coach.results
    .slice(0, Number(index))
    .some(x => x.ids.some(id => r.ids.includes(id)));
  $('#main').innerHTML =
    pHeading(
      'Розбір діагностики',
      `${coachScore(r)} із ${r.ids.length}`,
      'Це невеликий навчальний зріз з однією правильною відповіддю, а не повний варіант НМТ чи прогноз бала 100–200.'
    ) +
    `<p>${prior ? 'Цю добірку вже проходили: результат повторний.' : 'Перше проходження цієї добірки.'}</p><a class="primary" href="#coach">До маршруту підготовки ›</a><section class="p-section">${r.ids
      .map((id, i) => {
        let q = CB[id],
          v = r.answers[id];
        return `<article class="p-rule-block"><p class="p-kicker">${i + 1}. ${SUB[q.subject].name} · ${v === q.answer ? 'Правильно' : v === undefined ? 'Без відповіді' : 'Помилка'}</p><h2>${esc(q.prompt)}</h2><p>Твоя відповідь: ${v === undefined ? 'не подано' : esc(q.options[v])}</p><p><strong>Правильна відповідь:</strong> ${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p><a href="#${q.subject === 'hist' ? 'topic/' + q.topicId.slice(5) : 'lesson/' + q.topicId}">Опрацювати тему ›</a></article>`;
      })
      .join('')}</section>${pFoot()}`;
}
function coachTopicRanks() {
  let aa = pAnswers(),
    latest = {};
  for (let r of P.coach.results)
    for (let sid of new Set(r.ids.map(id => CB[id].subject))) latest[sid] = r;
  return DB.quality.topics
    .map(t => {
      let last = latest[t.subject],
        questions = t.questions.map(id => PM[id]).filter(Boolean),
        answered = questions.filter(q => aa[q.id]),
        wrong = answered.filter(q => aa[q.id].score < aa[q.id].max),
        due = answered.filter(q => aa[q.id].due <= Date.now()),
        controlBad = last
          ? last.ids.filter(id => CB[id].topicId === t.id && last.answers[id] !== CB[id].answer)
              .length
          : 0;
      return {
        ...t,
        sequence: DB.quality.topics
          .filter(x => x.subject === t.subject)
          .findIndex(x => x.id === t.id),
        answered: answered.length,
        wrong: wrong.length,
        due: due.length,
        controlBad,
        priority: controlBad * 8 + wrong.length * 3 + due.length + (answered.length ? 0 : 2),
      };
    })
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.answered - b.answered ||
        a.sequence - b.sequence ||
        SUBJECTS.findIndex(s => s.id === a.subject) - SUBJECTS.findIndex(s => s.id === b.subject)
    );
}
function coachRouteIds(limit = 16) {
  let aa = pAnswers(),
    rank = coachTopicRanks(),
    ids = [],
    seen = new Set();
  function take(q) {
    let family = q.subject + '|' + q.prompt.replace(/[−+-]?\d+(?:[.,]\d+)?/g, '#');
    if (!seen.has(family)) {
      seen.add(family);
      ids.push(q.id);
    }
  }
  for (let sid of subjActive().map(s => s.id)) {
    let ts = rank.filter(t => t.subject === sid);
    for (let t of ts) {
      let qs = t.questions
        .map(id => PM[id])
        .filter(q => q && !q.challenge)
        .sort((a, b) => {
          let score = q =>
            aa[q.id] ? (aa[q.id].score < aa[q.id].max ? 0 : aa[q.id].due <= Date.now() ? 1 : 3) : 2;
          return score(a) - score(b);
        });
      let q = qs.find(
        q => !aa[q.id] || aa[q.id].score < aa[q.id].max || aa[q.id].due <= Date.now()
      );
      if (q) take(q);
      if (ids.filter(id => PM[id].subject === sid).length >= limit / 4) break;
    }
  }
  return ids.slice(0, limit);
}
function coachPrepareRecall(id) {
  let q = PM[id];
  if (!q || !pAnswerRecord(id)) return;
  let draft =
    q.type === 'single'
      ? null
      : q.type === 'numeric'
        ? ''
        : q.type === 'match'
          ? q.answer.map(() => -1)
          : q.type === 'order'
            ? [0, 1, 2, 3]
            : [];
  if (QM[id]) {
    S.answers[id].checked = false;
    S.drafts[id] = draft;
  } else P.drafts[id] = draft;
}
const coachReviewBase = pReview;
pReview = function (mode = 'wrong', subject = '') {
  if (mode !== 'pins') {
    let aa = pAnswers();
    for (let q of PQ)
      if (
        (!subject || q.subject === subject) &&
        aa[q.id] &&
        (mode === 'due' ? aa[q.id].due <= Date.now() : aa[q.id].score < aa[q.id].max)
      )
        coachPrepareRecall(q.id);
    save();
    pSave();
  }
  return coachReviewBase(mode, subject);
};
function coachLaunch() {
  let ids = coachRouteIds();
  if (!ids.length) {
    toast('Усі підібрані вправи виконано. Обери нову тему або дочекайся повторення.');
    return;
  }
  for (let id of ids) coachPrepareRecall(id);
  save();
  pSave();
  pStart(ids, 'Заняття за поточними прогалинами', 'coach-route');
}
function coachPage() {
  let on = subjActive().map(s => s.id),
    ranks = coachTopicRanks().filter(t => on.includes(t.subject) || t.answered),
    aa = pAnswers(),
    due = PQ.filter(q => aa[q.id]?.due <= Date.now()).length,
    confidentWrong = P.coach.events.filter(e => e.confidence === 3 && e.score < e.max).length,
    reasons = Object.entries(COACH_REASONS).map(([id, label]) => ({
      label,
      n: Object.values(P.coach.items).filter(x => x.reason === id).length,
    }));
  $('#main').innerHTML =
    pHeading(
      'Твій наступний крок',
      'Маршрут підготовки',
      'Порядок тем змінюється за помилками, строками повторення й останнім контрольним зрізом кожного предмета. Нові теми також потрапляють до заняття.'
    ) +
    `<div class="p-actions"><button class="primary" onclick="coachLaunch()">Почати заняття з 4 предметів ›</button><button onclick="pReview('due')">Повторити за строком (${due})</button><a href="#quality">Карта умінь ›</a></div><section class="p-section"><h2>Спочатку перевір себе</h2><p>32 окремі завдання, яких немає в навчальному банку: по 8 із кожного предмета. Зріз перевіряє лише вибрані вміння. Час: 60 хв разом або 20 хв на предмет. Пропуски дають 0 балів; ключі приховані до завершення. Після першого проходження ця добірка стає знайомою.</p><div class="p-actions"><button onclick="coachStart()">Зріз із 4 предметів</button>${SUBJECTS.map(s => `<button onclick="coachStart('${s.id}')">${s.short}</button>`).join('')}${P.coach.control ? '<a href="#checkpoint">Продовжити незавершений зріз ›</a>' : ''}</div></section><section class="p-section"><h2>Пріоритетні теми</h2>${ranks
      .slice(0, 12)
      .map(
        t =>
          `<article class="p-rule-block"><h3>${SUB[t.subject].short}: ${esc(t.title)}</h3><p>${t.answered} опрацьовано · ${t.wrong} помилок у останніх відповідях · ${t.due} до повторення · ${t.controlBad} прогалин в останньому зрізі цього предмета.</p><a href="#${t.route}">Опрацювати конспект ›</a></article>`
      )
      .join(
        ''
      )}</section><section class="p-section"><h2>Причини помилок</h2><p>Вибрані тобою причини: ${
      reasons
        .filter(r => r.n)
        .map(r => esc(r.label) + ': ' + r.n)
        .join('; ') || 'поки не зазначені'
    }. Спроб з високою впевненістю та помилкою: ${confidentWrong}.</p><p>Після правильної відповіді в різні дні інтервал зростає: 1 день, потім 2–3 дні, далі кожен раз у кілька разів більше, залежно від упевненості. Після помилки — повторення через 10 хвилин, а після часткової відповіді — через годину. Давні спроби до появи журналу не реконструюються.</p></section><section class="p-section"><h2>Контрольні результати</h2>${P.coach.results.length ? P.coach.results.map((r, i) => `<p><a href="#checkpoint-result/${i}">${new Date(r.finished).toLocaleDateString('uk-UA')} · ${coachScore(r)}/${r.ids.length} · ${P.coach.results.slice(0, i).some(x => x.ids.some(id => r.ids.includes(id))) ? 'повторне проходження' : 'перше проходження'} ›</a></p>`).join('') : '<p>Завершених зрізів ще немає.</p>'}</section><section class="p-section"><h2>Практика з рисунками</h2><p>${DB.visualBank.length} задач на графіки, похідну, інтеграл, параметр, статистику й геометрію. Кожен рисунок має текстовий опис.</p><button onclick="pStart(DB.visualBank.map(q=>q.id),'Математика з рисунками','visual-practice')">Розв’язати ›</button></section>${pFoot()}`;
}
const coachRenderBase = render;
render = function () {
  let p = location.hash.slice(1).split('/'),
    pages = {
      coach: coachPage,
      checkpoint: coachCheckpoint,
      'checkpoint-result': () => coachResult(p[1]),
    };
  if (pages[p[0]]) {
    route = p.join('/');
    pages[p[0]]();
    syncSiteNavigation();
    return;
  }
  coachRenderBase();
};
const coachCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  let p = location.hash.slice(1).split('/');
  return ['coach', 'checkpoint', 'checkpoint-result'].includes(p[0])
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Маршрут підготовки', to: 'coach' },
        ...(p[0] === 'coach'
          ? []
          : [
              {
                label: p[0] === 'checkpoint' ? 'Діагностичний зріз' : 'Результат зрізу',
                to: p.join('/'),
              },
            ]),
      ]
    : coachCrumbsBase();
};
const coachHubBase = pHub;
pHub = function () {
  coachHubBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Що вчити далі</h2><p>Діагностика, теми за прогалинами й повторення за строком.</p></div><a class="primary" href="#coach">Мій маршрут ›</a></section>'
  );
};
const coachAnalyticsBase = pAnalytics;
pAnalytics = function () {
  coachAnalyticsBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Причини помилок і контрольні зрізи</h2><p>Журнал нових спроб, впевненість та розклад повторення.</p></div><a href="#coach">Відкрити маршрут ›</a></section>'
  );
};
setInterval(() => {
  let r = P.coach?.control;
  if (!r) return;
  if (Date.now() >= r.deadline) {
    coachFinish(true);
    return;
  }
  if (route === 'checkpoint')
    $('#coach-clock').textContent =
      'Залишилось ' + Math.ceil((r.deadline - Date.now()) / 60000) + ' хв';
}, 1000);

let refSubject = '',
  refKind = '',
  refQuery = '',
  refIndex = 0,
  refRevealed = false;
function refSearchKey(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0340\u0341]/g, '')
    .normalize('NFC')
    .toLowerCase();
}
function refCards() {
  let query = refSearchKey(refQuery);
  return DB.referenceCards
    .filter(
      c =>
        (!refSubject || c.subject === refSubject) &&
        (!refKind || c.kind === refKind) &&
        (!query || refSearchKey(c.title + ' ' + c.text + ' ' + (c.example || '')).includes(query))
    )
    .sort((a, b) => {
      let score = c =>
        !query
          ? 0
          : refSearchKey(c.title) === query
            ? 0
            : refSearchKey(c.title).includes(query)
              ? 1
              : refSearchKey(c.text).includes(query)
                ? 2
                : 3;
      return score(a) - score(b);
    });
}
function refChange(field, value) {
  if (field === 'subject') refSubject = SUB[value] ? value : '';
  if (field === 'kind')
    refKind = ['rule', 'spelling', 'stress', 'vocabulary', 'history'].includes(value) ? value : '';
  if (field === 'query') refQuery = String(value).slice(0, 120);
  refIndex = 0;
  refRevealed = false;
  referencePage();
}
function refMove(delta) {
  let cards = refCards();
  refIndex = cards.length ? (refIndex + delta + cards.length) % cards.length : 0;
  refRevealed = false;
  referencePage();
}
function referencePage() {
  let cards = refCards(),
    c = cards[Math.min(refIndex, cards.length - 1)];
  $('#main').innerHTML =
    pHeading(
      'Повторення без підказок',
      'Картки та довідники',
      'Спробуй пояснити правило або перекласти сполуку, потім відкрий відповідь. Наголоси охоплюють усі 233 словоформи переліку ЛРЦОЯО. Решта карток доповнює конспекти й не є повним словником або вичерпним переліком винятків.'
    ) +
    `${c ? `<section class="ref-card${refRevealed ? ' is-open' : ''}" style="--subject:${SUB[c.subject].color}" aria-live="polite"><p class="p-kicker">${SUB[c.subject].name} · ${refIndex + 1} із ${cards.length}</p><h2 lang="${c.subject === 'eng' && c.kind === 'vocabulary' ? 'en' : 'uk'}">${esc(c.title)}</h2>${refRevealed ? `<div class="p-reading"><p>${esc(c.text)}</p>${c.example ? `<p class="p-example">${esc(c.example)}</p>` : ''}</div><a href="#${c.route}">Перейти до теми ›</a>${c.sourceDoc ? `<p class="p-caption">Джерело: ЛРЦОЯО, PDF, сторінка ${c.sourcePage}. <button onclick="auditPDF('${c.sourceDoc}')">Відкрити оригінал</button></p>` : ''}` : '<p class="ref-hint">Відтвори відповідь своїми словами, перш ніж відкривати пояснення.</p>'}<div class="p-actions ref-nav"><button onclick="refMove(-1)">← Попередня</button><button class="primary" onclick="refRevealed=!refRevealed;referencePage()">${refRevealed ? 'Приховати' : 'Відкрити відповідь'}</button><button onclick="refMove(1)">Наступна ›</button></div></section>` : '<p class="p-empty">Немає карток за такими умовами. Зміни фільтр або пошуковий запит.</p>'}<section class="p-section ref-filter"><div class="ref-controls"><div class="ref-field"><label for="ref-subject">Предмет</label><select id="ref-subject" onchange="refChange('subject',this.value)"><option value="">Усі предмети</option>${SUBJECTS.map(s => `<option value="${s.id}" ${s.id === refSubject ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div><div class="ref-field"><label for="ref-kind">Тип картки</label><select id="ref-kind" onchange="refChange('kind',this.value)">${[
      ['', 'Усі картки'],
      ['stress', 'Наголоси'],
      ['spelling', 'Правопис'],
      ['vocabulary', 'Англійські сполуки'],
      ['rule', 'Правила та формули'],
      ['history', 'Історичні пояснення'],
    ]
      .map(([v, l]) => `<option value="${v}" ${v === refKind ? 'selected' : ''}>${l}</option>`)
      .join(
        ''
      )}</select></div><div class="ref-field ref-wide"><label for="ref-query">Пошук у назві й поясненні</label><div class="ref-search"><input id="ref-query" value="${esc(refQuery)}" maxlength="120" placeholder="Наприклад: наголос, логарифм, receipt"><button onclick="refChange('query',$('#ref-query').value)">Знайти</button></div></div></div><p class="p-caption">Знайдено ${cards.length} із ${DB.referenceCards.length} карток. Пошук не залежить від регістру та позначки наголосу.</p></section>${pFoot()}`;
  $('#ref-query').onkeydown = e => {
    if (e.key === 'Enter') refChange('query', e.target.value);
  };
}
const referenceRenderBase = render;
render = function () {
  let p = location.hash.slice(1).split('/');
  if (p[0] === 'reference') {
    route = p.join('/');
    refSubject = SUB[p[1]] ? p[1] : refSubject;
    referencePage();
    syncSiteNavigation();
    return;
  }
  referenceRenderBase();
};
const referenceCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash.startsWith('#reference')
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Матеріали', to: 'library' },
        { label: 'Картки та довідники', to: 'reference' },
      ]
    : referenceCrumbsBase();
};
const referenceLibraryBase = pLibrary;
pLibrary = function () {
  referenceLibraryBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Картки для активного пригадування</h2><p>Наголоси, англійські сполуки, правила, формули та історичні пояснення з пошуком.</p></div><a class="primary" href="#reference">Відкрити картки ›</a></section>'
  );
};

function syllabusPage(sid = 'math') {
  let map = DB.officialMaps[sid],
    aa = pAnswers();
  if (!map) {
    // Біологія й географія: карти блоків програми немає, лише розділи програми як теми й посилання на першоджерела.
    $('#main').innerHTML =
      pHeading(
        SUB[sid].name + ': програма',
        'Офіційна програма',
        'Карти блоків для цього предмета немає: теми сайту — це розділи програми зі збірки тестів на zno.osvita.ua, лише з офіційними завданнями.'
      ) +
      `<nav class="p-tabs" aria-label="Предмет карти програми">${SUBJECTS.map(s => `<a href="#syllabus/${s.id}" class="${s.id === sid ? 'is-active' : ''}" ${s.id === sid ? 'aria-current="page"' : ''}>${s.short}</a>`).join('')}</nav><section class="p-section"><div class="p-topic-list">${(PSUB[sid].sources || []).map(x => `<a class="p-topic-row" href="${esc(x.url)}" target="_blank" rel="noopener"><h3>${esc(x.title)}</h3><span>›</span></a>`).join('')}</div><div class="p-actions p-section"><a class="primary" href="#subject/${sid}">Теми предмета ›</a></div></section>${pFoot()}`;
    return;
  }
  $('#main').innerHTML =
    pHeading(
      SUB[sid].name + ': звірка з першоджерелом',
      'Карта офіційної програми',
      'Для кожного перевіреного блоку є сторінки джерела, конспект, конкретні вправи та ще не закриті прогалини. Кількість блоків не є показником повноти: предмети мають різний обсяг і глибину звірки.'
    ) +
    `<nav class="p-tabs" aria-label="Предмет карти програми">${SUBJECTS.map(s => `<a href="#syllabus/${s.id}" class="${s.id === sid ? 'is-active' : ''}" ${s.id === sid ? 'aria-current="page"' : ''}>${s.short}</a>`).join('')}</nav><section class="p-section"><p>Звірено ${esc(map.reviewedAt)}. ${map.order ? esc(map.order) : ''}</p><p><strong>Межі перевірки:</strong> ${esc(map.scope)}</p><div class="p-actions"><button onclick="auditPDF('${sid}')">Відкрити вбудований PDF</button><a href="${esc(map.sourceUrl)}" target="_blank" rel="noopener">Оригінал УЦОЯО ›</a><a href="#audit/${sid}">Пояснення й вправи ›</a></div></section><section class="p-section">${map.blocks
      .map(b => {
        let n = b.questionIds.filter(id => aa[id] && aa[id].score === aa[id].max).length;
        return `<article class="p-rule-block"><p class="p-kicker">${b.group ? esc(b.group) + ' · ' : ''}${b.officialTopic ? 'Тема ' + b.officialTopic : b.index + ' / ' + map.blocks.length} · PDF: ${b.pages.length > 1 ? 'сторінки' : 'сторінка'} ${b.pages.join('–')}</p><h2>${esc(b.title)}</h2><p>${esc(b.summary)}</p>${b.reviewScope ? `<p class="p-caption">${esc(b.reviewScope)}</p>` : ''}<p><strong>Покриття часткове.</strong> ${esc(b.remaining)}</p>${b.questionIds.length ? `<p class="p-caption">Правильно виконано ${n} із ${b.questionIds.length} підібраних вправ. Вони перевіряють окремі вміння блоку й не доводять засвоєння всього розділу.</p>` : ''}<div class="p-actions"><a href="#${b.lesson}">Конспект ›</a>${b.questionIds.length ? `<button onclick="syllabusPractice('${b.id}','${sid}')">Вправи блоку ›</button>` : ''}</div></article>`;
      })
      .join(
        ''
      )}</section><section class="p-section"><h2>Що ще потрібно звірити</h2><p>Підпункти офіційних програм, усі факти, винятки, джерела та відповідність кожної вправи конкретній вимозі. Наявність теми або кількох вправ не прирівнюється до повноти підготовки.</p></section>${pFoot()}`;
}
function syllabusPractice(id, sid = 'math') {
  let b = DB.officialMaps[sid]?.blocks.find(b => b.id === id);
  if (b) pStart(b.questionIds, b.title, 'official-' + id);
}
const syllabusRenderBase = render;
render = function () {
  let p = location.hash.slice(1).split('/');
  if (p[0] === 'syllabus' && SUB[p[1]]) {
    route = p.join('/');
    syllabusPage(p[1]);
    syncSiteNavigation();
    return;
  }
  syllabusRenderBase();
};
const syllabusCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  let p = location.hash.slice(1).split('/');
  return p[0] === 'syllabus' && SUB[p[1]]
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Матеріали', to: 'library' },
        { label: 'Офіційна програма: ' + SUB[p[1]].short, to: p.join('/') },
      ]
    : syllabusCrumbsBase();
};
const syllabusQualityBase = qualityPage;
qualityPage = function (sid = '') {
  syllabusQualityBase(sid);
  $('#main').insertAdjacentHTML(
    'afterbegin',
    `<section class="p-alert"><div><h2>Зв’язок з офіційними програмами</h2><p>Чотири предмети: сторінки оригіналів, пов’язані уроки й конкретні незакриті прогалини. Глибина перевірки різна й зазначена для кожного предмета.</p></div><a class="primary" href="#syllabus/${sid || 'math'}">Карта програми ›</a></section>`
  );
};
const syllabusLibraryBase = pLibrary;
pLibrary = function () {
  syllabusLibraryBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Карти офіційних програм</h2><p>Математика, українська, англійська, 32 історичні розділи й компетентності: вимоги, джерела й залишкові прогалини.</p></div><a href="#syllabus/math">Переглянути ›</a></section>'
  );
};

/* Official demos use their own answer store and never enter the training bank. */
const OFFICIAL_PAPERS = Object.fromEntries(DB.officialPapers.map(p => [p.id, p]));
// The 2026 demos are keyed by subject id; later real tests carry their own id and a subject field.
function offSub(id) {
  return OFFICIAL_PAPERS[id]?.subject || id;
}
function offName(id) {
  let p = OFFICIAL_PAPERS[id];
  return SUB[offSub(id)].name + ' · ' + (p?.title || 'демоваріант 2026');
}
function offFresh() {
  return { current: null, records: [], seen: {} };
}
const offFreshBase = pFresh;
pFresh = function () {
  return { ...offFreshBase(), official: offFresh() };
};
function offDraftValid(q, v) {
  if (q.type === 'single') return Number.isInteger(v) && v >= 0 && v < q.options.length;
  if (q.type === 'numeric') return typeof v === 'string' && v.length <= 60;
  if (!Array.isArray(v)) return false;
  let limit = q.type === 'match' ? q.right.length : q.options.length,
    n = q.type === 'multi' ? 3 : q.answer.length;
  if (q.type === 'multi')
    return (
      v.length <= n &&
      v.every(x => Number.isInteger(x) && x >= 0 && x < limit) &&
      new Set(v).size === v.length
    );
  return (
    v.length === n &&
    v.every(x => Number.isInteger(x) && x >= -1 && x < limit) &&
    new Set(v.filter(x => x >= 0)).size === v.filter(x => x >= 0).length
  );
}
function offCleanAttempt(r, completed = false) {
  if (
    !r ||
    !OFFICIAL_PAPERS[r.subject] ||
    !Number.isFinite(r.started) ||
    r.started <= 0 ||
    !Number.isFinite(r.deadline) ||
    r.deadline - r.started !== 3600000 ||
    !r.answers ||
    typeof r.answers !== 'object' ||
    Array.isArray(r.answers)
  )
    throw Error('Пошкоджено офіційний демоваріант.');
  if (completed && (!Number.isFinite(r.finished) || r.finished < r.started))
    throw Error('Пошкоджено завершення демоваріанта.');
  let paper = OFFICIAL_PAPERS[r.subject],
    answers = {};
  for (let [n, v] of Object.entries(r.answers)) {
    let q = paper.questions.find(q => String(q.number) === n);
    if (!q || !offDraftValid(q, v)) throw Error('Пошкоджено бланк офіційного демоваріанта.');
    answers[n] = structuredClone(v);
  }
  return {
    subject: r.subject,
    started: r.started,
    deadline: r.deadline,
    answers,
    index: Math.max(0, Math.min(paper.questions.length - 1, Math.trunc(Number(r.index) || 0))),
    familiar: !!r.familiar,
    finished: completed ? r.finished : null,
  };
}
function offNormal(raw) {
  let n = offFresh();
  if (raw === undefined) return n;
  if (!raw || !Array.isArray(raw.records) || !raw.seen || typeof raw.seen !== 'object')
    throw Error('Пошкоджено історію офіційних демоваріантів.');
  if (raw.current)
    try {
      n.current = offCleanAttempt(raw.current);
    } catch {}
  n.records = raw.records.slice(-30).flatMap(r => {
    try {
      return [offCleanAttempt(r, true)];
    } catch {
      return [];
    }
  });
  for (let sid of Object.keys(OFFICIAL_PAPERS)) if (raw.seen[sid]) n.seen[sid] = true;
  return n;
}
const offNormalBase = pNormal;
pNormal = function (raw) {
  let n = offNormalBase(raw);
  n.official = offNormal(raw.official);
  return n;
};
try {
  let original = JSON.parse(localStorage.getItem(PKEY) || 'null');
  P.official = offNormal(original?.official);
} catch {
  P.official = offFresh();
  pStorage = false;
  keepCorrupt(PKEY);
}
function offStart(sid, familiar = false) {
  if (!OFFICIAL_PAPERS[sid]) return;
  if (
    P.official.current &&
    !confirm('Замінити незавершений офіційний демоваріант? Його чернетку буде втрачено.')
  )
    return;
  let now = Date.now();
  P.official.current = {
    subject: sid,
    started: now,
    deadline: now + 3600000,
    answers: {},
    index: 0,
    familiar: !!(familiar || P.official.seen[sid]),
    finished: null,
  };
  P.official.seen[sid] = true;
  pSave();
  go('official-run');
}
function offGrade(q, v) {
  if (q.type === 'order') {
    if (!offDraftValid(q, v)) return 0;
    return JSON.stringify(v) === JSON.stringify(q.answer)
      ? 3
      : (v[0] === q.answer[0] ? 1 : 0) + (v[3] === q.answer[3] ? 1 : 0);
  }
  return pGrade(q, v);
}
function offScore(r) {
  let qs = OFFICIAL_PAPERS[r.subject].questions;
  return {
    score: qs.reduce((n, q) => n + offGrade(q, r.answers[q.number]), 0),
    max: qs.reduce((n, q) => n + pMax(q), 0),
  };
}
function offFinish(auto = false) {
  let r = P.official.current;
  if (!r) return;
  if (!auto && !confirm('Завершити тест? Після цього бланк буде закрито для редагування.')) return;
  r.finished = Date.now();
  P.official.records.push(structuredClone(r));
  P.official.records = P.official.records.slice(-30);
  P.official.current = null;
  pSave();
  go('official-result/' + (P.official.records.length - 1));
}
function offExpired() {
  let r = P.official.current;
  if (r && Date.now() >= r.deadline) {
    offFinish(true);
    return true;
  }
  return false;
}
function offQ() {
  let r = P.official.current;
  return r ? OFFICIAL_PAPERS[r.subject].questions[r.index] : null;
}
function offChoose(value) {
  if (offExpired()) return;
  let r = P.official.current,
    q = offQ();
  if (!r || !q) return;
  let v = value;
  if (q.type === 'multi') {
    v = [...(r.answers[q.number] || [])];
    v = v.includes(value) ? v.filter(x => x !== value) : v.length < 3 ? [...v, value] : v;
  } else if (q.type !== 'single') return;
  if (!offDraftValid(q, v)) return;
  r.answers[q.number] = v;
  pSave();
  offExam();
}
function offPart(row, value) {
  if (offExpired()) return;
  let r = P.official.current,
    q = offQ();
  if (
    !r ||
    !['match', 'order'].includes(q?.type) ||
    !Number.isInteger(row) ||
    row < 0 ||
    row >= q.answer.length
  )
    return;
  let v = [...(r.answers[q.number] || q.answer.map(() => -1))];
  if (value >= 0 && v.some((x, i) => i !== row && x === value)) {
    toast('Цей варіант уже використано в іншому рядку.');
    offExam();
    return;
  }
  v[row] = value;
  if (!offDraftValid(q, v)) return;
  r.answers[q.number] = v;
  pSave();
  offExam();
}
function offNumber(value) {
  if (offExpired()) return;
  let r = P.official.current,
    q = offQ();
  if (!r || q?.type !== 'numeric' || !offDraftValid(q, value)) return;
  r.answers[q.number] = value;
  pSave();
}
function offNav(index) {
  if (offExpired()) return;
  let r = P.official.current;
  if (!r) return;
  r.index = Math.max(
    0,
    Math.min(OFFICIAL_PAPERS[r.subject].questions.length - 1, Math.trunc(index))
  );
  pSave();
  offExam();
}
function offClear() {
  if (offExpired()) return;
  let r = P.official.current,
    q = offQ();
  if (!r || !q) return;
  delete r.answers[q.number];
  pSave();
  offExam();
}
const offUrls = new Map();
function offPDF(sid, kind = 'questions', download = false) {
  let paper = OFFICIAL_PAPERS[sid];
  if (!paper || !['questions', 'keys'].includes(kind)) return;
  if (!paper.documents[kind]) {
    toast('PDF ключа для цього тесту немає: офіційні відповіді наведено в розборі.');
    return;
  }
  if (
    kind === 'keys' &&
    (P.official.current?.subject === sid || !P.official.records.some(r => r.subject === sid))
  ) {
    toast('Ключ доступний після завершення тесту.');
    return;
  }
  let doc = paper.documents[kind],
    url = doc.data;
  if (url.startsWith('data:')) {
    let key = sid + '-' + kind;
    if (!offUrls.has(key)) {
      let bytes = Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
      offUrls.set(key, URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })));
    }
    url = offUrls.get(key);
  }
  if (download) {
    let a = document.createElement('a');
    a.href = url;
    a.download = 'nmt-' + (paper.year || 2026) + '-' + offSub(sid) + '-' + kind + '.pdf';
    a.click();
  } else if (!window.open(url, '_blank'))
    toast('Відкриття PDF заблоковано браузером. Натисни «Зберегти умови PDF».');
}
function offHub() {
  let cur = P.official.current;
  $('#main').innerHTML =
    pHeading(
      'Повні предметні тести УЦОЯО',
      'Офіційні тести НМТ',
      'Демоваріанти 2026 і справжні тести НМТ-2025 з оригінальними рисунками й текстами. Відкрий PDF, розв’язуй і перенось відповіді в бланк. Ключі відкриються після завершення. Авторський навчальний банк не містить цих 228 завдань.'
    ) +
    `<p>На предмет у цьому тренажері відведено 60 хвилин. Це налаштування тренування; реальний НМТ має спільний час на два предмети блоку. Таймер не зупиняється після закриття сторінки. Якщо вже бачив умови або ключі, познач це перед початком: повторне проходження не є незалежною перевіркою.</p>${cur ? `<div class="p-alert"><strong>Незавершено: ${esc(offName(cur.subject))}</strong><a href="#official-run">Продовжити бланк ›</a></div>` : ''}<div class="p-mock-grid">${SUBJECTS.flatMap(
      s => DB.officialPapers.filter(p => offSub(p.id) === s.id)
    )
      .map(paper => {
        let id = paper.id,
          max = paper.questions.reduce((n, q) => n + pMax(q), 0);
        return `<article class="p-mock-card"><h2>${SUB[offSub(id)].name}</h2><p><strong>${esc(paper.title || 'Демоваріант 2026')}</strong></p><p>${stPlural(paper.questions.length, 'завдання', 'завдання', 'завдань')} · ${stPlural(max, 'тестовий бал', 'тестові бали', 'тестових балів')} · 60 хв тренування</p><label><input id="off-known-${id}" type="checkbox" ${P.official.seen[id] ? 'checked' : ''}> Умови або ключі вже знайомі</label><div class="p-actions"><button class="primary" onclick="offStart('${id}',$('#off-known-${id}').checked)">Почати ›</button></div></article>`;
      })
      .join('')}</div><section class="p-section"><h2>Завершені тести</h2>${
      P.official.records.length
        ? P.official.records
            .map((r, i) => {
              let s = offScore(r);
              return `<p><a href="#official-result/${i}">${esc(offName(r.subject))} · ${s.score}/${s.max} · ${r.familiar ? 'знайомий варіант' : 'перше збережене проходження'} ›</a></p>`;
            })
            .join('')
        : '<p>Результатів ще немає.</p>'
    }</section><p class="p-caption">© Український центр оцінювання якості освіти. <a href="https://testportal.gov.ua/demonstratsijni-varianty-nmt-2026/" target="_blank" rel="noopener">Офіційна сторінка джерел</a>. Із копії умов демоваріантів вилучено сторінку відповідей і внутрішні посилання; оригінальне оформлення умов збережено. НМТ-2025 — тестові зошити варіанта 2 та ключі, оприлюднені на <a href="https://osvita.ua/test/answers/95541/" target="_blank" rel="noopener">Освіта.ua</a>; варіант 1 не додано, бо в його зошитах біля завдань надруковано статистику й ключі.</p>${pFoot()}`;
}
function offWidget(q, v) {
  if (q.type === 'numeric')
    return `<label for="off-number">Відповідь числом</label><input id="off-number" inputmode="decimal" maxlength="60" value="${esc(v || '')}" oninput="offNumber(this.value)"><p class="p-caption">Десятковий дріб: кома або крапка; мінус також підтримується.</p>`;
  if (q.type === 'single' || q.type === 'multi')
    return `<p>${q.type === 'multi' ? 'Обери до трьох відповідей. Кожна правильна дає один бал.' : 'Обери одну відповідь за позначенням у PDF.'}</p><div class="p-options" role="${q.type === 'single' ? 'radiogroup' : 'group'}" aria-label="Бланк відповідей">${q.options
      .map((label, i) => {
        let chosen = q.type === 'single' ? v === i : v?.includes(i);
        return `<button class="p-option ${chosen ? 'is-selected' : ''}" role="${q.type === 'single' ? 'radio' : 'checkbox'}" aria-checked="${!!chosen}" onclick="offChoose(${i})">${esc(label)}</button>`;
      })
      .join('')}</div>`;
  let letters = q.type === 'match' ? q.right : q.options;
  return `<p>${q.type === 'order' ? 'Позиція 1 — найраніша подія; позиція 4 — найпізніша.' : 'Для кожного рядка вибери позначення відповіді.'} Варіант не можна повторювати.</p>${q.answer.map((_, i) => `<label class="ref-field">${q.type === 'order' ? 'Позиція' : 'Рядок'} ${i + 1}<select aria-label="${q.type === 'order' ? 'Позиція' : 'Рядок'} ${i + 1}" onchange="offPart(${i},Number(this.value))"><option value="-1">—</option>${letters.map((letter, j) => `<option value="${j}" ${v?.[i] === j ? 'selected' : ''}>${esc(letter)}</option>`).join('')}</select></label>`).join('')}`;
}
function offExam() {
  if (offExpired()) return;
  let r = P.official.current;
  if (!r) {
    offHub();
    return;
  }
  let paper = OFFICIAL_PAPERS[r.subject],
    q = offQ(),
    v = r.answers[q.number];
  $('#main').innerHTML =
    pHeading(
      offName(r.subject),
      'Бланк: завдання ' + q.number,
      `Усього ${stPlural(paper.questions.length, 'завдання', 'завдання', 'завдань')}. Читай умови в PDF і перенось відповіді за номером.`
    ) +
    `<p class="p-timer" id="off-clock" role="timer">Залишилось ${Math.max(0, Math.ceil((r.deadline - Date.now()) / 60000))} хв</p><div class="p-actions"><button class="primary" onclick="offPDF('${r.subject}')">Відкрити умови PDF ›</button><button onclick="offPDF('${r.subject}','questions',true)">Зберегти умови PDF</button>${offSub(r.subject) === 'math' ? '<button onclick="auditPDF(\'formulas\')">Довідкові формули ›</button>' : ''}</div><section class="p-rule-block">${offWidget(q, v)}<div class="p-actions"><button onclick="offClear()">Очистити відповідь</button><button ${r.index === 0 ? 'disabled' : ''} onclick="offNav(${r.index - 1})">← Назад</button><button ${r.index === paper.questions.length - 1 ? 'disabled' : ''} onclick="offNav(${r.index + 1})">Далі ›</button><button onclick="offFinish()">Завершити тест</button></div></section><nav class="qnav" aria-label="Номери завдань">${paper.questions.map((q, i) => `<button class="${pValid(q, r.answers[q.number]) ? 'draft' : ''} ${r.index === i ? 'current' : ''}" aria-label="Завдання ${q.number}" ${r.index === i ? 'aria-current="step"' : ''} onclick="offNav(${i})">${q.number}</button>`).join('')}</nav><p class="p-caption">${r.familiar ? 'Знайомий варіант.' : 'Перше збережене проходження. Якщо бачив цей тест поза програмою, результат також є повторним.'} За незаповнені позиції балів немає. Часткові відповідності й вибір трьох відповідей оцінюються за правильними елементами; у послідовності окремо враховуються перша й остання події.</p>${pFoot()}`;
}
function offAnswerLabel(q, v) {
  if (v === undefined) return 'Не подано';
  if (q.type === 'single') return q.options[v] || 'Не подано';
  if (q.type === 'numeric') return String(v) || 'Не подано';
  let options = q.type === 'match' ? q.right : q.options;
  return v
    .map((x, i) =>
      q.type === 'match' || q.type === 'order' ? i + 1 + '–' + (options[x] || '—') : options[x]
    )
    .join(', ');
}
function offSolutionHTML(sid, q) {
  let s = DB.officialSolutions?.[sid]?.find(s => s.number === q.number);
  if (!s || P.official.current?.subject === sid) return '';
  return `<details class="p-note-question"><summary>Розібрати розв’язання: ${esc(s.title)}</summary><ol>${s.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol><p><strong>Типова помилка:</strong> ${esc(s.trap)}</p><p class="p-caption">${esc(s.review)}</p><a href="#${sid === 'hist' ? 'topic/' + s.topicId.split('-')[1] : 'lesson/' + esc(s.topicId)}">Опрацювати пов’язану тему ›</a></details>`;
}
function offResult(index) {
  let r = P.official.records[Number(index)];
  if (!r) {
    offHub();
    return;
  }
  if (P.official.current?.subject === r.subject) {
    $('#main').innerHTML =
      pHeading(
        'Тест триває',
        'Розбір тимчасово приховано',
        'Заверши поточне проходження цього тесту, щоб відкрити попередні ключі й пояснення.'
      ) +
      '<a class="primary" href="#official-run">Повернутися до бланка ›</a>' +
      pFoot();
    return;
  }
  let paper = OFFICIAL_PAPERS[r.subject],
    score = offScore(r);
  $('#main').innerHTML =
    pHeading(
      offName(r.subject),
      score.score + ' / ' + score.max + ' тестових балів',
      r.familiar
        ? 'Повторне проходження знайомого варіанта.'
        : 'Перше збережене проходження. Якщо тест був знайомий поза програмою, не трактуй результат як незалежний.'
    ) +
    `<p>Бали звірено з офіційним ключем УЦОЯО. Це результат одного тесту: для прогнозу потрібні кілька пробників.</p><div class="p-actions">${paper.documents.keys ? `<button onclick="offPDF('${r.subject}','keys')">Офіційний ключ PDF ›</button>` : ''}<button onclick="offPDF('${r.subject}','questions')">Умови PDF ›</button><a href="#official">Інші офіційні тести ›</a></div><section class="p-section"><h2>Звірка бланка</h2>${paper.questions.map(q => `<article class="p-note"><h3>Завдання ${q.number} · ${offGrade(q, r.answers[q.number])}/${pMax(q)}</h3><p>Твоя відповідь: ${esc(offAnswerLabel(q, r.answers[q.number]))}</p><p>Офіційний ключ: ${esc(offAnswerLabel(q, q.answer))}</p>${offSolutionHTML(r.subject, q)}</article>`).join('')}</section><p class="p-caption">© УЦОЯО. <a href="${esc(paper.sourceUrl)}" target="_blank" rel="noopener">${paper.kind === 'real' ? 'Джерело тестового зошита й ключа' : 'Повний оригінал демоваріанта'} ›</a>. ${DB.officialSolutions?.[r.subject]?.length === paper.questions.length ? 'До всіх завдань цього варіанта додано авторські пояснення з типовими помилками й переходом до теми. Це розв’язання тренажера, а не офіційні пояснення УЦОЯО.' : 'Змістовий розбір цього предмета ще не додано; наведено офіційний ключ і перевірку бланка.'}</p>${pFoot()}`;
}
const offRenderBase = render;
render = function () {
  let p = location.hash.slice(1).split('/');
  if (['official', 'official-run', 'official-result'].includes(p[0])) {
    route = p.join('/');
    if (p[0] === 'official') offHub();
    else if (p[0] === 'official-run') offExam();
    else offResult(p[1]);
    syncSiteNavigation();
    return;
  }
  offRenderBase();
};
const offCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  let p = location.hash.slice(1).split('/');
  return p[0].startsWith('official')
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Офіційні тести', to: 'official' },
        ...(p[0] === 'official'
          ? []
          : [
              {
                label: p[0] === 'official-run' ? 'Бланк відповідей' : 'Результат',
                to: p.join('/'),
              },
            ]),
      ]
    : offCrumbsBase();
};
const offMocksBase = pMocks;
pMocks = function (subject = '') {
  offMocksBase(subject);
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Перевір себе на офіційному демоваріанті</h2><p>Оригінальні умови, рисунки й тексти УЦОЯО; окремий бланк, таймер і ключ після завершення.</p></div><a class="primary" href="#official">Офіційні тести ›</a></section>'
  );
};
const offLibraryBase = pLibrary;
pLibrary = function () {
  offLibraryBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Офіційні тести УЦОЯО</h2><p>228 завдань: демоваріанти НМТ-2026 і справжні тести НМТ-2025 з усіх чотирьох предметів, доступні й без інтернету в автономному файлі.</p></div><a class="primary" href="#official">Відкрити ›</a></section>'
  );
};
setInterval(() => {
  if (offExpired()) return;
  if (route === 'official-run' && P.official.current)
    $('#off-clock').textContent =
      'Залишилось ' +
      Math.max(0, Math.ceil((P.official.current.deadline - Date.now()) / 60000)) +
      ' хв';
}, 1000);

let chronoTopic = 0,
  chronoQuery = '';
function chronoNoteHTML(key) {
  let n = DB.historyChronology.clarifications[key];
  return n
    ? `<aside class="p-rule-block"><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><ul>${n.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ›</a></li>`).join('')}</ul></aside>`
    : '';
}
function chronoChange(topic, query) {
  chronoTopic =
    Number.isInteger(Number(topic)) && Number(topic) >= 2 && Number(topic) <= 32
      ? Number(topic)
      : 0;
  chronoQuery = String(query || '').slice(0, 120);
  chronologyPage();
}
function chronoPractice(id) {
  let d = DB.historyChronology,
    e = d.entries.find(e => e.id === id),
    ids = id === 'all' ? d.questionIds : e?.questionIds;
  if (ids?.length) pStart(ids, 'Хронологічні пастки', 'chronology-' + id);
}
function chronologyPage() {
  let d = DB.historyChronology,
    query = chronoQuery.toLowerCase(),
    rows = d.entries.filter(
      e =>
        (!chronoTopic || e.topic === chronoTopic) &&
        (!query ||
          [e.event, e.programmeDate, d.clarifications[e.note]?.text || '']
            .join(' ')
            .toLowerCase()
            .includes(query))
    );
  $('#main').innerHTML =
    pHeading(
      'Історія України / Хронологія',
      'Від події до точної дати',
      'Спочатку пригадай дату, потім розкрий картку. Окремо порівняй дати голосування, присяги, підписання та набрання чинності документа.'
    ) +
    `<section class="p-section"><p>${esc(d.scope)}</p><p><strong>Пріоритет підготовки:</strong> ${esc(d.monumentsNote)}</p><div class="p-actions"><button onclick="auditPDF('hist')">Офіційна програма PDF</button>${d.questionIds.length ? `<button class="primary" onclick="chronoPractice('all')">8 складніших вправ ›</button>` : ''}<a href="#syllabus/hist">Карта програми ›</a></div><p class="p-caption">Авторська практика з поясненнями, а не новий офіційний варіант. Звірено ${esc(d.reviewedAt)}.</p><form onsubmit="event.preventDefault();chronoChange($('#chrono-topic').value,$('#chrono-query').value)"><div class="ref-controls"><div class="ref-field"><label for="chrono-topic">Тема</label><select id="chrono-topic" onchange="chronoChange(this.value,$('#chrono-query').value)"><option value="0">Усі перевірені теми</option>${Array.from(
      { length: 31 },
      (_, i) => i + 2
    )
      .map(
        t =>
          `<option value="${t}" ${chronoTopic === t ? 'selected' : ''}>${t}. ${esc(T[t - 1].title)}</option>`
      )
      .join(
        ''
      )}</select></div><div class="ref-field ref-wide"><label for="chrono-query">Подія, рік або уточнення</label><input id="chrono-query" maxlength="120" value="${esc(chronoQuery)}" type="search"></div><button type="submit">Знайти</button></div></form><p role="status">Знайдено ${rows.length} із ${d.entries.length} пунктів.</p></section><section class="p-section">${rows.map(e => `<article class="p-rule-block"><p class="p-kicker">Тема ${e.topic} · PDF: сторінка ${e.page}</p><h2>${esc(e.event)}</h2><details><summary>Пригадав дату — перевір себе</summary><p><strong>Орієнтир у програмі:</strong> ${esc(e.programmeDate)}.</p>${e.note ? chronoNoteHTML(e.note) : `<p>${esc(FM[e.factId]?.text || '')}</p>`}<div class="p-actions"><a href="#topic/${e.topic}">До конспекту ›</a>${e.questionIds.length ? `<button onclick="chronoPractice('${e.id}')">Вправи до події ›</button>` : ''}</div></details></article>`).join('') || '<p class="p-empty">Збігів немає. Зміни тему або запит.</p>'}</section>${pFoot()}`;
}
const chronoRenderBase = render;
render = function () {
  if (location.hash === '#chronology') {
    route = 'chronology';
    chronologyPage();
    syncSiteNavigation();
    return;
  }
  chronoRenderBase();
};
const chronoCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#chronology'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Історія України', to: 'subject/hist' },
        { label: 'Хронологія', to: 'chronology' },
      ]
    : chronoCrumbsBase();
};
const chronoLibraryBase = pLibrary;
pLibrary = function () {
  chronoLibraryBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Хронологія: програма й точні дати</h2><p>178 орієнтирів усього курсу, вісім уточнень із джерелами та вісім складніших вправ.</p></div><a href="#chronology">Пригадати й перевірити ›</a></section>'
  );
};

function chronoQuestionNote(q) {
  let direct = q?.chronologyNote;
  if (direct) return direct;
  return DB.historyChronology.entries.find(e => e.note && q?.facts?.includes(e.factId))?.note;
}
const chronoPracticeBase = pPractice;
pPractice = function () {
  chronoPracticeBase();
  let q = pQ(),
    context = pContext(),
    key = chronoQuestionNote(q);
  if (key && context && !context.exam && pLocked(q))
    $('#main').insertAdjacentHTML('beforeend', chronoNoteHTML(key));
};
const chronoQuizBase = quiz;
quiz = function () {
  chronoQuizBase();
  let q = current(),
    key = chronoQuestionNote(q);
  if (key && locked(q) && (!isMock() || S.mock?.finished))
    $('#main').insertAdjacentHTML('beforeend', chronoNoteHTML(key));
};

let portraitQuery = '';
function portraitItems() {
  let query = portraitQuery.toLowerCase().replace(/йосиф/g, 'йосип');
  return DB.portraitAtlas.items.filter(p =>
    (p.name + ' ' + FM[p.factId].text).toLowerCase().includes(query)
  );
}
function portraitSearch(value) {
  portraitQuery = String(value || '').slice(0, 120);
  portraitPage();
}
function portraitPractice(mode = 'all') {
  let items = portraitItems(),
    aa = pAnswers();
  if (mode === 'wrong')
    items = items.filter(p => aa[p.questionId] && aa[p.questionId].score < aa[p.questionId].max);
  let ids = pSeedShuffle(items.map(p => p.questionId).filter(Boolean), Date.now());
  if (mode === 'short') ids = ids.slice(0, 12);
  pStart(ids, 'Упізнавання історичних діячів', 'portraits-' + mode);
}
function portraitPage() {
  let atlas = DB.portraitAtlas,
    items = portraitItems(),
    aa = pAnswers();
  $('#main').innerHTML =
    pHeading(
      'Історія України / Візуальне розпізнавання',
      '54 діячі в портретах',
      'Порівняй кілька зображень тієї самої людини, пов’яжи зовнішність із діяльністю та перевір себе без підпису.'
    ) +
    `<section class="p-section"><p>${esc(atlas.scope)}</p><p class="p-caption">67 ілюстрацій з оригінального PDF. Біографічні підписи джерела не перенесено автоматично. <a href="${esc(atlas.sourceUrl)}" target="_blank" rel="noopener">ЛРЦОЯО: джерело зображень ›</a></p><label for="portrait-query">Пошук за ім’ям або діяльністю</label><form onsubmit="event.preventDefault();portraitSearch($('#portrait-query').value)"><div class="ref-search"><input id="portrait-query" type="search" maxlength="120" value="${esc(portraitQuery)}"><button type="submit">Знайти</button></div></form><p role="status">Знайдено ${items.length} із 54 діячів.</p>${items.some(p => p.questionId) ? `<div class="p-actions"><button class="primary" onclick="portraitPractice('short')">12 портретів без підписів ›</button><button onclick="portraitPractice('all')">Уся поточна добірка ›</button><button onclick="portraitPractice('wrong')">Повторити помилки ›</button></div><p>Правильно виконано ${items.filter(p => aa[p.questionId]?.score === 1).length} із ${items.filter(p => p.questionId).length} вправ цієї добірки. Це результат знайомих вправ, а не незалежний контроль.</p>` : ''}</section><section class="p-section"><div class="gallery">${items.map(p => `<article class="p-rule-block"><div class="portrait-images">${p.images.map(im => `<img src="${esc(DB.assets[im.assetId])}" alt="${esc(p.name)}: зображення ${im.assetId.split('-').at(-1)}" loading="lazy">`).join('')}</div><h2>${esc(p.name)}</h2><p>${esc(FM[p.factId].text)}</p><p class="p-caption">Джерело: ЛРЦОЯО · № ${p.number} · PDF: ${[...new Set(p.images.map(im => im.sourcePage))].join(', ')}.</p><a href="#topic/${p.topic}">До теми ${p.topic} ›</a></article>`).join('')}</div>${!items.length ? '<p class="p-empty">Немає збігів. Зміни пошуковий запит.</p>' : ''}</section>${pFoot()}`;
}
const portraitRenderBase = render;
render = function () {
  if (location.hash === '#portraits') {
    route = 'portraits';
    portraitPage();
    syncSiteNavigation();
    return;
  }
  portraitRenderBase();
};
const portraitCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#portraits'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Історія України', to: 'subject/hist' },
        { label: 'Портрети', to: 'portraits' },
      ]
    : portraitCrumbsBase();
};
const portraitLibraryBase = pLibrary;
pLibrary = function () {
  portraitLibraryBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>54 діячі · 67 портретних ілюстрацій</h2><p>Добірка ЛРЦОЯО доступна без інтернету. Окремі вправи без підписів, повторення помилок і збереження прогресу.</p></div><a class="primary" href="#portraits">Портретний тренажер ›</a></section>'
  );
};
const portraitSubjectBase = pSubject;
pSubject = function (sid) {
  portraitSubjectBase(sid);
  if (sid === 'hist')
    $('#main').insertAdjacentHTML(
      'afterbegin',
      '<section class="p-alert"><div><h2>Упізнай історичного діяча</h2><p>54 персоналії з добірки ЛРЦОЯО: портрети, пояснення й вправи.</p></div><a href="#portraits">Почати повторення ›</a></section>'
    );
};
const portraitFactBase = showFact;
showFact = function (id) {
  portraitFactBase(id);
  let f = FM[id],
    p = DB.portraitAtlas.items.find(x => x.factId === id);
  if (p)
    $('#modalbody').insertAdjacentHTML(
      'beforeend',
      `<section><h3>Інші зображення з добірки ЛРЦОЯО</h3><div class="portrait-images">${p.images.map(im => `<img src="${esc(DB.assets[im.assetId])}" alt="${esc(f.label)}">`).join('')}</div><p class="p-caption">№ ${p.number} у джерелі. <a href="${esc(DB.portraitAtlas.sourceUrl)}" target="_blank" rel="noopener">Оригінал ЛРЦОЯО ›</a></p></section>`
    );
};

/* Offline material search. No official/diagnostic answers or personal records are indexed. */
const FIND_KINDS = {
  lesson: 'Конспекти',
  card: 'Картки',
  fact: 'Історичні відомості',
  portrait: 'Портрети',
  date: 'Хронологія',
  question: 'Навчальні вправи',
  document: 'Офіційні PDF',
};
let findCache = null;
const findSubject = value => (Object.hasOwn(SUB, value) ? value : '');
const findKind = value => (Object.hasOwn(FIND_KINDS, value) ? value : '');
function findKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0340\u0341]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/['ʼ’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function findIndex() {
  if (findCache) return findCache;
  let rows = [];
  const add = r => {
    r.index = rows.length;
    r.titleKey = findKey(r.title);
    r.searchKey = findKey(r.title + ' ' + (r.text || ''));
    rows.push(r);
  };
  for (let t of DB.quality.topics) {
    let body =
      t.subject === 'hist'
        ? DB.historyGuides.find(g => 'hist-' + g.topic === t.id)?.sections || []
        : PT[t.id]?.notes || [];
    add({
      id: 'lesson:' + t.id,
      kind: 'lesson',
      subject: t.subject,
      title: t.title,
      text: body.map(n => n.title + ' ' + n.text + ' ' + (n.example || '')).join(' '),
      preview: 'Конспект теми з поясненнями та переходом до практики.',
      route: t.route,
    });
  }
  for (let c of DB.referenceCards)
    add({
      id: 'card:' + c.id,
      kind: 'card',
      subject: c.subject,
      title: c.title,
      text: c.text + ' ' + (c.example || ''),
      preview: 'Картка для самоперевірки. Відповідь відкривається в довіднику.',
      target: c.id,
    });
  for (let f of F)
    if (!f.portraitSourceNumber)
      add({
        id: 'fact:' + f.id,
        kind: 'fact',
        subject: 'hist',
        title: f.label,
        text: f.text,
        preview: f.text.slice(0, 200),
        target: f.id,
      });
  for (let p of DB.portraitAtlas.items) {
    let f = FM[p.factId];
    add({
      id: 'portrait:' + p.number,
      kind: 'portrait',
      subject: 'hist',
      title: p.name,
      text: (p.name.includes('Сліпий') ? 'Йосиф Сліпий ' : '') + f.text,
      preview: 'Портрети й біографічна картка. Тема ' + p.topic + '.',
      target: p.factId,
    });
  }
  for (let e of DB.historyChronology.entries)
    add({
      id: 'date:' + e.id,
      kind: 'date',
      subject: 'hist',
      title: e.event,
      text: e.programmeDate + ' ' + (DB.historyChronology.clarifications[e.note]?.text || ''),
      preview: 'Програмний орієнтир. Дату можна відкрити в хронологічному довіднику.',
      target: e.id,
    });
  for (let q of PQ) {
    const ctx = String(q.passage || '')
        .replace(/\s+/g, ' ')
        .trim(),
      generic = ctx && ctx.length <= 160;
    add({
      id: 'question:' + q.id,
      kind: 'question',
      subject: q.subject,
      title: generic
        ? q.prompt.replace(/[?:.]\s*$/, '') + ': «' + ctx.replace(/[.]$/, '') + '»'
        : q.prompt,
      text: ctx,
      preview:
        (PT[q.topicId]?.title ||
          T[Number(String(q.topicId).slice(5)) - 1]?.title ||
          'Навчальна вправа') + ' · відповідь і пояснення — після перевірки.',
      target: q.id,
    });
  }
  for (let d of DB.officialDocs)
    add({
      id: 'document:' + d.id,
      kind: 'document',
      subject: SUB[d.id] ? d.id : ['pravopys', 'stress'].includes(d.id) ? 'ukr' : 'math',
      title: d.title,
      text: d.note,
      preview: d.note,
      target: d.id,
    });
  findCache = rows;
  return rows;
}
function findState() {
  let parts = location.hash.slice(1).split('/'),
    query = '';
  try {
    query = decodeURIComponent(parts[1] || '').slice(0, 120);
  } catch {}
  return {
    query,
    subject: findSubject(parts[2]),
    kind: findKind(parts[3]),
    page: Math.max(0, Math.min(10000, Math.trunc(Number(parts[4]) || 0))),
  };
}
function findRoute(s) {
  return (
    'find/' +
    encodeURIComponent(String(s.query || '').slice(0, 120)) +
    '/' +
    findSubject(s.subject) +
    '/' +
    findKind(s.kind) +
    '/' +
    Math.max(0, Math.min(10000, Math.trunc(Number(s.page) || 0)))
  );
}
function findResults(s) {
  let query = findKey(s.query),
    tokens = query.split(' ').filter(Boolean).slice(0, 16);
  if (!tokens.length) return [];
  return findIndex()
    .filter(
      r =>
        (!s.subject || r.subject === s.subject) &&
        (!s.kind || r.kind === s.kind) &&
        tokens.every(t => r.searchKey.includes(t))
    )
    .map(r => ({
      r,
      rank:
        r.titleKey === query
          ? 0
          : r.titleKey.startsWith(query)
            ? 1
            : tokens.every(t => r.titleKey.includes(t))
              ? 2
              : 3,
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        ['lesson', 'portrait', 'card', 'fact', 'date', 'document', 'question'].indexOf(a.r.kind) -
          ['lesson', 'portrait', 'card', 'fact', 'date', 'document', 'question'].indexOf(
            b.r.kind
          ) ||
        a.r.index - b.r.index
    )
    .map(x => x.r);
}
function findSubmit() {
  go(
    findRoute({
      query: $('#find-query').value,
      subject: $('#find-subject').value,
      kind: $('#find-kind').value,
      page: 0,
    })
  );
}
function findOpen(index) {
  let row = findIndex()[index];
  if (!row) return;
  if (row.kind === 'lesson') {
    go(row.route);
    return;
  }
  if (row.kind === 'fact' || row.kind === 'portrait') {
    showFact(row.target);
    return;
  }
  if (row.kind === 'document') {
    auditPDF(row.target);
    return;
  }
  if (row.kind === 'question') {
    pStart([row.target], 'Пошук: ' + row.title.slice(0, 80), 'find-practice');
    return;
  }
  if (row.kind === 'date') {
    let e = DB.historyChronology.entries.find(e => e.id === row.target);
    chronoTopic = e.topic;
    chronoQuery = e.event;
    go('chronology');
    return;
  }
  if (row.kind === 'card') {
    let card = DB.referenceCards.find(c => c.id === row.target);
    refSubject = card.subject;
    refKind = card.kind;
    refQuery = card.title;
    refIndex = Math.max(
      0,
      refCards().findIndex(c => c.id === card.id)
    );
    refRevealed = false;
    go('reference');
  }
}
function findPage() {
  let s = findState(),
    rows = findResults(s),
    page = Math.min(s.page, Math.max(0, Math.ceil(rows.length / 25) - 1)),
    start = page * 25,
    query = findKey(s.query),
    counts = findIndex().reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {});
  $('#main').innerHTML =
    pHeading(
      'Знайди потрібне',
      'Пошук по матеріалах',
      'Шукай українською або англійською: тему, правило, ім’я, подію чи формулювання навчальної вправи. Працює без інтернету.'
    ) +
    `<section class="p-section"><form class="find-form" onsubmit="event.preventDefault();findSubmit()"><div class="ref-field find-query"><label for="find-query">Що знайти</label><input id="find-query" type="search" maxlength="120" value="${esc(s.query)}" placeholder="Наприклад: Шептицький, похідна, receipt"></div><div class="ref-field"><label for="find-subject">Предмет</label><select id="find-subject" onchange="findSubmit()"><option value="">Усі предмети</option>${SUBJECTS.map(x => `<option value="${x.id}" ${s.subject === x.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select></div><div class="ref-field"><label for="find-kind">Матеріал</label><select id="find-kind" onchange="findSubmit()"><option value="">Усі матеріали</option>${Object.entries(
      FIND_KINDS
    )
      .map(
        ([id, name]) => `<option value="${id}" ${s.kind === id ? 'selected' : ''}>${name}</option>`
      )
      .join(
        ''
      )}</select></div><button class="primary" type="submit">Знайти</button></form><p class="p-caption">У пошуку: ${counts.lesson} конспектів, ${counts.card} карток, ${counts.fact} історичних відомостей, ${counts.portrait} персоналії атласу, ${counts.date} хронологічних орієнтирів, ${counts.question} навчальні вправи та ${counts.document} PDF. Індекс не містить ключів офіційного контролю або діагностики. Усередині PDF-оригіналів пошук не виконується.</p></section>${
      query
        ? `<p role="status">Знайдено ${rows.length}${rows.length ? ` · Показано ${start + 1}–${Math.min(start + 25, rows.length)}` : ''}.</p><section class="find-results" aria-label="Результати пошуку">${
            rows
              .slice(start, start + 25)
              .map(
                r =>
                  `<article class="p-rule-block"><p class="p-kicker">${esc(SUB[r.subject].name)} · ${FIND_KINDS[r.kind]}</p><h2>${esc(r.title)}</h2><p>${esc(r.preview)}</p>${r.kind === 'lesson' ? `<a href="#${esc(r.route)}">Відкрити конспект ›</a>` : `<button onclick="findOpen(${r.index})">${r.kind === 'question' ? 'Розв’язати вправу' : r.kind === 'document' ? 'Відкрити PDF' : r.kind === 'date' ? 'Перейти до дати' : 'Відкрити картку'} ›</button>`}</article>`
              )
              .join('') ||
            '<p class="p-empty">Збігів немає. Спробуй коротшу частину слова або прибери фільтри.</p>'
          }</section>${rows.length > 25 ? `<nav class="p-actions" aria-label="Сторінки результатів">${page > 0 ? `<a href="#${esc(findRoute({ ...s, page: page - 1 }))}">← Попередні</a>` : ''}<span>Сторінка ${page + 1} із ${Math.ceil(rows.length / 25)}</span>${start + 25 < rows.length ? `<a href="#${esc(findRoute({ ...s, page: page + 1 }))}">Наступні ›</a>` : ''}</nav>` : ''}`
        : `<section class="p-section"><h2>З чого почати</h2><p>Можна вводити частину слова, кілька слів або рік. Усі введені слова мають трапитися в одному матеріалі. Наголоси й різні апострофи не заважають пошуку.</p><div class="p-actions">${['наголос', 'похідна', 'Шептицький', 'receipt'].map(q => `<a href="#${esc(findRoute({ query: q }))}">${esc(q)}</a>`).join('')}</div></section>`
    }${pFoot()}`;
}
const findRenderBase = render;
render = function () {
  if (location.hash.split('/')[0] === '#find') {
    route = location.hash.slice(1);
    findPage();
    syncSiteNavigation();
    return;
  }
  findRenderBase();
};
const findCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash.split('/')[0] === '#find'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Пошук по матеріалах', to: 'find' },
      ]
    : findCrumbsBase();
};
const findLibraryBase = pLibrary;
pLibrary = function () {
  findLibraryBase();
  $('#main').insertAdjacentHTML(
    'afterbegin',
    '<section class="p-alert"><div><h2>Знайти потрібне в усіх матеріалах</h2><p>Конспекти, правила, персоналії, дати й навчальні вправи в одному пошуку.</p></div><a class="primary" href="#find">Пошук по матеріалах ›</a></section>'
  );
};

function numberToolsPractice(mode = 'shared') {
  let ids = DB.numberTools.questionIds.filter(
    id => mode === 'all' || PM[id].programmeScope === mode
  );
  pStart(
    ids,
    mode === 'profile-extra' ? 'Числа: профільні доповнення' : 'Числа: подільність і дроби',
    'number-tools-' + mode
  );
}
function numberToolsNotePractice(index) {
  let n = DB.numberTools.requirements[index];
  if (n) pStart(n.questionIds, n.title, 'number-tools-note');
}
function numberToolsPage() {
  let d = DB.numberTools,
    units = DB.syllabusUnits.filter(u => d.unitIds.includes(u.id));
  $('#main').innerHTML =
    pHeading(
      'Математика / числа',
      'Подільність, НСД/НСК і дроби',
      'Спосіб, приклад і практика. Вимоги спільної колонки та додаткові профільні вміння позначено окремо.'
    ) +
    `<section class="p-section"><p>${esc(d.scope)}</p><p>Звірено за сторінкою ${d.page} оригіналу програми від 04.12.2019. Профільне доповнення не є твердженням про окремий формат НМТ.</p><div class="p-actions"><button onclick="auditPDF('math')">Оригінал програми PDF</button><a href="#syllabus/math">До карти всієї програми ›</a><a href="#lesson/math-numbers">Повний конспект числової теми ›</a></div><p>${d.requirements.length} пояснень · ${d.questionIds.filter(id => PM[id].programmeScope === 'shared').length} вправ спільного блоку · ${d.questionIds.filter(id => PM[id].programmeScope === 'profile-extra').length} додаткових профільних вправ.</p><div class="p-actions"><button class="primary" onclick="numberToolsPractice('shared')">Спільний блок: потренуватися ›</button><button onclick="numberToolsPractice('profile-extra')">Профільні доповнення ›</button><button onclick="numberToolsPractice('all')">Усі 22 вправи ›</button></div></section>${units.map(u => `<section class="p-section"><h2>${esc(u.title)}</h2>${u.notes.map(n => `<article class="p-rule-block"><p class="p-kicker">${n.scope === 'profile-extra' ? 'Профільне доповнення' : 'Спільна колонка: стандарт і профіль'} · PDF, сторінка 2</p><h3>${esc(n.title)}</h3><p class="p-caption">Програмне вміння: ${esc(n.sourceBasis)}</p><div class="p-reading"><p>${esc(n.text)}</p><p class="p-example">${esc(n.example)}</p></div><button onclick="numberToolsNotePractice(${d.requirements.findIndex(r => r.title === n.title)})">Закріпити це вміння ›</button></article>`).join('')}</section>`).join('')}<section class="p-section"><h2>Що саме перевірено</h2><p>Прочитано ці вимоги на скані, підібрано відповідні пояснення й вправи, ключі нових задач перевірено окремо. Решта підпунктів числової теми та всієї програми ще потребує поелементної звірки. Наявність вправи не означає, що вміння вже засвоєно.</p></section>${pFoot()}`;
}
const numberToolsRenderBase = render;
render = function () {
  if (location.hash === '#number-tools') {
    route = 'number-tools';
    numberToolsPage();
    syncSiteNavigation();
    return;
  }
  numberToolsRenderBase();
};
const numberToolsCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#number-tools'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Подільність і дроби', to: 'number-tools' },
      ]
    : numberToolsCrumbsBase();
};

function powersRootsPractice(unit = 'all') {
  let d = DB.powersRoots,
    ids =
      unit === 'all'
        ? d.questionIds
        : DB.syllabusUnits.find(u => u.id === 'powers-roots-' + unit)?.questionIds;
  if (ids?.length) pStart(ids, 'Степені, корені та модуль', 'powers-roots-' + unit);
}
function powersRootsNotePractice(index) {
  let n = DB.powersRoots.requirements[index];
  if (n) pStart(n.questionIds, n.title, 'powers-roots-note');
}
function powersRootsPage() {
  let d = DB.powersRoots,
    units = DB.syllabusUnits.filter(u => d.unitIds.includes(u.id));
  $('#main').innerHTML =
    pHeading(
      'Математика / вирази',
      'Степені, корені та модуль',
      'Спочатку означення й допустимі значення. Потім перетворення, приклад і практика.'
    ) +
    `<section class="p-section"><p>${esc(d.scope)}</p><p>${d.requirements.length} пояснень · ${d.questionIds.length} вправ, зокрема ${d.questionIds.filter(id => PM[id].level === 3).length} підвищеної складності. Усі вправи цього заняття доступні в навчанні; складність не відкалібрована за результатами учасників.</p><div class="p-actions"><button onclick="auditPDF('math')">Оригінал програми · сторінка ${d.page}</button><a href="#syllabus/math">Карта програми ›</a><a href="#lesson/math-expressions">Конспект виразів ›</a><button class="primary" onclick="powersRootsPractice()">Усе заняття ›</button></div></section>${units.map(u => `<section class="p-section"><h2>${esc(u.title)}</h2><button onclick="powersRootsPractice('${u.id.replace('powers-roots-', '')}')">Вправи цього розділу ›</button>${u.notes.map(n => `<article class="p-rule-block"><p class="p-kicker">Спільна колонка: стандарт і профіль · PDF, сторінка ${d.page}</p><h3>${esc(n.title)}</h3><p class="p-caption">Програмна основа: ${esc(n.sourceBasis)}</p><div class="p-reading"><p>${esc(n.text)}</p><p class="p-example">${esc(n.example)}</p></div><button onclick="powersRootsNotePractice(${d.requirements.findIndex(r => r.title === n.title)})">Закріпити це вміння ›</button></article>`).join('')}</section>`).join('')}<section class="p-section"><h2>Перевір себе перед обчисленням</h2><p>Чи визначений вираз? Чи відомий знак? Чи не загублено модуль або заборонене значення? Після перетворень підстав результат до початкової умови.</p></section>${pFoot()}`;
}
const powersRootsRenderBase = render;
render = function () {
  if (location.hash === '#powers-roots') {
    route = 'powers-roots';
    powersRootsPage();
    syncSiteNavigation();
    return;
  }
  powersRootsRenderBase();
};
const powersRootsCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#powers-roots'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Степені, корені та модуль', to: 'powers-roots' },
      ]
    : powersRootsCrumbsBase();
};

function realFluencyPractice(unit = 'all') {
  let d = DB.realFluency,
    ids =
      unit === 'all'
        ? d.questionIds
        : DB.syllabusUnits.find(u => u.id === 'real-fluency-' + unit)?.questionIds;
  if (ids?.length) pStart(ids, 'Числа, порівняння та проміжки', 'real-fluency-' + unit);
}
function realFluencyNotePractice(index) {
  let n = DB.realFluency.requirements[index];
  if (n) pStart(n.questionIds, n.title, 'real-fluency-note');
}
function realFluencyPage() {
  let d = DB.realFluency,
    units = DB.syllabusUnits.filter(u => d.unitIds.includes(u.id));
  $('#main').innerHTML =
    pHeading(
      'Математика / числа',
      'Числа, порівняння та проміжки',
      'Точний спосіб, приклад і практика: перевіряй тип числа, знак та включення меж.'
    ) +
    `<section class="p-section"><p>${esc(d.scope)}</p><p>${d.requirements.length} пояснень · ${d.questionIds.length} вправ · ${d.questionIds.filter(id => PM[id].diagram).length} задачі з числовою прямою. Складність авторська, ще не відкалібрована за результатами учасників.</p><div class="p-actions"><button onclick="auditPDF('math')">Програма PDF · сторінка ${d.page}</button><a href="#syllabus/math">Карта програми ›</a><a href="#lesson/math-numbers">Конспект чисел ›</a><button class="primary" onclick="realFluencyPractice()">Пройти все заняття ›</button></div></section>${units.map(u => `<section class="p-section"><h2>${esc(u.title)}</h2><button onclick="realFluencyPractice('${u.id.replace('real-fluency-', '')}')">Вправи розділу ›</button>${u.notes.map(n => `<article class="p-rule-block"><p class="p-kicker">Спільна колонка програми · сторінка ${d.page}</p><h3>${esc(n.title)}</h3><p class="p-caption">Програмна основа: ${esc(n.sourceBasis)}</p><div class="p-reading"><p>${esc(n.text)}</p><p class="p-example">${esc(n.example)}</p></div><button onclick="realFluencyNotePractice(${d.requirements.findIndex(r => r.title === n.title)})">Закріпити це вміння ›</button></article>`).join('')}</section>`).join('')}<section class="p-section"><h2>Коротка перевірка способу</h2><p>Спрости число перед класифікацією. У порівнянні збережи точні дроби та перевір знак. Округлюй одразу до потрібного розряду. У проміжках перевір кожну межу окремо.</p></section>${pFoot()}`;
}
const realFluencyRenderBase = render;
render = function () {
  if (location.hash === '#real-fluency') {
    route = 'real-fluency';
    realFluencyPage();
    syncSiteNavigation();
    return;
  }
  realFluencyRenderBase();
};
const realFluencyCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#real-fluency'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Числа та проміжки', to: 'real-fluency' },
      ]
    : realFluencyCrumbsBase();
};

function ratiosModelsPractice(unit = 'all') {
  let ids =
    unit === 'all'
      ? DB.ratiosModels.questionIds
      : DB.syllabusUnits.find(u => u.id === 'ratios-models-' + unit)?.questionIds;
  if (ids?.length) pStart(ids, 'Пропорції та текстові задачі', 'ratios-models-' + unit);
}
function ratiosModelsNotePractice(index) {
  let n = DB.ratiosModels.requirements[index];
  if (n) pStart(n.questionIds, n.title, 'ratios-models-note');
}
function ratiosModelsPage() {
  let d = DB.ratiosModels,
    us = DB.syllabusUnits.filter(u => d.unitIds.includes(u.id));
  $('#main').innerHTML =
    pHeading(
      'Математика / відношення та моделі',
      'Пропорції та текстові задачі',
      'Назви сталі величини, обери базу й одиниці. Лише після цього обчислюй.'
    ) +
    `<section class="p-section"><p>${esc(d.scope)}</p><p>${d.requirements.length} пояснень · ${d.questionIds.length} задач. Кожна модель містить явні припущення; авторська складність ще не відкалібрована на результатах учасників.</p><div class="p-actions"><button onclick="auditPDF('math')">Програма PDF · сторінка ${d.page}</button><a href="#syllabus/math">Карта програми ›</a><a href="#lesson/math-numbers">Конспект чисел ›</a><button class="primary" onclick="ratiosModelsPractice()">Усе заняття ›</button></div></section>${us.map(u => `<section class="p-section"><h2>${esc(u.title)}</h2><button onclick="ratiosModelsPractice('${u.id.replace('ratios-models-', '')}')">Вправи розділу ›</button>${u.notes.map(n => `<article class="p-rule-block"><p class="p-kicker">Спільна колонка програми · сторінка ${d.page}</p><h3>${esc(n.title)}</h3><p class="p-caption">Програмна основа: ${esc(n.sourceBasis)}</p><div class="p-reading"><p>${esc(n.text)}</p><p class="p-example">${esc(n.example)}</p></div><button onclick="ratiosModelsNotePractice(${d.requirements.findIndex(r => r.title === n.title)})">Закріпити це вміння ›</button></article>`).join('')}</section>`).join('')}<section class="p-section"><h2>Перевір модель</h2><p>Відсоток від якої бази? Чи однакові одиниці? Яка величина зберігається? Час уже витрачений чи ще потрібний? Перевір відповідь прямою підстановкою та змістом умови.</p></section>${pFoot()}`;
}
const ratiosModelsRenderBase = render;
render = function () {
  if (location.hash === '#ratios-models') {
    route = 'ratios-models';
    ratiosModelsPage();
    syncSiteNavigation();
    return;
  }
  ratiosModelsRenderBase();
};
const ratiosModelsCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#ratios-models'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Пропорції та моделі', to: 'ratios-models' },
      ]
    : ratiosModelsCrumbsBase();
};
function mathDeepLessonsHTML(topic = '') {
  let rows = [
    ['number-tools', 'Подільність і дроби', DB.numberTools],
    ['powers-roots', 'Степені, корені та модуль', DB.powersRoots],
    ['real-fluency', 'Числа та проміжки', DB.realFluency],
    ['ratios-models', 'Пропорції та текстові задачі', DB.ratiosModels],
    ['algebra-tools', 'Многочлени та дробові вирази', DB.algebraTools],
    ['log-tools', 'Логарифми без втрати обмежень', DB.logTools],
    ['trig-tools', 'Тригонометричні перетворення', DB.trigTools],
  ];
  if (topic === 'math-expressions')
    rows = rows.filter(r =>
      ['powers-roots', 'algebra-tools', 'log-tools', 'trig-tools'].includes(r[0])
    );
  if (topic === 'math-numbers')
    rows = rows.filter(r =>
      ['number-tools', 'powers-roots', 'real-fluency', 'ratios-models'].includes(r[0])
    );
  if (topic === 'math-logs') rows = rows.filter(r => r[0] === 'log-tools');
  if (topic === 'math-trigonometry') rows = rows.filter(r => r[0] === 'trig-tools');
  return `<section class="p-section math-deep-lessons" aria-label="Поглиблені заняття з математики"><h2>Поглиблені заняття</h2><p>Від пояснення й прикладу до конкретних вправ.</p><div class="p-topic-list">${rows.map(([route, title, d]) => `<a class="p-topic-row" href="#${route}"><div><h3>${esc(title)}</h3><p>${d.requirements.length} пояснень · ${d.questionIds.length} вправ</p></div><span>Відкрити ›</span></a>`).join('')}</div></section>`;
}
const ratiosModelsSyllabusBase = syllabusPage;
syllabusPage = function (sid = 'math') {
  ratiosModelsSyllabusBase(sid);
  if (sid === 'math') $('#main').insertAdjacentHTML('afterbegin', mathDeepLessonsHTML());
};
const ratiosModelsLessonBase = pLesson;
pLesson = function (id) {
  ratiosModelsLessonBase(id);
  if (
    id === 'math-numbers' ||
    id === 'math-expressions' ||
    id === 'math-logs' ||
    id === 'math-trigonometry'
  )
    $('#main').insertAdjacentHTML('afterbegin', mathDeepLessonsHTML(id));
};

function algebraToolsPractice(unit = 'all') {
  let ids =
    unit === 'all'
      ? DB.algebraTools.questionIds
      : DB.syllabusUnits.find(u => u.id === 'algebra-tools-' + unit)?.questionIds;
  if (ids?.length) pStart(ids, 'Многочлени та дробові вирази', 'algebra-tools-' + unit);
}
function algebraToolsNotePractice(index) {
  let n = DB.algebraTools.requirements[index];
  if (n) pStart(n.questionIds, n.title, 'algebra-tools-note');
}
function algebraToolsPage() {
  let d = DB.algebraTools,
    us = DB.syllabusUnits.filter(u => d.unitIds.includes(u.id));
  $('#main').innerHTML =
    pHeading(
      'Математика / алгебраїчні перетворення',
      'Многочлени та дробові вирази',
      'Розкрий структуру виразу. Збережи знак, коефіцієнт і початкові обмеження.'
    ) +
    `<section class="p-section"><p>${esc(d.scope)}</p><p>${d.requirements.length} пояснень · ${d.questionIds.length} задачі. Складність авторська; кількість вправ не засвідчує повного опанування програми.</p><div class="p-actions"><button onclick="auditPDF('math')">Програма PDF · сторінка ${d.page}</button><a href="#syllabus/math">Карта програми ›</a><a href="#lesson/math-expressions">Конспект виразів ›</a><button class="primary" onclick="algebraToolsPractice()">Усе заняття ›</button></div></section>${us.map(u => `<section class="p-section"><h2>${esc(u.title)}</h2><button onclick="algebraToolsPractice('${u.id.replace('algebra-tools-', '')}')">Вправи розділу ›</button>${u.notes.map(n => `<article class="p-rule-block"><p class="p-kicker">Спільні вимоги програми · сторінка ${d.page}</p><h3>${esc(n.title)}</h3><p class="p-caption">Програмна основа: ${esc(n.sourceBasis)}</p><div class="p-reading"><p>${esc(n.text)}</p><p class="p-example">${esc(n.example)}</p></div><button onclick="algebraToolsNotePractice(${d.requirements.findIndex(r => r.title === n.title)})">Закріпити це вміння ›</button></article>`).join('')}</section>`).join('')}<section class="p-section"><h2>Перевір перед відповіддю</h2><p>Чи змінився знак кожного члена після мінуса? Чи всі пари перемножено? Чи скорочуєш множник, а не доданок? Які значення були заборонені до перетворення?</p></section>${pFoot()}`;
}
const algebraToolsRenderBase = render;
render = function () {
  if (location.hash === '#algebra-tools') {
    route = 'algebra-tools';
    algebraToolsPage();
    syncSiteNavigation();
    return;
  }
  algebraToolsRenderBase();
};
const algebraToolsCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#algebra-tools'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Многочлени та дроби', to: 'algebra-tools' },
      ]
    : algebraToolsCrumbsBase();
};

function logToolsPractice(unit = 'all') {
  const ids =
    unit === 'all'
      ? DB.logTools.questionIds
      : DB.syllabusUnits.find(u => u.id === 'log-tools-' + unit)?.questionIds;
  if (ids?.length) pStart(ids, 'Логарифми: від означення до нерівностей', 'log-tools-' + unit);
}
function logToolsNotePractice(index) {
  const n = DB.logTools.requirements[index];
  if (n) pStart(n.questionIds, n.title, 'log-tools-note');
}
function logToolsPage() {
  const d = DB.logTools,
    us = DB.syllabusUnits.filter(u => d.unitIds.includes(u.id));
  $('#main').innerHTML =
    pHeading(
      'Математика / логарифми',
      'Логарифми без втрати обмежень',
      'Перевір основу й аргумент. Обери перетворення, а потім перевір результат у початковому записі.'
    ) +
    `<section class="p-section"><p>${esc(d.scope)}</p><p>${d.requirements.length} пояснень · ${d.questionIds.length} задачі. Складність авторська; її ще не відкалібровано за результатами учасників.</p><div class="p-actions"><button onclick="auditPDF('math')">Програма PDF · сторінка ${d.page}</button><a href="#syllabus/math">Карта програми ›</a><a href="#lesson/math-logs">Основний конспект ›</a><button class="primary" onclick="logToolsPractice()">Усе заняття ›</button></div></section>${us.map(u => `<section class="p-section"><h2>${esc(u.title)}</h2><button onclick="logToolsPractice('${u.id.replace('log-tools-', '')}')">Вправи розділу ›</button>${u.notes.map(n => `<article class="p-rule-block"><p class="p-kicker">Спільні вимоги програми · сторінка ${d.page}</p><h3>${esc(n.title)}</h3><p class="p-caption">Програмна основа: ${esc(n.sourceBasis)}</p><div class="p-reading"><p>${esc(n.text)}</p><p class="p-example">${esc(n.example)}</p></div><button onclick="logToolsNotePractice(${d.requirements.findIndex(r => r.title === n.title)})">Закріпити це вміння ›</button></article>`).join('')}</section>`).join('')}<section class="p-section"><h2>Перевір перед відповіддю</h2><p>Чи допустима основа? Чи кожен початковий аргумент додатний? Чи не загублено модуль? У який бік змінюється нерівність? Чи повернувся ти від заміни до x?</p></section>${pFoot()}`;
}
const logToolsRenderBase = render;
render = function () {
  if (location.hash === '#log-tools') {
    route = 'log-tools';
    logToolsPage();
    syncSiteNavigation();
    return;
  }
  logToolsRenderBase();
};
const logToolsCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#log-tools'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Логарифми', to: 'log-tools' },
      ]
    : logToolsCrumbsBase();
};

function trigToolsPractice(unit = 'all') {
  const ids =
    unit === 'all'
      ? DB.trigTools.questionIds
      : DB.syllabusUnits.find(u => u.id === 'trig-tools-' + unit)?.questionIds;
  if (ids?.length) pStart(ids, 'Тригонометричні перетворення', 'trig-tools-' + unit);
}
function trigToolsNotePractice(index) {
  const n = DB.trigTools.requirements[index];
  if (n) pStart(n.questionIds, n.title, 'trig-tools-note');
}
function trigToolsPage() {
  const d = DB.trigTools,
    us = DB.syllabusUnits.filter(u => d.unitIds.includes(u.id));
  $('#main').innerHTML =
    pHeading(
      'Математика / тригонометрія',
      'Тригонометрія: знак, формула й обмеження',
      'Знайди чверть, визнач знак і впізнай структуру формули. Збережи початкові заборонені значення.'
    ) +
    `<section class="p-section"><p>${esc(d.scope)}</p><p>${d.requirements.length} пояснень · ${d.questionIds.length} задачі. Складність авторська; її ще не відкалібровано за результатами учасників.</p><div class="p-actions"><button onclick="auditPDF('math')">Програма PDF · сторінка ${d.page}</button><a href="#syllabus/math">Карта програми ›</a><a href="#lesson/math-trigonometry">Основний конспект ›</a><button class="primary" onclick="trigToolsPractice()">Усе заняття ›</button></div></section>${trigCircleHTML()}${us.map(u => `<section class="p-section"><h2>${esc(u.title)}</h2><button onclick="trigToolsPractice('${u.id.replace('trig-tools-', '')}')">Вправи розділу ›</button>${u.notes.map(n => `<article class="p-rule-block"><p class="p-kicker">Спільні вимоги програми · сторінка ${d.page}</p><h3>${esc(n.title)}</h3><p class="p-caption">Програмна основа: ${esc(n.sourceBasis)}</p><div class="p-reading"><p>${esc(n.text)}</p><p class="p-example">${esc(n.example)}</p></div><button onclick="trigToolsNotePractice(${d.requirements.findIndex(r => r.title === n.title)})">Закріпити це вміння ›</button></article>`).join('')}</section>`).join('')}<section class="p-section"><h2>Перевір перед відповіддю</h2><p>У яких одиницях кут? Яка чверть? Чи змінюється назва функції? Який знак між добутками? Чи ненульовий знаменник до скорочення?</p></section>${pFoot()}`;
}
const trigToolsRenderBase = render;
render = function () {
  if (location.hash === '#trig-tools') {
    route = 'trig-tools';
    trigToolsPage();
    syncSiteNavigation();
    return;
  }
  trigToolsRenderBase();
};
const trigToolsCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#trig-tools'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Тригонометрія', to: 'trig-tools' },
      ]
    : trigToolsCrumbsBase();
};

function trigCircleHTML() {
  return `<figure class="u-mt16 u-mb16 panel gap"><h2>Одиничне коло: координати задають функції</h2><svg viewBox="0 0 360 300" role="img" aria-labelledby="trig-circle-title trig-circle-desc" class="u-trig"><title id="trig-circle-title">Точка у другій чверті одиничного кола</title><desc id="trig-circle-desc">Радіус 1. Точка P має координати мінус чотири п’ятих і три п’ятих. Горизонтальна проєкція дорівнює косинусу, вертикальна — синусу кута альфа від додатної осі x проти годинникової стрілки.</desc><g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="180" cy="150" r="100"/><path d="M40 150H320M180 25V275"/><path d="M180 150L100 90" stroke="#ac442b" stroke-width="3"/><path d="M100 90V150M100 90H180" stroke-dasharray="5 4"/><path d="M212 150A32 32 0 0 0 154.4 130.8" stroke="#ac442b"/></g><circle cx="100" cy="90" r="4" fill="#ac442b"/><g fill="currentColor" font-size="14"><text x="43" y="66">P(−4/5; 3/5)</text><text x="188" y="95">3/5</text><text x="86" y="168">−4/5</text><text x="25" y="293">cos α = −4/5</text><text x="200" y="293">sin α = 3/5</text><text x="192" y="126">α</text><text x="287" y="170">1</text><text x="63" y="145">−1</text><text x="190" y="48">1</text><text x="190" y="258">−1</text><text x="190" y="168">0</text><text x="320" y="143">x</text><text x="191" y="25">y</text></g></svg><figcaption class="p-caption">Приклад у II чверті: cos α &lt; 0, sin α &gt; 0. В інших чвертях знаки змінюються. Радіус кола дорівнює 1.</figcaption></figure>`;
}

function trigReviewPage() {
  const d = DB.trigReview,
    t = PT[d.topicId],
    n = t.questions.length;
  $('#main').innerHTML =
    pHeading(
      'Перевірка навчального змісту',
      'Тригонометрія: перевірка розділу',
      'Перевірено умови, ключі, варіанти відповідей і пояснення наявних завдань. Це авторська предметна перевірка, не висновок УЦОЯО.'
    ) +
    `<section class="panel"><p>Перевірено ${esc(d.reviewedAt)}: <strong>${d.questions.length} із ${n} вправ</strong> і ${d.notes.length} пояснень.</p><p class="gap">Помилок у ключах цих вправ не виявлено. У двох поясненнях уточнено крайні значення синуса, збіг серій і врахування меж проміжку.</p><div class="p-actions gap"><a href="#lesson/math-trigonometry">Увесь конспект ›</a><a href="#trig-tools">Формули та одиничне коло ›</a><button onclick="pStart(DB.trigReview.questions.map(q=>q.id),'Тригонометрія: перевірений розділ','trig-review')">Практика розділу ›</button></div></section><section class="p-section"><h2>Одна чи дві серії?</h2><div class="p-reading"><p>У рівнянні sin x = a спочатку порівняй a з відрізком [−1; 1]. За |a| &gt; 1 розв’язків немає. За −1 &lt; a &lt; 1 маємо дві різні серії: x = arcsin a + 2πk та x = π − arcsin a + 2πk, k ∈ ℤ.</p><p>За a = 1 залишається x = π/2 + 2πk. За a = −1 — x = −π/2 + 2πk. Два записи загальної формули тут дають ту саму множину: рахуй кожен корінь один раз.</p><p>Кінці [a; b] включено, (a; b) — виключено; у напіввідкритому проміжку перевір кожний кінець окремо. Після виписування серій відкинь недопустимі цілі k та об’єднай корені.</p></div></section><section class="p-section"><h2>Розбір: sin x = √3/2 на [−2π; 3π]</h2><div class="p-reading"><p>Серії: π/3 + 2πk і 2π/3 + 2πk. У першій нерівність −2 ≤ 1/3 + 2k ≤ 3 дає −7/6 ≤ k ≤ 4/3. У другій: −4/3 ≤ k ≤ 7/6. В обох випадках цілі k — −1, 0, 1.</p><p>Шість різних коренів: −5π/3, −4π/3, π/3, 2π/3, 7π/3, 8π/3. Межі −2π і 3π не є розв’язками.</p><button onclick="pStart(['math-trigonometry-advanced-4'],'Порахуй корені на проміжку','trig-review-root')">Закріпити на завданні ›</button></div></section><section class="p-section"><h2>Самоперевірка крайніх випадків</h2>${[
      ['sin x = 1 на [0; 2π]', 'Один корінь: π/2. Збіг двох серій не подвоює кількість.'],
      ['sin x = 0 на [0; 2π]', 'Три корені: 0, π, 2π. Обидва кінці включено.'],
      ['sin x = 0 на (0; 2π)', 'Один корінь: π. Обидва кінці виключено.'],
      ['sin x = 2 на будь-якому проміжку', 'Жодного кореня: синус не перевищує 1.'],
    ]
      .map(
        ([q, a]) =>
          `<details class="p-rule-block"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`
      )
      .join(
        ''
      )}</section><section class="p-section"><h2>Межі перевірки</h2><p>${esc(d.limits)}</p></section>${pFoot()}`;
  syncSiteNavigation();
}
const trigReviewRenderBase = render;
render = function () {
  if (location.hash === '#trig-review') {
    route = 'trig-review';
    trigReviewPage();
    return;
  }
  trigReviewRenderBase();
};
const trigReviewCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#trig-review'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Перевірка розділу', to: 'trig-review' },
      ]
    : trigReviewCrumbsBase();
};
function trigReviewLink() {
  return (
    '<section class="panel gap"><h2>Перевірка тригонометричного розділу</h2><p>Перевірено ' +
    DB.trigReview.questions.length +
    ' наявних вправ. Уточнено випадки sin x = ±1 і підрахунок коренів на межах.</p><a class="p-link" href="#trig-review">Розбір і межі перевірки ›</a></section>'
  );
}
const trigReviewLessonBase = pLesson;
pLesson = function (id) {
  trigReviewLessonBase(id);
  if (id === DB.trigReview.topicId) $('#main').insertAdjacentHTML('afterbegin', trigReviewLink());
};
const trigReviewToolsBase = trigToolsPage;
trigToolsPage = function () {
  trigReviewToolsBase();
  $('#main').insertAdjacentHTML('afterbegin', trigReviewLink());
};
const trigReviewQualityBase = qualityPage;
qualityPage = function (sid = '') {
  trigReviewQualityBase(sid);
  if (!sid || sid === 'math') $('#main').insertAdjacentHTML('afterbegin', mathReviewLinks());
};

function logReviewPractice(kind = 'all') {
  const selected = {
    integer: ['math-logs-advanced-3'],
    domain: ['math-logs-advanced-1'],
    substitution: ['math-logs-advanced-2'],
  };
  pStart(
    selected[kind] || DB.logReview.questions.map(q => q.id),
    'Логарифми: перевірений розділ',
    'log-review-' + kind
  );
}
function logReviewPage() {
  const d = DB.logReview,
    n = PQ.filter(q => q.topicId === d.topicId).length;
  $('#main').innerHTML =
    pHeading(
      'Перевірка навчального змісту',
      'Логарифми: перевірка розділу',
      'Зберігай обмеження на кожному кроці. Після розбору перевір себе на пов’язаній вправі.'
    ) +
    `<section class="panel"><p>Перевірено ${esc(d.reviewedAt)}: <strong>${d.questions.length} із ${n} вправ</strong> і ${d.notes.length} пояснень.</p><p class="gap">Це 40 попередніх вправ теми, 24 вправи поглибленого заняття й одна окрема складна задача. Помилок у ключах цих завдань не виявлено. Перевірка авторська.</p><div class="p-actions gap"><a href="#lesson/math-logs">Увесь конспект ›</a><a href="#log-tools">Поглиблене заняття ›</a><button onclick="logReviewPractice()">Практика розділу ›</button></div></section><section class="p-section"><h2>Розбір: log₀,₅(x − 1) &gt; −2</h2><div class="p-reading"><p>Спочатку аргумент: x − 1 &gt; 0, тобто x &gt; 1. Основа 0,5 лежить між 0 та 1, тому логарифмічна функція спадна: знак нерівності змінюється.</p><p>Маємо x − 1 &lt; (1/2)^(−2) = 4, звідси x &lt; 5. Разом: <strong>1 &lt; x &lt; 5</strong>.</p><p>Цілі розв’язки — 2, 3, 4: усього три. При x = 1 логарифм не існує. При x = 5 отримуємо рівність −2 = −2, яка не задовольняє строгу нерівність.</p><button onclick="logReviewPractice('integer')">Перевірити себе на нерівності ›</button></div></section><section class="p-section"><h2>Три помилки, які варто розібрати</h2><details class="p-rule-block"><summary>Чому не можна залишити корінь −2?</summary><div class="p-reading"><p>У log₂x + log₂(x − 2) = 3 обидва аргументи мають бути додатними: x &gt; 2. Після об’єднання: x(x − 2) = 8, або (x − 4)(x + 2) = 0.</p><p>Кандидати 4 та −2. Початкові обмеження допускають лише 4. Додатний добуток двох від’ємних аргументів не робить окремі логарифми визначеними.</p><button onclick="logReviewPractice('domain')">Перевірити відбір коренів ›</button></div></details><details class="p-rule-block"><summary>Чому значення заміни 1 і 4 — ще не відповідь?</summary><div class="p-reading"><p>Для 2^(2x) − 5·2ˣ + 4 = 0 введи t = 2ˣ &gt; 0. Тоді (t − 1)(t − 4) = 0, отже t = 1 або t = 4.</p><p>Повернися до x: 2ˣ = 1 дає x = 0, а 2ˣ = 4 дає x = 2. Сума коренів початкового рівняння — 2. Сума значень t дорівнює 5 і відповідає іншому питанню.</p><button onclick="logReviewPractice('substitution')">Перевірити зворотну заміну ›</button></div></details><details class="p-rule-block"><summary>Коли потрібен модуль у logₐ(x²)?</summary><div class="p-reading"><p>За a &gt; 0, a ≠ 1 та x ≠ 0 маємо x² = |x|², тому logₐ(x²) = 2logₐ|x|. Модуль забезпечує додатний аргумент.</p><p>Наприклад, log₂((−2)²) = log₂4 = 2. Запис 2log₂(−2) не визначений у дійсних числах. Якщо окремо відомо x &gt; 0, модуль можна опустити.</p></div></details></section><section class="p-section"><h2>Межі перевірки</h2><p>${esc(d.limits)}</p></section>${pFoot()}`;
  syncSiteNavigation();
}
function logReviewLink() {
  return (
    '<section class="panel gap"><h2>Перевірка логарифмічного розділу</h2><p>Перевірено ' +
    DB.logReview.questions.length +
    ' наявних вправ. Розбери ОДЗ, напрям нерівності та повернення від заміни.</p><a class="p-link" href="#log-review">Розбір і межі перевірки ›</a></section>'
  );
}
function mathReviewLinks() {
  const reviews = [DB.trigReview, DB.logReview, DB.calculusReview],
    count = new Set(reviews.flatMap(d => d.questions.map(q => q.id))).size;
  return (
    '<section class="panel gap math-review-summary"><h2>Перевірка навчального змісту</h2><p>За цими трьома предметними перевірками охоплено <strong>' +
    count +
    ' із ' +
    PQ.length +
    '</strong> вправ навчального банку. Це частина загального аудиту.</p><div class="p-actions gap"><a href="#trig-review">Тригонометрія: ' +
    DB.trigReview.questions.length +
    ' вправ ›</a><a href="#log-review">Логарифми: ' +
    DB.logReview.questions.length +
    ' вправ ›</a><a href="#calculus-review">Похідна та інтеграл: ' +
    DB.calculusReview.questions.length +
    ' вправ ›</a></div></section>'
  );
}
const logReviewRenderBase = render;
render = function () {
  if (location.hash === '#log-review') {
    route = 'log-review';
    logReviewPage();
    return;
  }
  logReviewRenderBase();
};
const logReviewCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#log-review'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Перевірка розділу', to: 'log-review' },
      ]
    : logReviewCrumbsBase();
};
const logReviewLessonBase = pLesson;
pLesson = function (id) {
  logReviewLessonBase(id);
  if (id === DB.logReview.topicId) $('#main').insertAdjacentHTML('afterbegin', logReviewLink());
};
const logReviewToolsBase = logToolsPage;
logToolsPage = function () {
  logReviewToolsBase();
  $('#main').insertAdjacentHTML('afterbegin', logReviewLink());
};

function calculusReviewPractice(kind = 'all') {
  const selected = {
    integral: ['visual-20261018-signed-integral'],
    derivative: ['visual-20261018-derivative'],
    area: ['adv-20261017-math-12'],
    maximum: ['math-calculus-advanced-1'],
    tangent: ['math-calculus-advanced-3'],
  };
  pStart(
    selected[kind] || DB.calculusReview.questions.map(q => q.id),
    'Похідна та інтеграл: перевірений розділ',
    'calculus-review-' + kind
  );
}
function calculusReviewPage() {
  const d = DB.calculusReview,
    n = PQ.filter(q => q.topicId === d.topicId).length;
  $('#main').innerHTML =
    pHeading(
      'Перевірка навчального змісту',
      'Похідна та інтеграл: розбір помилок',
      'Розрізняй значення функції, її похідну, інтеграл і геометричну площу.'
    ) +
    `<section class="panel"><p>Перевірено ${esc(d.reviewedAt)}: <strong>${d.questions.length} із ${n} вправ</strong> і ${d.notes.length} пояснення.</p><p class="gap">36 вправ теми, одна окрема складна задача та три задачі з графіками. Ключі відповідей залишилися без змін; у трьох поясненнях уточнено умови застосування правил. Перевірка авторська.</p><div class="p-actions gap"><a href="#lesson/math-calculus">Увесь конспект ›</a><button onclick="calculusReviewPractice()">Практика розділу ›</button></div></section><section class="p-section"><h2>Інтеграл і площа: 2 чи 10?</h2><div class="p-reading"><p>На графіку кусково-лінійної функції перший трикутник розташований над віссю Ox, другий — під нею. Їхні геометричні площі дорівнюють 6 і 4.</p><p>Визначений інтеграл ураховує знак: <strong>6 − 4 = 2</strong>. Геометрична площа між графіком та Ox додає обидві частини: <strong>6 + 4 = 10</strong>.</p><p>Перед обчисленням перевір, що саме запитують. Для площі інтегруй |f(x)|; якщо знак змінюється, розбий відрізок у нулях функції.</p><button onclick="calculusReviewPractice('integral')">Перевірити себе за графіком ›</button></div></section><section class="p-section"><h2>Чотири пастки</h2><details class="p-rule-block"><summary>Якщо зображено f′, де шукати максимум f?</summary><div class="p-reading"><p>Дивися на знак похідної: f′ &gt; 0 означає зростання f, а f′ &lt; 0 — спадання. Перехід від плюса до мінуса дає локальний максимум f.</p><p>У пов’язаній задачі нулі f′ — −2, 1, 3. Лише при x = 1 знак змінюється з плюса на мінус. Вершина графіка похідної при x = −1 не є максимумом самої функції.</p><button onclick="calculusReviewPractice('derivative')">Розрізнити функцію та її похідну ›</button></div></details><details class="p-rule-block"><summary>Чи достатньо розв’язати f′(x) = 0?</summary><div class="p-reading"><p>Неперервна функція на замкненому відрізку досягає найбільшого й найменшого значень. Перевір кінці відрізка, внутрішні нулі похідної та точки, де похідна не існує.</p><p>Для f(x) = x³ − 3x на [−2; 2] кандидати — −2, −1, 1, 2. Значення відповідно −2, 2, −2, 2: найбільше дорівнює 2.</p><p>Нуль похідної не гарантує екстремуму: x³ при x = 0 його не має. У |x| при x = 0 є мінімум, але похідної немає. На відкритому інтервалі найбільше значення може не досягатися.</p><button onclick="calculusReviewPractice('maximum')">Перевірити всі кандидати ›</button></div></details><details class="p-rule-block"><summary>Чому площа під y = x² − 1 не від’ємна?</summary><div class="p-reading"><p>На [−1; 1] графік лежить під Ox. Тому площа S = ∫₋₁¹(1 − x²) dx = 4/3, а інтеграл самої функції дорівнює −4/3.</p><p>У полі числової відповіді введи 1,333333: цього наближення достатньо для допуску цієї вправи.</p><button onclick="calculusReviewPractice('area')">Відрізнити площу від інтеграла ›</button></div></details><details class="p-rule-block"><summary>Чому кутовий коефіцієнт — ще не рівняння дотичної?</summary><div class="p-reading"><p>Дотична: y = f(x₀) + f′(x₀)(x − x₀). Потрібні і нахил, і точка дотику.</p><p>Для y = x² при x₀ = 2: f(2) = 4, f′(2) = 4, отже y = 4 + 4(x − 2) = 4x − 4. Перетин з Oy має ординату −4.</p><button onclick="calculusReviewPractice('tangent')">Знайти перетин дотичної з Oy ›</button></div></details></section><section class="p-section"><h2>Умови, які легко пропустити</h2><p>У формулі (sin x)′ = cos x аргумент вимірюють у радіанах. Для (ln x)′ = 1/x потрібне x &gt; 0. Похідна сталої дорівнює нулю. Наведена в конспекті формула Ньютона — Лейбніца застосовується до неперервної функції на відрізку.</p></section><section class="p-section"><h2>Межі перевірки</h2><p>${esc(d.limits)}</p></section>${pFoot()}`;
  syncSiteNavigation();
}
function calculusReviewLink() {
  return (
    '<section class="panel gap"><h2>Перевірка похідної та інтеграла</h2><p>Перевірено ' +
    DB.calculusReview.questions.length +
    ' наявних вправ. Розбери знак інтеграла, графік похідної та пошук екстремумів.</p><a class="p-link" href="#calculus-review">Розбір і межі перевірки ›</a></section>'
  );
}
const calculusReviewRenderBase = render;
render = function () {
  if (location.hash === '#calculus-review') {
    route = 'calculus-review';
    calculusReviewPage();
    return;
  }
  calculusReviewRenderBase();
};
const calculusReviewCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return location.hash === '#calculus-review'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Математика', to: 'subject/math' },
        { label: 'Перевірка розділу', to: 'calculus-review' },
      ]
    : calculusReviewCrumbsBase();
};
const calculusReviewLessonBase = pLesson;
pLesson = function (id) {
  calculusReviewLessonBase(id);
  if (id === DB.calculusReview.topicId)
    $('#main').insertAdjacentHTML('afterbegin', calculusReviewLink());
};

// Only immutable release files are assembled. No answers, notes or DOM are read.
function offlineValidate(m) {
  const sha = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  if (
    !m ||
    m.schema !== 1 ||
    m.filename !== 'skladeno-nmt.html' ||
    !Number.isSafeInteger(m.bytes) ||
    m.bytes < 1 ||
    m.bytes > 200 * 1024 * 1024 ||
    !sha(m.sha256) ||
    !Array.isArray(m.parts) ||
    !m.parts.length ||
    m.parts.length > 12
  )
    throw Error('manifest');
  let total = 0;
  for (const p of m.parts) {
    if (
      !p ||
      !sha(p.sha256) ||
      p.path !== 'offline/' + p.sha256 + '.txt' ||
      !Number.isSafeInteger(p.bytes) ||
      p.bytes < 1 ||
      p.bytes > 24 * 1024 * 1024
    )
      throw Error('manifest');
    total += p.bytes;
  }
  if (total !== m.bytes) throw Error('manifest');
  return m;
}
async function offlineAssemble(m, read, digest, progress) {
  offlineValidate(m);
  const bytes = new Uint8Array(m.bytes);
  let offset = 0;
  for (const part of m.parts) {
    const b = await read(part.path);
    if (b.byteLength !== part.bytes || (await digest(b)) !== part.sha256) throw Error('integrity');
    bytes.set(new Uint8Array(b), offset);
    offset += b.byteLength;
    progress(offset, m.bytes);
  }
  if ((await digest(bytes)) !== m.sha256) throw Error('integrity');
  return bytes;
}
let offlineJob = null,
  offlineURL = '',
  offlineMessage = '';
function offlineLocal() {
  return location.protocol === 'file:';
}
function offlineStatus(text) {
  offlineMessage = text;
  const el = document.querySelector('#offline-status');
  if (el) el.textContent = text;
}
function offlinePage() {
  $('#main').innerHTML =
    pHeading(
      'Програма без інтернету',
      'Автономна версія',
      'Один HTML-файл із навчальними матеріалами, вправами, зображеннями та вбудованими PDF.'
    ) +
    `<section class="panel"><h2>${offlineLocal() ? 'Автономний файл уже відкрито' : 'Збережи програму на свій пристрій'}</h2><p class="gap">${offlineLocal() ? 'Для навчання інтернет не потрібен. Зовнішні посилання на першоджерела потребують підключення. Збережи цей HTML-файл і резервну копію прогресу.' : 'Спочатку підготуй файл (приблизно @@OFFLINE_MB@@ МБ), потім натисни «Зберегти HTML». Відкривай завантажений файл у браузері. Інтернет потрібен для завантаження та зовнішніх посилань; самі заняття працюють без нього.'}</p>${offlineLocal() ? '' : `<div class="p-actions gap"><button class="primary" id="offline-prepare" onclick="offlinePrepare()" ${offlineJob ? 'disabled' : ''}>Підготувати файл</button><button id="offline-save" onclick="offlineSave()" ${offlineURL ? '' : 'disabled'}>Зберегти HTML</button><button id="offline-cancel" onclick="offlineCancel()" ${offlineJob ? '' : 'disabled'}>Скасувати</button></div>`}<p id="offline-status" role="status" aria-live="polite" class="p-caption gap">${esc(offlineMessage || 'Файл програми не містить твоїх відповідей і нотаток.')}</p></section><section class="panel gap"><h2>Перенеси свій прогрес окремо</h2><p class="gap">Сайт і локальний HTML зберігають відповіді окремо. Перед переходом завантаж резервну копію JSON, а в автономному файлі відкрий «Налаштування» → «Відновити з файлу». Зберігання локальних файлів залежить від браузера: регулярно роби копію прогресу.</p><div class="p-actions gap"><button onclick="pBackup()">Завантажити прогрес JSON</button><a href="#preferences">Налаштування та відновлення ›</a></div></section>${pFoot()}`;
}
function offlineControls() {
  for (const [id, disabled] of [
    ['prepare', !!offlineJob],
    ['save', !offlineURL],
    ['cancel', !offlineJob],
  ]) {
    const el = document.querySelector('#offline-' + id);
    if (el) el.disabled = disabled;
  }
}
async function offlinePrepare() {
  if (offlineJob || offlineLocal()) return;
  if (!window.crypto?.subtle) {
    offlineStatus('Перевірка файла недоступна. Відкрий сайт у сучасному браузері через HTTPS.');
    return;
  }
  if (offlineURL) {
    URL.revokeObjectURL(offlineURL);
    offlineURL = '';
  }
  const job = new AbortController();
  offlineJob = job;
  offlineControls();
  offlineStatus('Отримую список матеріалів…');
  const get = async path => {
    const timer = setTimeout(() => job.abort(), 90000);
    try {
      const r = await fetch(new URL(path, location.href.split('#')[0]), {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: job.signal,
      });
      if (!r.ok) throw Error('network');
      return r;
    } finally {
      clearTimeout(timer);
    }
  };
  // The timeout covers response bodies too, including a connection stalled mid-file.
  const read = async path => {
    const timer = setTimeout(() => job.abort(), 90000);
    try {
      return await (await get(path)).arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const manifest = JSON.parse(new TextDecoder().decode(await read('offline-manifest.json')));
    const digest = async bytes =>
      Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes)))
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
    const bytes = await offlineAssemble(manifest, read, digest, (done, total) => {
      if (job.signal.aborted) throw Error('cancelled');
      offlineStatus('Отримано ' + Math.floor((done / total) * 100) + '%. Перевіряю цілісність…');
    });
    if (job.signal.aborted) throw Error('cancelled');
    offlineURL = URL.createObjectURL(new Blob([bytes], { type: 'text/html;charset=utf-8' }));
    offlineStatus(
      'Файл перевірено й готово. Натисни «Зберегти HTML», щоб завантажити його. Прогрес перенеси окремою копією JSON.'
    );
  } catch (e) {
    offlineStatus(
      job.signal.aborted
        ? 'Завантаження скасовано або час очікування минув. Спробуй підготувати файл знову.'
        : e.message === 'integrity'
          ? 'Цілісність файла не підтверджено. Файл не збережено. Спробуй ще раз.'
          : 'Не вдалося отримати повну програму. Перевір підключення й спробуй ще раз.'
    );
  } finally {
    offlineJob = null;
    offlineControls();
  }
}
function offlineCancel() {
  if (offlineJob) offlineJob.abort();
}
function offlineSave() {
  if (!offlineURL) return;
  const a = document.createElement('a');
  a.href = offlineURL;
  a.download = 'skladeno-nmt.html';
  document.body.append(a);
  a.click();
  a.remove();
  offlineStatus(
    'Файл передано браузеру для збереження. Перевір папку завантажень. Для перенесення прогресу збережи JSON-копію. Програму перевірено за SHA-256.'
  );
}
const offlineFootBase = pFoot;
pFoot = function () {
  return offlineFootBase().replace(
    '</footer>',
    '<a href="#offline">Автономна версія ↓</a></footer>'
  );
};
const offlineRenderBase = render;
render = function () {
  if (location.hash.split('/')[0] === '#offline') {
    route = 'offline';
    $('#crumb').textContent = 'Автономна версія';
    document.title = 'Автономна версія · Складено';
    offlinePage();
    return;
  }
  offlineRenderBase();
};

let importRecoveryAnnounced = false;
function restoreApplyHistory(next) {
  restoreCommit(P, next);
  S = next;
  pStorage = true;
  storageOK = true;
  $('#save-status').textContent = 'Збережено на цьому пристрої';
  $('#storage-error').classList.add('hidden');
}
function restoreNotice() {
  if (importRecoveryStatus === 'blocked') {
    storageOK = false;
    pStorage = false;
    $('#save-status').textContent = 'Потрібне відновлення прогресу';
    $('#storage-error').innerHTML =
      '<strong>Незавершене перенесення прогресу.</strong> Показано попередній доступний стан. Нові зміни тимчасово не зберігаються, доки браузер не дозволить завершити відновлення. <button onclick="pBackupDialog()">Зберегти резервну копію</button> <button onclick="restoreRetry()">Повторити відновлення</button>';
    $('#storage-error').classList.remove('hidden');
  } else if (importRecoveryStatus === 'recovered' && !importRecoveryAnnounced) {
    importRecoveryAnnounced = true;
    toast('Перерване перенесення скасовано. Попередній прогрес відновлено.');
  }
}
function restoreRetry() {
  if (
    !confirm(
      'Повернути попередній збережений прогрес? Незбережені зміни цієї сесії буде замінено. Спершу можна створити резервну копію.'
    )
  )
    return;
  if (restoreTryRecovery()) location.reload();
  else restoreNotice();
}
const restoreSaveBase = save;
save = function () {
  if (importRecoveryStatus === 'blocked') {
    restoreNotice();
    return false;
  }
  return restoreSaveBase();
};
const restorePSaveBase = pSave;
pSave = function () {
  if (importRecoveryStatus === 'blocked') {
    restoreNotice();
    return false;
  }
  return restorePSaveBase();
};
const restoreRenderBase = render;
render = function () {
  restoreRenderBase();
  restoreNotice();
};

function draftOK(q, v) {
  if (v === null) return true;
  if (q.type === 'single') return valid(q, v);
  if (!Array.isArray(v)) return false;
  if (q.type === 'multi')
    return (
      v.length <= 3 &&
      new Set(v).size === v.length &&
      v.every(n => Number.isInteger(n) && n >= 0 && n < 7)
    );
  if (q.type === 'match')
    return v.length === 4 && v.every(n => Number.isInteger(n) && n >= -1 && n < 5);
  return valid(q, v);
}
function normaliseImport(raw, lenient = false) {
  let x = raw?.app === 'istoria200' ? raw.state : null;
  if (
    !x ||
    x.schema !== 4 ||
    !x.answers ||
    typeof x.answers !== 'object' ||
    Array.isArray(x.answers)
  )
    throw Error('Невідомий формат резервної копії.');
  let n = fresh();
  for (let [id, a] of Object.entries(x.answers)) {
    let q = QM[id];
    if (!q) continue;
    if (!a || !valid(q, a.value)) {
      if (lenient) continue;
      throw Error('Пошкоджена відповідь: ' + id);
    }
    let sc = grade(q, a.value),
      mx = max(q);
    n.answers[id] = {
      value: a.value,
      score: sc,
      max: mx,
      first: Number.isFinite(a.first) && a.first >= 0 && a.first <= mx ? a.first : sc,
      checked: a.checked !== false,
      attempts: Math.max(1, Math.min(100000, Number(a.attempts) || 1)),
      at: Number(a.at) || Date.now(),
      due: Number(a.due) || Date.now(),
    };
  }
  for (let [id, v] of Object.entries(x.drafts || {})) {
    let q = QM[id];
    if (q && draftOK(q, v)) n.drafts[id] = v;
  }
  n.pins = Array.isArray(x.pins) ? [...new Set(x.pins.filter(id => QM[id]))] : [];
  n.read = Array.isArray(x.read) ? [...new Set(x.read.filter(id => FM[id]))] : [];
  for (let [id, v] of Object.entries(x.notes || {}))
    if (T[+id - 1] && typeof v === 'string') n.notes[id] = v.slice(0, 30000);
  for (let [id, v] of Object.entries(x.cursors || {}))
    if (/^t\d+-(all|new|wrong|deep)$/.test(id) && Number.isInteger(v) && v >= 0) n.cursors[id] = v;
  n.lastTopic = T[x.lastTopic - 1] ? x.lastTopic : 1;
  if (x.session && Array.isArray(x.session.ids)) {
    let ids = x.session.ids.filter(id => QM[id]);
    if (ids.length)
      n.session = {
        ids,
        title: String(x.session.title || 'Відновлене тренування').slice(0, 200),
        mode: 'learn',
        index: Math.max(0, Math.min(ids.length - 1, Number(x.session.index) || 0)),
        cursor: /^t\d+-(all|new|wrong|deep)$/.test(x.session.cursor) ? x.session.cursor : '',
      };
  }
  if (
    x.mock &&
    Array.isArray(x.mock.ids) &&
    x.mock.ids.length === 30 &&
    new Set(x.mock.ids).size === 30 &&
    x.mock.ids.every(id => QM[id]) &&
    x.mock.ids.reduce((s, id) => s + max(QM[id]), 0) === 54
  ) {
    let m = x.mock,
      answers = {};
    for (let id of m.ids) if (draftOK(QM[id], m.answers?.[id])) answers[id] = m.answers[id];
    n.mock = {
      id: Number(m.id) || Date.now(),
      ids: m.ids,
      answers,
      started: Number(m.started) || Date.now(),
      expires: Number(m.expires) || Date.now(),
      finished: m.finished ? Number(m.finished) : null,
    };
    if (n.mock.finished)
      n.mock.score = n.mock.ids.reduce((s, id) => s + grade(QM[id], answers[id]), 0);
    if (x.session?.mode === 'mock')
      n.session = {
        ids: m.ids,
        title: 'Відновлений пробний тест',
        mode: 'mock',
        index: Math.max(0, Math.min(29, Number(x.session.index) || 0)),
        cursor: '',
      };
  }
  n.history = Array.isArray(x.history)
    ? x.history
        .filter(
          h =>
            h &&
            Number.isFinite(h.at) &&
            Number.isInteger(h.score) &&
            h.score >= 0 &&
            h.score <= 54 &&
            Number.isInteger(h.answered) &&
            h.answered >= 0 &&
            h.answered <= 30
        )
        .slice(-100)
    : [];
  for (let [day, v] of Object.entries(x.days || {}))
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isInteger(v) && v >= 0) n.days[day] = v;
  return n;
}
$('#import-file').onchange = async e => {
  let file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error('Файл завеликий для копії прогресу.');
    let next = normaliseImport(JSON.parse(await file.text()));
    if (
      !confirm(
        `Імпортувати ${Object.keys(next.answers).length} відповідей і замінити поточний прогрес?`
      )
    )
      return;
    restoreApplyHistory(next);
    go('progress');
    toast('Прогрес відновлено.');
  } catch (err) {
    toast('Імпорт не виконано: ' + err.message);
  }
};
window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
document.addEventListener('keydown', e => {
  if (
    !route.startsWith('quiz') ||
    $('#modal').open ||
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
    e.ctrlKey ||
    e.altKey ||
    e.metaKey
  )
    return;
  let q = current();
  if (!q) return;
  if (/^[1-7]$/.test(e.key) && ['single', 'multi'].includes(q.type)) {
    let i = Number(e.key) - 1;
    if (i < q.options.length) {
      e.preventDefault();
      choose(i);
    }
  }
  if (e.key === 'Enter' && !['BUTTON', 'A'].includes(e.target.tagName)) {
    e.preventDefault();
    check();
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    navQ(S.session.index + 1);
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navQ(S.session.index - 1);
  }
});
setInterval(() => {
  if (S.mock && !S.mock.finished && Date.now() >= S.mock.expires) finishMock(true);
  else updateTimer();
}, 1000);
save();
render();
