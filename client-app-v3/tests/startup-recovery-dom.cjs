const fs=require('fs'),path=require('path'),assert=require('assert'),{JSDOM,ResourceLoader}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');let deadline;
class Unavailable extends ResourceLoader{fetch(){return null;}}
const dom=new JSDOM(html,{url:'https://legal-edge-client-app.vercel.app/',runScripts:'dangerously',resources:new Unavailable(),beforeParse(w){w.setTimeout=(fn,ms)=>{if(ms===15000)deadline=fn;return 1;};w.clearTimeout=()=>{};}});
const doc=dom.window.document;
assert(doc.querySelector('style').textContent.includes('.auth-page'),'Sign-in has styling without the downloaded stylesheet');
assert.equal(doc.querySelector('link[href*="app-runtime.css"]').media,'print','Main stylesheet must not block first paint');
assert(!doc.querySelector('#auth').classList.contains('hidden'));
assert(doc.querySelector('#authMsg').textContent.includes('Loading secure sign-in'));
assert(doc.querySelector('#startupRecovery').hidden);
deadline();assert(!doc.querySelector('#startupRecovery').hidden,'A stalled script must offer recovery');
dom.window.legalEdgeRuntimeLoaded();assert(doc.querySelector('#startupRecovery').hidden,'A late successful load removes recovery');
assert.equal(typeof doc.querySelector('#startupReload').onclick,'function');
dom.window.close();console.log('PASS: sign-in remains visible with missing assets; stalled startup offers reload and late success removes it.');
