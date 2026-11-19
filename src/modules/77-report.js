// «Знайшов помилку в завданні?»: готує текст для повідомлення (номер завдання, збірка, початок умови), який можна скопіювати.
// Куди його надіслати, вирішує автор проєкту: сайт нічого не передає сам.
function reportText(q) {
  const sub = SUB[q.subject]?.name || q.subject,
    build = typeof BUILD_ID === 'string' ? BUILD_ID : 'dev',
    prompt = String(q.prompt || '')
      .replace(/⟦§[a-z]+§/g, '')
      .replace(/[⟦⟧]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 200);
  return `Складено, збірка ${build}\nЗавдання: ${q.id} (${sub})\nУмова: ${prompt}\n\nЩо не так:\n`;
}
function reportOpen() {
  const q = pQ();
  if (!q) return;
  $('#modalbody').innerHTML =
    `<div class="p-section-head"><h2>Повідомити про помилку</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><p>Допиши, що не так, і надішли цей текст тому, хто веде проєкт. Номер завдання допоможе знайти його.</p><textarea id="report-text" rows="8" aria-label="Текст повідомлення">${esc(reportText(q))}</textarea><div class="p-actions"><button class="primary" onclick="reportCopy()">Скопіювати текст</button></div>`;
  $('#modal').showModal();
}
function reportCopy() {
  const box = $('#report-text');
  box.select();
  const done = () => toast('Текст скопійовано.'),
    fail = () => toast('Не вдалося скопіювати. Виділи текст і скопіюй вручну.');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(box.value).then(done, fail);
  else {
    try {
      document.execCommand('copy') ? done() : fail();
    } catch {
      fail();
    }
  }
}
const reportPracticeBase = pPractice;
pPractice = function () {
  reportPracticeBase();
  const q = pQ(),
    cx = pContext(),
    sec = $('.p-question');
  if (!q || !cx || cx.exam || cx.record || !sec) return;
  sec.insertAdjacentHTML(
    'beforeend',
    '<p class="p-caption"><button class="textbtn" onclick="reportOpen()">Знайшов помилку в завданні?</button></p>'
  );
};
