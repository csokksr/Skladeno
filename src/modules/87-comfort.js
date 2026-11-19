// Зручність і доступність: позначки помилок у полях (aria-invalid, aria-describedby), міжряддя й розмір шрифту, «Наступна тема», повернення на попереднє місце
// сторінки, «Нагору», підказка клавіш, копіювання умови завдання. Додатково: посилання на пошук і результати.

/* 50. Поле з помилкою: aria-invalid, повідомлення поруч (role=alert) і зв'язок через aria-describedby. Знімається, коли поле змінюють. */
function fieldError(el, msg) {
  if (!el) return;
  const id = (el.id || 'fld') + '-err';
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement('p');
    box.id = id;
    box.className = 'p-error';
    box.setAttribute('role', 'alert');
    el.insertAdjacentElement('afterend', box);
  }
  box.textContent = msg;
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', id);
  // Лише input: change спрацьовує після вбудованого onchange поля й одразу зняв би щойно показану помилку.
  if (!el.dataset.errBound) {
    el.dataset.errBound = '1';
    el.addEventListener('input', () => fieldClear(el));
  }
  if (el.focus) el.focus();
}
function fieldClear(el) {
  if (!el) return;
  el.removeAttribute('aria-invalid');
  el.removeAttribute('aria-describedby');
  document.getElementById((el.id || 'fld') + '-err')?.remove();
}
const comfortCheckBase = pCheck;
pCheck = function () {
  comfortCheckBase();
  const c = pContext(),
    q = pQ(),
    inp = $('#p-numeric');
  if (!c || c.exam || c.record || !q || !inp || q.type !== 'numeric') return;
  if (!pValid(q, pVal(q)))
    fieldError(inp, 'Введи число. Для десяткових дробів підійде кома або крапка.');
};
const comfortStSetBase = stSet;
stSet = function (field, value) {
  comfortStSetBase(field, value);
  if (field !== 'examDate') return;
  const inp = document.querySelector('input[type=date][onchange*="examDate"]');
  if (!inp) return;
  if (stFutureDate(value)) fieldClear(inp);
  else {
    if (!inp.id) inp.id = 'exam-date';
    fieldError(inp, 'Дата НМТ має бути справжньою датою в майбутньому.');
  }
};

/* 53. Розмір шрифту (16–24) і міжряддя. Типово лишається те, що було: міжряддя змінюється лише після вибору. */
const COMFORT_LH_KEY = 'skladeno-lh',
  COMFORT_FONT_KEY = 'skladeno-font',
  COMFORT_LH = [
    ['', 'Стандартне'],
    ['2', 'Просторе'],
    ['2.3', 'Дуже просторе'],
  ]; // від 2: більше за будь-яке міжряддя сторінок (найбільше 1.9), тож вибір нічого не зменшує
