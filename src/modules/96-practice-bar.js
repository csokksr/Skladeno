// Рядок дій практики: на видноті зберегти, позначка «Повернутися», бланк (пробник) і показ часу секундоміра; решта кнопок у «Ще».
// Модулі 20–95 дописують кнопки в .p-actions як раніше; цей модуль після них розкладає їх. Нова кнопка потрапляє в «Ще» сама.
const PB_KEEP = /pPin\(|navFlagToggle\(|insSheet\(/;
// Перемикачі в «Ще» перемальовують сторінку: після цього відкриваємо меню й вертаємо фокус на ту саму дію.
const pbPracticeBase = pPractice;
pPractice = function () {
  const was = document.activeElement,
    key = was && was.closest && was.closest('.p-more-list') ? was.getAttribute('onclick') : null;
  pbPracticeBase();
  const c = pContext(),
    q = pQ(),
    acts = $('#main .p-practice-top .p-actions');
  if (!c || !q || !acts) return;
  const rest = [...acts.querySelectorAll(':scope>button')].filter(
    b => !PB_KEEP.test(b.getAttribute('onclick') || '')
  );
  if (rest.length) {
    const d = document.createElement('details');
    d.className = 'p-more';
    const s = document.createElement('summary');
    s.textContent = 'Ще';
    const l = document.createElement('div');
    l.className = 'p-more-list';
    l.append(...rest);
    d.append(s, l);
    acts.append(d);
    if (key) {
      const b = rest.find(x => x.getAttribute('onclick') === key);
      if (b) {
        d.open = true;
        b.focus();
      }
    }
  }
  const p = $('#main .p-practice-top');
  if (p && !$('#main h1'))
    p.insertAdjacentHTML(
      'afterbegin',
      `<h1 class="sr-only">${esc(c.title)}: завдання ${c.index + 1} із ${c.ids.length}</h1>`
    );
};
