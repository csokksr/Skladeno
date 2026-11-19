// Приріст за блок у веб-збірці (python -I tools/build.py --web): створення блоку, зріз до блоку, рядок на головній.
const {test,expect}=require('@playwright/test');
const WEB='http://127.0.0.1:8792/index.html';
test.describe('приріст за блок',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');
 test('блок створюється, зріз до блоку запускається, прогрес видно на сторінці й на головній',async({page})=>{
  test.setTimeout(120000);
  await page.goto(WEB);await page.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function');
  await page.evaluate(()=>{localStorage.clear()});await page.reload();await page.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function');
  await page.evaluate(()=>{fourthPick('eng');location.hash='growth'});
  await expect(page.locator('#main h1')).toHaveText('Приріст за блок');
  await page.getByRole('button',{name:'Математика'}).click();
  await page.locator('.p-topic-row input[type=checkbox]').first().check();
  await page.locator('.p-topic-row input[type=checkbox]').nth(1).check();
  await page.locator('#main').screenshot({path:process.env.SHOT||'test-results/growth-page.png'});
  await page.getByRole('button',{name:'Почати зріз до блоку'}).click();
  await expect(page.locator('#main .p-practice-top')).toBeVisible();
  await expect(page.locator('body')).toContainText('Зріз до блоку');
  const n=await page.evaluate(()=>P.growth.blocks[0].before.ids.length);
  expect(n).toBeGreaterThanOrEqual(5);
  await page.evaluate(()=>{location.hash='growth'});
  await expect(page.locator('.p-growth-block')).toHaveCount(1);
  await expect(page.locator('.p-growth-block')).toContainText('Зріз до блоку: 0 з '+n);
  await page.evaluate(()=>{location.hash='hub'});
  await expect(page.locator('.st-growth')).toContainText('пройди зріз до блоку');
 });
});
