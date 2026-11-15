// Графік функцій (#graph) і режим для людей із порушенням кольоросприйняття.

/* 74. Розбір виразу без eval: числа, x, pi, e, + - * / ^, дужки, функції sin cos tan asin acos atan sqrt abs ln log exp.
   Неявне множення: 2x, 2(x+1), (x+1)(x-1). Правила: унарний мінус слабший за степінь (-x^2 = -(x^2)), степінь правоасоціативний. */
// log і lg — десятковий логарифм, ln — натуральний; tg, ctg, arcsin, arccos, arctg — українські позначення.
const GR_FUNCS={sin:Math.sin,cos:Math.cos,tan:Math.tan,tg:Math.tan,cot:x=>1/Math.tan(x),ctg:x=>1/Math.tan(x),asin:Math.asin,arcsin:Math.asin,acos:Math.acos,arccos:Math.acos,atan:Math.atan,arctg:Math.atan,sqrt:Math.sqrt,abs:Math.abs,ln:Math.log,log:Math.log10,lg:Math.log10,exp:Math.exp};
function grTokens(src){if(/\d\s+\d/.test(String(src)))throw Error('Між числами потрібен знак дії: 2*3, а не 2 3.');const s=String(src).toLowerCase().replace(/,/g,'.').replace(/\s+/g,'').replace(/π/g,'pi').replace(/·/g,'*').replace(/[−–]/g,'-');
 if(!s||s.length>120)throw Error('Вираз порожній або задовгий.');const out=[];let i=0;
 while(i<s.length){const ch=s[i];let m;
  if((m=/^(\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/.exec(s.slice(i)))){out.push({t:'n',v:Number(m[0])});i+=m[0].length}
  else if((m=/^[a-z]+/.exec(s.slice(i)))){out.push({t:'i',v:m[0]});i+=m[0].length}
  else if('+-*/^()'.includes(ch)){out.push({t:ch});i++}
  else throw Error('Незрозумілий символ «'+ch+'».')}
 return out}
function grParse(src){const tk=grTokens(src);let p=0,depth=0;const peek=()=>tk[p],next=()=>tk[p++];
 function expr(){let l=term();while(peek()&&(peek().t==='+'||peek().t==='-')){const op=next().t,r=term(),a=l;l=op==='+'?x=>a(x)+r(x):x=>a(x)-r(x)}return l}
 function term(){let l=unary();for(;;){const k=peek();if(!k)break;let op=null;if(k.t==='*'||k.t==='/'){next();op=k.t}else if(k.t==='('||k.t==='n'||k.t==='i')op='*';else break;const r=unary(),a=l;l=op==='*'?x=>a(x)*r(x):x=>a(x)/r(x)}return l}
 function unary(){const k=peek();if(k&&(k.t==='-'||k.t==='+')){next();const f=unary();return k.t==='-'?x=>-f(x):f}return power()}
 function power(){const b=primary();if(peek()&&peek().t==='^'){next();const e=unary(),a=b;return x=>Math.pow(a(x),e(x))}return b}
 function primary(){if(++depth>60)throw Error('Забагато вкладених дужок.');const k=next();let r;
  if(!k)throw Error('Вираз обірвано.');
  if(k.t==='n'){const v=k.v;r=()=>v}
  else if(k.t==='('){const f=expr();if(!peek()||peek().t!==')')throw Error('Бракує закривної дужки.');next();r=f}
  else if(k.t==='i'){if(k.v==='x')r=x=>x;else if(k.v==='pi')r=()=>Math.PI;else if(k.v==='e')r=()=>Math.E;
   else if(GR_FUNCS[k.v]){if(!peek()||peek().t!=='(')throw Error('Після «'+k.v+'» потрібні дужки: '+k.v+'(x).');next();const f=expr();if(!peek()||peek().t!==')')throw Error('Бракує закривної дужки.');next();const fn=GR_FUNCS[k.v];r=x=>fn(f(x))}
   else throw Error('Невідоме слово «'+k.v+'». Є x, pi, e та функції '+Object.keys(GR_FUNCS).join(', ')+'.')}
  else throw Error('Несподіваний символ «'+k.t+'».');
  depth--;return r}
 const f=expr();if(p<tk.length)throw Error('Зайвий символ «'+(tk[p].v??tk[p].t)+'».');return f}
const grNice=(range,target=6)=>{if(!(range>0))return 1;const raw=range/target,pow=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/pow;return (f<1.5?1:f<3?2:f<7?5:10)*pow};
// Мітки осі: не більше 60, кожна рахується як k*крок, без накопичення похибки.
function grTicks(lo,hi,step){const out=[];for(let k=Math.ceil(lo/step);out.length<60;k++){const v=k*step;if(v>hi+step*1e-6)break;out.push(v)}return out}
const grFmt=v=>{const r=Math.abs(v)<1e-9?0:v;return String(Number(r.toPrecision(6))).replace('.',',')};
function grSample(f,xmin,xmax,n=600){const pts=[];for(let i=0;i<=n;i++){const x=xmin+(xmax-xmin)*i/n;let y;try{y=f(x)}catch{y=NaN}pts.push([x,Number.isFinite(y)&&Math.abs(y)<1e9?y:NaN])}return pts}
function grRange(pts,ymin,ymax){if(Number.isFinite(ymin)&&Number.isFinite(ymax)&&ymax>ymin)return [ymin,ymax];const ys=pts.map(p=>p[1]).filter(Number.isFinite).sort((a,b)=>a-b);if(!ys.length)return null;
 let lo=ys[Math.floor(ys.length*.02)],hi=ys[Math.ceil(ys.length*.98)-1];if(hi-lo<1e-9){lo-=1;hi+=1}const pad=(hi-lo)*.1;return [lo-pad,hi+pad]}
// Нулі: точний нуль у точці, зміна знака (бісекція) і дотичні нулі (мінімум |y|, уточнений пошуком); розрив (асимптота) нулем не вважається.
function grRoots(f,pts){const step=(pts[pts.length-1][0]-pts[0][0])/(pts.length-1),out=[],add=r=>{if(Number.isFinite(r)&&!out.some(o=>Math.abs(o-r)<=step*1.5))out.push(r)};
 const absMax=Math.max(1,...pts.map(p=>Number.isFinite(p[1])?Math.abs(p[1]):0));
 for(let i=0;i<pts.length&&out.length<8;i++){const [x1,y1]=pts[i];if(!Number.isFinite(y1))continue;if(y1===0){add(x1);continue}
  const prev=i>0?pts[i-1]:null,next=i<pts.length-1?pts[i+1]:null;
  if(prev&&Number.isFinite(prev[1])&&prev[1]*y1<0){let a=prev[0],b=x1,fa=prev[1];for(let k=0;k<50;k++){const m=(a+b)/2,fm=f(m);if(!Number.isFinite(fm))break;if(fa*fm<=0)b=m;else{a=m;fa=fm}}const r=(a+b)/2,fr=f(r);if(Number.isFinite(fr)&&Math.abs(fr)<Math.max(1e-6,Math.abs(prev[1]-y1)*.01))add(r);continue}
  if(prev&&next&&Number.isFinite(prev[1])&&Number.isFinite(next[1])&&prev[1]*next[1]>=0&&Math.abs(y1)<Math.abs(prev[1])&&Math.abs(y1)<=Math.abs(next[1])&&Math.abs(y1)<absMax*.05){
   let a=prev[0],b=next[0];for(let k=0;k<80;k++){const m1=a+(b-a)/3,m2=b-(b-a)/3,g1=Math.abs(f(m1)),g2=Math.abs(f(m2));if(!(g1<=g2))a=m1;else b=m2}const xm=(a+b)/2,gm=Math.abs(f(xm));if(gm<1e-9*absMax)add(xm)}}
 return out.sort((a,b)=>a-b)}
function grSvg(f,xmin,xmax,ymin,ymax,label){const W=640,H=400,pad=48,pts=grSample(f,xmin,xmax),rng=grRange(pts,ymin,ymax);if(!rng)return null;const [lo,hi]=rng,sx=x=>pad+(W-2*pad)*(x-xmin)/(xmax-xmin),sy=y=>H-pad-(H-2*pad)*(y-lo)/(hi-lo);
 const stepX=grNice(xmax-xmin),stepY=grNice(hi-lo);let g='',t='';
 for(const x of grTicks(xmin,xmax,stepX)){g+=`<line class="gr-grid" x1="${sx(x).toFixed(1)}" x2="${sx(x).toFixed(1)}" y1="${pad}" y2="${H-pad}"/>`;t+=`<text x="${sx(x).toFixed(1)}" y="${H-pad+20}" text-anchor="middle">${grFmt(x)}</text>`}
 for(const y of grTicks(lo,hi,stepY)){g+=`<line class="gr-grid" x1="${pad}" x2="${W-pad}" y1="${sy(y).toFixed(1)}" y2="${sy(y).toFixed(1)}"/>`;t+=`<text x="${pad-6}" y="${(sy(y)+6).toFixed(1)}" text-anchor="end">${grFmt(y)}</text>`}
 const ax=xmin<=0&&xmax>=0?`<line class="gr-axis" x1="${sx(0).toFixed(1)}" x2="${sx(0).toFixed(1)}" y1="${pad}" y2="${H-pad}"/>`:'',ay=lo<=0&&hi>=0?`<line class="gr-axis" x1="${pad}" x2="${W-pad}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}"/>`:'';
 // Лінія розривається там, де немає значення або сусідні точки відрізняються більш ніж на два діапазони (асимптота).
 let d='',pen=false;for(let i=0;i<pts.length;i++){const [x,y]=pts[i];if(!Number.isFinite(y)||y<lo-(hi-lo)||y>hi+(hi-lo)){pen=false;continue}
  const jump=i>0&&Number.isFinite(pts[i-1][1])&&Math.abs(y-pts[i-1][1])>2*(hi-lo);if(!pen||jump){d+=`M${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;pen=true}else d+=`L${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`}
 return `<svg class="gr-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${g}${ax}${ay}<path class="gr-line" d="${d}" fill="none"/>${t}</svg>`}
let gr={f:'x^2-4',xmin:'-10',xmax:'10',ymin:'',ymax:''};
function grPlot(){const num=v=>v===''||v==null?NaN:Number(String(v).replace(',','.'));let f,err='';
 try{f=grParse(gr.f)}catch(e){err=e.message}
 const xmin=num(gr.xmin),xmax=num(gr.xmax);if(!err&&!(Number.isFinite(xmin)&&Number.isFinite(xmax)&&xmax-xmin>=1e-6&&Math.abs(xmin)<=1e4&&Math.abs(xmax)<=1e4))err='Межі x мають бути числами, різниця між ними не менша за 0,000001, а самі межі не більші за 10 000 за модулем.';
 const ymin=num(gr.ymin),ymax=num(gr.ymax);if(!err&&(gr.ymin!==''||gr.ymax!=='')&&!(Number.isFinite(ymin)&&Number.isFinite(ymax)&&ymax-ymin>=1e-6&&Math.abs(ymin)<=1e9&&Math.abs(ymax)<=1e9))err='Межі y: або обидві порожні, або обидві числа, різниця між ними не менша за 0,000001, а самі межі не більші за мільярд за модулем.';
 if(err)return {err};
 const pts=grSample(f,xmin,xmax),finite=pts.filter(p=>Number.isFinite(p[1]));if(!finite.length)return {err:'У цьому проміжку функція не має значень.'};
 const roots=grRoots(f,pts),ys=finite.map(p=>p[1]),mn=Math.min(...ys),mx=Math.max(...ys);
 // Найменше й найбільше беруться з обчислених точок: біля розривів і для необмежених функцій справжнього екстремуму може не бути.
 const label='Графік функції y = '+gr.f+' на проміжку від '+grFmt(xmin)+' до '+grFmt(xmax)+'. Серед обчислених точок найменше значення приблизно '+grFmt(mn)+', найбільше приблизно '+grFmt(mx)+'.'+(roots.length?' Нулі приблизно: '+roots.map(grFmt).join(', ')+'.':' Нулів серед обчислених точок не знайдено.');
 const rows=[];for(let x=Math.ceil(xmin);x<=xmax&&rows.length<21;x++){let y;try{y=f(x)}catch{y=NaN}rows.push([x,!Number.isFinite(y)?'не існує':Math.abs(y)>=1e9?'завелике (понад мільярд)':grFmt(y)])}
 return {svg:grSvg(f,xmin,xmax,ymin,ymax,label),roots,rows,label}}
function grSubmit(){gr={f:$('#gr-f').value,xmin:$('#gr-xmin').value,xmax:$('#gr-xmax').value,ymin:$('#gr-ymin').value,ymax:$('#gr-ymax').value};graphPage()}
function grPreset(s){gr={f:s,xmin:'-10',xmax:'10',ymin:'',ymax:''};graphPage()}
function graphPage(){const r=grPlot(),presets=['x^2-4','1/x','sqrt(x)','sin(x)','abs(x)-2','2^x','ln(x)','(x-1)(x+2)(x-3)'];
 $('#main').innerHTML=pHeading('Математика','Графік функції','Введи формулу з x, наприклад x^2-4, 2x+1, sin(x), 1/x. Логарифми: log(x) і lg(x) десяткові, ln(x) натуральний. Побудова наближена: вона допомагає перевірити власні обчислення, а не замінює їх.')
 +`<section class="p-section"><form class="gr-form" onsubmit="event.preventDefault();grSubmit()"><div class="p-form-grid"><label>y =<input id="gr-f" value="${esc(gr.f)}" autocomplete="off" spellcheck="false" ${r.err?'aria-invalid="true" aria-describedby="gr-err"':''}></label><label>x від<input id="gr-xmin" inputmode="decimal" value="${esc(gr.xmin)}"></label><label>x до<input id="gr-xmax" inputmode="decimal" value="${esc(gr.xmax)}"></label><label>y від (необов’язково)<input id="gr-ymin" inputmode="decimal" value="${esc(gr.ymin)}"></label><label>y до (необов’язково)<input id="gr-ymax" inputmode="decimal" value="${esc(gr.ymax)}"></label></div><div class="p-actions gap"><button class="primary" type="submit">Побудувати</button></div></form><p class="gr-presets">Приклади: ${presets.map(p=>`<button type="button" class="chip" data-f="${esc(p)}" onclick="grPreset(this.dataset.f)">${esc(p)}</button>`).join(' ')}</p></section>`
 +(r.err?`<p class="p-error" id="gr-err" role="alert">${esc(r.err)}</p>`:`<section class="p-section"><div class="gr-wrap">${r.svg||''}</div><p>${esc(r.label)}</p><details><summary>Значення в цілих точках</summary><table class="find-table"><thead><tr><th scope="col">x</th><th scope="col">y</th></tr></thead><tbody>${r.rows.map(([x,y])=>`<tr><td>${grFmt(x)}</td><td>${y}</td></tr>`).join('')}</tbody></table></details></section>`)
 +pFoot()}
const grLibraryBase=pLibrary;pLibrary=function(){grLibraryBase();$('#main .p-page-head')?.insertAdjacentHTML('afterend','<p class="p-caption"><a href="#cards">Мої картки ›</a> · <a href="#graph">Графік функції ›</a></p>')};
const grRenderBase=render;render=function(){if((location.hash.slice(1)||'hub')==='graph'){route='graph';document.documentElement.dataset.focus='';graphPage();syncSiteNavigation();document.title='Графік функції · Складено';testsPaint();return}grRenderBase()};
const grCrumbsBase=siteCrumbs;siteCrumbs=function(){return (location.hash.slice(1)||'hub')==='graph'?[{label:'Головна',to:'hub'},{label:'Графік функції',to:'graph'}]:grCrumbsBase()};

/* 80. Режим для порушень кольоросприйняття: палітра Окабе та Іто (синій, помаранчевий) замість зеленого й червоного, значки й візерунки замість самого кольору. */
const CVD_KEY='skladeno-cvd';
const cvdOn=()=>{try{return localStorage.getItem(CVD_KEY)==='on'}catch{return false}};
function cvdApply(){if(cvdOn())document.documentElement.dataset.cvd='on';else delete document.documentElement.dataset.cvd}
function cvdSet(on){try{if(on)localStorage.setItem(CVD_KEY,'on');else localStorage.removeItem(CVD_KEY)}catch{}cvdApply();toast(on?'Режим для кольоросприйняття ввімкнено.':'Режим для кольоросприйняття вимкнено.');pSettings()}
cvdApply();
const cvdSettingsBase=pSettings;pSettings=function(){cvdSettingsBase();const f=$('#main .p-footer'),on=cvdOn(),
 html=`<section class="p-alert" id="cvd-setting"><div><h2>Кольори без зеленого й червоного</h2><p>Для людей, які погано розрізняють зелений і червоний: правильне й неправильне позначаються синім і помаранчевим, а ще значками ✓ і ✗, карта знань і навігатор отримують візерунки. Це допомога, а не заміна перевірки: якщо щось усе одно складно розрізнити, напиши про це через «Знайшов помилку».</p><div class="p-actions">${[[false,'Звичайні кольори'],[true,'Без зеленого й червоного']].map(([v,l])=>`<button aria-pressed="${on===v}" ${on===v?'class="primary"':''} onclick="cvdSet(${v})">${l}</button>`).join('')}</div></div></section>`;
 if(f)f.insertAdjacentHTML('beforebegin',html);else $('#main').insertAdjacentHTML('beforeend',html)};
