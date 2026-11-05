/* Build a disposable, static verification preview. Never copy this output into production. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=process.argv[2]||'/tmp/legal-edge-isolated-preview';
fs.mkdirSync(out,{recursive:true});
const harness=fs.readFileSync(path.join(__dirname,'mobile-coach-flow.cjs'),'utf8');
let fixtureCode=harness.slice(harness.indexOf('const ids='),harness.indexOf('async function checkNoOverflow'));
fixtureCode=fixtureCode.replace("const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url')", "const b=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')");
fixtureCode=fixtureCode.replace("JSON.parse(Buffer.from(t.split('.')[1],'base64url').toString())", "JSON.parse(atob(t.split('.')[1].replaceAll('-','+').replaceAll('_','/')))");
const bootstrap=`(()=>{'use strict';${fixtureCode}
const key='legal-edge-synthetic-qa-v1',originalFetch=window.fetch.bind(window);let chain=Promise.resolve();
function read(){try{return JSON.parse(localStorage.getItem(key))||fixture();}catch{return fixture();}}
function write(store){localStorage.setItem(key,JSON.stringify(store));}
window.fetch=function(input,options={}){const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.hostname==='fixture.invalid'){
 const task=chain.then(async()=>{const store=read();let payload;try{payload=JSON.parse(options.body||'{}');}catch{payload={};}const headers=Object.fromEntries(new Headers(options.headers||{}));let response;await routeApi({request:()=>({url:()=>url.href,method:()=>options.method||'GET',headers:()=>headers,postDataJSON:()=>payload}),fulfill:async({status,headers,body})=>{response=new Response(body,{status,headers});}},store);write(store);return response;});chain=task.catch(()=>{});return task;
 }if(url.origin===location.origin)return originalFetch(input,options);return Promise.reject(new Error('External requests are disabled in isolated QA.'));};
class FixtureSocket{static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;constructor(url){this.url=url;this.readyState=0;this.listeners={};queueMicrotask(()=>{this.readyState=1;this.emit('open',{});});}emit(type,event){this['on'+type]?.(event);for(const fn of this.listeners[type]||[])fn(event);}addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(v=>v!==fn);}send(raw){try{const data=JSON.parse(raw);if(data.event==='phx_join'||data.event==='heartbeat')queueMicrotask(()=>this.emit('message',{data:JSON.stringify({topic:data.topic,event:'phx_reply',payload:{status:'ok',response:{}},ref:data.ref,join_ref:data.join_ref})}));}catch{}}close(){this.readyState=3;this.emit('close',{code:1000,reason:'Synthetic fixture closed'});}}
window.WebSocket=FixtureSocket;
})();`;
fs.writeFileSync(path.join(out,'qa-fixture.js'),bootstrap);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-manifest.json'),'utf8'));
const sources=manifest.scripts.map(file=>({file,code:fs.readFileSync(path.join(root,file),'utf8').replaceAll('https://baxvhilvrhshlfizakak.supabase.co','https://fixture.invalid')}));
const code='(function(){const sources='+JSON.stringify(sources)+';for(const source of sources){const script=document.createElement("script");script.dataset.legalEdgeSource=source.file;script.textContent=source.code+"\\n//# sourceURL="+location.origin+"/"+source.file;document.head.append(script);}window.legalEdgeRuntimeReady=typeof bindShell==="function"&&typeof db!=="undefined"&&!!db;if(window.legalEdgeRuntimeReady)window.legalEdgeRuntimeLoaded?.();})();\n';
fs.writeFileSync(path.join(out,'app-runtime.js'),code);
fs.writeFileSync(path.join(out,'app-runtime.css'),manifest.styles.map(file=>'/* '+file+' */\n'+fs.readFileSync(path.join(root,file),'utf8')).join('\n'));
let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<title>The Legal Edge</title>','<title>ISOLATED QA · The Legal Edge</title><script src="./qa-fixture.js"></script>');
html=html.replace(/  <link rel="preconnect"[^>]+>\n/g,'').replace(/  <link href="https:\/\/fonts.googleapis.com[^>]+>\n/,'');
html=html.replace('<body>','<body><div style="position:fixed;right:8px;top:0;z-index:99999;background:#ffd;color:#111;padding:2px 6px;font:11px system-ui">SYNTHETIC QA · no live data</div>');
fs.writeFileSync(path.join(out,'index.html'),html);
for(const file of ['production-mode.js','vendor/supabase-2.107.0.js','manifest.webmanifest','assets/legal-edge-logo.svg','assets/app-icon-192.png','assets/app-icon-512.png']){if(!fs.existsSync(path.join(root,file)))continue;fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(out,file));}
fs.writeFileSync(path.join(out,'qa-mobile.html'),'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>390px responsive QA</title><style>body{margin:0;background:#ddd}iframe{display:block;width:390px;height:844px;border:0;margin:20px auto}</style><iframe title="Mobile QA app" src="/"></iframe>');
fs.writeFileSync(path.join(out,'vercel.json'),JSON.stringify({buildCommand:'',installCommand:'',outputDirectory:'.',headers:[{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:"default-src 'self'; connect-src 'none'; frame-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'none'"},{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]}));
const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else{const data=fs.readFileSync(file);files.push({file:path.relative(out,file),sha:crypto.createHash('sha1').update(data).digest('hex'),size:data.length});}}}walk(out);fs.writeFileSync(out+'-manifest.json',JSON.stringify(files));console.log(JSON.stringify({directory:out,files:files.length,bytes:files.reduce((n,f)=>n+f.size,0),sourceScripts:sources.length,liveApiReferences:sources.filter(s=>s.code.includes('https://baxvhilvrhshlfizakak.supabase.co')).length}));
