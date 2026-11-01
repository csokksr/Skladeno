// The exam date must be a real future date, in the plan page and in onboarding alike.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const was=P.study.examDate;
for(const bad of ['2020-01-01',pDay(),'2027-02-31','2027-13-01','abc','']){stSet('examDate',bad);ok(P.study.examDate===was,'rejected: '+JSON.stringify(bad))}
stSet('examDate','2099-05-20');ok(P.study.examDate==='2099-05-20','accepted: 2099-05-20');
ok(Number.isFinite(stDaysLeft()),'days left is a number');
log('fails',fails);
})();
