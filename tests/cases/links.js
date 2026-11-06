// Internal links lead somewhere: every #address linked from a page opens a page of its own, not the home page by fallback.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const errs=[],realError=console.error;console.error=(...a)=>errs.push(a.map(x=>x&&x.stack||x).join(' '));
const start=['hub','today','plan','library','strategy','mocks','subject/ukr','subject/math','subject/hist','subject/eng','lesson/ukr-sounds','topics','topic/1','gallery','map','review','analytics','preferences','reference','audit','coverage','advanced','history-archive','find','chronology','sprint','about'];
const seen=new Set(),targets=new Map();
for(const r of start){location.hash='#'+r;try{render()}catch{}for(const m of $('#main').innerHTML.matchAll(/href="#([^"]+)"/g)){const h=m[1].replace(/&amp;/g,'&');if(!seen.has(h)){seen.add(h);targets.set(h,r)}}}
let checked=0;
for(const [h,from] of targets){errs.length=0;location.hash='#'+h;try{render();if(location.hash!=='#'+h)render()}catch(e){ok(false,'#'+h+' (from '+from+') threw '+e.message);continue}
 checked++;const html=$('#main').innerHTML,base=h.split('/')[0];
 ok(!errs.length&&!/не вдалося показати/.test(html)&&(['hub','home'].includes(base)||!['hub','home'].includes(location.hash.replace(/^#/,''))),'link #'+h+' (from '+from+') opens a page'+(errs.length?': '+errs[0].slice(0,120):''))}
console.error=realError;
ok(checked>20,'the crawl reached '+checked+' addresses');
log('fails',fails);
})();
