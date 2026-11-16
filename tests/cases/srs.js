// SM-2 scheduling (stSchedule): first interval, second interval, guess, same-day repeat, mistake, cap before the exam.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const q=PQ.find(q=>q.type==='single'&&!q.examOnly),fresh=()=>{P.study.srs[q.id]={e:2.5,i:0,n:0,l:0,d:''};delete P.coach.items[q.id]},good=()=>({score:1,max:1,attempts:1});
fresh();let a=good();stSchedule(q,a);
ok(a.due===stDueAt(1)&&P.study.srs[q.id].n===1,'first correct answer: back in 1 day');
P.study.srs[q.id].d='2000-01-01';a=good();stSchedule(q,a);
ok(a.due===stDueAt(3)&&P.study.srs[q.id].n===2,'second correct answer on another day: 3 days');
a=good();stSchedule(q,a);
ok(a.due===stDueAt(1)&&P.study.srs[q.id].n===2,'repeat on the same day does not lengthen the interval');
a={score:0,max:1,attempts:2};stSchedule(q,a);const s=P.study.srs[q.id];
ok(s.n===0&&s.l===1&&Math.abs(a.due-Date.now()-600000)<5000,'a mistake restarts the series and returns in 10 minutes');
fresh();P.study.srs[q.id].n=1;P.study.srs[q.id].d='2000-01-01';P.coach.items[q.id]={reason:'',streak:0,lastDay:'',confidence:1};a=good();stSchedule(q,a);
ok(a.due===stDueAt(2),'a correct guess gets a shorter second interval (2 days)');
fresh();P.study.examDate=new Date(Date.now()+10*864e5).toLocaleDateString('en-CA',{timeZone:'Europe/Kyiv'});
P.study.srs[q.id]={e:2.5,i:100,n:5,l:0,d:'2000-01-01'};a=good();stSchedule(q,a);
ok(a.due<=stDueAt(5),'ten days before the exam no interval exceeds half of what is left');
P.study.examDate='';
log('fails',fails);
})();
