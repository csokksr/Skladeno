/* Веб-версія (артефакт claude.ai): діалоги на сторінці замість confirm(), збереження файлів через downloads,
   PDF за справжніми посиланнями, синхронізація прогресу між пристроями через приватне сховище db. */
document.documentElement.lang='uk';
const webCap=name=>window.claude?.use?window.claude.use(name).catch(()=>null):Promise.resolve(null);
let webDownloads=null,webDb=null,webUid=null;
webCap('downloads').then(d=>{webDownloads=d});

/* confirm(): у переглядачі він завжди повертає false. Показуємо власний діалог і після згоди повторюємо ту саму дію. */
let webAllow=null,webRetry=null;
document.body.insertAdjacentHTML('beforeend','<dialog id="web-confirm" class="web-confirm" aria-labelledby="web-confirm-text"><p id="web-confirm-text"></p><div class="p-actions"><button class="primary" id="web-confirm-yes">Так, продовжити</button><button id="web-confirm-no">Скасувати</button></div></dialog>');
window.confirm=function(message){if(webAllow===message){webAllow=null;return true}let trigger=window.event?.type==='click'?window.event.target?.closest?.('button,a,[onclick]'):null,retry=webRetry;webRetry=null;const dlg=$('#web-confirm');$('#web-confirm-text').textContent=message;
 $('#web-confirm-yes').onclick=()=>{dlg.close();webAllow=message;if(trigger&&trigger.isConnected)trigger.click();else if(retry)retry();webAllow=null};$('#web-confirm-no').onclick=()=>dlg.close();
 if(!trigger&&!retry)return false;dlg.showModal();return false};
// Файлові поля скидають value до виклику confirm(), тож повтор отримує той самий файл.
function webWrapFile(sel){const el=$(sel);if(!el||!el.onchange)return;const base=el.onchange;el.onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const fake={target:{files:[file],value:''}};const run=()=>{webRetry=run;return base(fake)};run()}}
webWrapFile('#import-file');webWrapFile('#p-import-file');

/* Файли: лише через підтвердження переглядача. */
async function webSave(filename,data){if(!webDownloads){toast('Збереження файлів тут недоступне. Скористайся текстовим кодом копії.');return false}try{await webDownloads.save({filename,data});return true}catch(e){if(e?.code!=='declined')toast(e?.code==='rate_limited'?'Зачекай кілька секунд і спробуй ще раз.':'Файл не збережено.');return false}}
download=function(name,text){webSave(name,text)};
pBackup=function(){webSave('skladeno-progress-'+pDay()+'.json',JSON.stringify(pBackupData())).then(ok=>{if(ok)toast('Резервну копію збережено.')})};
offlineSave=function(){if(!offlineURL)return;fetch(offlineURL).then(r=>r.blob()).then(b=>webSave('skladeno-nmt.html',b)).then(ok=>{if(ok)offlineStatus('Файл збережено. Відкривай його в браузері; прогрес перенеси окремою копією JSON.')})};

/* PDF: відкриваємо справжнім посиланням у новій вкладці або зберігаємо файлом. */
function webPdfDialog(title,url,filename){$('#modalbody').innerHTML=`<div class="p-section-head"><h2>${esc(title)}</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><p>PDF відкриється в новій вкладці браузера.</p><div class="p-actions"><a class="primary" href="${esc(url)}" target="_blank" rel="noopener">Відкрити PDF ›</a><button id="web-pdf-save">Зберегти PDF</button></div>`;$('#web-pdf-save').onclick=async()=>{try{const b=await(await fetch(url)).blob();if(await webSave(filename,b))$('#modal').close()}catch{toast('Не вдалося отримати PDF. Перевір підключення.')}};$('#modal').showModal()}
auditPDF=function(id){const d=DB.officialDocs.find(d=>d.id===id);if(d)webPdfDialog(d.title,d.data,'ucoyao-'+id+'.pdf')};
offPDF=function(sid,kind='questions'){const paper=OFFICIAL_PAPERS[sid];if(!paper||!['questions','keys'].includes(kind))return;if(kind==='keys'&&(P.official.current?.subject===sid||!P.official.records.some(r=>r.subject===sid))){toast('Ключ доступний після завершення демоваріанта.');return}webPdfDialog((kind==='keys'?'Ключ до демоваріанта · ':'Умови демоваріанта · ')+SUB[sid].name,paper.documents[kind].data,'nmt-2026-'+sid+'-'+kind+'.pdf')};

