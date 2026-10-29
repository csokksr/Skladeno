;(function(){
const log=(...a)=>console.log(...a);
// force a hist topic into today's learn list
const ht=DB.quality.topics.find(t=>t.subject==='hist'&&t.questions.length);
const ids=ht.questions.slice(0,3);
P.study.today={day:pDay(),phase:'',review:[],learn:[{sid:'hist',topicId:ht.id,title:ht.title,route:stTopicRoute(ht),ids}],mock:null};
const n=pNormal(JSON.parse(JSON.stringify(P)));
const l=n.study.today&&n.study.today.learn;
log(l&&l.length===1&&l[0].topicId===ht.id&&l[0].route==='topic/'+ht.id.slice(5)&&l[0].ids.length===3?'PASS hist learn entry survives reload '+l[0].route:'FAIL '+JSON.stringify(l));
})();
