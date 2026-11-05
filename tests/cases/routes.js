// Every route draws something: the last-resort catch in render() must never be reached (it logs through console.error).
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const errs=[],realError=console.error;console.error=(...a)=>errs.push(a.map(x=>x&&x.stack||x).join(' '));
const routes=['hub','today','plan','library','strategy','mocks','subject/ukr','subject/hist','lesson/ukr-sounds','topics','topic/1','gallery','map','review','analytics','settings','practice','reference','audit','coverage','advanced','history-archive','home','quiz','exam','progress','nonsense'];
for(const r of routes){errs.length=0;location.hash='#'+r;try{render();if(location.hash!=='#'+r)render()}catch(e){ok(false,r+' threw '+e.message);continue} // a redirect changes the hash; the browser would redraw
 ok(!errs.length&&!/не вдалося показати/.test($('#main').innerHTML),'route '+r+' draws'+(errs.length?': '+errs[0].slice(0,160):''))
 const lv=[...$('#main').innerHTML.matchAll(/<h([1-4])[\s>]/g)].map(m=>+m[1]),skip=lv.some((x,i)=>i&&x-lv[i-1]>1);
 ok(lv.filter(x=>x===1).length===1&&!skip,'route '+r+': one H1 and no skipped heading level ('+lv.slice(0,6).join('')+')')}
console.error=realError;
log('fails',fails);
})();
