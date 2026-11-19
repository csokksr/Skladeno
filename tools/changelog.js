// Журнал змін для розробників: CHANGELOG.md генерується з історії змін на сторінці «Про сайт» (ABOUT_CHANGES у src/modules/79-about.js),
// тож користувачі й репозиторій бачать те саме. Записи мають лише день і місяць; рік найновішого запису лежить у ABOUT_YEAR, а для старіших він
// зменшується щоразу, коли місяць «стрибає вгору» (записи йдуть від новіших до старіших).
// Запуск: node tools/changelog.js          (перезаписати CHANGELOG.md)
//         node tools/changelog.js --check  (код 1, якщо файл застарів; для CI)
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),FILE=path.join(root,'CHANGELOG.md');
const MONTHS=['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];

// Вихідний код сторінки «Про сайт» → {year, list}. Масив береться до першого «];» на початку рядка: усередині записів такої послідовності немає.
function parse(code){const y=/const ABOUT_YEAR\s*=\s*(\d{4});/.exec(code);if(!y)throw new Error('ABOUT_YEAR не знайдено в src/modules/79-about.js');
  const m=/const ABOUT_CHANGES\s*=\s*/.exec(code);if(!m)throw new Error('ABOUT_CHANGES не знайдено в src/modules/79-about.js');
  const start=m.index+m[0].length,end=code.indexOf('];\n',start)+1;if(end<=start)throw new Error('кінець ABOUT_CHANGES не знайдено');
  return {year:Number(y[1]),list:Function('return '+code.slice(start,end))()}}
function entries(){return parse(fs.readFileSync(path.join(root,'src','modules','79-about.js'),'utf8'))}

// Додає рік до кожного запису.
function withYears({year,list}){let y=year,prev=null;return list.map(([date,text])=>{const m=MONTHS.indexOf(date.split(' ')[1]);
  if(m<0)throw new Error('невідомий місяць у записі «'+date+'»');if(prev!==null&&m>prev)y--;prev=m;return [date+' '+y,text]})}
function render(dated){const groups=[];for(const [date,text] of dated){let g=groups[groups.length-1];if(!g||g.date!==date){g={date,items:[]};groups.push(g)}g.items.push(text)}
  return '# Журнал змін\n\nЦей файл генерує `node tools/changelog.js` з історії змін на сторінці «Про сайт» (`ABOUT_CHANGES` у `src/modules/79-about.js`). Не правити вручну: правка вийде за змістом сторінки «Про сайт», а CI відхилить застарілий файл. Нові записи — зверху.\n\n'
    +groups.map(g=>`## ${g.date}\n\n${g.items.map(x=>'- '+x).join('\n')}\n`).join('\n')}

function main(){const text=render(withYears(entries()));
  if(process.argv.includes('--check')){const now=fs.existsSync(FILE)?fs.readFileSync(FILE,'utf8').replace(/\r\n/g,'\n'):'';
    if(now!==text){console.error('CHANGELOG.md застарів: запусти node tools/changelog.js');process.exit(1)}console.log('CHANGELOG.md актуальний.')}
  else{fs.writeFileSync(FILE,text);console.log('CHANGELOG.md записано, записів:',entries().list.length)}}

module.exports={parse,withYears,render,MONTHS};
if(require.main===module)main();
