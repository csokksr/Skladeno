// Real ZNO/НМТ tasks: several images per task, images as options or match rows, and booklet-style markers.
function pMark(q, i) {
  return q.type === 'multi'
    ? String(i + 1)
    : q.subject === 'eng'
      ? String.fromCharCode(65 + i)
      : 'АБВГДЕЖ'[i];
}
// In the web build history task images live in per-topic packs (files/zno-t<N>.json), fetched on first use.
const ZNO_IMG = {},
  ZNO_REQ = {};
// Status line above the task while its pictures load, and a retry when they do not.
function znoStatus(state, c) {
  const host = $('.p-question') || $('#main');
  let el = $('#zno-status');
  if (!state) {
    el?.remove();
    return;
  }
  if (!el) {
    host.insertAdjacentHTML('afterbegin', '<p class="p-status" id="zno-status" role="status"></p>');
    el = $('#zno-status');
  }
  el.innerHTML =
    state === 'loading'
      ? 'Завантажую зображення завдання…'
      : `Не вдалося завантажити зображення. <button class="textbtn" onclick="znoRetry('${esc(c)}')">Повторити</button>`;
}
function znoRetry(c) {
  znoPack(c);
}
function znoPack(c) {
  znoStatus('loading', c);
  return (ZNO_REQ[c] =
    ZNO_REQ[c] ||
    fetch('files/zno-' + c + '.json')
      .then(r => {
        if (!r.ok) throw Error('pack');
        return r.json();
      })
      .then(m => {
        Object.assign(ZNO_IMG, m);
        document.querySelectorAll('img[data-zno]').forEach(i => {
          if (ZNO_IMG[i.dataset.zno]) i.src = ZNO_IMG[i.dataset.zno];
        });
        if (!document.querySelectorAll('img[data-zno]:not([src])').length) znoStatus('');
      })
      .catch(() => {
        delete ZNO_REQ[c];
        znoStatus('error', c);
      }));
}
function pImg(key, alt) {
  let src = DB.assets[key];
  if (!src) return '';
  if (src.startsWith('@zno:')) {
    if (!ZNO_IMG[key]) {
      setTimeout(() => znoPack(src.slice(5)));
      return `<img class="qimg" data-zno="${key}" alt="${esc(alt)}">`;
    }
    src = ZNO_IMG[key];
  }
  return `<img class="qimg" src="${src}" alt="${esc(alt)}" loading="lazy">`;
}
function pImgs(q) {
  const inl = (q.passage || '') + (q.prompt || ''),
    keys = (q.images || (q.image ? [q.image] : [])).filter(k => !inl.includes('⟦§m§' + k + '⟧'));
  return keys
    .map((k, i) =>
      pImg(k, keys.length > 1 ? `Зображення ${i + 1} до завдання` : 'Зображення до завдання')
    )
    .join('');
}
function pOptHTML(q, i) {
  const k = q.optionImages?.[i];
  return (
    (q.options[i] ? esc(q.options[i]) : '') +
    (k ? pImg(k, `Варіант ${pMark(q, i)}`).replace('class="qimg"', 'class="p-opt-img"') : '')
  );
}
function pRowHTML(q, i) {
  const k = q.rowImages?.[i];
  return (
    (q.left[i] ? esc(q.left[i]) : '') +
    (k ? pImg(k, `Зображення ${i + 1}`).replace('class="qimg"', 'class="p-opt-img"') : '')
  );
}
// History mock buttons name the real test they open instead of a variant number.
function znoTestLabel(sid, v) {
  const t = (sid === 'hist' ? stHistTests : stOfficial[sid] || [])[v - 1]?.[0];
  return t ? t.testName.replace(', демонстраційний варіант', ' · демо').replace(', ', ' · ') : '';
}
const znoMocks = pMocks;
pMocks = function (subject) {
  znoMocks(subject);
  document.querySelectorAll('[onclick^="pLaunchMock("]').forEach(b => {
    const m = b.getAttribute('onclick').match(/pLaunchMock\('(\w+)',(\d+)\)/);
    if (!m || m[1] === 'all') return;
    const l = znoTestLabel(m[1], +m[2]);
    if (l) b.textContent = l + ' ›';
  });
};
// Official tasks come without a written analysis yet: name the source and send the learner to the topic notes.
function pExplain(q) {
  if (!q.source) return q.explanation ? `<p>${esc(q.explanation)}</p>` : '';
  return `${q.explanation ? `<p class="p-explain">${esc(q.explanation)}</p>` : ''}<p class="p-caption">Офіційне завдання УЦОЯО · ${esc(q.source)}. ${q.keyUnverified ? 'Ключ узято з zno.osvita.ua: з офіційним аркушем відповідей УЦОЯО його не звірено.' : 'Ключ — за опублікованими відповідями.'}${q.keyNote ? ' ' + esc(q.keyNote) : ''}</p>${q.subject === 'hist' ? `<p><a href="#topic/${q.topic}">Повторити теорію теми ${q.topic} ›</a></p>` : ''}`;
}
// Topic checklist = the official programme minimum («знає») for the topic, item by item.
function znoProgramme(id) {
  const p = DB.historyProgramme?.[id];
  if (!p) return '';
  const block = (k, title, fmt) =>
    p[k]?.length
      ? `<div class="prog-block"><h3>${title}</h3><ul>${p[k].map(fmt).join('')}</ul></div>`
      : '';
  const plain = x => `<li>${esc(x)}</li>`,
    person = x =>
      x.startsWith('*')
        ? `<li>${esc(x.slice(1))} <span class="tag" title="Підкреслено в програмі: може бути завдання на впізнавання за портретом">фото</span></li>`
        : `<li>${esc(x)}</li>`;
  return `<section class="history-checklist history-programme"><h2>Що вимагає програма НМТ</h2><p>Мінімум із чинної програми ЗНО з історії України (наказ МОН № 696), за якою укладають тест НМТ. Позначка «фото» — персоналії, яких можуть запропонувати впізнати за портретом.</p>${block('D', 'Події та дати', plain)}${block('P', 'Персоналії', person)}${block('T', 'Поняття й терміни', plain)}${block('C', 'Пам’ятки культури', plain)}${block('G', 'На картосхемі', plain)}${p['Зміст'] ? `<p class="p-caption"><strong>Зміст розділу:</strong> ${esc(p['Зміст'])}</p>` : ''}<div class="p-actions"><button class="primary" onclick="pStart(T[${id}-1].questions,'Офіційні завдання · '+T[${id}-1].title,'t${id}-official')">Розв’язувати офіційні завдання теми ›</button></div></section>`;
}
const znoChecklist = historyChecklist;
historyChecklist = function (id) {
  return znoProgramme(id) + (HISTORY_GUIDES[id]?.checklist?.length ? znoChecklist(id) : '');
};
