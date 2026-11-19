// webMerge (src/modules/98-merge.js): злиття прогресу двох пристроїв без втрат. Чиста функція, без DOM.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const ans=(at,score=1)=>({value:0,score,max:1,first:score,attempts:1,at,due:at});
const plat=o=>({schema:1,answers:{},drafts:{},pins:[],notes:{},read:[],sessions:{},current:null,records:[],logs:{},plan:{minutes:45,days:{}},lastSubject:'ukr',
 study:{targets:{ukr:170},srs:{}},ext:{cards:[]},...o});
const phone=plat({answers:{a:ans(100,0),b:ans(300,1),c:ans(50)},pins:['a','x'],read:['t1'],logs:{'2026-11-01':3,'2026-11-02':9},
 notes:{t1:'телефон'},drafts:{a:1},plan:{minutes:20,days:{}},study:{targets:{ukr:150},srs:{a:{e:2,i:1,n:1,l:0,d:'p'},b:{e:2,i:9,n:3,l:0,d:'p'}}},
 ext:{cards:[{id:'c1',f:'f1',b:'b1'},{id:'c2',f:'телефон',b:'x'}]},records:[{id:'r1',finished:10}],sessions:{s1:{ids:['a']}}});
const laptop=plat({answers:{a:ans(200,1),b:ans(250,0),d:ans(10)},pins:['a','y'],read:['t2'],logs:{'2026-11-01':7,'2026-11-03':1},
 notes:{t1:'ноутбук',t2:'лише ноутбук'},drafts:{d:2},plan:{minutes:60,days:{}},study:{targets:{ukr:190},srs:{a:{e:3,i:5,n:2,l:0,d:'l'},d:{e:3,i:1,n:1,l:0,d:'l'}}},
 ext:{cards:[{id:'c2',f:'ноутбук',b:'y'},{id:'c3',f:'f3',b:'b3'}]},records:[{id:'r1',finished:10},{id:'r2',finished:20}],sessions:{s2:{ids:['d']}}});
const hist=(at)=>({schema:4,answers:{h:ans(at)},drafts:{},cursors:{},pins:[],read:[],notes:{},lastTopic:2,session:null,mock:null,history:[{at:1,score:30,answered:30}],days:{'2026-11-01':2}});
const L={platform:phone,history:hist(5)},R={platform:laptop,history:{...hist(9),history:[{at:2,score:40,answered:30}],days:{'2026-11-01':4},lastTopic:7}};
const before=JSON.stringify([L,R]);
const m=webMerge(L,R).platform,h=webMerge(L,R).history;
ok(JSON.stringify([L,R])===before,'вхідні об’єкти не змінюються');
ok(Object.keys(m.answers).sort().join()==='a,b,c,d','обидва набори відповідей збережено');
ok(m.answers.a.at===200&&m.answers.b.at===300,'при конфлікті за id перемагає новіший at (a — ноутбук, b — телефон)');
ok(m.study.srs.a.d==='l'&&m.study.srs.b.d==='p'&&m.study.srs.d.d==='l','srs іде разом із відповіддю, що перемогла');
ok(m.pins.sort().join()==='a,x,y'&&m.read.sort().join()==='t1,t2','pins і read об’єднано');
ok(m.logs['2026-11-01']===7&&m.logs['2026-11-02']===9&&m.logs['2026-11-03']===1,'logs: найбільше за день');
ok(m.records.map(r=>r.id).join()==='r1,r2','records об’єднано за id');
ok(Object.keys(m.sessions).sort().join()==='s1,s2','sessions об’єднано');
ok(m.ext.cards.map(c=>c.id).sort().join()==='c1,c2,c3'&&m.ext.cards.find(c=>c.id==='c2').f==='телефон','ext.cards за id, при конфлікті локальна');
ok(m.notes.t1==='телефон'&&m.notes.t2==='лише ноутбук','notes: перевага локальним, відсутні додано');
ok(m.drafts.a===1&&m.drafts.d===2,'drafts: перевага локальним, відсутні додано');
ok(m.plan.minutes===20&&m.study.targets.ukr===150,'plan і цілі лишаються локальними');
ok(h.answers.h.at===9&&h.days['2026-11-01']===4&&h.lastTopic===2,'історія: відповідь новіша, days — максимум, налаштування локальні');
ok(h.history.map(x=>x.at).join()==='1,2','історія спроб об’єднана за at');
ok(webMerge({platform:phone,history:null},{platform:laptop,history:R.history}).history.answers.h.at===9,'історії лише на одному боці беруться як є');
const evil=JSON.parse('{"platform":{"answers":{"__proto__":{"at":1},"q":{"at":2}}}}');
const e=webMerge({platform:plat({})},evil).platform;
ok(e.answers.q&&!Object.keys(e.answers).includes('__proto__')&&({}).at===undefined,'ключ __proto__ з віддаленого JSON відкидається');
ok(JSON.stringify(webMerge(L,L).platform.answers)===JSON.stringify(L.platform.answers),'злиття із собою нічого не міняє');
log('fails',fails);
})();
