// Лінтер коду сайту (ESLint). Сайт збирається з багатьох файлів в один скрипт, тож функції й змінні одного модуля видно в усіх інших.
// ESLint цього не знає, тому спершу збираємо імена верхнього рівня з усіх файлів (espree + eslint-scope) і передаємо їх як глобальні:
// так правило no-undef ловить справжні описки (виклик неіснуючої функції), а не кожне міжмодульне посилання.
// Не перевіряємо стиль і невикористані імена (обробники подій у розмітці викликають функції за назвою). Вендорний src/vendor пропускається.
// Запуск: node tools/lint.js            (код 1 при помилках)
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const {ESLint}=require('eslint'),espree=require('espree'),eslintScope=require('eslint-scope'),js=require('@eslint/js'),globals=require('globals');

const files=[path.join(root,'src','app.js'),...['modules','web'].flatMap(d=>fs.readdirSync(path.join(root,'src',d)).filter(f=>f.endsWith('.js')).map(f=>path.join(root,'src',d,f)))];

// Імена верхнього рівня в усіх файлах: оголошення function/var/let/const і присвоєння без оголошення (неявні глобальні).
function topLevelNames(){const names=new Set();
  for(const f of files){const ast=espree.parse(fs.readFileSync(f,'utf8'),{ecmaVersion:2022,sourceType:'script',range:true}),scope=eslintScope.analyze(ast,{ecmaVersion:2022,sourceType:'script'}).globalScope;
    for(const v of scope.variables)names.add(v.name);for(const r of scope.implicit.variables)names.add(r.name)}
  return names}

// BUILD_ID вставляє tools/build.py у збірку, у вихідних файлах його немає.
const EXTRA=['BUILD_ID'];
function makeEslint(names){const known=Object.fromEntries([...names,...EXTRA].map(n=>[n,'writable']));
  return new ESLint({overrideConfigFile:true,overrideConfig:[
    js.configs.recommended,
    {files:['**/*.js'],languageOptions:{ecmaVersion:2022,sourceType:'script',globals:{...globals.browser,...known}},
     // Вимкнено те, що для цього коду шум: обгортки перепризначають функції (no-func-assign, no-global-assign), порожні catch це навмисний запобіжник,
     // керівні символи в регулярних виразах потрібні для очищення тексту, невикористані імена викликаються з розмітки.
     rules:{'no-unused-vars':'off','no-func-assign':'off','no-global-assign':'off','no-empty':'off','no-control-regex':'off','no-useless-escape':'off','no-redeclare':'off','no-inner-declarations':'off','no-useless-assignment':'off'}}
  ]})}
// Перевірка одного фрагмента з заданими глобальними іменами (для тестів): [{ruleId, message}]
async function lintSource(code,names=[]){const [r]=await makeEslint(names).lintText(code,{filePath:path.join(root,'src','x.js')});return r.messages.map(m=>({ruleId:m.ruleId,message:m.message}))}
async function main(){
  const eslint=makeEslint(topLevelNames());
  const results=await eslint.lintFiles(files);let errors=0;
  for(const r of results)for(const m of r.messages){errors++;console.log(`${path.relative(root,r.filePath)}:${m.line}:${m.column}: ${m.ruleId||'помилка розбору'}: ${m.message}`)}
  console.log('файлів перевірено:',files.length,'· знахідок:',errors);
  process.exit(errors?1:0)}
module.exports={lintSource,topLevelNames};
if(require.main===module)main().catch(e=>{console.error(e);process.exit(2)});
