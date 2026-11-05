// TZ: America/New_York
// "Today" is the Kyiv day (pDay): its start must be Kyiv midnight whatever time zone the browser runs in.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const kyiv=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Europe/Kyiv'}),s=stDayStart();
ok(kyiv(s)===pDay(),'the day starts on the Kyiv date of today');
ok(kyiv(s-1)!==pDay(),'one millisecond earlier is the previous Kyiv day');
ok(s<=Date.now()&&Date.now()-s<=25*3600000,'the start is within the last 25 hours');
log('fails',fails);
})();
