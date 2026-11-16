// After the exam date the headings say so instead of "exam day" forever.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA',{timeZone:'Europe/Kyiv'});
for(const r of ['hub','today']){
 P.study.examDate=day(-3);location.hash='#'+r;render();let h=$('#main').innerHTML;
 ok(/НМТ уже минуло/.test(h)&&!/День НМТ/.test(h),r+': date in the past says the exam has passed');
 P.study.examDate=pDay();render();h=$('#main').innerHTML;
 ok(/День НМТ/.test(h)&&!/уже минуло/.test(h),r+': today is still the exam day');
 P.study.examDate=day(5);render();ok(/До НМТ 5 днів/.test($('#main').innerHTML),r+': before the date it counts the days');
}
P.study.examDate='';
log('fails',fails);
})();
