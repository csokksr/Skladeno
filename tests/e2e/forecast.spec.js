// «Де найдешевше взяти бали»: блок на головній і в плані (веб-збірка, python -I tools/build.py --web).
const {test,expect}=require('@playwright/test');
const WEB='http://127.0.0.1:8792/index.html';
const SEED=()=>{const t0=Date.now()-864e5;let n=0;
 for(const sid of ['ukr','math'])for(const t of DB.quality.topics.filter(t=>t.subject===sid).slice(0,8)){n++;for(const id of t.questions){const q=PM[id];if(!q||q.challenge)continue;const ok=n%3===0;P.answers[id]={value:0,score:ok?pMax(q):0,max:pMax(q),first:ok?pMax(q):0,attempts:1,at:t0,due:t0}}}
 pSave()};
test.describe('найвигідніші теми',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');
 test('на головній і в плані показано три теми з прогресу, а без даних блоку немає',async({page})=>{
  test.setTimeout(120000);
  await page.goto(WEB);await page.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function');
  await page.evaluate(()=>{localStorage.clear()});await page.reload();await page.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function');
  await expect(page.locator('.st-best')).toHaveCount(0);
  await page.evaluate(SEED);await page.evaluate(()=>{location.hash='plan';render();location.hash='hub';render()});
  await expect(page.locator('.st-best .p-topic-row')).toHaveCount(3);
  await page.locator('.st-best').screenshot({path:process.env.SHOT||'test-results/st-best-hub.png'});
  await page.evaluate(()=>{location.hash='plan'});
  await expect(page.locator('.st-best .p-topic-row')).toHaveCount(3);
 });
});
