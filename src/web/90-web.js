/* Веб-версія (артефакт claude.ai): збереження файлів через downloads,
   PDF за справжніми посиланнями, синхронізація прогресу між пристроями через приватне сховище db. */
document.documentElement.lang='uk';
const webCap=name=>window.claude?.use?window.claude.use(name).catch(()=>null):Promise.resolve(null);
let webDownloads=null,webDb=null,webUid=null;
webCap('downloads').then(d=>{webDownloads=d});

/* Файли: лише через підтвердження переглядача. */
async function webSave(filename,data){if(!webDownloads){toast('Збереження файлів тут недоступне. Скористайся текстовим кодом копії.');return false}try{await webDownloads.save({filename,data});return true}catch(e){if(e?.code!=='declined')toast(e?.code==='rate_limited'?'Зачекай кілька секунд і спробуй ще раз.':'Файл не збережено.');return false}}
download=function(name,text){return webSave(name,text)};
pBackup=function(){webSave('skladeno-progress-'+pDay()+'.json',JSON.stringify(pBackupData())).then(ok=>{if(ok)toast('Резервну копію збережено.')})};
offlineSave=function(){if(!offlineURL)return;fetch(offlineURL).then(r=>r.blob()).then(b=>webSave('skladeno-nmt.html',b)).then(ok=>{if(ok)offlineStatus('Файл збережено. Відкривай його в браузері; прогрес перенеси окремою копією JSON.')})};

/* PDF: відкриваємо справжнім посиланням у новій вкладці або зберігаємо файлом. */
function webPdfDialog(title,url,filename){$('#modalbody').innerHTML=`<div class="p-section-head"><h2>${esc(title)}</h2><button onclick="$('#modal').close()" aria-label="Закрити">×</button></div><p>PDF відкриється в новій вкладці браузера.</p><div class="p-actions"><a class="primary" href="${esc(url)}" target="_blank" rel="noopener">Відкрити PDF ›</a><button id="web-pdf-save">Зберегти PDF</button></div>`;$('#web-pdf-save').onclick=async()=>{try{const b=await(await fetch(url)).blob();if(await webSave(filename,b))$('#modal').close()}catch{toast('Не вдалося отримати PDF. Перевір підключення.')}};$('#modal').showModal()}
auditPDF=function(id){const d=DB.officialDocs.find(d=>d.id===id);if(d)webPdfDialog(d.title,d.data,'ucoyao-'+id+'.pdf')};
offPDF=function(sid,kind='questions'){const paper=OFFICIAL_PAPERS[sid];if(!paper||!['questions','keys'].includes(kind))return;if(!paper.documents?.[kind]?.data){toast('PDF для цього варіанта недоступний.');return}if(kind==='keys'&&(P.official.current?.subject===sid||!P.official.records.some(r=>r.subject===sid))){toast('Ключ доступний після завершення демоваріанта.');return}webPdfDialog((kind==='keys'?'Ключ до демоваріанта · ':'Умови демоваріанта · ')+SUB[sid].name,paper.documents[kind].data,'nmt-'+(Number(paper.year)||2026)+'-'+sid+'-'+kind+'.pdf')};

/* Синхронізація: стиснений знімок обох сховищ у приватному підпросторі користувача, частинами до 200 КБ.
   Частини пишуться як progress-<at>-<i>, заголовок progress {at, chunks, length} пишеться останнім: поки його немає, читається попередній цілий знімок.
   Старий формат (progress-<i> і заголовок із savedAt) ще читається. Розбіжність двох пристроїв завжди зливається (src/modules/98-merge.js). */
