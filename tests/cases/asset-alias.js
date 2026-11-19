// Однакові зображення зберігаються один раз (tools/build.py dedupe_assets): аліаси вказують на те саме значення.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const al=DB.assetAlias||{},keys=Object.keys(al);
ok(keys.length>300,'є аліаси однакових зображень ('+keys.length+')');
ok(keys.every(k=>DB.assets[k]&&DB.assets[k]===DB.assets[al[k]]&&DB.assets[k]!=='@='),'кожен аліас після запуску дорівнює значенню основного ключа');
ok(keys.every(k=>!(al[k] in al)),'аліас не вказує на інший аліас');
const q=PQ.find(q=>(q.images||[]).some(k=>k in al));
ok(!!q&&pImg(q.images.find(k=>k in al),'x').includes('src="data:image/'),'pImg показує зображення за аліасом');
log('fails',fails);
})();
