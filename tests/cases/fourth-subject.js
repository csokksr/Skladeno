// Перший вхід: четвертий предмет НМТ обирають першим, далі план і головна йдуть за вибором; вибір не губиться при злитті пристроїв.
;(function(){
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{log(c?'PASS':'FAIL',m);if(!c)fails++};
const keep={study:P.study,answers:P.answers};
P.study=stFresh();P.answers={};
ok(fourthNeeded()===true,'новий користувач без відповідей має обрати предмет');
const card=fourthCard();
ok(['eng','bio','geo'].every(id=>card.includes('value="'+id+'"')),'картка пропонує англійську, біологію й географію');
ok(!/value="[a-z]+" checked/.test(card),'жоден предмет не вибрано наперед');
ok(card.includes('Обери четвертий предмет'),'заголовок просить вибрати');
const before=JSON.stringify(P.study);
ok(fourthPick('')===false&&fourthPick('ukr')===false&&fourthPick('xyz')===false&&JSON.stringify(P.study)===before,'некоректний вибір нічого не змінює');
ok(fourthNeeded()===true,'після відмови вибір усе ще потрібен');
ok(fourthPick('bio')===true&&P.study.fourth==='bio'&&P.study.fourthChosen===true,'вибір біології записується');
ok(fourthNeeded()===false,'після вибору картка зникає');
ok(subjActive().map(s=>s.id).join()==='ukr,math,hist,bio','підготовка йде за вибором: українська, математика, історія, біологія');
const rows=pSubjectRows();
const iBio=rows.indexOf('#subject/bio'),iEng=rows.indexOf('#subject/eng'),iDet=rows.indexOf('<details');
ok(iBio>=0&&iBio<iDet&&iEng>iDet&&rows.indexOf('#subject/geo')>iDet,'головна: обрані предмети першими, решта у згорнутому блоці');
P.study=stFresh();P.answers={x:{score:1}};
ok(fourthNeeded()===false,'хто вже має відповіді, нічого не вибирає');
P.study=stFresh();P.study.setupDone=true;
ok(fourthNeeded()===false,'хто вже пройшов налаштування, нічого не вибирає');
ok(stNormal({fourth:'geo',fourthChosen:true}).fourthChosen===true&&stNormal({fourth:'geo'}).fourthChosen===false,'прапорець вибору зберігається й читається');
// Злиття: вибір з іншого пристрою не затирається типовим eng нового пристрою.
const plat=study=>({schema:1,answers:{},drafts:{},pins:[],notes:{},read:[],sessions:{},current:null,records:[],logs:{},plan:{minutes:45,days:{}},lastSubject:'ukr',study,ext:{cards:[]}});
const fresh=plat({targets:{},srs:{},fourth:'eng',fourthChosen:false});
ok(webMerge({platform:fresh},{platform:plat({targets:{},srs:{},fourth:'bio',fourthChosen:true})}).platform.study.fourth==='bio','новий пристрій бере вибір з іншого');
ok(webMerge({platform:fresh},{platform:plat({targets:{},srs:{},fourth:'geo'})}).platform.study.fourth==='geo','старі дані без прапорця: не-eng вважається вибором');
ok(webMerge({platform:plat({targets:{},srs:{},fourth:'eng',fourthChosen:true})},{platform:plat({targets:{},srs:{},fourth:'bio',fourthChosen:true})}).platform.study.fourth==='eng','свідомий вибір на цьому пристрої не перекривається');
P.study=keep.study;P.answers=keep.answers;
log('fails',fails);
})();
