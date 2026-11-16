// Data tools: reset of a topic and a subject with undo, notes in search, notes export, stopwatch, image zoom.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
toast=()=>{};
const sid=SUBJECTS[1].id,list=testsTopicList(sid),t1=list[0],t2=list[1],other=SUBJECTS[0].id;
const mkAns=id=>({value:0,score:1,max:1,first:1,attempts:1,at:1,due:1});
const o=testsTopicList(other)[0].ids[0];
// 1. reset
P.answers={};S.answers={};P.drafts={};S.drafts={};P.study.srs={};P.coach.items={};P.read=[t1.id,t2.id];P.notes={[t1.id]:'моя нотатка'};
const a1=t1.ids[0],a2=t1.ids[1],b1=t2.ids[0];
for(const id of [a1,a2,b1,o])P.answers[id]=mkAns(id);P.drafts[a2]=1;P.study.srs[a1]={e:2.5,i:1,n:1,l:0,d:''};P.coach.items[a1]={reason:'',streak:0,lastDay:'',confidence:2};
ok(dtCount(dtIds(sid,t1.id))===2&&dtCount(dtIds(sid,''))===3,'counts of saved answers per topic and per subject');
dtReset(sid,t1.id);
ok(!P.answers[a1]&&!P.answers[a2]&&P.answers[b1]&&P.answers[o],'a topic reset removes only that topic');
ok(!(a2 in P.drafts)&&!P.study.srs[a1]&&!P.coach.items[a1],'drafts, repetition and confidence of the topic go too');
ok(P.read.join()===t2.id&&P.notes[t1.id]==='моя нотатка','the read mark of the topic goes, notes stay');
dtRestore();ok(P.answers[a1]&&P.answers[a2]&&P.drafts[a2]===1&&P.study.srs[a1]&&P.coach.items[a1].confidence===2&&P.read.includes(t1.id),'undo brings everything back');
ok(dtUndo.length===0,'undo is used once');
dtReset(sid,'');ok(!P.answers[a1]&&!P.answers[b1]&&P.answers[o]&&P.read.length===0,'a subject reset removes all topics of the subject, other subjects stay');
P.answers[a1]=mkAns(a1);P.answers[a1].at=7;dtRestore();ok(P.answers[a1].at===7,'undo does not overwrite an answer given after the reset');
P.answers={};P.answers[a1]=mkAns(a1);P.answers[b1]=mkAns(b1);dtReset(sid,t1.id);dtReset(sid,t2.id);ok(dtUndo.length===2&&!P.answers[a1]&&!P.answers[b1],'two resets in a row');
dtRestore();ok(P.answers[b1]&&!P.answers[a1],'undo returns the last reset first');dtRestore();ok(P.answers[a1]&&P.answers[b1],'and then the one before it');
P.coach.events=[{id:a1,at:1,score:0,max:1,confidence:3},{id:o,at:2,score:1,max:1,confidence:1}];P.study.today={day:pDay(),review:[a1],learn:[]};dtReset(sid,t1.id);
ok(P.coach.events.length===1&&P.coach.events[0].id===o&&P.study.today===null,'confidence events and the plan of the day for those tasks are cleared');dtRestore();ok(P.coach.events.length===2&&P.study.today&&P.study.today.review[0]===a1,'and come back with the undo');
const hf=F.find(f=>f.topic===3);S.read=[hf.id];dtReset('hist','hist-3');ok(S.read.length===0,'read facts of a history topic are reset');dtRestore();ok(S.read[0]===hf.id,'and restored');
const hf2=F.find(f=>f.topic===4);S.read=[hf.id,hf2.id];dtReset('hist','hist-3');ok(S.read.join()===hf2.id,'other history topics keep their read facts');dtRestore();S.read=[];
// 2. notes in search
P.notes={[t1.id]:'Правило про велику літеру в назвах',[a1]:'  ',zzz:'нічого',[b1]:'спробуй розв’язати інакше'};S.notes={3:'нотатка до теми історії',99999:'зайва',abc:'x'};dtNoteSig=null;
const idx=findIndex(),notes=idx.filter(r=>r.kind==='note');
ok(notes.length===3&&notes.every(r=>SUB[r.subject]&&r.index===idx.indexOf(r)),'notes of topics, tasks and history topics are in the index, empty and unknown ones are not');
const hn=notes.find(r=>r.target==='S:3');ok(hn&&hn.subject==='hist'&&dtNoteInfo('S:3').route,'a history note points to its topic');
ok(!/\u27e6/.test(notes.find(r=>r.target===b1).title)&&notes.find(r=>r.target===b1).title.includes(b1),'a task note title has no markup and names the task');
const hit=findResults({query:'велику літеру',subject:'',kind:'',page:0}).filter(r=>r.kind==='note');ok(hit.length===1&&hit[0].target===t1.id,'a note is found by its words');
ok(findResults({query:'велику літеру',subject:'',kind:'note',page:0}).length===1&&findResults({query:'велику літеру',subject:'',kind:'lesson',page:0}).every(r=>r.kind==='lesson'),'the note filter works');
P.notes[t1.id]='зовсім інший текст';ok(findResults({query:'велику літеру',subject:'',kind:'note',page:0}).length===0&&findResults({query:'інший текст',subject:'',kind:'note',page:0}).length===1,'the index follows edits of a note');
ok(findIndex().filter(r=>r.kind==='note').length===3,'notes are not duplicated after rebuilds');
P.notes[t1.id]='зовсім інший текст';dtNoteSig=null;findIndex();P.notes[t1.id]='зовсім іншй текст';ok(findResults({query:'іншй',subject:'',kind:'note',page:0}).length===1,'an edit that keeps the length is seen too');P.notes[t1.id]='зовсім інший текст';
// 3. export
const txt=dtNotesText();ok(/^# Мої нотатки/.test(txt)&&txt.includes('Нотаток: 3.')&&txt.includes('зовсім інший текст')&&txt.includes('## '+SUB[t1.subject||sid].name),'the file lists notes under subject and topic');
let saved=null;download=(n,t,ty)=>{saved={n,t,ty}};dtNotesExport();ok(saved&&/^skladeno-notatky-\d{4}-\d{2}-\d{2}\.md$/.test(saved.n)&&saved.ty==='text/markdown','export saves a .md file');
saved=null;P.notes={};S.notes={};dtNotesExport();ok(saved===null,'without notes nothing is saved');
// 4. stopwatch
route='practice';P.sessions={};P.drafts={};P.answers={};S.answers={};const nq=PQ.find(q=>!q.examOnly&&q.subject!=='hist'&&q.type==='single').id;pStart([nq],'x','sw');pPractice();
ok(dtSw&&dtSw.id===nq&&dtSw.fresh===true&&/^\d+:\d{2}$/.test(dtSwText()),'the stopwatch starts when the task is shown');
dtSw.t0-=65000;ok(dtSwText()==='1:05','and counts seconds');
P.drafts[nq]=0;pCheck();pPractice();ok(!!dtSw.stop&&dtSw.fresh,'it stops after the check');
const frozen=dtSwText();dtSw.stop+=0;ok(dtSwText()===frozen,'and stays stopped');
pStart([nq],'x','sw2');pPractice();ok(dtSw.fresh===false&&dtSwText()==='—','an already answered task shows no time');
// 5. zoom
dtZoom('data:image/png;base64,AAAA','Схема');ok(/dt-zoom/.test($('#modalbody').innerHTML)&&/alt="Схема"/.test($('#modalbody').innerHTML),'zoom fills the body of the dialog, not the dialog itself');
dtZoom('x" onerror="alert(1)','a"b');ok(!/onerror="alert/.test($('#modalbody').innerHTML),'the address and the text are escaped');
log('fails',fails);
})();
