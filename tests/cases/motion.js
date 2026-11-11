// Motion helpers that do not need a screen: the direction of a move between tasks and the hook other modules use.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const m=window.skMotion;
ok(!!m&&typeof m.reveal==='function'&&typeof m.leave==='function','other modules get reveal and leave');
ok(m.dir(3,4)===1&&m.dir(4,3)===-1,'forward is +1, back is -1');
ok(m.dir(3,3)===0&&m.dir(0,4)===0&&m.dir(4,0)===0,'no move, or no task on one side, means no slide');
let called=0;m.leave(null,()=>called++);ok(called===1,'leave without an element still finishes');
log('fails',fails);
})();
