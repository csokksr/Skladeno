/* Звіт для батьків чи вчителя посиланням #report/<gzip у base64url>. Підсумки (не окремі відповіді) пакуються в саме посилання:
   сервера немає, звіт бачить той, хто має посилання. Посилання з чужого джерела — недовірені дані: розпакування обмежене за розміром,
   усі поля перевіряються (rpClean) і лише потім показуються; сторінка звіту нічого не пише в прогрес глядача. */
const rpErr = msg => Object.assign(Error(msg), { rp: true }); // повідомлення, яке можна показати глядачеві
const RP_MAX = 32768; // найбільший розпакований звіт, байт
const RP_B64 = /^[A-Za-z0-9_-]{8,6000}$/;
async function rpPack(text) {
  let s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')),
    b = new Uint8Array(await new Response(s).arrayBuffer()),
    bin = '';
  for (let x of b) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function rpUnpack(str) {
  if (!RP_B64.test(str)) throw rpErr('Посилання пошкоджене.');
  try {
    let bytes = Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c =>
        c.charCodeAt(0)
      ),
      rd = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),
      n = 0,
      parts = [];
    for (;;) {
      let { done, value } = await rd.read();
      if (done) break;
      n += value.length;
      if (n > RP_MAX) {
        await rd.cancel();
        throw rpErr('Звіт завеликий.');
      }
      parts.push(value);
    }
    return new TextDecoder().decode(await new Blob(parts).arrayBuffer());
  } catch (e) {
    throw e?.rp ? e : rpErr('Посилання пошкоджене.');
  }
}

// Підсумки поточного прогресу: числа й коди тем, без назв, без окремих відповідей. label — необов'язковий підпис учня.
function rpData(label = '') {
  let today = pDay(),
    stats = weeklyStats(),
    aa = pAnswers(),
    bad = Object.keys(aa).filter(id => PM[id] && aa[id].score < aa[id].max),
    wk = weeklyCompare(),
    last = [...P.growth.blocks].reverse().find(b => growthResult(b)),
    gr = last && growthResult(last),
    active = 0;
  for (let i = 0; i < 14; i++) if ((P.logs[weeklyDay(-i, today)] || 0) > 0) active++;
  return {
    v: 1,
    day: today,
    label: String(label)
      .replace(/[\u0000-\u001f<>]/g, '')
      .trim()
      .slice(0, 40),
    exam: P.study.examDate || '',
    subjects: SUBJECTS.map(s => {
      let f = stForecast(s.id);
      return {
        sid: s.id,
        scale: f.enough ? f.scale : null,
        lo: f.enough ? f.scaleLo : null,
        hi: f.enough ? f.scaleHi : null,
        target: P.study.targets[s.id],
        n: stats[s.id].n,
        acc: weeklyPct(stats[s.id].a, stats[s.id].m),
      };
    }),
    weak: pWeakTopics(bad)
      .slice(0, 5)
      .map(t => ({ id: t.id, n: t.n })),
    active14: active,
    done7: weeklySum(today),
    week: wk.ref
      ? {
          days: wk.days,
          added: wk.added,
          fresh: wk.fresh,
          before: wk.before,
          active: wk.activeNow,
          activeThen: wk.activeThen,
        }
      : null,
    growth: gr
      ? {
          title: last.title.slice(0, 120),
          before: growthPct(gr.before),
          after: growthPct(gr.after),
        }
      : null,
  };
}
// Сувора перевірка недовіреного звіту: невідоме відкидається, числа обмежуються, рядки лишаються рядками (на сторінці їх екранує esc).
function rpClean(raw) {
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, a, b) => (Number.isFinite(v) && v >= a && v <= b ? Math.round(v) : null);
  const day = v =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))
      ? v
      : '';
  const scale = v => (v === 0 ? 0 : num(v, 100, 200));
  if (!obj(raw) || raw.v !== 1 || !day(raw.day) || !Array.isArray(raw.subjects))
    throw rpErr('Це не звіт Складено або посилання застаріле.');
  let subjects = [];
  for (let s of SUBJECTS) {
    let x = raw.subjects.find(y => obj(y) && y.sid === s.id);
    if (!x) throw rpErr('У звіті бракує предмета.');
    subjects.push({
      sid: s.id,
      scale: scale(x.scale),
      lo: scale(x.lo),
      hi: scale(x.hi),
      target: num(x.target, 100, 200),
      n: num(x.n, 0, 100000) ?? 0,
      acc: num(x.acc, 0, 100),
    });
  }
  let w = obj(raw.week) ? raw.week : null,
    g = obj(raw.growth) ? raw.growth : null;
  return {
    day: day(raw.day),
    label:
      typeof raw.label === 'string' ? raw.label.replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) : '',
    exam: day(raw.exam),
    subjects,
    weak: (Array.isArray(raw.weak) ? raw.weak : [])
      .filter(t => obj(t) && typeof t.id === 'string' && /^[\w-]{1,60}$/.test(t.id))
      .slice(0, 5)
      .map(t => ({ id: t.id, n: num(t.n, 0, 100000) ?? 0 })),
    active14: num(raw.active14, 0, 14) ?? 0,
    done7: num(raw.done7, 0, 100000) ?? 0,
    week: w
      ? {
          days: num(w.days, 7, 3650),
          added: num(w.added, -100000, 100000),
          fresh: num(w.fresh, 0, 100),
          before: num(w.before, 0, 100),
          active: num(w.active, 0, 7),
          activeThen: num(w.activeThen, 0, 7),
        }
      : null,
    growth:
      g && typeof g.title === 'string'
        ? {
            title: g.title.slice(0, 120),
            before: num(g.before, 0, 100),
            after: num(g.after, 0, 100),
          }
        : null,
  };
}
const rpTopicTitle = id => PT[id]?.title || T[Number(id.slice(5)) - 1]?.title || 'Тема ' + id;
const rpScale = (s, lo, hi) =>
  s === null ? '—' : s === 0 ? 'нижче порогу' : `${s} (${lo || '<100'}–${hi || '<100'})`;
