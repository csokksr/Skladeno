// Веб-збірка (dist/web): ядро даних і пакети текстів завдань. Еталон: автономний файл з усіма даними.
const {test,expect}=require('@playwright/test');
const STD='http://127.0.0.1:8791/skladeno-nmt.html',WEB='http://127.0.0.1:8792/index.html';
// Відповіді датовані 10 днів тому опівдні: межі «сьогодні» й «за останню добу» не залежать від часу прогону.
const SEED=()=>{const ids=[];for(const s of ['ukr','math','eng','hist'])ids.push(...PQ.filter(q=>q.subject===s).slice(0,40).map(q=>q.id));
 const t0=new Date(Date.now()-10*864e5).setHours(12,0,0,0);ids.forEach((id,i)=>{P.answers[id]={value:0,score:i%3?0:1,max:1,first:0,attempts:1+i%3,at:t0+i*1000,due:t0};if(i%5===0)P.pins.push(id)});P.logs[pDay()]=12;pSave()};
const LIGHT=['hub','subject/ukr','subject/math','subject/eng','subject/hist','mocks','analytics','plan','library','tests','rhythm','about','graph','strategy','topics','topic/3','cards','history-archive','advanced','quality','coach','audit'];

async function fresh(page,url){await page.goto(url);await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.goto(url);await page.evaluate(SEED)}
async function texts(page,url,routes){const out={};await fresh(page,url);
 for(const r of routes){await page.goto(url+'#hub');await page.waitForTimeout(150);await page.evaluate(r=>{location.hash=r;render()},r);await page.waitForTimeout(350);out[r]=await page.evaluate(()=>document.querySelector('#main').innerText)}
 return out}

test.describe('веб-збірка з пакетами',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');

 test('сторінки без текстів завдань однакові з повними даними, коли пакети не приходять',async({page})=>{
  test.setTimeout(240000);
  const full=await texts(page,STD,LIGHT);
  await page.route('**/files/pack-*.js',r=>r.abort());
  const web=await texts(page,WEB,LIGHT);
  for(const r of LIGHT)expect.soft(web[r],r).toBe(full[r]);
 });

 test('після завантаження пакетів об’єкти завдань і тем збігаються з повними даними',async({page})=>{
  test.setTimeout(120000);
  const dump=()=>({pq:PQ.map(q=>JSON.stringify(q,Object.keys(q).filter(k=>k!=='_h').sort())),pt:Object.keys(PT).map(k=>JSON.stringify(PT[k],Object.keys(PT[k]).filter(k=>k!=='_h').sort())),q:Q.map(q=>JSON.stringify(q,Object.keys(q).filter(k=>k!=='_h').sort()))});
  await page.goto(STD);const a=await page.evaluate(dump);
  await page.goto(WEB);await page.evaluate(()=>packAll());const b=await page.evaluate(dump);
  for(const k of ['pq','pt','q']){expect(b[k].length).toBe(a[k].length);expect(b[k].filter((s,i)=>s!==a[k][i]).length,k).toBe(0)}
 });

 test('сторінки з текстами чекають пакети, а не показують порожнє',async({page})=>{
  test.setTimeout(120000);
  await page.goto(WEB+'#hub');
  const id=await page.evaluate(()=>Object.keys(PT)[3]);
  await page.evaluate(id=>{location.hash='lesson/'+id},id);
  await expect(page.locator('#main .p-reading')).toBeVisible();
  await expect(page.locator('#main h1').first()).toBeVisible();
 });

 test('без пакетів сторінка з текстами каже про помилку, а читання поля кидає помилку',async({page})=>{
  await page.route('**/files/pack-*.js',r=>r.abort());
  await page.goto(WEB+'#hub');
  const r=await page.evaluate(()=>{const q=PQ.find(q=>q._h&&q._h.includes('prompt'));try{void q.prompt;return 'no throw'}catch(e){return e.message}});
  expect(r).toMatch(/pack not loaded/);
  await page.evaluate(()=>{location.hash='coverage'});
  await expect(page.getByText('Матеріали не завантажилися')).toBeVisible();
  await expect(page.locator('#main h1')).toHaveCount(1);
 });

 test('практика у веб-збірці: вибрати варіант і перевірити',async({page})=>{
  test.setTimeout(120000);
  await page.goto(WEB+'#hub');
  await page.evaluate(()=>packAll());
  await page.evaluate(()=>{const q=PQ.find(q=>q.type==='single'&&!q.examOnly&&q.subject!=='hist');pStart([q.id],'e2e','e2e');location.hash='#practice'});
  await expect(page.locator('#main .p-option').first()).toBeVisible();
  await page.locator('#main .p-option').first().click();
  await page.getByRole('button',{name:'Перевірити'}).first().click();
  await expect(page.locator('.p-feedback').first()).toBeVisible();
 });
});

test.describe('прогрес у веб-збірці',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');
 // Прогрес перевіряється на старті за довжинами списків завдання; веб-збірка (заглушки) має зберегти те саме, що автономний файл.
 test('відповіді на завдання з варіантами переживають перезавантаження так само, як в автономному файлі, і не потрапляють у -corrupt',async({page})=>{
  test.setTimeout(120000);
  const run=async url=>{await fresh(page,url);
   await page.evaluate(()=>{const ids=[];for(const t of ['single','match','multi','numeric','order']){for(const s of ['ukr','math','eng']){const q=PQ.find(q=>q.type===t&&q.subject===s);if(q)ids.push(q.id)}}
    const h=PQ.find(q=>q.subject==='hist'&&q.type==='match');if(h)ids.push(h.id);
    ids.forEach(id=>{const q=PM[id];P.answers[id]={value:q.type==='match'?[0,1,2,3,4,5].slice(0,q.left?q.left.length:4):q.type==='multi'?[0,1,2]:q.type==='order'?[0,1,2,3]:q.type==='numeric'?'1':0,score:0,max:1,first:0,attempts:1,at:Date.now(),due:Date.now()}});pSave()});
   await page.reload();
   return page.evaluate(()=>({a:Object.keys(P.answers).sort().join(),corrupt:Object.keys(localStorage).filter(k=>/corrupt/.test(k))}))};
  const std=await run(STD),web=await run(WEB);
  expect(std.a.length).toBeGreaterThan(0);
  expect(web.a).toBe(std.a);
  expect(web.corrupt).toEqual(std.corrupt);
 });
 test('кидок про відсутній пакет не потрапляє в журнал помилок',async({page})=>{
  await page.route('**/files/pack-*.js',r=>r.abort());
  await fresh(page,WEB);
  await page.evaluate(()=>{location.hash='coverage'});
  await expect(page.getByText('Матеріали не завантажилися')).toBeVisible();
  const log=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).filter(([k])=>/error/i.test(k))));
  expect(log).not.toMatch(/pack not loaded/);
 });
});
