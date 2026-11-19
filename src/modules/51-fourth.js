// First visit: the fourth NMT subject is chosen before anything else. Plan, forecast, mocks, coach and the hub follow it (subjActive).
function fourthNeeded() {
  return !P.study.fourthChosen && !P.study.setupDone && !Object.keys(pAnswers()).length;
}
function fourthCard() {
  const opts = FOURTH_SUBJECTS.map(id => {
    const s = SUB[id];
    return `<label class="p-choice" style="--subject:${s.color}"><input type="radio" name="fourth" value="${id}"><span><strong>${esc(s.name)}</strong><span class="p-caption">${EXAMINFO[id].count} завдань, до ${EXAMINFO[id].max} балів у тесті</span><span class="p-caption">${esc(s.description)}</span></span></label>`;
  }).join('');
  return (
    pHeading(
      '',
      'Обери четвертий предмет НМТ',
      'Українську мову, математику та історію України складають усі. Четвертий предмет на вибір: від нього залежать план, прогноз, пробники й добірки.'
    ) +
    `<form class="p-form" onsubmit="event.preventDefault();fourthSave()"><fieldset class="p-fieldset"><legend>Предмет на вибір</legend><div class="p-choices">${opts}</div></fieldset><p class="p-caption" id="fourth-err" role="alert"></p><div class="p-actions"><button class="primary" type="submit">Продовжити ›</button></div><p class="p-caption">Вибір можна змінити пізніше в «Мій план».</p></form>`
  );
}
function fourthPick(v) {
  if (!FOURTH_SUBJECTS.includes(v)) return false;
  stSet('fourth', v);
  pSave();
  return true;
}
function fourthSave() {
  if (fourthPick(document.querySelector('input[name=fourth]:checked')?.value)) render();
  else $('#fourth-err').textContent = 'Обери один із предметів, щоб продовжити.';
}
const fourthHub = pHub;
pHub = function () {
  if (!fourthNeeded()) return fourthHub();
  $('#main').innerHTML = fourthCard();
  pFoot();
};
