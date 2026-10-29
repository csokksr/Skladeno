// Viewing a task must not create a stored coach item; only an explicit action does.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const q=PQ.find(q=>q.type==='single'&&!q.examOnly);
route='practice';pStart([q.id],'t','coach-view');
const before=Object.keys(P.coach.items).length;
try{pPractice();pPractice()}catch(e){ok(false,'pPractice threw '+e.message)}
ok(Object.keys(P.coach.items).length===before,'rendering a task adds no coach item ('+before+' -> '+Object.keys(P.coach.items).length+')');
coachConfidence(q.id,2);
ok(P.coach.items[q.id]&&P.coach.items[q.id].confidence===2,'choosing confidence stores the item');
coachReason(q.id,Object.keys(COACH_REASONS)[0]);
ok(P.coach.items[q.id].reason===Object.keys(COACH_REASONS)[0],'choosing a reason stores it');
log('fails',fails);
})();
