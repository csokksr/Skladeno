// The error report text names the task and the build, and the practice page offers the button (not in timed tests).
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const q=PQ.find(q=>q.type==='single'&&!q.examOnly),txt=reportText(q);
ok(txt.includes(q.id)&&txt.includes('збірка')&&txt.includes(SUB[q.subject].name),'the text has the task id, the subject and the build');
ok(txt.endsWith('Що не так:\n'),'the text ends with a place for the description');
ok(txt.split('\n')[2].length<=220,'the task text is cut to 200 characters');
route='practice';pStart([q.id],'t','report');pPractice();
ok(/reportOpen\(\)/.test($('.p-question').innerHTML),'the practice page has the button');
reportOpen();ok($('#modalbody').innerHTML.includes(esc(q.id)),'the dialog shows the text for this task');
log('fails',fails);
})();