function rpHTML(r) {
  let when = new Date(r.day + 'T12:00:00').toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    left = r.exam
      ? Math.max(
          0,
          Math.round((Date.parse(r.exam + 'T12:00:00') - Date.parse(r.day + 'T12:00:00')) / 864e5)
        )
      : null,
    sign = n => (n > 0 ? '+' : '') + n,
    rows = r.subjects
      .map(
        s =>
          `<tr><th scope="row">${esc(SUB[s.sid].short || SUB[s.sid].name)}</th><td>${rpScale(s.scale, s.lo, s.hi)}</td><td>${s.target ?? '—'}</td><td>${s.n}</td><td>${s.acc === null ? '—' : s.acc + '%'}</td></tr>`
      )
      .join('');
  return (
    pHeading(
      'Звіт про підготовку',
      'Підготовка до НМТ' + (r.label ? ' · ' + esc(r.label) : ''),
      `Це підсумки, а не окремі відповіді. Знімок на ${when}${left !== null ? `, до НМТ ${stPlural(left, 'день', 'дні', 'днів')} на той день.` : ''}`
    ) +
    `<section class="p-section"><h2>Прогноз за шкалою 100–200</h2><div class="tablewrap"><table class="speed-table"><thead><tr><th scope="col">Предмет</th><th scope="col">Прогноз (діапазон)</th><th scope="col">Ціль</th><th scope="col">Завдань розв’язано</th><th scope="col">Точність з першої спроби</th></tr></thead><tbody>${rows}</tbody></table></div><p class="p-caption">Прогноз орієнтовний: за таблицями НМТ-${NMT.year}, першими спробами й пробниками. Тире означає, що даних для прогнозу ще замало.</p></section>` +
    `<section class="p-section"><h2>Регулярність</h2><ul class="st-weekly-list"><li>Днів із заняттями за останні 14: <strong>${r.active14}</strong></li><li>Відповідей за останні 7 днів: <strong>${r.done7}</strong></li>${r.week ? `<li>Порівняно зі знімком ${stPlural(r.week.days, 'день', 'дні', 'днів')} тому: нових завдань <strong>${r.week.added === null ? '—' : sign(r.week.added)}</strong>, нові завдання з першої спроби <strong>${r.week.fresh === null ? 'замало даних' : r.week.fresh + '%'}</strong> проти ${r.week.before === null ? '—' : r.week.before + '%'}, днів із заняттями ${r.week.active ?? '—'} проти ${r.week.activeThen ?? '—'}</li>` : ''}</ul></section>` +
    (r.weak.length
      ? `<section class="p-section"><h2>Де найбільше помилок</h2><ol>${r.weak.map(t => `<li>${esc(rpTopicTitle(t.id))}: ${stPlural(t.n, 'помилка', 'помилки', 'помилок')}</li>`).join('')}</ol></section>`
      : '') +
    (r.growth
      ? `<section class="p-section"><h2>Приріст за блок</h2><p>${esc(r.growth.title)}: було <strong>${r.growth.before}%</strong> → стало <strong>${r.growth.after}%</strong>. Зрізи малі, тож різницю в кілька відсотків не варто читати як точну.</p></section>`
      : '') +
    `<p class="p-caption">Звіт зібрано на пристрої учня й упаковано в це посилання: сервера немає, окремих відповідей у посиланні немає. Кожен, хто має посилання, бачить ці підсумки.</p><div class="p-actions"><button onclick="window.print()">Друкувати</button><a href="#hub">Відкрити сайт ›</a></div>`
  );
}
// Сторінка #report/<посилання>: не читає й не пише прогрес глядача.
async function rpPage(payload) {
  let at = location.hash;
  $('#main').innerHTML = '<p class="p-caption" role="status">Відкриваю звіт…</p>';
  let html;
  try {
    html = rpHTML(rpClean(JSON.parse(await rpUnpack(payload))));
  } catch (e) {
    html = `<section class="p-section"><h1>Звіт не відкрився</h1><p>${esc(e?.rp ? e.message : 'Посилання пошкоджене або не повне. Попроси надіслати його ще раз.')}</p><p><a href="#hub">Відкрити сайт ›</a></p></section>`;
  }
  if (location.hash === at) $('#main').innerHTML = html;
}
async function rpLink() {
  let label = $('#rp-label')?.value || '',
    link = location.href.split('#')[0] + '#report/' + (await rpPack(JSON.stringify(rpData(label))));
  $('#rp-out').innerHTML =
    `<label class="p-caption" for="rp-link">Посилання на звіт (${link.length} символів)</label><input id="rp-link" readonly value="${esc(link)}" onfocus="this.select()"><div class="p-actions"><button onclick="rpCopy()">Скопіювати посилання</button></div>`;
}
function rpCopy() {
  let box = $('#rp-link');
  box.select();
  let ok = () => toast('Посилання скопійовано.'),
    fail = () => toast('Не вдалося скопіювати. Виділи посилання й скопіюй вручну.');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(box.value).then(ok, fail);
  else {
    try {
      document.execCommand('copy') ? ok() : fail();
    } catch {
      fail();
    }
  }
}
function rpShareHTML() {
  return '<section class="p-section st-share"><div class="p-section-head"><div><h2>Звіт для батьків чи вчителя</h2><p class="p-caption">Посилання з підсумками: прогноз, регулярність, слабкі теми. Сервера немає, звіт упаковано в саме посилання, і його бачить кожен, хто його має. Підпис необов’язковий; не пиши в ньому те, чим не хочеш ділитися.</p></div></div><div class="p-actions"><input id="rp-label" maxlength="40" placeholder="Підпис, наприклад ім’я" aria-label="Підпис звіту"><button class="primary" onclick="rpLink()">Створити посилання</button></div><div id="rp-out"></div></section>';
}
const rpRenderBase = render;
render = function () {
  let p = (location.hash.slice(1) || 'hub').split('/');
  if (p[0] === 'report') {
    route = 'report';
    rpPage(p[1] || '');
    document.title = 'Звіт про підготовку · Складено';
    syncSiteNavigation();
    return;
  }
  rpRenderBase();
};
const rpCrumbsBase = siteCrumbs;
siteCrumbs = function () {
  return (location.hash.slice(1) || 'hub').split('/')[0] === 'report'
    ? [
        { label: 'Головна', to: 'hub' },
        { label: 'Звіт про підготовку', to: 'hub' },
      ]
    : rpCrumbsBase();
};
const rpAnalyticsBase = pAnalytics;
pAnalytics = function () {
  rpAnalyticsBase();
  $('#main').insertAdjacentHTML('beforeend', rpShareHTML());
};
