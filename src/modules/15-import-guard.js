// Backups and cloud sync arrive from outside: keep only well-formed keys, ids and short plain titles.
function guardText(v,n=200){return String(v??'').replace(/[<>\u0000-\u001f]/g,'').slice(0,n)}
// Session keys are built from topic ids and, for history cards, from Ukrainian titles: allow letters, digits and plain punctuation, never markup, quotes or prototype names.
function guardKey(key){return typeof key==='string'&&key.length>=1&&key.length<=160&&!/[<>"'&\\`\u0000-\u001f]/.test(key)&&!['__proto__','constructor','prototype'].includes(key)}
function guardRun(e){
 if(!e||typeof e!=='object')return null;
 let started=Number.isFinite(e.started)?e.started:Date.now(),subject=SUB[e.subject]||e.subject==='all'?e.subject:null;
 if(!subject)return null;
 e.id=/^exam-\d{1,16}$/.test(e.id)?e.id:'exam-'+started;e.subject=subject;if('full' in e)e.full=subject==='all';
 for(const k of ['started','finished','deadline'])if(k in e&&e[k]!==null)e[k]=Number.isFinite(e[k])?e[k]:k==='started'?started:null;
 e.variant=Math.max(1,Math.min(99,Math.trunc(Number(e.variant)||1)));e.title=(subject==='all'?'Повна симуляція':SUB[subject].name)+' · варіант '+e.variant;
 return e;
}
function guardPlatform(n){
 for(let key of Object.keys(n.sessions)){let s=n.sessions[key];if(!guardKey(key))delete n.sessions[key];else n.sessions[key]={ids:s.ids,title:guardText(s.title),index:s.index}}
 if(!n.sessions[n.current])n.current=null;
 if(n.exam)n.exam=guardRun(n.exam);
 n.records=n.records.map(guardRun).filter(Boolean);
 return n;
}
const guardNormalBase=pNormal;pNormal=function(raw){return guardPlatform(guardNormalBase(raw))};
try{P=guardPlatform(P)}catch{}
