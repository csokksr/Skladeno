/* Веб-збірка: тексти завдань і конспектів лежать у files/pack-<предмет>.js. Ядро даних (data.js) містить лише заглушки
   завдань без prompt, passage, explanation (поле _h називає відсутні поля) і тем без notes; options, left, right, rows мають
   лише заглушки потрібної довжини: прогрес перевіряється на старті, до гідратації, і йому потрібні тільки довжини.
   Пакет домальовує ці поля в тих самих об'єктах (PM, QM, PT і сирі завдання тем), тож решта коду бачить повні дані.
   Поки пакет не прийшов, читання такого поля тексту кидає помилку, а не дає порожнє значення: сторінка чекає пакет і малюється
   знову, а дія в обробнику просто не виконується, нічого не пишучи в прогрес. Головна й списки тем не потребують текстів. */
const PACK_NAMES=window.SKLADENO_PACKS||[],PACK_DONE=new Set(),PACK_WAIT={};
const PACK_LIGHT=new Set(['hub','subject','mocks','analytics','plan','library','tests','rhythm','about','graph','strategy','topics','topic','cards','history-archive','advanced','quality','coach','audit','preferences']);
let PACK_RAW=null,PACK_MISS=false;
function packGuard(o){if(!o||!o._h)return;for(const k of o._h)Object.defineProperty(o,k,{configurable:true,enumerable:false,get(){PACK_MISS=true;const e=new Error('pack not loaded: '+k);e.packMiss=true;throw e},set(v){Object.defineProperty(this,k,{value:v,writable:true,enumerable:true,configurable:true})}})}
function packRaw(){if(PACK_RAW)return PACK_RAW;PACK_RAW=Object.create(null);for(const s of PB)for(const t of s.topics)for(const q of t.questions)PACK_RAW[q.id]=q;return PACK_RAW}
if(PACK_NAMES.length){const raw=packRaw();for(const id in raw)packGuard(raw[id]);for(const q of Q)packGuard(q);for(const q of PQ)packGuard(q);for(const id in PT)packGuard(PT[id])}
const PACK_RES={};
// Домальовування порціями по 400 завдань між задачами браузера: довга задача блокує сторінку, а пакети важкі.
function SK_PACK(name,pack){
 const raw=packRaw(),ids=Object.keys(pack.q);let i=0;
 const step=()=>{
  for(const end=Math.min(i+400,ids.length);i<end;i++){const id=ids[i],h=pack.q[id],m=PM[id],h0=QM[id],r=raw[id];
   if(h0)Object.assign(h0,h);if(r)Object.assign(r,h);
   if(m){Object.assign(m,h);if(m.subject==='hist'){m.left=m.rows;m.right=m.options}}}
  if(i<ids.length){setTimeout(step,0);return}
  for(const id of Object.keys(pack.t))if(PT[id])Object.assign(PT[id],pack.t[id]);
  PACK_DONE.add(name);if(PACK_RES[name])PACK_RES[name]()};
 step()}
function packLoad(name){
 if(PACK_DONE.has(name))return Promise.resolve();
 return PACK_WAIT[name]||(PACK_WAIT[name]=new Promise((ok,fail)=>{PACK_RES[name]=()=>ok(undefined);const s=document.createElement('script');s.src='files/pack-'+name+'.js';s.onerror=()=>{delete PACK_WAIT[name];s.remove();fail(new Error('pack '+name))};document.head.appendChild(s)}))}
function packAll(){return Promise.all(PACK_NAMES.map(packLoad))}
function packFailed(){const m=$('#main');if(m)m.innerHTML='<section class="p-section"><h1>Матеріали не завантажилися</h1><p>Перевір з’єднання й онови сторінку. Прогрес у браузері не втрачено.</p><p><button onclick="location.reload()">Оновити сторінку</button></p></section>'}
if(PACK_NAMES.length){
 const packRenderBase=render,allDone=()=>PACK_NAMES.every(n=>PACK_DONE.has(n)),wait=()=>{const m=$('#main');if(m)m.innerHTML='<p class="p-caption" role="status">Завантажую завдання…</p>';const at=location.hash;packAll().then(()=>{if(location.hash===at)render()},packFailed)};
 render=function(){
  if(allDone()){packRenderBase();return}
  if(!PACK_LIGHT.has((location.hash.slice(1)||'hub').split('/')[0])){wait();return}
  PACK_MISS=false;packRenderBase();
  if(PACK_MISS)wait()};
 // Пакети вантажаться у фоні відразу після старту; перший екран їх не чекає.
 packAll().then(()=>{},()=>{});
}
