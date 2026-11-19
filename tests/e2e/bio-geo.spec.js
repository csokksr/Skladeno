// Біологія й географія у веб-збірці (python -I tools/build.py --web): теми за розділами програми, практика з картинкою, позначка незвіреного ключа,
// четвертий предмет НМТ на сторінці «Мій план» і пробник у форматі НМТ.
const {test,expect}=require('@playwright/test');
const WEB='http://127.0.0.1:8792/index.html';
async function open(page,hash=''){await page.goto(WEB+hash);await page.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function')}
test.describe('біологія й географія',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');

 test('предмет відкривається: розділи програми, теми й чесна примітка без конспекту',async({page})=>{
  test.setTimeout(120000);
  await open(page);await page.evaluate(()=>localStorage.clear());await open(page,'#subject/bio');
  await expect(page.locator('h1')).toHaveText('Біологія');
  await expect(page.locator('#main')).toContainText('Організм людини як біологічна система');
  await expect(page.locator('#main .p-topic-row').first()).toContainText('Біологія як наука про живе');
  await page.getByText('Біологія як наука про живе').first().click();
  await expect(page.locator('#main')).toContainText('Конспекту до цієї теми немає');
  await page.getByRole('button',{name:/Виконати завдання теми/}).click();
  await expect(page.locator('.p-question')).toBeVisible();
  await expect(page.locator('.p-question-meta')).toContainText(/ЗНО|НМТ/);
 });

 test('після відповіді видно ключ і примітку про звірку з аркушем УЦОЯО',async({page})=>{
  test.setTimeout(120000);
  await open(page);await page.evaluate(()=>localStorage.clear());await open(page);
  await page.evaluate(()=>packAll());
  const ids=await page.evaluate(()=>({un:PQ.find(q=>q.subject==='geo'&&q.keyUnverified&&q.type==='single').id,ok:PQ.find(q=>q.subject==='geo'&&!q.keyUnverified&&q.type==='single').id}));
  for(const [id,text] of [[ids.un,'не звірено'],[ids.ok,'за опублікованими відповідями']]){
   await page.evaluate(id=>{pStart([id],'t','t-'+id)},id);
   await page.locator('.p-option').first().click();
   await page.getByRole('button',{name:'Перевірити'}).click();
   await expect(page.locator('.p-feedback')).toContainText('Правильна відповідь');
   await expect(page.locator('.p-feedback')).toContainText(text);
  }
 });

 test('четвертий предмет НМТ обирається в плані й змінює прогноз і повну симуляцію',async({page})=>{
  test.setTimeout(120000);
  await open(page);await page.evaluate(()=>localStorage.clear());await open(page,'#plan');
  await page.evaluate(()=>{P.study.setupDone=true;pSave()});await open(page,'#plan');
  await expect(page.locator('.st-fc-grid')).toContainText('Англійська мова');
  await page.getByLabel('Четвертий предмет НМТ').selectOption('geo');
  await expect(page.locator('.st-fc-grid')).toContainText('Географія');
  await expect(page.locator('.st-fc-grid')).not.toContainText('Англійська мова');
  await expect(page.locator('.p-targets')).toContainText('Географія');
  await page.evaluate(()=>{location.hash='mocks'});
  await expect(page.locator('.p-full-exam')).toContainText('Історія + географія');
 });

 test('пробник з біології: 34 завдання й бал за шкалою 100–200',async({page})=>{
  test.setTimeout(120000);
  await open(page);await page.evaluate(()=>localStorage.clear());await open(page);
  await page.evaluate(()=>packAll());
  const r=await page.evaluate(()=>{window.confirm=()=>true;pLaunchMock('bio',1);const e=P.exam,n=e.ids.length;
   for(const id of e.ids){const q=PM[id];e.answers[id]=q.type==='numeric'?String(q.answer):q.answer}
   pFinishStage();const x=P.records[P.records.length-1];return {n,score:x.score,max:x.max,scale:nmtScale('bio',x.score)}});
  expect(r).toEqual({n:34,score:46,max:46,scale:200});
  await page.evaluate(()=>{location.hash='result/'+P.records[P.records.length-1].id});
  await expect(page.locator('#main')).toContainText('Біологія');
  await expect(page.locator('#main')).toContainText('200');
 });
});
