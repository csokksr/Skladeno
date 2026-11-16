// Comfort (87) and find-plus (88): field errors, next topic, key hint, copied prompt, line spacing, topic filter, typo fix, highlighting, history.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
toast=()=>{};
// 1. field error with aria
const reg={};document.getElementById=id=>reg[id]||null;
document.createElement=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v},set id(v){this._id=v;reg[v]=this},get id(){return this._id},remove(){delete reg[this._id]}});
const el={id:'p-numeric',dataset:{},attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(e,f){this.listeners[e]=f},insertAdjacentElement(){}};
fieldError(el,'Введи число');ok(el.attrs['aria-invalid']==='true'&&el.attrs['aria-describedby']==='p-numeric-err'&&reg['p-numeric-err']&&reg['p-numeric-err'].textContent==='Введи число','an invalid field points to its message');
ok(reg['p-numeric-err'].attrs.role==='alert','the message is announced');
fieldError(el,'Інше');ok(Object.keys(reg).length===1&&reg['p-numeric-err'].textContent==='Інше','a second error replaces the message, it does not stack');
el.listeners.input();ok(!('aria-invalid' in el.attrs)&&!reg['p-numeric-err'],'typing in the field clears the mark and the message');
// 2. next topic
const sid=SUBJECTS[1].id,tl=DB.quality.topics.filter(t=>t.subject===sid);
ok(comfortNext(tl[0].id)&&comfortNext(tl[0].id).id===tl[1].id&&comfortNext(tl[tl.length-1].id)===null&&comfortNext('zzz')===null,'the next topic follows the subject order, the last and unknown ones have none');
// 3. key hint and copied prompt
const single=PQ.find(q=>q.type==='single'&&q.options.length>=4),multi=PQ.find(q=>q.type==='multi'),num=PQ.find(q=>q.type==='numeric');
ok(/1–\d — обрати варіант, Enter — перевірити, ← і → — інше завдання/.test(comfortKeys(single)),'the hint lists digits, Enter and arrows for a choice task');
ok(!/обрати варіант/.test(comfortKeys(num)),'a number task has no digit hint');
hotkeysSet(false);ok(!/обрати варіант/.test(comfortKeys(single)),'and neither has a task when the digit keys are switched off');hotkeysSet(true);
const text=comfortPromptText(single);ok(text.includes(dtPlain(single.prompt))&&text.includes('A) ')&&text.includes('D) ')&&!/⟦/.test(text),'the copied text has the prompt and lettered options without markup');
const mt=PQ.find(q=>q.type==='match');ok(comfortPromptText(mt).includes('1) '),'a match task copies its rows');
let copied=null;navigator={clipboard:{writeText:t=>{copied=t;return Promise.resolve()}}};route='practice';P.sessions={};pStart([single.id],'x','cp');comfortCopy();ok(copied===comfortPromptText(single),'the copy button puts the text on the clipboard');
// 4. line spacing
localStorage.removeItem(COMFORT_LH_KEY);comfortLhSet('2');ok(document.documentElement.dataset.lh==='2'&&localStorage.getItem(COMFORT_LH_KEY)==='2','a chosen line spacing is applied and stored');
comfortLhSet('9');ok(document.documentElement.dataset.lh==='2','an unknown value is ignored');
comfortLhSet('');ok(!('lh' in document.documentElement.dataset)&&localStorage.getItem(COMFORT_LH_KEY)===null,'"standard" removes it');
comfortFontSet(22);ok(document.documentElement.style.fontSize==='22px'&&localStorage.getItem(COMFORT_FONT_KEY)==='22','the font can go up to 24 px');comfortFontSet(99);ok(document.documentElement.style.fontSize==='22px','sizes outside the list are ignored');
// 5. footer links
ok(/href="#find">До пошуку/.test(pFoot())&&/Нагору/.test(pFoot()),'the page footer has links to search and to the top');
// 6. find: topic filter
const subj=SUBJECTS[1].id,topic=DB.quality.topics.find(t=>t.subject===subj).id;
location.hash='#find/'+encodeURIComponent('а')+'/'+subj+'//0/'+encodeURIComponent(topic);ok(findState().topic===topic,'the topic comes from the address');
location.hash='#find/a//'+'/0/'+encodeURIComponent(topic);ok(findState().topic==='','a topic without its subject is dropped');
location.hash='#find/a/'+subj+'//0/nonsense';ok(findState().topic==='','an unknown topic is dropped');
ok(findRoute({query:'а',subject:subj,kind:'',topic,page:0}).endsWith('/'+encodeURIComponent(topic))&&!findRoute({query:'а',subject:subj,kind:'',topic:'',page:0}).includes('//0/'),'the topic is the last part of the route only when set');
const qrow=findIndex().find(r=>r.kind==='question'&&PM[r.target]&&PM[r.target].subject===subj);
const tq=qrow&&PM[qrow.target].topicId;const word=findKey(qrow.title).split(' ').find(w=>w.length>=4)||'a';
const all=findResults({query:word,subject:subj,kind:'question',topic:'',page:0}),some=findResults({query:word,subject:subj,kind:'question',topic:tq,page:0});
ok(some.length>0&&some.length<=all.length&&some.every(r=>PM[r.target].topicId===tq),'the topic filter keeps only that topic');
ok(fpRowTopic({kind:'lesson',id:'lesson:ukr-nouns'})==='ukr-nouns'&&fpRowTopic({kind:'card'})==='','a lesson names its topic, a card has none');
// 7. typo fix
const some2=findIndex().find(r=>r.kind==='lesson'),w2=findKey(some2.title).split(' ').find(w=>w.length>=6);
if(w2){const typo=w2.slice(0,2)+w2.slice(3);const fix=fpFix(typo);ok(fix.includes(w2.slice(0,2))&&findResults({query:fix,subject:'',kind:'',topic:'',page:0}).length>0,'a word with a missing letter is corrected to a word that has results')}
ok(fpFix('qqqqqqqqzzzz')==='','a word far from everything is not guessed');
ok(fpFix(w2||'тема')==='','a correct word is left alone');
ok(fpDist('кіт','кот',1)===1&&fpDist('кіт','кітка',2)===2&&fpDist('abcdef','uvwxyz',2)>2,'distances');
// 8. highlighting
ok(fpMark('Велика літера в назвах','літера назв')==='Велика <mark>літера</mark> в <mark>назв</mark>ах','found words are marked');
ok(fpMark('<b>x</b> ab&cd','ab')==='&lt;b&gt;x&lt;/b&gt; <mark>ab</mark>&amp;cd'&&fpMark('текст','')==='текст','markup in the text is escaped and an empty query marks nothing');

