// Test tools: hotkey switch, backup checksum, flags («повернутися») and their import guard, pace, time announcements, deep link, undo, picture status.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
// 1. hotkeys
localStorage.removeItem(HOTKEYS_KEY);ok(hotkeysOn(),'digit hotkeys are on by default');
hotkeysSet(false);ok(!hotkeysOn()&&localStorage.getItem(HOTKEYS_KEY)==='off','they can be switched off');
hotkeysSet(true);ok(hotkeysOn()&&localStorage.getItem(HOTKEYS_KEY)===null,'and on again');
// 2. backup checksum
const b=pBackupData();ok(/^[0-9a-f]{8}$/.test(b.check),'a backup carries an 8-digit checksum');
ok(backupSum(JSON.parse(JSON.stringify(b)))===b.check,'the checksum survives a JSON round trip');
const bad=JSON.parse(JSON.stringify(b));bad.platform.plan.minutes=bad.platform.plan.minutes===45?60:45;let threw='';try{pRestore(bad)}catch(e){threw=e.message}
ok(/контрольна сума/.test(threw),'a changed file is refused before anything is replaced');
// 3. flags
const [a,c,d]=PQ.filter(q=>!q.examOnly).slice(0,3).map(q=>q.id);
P.sessions={};pStart([a,c,d],'t','tt');route='practice';navFlagToggle();
ok(P.sessions.tt.flags&&P.sessions.tt.flags[a]===true,'toggle sets the flag on the shown task');
navFlagToggle();ok(!('flags' in P.sessions.tt),'toggling again removes it and the empty map');
ok(JSON.stringify(guardFlags({[a]:true,[c]:1,zzz:true},[a,c]))===JSON.stringify({flags:{[a]:true}}),'the guard keeps only true flags of the run\'s own tasks');
const imp=pNormal({schema:1,answers:{},sessions:{k:{ids:[a,c],title:'t',index:0,flags:{[a]:true,zzz:true}}}});
ok(imp.sessions.k.flags&&Object.keys(imp.sessions.k.flags).join()===a,'an imported session keeps a clean flag map');
// 4. pace
const singles=PQ.filter(q=>q.type==='single'&&!q.examOnly).slice(0,10).map(q=>q.id),e={full:false,deadline:Date.now()+30*60000,answers:{}};
let p=pacePlan(e,singles);ok(p.expected===5&&p.done===0&&p.diff===-5,'half the time gone: 5 of 10 expected');ok(/Відстаєш на 5/.test(paceText(p)),'behind is said in words');
for(const id of singles.slice(0,6))e.answers[id]=0;p=pacePlan(e,singles);ok(p.diff===1&&/Темп у нормі/.test(paceText(p)),'ahead of the plan is fine');
// 5. time announcements
ok(timeCross(31,30)===30&&timeCross(12,9)===10&&timeCross(6,4)===5&&timeCross(2,1)===1,'thresholds 30, 10, 5 and the last minute');
ok(timeCross(30,29)===0&&timeCross(10,10)===0,'no announcement between thresholds');
// 6. deep link
P.sessions={};pStart([a],'x','only-a');pStart([c,d],'y','cd');location.hash='#practice/'+d;render();
ok(P.current==='cd'&&P.sessions.cd.index===1,'the link opens the newest session that holds the task, at the task');
location.hash='#practice/'+a;render();ok(P.current==='only-a'&&Object.keys(P.sessions).pop()==='only-a','another session is found and becomes the newest');
const ghost='zz-'+Date.now();location.hash='#practice/'+ghost;let asked=0;toast=()=>{asked++};render();ok(asked===1&&!P.sessions['link-'+ghost],'an unknown task id says so and creates nothing');
// 7. undo
P.sessions={};pStart([a],'1','k-a');pStart([c],'2','k-b');pStart([d],'3','k-c');P.current='k-b';testsDrop('k-b');
ok(!P.sessions['k-b']&&P.current==='k-c'&&testsUndo&&testsUndo.pos===1,'a dropped session can be undone');
testsRestore();ok(Object.keys(P.sessions).join()==='k-a,k-b,k-c'&&P.current==='k-b','it comes back in its old place and as the current one');
// 8. pictures
znoStatus('loading','t2');ok(/Завантажую/.test($('#zno-status').innerHTML),'a status is shown while pictures load');
znoStatus('error','t2');ok(/Не вдалося/.test($('#zno-status').innerHTML)&&/znoRetry\('t2'\)/.test($('#zno-status').innerHTML),'a failure shows a retry for the same pack');
log('fails',fails);
})();
