// Reference search: й/и and ї/і stay different letters, missing example text is not searchable as «undefined».
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
ok(refSearchKey('Йосип')!==refSearchKey('Иосип')&&refSearchKey('їжак')!==refSearchKey('іжак'),'й/и and ї/і are not merged');
ok(refSearchKey('а\u0301')===refSearchKey('а'),'stress marks are ignored');
refSubject='';refKind='';refQuery='undefined';
ok(refCards().length===0,'«undefined» matches no card');
log('fails',fails);
})();