/* Синхронізація: стиснений знімок обох сховищ у приватному підпросторі користувача, частинами до 200 КБ. */
const WEB_CHUNK=200000,WEB_SYNC_AT='skladeno-sync-at';
let webTimer=null,webBusy=false,webLastSent='',webStatus='';
function webSetStatus(text){webStatus=text;const el=$('#save-status');if(el)el.textContent=text}
async function webPack(text){const s=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')),b=new Uint8Array(await new Response(s).arrayBuffer());let out='';for(let i=0;i<b.length;i+=32768)out+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(out)}
async function webUnpack(b64){const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()}
function webLocal(){try{return JSON.stringify({platform:localStorage.getItem(PKEY),history:localStorage.getItem(KEY)})}catch{return ''}}
function webRef(name){return webDb.doc('data/users/'+webUid+'/'+name)}
async function webUpload(){if(!webDb||!webUid||webBusy)return;const text=webLocal();if(!text||text===webLastSent)return;webBusy=true;webSetStatus('Синхронізую…');
 try{const packed=await webPack(text),n=Math.ceil(packed.length/WEB_CHUNK),at=Date.now();for(let i=0;i<n;i++)await webRef('progress-'+i).set({part:packed.slice(i*WEB_CHUNK,(i+1)*WEB_CHUNK)});await webRef('progress').set({chunks:n,savedAt:at,length:packed.length});webLastSent=text;try{localStorage.setItem(WEB_SYNC_AT,String(at))}catch{}webSetStatus('Синхронізовано з акаунтом')}
 catch(e){webSetStatus(e?.code==='quota_exceeded'?'Сховище заповнене: зроби резервну копію':'Збережено на цьому пристрої')}finally{webBusy=false}}
function webSchedule(){if(!webDb||!webUid)return;clearTimeout(webTimer);webTimer=setTimeout(webUpload,4000)}
const webSaveBase=save;save=function(){const r=webSaveBase.apply(this,arguments);webSchedule();return r};
const webPSaveBase=pSave;pSave=function(){const r=webPSaveBase.apply(this,arguments);if(webStatus)webSetStatus(webStatus);webSchedule();return r};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&webTimer){clearTimeout(webTimer);webUpload()}});
async function webDownload(){const head=await webRef('progress').get();if(!head.exists)return null;const h=head.data();let packed='';for(let i=0;i<h.chunks;i++){const p=await webRef('progress-'+i).get();if(!p.exists)return null;packed+=p.data().part}if(packed.length!==h.length)return null;return {savedAt:h.savedAt,text:await webUnpack(packed)}}
function webApply(text){const raw=JSON.parse(text),platform=raw.platform?JSON.parse(raw.platform):null,history=raw.history?JSON.parse(raw.history):null;if(!platform)return false;const next=pNormal(platform),old=history?normaliseImport({app:'istoria200',state:history}):S;restoreCommit(next,old);P=next;S=old;return true}
(async()=>{const [db,user]=await Promise.all([webCap('db'),webCap('user')]);if(!db||!user)return;let uid=null;try{uid=await user.id()}catch{}if(!uid)return;webDb=db;webUid=uid;
 try{const remote=await webDownload(),localAt=Number(localStorage.getItem(WEB_SYNC_AT)||0),hasLocal=!!localStorage.getItem(PKEY);
  if(remote&&remote.savedAt>localAt&&remote.text!==webLocal()){if(!hasLocal||localAt){if(webApply(remote.text)){webLastSent=remote.text;try{localStorage.setItem(WEB_SYNC_AT,String(remote.savedAt))}catch{}render();toast('Прогрес підтягнуто з іншого пристрою.')}}
   else{$('#web-confirm-text').textContent='У твоєму акаунті є прогрес з іншого пристрою, а в цьому браузері — свій. Замінити прогрес у цьому браузері збереженим в акаунті?';$('#web-confirm-yes').onclick=()=>{$('#web-confirm').close();if(webApply(remote.text)){webLastSent=remote.text;try{localStorage.setItem(WEB_SYNC_AT,String(remote.savedAt))}catch{}render();toast('Прогрес замінено збереженим в акаунті.')}};$('#web-confirm-no').onclick=()=>{$('#web-confirm').close();webUpload()};$('#web-confirm').showModal()}}
  else{webLastSent=remote&&remote.text===webLocal()?remote.text:'';webSetStatus('Синхронізовано з акаунтом');webSchedule()}}
 catch{webSetStatus('Збережено на цьому пристрої')}})();

/* Налаштування: пояснюємо, де зберігається прогрес у веб-версії. */
const webSettingsBase=pSettings;pSettings=function(){webSettingsBase();$('#main .p-page-head')?.insertAdjacentHTML('afterend',`<section class="p-alert"><div><h2>${webUid?'Прогрес синхронізується з твоїм акаунтом':'Прогрес зберігається в цьому браузері'}</h2><p>${webUid?'Відповіді, план і повторення автоматично зберігаються в приватному сховищі, яке бачиш лише ти. Відкрий сайт на іншому пристрої під тим самим акаунтом, і прогрес підтягнеться.':'Увійди в акаунт Claude, щоб прогрес синхронізувався між пристроями. Без входу роби резервну копію.'}</p></div></section>`)};
