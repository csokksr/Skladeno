// Пошук: фільтр за темою, виправлення помилок у запиті, підсвічування знайдених слів, історія запитів, посилання «До результатів».
// Адреса пошуку: #find/<запит>/<предмет>/<вид>/<сторінка>/<тема>.

/* Тема рядка індексу (лише там, де вона відома). */
function fpRowTopic(r) {
  switch (r.kind) {
    case 'lesson':
      return r.id.slice(7);
    case 'question':
      return PM[r.target]?.topicId || '';
    case 'fact':
    case 'portrait': {
      const t = FM[r.target]?.topic;
      return t ? 'hist-' + t : '';
    }
    case 'date': {
      const t = DB.historyChronology.entries.find(e => e.id === r.target)?.topic;
      return t ? 'hist-' + t : '';
    }
    case 'note': {
      const i = String(r.target).startsWith('S:') ? 'hist-' + String(r.target).slice(2) : r.target;
      return DB.quality.topics.some(t => t.id === i) ? i : PM[r.target]?.topicId || '';
    }
    default:
      return '';
  }
}
const fpTopics = sid => (sid ? DB.quality.topics.filter(t => t.subject === sid) : []);
const fpTopicOk = (sid, id) => !!id && fpTopics(sid).some(t => t.id === id);
const fpStateBase = findState;
findState = function () {
  const s = fpStateBase(),
    parts = location.hash.slice(1).split('/');
  let topic = '';
  try {
    topic = decodeURIComponent(parts[5] || '');
  } catch {}
  return { ...s, topic: fpTopicOk(s.subject, topic) ? topic : '' };
};
const fpRouteBase = findRoute;
findRoute = function (s) {
  const r = fpRouteBase(s);
  return fpTopicOk(findSubject(s.subject), s.topic) ? r + '/' + encodeURIComponent(s.topic) : r;
};
const fpResultsBase = findResults;
findResults = function (s) {
  const rows = fpResultsBase(s);
  return s.topic ? rows.filter(r => fpRowTopic(r) === s.topic) : rows;
};
findSubmit = function () {
  const subject = $('#find-subject').value,
    topic = $('#find-topic')?.value || '';
  go(
    findRoute({
      query: $('#find-query').value,
      subject,
      kind: $('#find-kind').value,
      topic: fpTopicOk(subject, topic) ? topic : '',
      page: 0,
    })
  );
};

/* Виправлення помилок: слово без жодного збігу замінюється найближчим словом із матеріалів (відстань до 1 для коротких слів, до 2 для довших). */
let fpVocab = null,
  fpFixCache = null;
// Словник: слова конспектів, карток, фактів і вправ, без нотаток користувача (вони змінюються), розкладені за довжиною слова.
function fpWords() {
  if (fpVocab) return fpVocab;
  const all = new Map();
  for (const r of findIndex()) {
    if (r.kind === 'note') continue;
    for (const w of r.searchKey.split(' ')) if (w.length >= 3) all.set(w, (all.get(w) || 0) + 1);
  }
  const by = new Map();
  for (const [w, n] of all) {
    let a = by.get(w.length);
    if (!a) by.set(w.length, (a = []));
    a.push([w, n]);
  }
  fpVocab = { all, by };
  return fpVocab;
}
function fpDist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      cur.push(v);
      if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
