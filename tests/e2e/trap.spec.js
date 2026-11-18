// «Ще на ту саму пастку» у веб-збірці (python -I tools/build.py --web): блок на маршруті й кнопка під завданням з помилкою.
const {test,expect}=require('@playwright/test');
const WEB='http://127.0.0.1:8792/index.html';
test.describe('та сама пастка',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');
 test('блок на маршруті веде до добірки, а під завданням з помилкою є кнопка',async({page})=>{
  test.setTimeout(120000);
  const ready=()=>page.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function');
  await page.goto(WEB);await ready();await page.evaluate(()=>{localStorage.clear()});await page.reload();await ready();
  await page.evaluate(()=>packAll());
  await page.evaluate(()=>{location.hash='coach'});
  await expect(page.locator('#main')).toContainText('Після помилки познач причину');
  const first=await page.evaluate(()=>{const g={};for(const q of PQ.filter(q=>q.subject==='math'&&q.year&&q.type==='single'&&!q.challenge&&!q.examOnly))(g[trapKey(q)]??=[]).push(q.id);
   const ids=Object.values(g).sort((a,b)=>b.length-a.length)[0].slice(0,3);const t=Date.now();
   for(const id of ids){P.answers[id]={value:1,score:0,max:1,first:0,attempts:1,at:t,due:t};coachItem(id).reason='reading'}pSave();return ids[0]});
  await page.evaluate(()=>{location.hash='hub';render();location.hash='coach';render()});
  await expect(page.locator('.st-trap')).toContainText('Неправильно прочитав умову');
  await page.locator('.st-trap').screenshot({path:process.env.SHOT||'test-results/trap-coach.png'});
  await page.getByRole('button',{name:/Тренувати/}).click();
  await expect(page.locator('body')).toContainText('Та сама пастка');
  // Під завданням з помилкою і позначеною причиною: кнопка «Ще … на цю пастку».
  await page.evaluate(id=>{pStart([id],'t','t-trap')},first);
  await expect(page.getByRole('button',{name:/на цю пастку/})).toBeVisible();
 });
});
