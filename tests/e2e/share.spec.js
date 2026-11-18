// Звіт посиланням у веб-збірці (python -I tools/build.py --web): створення на одному пристрої, відкриття на іншому.
const {test,expect}=require('@playwright/test');
const WEB='http://127.0.0.1:8792/index.html';
test.describe('звіт посиланням',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');
 test('посилання з прогресу відкривається в чистому браузері, а зіпсоване дає повідомлення',async({page,browser})=>{
  test.setTimeout(120000);
  const ready=p=>p.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function');
  await page.goto(WEB);await ready(page);await page.evaluate(()=>{localStorage.clear()});await page.reload();await ready(page);
  await page.evaluate(()=>{const t=Date.now();for(const q of PQ.filter(q=>q.type==='single'&&q.subject==='math').slice(0,50)){const s=q.id.length%2;P.answers[q.id]={value:0,score:s,max:1,first:s,attempts:1,at:t,due:t}}P.logs[pDay()]=9;pSave()});
  await page.evaluate(()=>{location.hash='analytics'});
  await page.locator('#rp-label').fill('Тест Учень');
  await page.getByRole('button',{name:'Створити посилання'}).click();
  const link=await page.locator('#rp-link').inputValue();
  expect(link).toContain('#report/');expect(link.length).toBeLessThan(1500);
  await page.locator('.st-share').screenshot({path:process.env.SHOT||'test-results/share-create.png'});
  // Інший «пристрій»: чистий контекст без прогресу.
  const ctx=await browser.newContext(),other=await ctx.newPage();
  await other.goto(link.replace(/^.*?(?=#report)/,WEB));await ready(other);
  await expect(other.locator('#main h1')).toContainText('Підготовка до НМТ · Тест Учень');
  await expect(other.locator('#main table')).toContainText('Математика');
  await expect(other.locator('#main')).toContainText('Відповідей за останні 7 днів: 9');
  await other.locator('#main').screenshot({path:process.env.SHOT2||'test-results/share-view.png'});
  expect(await other.evaluate(()=>Object.keys(P.answers).length)).toBe(0);
  await other.goto(WEB+'#report/AAAAAAAAAA');await other.waitForFunction(()=>location.hash==='#report/AAAAAAAAAA');
  await expect(other.locator('#main')).toContainText('Звіт не відкрився');
  await ctx.close();
 });
});
