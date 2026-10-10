const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(require('path').join(__dirname,'../production-mode.js'),'utf8');
for(const host of ['legal-edge-client-app.vercel.app','preview.vercel.app']){
 const d=new JSDOM('',{url:`https://${host}/?workspace=demo&pilot=demo&onboarding=demo&section=training`,runScripts:'outside-only'});
 vm.runInContext(source,d.getInternalVMContext());
 assert.equal(d.window.legalEdgeProduction,true);
 assert.equal(d.window.location.search,'?section=training');
 d.window.legalEdgeProduction=false;assert.equal(d.window.legalEdgeProduction,true);
}
const d=new JSDOM('',{url:'http://localhost/?workspace=demo',runScripts:'outside-only'});
vm.runInContext(source,d.getInternalVMContext());assert.equal(d.window.legalEdgeProduction,false);assert.equal(d.window.location.search,'?workspace=demo');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
assert(html.indexOf('production-mode.js')<html.indexOf('app-v2.js'));assert(!html.includes('href="?workspace=demo'));
console.log('PASS: production demo routes stripped before application boot; local previews retained');
