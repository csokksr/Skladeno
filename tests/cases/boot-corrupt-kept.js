// LS: tests/fixtures/ls_bad_kept.json
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
ok(__store.get('skladeno-prep-v1-corrupt')==='FIRST-COPY','an earlier unreadable copy is not overwritten by a later one');
ok(typeof __store.get('istoria200-complete-v4-corrupt')==='string','a missing copy is still created');
log('fails',fails);
})();
