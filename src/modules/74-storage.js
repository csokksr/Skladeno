// Progress lives only in this browser: remind about a backup, say whether the browser may evict the storage, show the build.
const STORE_BACKUP_KEY='skladeno-backup-at',STORE_NUDGE_DAYS=14,STORE_NUDGE_MIN=30;
// Checksum of the data in a backup file (CRC-32 of the JSON): a damaged or cut file is refused before it replaces progress.
function backupSum(o){let c,crc=-1;const s=JSON.stringify({platform:o.platform,history:o.history});for(let i=0;i<s.length;i++){c=(crc^s.charCodeAt(i))&255;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xEDB88320:c>>>1;crc=(crc>>>8)^c}return ((crc^-1)>>>0).toString(16).padStart(8,'0')}
const storeBackupDataBase=pBackupData;pBackupData=function(){try{localStorage.setItem(STORE_BACKUP_KEY,String(Date.now()))}catch{}const o=storeBackupDataBase();o.check=backupSum(o);return o};
const storeRestoreBase=pRestore;pRestore=function(raw){if(raw&&raw.check!==undefined&&raw.check!==backupSum(raw))throw Error('Файл копії пошкоджено: контрольна сума не збігається. Відновлення скасовано, поточний прогрес не змінено.');return storeRestoreBase(raw)};
function storeBackupAge(){let at=0;try{at=Number(localStorage.getItem(STORE_BACKUP_KEY))||0}catch{}return at?Math.floor((Date.now()-at)/864e5):null}
// With account sync (web version) the progress is also stored remotely, so no nudge.
function storeNeedsBackup(){const age=storeBackupAge(),synced=typeof webUid!=='undefined'&&!!webUid;return !synced&&Object.keys(pAnswers()).length>=STORE_NUDGE_MIN&&(age===null||age>=STORE_NUDGE_DAYS)}
const storeHubBase=pHub;pHub=function(){storeHubBase();if(!storeNeedsBackup())return;const age=storeBackupAge();
$('#main .p-page-head')?.insertAdjacentHTML('afterend',`<section class="p-alert"><div><h2>Зроби резервну копію прогресу</h2><p>Прогрес зберігається лише в цьому браузері, і очищення даних його стирає. ${age===null?'Копії ще не було.':'Остання копія була '+stPlural(age,'день','дні','днів')+' тому.'}</p><a class="primary" href="#preferences">Зробити копію ›</a></div></section>`)};
function storePersist(){navigator.storage.persist().then(ok=>{toast(ok?'Браузер збереже дані.':'Браузер не дав гарантії. Роби резервні копії.');pSettings()})}
const storeSettingsBase=pSettings;pSettings=async function(){storeSettingsBase();const head=$('#main .p-page-head');if(!head)return;
const persisted=navigator.storage?.persisted?await navigator.storage.persisted():null,build=typeof BUILD_ID==='string'?BUILD_ID:'';
head.insertAdjacentHTML('afterend',`<section class="p-alert"><div><h2>Сховище браузера</h2><p>${persisted===null?'Цей браузер не повідомляє, чи збереже він дані.':persisted?'Браузер не видалятиме дані сам.':'Браузер може видалити дані, якщо бракуватиме місця або сайт довго не відкривати.'} Надійніше все одно мати резервну копію.</p>${persisted===false&&navigator.storage.persist?'<button onclick="storePersist()">Просити браузер зберігати дані</button>':''}${build?`<p class="p-caption">Збірка ${esc(build)}</p>`:''}</div></section>`)};
// Closing the tab during a timed test keeps the clock running, so ask first.
addEventListener('beforeunload',e=>{if(P.exam&&P.exam.deadline>Date.now()){e.preventDefault();e.returnValue=''}});