const WEB_CHUNK = 200000, WEB_SYNC_AT = 'skladeno-sync-at', WEB_SYNC_HASH = 'skladeno-sync-hash';
let webTimer = null, webBusy = false, webLastSent = '', webStatus = '';
// Відбиток локального прогресу на момент синхронізації: після злиття заливаємо лише коли щось справді змінилося.
function webHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + '.' + s.length; }
function webMarkSynced(text) { try { localStorage.setItem(WEB_SYNC_HASH, webHash(text)); } catch {} }
function webSetStatus(text) { webStatus = text; const el = $('#save-status'); if (el) el.textContent = text; }
async function webPack(text) {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')), b = new Uint8Array(await new Response(s).arrayBuffer());
  let out = '';
  for (let i = 0; i < b.length; i += 32768) out += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(out);
}
async function webUnpack(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
function webLocal() { try { return JSON.stringify({ platform: localStorage.getItem(PKEY), history: localStorage.getItem(KEY) }); } catch { return ''; } }
function webRef(name) { return webDb.doc('data/users/' + webUid + '/' + name); }
// Ім'я частини за заголовком: новий формат має поле at, старий — savedAt і частини progress-<i>.
const webPart = (h, i) => (h.at ? 'progress-' + h.at + '-' + i : 'progress-' + i);
async function webHead() { const d = await webRef('progress').get(); return d.exists ? d.data() : null; }
async function webDownload(head) {
  const h = head || await webHead();
  if (!h) return null;
  let packed = '';
  for (let i = 0; i < h.chunks; i++) { const p = await webRef(webPart(h, i)).get(); if (!p.exists) return null; packed += p.data().part; }
  if (packed.length !== h.length) return null;
  return { savedAt: h.at || h.savedAt, text: await webUnpack(packed) };
}
// Зливає віддалений знімок із локальним прогресом і записує результат; повертає false, коли знімок непридатний.
function webApply(text) {
  const raw = JSON.parse(text), platform = raw.platform ? JSON.parse(raw.platform) : null, history = raw.history ? JSON.parse(raw.history) : null;
  if (!platform) return false;
  const m = webMerge({ platform: P, history: S }, { platform, history });
  const next = pNormal(m.platform), old = m.history ? normaliseImport({ app: 'istoria200', state: m.history }) : S;
  restoreCommit(next, old);
  P = next; S = old;
  return true;
}
// Підтягує віддалений знімок, коли він новіший за останню синхронізацію цього пристрою; true, якщо локальні дані змінилися.
async function webPull(head) {
  const at = Number(localStorage.getItem(WEB_SYNC_AT) || 0), h = head === undefined ? await webHead() : head;
  if (!h || (h.at || h.savedAt) <= at) return false;
  const remote = await webDownload(h);
  if (!remote || !webApply(remote.text)) return false;
  try { localStorage.setItem(WEB_SYNC_AT, String(remote.savedAt)); } catch {}
  return true;
}
async function webUpload() {
  if (!webDb || !webUid || webBusy) return;
  if (!webLocal() || webLocal() === webLastSent) return;
  webBusy = true; webSetStatus('Синхронізую…');
  try {
    const old = await webHead();
    if (await webPull(old)) { render(); toast('Прогрес з іншого пристрою злито з цим.'); }
    const text = webLocal(), packed = await webPack(text), n = Math.ceil(packed.length / WEB_CHUNK), at = Date.now();
    const head = { at, chunks: n, length: packed.length };
    for (let i = 0; i < n; i++) await webRef(webPart(head, i)).set({ part: packed.slice(i * WEB_CHUNK, (i + 1) * WEB_CHUNK) });
    await webRef('progress').set(head);
    webLastSent = text; webMarkSynced(text);
    try { localStorage.setItem(WEB_SYNC_AT, String(at)); } catch {}
    webSetStatus('Синхронізовано з акаунтом');
    // Старі частини видаляємо вже після запису заголовка; збій тут не псує знімок.
    if (old) { for (let i = 0; i < old.chunks; i++) await webRef(webPart(old, i)).delete().catch(() => {}); }
  } catch (e) {
    webSetStatus(e?.code === 'quota_exceeded' ? 'Сховище заповнене: зроби резервну копію' : 'Збережено на цьому пристрої');
  } finally { webBusy = false; }
}
function webSchedule() { if (!webDb || !webUid) return; clearTimeout(webTimer); webTimer = setTimeout(webUpload, 4000); }
const webSaveBase = save; save = function () { const r = webSaveBase.apply(this, arguments); webSchedule(); return r; };
const webPSaveBase = pSave; pSave = function () { const r = webPSaveBase.apply(this, arguments); if (webStatus) webSetStatus(webStatus); webSchedule(); return r; };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && webTimer) { clearTimeout(webTimer); webUpload(); } });
(async () => {
  const [db, user] = await Promise.all([webCap('db'), webCap('user')]);
  if (!db || !user) return;
  let uid = null;
  try { uid = await user.id(); } catch {}
  if (!uid) return;
  webDb = db; webUid = uid;
  try {
    if (await webPull()) { webLastSent = ''; render(); toast('Прогрес підтягнуто з іншого пристрою.'); }
    else if (localStorage.getItem(WEB_SYNC_HASH) === webHash(webLocal())) webLastSent = webLocal(); // нічого не змінилося: не заливаємо знову
    webSetStatus('Синхронізовано з акаунтом');
    webSchedule();
  } catch { webSetStatus('Збережено на цьому пристрої'); }
})();

/* Налаштування: пояснюємо, де зберігається прогрес у веб-версії. */
const webSettingsBase=pSettings;pSettings=function(){webSettingsBase();$('#main .p-page-head')?.insertAdjacentHTML('afterend',`<section class="p-alert"><div><h2>${webUid?'Прогрес синхронізується з твоїм акаунтом':'Прогрес зберігається в цьому браузері'}</h2><p>${webUid?'Відповіді, план і повторення автоматично зберігаються в приватному сховищі, яке бачиш лише ти. Відкрий сайт на іншому пристрої під тим самим акаунтом, і прогрес підтягнеться.':'Увійди в акаунт Claude, щоб прогрес синхронізувався між пристроями. Без входу роби резервну копію.'}</p></div></section>`)};
