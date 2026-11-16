// A backup comes from outside: hostile keys must not pollute prototypes, invalid answers are dropped, long notes are cut.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const q=PQ.find(q=>q.type==='single'&&!q.examOnly),t=Object.keys(PT)[0];
const raw=JSON.parse('{"schema":1,"answers":{"__proto__":{"value":0,"score":1,"max":1,"attempts":1,"at":1,"due":1},"'+q.id+'":{"value":999,"at":1,"due":1}},"notes":{"__proto__":"x","constructor":"y","'+t+'":"'+'z'.repeat(40000)+'"},"drafts":{"__proto__":1},"sessions":{"__proto__":{"ids":["'+q.id+'"],"title":"t","index":0}},"logs":{"__proto__":5}}');
let n=null;try{n=pNormal(raw)}catch(e){ok(false,'pNormal threw on hostile keys: '+e.message)}
ok(n&&({}).polluted===undefined&&Object.getPrototypeOf(n.answers)===Object.prototype&&Object.getPrototypeOf(n.sessions)===Object.prototype,'hostile keys leave prototypes alone');
ok(n&&!Object.prototype.hasOwnProperty.call(n.answers,'__proto__')&&!Object.prototype.hasOwnProperty.call(n.sessions,'__proto__'),'hostile keys are not stored');
ok(n&&!n.answers[q.id],'an answer whose value is not valid for the task is dropped');
ok(n&&n.notes[t]&&n.notes[t].length===30000,'a note is cut to 30000 characters');
for(const bad of [null,{},{schema:2,answers:{}},{schema:1,answers:[]}]){let threw=false;try{pNormal(bad)}catch{threw=true}ok(threw,'rejects '+JSON.stringify(bad))}
log('fails',fails);
})();
