// LS: tests/fixtures/ls_bad.json
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
ok(__store.get('skladeno-prep-v1-corrupt')==='{"schema":1,"answers":[1]}','unreadable platform store is kept as skladeno-prep-v1-corrupt');
ok(typeof __store.get('istoria200-complete-v4-corrupt')==='string','unreadable legacy store is kept as istoria200-complete-v4-corrupt');
ok(P&&Object.keys(P.answers).length===0,'the page still starts with a fresh store');
log('fails',fails);
})();
