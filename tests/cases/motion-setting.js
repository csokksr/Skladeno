// The motion setting: «auto» by default (follows the system), a choice is stored and applied to <html>, «auto» clears it.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const root=document.documentElement;localStorage.removeItem(MOTION_KEY);
ok(motionPref()==='auto','the default is auto');
motionSet('on');ok(motionPref()==='on'&&root.dataset.motion==='on','"always" is stored and set on <html>');
motionSet('off');ok(motionPref()==='off'&&root.dataset.motion==='off','"never" is stored and set on <html>');
motionSet('auto');ok(motionPref()==='auto'&&root.dataset.motion==='auto'&&localStorage.getItem(MOTION_KEY)===null,'auto clears the stored choice');
localStorage.setItem(MOTION_KEY,'garbage');ok(motionPref()==='auto','an unknown stored value counts as auto');
localStorage.removeItem(MOTION_KEY);
log('fails',fails);
})();
