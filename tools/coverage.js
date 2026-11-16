// Покриття іменованих функцій сторінки регресійними тестами. Власний скрипт на вбудованому V8-покритті Node (залежностей немає).
// Кожен тест працює в окремому процесі (tests/harness.js), сторінка виконується як скрипт app.all.js: код сторінки, далі код самого тесту.
// Тут зводимо всі запуски: функція вважається покритою, якщо хоч в одному запуску її викликали. Рахуються лише іменовані функції коду сторінки
// (код тестів, дописаний після нього, і анонімні стрілки не враховуються).
// Запуск: node tools/coverage.js [--list] [--min ВІДСОТОК]   (потрібна свіжа збірка dist/skladeno-nmt.html)
const {spawnSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const root=path.resolve(__dirname,'..');

// Довжина коду сторінки в app.all.js: так само, як її вирізає tests/harness.js з готового HTML.
function pageLength(htmlPath){const html=fs.readFileSync(htmlPath,'utf8'),open='<script id="data" type="application/json">',a=html.indexOf(open)+open.length,b=html.indexOf('</script>',a);
  return html.slice(html.indexOf('<script>',b)+'<script>'.length,html.lastIndexOf('</script>')).length}

// dir: каталог із файлами NODE_V8_COVERAGE; повертає Map «ім'я@початок» → {name, count}
function collect(dir,codeLen){const fns=new Map();
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
    const data=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
    for(const s of data.result||[]){if(!/app\.all\.js$/.test(s.url))continue;
      for(const fn of s.functions){if(!fn.functionName)continue;const start=fn.ranges[0].startOffset;if(start>=codeLen)continue;
        const key=fn.functionName+'@'+start,count=fn.ranges[0].count,prev=fns.get(key);fns.set(key,{name:fn.functionName,count:Math.max(prev?prev.count:0,count)})}}}
  return fns}

function summarize(fns){const all=[...fns.values()],hit=all.filter(f=>f.count>0);return {total:all.length,hit:hit.length,pct:all.length?100*hit.length/all.length:0,missed:all.filter(f=>f.count===0).map(f=>f.name).sort()}}

function main(){const args=process.argv.slice(2),list=args.includes('--list'),min=args.includes('--min')?Number(args[args.indexOf('--min')+1]):0;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'skladeno-cov-'));
  const run=spawnSync(process.execPath,[path.join(root,'tests','run.js')],{cwd:root,env:{...process.env,NODE_V8_COVERAGE:dir},encoding:'utf8',maxBuffer:1<<28});
  if(run.status!==0){console.error('Тести не пройшли, покриття не рахую.');console.error((run.stdout||'').split('\n').filter(l=>/FAIL|THROW/.test(l)).slice(0,10).join('\n'));process.exit(1)}
  const sum=summarize(collect(dir,pageLength(path.join(root,'dist','skladeno-nmt.html'))));fs.rmSync(dir,{recursive:true,force:true});
  if(list)for(const n of sum.missed)console.log('не викликана:',n);
  console.log(`Іменованих функцій сторінки: ${sum.total}, викликано тестами: ${sum.hit} (${sum.pct.toFixed(1)}%)`);
  if(min&&sum.pct<min){console.error(`Покриття нижче порогу ${min}%.`);process.exit(1)}}

module.exports={pageLength,collect,summarize};
if(require.main===module)main();