// Виправляються перші 4 слова запиту, решта лишається як є; результат кешується за рядком запиту.
function fpFix(query) {
  if (fpFixCache && fpFixCache.q === query) return fpFixCache.r;
  const v = fpWords(),
    all = findKey(query).split(' ').filter(Boolean),
    tokens = all.slice(0, 4),
    rest = all.slice(4);
  let changed = false;
  const out = tokens.map(t => {
    if (t.length < 4) return t;
    for (const w of v.all.keys()) if (w.includes(t)) return t;
    const max = t.length <= 5 ? 1 : 2;
    let best = null;
    for (let L = t.length - max; L <= t.length + max; L++)
      for (const [w, n] of v.by.get(L) || []) {
        const d = fpDist(t, w, max);
        if (d <= max && (!best || d < best.d || (d === best.d && n > best.n))) best = { w, d, n };
      }
    if (best) {
      changed = true;
      return best.w;
    }
    return t;
  });
  const r = changed ? [...out, ...rest].join(' ') : '';
  fpFixCache = { q: query, r };
  return r;
}
/* Підсвічування: слова запиту в тексті результату (без урахування регістру, з необов'язковим наголосом між літерами; довші слова раніше за коротші). */
function fpMark(text, query) {
  const toks = [
    ...new Set(
      String(query)
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(w => w.length >= 2)
    ),
  ]
    .sort((a, b) => b.length - a.length)
    .slice(0, 12);
  if (!toks.length) return esc(text);
  const accent = '[́̀́]?',
    one = w => [...w].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + accent).join('');
  const re = new RegExp('(' + toks.map(one).join('|') + ')', 'giu'),
    src = String(text);
  let out = '',
    last = 0,
    m;
  // Спершу пошук у чистому тексті, потім екранування шматків: так слова запиту не потрапляють усередину сутностей на кшталт &amp;.
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  return out + esc(src.slice(last));
}
/* Історія запитів: до 8 останніх, лише на цьому пристрої. Записується, коли запит надіслано з форми або відкрито результат. */
const FP_HIST_KEY = 'skladeno-find-history';
function fpHist() {
  try {
    const a = JSON.parse(localStorage.getItem(FP_HIST_KEY) || '[]');
    return Array.isArray(a)
      ? a
          .filter(x => typeof x === 'string' && x.trim())
          .map(x => x.slice(0, 60))
          .slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
function fpHistAdd(q) {
  q = String(q || '')
    .trim()
    .slice(0, 60);
  if (q.length < 2) return;
  try {
    localStorage.setItem(
      FP_HIST_KEY,
      JSON.stringify([q, ...fpHist().filter(x => x !== q)].slice(0, 8))
    );
  } catch {}
}
function fpHistClear() {
  try {
    localStorage.removeItem(FP_HIST_KEY);
  } catch {}
  findPage();
}
const fpOpenBase = findOpen;
findOpen = function (i) {
  fpHistAdd(findState().query);
  fpOpenBase(i);
};

function fpToResults() {
  const r = document.getElementById('find-results');
  if (r) {
    r.scrollIntoView();
    r.focus();
  }
}
const fpPageBase = findPage;
findPage = function () {
  fpPageBase();
  const s = findState(),
    form = $('.find-form');
  if (!form) return;
  // Тема
  const list = fpTopics(s.subject);
  form
    .querySelector('button[type=submit]')
    ?.insertAdjacentHTML(
      'beforebegin',
      `<div class="ref-field"><label for="find-topic">Тема</label><select id="find-topic" onchange="findSubmit()" ${s.subject ? '' : 'disabled'}><option value="">${s.subject ? 'Усі теми' : 'Спершу обери предмет'}</option>${list.map(t => `<option value="${esc(t.id)}" ${s.topic === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></div>`
    );
  if (s.topic) {
    const t = list.find(x => x.id === s.topic),
      chip = `<a class="chip" href="#${esc(findRoute({ ...s, topic: '', page: 0 }))}" aria-label="Прибрати фільтр тема ${esc(t?.title || '')}">Тема: ${esc(t?.title || '')} ×</a>`,
      box = $('.find-chips');
    if (box) {
      const reset = box.querySelector('.chip-reset');
      if (reset) reset.insertAdjacentHTML('beforebegin', chip);
      else box.insertAdjacentHTML('beforeend', chip);
    } else
      ($('#main [role=status]') || $('#main .find-results'))?.insertAdjacentHTML(
        'beforebegin',
        `<div class="find-chips" role="group" aria-label="Активні фільтри"><span>Фільтри:</span>${chip}</div>`
      );
  }
  // Підсвічування й посилання до результатів
  document.querySelectorAll('.find-table td[data-label="Знайдено"]').forEach(td => {
    const st = td.querySelector('strong'),
      sp = td.querySelector('span');
    if (st) st.innerHTML = fpMark(st.textContent, s.query);
    if (sp) sp.innerHTML = fpMark(sp.textContent, s.query);
  });
  const res = $('#main .find-results');
  if (res) {
    res.id = 'find-results';
    res.setAttribute('tabindex', '-1');
    form.insertAdjacentHTML(
      'afterend',
      '<button type="button" class="textbtn skip-link-local" onclick="fpToResults()">Перейти до результатів</button>'
    );
  }
  // Картки й PDF не мають теми
  if (s.topic && ['card', 'document'].includes(s.kind))
    form.insertAdjacentHTML(
      'afterend',
      '<p class="p-status">Картки й PDF не належать до тем, тому з фільтром за темою їх немає.</p>'
    );
  // Без збігів: підказка з виправленням. Рахується після малювання сторінки: перше побудування словника триває близько секунди.
  if (s.query && !res?.querySelector('.find-table')) {
    const at = location.hash;
    setTimeout(() => {
      if (location.hash !== at || document.getElementById('find-fix')) return;
      const fix = fpFix(s.query);
      if (fix)
        ($('#main [role=status]') || $('.find-form'))?.insertAdjacentHTML(
          'afterend',
          `<p class="p-status" id="find-fix">Можливо, ти шукав: <a href="#${esc(findRoute({ ...s, query: fix, page: 0 }))}">${esc(fix)}</a></p>`
        );
    }, 40);
  }
  // Історія
  const h = fpHist().filter(x => x !== s.query);
  if (h.length)
    form.insertAdjacentHTML(
      'afterend',
      `<p class="find-history">Останні запити: ${h.map(x => `<a class="chip" href="#${esc(findRoute({ query: x, subject: '', kind: '', page: 0 }))}">${esc(x)}</a>`).join(' ')} <button class="textbtn" onclick="fpHistClear()">Очистити</button></p>`
    );
  form.addEventListener('submit', () => fpHistAdd($('#find-query').value));
};