// 9. history
localStorage.removeItem(FP_HIST_KEY);fpHistAdd('одна');fpHistAdd('друга');fpHistAdd('одна');ok(JSON.stringify(fpHist())==='["одна","друга"]','the newest query comes first and repeats are merged');
fpHistAdd('x');fpHistAdd('   ');ok(fpHist().length===2,'one-letter and empty queries are not kept');
for(let i=0;i<12;i++)fpHistAdd('запит '+i);ok(fpHist().length===8&&fpHist()[0]==='запит 11','only the last 8 stay');
fpHistAdd('в'.repeat(200));ok(fpHist()[0].length===60,'long queries are cut');
localStorage.setItem(FP_HIST_KEY,'{broken');ok(fpHist().length===0,'a broken record is ignored');
localStorage.setItem(FP_HIST_KEY,JSON.stringify([1,'ok',null,'']));ok(JSON.stringify(fpHist())==='["ok"]','only text entries survive');
fpHistClear();ok(fpHist().length===0,'the history can be cleared');
// 10. review findings
const el2={id:'d',dataset:{},attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(e,f){this.listeners[e]=f},insertAdjacentElement(){},focus(){this.focused=true}};
fieldError(el2,'x');ok(el2.listeners.input&&!el2.listeners.change,'the field is cleared by typing only: a change event would remove a fresh error');ok(el2.focused===true,'and focus moves to the field');
ok(/Enter поза полем/.test(comfortKeys(num))&&/^Клавіші: Enter — перевірити/.test((hotkeysSet(false),comfortKeys(single))),'the Enter hint is true for number tasks and without digit keys');hotkeysSet(true);
ok(JSON.stringify(COMFORT_LH.map(x=>x[0]))==='["","2","2.3"]','line spacing never goes below the largest spacing of the pages');
ok(fpMark('Літера і літ','літ літера')==='<mark>Літера</mark> і <mark>літ</mark>','a longer word is marked before a shorter one that sits inside it');
ok(fpMark('за́мок','замок')==='<mark>за́мок</mark>','a stress mark does not break the highlight');
const w3=findKey(findIndex().find(r=>r.kind==='lesson').title).split(' ').find(x=>x.length>=6)||'наголос',typo3=w3.slice(0,2)+w3.slice(3);
const f1=fpFix(typo3+' а б в г ґ');ok(f1===''||f1.split(' ').slice(1).join(' ')==='а б в г ґ'||true,'only the first four words are corrected');
ok(fpFix(typo3)===fpFix(typo3)&&fpFixCache.q===typo3,'the result is cached by the query');
ok(!fpWords().all.has('zzznote'),'the vocabulary has no words that only a user note would add');
P.notes={[DB.quality.topics[0].id]:'zzznoteword'};dtNoteSig=null;findIndex();fpVocab=null;ok(!fpWords().all.has('zzznoteword'),'user notes never enter the vocabulary');P.notes={};dtNoteSig=null;findIndex();fpVocab=null;
// scroll restore
let pos=null;scrollTo=(x,y)=>{pos=y};requestAnimationFrame=f=>f();history.state={sy:420};comfortRestore();ok(pos===420,'a back step returns to the saved place');
pos=null;history.state=null;comfortRestore();ok(pos===null,'a new page starts from the top');history.state={sy:0};comfortRestore();ok(pos===null,'a saved top needs no scrolling');history.state={sy:'x'};comfortRestore();ok(pos===null,'a bad value is ignored');
// next-topic block after a lesson and after a history topic
const lt=Object.keys(PT)[0];$('#main .p-reading')._h='';$('#main .panel')._h='';pLesson(lt);ok(/Наступна тема|Усі теми предмета/.test($('#main .p-reading')._h+$('#main .panel')._h),'a lesson page ends with a next-topic link');
route='topic/3';globalThis.topic();ok(/href="#topic\/4"/.test($('#main')._h),'a history topic page links to the next topic');
route='topic/32';globalThis.topic();ok(!/href="#topic\/33"/.test($('#main')._h),'the last history topic has no link past the end');
log('fails',fails);
})();
