// Data safety: password-protected backup, storage usage, error journal, offline notice.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
toast=()=>{};
(async()=>{
// 1. encryption
ok(encOk(),'WebCrypto is available in the test page');
const plain=pBackupData(),packed=await encPack(plain,'пароль-для-тесту');
ok(encIsPacked(packed)&&packed.kdf==='PBKDF2-SHA256'&&packed.iter===600000&&!JSON.stringify(packed).includes('"answers"'),'a packed copy carries no readable progress');
ok(packed.salt.length>=22&&packed.iv.length>=16&&packed.data.length>100,'salt, vector and data are present');
const back=await encUnpack(JSON.parse(JSON.stringify(packed)),'пароль-для-тесту');
ok(JSON.stringify(back)===JSON.stringify(plain),'the right password gives the same copy back');
let msg='';try{await encUnpack(packed,'інший пароль')}catch(e){msg=e.message}ok(/Неправильний пароль/.test(msg),'a wrong password is refused with a clear message');
const tamper=JSON.parse(JSON.stringify(packed));tamper.data=tamper.data.slice(0,-8)+(tamper.data.endsWith('AAAAAAAA')?'BBBBBBBB':'AAAAAAAA');msg='';try{await encUnpack(tamper,'пароль-для-тесту')}catch(e){msg=e.message}ok(msg!=='','a changed file is refused');
const p2=await encPack(plain,'пароль-для-тесту');ok(p2.salt!==packed.salt&&p2.data!==packed.data,'every copy gets its own salt and vector');
for(const bad of [{...packed,iter:5},{...packed,iter:99999999},{...packed,kdf:'x'},{...packed,salt:'AAAA'},{...packed,data:'***'},{...packed,encrypted:false}]){msg='';try{await encUnpack(bad,'пароль-для-тесту')}catch(e){msg=e.message}ok(msg!=='','malformed header is refused before any key work')}
// the decrypted copy goes through the ordinary restore checks
const restored=pNormal(back.platform);ok(restored.schema===1,'and is a valid progress');
// 2. usage
const u=safeUsage();ok(u.chars>0&&u.rows.length>0,'the page counts what it stores');
const keep=localStorage.getItem(PKEY);localStorage.setItem(PKEY,(keep||'')+'x'.repeat(100000));ok(safeUsage().chars>=u.chars+100000,'and sees records that grew');if(keep===null)localStorage.removeItem(PKEY);else localStorage.setItem(PKEY,keep);
const html=await safeUsageHtml();ok(/заповнено приблизно \d+%/.test(html)&&/Найбільші записи/.test(html),'the usage text names the share and the biggest records');
ok(safeMB(1048576)==='1,0'&&safeMB(52428800)==='50','sizes are written in MB');
// 3. error journal
localStorage.removeItem(ERR_KEY);ok(errList().length===0,'the journal starts empty');
errLog('render',new Error('Boom <script>'));ok(errList().length===1&&errList()[0].k==='render'&&errList()[0].m==='Boom <script>'&&errList()[0].r,'a render error is stored with its section');
for(let i=0;i<14;i++)errLog('error','e'+i);ok(errList().length===10&&errList()[9].m==='e13','only the last 10 stay');
errLog('error','ResizeObserver loop limit exceeded');ok(errList()[9].m==='e13','the harmless ResizeObserver note is not stored');
errLog('weird','x'.repeat(500));ok(errList()[9].k==='error'&&errList()[9].m.length===160,'unknown kinds become "error", long messages are cut');
localStorage.setItem(ERR_KEY,'{broken');ok(errList().length===0,'a broken journal is ignored');
errLog('promise',{message:'rejected',stack:'Error: rejected\n    at foo (https://x/app.js:12:34)'});ok(errList()[0].s==='app.js:12','the place in the code is kept without the address');
const q=PQ.find(q=>!q.examOnly);const txt=reportText(q);ok(/Помилки сторінки \(останні 1\):/.test(txt)&&/\n\nЩо не так:\n$/.test(txt)&&/promise/.test(txt),'the report text lists the errors above the place for the description');
localStorage.removeItem(ERR_KEY);ok(!/Помилки сторінки/.test(reportText(q)),'without errors the report is as before');
ok(!JSON.stringify(errList()).includes('answers'),'the journal holds no progress');
// 3b. journal: addresses, repeats, bad dates, non-Error rejections
localStorage.removeItem(ERR_KEY);errLog('error',{message:'Boom',stack:'Error: Boom\n    at x (https://host/index.html?token=abc:def:123:45)'});ok(errList()[0].s==='index.html:123'&&!JSON.stringify(errList()).includes('token'),'the query part of the address never reaches the journal');
localStorage.removeItem(ERR_KEY);for(let i=0;i<5;i++)errLog('error',{message:'same',stack:''});ok(errList().length===1,'the same error repeated is one record');
errLog('error','other');ok(errList().length===2,'a different one is a new record');
localStorage.setItem(ERR_KEY,JSON.stringify([{at:1e20,k:'x',m:'bad date',r:'a',s:''},{at:5,k:'error',m:'fine',r:'hub',s:''}]));ok(errList().length===1&&errList()[0].m==='fine'&&typeof reportText(PQ[0])==='string','a record with an impossible date is dropped and the report still builds');
localStorage.removeItem(ERR_KEY);errLog('promise','SECRET answer text');ok(errList()[0].m==='Необроблена відмова (текст приховано)','a rejection with a text reason is not stored as text');
errLog('error',new Error('Unexpected token \'x\', "my private words" is not valid JSON at https://a.b/c?d=1'));ok(!/private words/.test(JSON.stringify(errList()))&&/\[json\]/.test(errList()[1].m)&&/\[url\]/.test(errList()[1].m),'JSON snippets and addresses are removed from messages');
localStorage.removeItem(ERR_KEY);
// 1b. password dialog flow and the checks around it
const pw='kolo-12345',saved=[];download=(n,tx)=>{saved.push({n,tx});return true};
$('#enc-pw').value='short';$('#enc-pw2').value='short';await encSave();ok(saved.length===0,'a short password saves nothing');
$('#enc-pw').value=pw;$('#enc-pw2').value='different-pw';await encSave();ok(saved.length===0,'passwords that differ save nothing');
download=()=>false;$('#enc-pw').value=pw;$('#enc-pw2').value=pw;await encSave();ok($('#enc-pw').value===pw,'when the file is not saved the fields are kept');
download=(n,tx)=>{saved.push({n,tx});return true};await encSave();ok(saved.length===1&&$('#enc-pw').value==='','a saved copy clears the password fields');
const file=JSON.parse(saved[0].tx);ok(encIsPacked(file),'and the file is a packed copy');
const nfd='й'.normalize('NFD'),nfc='й'.normalize('NFC');const pk=await encPack(plain,'пароль'+nfd);let okNfc=true;try{await encUnpack(pk,'пароль'+nfc)}catch{okNfc=false}ok(okNfc,'a password typed in another Unicode form still opens the file');
let m2='';try{await encUnpack({...file,salt:'AAAAA'},pw)}catch(e){m2=e.message}ok(m2==='Файл пошкоджено.','a base64 string of impossible length gives a Ukrainian message, not a browser one');
// the dialog
$('#p-backup-paste').value=JSON.stringify(file);pImportText();ok(encPacked&&encPacked.data===file.data,'a pasted packed copy opens the password dialog instead of the plain restore');
$('#enc-open-pw').value='wrong-password';await encDecrypt();ok(encRaw===null&&/Неправильний пароль/.test($('#enc-msg').textContent),'a wrong password keeps the dialog and shows why');
const p1=encPacked;$('#enc-open-pw').value=pw;const pending=encDecrypt();encPacked=null;await pending;ok(encRaw===null,'a result that arrives after the dialog was closed is dropped');
encPacked=p1;$('#enc-open-pw').value=pw;await encDecrypt();ok(encRaw&&encRaw.app==='skladeno','the right password decrypts');
const idr=PQ.find(q=>!q.examOnly).id;P.answers={};confirm=()=>true;encRestoreGo();ok(encRaw===null,'restore uses the decrypted copy once');
// 4. offline notice
ok(netIsWeb()===false,'the offline file is not the web version, so there is no notice');
netPaint();ok(netBanner.hidden===true,'the banner stays hidden there');
log('fails',fails);
})().catch(e=>{console.log('FAIL async',e&&e.stack||e)});
})();
