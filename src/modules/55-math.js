// Formulas of official ZNO/НМТ tasks are stored as LaTeX between ⟦ and ⟧. This module turns them into MathML after every render.
const MJ=(()=>{
const SYM={alpha:'α',beta:'β',gamma:'γ',delta:'δ',Delta:'Δ',varphi:'φ',phi:'φ',pi:'π',rho:'ρ',theta:'θ',lambda:'λ',mu:'μ',sigma:'σ',omega:'ω',infty:'∞',circ:'°',angle:'∠',cup:'∪',cap:'∩',in:'∈',notin:'∉',ne:'≠',neq:'≠',le:'≤',leq:'≤',ge:'≥',geq:'≥',lt:'<',gt:'>',pm:'±',mp:'∓',times:'×',cdot:'·',perp:'⊥',parallel:'∥',varnothing:'∅',emptyset:'∅',smile:'⌣',ast:'*',colon:':',lvert:'|',rvert:'|',to:'→',rightarrow:'→',Rightarrow:'⇒',Leftrightarrow:'⇔',approx:'≈',subset:'⊂',cdots:'⋯',ldots:'…',dots:'…',triangle:'△',sim:'∼',int:'∫',sum:'∑',prod:'∏','%':'%','{':'{','}':'}','|':'∥',',':' ',';':' ',' ':' ','!':'','(':'(',')':')','[':'[',']':']'};
const FUNC=new Set(['sin','cos','tan','tg','ctg','cot','log','lg','ln','lim','arcsin','arccos','arctan','arctg','max','min','sec','csc','exp']);
const IGNORE=new Set(['limits','nolimits','scriptstyle','textstyle','displaystyle','style','scriptscriptstyle','big','Big','bigl','bigr','Bigl','Bigr','biggl','biggr','quad','qquad','mathord','mathop']);
const ESC=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function tokenize(s){const t=[];let i=0;while(i<s.length){const c=s[i];if(c==='\\'){let j=i+1;if(/[a-zA-Z]/.test(s[j]||'')){while(/[a-zA-Z]/.test(s[j]||''))j++;t.push({c:s.slice(i+1,j)});i=j}else{t.push({c:s[i+1]===undefined?'':s[i+1]});i+=2}}else if(/\s/.test(c)){i++}else{t.push({ch:c});i++}}return t}
function parse(src){
 const T=tokenize(src);let p=0;const unknown=[];
 const peek=()=>T[p],isCh=(t,c)=>t&&t.ch===c,isCmd=(t,c)=>t&&t.c===c;
 function rawGroup(){ // text of a {...} group, braces balanced, as written
  if(!isCh(peek(),'{'))return '';p++;let d=1,out='';while(p<T.length){const t=T[p++];if(t.ch==='{')d++;else if(t.ch==='}'){d--;if(!d)break}out+=t.c!==undefined?(t.c.length>1||/[a-zA-Z]/.test(t.c)?'\\'+t.c+' ':t.c):t.ch}return out}
 function seq(stop){const out=[];while(p<T.length){const t=peek();if(stop(t))break;const a=atom();if(a===null)continue;out.push(scripts(a))}return out}
 function group(){if(!isCh(peek(),'{'))return arg1();p++;const n=seq(t=>isCh(t,'}'));p++;return row(n)}
 function arg1(){const t=T[p];if(!t)return '<mrow></mrow>';if(isCh(t,'{'))return group();const a=atom();return a===null?'<mrow></mrow>':a}
 function row(n){return n.length===1?n[0]:'<mrow>'+n.join('')+'</mrow>'}
 function scripts(a){let sub=null,sup=null,base=a;while(peek()&&(isCh(peek(),'^')||isCh(peek(),'_')||isCmd(peek(),'limits')||isCmd(peek(),'nolimits'))){const t=T[p++];if(t.c)continue;const v=arg1();if(t.ch==='^')sup=v;else sub=v}
  if(sub&&sup)return '<msubsup>'+base+sub+sup+'</msubsup>';if(sup)return '<msup>'+base+sup+'</msup>';if(sub)return '<msub>'+base+sub+'</msub>';return base}
 function text(s,variant){return '<mtext'+(variant?' mathvariant="'+variant+'"':'')+'>'+ESC(s.replace(/\s+/g,' '))+'</mtext>'}
 function delim(t){if(!t)return '';let c=t.ch||(t.c==='lvert'||t.c==='rvert'||t.c==='|'?'|':t.c==='{'?'{':t.c==='}'?'}':t.c==='.'?'':t.c);return c==='.'?'':c}
 function atom(){const t=T[p++];
  if(t.ch!==undefined){const c=t.ch;
   if(c==='{'){p--;return group()}
   if(c==='}'||c==='&')return null;
   if(/[0-9]/.test(c)){let s=c;while(peek()&&peek().ch!==undefined&&(/[0-9]/.test(peek().ch)||((peek().ch==='.'||peek().ch===',')&&T[p+1]&&T[p+1].ch&&/[0-9]/.test(T[p+1].ch))))s+=T[p++].ch;return '<mn>'+s+'</mn>'}
   if(/[A-Za-z]/.test(c))return '<mi>'+c+'</mi>';
   if(c==='~')return '<mspace width="0.3em"></mspace>';
   if(c==='^'||c==='_'){p--;return scripts('<mrow></mrow>')}
   return '<mo'+(c==='|'?' stretchy="false"':'')+'>'+ESC(c==='-'?'−':c)+'</mo>'}
  const n=t.c;
  if(n==='frac'||n==='dfrac'||n==='tfrac'){const a=group(),b=group();return '<mfrac>'+a+b+'</mfrac>'}
  if(n==='sqrt'){let idx=null;if(isCh(peek(),'[')){p++;const s=[];while(p<T.length&&!isCh(peek(),']'))s.push(atom());p++;idx=row(s.filter(x=>x!==null))}const a=group();return idx?'<mroot>'+a+idx+'</mroot>':'<msqrt>'+a+'</msqrt>'}
  if(n==='left'){const o=delim(T[p++]);const inner=seq(t=>isCmd(t,'right'));p++;const c=delim(T[p++]);return '<mrow>'+(o?'<mo>'+ESC(o)+'</mo>':'')+row(inner)+(c?'<mo>'+ESC(c)+'</mo>':'')+'</mrow>'}
  if(n==='right')return null;
  if(n==='begin'){const env=rawGroup();const rows=[];let cells=[],cur=[];
   const endIt=t=>isCmd(t,'end');
   while(p<T.length&&!endIt(peek())){const t=peek();if(isCh(t,'&')){p++;cells.push(row(cur));cur=[];continue}if(isCmd(t,'\\')){p++;cells.push(row(cur));cur=[];rows.push(cells);cells=[];continue}const a=atom();if(a!==null)cur.push(scripts(a))}
   p++;rawGroup();if(cur.length||cells.length){cells.push(row(cur));rows.push(cells)}
   const tbl='<mtable columnalign="left">'+rows.map(r=>'<mtr>'+r.map(c=>'<mtd>'+c+'</mtd>').join('')+'</mtr>').join('')+'</mtable>';
   return env==='cases'?'<mrow><mo>{</mo>'+tbl+'</mrow>':'<mrow>'+tbl+'</mrow>'}
  if(n==='end'){rawGroup();return null}
  if(n==='text'||n==='mathrm'||n==='textrm'||n==='textit'||n==='textbf'||n==='mbox'){if(isCh(peek(),'{')){const raw=rawGroup();if(n==='mathrm'&&!/[^A-Za-z0-9 ]/.test(raw.replace(/\\\w+ /g,'')))return '<mi mathvariant="normal">'+ESC(raw.replace(/\s/g,''))+'</mi>';return text(raw,n==='textit'?'italic':n==='textbf'?'bold':'')}return null}
  if(n==='operatorname'){const raw=rawGroup().replace(/\s|\\/g,'');return '<mi mathvariant="normal">'+ESC(raw)+'</mi>'}
  if(n==='mathbf'||n==='boldsymbol'||n==='bf'){const a=group();return '<mstyle mathvariant="bold">'+a+'</mstyle>'}
  if(n==='mathit'||n==='mathcal'){return group()}
  if(n==='vec'||n==='overrightarrow'||n==='overline'||n==='bar'||n==='widehat'||n==='hat'||n==='overset'){
   if(n==='overset'){const top=group(),base=group();return '<mover>'+base+top+'</mover>'}
   const a=group();const m={vec:'→',overrightarrow:'→',overline:'‾',bar:'‾',widehat:'^',hat:'^'}[n];return '<mover accent="true">'+a+'<mo'+(n==='overrightarrow'?' stretchy="true"':'')+'>'+m+'</mo></mover>'}
  if(IGNORE.has(n)){if(n==='mathop'||n==='mathord'){return isCh(peek(),'{')?group():null}return null}
  if(FUNC.has(n))return '<mi mathvariant="normal">'+n+'</mi>'+'<mo>&#x2061;</mo>';
  if(n==='\\')return null;
  if(Object.hasOwn(SYM,n)){const v=SYM[n];if(!v)return null;if(n==='int'||n==='sum'||n==='prod')return '<mo largeop="true">'+v+'</mo>';if(['alpha','beta','gamma','delta','Delta','varphi','phi','pi','rho','theta','lambda','mu','sigma','omega'].includes(n))return '<mi>'+v+'</mi>';if(n==='circ'||n==='infty')return '<mo>'+v+'</mo>';if(n===','||n===';'||n===' '||n==='colon'&&false)return '<mspace width="0.25em"></mspace>';return '<mo>'+ESC(v)+'</mo>'}
  unknown.push(n);return '<mi>'+ESC(n)+'</mi>'}
 let nodes;try{nodes=seq(()=>false)}catch(e){return {err:e.message}}
 return {html:'<math>'+row(nodes)+'</math>',unknown}}
const cache=new Map();
function render(s){if(cache.has(s))return cache.get(s);const mk=/^§(\w)§([\s\S]*)$/.exec(s);if(mk&&mk[1]==='m')return '<span class="mark-img">'+pImg(mk[2],'Позначка речення')+'</span>';if(mk){const t=ESC(mk[2]),h=mk[1]==='u'?'<u>'+t+'</u>':mk[1]==='b'?(mk[2].trim().length<4?'<b class="mk">'+t+'</b>':'<b>'+t+'</b>'):mk[1]==='h'?'<b class="mk"><i>'+t+'</i></b>':'<i>'+t+'</i>';cache.set(s,h);return h}const r=parse(s);const out=r.err||!r.html?'<code class="mj-raw">'+ESC(s)+'</code>':r.html;cache.set(s,out);return out}
function walk(root){const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue.includes('⟦')&&!/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});const list=[];while(tw.nextNode())list.push(tw.currentNode);
 for(const n of list){const parts=n.nodeValue.split(/⟦(.*?)⟧/s);if(parts.length<2)continue;const span=document.createElement('span');span.className='mj';span.innerHTML=parts.map((x,i)=>i%2?render(x):ESC(x).replace(/\n/g,'<br>')).join('');
  // keep line breaks of plain text as they were (the task text uses pre-line)
  const frag=document.createDocumentFragment();while(span.firstChild)frag.appendChild(span.firstChild);n.parentNode.replaceChild(frag,n)}}
return {parse,render,walk,cache}})();
(function(){let busy=false;const run=()=>{if(busy)return;busy=true;try{MJ.walk(document.body)}finally{busy=false}};
 const obs=new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1||n.nodeType===3)))run()});
 obs.observe(document.body,{childList:true,subtree:true});run()})();
