// The backup reminder: only with enough answers, only when the last copy is missing or old, and creating a copy stops it.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const store=localStorage,ids=PQ.filter(q=>!q.examOnly).slice(0,40).map(q=>q.id);
P.answers={};ok(!storeNeedsBackup(),'no answers: no reminder');
for(const id of ids)P.answers[id]={value:0,score:1,max:1,first:1,attempts:1,at:Date.now(),due:Date.now()};
ok(storeNeedsBackup(),'40 answers and no copy yet: remind');
pBackupData();ok(!storeNeedsBackup()&&storeBackupAge()===0,'creating a copy stops the reminder');
store.setItem(STORE_BACKUP_KEY,String(Date.now()-20*864e5));ok(storeNeedsBackup()&&storeBackupAge()===20,'a 20-day-old copy: remind again');
for(const id of ids.slice(10))delete P.answers[id];ok(!storeNeedsBackup(),'fewer than 30 answers: no reminder');
location.hash='#hub';P.answers={};
log('fails',fails);
})();