function comfortLhApply() {
  let v = '';
  try {
    v = localStorage.getItem(COMFORT_LH_KEY) || '';
  } catch {}
  if (COMFORT_LH.some(([k]) => k === v) && v) document.documentElement.dataset.lh = v;
  else delete document.documentElement.dataset.lh;
}
function comfortLhSet(v) {
  if (!COMFORT_LH.some(([k]) => k === v)) return;
  try {
    if (v) localStorage.setItem(COMFORT_LH_KEY, v);
    else localStorage.removeItem(COMFORT_LH_KEY);
  } catch {}
  comfortLhApply();
}
function comfortFontSet(v) {
  const n = Number(v);
  if (![16, 18, 20, 22, 24].includes(n)) return;
  document.documentElement.style.fontSize = n + 'px';
  try {
    localStorage.setItem(COMFORT_FONT_KEY, String(n));
  } catch {}
}
comfortLhApply();
{
  let n = 0;
  try {
    n = Number(localStorage.getItem(COMFORT_FONT_KEY));
  } catch {}
  if ([22, 24].includes(n)) document.documentElement.style.fontSize = n + 'px';
}
const comfortSettingsBase = pSettings;
pSettings = function () {
  comfortSettingsBase();
  const sel = $('#p-text-size');
  if (sel) {
    sel.setAttribute('onchange', 'comfortFontSet(this.value)');
    const cur =
      Number(String(document.documentElement.style.fontSize || '').replace('px', '')) ||
      pFontSize();
    sel.innerHTML = [16, 18, 20, 22, 24]
      .map(n => `<option value="${n}" ${cur === n ? 'selected' : ''}>${n} px</option>`)
      .join('');
  }
  const holder = sel?.closest('section');
  let lh = '';
  try {
    lh = localStorage.getItem(COMFORT_LH_KEY) || '';
  } catch {}
  holder?.insertAdjacentHTML(
    'beforeend',
    `<label for="p-lh" class="gap">Міжряддя</label><select id="p-lh" onchange="comfortLhSet(this.value)">${COMFORT_LH.map(([k, l]) => `<option value="${k}" ${lh === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`
  );
};

/* 54. «Наступна тема» наприкінці конспекту (за порядком тем предмета); після останньої веде на сторінку предмета. */
function comfortNext(id) {
  const list = DB.quality.topics.filter(
      t => t.subject === DB.quality.topics.find(x => x.id === id)?.subject
    ),
    i = list.findIndex(t => t.id === id);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
}
const comfortLessonBase = pLesson;
pLesson = function (id) {
  comfortLessonBase(id);
  const t = DB.quality.topics.find(x => x.id === id),
    box = $('#main .p-reading') || $('#main .panel');
  if (!t || !box) return;
  const n = comfortNext(id);
  box.insertAdjacentHTML(
    'afterend',
    `<div class="p-actions p-next-topic">${n ? `<a class="p-btn primary" href="#${esc(n.route)}">Наступна тема: ${esc(n.title)} ›</a>` : `<a class="p-btn" href="#subject/${esc(t.subject)}">Усі теми предмета ›</a>`}</div>`
  );
};
const comfortTopicBase = topic;
topic = function () {
  comfortTopicBase();
  const id = Number(route.split('/')[1]);
  if (!(id >= 1 && id < 32) || !$('#main')) return;
  const n = T[id];
  if (n)
    $('#main').insertAdjacentHTML(
      'beforeend',
      `<div class="p-actions p-next-topic"><a class="p-btn primary" href="#topic/${id + 1}">Наступна тема: ${esc(n.title)} ›</a></div>`
    );
};

/* 55. Повернення на попереднє місце: позиція прокручування лежить у стані запису історії, тож її має лише перехід «Назад» чи «Вперед»; новий перехід починається зверху. */
try {
  history.scrollRestoration = 'manual';
} catch {}
let comfortScrollTimer = null;
addEventListener(
  'scroll',
  () => {
    clearTimeout(comfortScrollTimer);
    comfortScrollTimer = setTimeout(() => {
      try {
        history.replaceState({ sy: Math.round(window.scrollY || 0) }, '');
      } catch {}
      comfortTopPaint();
    }, 200);
  },
  { passive: true }
);
function comfortRestore() {
  let y = null;
  try {
    y = history.state && history.state.sy;
  } catch {}
  if (Number.isFinite(y) && y > 0) requestAnimationFrame(() => scrollTo(0, y));
}
addEventListener('hashchange', comfortRestore);
setTimeout(comfortRestore, 0);

/* 56 і 52. «Нагору» (плаваюча кнопка на довгих сторінках) і посилання «До пошуку» та «Нагору» наприкінці сторінки. */
const comfortTop = document.createElement('button');
comfortTop.type = 'button';
comfortTop.id = 'to-top';
comfortTop.className = 'to-top';
comfortTop.hidden = true;
comfortTop.setAttribute('aria-label', 'Нагору');
comfortTop.textContent = '↑';
comfortTop.onclick = () => {
  scrollTo(0, 0);
  const h = $('#main h1') || $('#main h2');
  if (h) {
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }
};
document.body.append(comfortTop);
function comfortTopPaint() {
  const base = (location.hash.slice(1) || 'hub').split('/')[0],
    quiet = ['practice', 'simulate', 'official-run', 'checkpoint', 'result-review'].includes(base);
  comfortTop.hidden = quiet || !((window.scrollY || 0) > 900);
}
const comfortFootBase = pFoot;
pFoot = function () {
  return comfortFootBase().replace(
    '</footer>',
    '<a href="#find">До пошуку ›</a><button type="button" class="textbtn" onclick="scrollTo(0,0)">Нагору ↑</button></footer>'
  );
};

/* 57 і 58. Під завданням: які клавіші працюють. У практиці: копіювання умови. */
function comfortKeys(q) {
  const on = typeof hotkeysOn !== 'function' || hotkeysOn(),
    parts = [];
  if (on && ['single', 'multi'].includes(q.type))
    parts.push('1–' + Math.min(8, q.options.length) + ' — обрати варіант');
  parts.push(q.type === 'numeric' ? 'Enter поза полем — перевірити' : 'Enter — перевірити');
  parts.push('← і → — інше завдання');
  return 'Клавіші: ' + parts.join(', ') + '.';
}
function comfortPromptText(q) {
  const lines = [];
  if (q.passage) lines.push(dtPlain(q.passage));
  lines.push(dtPlain(q.prompt));
  if (Array.isArray(q.options) && ['single', 'multi', 'order'].includes(q.type))
    q.options.forEach((o, i) => lines.push(insLetter(i) + ') ' + dtPlain(o)));
  if (q.type === 'match' && Array.isArray(q.left)) {
    q.left.forEach((l, i) => lines.push(i + 1 + ') ' + dtPlain(l)));
    (q.right || q.options || []).forEach((r, i) => lines.push(insLetter(i) + ') ' + dtPlain(r)));
  }
  return lines.filter(Boolean).join('\n');
}
function comfortCopy() {
  const q = pQ();
  if (!q) return;
  const text = comfortPromptText(q),
    done = () => toast('Умову скопійовано.'),
    fail = () => toast('Не вдалося скопіювати. Виділи текст умови вручну.');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fail);
  else fail();
}
const comfortPracticeBase = pPractice;
pPractice = function () {
  comfortPracticeBase();
  const c = pContext(),
    q = pQ();
  if (!c || !q) return;
  const qa = $('.p-question-actions');
  if (qa && !c.record && !c.exam)
    qa.insertAdjacentHTML(
      'beforebegin',
      `<p class="p-caption kbd-hint">${esc(comfortKeys(q))}</p>`
    );
  const acts = $('.p-practice-top .p-actions');
  if (acts && !c.exam && !c.record)
    acts.insertAdjacentHTML(
      'beforeend',
      '<button onclick="comfortCopy()">Копіювати умову</button>'
    );
};
comfortTopPaint();

/* Прокручувані таблиці доступні з клавіатури (axe: scrollable-region-focusable): фокус і назва для тих, що справді не вміщуються. */
function comfortScrollRegions() {
  document.querySelectorAll('#main .tablewrap').forEach(el => {
    const need = el.scrollWidth > el.clientWidth + 1;
    if (need) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'region');
      if (!el.hasAttribute('aria-label'))
        el.setAttribute('aria-label', 'Таблиця, її можна прокручувати');
    } else if (el.dataset.comfortScroll) {
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
    }
    el.dataset.comfortScroll = need ? '1' : '';
  });
}
const comfortScrollRenderBase = render;
render = function () {
  comfortScrollRenderBase();
  comfortScrollRegions();
};
{
  let t = null;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(comfortScrollRegions, 200);
  });
}
