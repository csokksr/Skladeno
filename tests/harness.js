// Runs the built page's script in Node against a stub DOM, then evaluates a test case in the same global scope.
// Usage: node tests/harness.js <case.js>   (env: SKLADENO_HTML = built page, LS = JSON file preloaded into localStorage, HASH = start route)
const vm=require('vm'),fs=require('fs'),path=require('path');
const html=fs.readFileSync(process.env.SKLADENO_HTML||path.join(__dirname,'..','dist','skladeno-nmt.html'),'utf8');
const open='<script id="data" type="application/json">',a=html.indexOf(open)+open.length,b=html.indexOf('</script>',a);
const dataText=html.slice(a,b).replace(/<\\\//g,'</');
const code=html.slice(html.indexOf('<script>',b)+'<script>'.length,html.lastIndexOf('</script>'));
const extra=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):'';
const store=new Map(); if(process.env.LS){const o=JSON.parse(fs.readFileSync(process.env.LS,'utf8'));for(const k in o)store.set(k,o[k])}
function mk(name){const t={_h:'',textContent:'',value:'',hidden:false,disabled:false,open:false,dataset:{},style:{},children:[],_name:name,
 classList:{add(){},remove(){},toggle(){},contains(){return false}},
 toggleAttribute(){},after(){},remove(){},outerHTML:'',nextElementSibling:null,addEventListener(){},setAttribute(){},removeAttribute(){},getAttribute(){return null},
 querySelector(s){return mk(s)},querySelectorAll(){return []},closest(){return null},
 insertAdjacentHTML(w,h){t._h=(w==='afterbegin'?h+t._h:t._h+h)},append(){},focus(){},click(){},close(){},showModal(){},select(){},setSelectionRange(){},scrollIntoView(){},
 get innerHTML(){return t._h},set innerHTML(v){t._h=v},get offsetTop(){return 0}};return t}
const els={};
const document={createTreeWalker(){return {nextNode(){return false}}},createDocumentFragment(){return mk('f')},querySelector(s){if(s==='#data')return {textContent:dataText};return els[s]||(els[s]=mk(s))},querySelectorAll(){return []},getElementById(){return mk('x')},createElement(){return mk('c')},addEventListener(){},body:mk('body'),documentElement:Object.assign(mk('html'),{style:{}})};
const intervals=[];
class MO{constructor(f){}observe(){}}
const NodeFilter={SHOW_TEXT:4,FILTER_ACCEPT:1,FILTER_REJECT:2};
const ctx={MutationObserver:MO,NodeFilter,document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
 location:{hash:process.env.HASH||'',protocol:'file:',href:'file:///x'},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),
 setInterval:(f,t)=>{intervals.push(f);return intervals.length},setTimeout:()=>0,clearTimeout(){},scrollTo(){},confirm:()=>true,console,structuredClone,URL,Blob,TextDecoder,atob:s=>Buffer.from(s,'base64').toString('binary'),navigator:{},history:{},toastLog:[]};
ctx.window=ctx;ctx.globalThis=ctx;
ctx.__intervals=intervals;ctx.__store=store;
vm.createContext(ctx);
try{vm.runInContext(code+'\n'+extra,ctx,{filename:'app.all.js'})}catch(e){console.log('THROW',e&&e.stack||e)}
