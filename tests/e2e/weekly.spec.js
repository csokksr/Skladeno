// «Ти проти себе тиждень тому» у веб-збірці (python -I tools/build.py --web): знімок, порівняння на головній і в «Прогресі».
const {test,expect}=require('@playwright/test');
const WEB='http://127.0.0.1:8792/index.html';
test.describe('тижневе порівняння',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');
 test('перший знімок, потім порівняння з тижневим',async({page})=>{
  test.setTimeout(120000);
  const ready=()=>page.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function');
  await page.goto(WEB);await ready();await page.evaluate(()=>{localStorage.clear()});await page.reload();await ready();await page.evaluate(()=>{fourthPick('eng');render()});
  await expect(page.locator('.st-weekly')).toContainText('Знімок з’явиться');
  await page.evaluate(()=>{const t=Date.now();for(const q of PQ.filter(q=>q.type==='single'&&q.subject==='ukr').slice(0,30)){P.answers[q.id]={value:0,score:1,max:1,first:1,attempts:1,at:t,due:t}}pSave();render()});
  await expect(page.locator('.st-weekly')).toContainText('Перший знімок зроблено');
  expect(await page.evaluate(()=>P.weekly.snaps.length)).toBe(1);
  // Знімок віком 8 днів і нові відповіді: з'являється порівняння.
  await page.evaluate(()=>{P.weekly.snaps[0].day=weeklyDay(-8);const t=Date.now();for(const q of PQ.filter(q=>q.type==='single'&&q.subject==='ukr').slice(30,50)){P.answers[q.id]={value:0,score:q.id.length%2,max:1,first:q.id.length%2,attempts:1,at:t,due:t}}P.logs[pDay()]=20;pSave();location.hash='hub';render()});
  await expect(page.locator('.st-weekly')).toContainText('8 днів тому');
  await page.locator('.st-weekly').screenshot({path:process.env.SHOT||'test-results/weekly-hub.png'});
  await page.evaluate(()=>{location.hash='analytics'});
  await expect(page.locator('.st-weekly table')).toBeVisible();
 });
});
