// Дані й зручність: скидання прогресу однієї теми чи предмета, пошук і експорт власних нотаток, секундомір на завдання, збільшення зображень.
const DT_NOTE_KIND = 'note';
FIND_KINDS[DT_NOTE_KIND] = 'Мої нотатки';
// Нотатки: P.notes (теми й завдання за id) і S.notes (теми історії за номером, ключ S:N); текст користувача лишається простим текстом.
const dtPlain = s =>
  String(s || '')
    .replace(/\u27e6\u00a7[a-z]+\u00a7/g, '')
    .replace(/[\u27e6\u27e7]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
function dtNoteInfo(id) {
  const key = String(id).startsWith('S:') ? 'hist-' + String(id).slice(2) : id,
    t = DB.quality.topics.find(x => x.id === key);
  if (t) return { title: t.title, subject: t.subject, route: t.route };
  const q = PM[id];
  return q
    ? {
        title: 'Завдання ' + id + ': ' + dtPlain(q.prompt).slice(0, 60),
        subject: q.subject,
        task: id,
      }
    : null;
}
function dtNotes() {
  const out = [],
    add = (id, text) => {
      if (typeof text !== 'string' || !text.trim()) return;
      const i = dtNoteInfo(id);
      if (i && SUB[i.subject]) out.push({ id, text, ...i });
    };
  for (const [id, text] of Object.entries(P.notes || {})) add(id, text);
  for (const [n, text] of Object.entries(S.notes || {}))
    if (/^\d{1,3}$/.test(n)) add('S:' + n, text);
  return out;
}
// Пошук: рядки нотаток додаються до індексу пошуку й оновлюються, коли нотатки змінилися.
const dtFindIndexBase = findIndex;
let dtNoteSig = null;
findIndex = function () {
  const rows = dtFindIndexBase(),
    notes = dtNotes(),
    sig = notes.map(n => n.id + ':' + n.text).join('\u0000');
  if (sig !== dtNoteSig) {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].kind === DT_NOTE_KIND) rows.splice(i, 1);
    for (const n of notes) {
      const r = {
        id: 'note:' + n.id,
        kind: DT_NOTE_KIND,
        subject: n.subject,
        title: n.title,
        text: n.text,
        preview: n.text.replace(/\s+/g, ' ').slice(0, 200),
        target: n.id,
        index: rows.length,
      };
      r.titleKey = findKey(r.title);
      r.searchKey = findKey(r.title + ' ' + r.text);
      rows.push(r);
    }
    dtNoteSig = sig;
  }
  return rows;
};
const dtFindOpenBase = findOpen;
findOpen = function (index) {
  const row = findIndex()[index];
  if (row?.kind !== DT_NOTE_KIND) {
    dtFindOpenBase(index);
    return;
  }
  const i = dtNoteInfo(row.target);
  if (!i) return;
  if (i.route) go(i.route);
  else pStart([i.task], 'Нотатка: ' + row.title.slice(0, 80), 'find-note');
};
const dtFindPageBase = findPage;
findPage = function () {
  dtFindPageBase();
  document.querySelectorAll('.find-table td[data-label="Матеріал"]').forEach(td => {
    if (td.textContent === FIND_KINDS[DT_NOTE_KIND]) {
      const b = td.parentElement.querySelector('button');
      if (b) b.textContent = 'Відкрити нотатку ›';
    }
  });
  const c = $('#main .p-caption');
  if (c && !/нотат/.test(c.textContent))
    c.textContent += ' Також шукає в Моїх нотатках: ' + dtNotes().length + '.';
};
// Експорт нотаток у файл Markdown.
function dtNotesText() {
  const notes = dtNotes().sort(
    (a, b) =>
      SUBJECTS.findIndex(s => s.id === a.subject) - SUBJECTS.findIndex(s => s.id === b.subject) ||
      a.title.localeCompare(b.title, 'uk')
  );
  return (
    '# Мої нотатки · Складено\n\nЕкспортовано ' +
    pDay() +
    '. Нотаток: ' +
    notes.length +
    '.\n\n' +
    notes
      .map(n => '## ' + SUB[n.subject].name + ' · ' + n.title + '\n\n' + n.text.trim())
      .join('\n\n') +
    '\n'
  );
}
function dtNotesExport() {
  if (!dtNotes().length) {
    toast('Нотаток ще немає.');
    return;
  }
  download('skladeno-notatky-' + pDay() + '.md', dtNotesText(), 'text/markdown');
}
// Скидання частини прогресу. Нотатки, пробники, план, серія й налаштування лишаються.
function dtIds(sid, topic) {
  return PQ.filter(q => q.subject === sid && !q.examOnly && (!topic || q.topicId === topic)).map(
    q => q.id
  );
}
function dtCount(ids) {
  return ids.filter(id => P.answers[id] || S.answers[id]).length;
}
let dtUndo = [];
function dtReset(sid, topic) {
  const ids = dtIds(sid, topic),
    topics = topic ? [topic] : testsTopicList(sid).map(t => t.id),
    idset = new Set(ids),
    nums = sid === 'hist' ? (topic ? [Number(topic.slice(5))] : null) : [],
    facts = new Set(
      nums === null || nums.length
        ? F.filter(f => nums === null || nums.includes(f.topic)).map(f => f.id)
        : []
    ),
    snap = {
      pa: {},
      sa: {},
      pd: {},
      sd: {},
      srs: {},
      coach: {},
      read: P.read.filter(id => topics.includes(id)),
      sread: S.read.filter(id => facts.has(id)),
      events: (P.coach.events || []).filter(e => idset.has(e.id)),
      today: P.study.today,
    };
  for (const id of ids) {
    if (P.answers[id]) {
      snap.pa[id] = P.answers[id];
      delete P.answers[id];
    }
    if (S.answers[id]) {
      snap.sa[id] = S.answers[id];
      delete S.answers[id];
    }
    if (id in P.drafts) {
      snap.pd[id] = P.drafts[id];
      delete P.drafts[id];
    }
    if (id in S.drafts) {
      snap.sd[id] = S.drafts[id];
      delete S.drafts[id];
    }
    if (P.study.srs[id]) {
      snap.srs[id] = P.study.srs[id];
      delete P.study.srs[id];
    }
    if (P.coach.items?.[id]) {
      snap.coach[id] = P.coach.items[id];
      delete P.coach.items[id];
    }
  }
  P.read = P.read.filter(id => !topics.includes(id));
  S.read = S.read.filter(id => !facts.has(id));
  P.coach.events = (P.coach.events || []).filter(e => !idset.has(e.id));
  P.study.today = null;
  dtUndo.push(snap);
  pSave();
  save();
}
function dtRestore() {
  const s = dtUndo.pop();
  if (!s) return;
  for (const [m, k] of [
    ['pa', P.answers],
    ['sa', S.answers],
    ['pd', P.drafts],
    ['sd', S.drafts],
    ['srs', P.study.srs],
    ['coach', P.coach.items],
  ])
    for (const [id, v] of Object.entries(s[m])) if (!(id in k)) k[id] = v;
  P.read = [...new Set([...P.read, ...s.read])];
  S.read = [...new Set([...S.read, ...s.sread])];
  P.coach.events = [...(P.coach.events || []), ...s.events]
    .sort((a, b) => a.at - b.at)
    .slice(-2000);
  if (!P.study.today) P.study.today = s.today;
  pSave();
  save();
  toast('Прогрес повернуто.');
  pSettings();
}
function dtTopics() {
  const sid = $('#dr-subject').value;
  $('#dr-topic').innerHTML = testsTopicList(sid)
    .map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`)
    .join('');
}
function dtClick(kind) {
  const sid = $('#dr-subject').value,
    topic = kind === 'topic' ? $('#dr-topic').value : '';
  if (!SUB[sid] || (kind === 'topic' && !topic)) return;
  const ids = dtIds(sid, topic),
    n = dtCount(ids),
    name =
      kind === 'topic'
        ? 'теми «' + (testsTopicList(sid).find(t => t.id === topic)?.title || topic) + '»'
        : 'предмета «' + SUB[sid].name + '»';
  if (!n) {
    toast('Для ' + name + ' немає збережених відповідей.');
    return;
  }
  if (
    !confirm(
      'Скинути прогрес ' +
        name +
        '? Буде видалено відповіді (' +
        n +
        '), повторення й позначки впевненості для цих завдань. Нотатки, пробники, план, серія й список тренувань лишаться. Скасувати скидання можна, поки не закрито сторінку.'
    )
  )
    return;
  dtReset(sid, topic);
  toast('Прогрес скинуто: ' + stPlural(n, 'відповідь', 'відповіді', 'відповідей') + '.');
  pSettings();
}
const dtSettingsBase = pSettings;
pSettings = function () {
  dtSettingsBase();
  const f = $('#main .p-footer'),
    n = dtNotes().length;
  const html =
    `<section class="panel gap" id="data-reset"><h2>Скинути частину прогресу</h2><p class="gap">Видаляє відповіді, повторення й позначки впевненості для одного предмета або однієї теми. Нотатки, пробники, план і серія лишаються. Скасувати скидання можна, поки не закрито сторінку.</p><div class="p-form-grid"><label>Предмет<select id="dr-subject" onchange="dtTopics()">${SUBJECTS.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label>Тема<select id="dr-topic"></select></label></div><div class="p-actions gap"><button onclick="dtClick('topic')">Скинути тему</button><button onclick="dtClick('subject')">Скинути предмет</button></div>${dtUndo.length ? `<p class="p-status" role="status">Скинуто разів: ${dtUndo.length}. <button class="textbtn" onclick="dtRestore()">Скасувати останнє</button></p>` : ''}</section>` +
    `<section class="panel gap" id="data-notes"><h2>Мої нотатки</h2><p class="gap">${n ? 'Нотаток: ' + n + '. Їх знаходить пошук (матеріал «Мої нотатки») і можна завантажити одним файлом (Markdown).' : 'Нотаток ще немає. Їх можна писати на сторінках тем і завдань.'}</p><div class="p-actions gap"><button ${n ? '' : 'disabled'} onclick="dtNotesExport()">Завантажити нотатки</button><a class="p-btn" href="#find">Відкрити пошук</a></div></section>`;
  if (f) f.insertAdjacentHTML('beforebegin', html);
  else $('#main').insertAdjacentHTML('beforeend', html);
  dtTopics();
};
// Секундомір на завдання: необов'язковий, лише показує час із відкриття завдання до перевірки відповіді (у пробнику є свій таймер).
const DT_SW_KEY = 'skladeno-stopwatch';
const dtSwOn = () => {
  try {
    return localStorage.getItem(DT_SW_KEY) === 'on';
  } catch {
    return false;
  }
};
let dtSw = null;
function dtSwToggle() {
  try {
    if (dtSwOn()) localStorage.removeItem(DT_SW_KEY);
    else localStorage.setItem(DT_SW_KEY, 'on');
  } catch {}
  pPractice();
}
const dtSwText = () => {
  if (!dtSw || !dtSw.fresh) return '—';
  const s = Math.floor(((dtSw.stop || Date.now()) - dtSw.t0) / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
setInterval(() => {
  const el = $('#dt-sw');
  if (el && dtSw && !dtSw.stop && document.visibilityState !== 'hidden')
    el.textContent = dtSwText();
}, 1000);
// Збільшення зображень: натискання (або Enter) відкриває зображення у вікні, де його можна показати в натуральному розмірі.
function dtZoom(src, alt) {
  if (!src) return;
  $('#modalbody').innerHTML =
    `<div class="row between"><h2>Зображення до завдання</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><div class="dt-zoom" id="dt-zoom" tabindex="0" role="region" aria-label="Зображення, його можна прокручувати"><img src="${esc(src)}" alt="${esc(alt || 'Зображення до завдання')}"></div><div class="p-actions"><button aria-pressed="false" onclick="const z=$('#dt-zoom');z.classList.toggle('real');this.setAttribute('aria-pressed',String(z.classList.contains('real')));this.textContent=z.classList.contains('real')?'За шириною вікна':'Натуральний розмір'">Натуральний розмір</button></div>`;
  if (!$('#modal').open) $('#modal').showModal();
}
document.addEventListener('click', e => {
  const im = e.target?.closest?.('#main img.qimg');
  if (im && !im.closest('.mark-img') && im.getAttribute('src'))
    dtZoom(im.getAttribute('src'), im.getAttribute('alt'));
});
document.addEventListener('keydown', e => {
  if (
    (e.key === 'Enter' || e.key === ' ') &&
    e.target?.matches?.('#main img.qimg[role=button]') &&
    !e.target.closest('.mark-img') &&
    e.target.getAttribute('src')
  ) {
    e.preventDefault();
    dtZoom(e.target.getAttribute('src'), e.target.getAttribute('alt'));
  }
});
function dtImgAttach() {
  document.querySelectorAll('#main img.qimg').forEach(im => {
    if (im.closest('.mark-img') || !im.getAttribute('src')) return;
    im.setAttribute('tabindex', '0');
    im.setAttribute('role', 'button');
    im.setAttribute(
      'aria-label',
      (im.getAttribute('alt') || 'Зображення') + '. Натисни, щоб збільшити'
    );
  });
}
// Поза сторінкою практики секундомір скидається: повернення до завдання починає відлік заново.
const dtRenderBase = render;
render = function () {
  if (location.hash.slice(1).split('/')[0] !== 'practice') dtSw = null;
  dtRenderBase();
  dtImgAttach();
};
// Картинки пакетів історії дістають src пізніше: тоді й стають кнопками.
const dtZnoBase = znoPack;
znoPack = function (c) {
  const p = dtZnoBase(c);
  Promise.resolve(p).then(dtImgAttach);
  return p;
};
const dtPracticeBase = pPractice;
pPractice = function () {
  dtPracticeBase();
  const c = pContext(),
    q = pQ();
  if (!c || !q) return;
  if (!c.exam && !c.record) {
    if (!dtSw || dtSw.id !== q.id || dtSw.key !== P.current)
      dtSw = { id: q.id, key: P.current, t0: Date.now(), stop: null, fresh: !pLocked(q) };
    if (dtSw.fresh && !dtSw.stop && pLocked(q)) dtSw.stop = Date.now();
    const on = dtSwOn(),
      acts = $('.p-practice-top .p-actions');
    if (acts)
      acts.insertAdjacentHTML(
        'beforeend',
        `<button aria-pressed="${on}" onclick="dtSwToggle()">⏱ Секундомір</button>${on ? `<span class="dt-sw" id="dt-sw" aria-hidden="true">${dtSwText()}</span>` : ''}`
      );
  }
  dtImgAttach();
};
