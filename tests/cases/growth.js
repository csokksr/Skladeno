// Приріст за блок (src/modules/97-growth.js): добір двох зрізів, знімок результату, нормалізація, злиття.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
P.answers={};P.growth={blocks:[]};
const sid='math',tops=growthTopics(sid).filter(t=>growthPool(sid,[t.id]).length>=12).slice(0,2).map(t=>t.id);
ok(tops.length===2,'є дві теми математики з достатньою кількістю нових офіційних завдань');
const answer=(ids,frac)=>ids.forEach((id,i)=>{const q=PM[id],m=pMax(q),s=i<Math.round(ids.length*frac)?m:0;P.answers[id]={value:0,score:s,max:m,first:s,attempts:1,at:Date.now(),due:Date.now()}});

// 1. Перший зріз: 5–10 нових офіційних завдань з тем блоку.
const pick=growthPick(sid,tops,7);
ok(Array.isArray(pick)&&pick.length>=5&&pick.length<=10&&new Set(pick).size===pick.length,'перший зріз: '+pick?.length+' різних завдань');
ok(pick.every(id=>PM[id].year&&!P.answers[id]&&!PM[id].examOnly),'лише офіційні завдання без відповіді');
// 2. Створення блоку запускає сесію зрізу.
growthDraft={sid,topics:tops};growthCreate();
const b=P.growth.blocks[0];
ok(P.growth.blocks.length===1&&b.before.ids.length>=5&&!b.after,'блок створено, другого зрізу ще немає');
ok(P.sessions['growth-'+b.id+'-before']?.ids.join()===b.before.ids.join(),'сесія зрізу до блоку запущена');
growthSync();ok(!b.before.done&&growthScore(b.before)===null,'поки не всі відповіді, результату немає');
// 3. Результат зрізу до блоку: рахується перша спроба.
answer(b.before.ids,0.4);growthSync();
const x=b.before.done;
ok(x&&x.max>0&&x.score<x.max&&x.score>0,'знімок результату до блоку: '+x?.score+' з '+x?.max);
// 4. Другий зріз: інші завдання, той самий склад за типами.
growthPlanAfter(b.id);
const a=b.after;
ok(a&&a.ids.length===b.before.ids.length&&!a.ids.some(id=>b.before.ids.includes(id)),'другий зріз: стільки ж завдань, без перетину з першим');
const types=ids=>ids.map(id=>PM[id].type).sort().join();
ok(types(a.ids)===types(b.before.ids),'склад за типами завдань однаковий');
ok(a.ids.every(id=>!P.answers[id]),'завдання другого зрізу ще нові');
answer(a.ids,0.9);growthSync();
const r=growthResult(b);
ok(r&&r.delta>0&&b.after.done.score>b.before.done.score,'приріст: було '+growthPct(r.before)+'% → стало '+growthPct(r.after)+'% ('+r.delta+')');
ok(growthBlockHTML(b).includes('Було '+growthPct(r.before)+'% → стало '+growthPct(r.after)+'%'),'сторінка показує «було → стало»');
ok(growthHubHTML().includes('було '+growthPct(r.before)+'% → стало'),'головна показує останній приріст');
// 5. Знімок переживає скидання відповідей.
P.answers={};growthSync();ok(growthResult(b)?.delta===r.delta,'знімок результатів лишається після скидання відповідей');
// 6. Нормалізація зберігає блок і відкидає пошкоджені.
const raw=JSON.parse(JSON.stringify(P));
let n=pNormal(raw);ok(n.growth.blocks.length===1&&n.growth.blocks[0].after.done.score===b.after.done.score&&n.growth.blocks[0].before.done.score===b.before.done.score,'pNormal зберігає блок зі знімками');
const bad=JSON.parse(JSON.stringify(raw));
bad.growth.blocks.push({...b,id:'gbad1',after:{ids:b.before.ids,at:1}},{...b,id:'gbad2',before:{ids:['x','y','z','w','v'],at:1}},{...b,id:'gbad3',sid:'nope'},{...b,id:'GBAD'});
bad.growth.blocks[0].before.done={score:9,max:3,at:1};
n=pNormal(bad);
ok(n.growth.blocks.map(x=>x.id).join()===[b.id,'gbad1'].join()&&!n.growth.blocks[0].before.done&&!n.growth.blocks[1].after,'зрізи з пошкодженими даними відкидаються, перетин зрізів теж');
// 7. Злиття: блок, що пройшов далі, перемагає; нові блоки додаються.
const base={id:'gaaaa',sid,topics:tops,title:'t',created:1,before:{ids:b.before.ids,at:1},after:null};
const m=webMerge({platform:{growth:{blocks:[base]}}},{platform:{growth:{blocks:[{...base,before:{...base.before,done:{score:1,max:5,at:2}}},{...base,id:'gbbbb'}]}}}).platform.growth.blocks;
ok(m.length===2&&m.find(x=>x.id==='gaaaa').before.done&&m.some(x=>x.id==='gbbbb'),'webMerge: блок, що пройшов далі, перемагає, нові додаються');
log('fails',fails);
})();
