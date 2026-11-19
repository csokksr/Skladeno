// Перший вхід: спершу вибір четвертого предмета, далі підготовка йде за ним.
const {test,expect}=require('@playwright/test');
const PAGE='/skladeno-nmt.html';
async function fresh(page){await page.goto(PAGE);await page.evaluate(()=>localStorage.clear());await page.goto(PAGE+'#hub')}

test.describe('вибір четвертого предмета при першому вході',()=>{
 test('нова людина бачить вибір замість головної, без вибору далі не пускає',async({page})=>{
  await fresh(page);
  await expect(page.locator('#main h1')).toContainText('четвертий предмет');
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.locator('input[name=fourth]:checked')).toHaveCount(0);
  await page.getByRole('button',{name:'Продовжити'}).click();
  await expect(page.locator('#fourth-err')).toContainText('Обери один із предметів');
  await expect(page.locator('#main h1')).toContainText('четвертий предмет');
 });

 test('після вибору біології головна, план і прогноз ідуть за ним, вибір переживає перезавантаження',async({page})=>{
  await fresh(page);
  await page.getByRole('radio',{name:/Біологія/}).check();
  await page.getByRole('button',{name:'Продовжити'}).click();
  await expect(page.locator('#main h1').first()).toContainText('підготовка до НМТ');
  await expect(page.locator('.ob-card')).toBeVisible();
  await expect(page.locator('.p-subject-list .p-subject-row').first()).toBeVisible();
  const order=await page.evaluate(()=>[...document.querySelectorAll('a.p-subject-row')].filter(a=>!a.closest('.p-other-subjects')).map(a=>a.getAttribute('href')));
  expect(order).toEqual(['#subject/ukr','#subject/math','#subject/hist','#subject/bio']);
  await expect(page.locator('.p-other-subjects')).toContainText('Англійська мова');
  await expect(page.locator('.ob-card')).toContainText('Біологія');
  await page.reload();
  await expect(page.locator('#main h1').first()).toContainText('підготовка до НМТ');
  expect(await page.evaluate(()=>P.study.fourth)).toBe('bio');
 });

 test('хто вже має відповіді, вибору не бачить',async({page})=>{
  await fresh(page);
  await page.evaluate(()=>{const q=PQ.find(q=>q.type==='single'&&!q.examOnly);P.answers[q.id]={value:0,score:1,max:1,first:1,attempts:1,at:Date.now(),due:Date.now()};pSave()});
  await page.goto(PAGE+'#hub');await page.reload();
  await expect(page.locator('#main h1').first()).toContainText('підготовка до НМТ');
 });
});
