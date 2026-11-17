// Перевірка типів JavaScript через tsc (checkJs, jsconfig.json). Типів у коді немає, тож tsc мало що знає про значення, але ловить те, що не залежить від типів:
// невідоме ім'я, виклик не функції, зайві аргументи, неможливі порівняння. Відомий шум відкидається за кодом помилки:
//   TS2630  обгортки сайту навмисно перепризначають функції (const xBase=f;f=function(){…});
//   TS2339  Element замість HTMLElement (dataset, closest, focus…) у кожному обробнику подій;
//   TS2362, TS2363, TS2356  віднімання дат (new Date()-new Date()) для tsc не число;
//   TS2367  порівняння результату download(): у веб-збірці це Promise, в автономній нічого.
// Запуск: node tools/typecheck.js [шлях до jsconfig.json]   (код 1, якщо лишились помилки)
const {spawnSync}=require('child_process'),path=require('path');
const root=path.resolve(__dirname,'..'),NOISE=new Set([2630,2339,2362,2363,2356,2367]);

function filter(output){return output.split('\n').filter(l=>/error TS\d+/.test(l)).filter(l=>!NOISE.has(Number(/error TS(\d+)/.exec(l)[1])))}

function main(){const project=process.argv[2]||path.join(root,'jsconfig.json');
  const tsc=path.join(root,'node_modules','typescript','bin','tsc'),r=spawnSync(process.execPath,[tsc,'-p',project,'--pretty','false'],{cwd:path.dirname(project),encoding:'utf8',maxBuffer:1<<26});
  if(r.error||(r.status!==0&&!/error TS/.test(r.stdout||''))){console.error('tsc не запустився:',r.error?r.error.message:(r.stdout+r.stderr).slice(0,300));process.exit(2)}
  const bad=filter(r.stdout||'');for(const l of bad)console.log(l);
  console.log('помилок типів (без відомого шуму):',bad.length);process.exit(bad.length?1:0)}

module.exports={filter};
if(require.main===module)main();
