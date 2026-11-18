// Звіт посиланням (src/modules/97-share.js): дані, упаковка gzip+base64url, сувора перевірка чужого посилання, сторінка.
(async function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
P.answers={};P.logs={};P.coach.items={};P.growth={blocks:[]};P.weekly={snaps:[]};
const today=pDay(),qs=PQ.filter(q=>q.subject==='math'&&q.type==='single').slice(0,60);
qs.forEach((q,i)=>{P.answers[q.id]={value:0,score:i%2,max:1,first:i%2,attempts:1,at:Date.now(),due:Date.now()}});
P.logs[today]=12;P.logs[weeklyDay(-3,today)]=5;P.study.examDate=weeklyDay(40,today);

// 1. Дані: підсумки без окремих відповідей, коротко.
const d=rpData('Оля <b>');
ok(d.v===1&&d.day===today&&d.label==='Оля b','підпис очищено від розмітки: '+d.label);
ok(d.subjects.length===4&&d.subjects.find(s=>s.sid==='math').n===60&&d.subjects.find(s=>s.sid==='math').acc===50,'математика: 60 завдань, 50% з першої спроби');
ok(d.active14===2&&d.done7===12+5,'регулярність: 2 дні з 14, 17 відповідей за 7 днів');
ok(d.weak.length>0&&d.weak.length<=5,'слабкі теми: '+d.weak.length);
ok(!JSON.stringify(d).includes(qs[0].id),'у звіті немає id окремих завдань');
// 2. Упаковка туди й назад, розмір посилання.
const packed=await rpPack(JSON.stringify(d));
ok(/^[A-Za-z0-9_-]+$/.test(packed)&&packed.length<1500,'посилання url-безпечне й коротке ('+packed.length+' символів)');
const back=rpClean(JSON.parse(await rpUnpack(packed)));
ok(back.day===today&&back.label==='Оля b'&&back.subjects.find(s=>s.sid==='math').n===60&&back.exam===d.exam,'розпаковане збігається з вихідним');
// 3. Чужі посилання: пошкоджене, не gzip, завелике, чужий формат.
const rej=async(s,m)=>{try{await rpUnpack(s);ok(false,m)}catch(e){ok(e.rp===true,m)}};
await rej('!!!','символи поза алфавітом відхиляються');
await rej('abcdefgh','не gzip відхиляється');
const big=await rpPack('{"v":1,"pad":"'+'a'.repeat(RP_MAX+10)+'"}');
await rej(big,'розпакований розмір обмежено ('+RP_MAX+' байт)');
const bad=(o,m)=>{try{rpClean(o);ok(false,m)}catch(e){ok(e.rp===true,m)}};
bad({v:2,day:today,subjects:[]},'невідома версія відхиляється');
bad({v:1,day:'2026-13-45x',subjects:[]},'погана дата відхиляється');
bad({v:1,day:today,subjects:[]},'без предметів відхиляється');
// 4. Недовірені значення обмежуються, розмітка екранується.
const evil=JSON.parse(JSON.stringify(d));
evil.label='<img src=x onerror=alert(1)>'.repeat(5);evil.subjects[0].scale=9999;evil.subjects[0].n=-5;evil.subjects[1].acc='100';evil.weak=[{id:'<script>',n:3},{id:'hist-3',n:'x'}];evil.growth={title:'<b>x</b>',before:150,after:50};evil.__proto__={x:1};
const c=rpClean(evil);
ok(!/[<>]/.test(c.label)&&c.label.length<=40,'підпис: без < > і не довший за 40');
ok(c.subjects[0].scale===null&&c.subjects[0].n===0&&c.subjects[1].acc===null,'числа поза межами стають null/0');
ok(c.weak.length===1&&c.weak[0].id==='hist-3'&&c.weak[0].n===0,'тема з небезпечним кодом відкинута');
ok(c.growth.before===null&&c.growth.after===50,'приріст: поза межами → null');
const html=rpHTML(c);
ok(!/<script|<img|onerror/i.test(html)&&html.includes('<b>')===false||!html.includes('<b>x</b>'),'розмітка з чужих рядків екранується');
// 5. Сторінка звіту.
const page=rpHTML(back);
ok(page.includes('Звіт про підготовку')&&page.includes('Оля b')&&page.includes('до НМТ 40 днів')&&page.includes('<table'),'сторінка: заголовок, підпис, дні до НМТ, таблиця');
ok(page.includes('нижче порогу')||page.includes('—'),'прогноз без даних показано тире або порогом');
// 6. Сторінка не пише в прогрес глядача.
const before=JSON.stringify(P);location.hash='#report/'+packed;route='x';render();ok(route==='report','маршрут #report/… відкриває звіт');await rpPage(packed);
ok($('#main').innerHTML.includes('Оля b')&&JSON.stringify(P)===before,'звіт показано, а прогрес глядача не змінено');
await rpPage('abcdefgh');ok($('#main').innerHTML.includes('Звіт не відкрився')&&!$('#main').innerHTML.includes('Error'),'зіпсоване посилання дає зрозуміле повідомлення');
log('fails',fails);
})();
