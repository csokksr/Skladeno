// Синхронізація прогресу у веб-збірці (src/web/90-web.js): підмінний window.claude.use('db'), спільне сховище в Node,
// дві окремі сесії браузера (як телефон і ноутбук). Збірка: python -I tools/build.py --web.
const {test,expect}=require('@playwright/test');
const zlib=require('zlib');
const WEB='http://127.0.0.1:8792/index.html',UID='data/users/u1/';

// Сховище в Node: path -> документ. failOn(path) вмикає збій запису для одного документа.
function makeStore(){const docs=new Map();let failOn=null;
 return {docs,fail:p=>{failOn=p},
  op:async(kind,path,data)=>{if(kind==='get')return docs.has(path)?JSON.parse(docs.get(path)):null;
   if(kind==='set'){if(failOn&&path===failOn)throw Object.assign(new Error('boom'),{code:'unavailable'});docs.set(path,JSON.stringify(data));return null}
   if(kind==='delete'){docs.delete(path);return null}}}}
const FAKE=()=>{const op=(...a)=>window.__dbOp(...a);
 const ref=path=>({get:async()=>{const d=await op('get',path);return {exists:d!==null,data:()=>d}},set:async d=>{await op('set',path,d)},delete:async()=>{await op('delete',path)}});
 window.claude={use:async n=>n==='db'?{doc:ref}:n==='user'?{id:async()=>'u1'}:null}};

async function device(browser,store){const ctx=await browser.newContext();
 await ctx.exposeFunction('__dbOp',store.op);await ctx.addInitScript(FAKE);
 const page=await ctx.newPage();await page.goto(WEB);
 await page.waitForFunction(()=>typeof PQ!=='undefined'&&typeof render==='function'&&typeof webDb!=='undefined'&&webDb);
 await page.evaluate(()=>packAll());
 return {ctx,page}}
const ids=page=>page.evaluate(()=>PQ.filter(q=>q.type==='single'&&!q.examOnly).slice(0,30).map(q=>q.id));
const answer=(page,list,at)=>page.evaluate(([list,at])=>{list.forEach((id,i)=>{P.answers[id]={value:0,score:1,max:1,first:1,attempts:1,at:at+i,due:at}});pSave()},[list,at]);
const have=page=>page.evaluate(()=>Object.keys(P.answers).sort());
// Чекаємо, поки стартова підтяжка завершиться, і заливаємо вручну (таймер у 4 с у тесті не потрібен).
const upload=page=>page.evaluate(async()=>{await new Promise(r=>setTimeout(r,200));while(webBusy)await new Promise(r=>setTimeout(r,50));webLastSent='';await webUpload()});

test.describe('синхронізація прогресу',()=>{
 test.skip(({isMobile})=>isMobile,'достатньо одного розміру');
 test.setTimeout(180000);

 test('телефон зі старим знімком і ноутбук: обидва набори відповідей збережено',async({browser})=>{
  const store=makeStore(),phone=await device(browser,store),laptop=await device(browser,store);
  const all=await ids(phone.page),A=all.slice(0,5),B=all.slice(5,10),C=all.slice(10,15);
  await answer(phone.page,A,Date.now()-5000);await upload(phone.page);
  // Ноутбук відкриває сайт заново: підтягує A, відповідає на B і заливає.
  await laptop.page.reload();await laptop.page.waitForFunction(()=>typeof webDb!=='undefined'&&webDb);await laptop.page.evaluate(()=>packAll());
  await expect.poll(()=>have(laptop.page)).toEqual([...A].sort());
  await answer(laptop.page,B,Date.now()-3000);await upload(laptop.page);
  // Телефон не перезавантажувався: має лише A, відповідає на C. Раніше це затирало B.
  expect(await have(phone.page)).toEqual([...A].sort());
  await answer(phone.page,C,Date.now()-1000);await upload(phone.page);
  expect(await have(phone.page)).toEqual([...A,...B,...C].sort());
  // Ноутбук після перезавантаження бачить усе.
  await laptop.page.reload();await laptop.page.waitForFunction(()=>typeof webDb!=='undefined'&&webDb);await laptop.page.evaluate(()=>packAll());
  await expect.poll(()=>have(laptop.page)).toEqual([...A,...B,...C].sort());
  await phone.ctx.close();await laptop.ctx.close();
 });

 test('обрив заливки до запису заголовка: старий знімок читається цілим',async({browser})=>{
  const store=makeStore(),phone=await device(browser,store);
  const all=await ids(phone.page),A=all.slice(0,5),B=all.slice(5,10);
  await answer(phone.page,A,Date.now()-5000);await upload(phone.page);
  const head1=JSON.parse(store.docs.get(UID+'progress'));
  expect(head1.at).toBeGreaterThan(0);expect(store.docs.has(UID+'progress-'+head1.at+'-0')).toBe(true);
  store.fail(UID+'progress');await answer(phone.page,B,Date.now()-1000);await upload(phone.page);
  expect(await phone.page.evaluate(()=>webStatus)).toBe('Збережено на цьому пристрої');
  // Заголовок лишився старим, його частини не видалено.
  expect(JSON.parse(store.docs.get(UID+'progress')).at).toBe(head1.at);
  expect(store.docs.has(UID+'progress-'+head1.at+'-0')).toBe(true);
  const other=await device(browser,store);
  await expect.poll(()=>have(other.page)).toEqual([...A].sort());
  await phone.ctx.close();await other.ctx.close();
 });

 test('після успішної заливки старі частини видаляються, а новий заголовок цілий',async({browser})=>{
  const store=makeStore(),phone=await device(browser,store),all=await ids(phone.page);
  await answer(phone.page,all.slice(0,3),Date.now()-5000);await upload(phone.page);
  const head1=JSON.parse(store.docs.get(UID+'progress'));
  await answer(phone.page,all.slice(3,6),Date.now()-1000);await upload(phone.page);
  const head2=JSON.parse(store.docs.get(UID+'progress'));
  expect(head2.at).toBeGreaterThan(head1.at);
  expect(store.docs.has(UID+'progress-'+head1.at+'-0')).toBe(false);
  expect(store.docs.has(UID+'progress-'+head2.at+'-0')).toBe(true);
  await phone.ctx.close();
 });

 test('старий формат частин (progress-<i>, savedAt) читається',async({browser})=>{
  const store=makeStore(),probe=await device(browser,makeStore()),all=await ids(probe.page);await probe.ctx.close();
  const at=Date.now()-5000,plat={schema:1,answers:Object.fromEntries(all.slice(0,4).map(id=>[id,{value:0,score:1,max:1,first:1,attempts:1,at,due:at}])),drafts:{},pins:[],notes:{},read:[],sessions:{},current:null,exam:null,records:[],logs:{},plan:{minutes:45,days:{}},lastSubject:'ukr'};
  const packed=zlib.gzipSync(JSON.stringify({platform:JSON.stringify(plat),history:null})).toString('base64');
  store.docs.set(UID+'progress-0',JSON.stringify({part:packed}));store.docs.set(UID+'progress',JSON.stringify({chunks:1,savedAt:at,length:packed.length}));
  const d=await device(browser,store);
  await expect.poll(()=>have(d.page)).toEqual(all.slice(0,4).sort());
  await d.ctx.close();
 });
});
