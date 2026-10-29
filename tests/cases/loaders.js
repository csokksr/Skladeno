;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const good=PQ[0].id;
// coach: one stale event must not wipe the rest
let raw=JSON.parse(JSON.stringify(P.coach));
raw.events=[{id:'removed-task',at:1,score:0,max:1,confidence:0},{id:good,at:2,score:0,max:pMax(PM[good]),confidence:2}];
raw.items={[good]:{reason:'',streak:2,lastDay:'2026-10-01',confidence:2},bad:null,[PQ[1].id]:5};
try{const n=coachNormal(raw);ok(n.events.length===1&&n.items[good]?.streak===2,'coachNormal keeps good events/items, drops stale ('+n.events.length+' events)')}catch(e){ok(false,'coachNormal threw '+e.message)}
raw.results=[{ids:['x'],answers:{}}];raw.control={ids:['x']};
try{const n=coachNormal(raw);ok(n.results.length===0&&!n.control,'broken control/results dropped, not thrown')}catch(e){ok(false,'broken control threw '+e.message)}
try{coachNormal('str');ok(false,'non-object coach should still throw')}catch{ok(true,'non-object coach still rejected')}
// checkpoint deadline uses one clock reading
for(let i=0;i<200;i++){P.coach.control=null;coachStart('ukr');const c=P.coach.control;if(!c||c.deadline-c.started!==1200000){ok(false,'coachStart deadline-started='+(c&&c.deadline-c.started));break}if(i===199)ok(true,'coachStart deadline-started exactly 1200000 (200 runs)')}
// official history: one broken record must not wipe the others
try{const n=offNormal({records:[{subject:'nope'}],seen:{}});ok(n.records.length===0,'offNormal drops broken record without throwing')}catch(e){ok(false,'offNormal threw '+e.message)}
// legacy: lenient boot, strict import
const hq=Q[0];const st={app:'istoria200',state:{schema:4,answers:{[hq.id]:{value:99,score:0}},history:[null]}};
try{normaliseImport(st);ok(false,'strict import should throw')}catch{ok(true,'strict import still rejects a bad answer')}
try{const s=normaliseImport(st,true);ok(Object.keys(s.answers).length===0,'lenient boot drops bad answer, no throw')}catch(e){ok(false,'lenient threw '+e.message)}
// ids that are inherited object names
for(const id of ['constructor','__proto__','toString']){try{const n=pNormal({schema:1,answers:{[id]:{value:0}},drafts:{[id]:1},pins:[id],notes:{[id]:'x'}});ok(Object.keys(n.answers).length===0&&n.pins.length===0,'pNormal ignores id '+id)}catch(e){ok(false,'pNormal threw on '+id+': '+e.message)}}
log('fails',fails);
})();
