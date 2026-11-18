// Scaled scores exist only as values of the official conversion table (English has 191 and 200 but no 195).
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const sids=SUBJECTS.map(s=>s.id);
ok(nmtValues('eng').includes(191)&&nmtValues('eng').includes(200)&&!nmtValues('eng').includes(195),'English table has 191 and 200, not 195');
ok(sids.every(s=>nmtValues(s).length>0&&nmtValues(s)[0]===100&&nmtValues(s).slice(-1)[0]===200),'every subject runs from 100 to 200');
ok(sids.every(s=>nmtValues(s).includes(P.study.targets[s])),'default targets are table values: '+sids.map(s=>s+'='+P.study.targets[s]).join(' '));
// every output of the conversion is a table value
let bad=[];for(const s of sids){for(let r=0;r<=NMT.subjects[s].max;r++){const v=nmtScale(s,r);if(v!==0&&!nmtValues(s).includes(v))bad.push(s+':'+r+'='+v)}}
ok(!bad.length,'nmtScale returns only table values (or 0 below the threshold) '+bad.slice(0,3));
// stored targets are snapped on load, also from an imported copy
const n=pNormal({schema:1,answers:{},study:{targets:{ukr:171,math:160,hist:199,eng:195}}});
ok(sids.every(s=>nmtValues(s).includes(n.study.targets[s])),'loaded targets snapped to table values: '+sids.map(s=>s+'='+n.study.targets[s]).join(' '));
ok(n.study.targets.eng===191,'English 195 snaps to 191 (nearest)');
// setting a target
const was=P.study.targets.eng;stSet('target-eng',195);ok(P.study.targets.eng===was,'stSet rejects English 195');
stSet('target-eng',191);ok(P.study.targets.eng===191,'stSet accepts English 191');
stSet('target-eng',200);ok(P.study.targets.eng===200,'stSet accepts English 200');
stSet('target-math',160);ok(P.study.targets.math!==160,'stSet rejects math 160');
// the plan page and the onboarding card offer exactly the table values
route='plan';pPlan();const plan=$('#main').innerHTML;
// the plan and the onboarding card ask for targets of the four subjects of the exam (the fourth one is chosen)
const on=subjActive().map(s=>s.id);
for(const s of on){const m=new RegExp('aria-label="Ціль: '+SUB[s].short+'"[^>]*>(.*?)</select>').exec(plan);const opts=m?[...m[1].matchAll(/<option value="(\d+)"/g)].map(x=>+x[1]):[];ok(JSON.stringify(opts)===JSON.stringify(nmtValues(s)),'plan page options for '+s+': '+opts.length+' values')}
const card=obCard();
for(const s of on){const m=new RegExp('<select id="ob-t-'+s+'"[^>]*>(.*?)</select>').exec(card);const opts=m?[...m[1].matchAll(/<option value="(\d+)"/g)].map(x=>+x[1]):[];ok(JSON.stringify(opts)===JSON.stringify(nmtValues(s)),'onboarding options for '+s+': '+opts.length+' values')}
log('fails',fails);
})();
