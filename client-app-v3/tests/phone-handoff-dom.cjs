const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {JSDOM}=require('jsdom');
function setup(platform,owner=true){
 const dom=new JSDOM('<main id="host"></main>',{url:'https://legal-edge-client-app.vercel.app/?setup=health&token=private&client_id=other'});
 const host=dom.window.document.querySelector('#host');let calls=0;
 const ctx=vm.createContext({URL,Date,Number,console,TextDecoder,Uint8Array,atob,FormData:dom.window.FormData,window:dom.window,document:dom.window.document,navigator:{userAgent:platform,maxTouchPoints:0,clipboard:{writeText:async()=>{}}},location:dom.window.location,state:{data:{files:[]}},hubProviders:[{id:'apple_health'}],coachCheckins(){},clientCheckin(){},healthSummaryMarkup(){return ''},toast(){},setBusy(){},esc:s=>s,phoneFlowDispose:null});
 vm.runInContext(fs.readFileSync(__dirname+'/../phone-connection.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync(__dirname+'/../free-health.js','utf8'),ctx);
 ctx.openPhoneConnection(host,{owner,preview:false,keys:[],isActive:()=>true,createConnection:async()=>{calls++;throw Error('test failure');}});
 return {host,calls:()=>calls};
}
(async()=>{
 const desktop=setup('Desktop');const link=desktop.host.querySelector('.phone-safe-link');assert(link);assert.equal(link.href,'https://legal-edge-client-app.vercel.app/?setup=health');assert(desktop.host.textContent.includes('Continue on your iPhone'));assert(desktop.host.querySelector('[data-free-key] button').disabled);await desktop.host.querySelector('[data-free-key]').onsubmit({preventDefault(){},target:desktop.host.querySelector('[data-free-key]')});assert.equal(desktop.calls(),0);
 const android=setup('Android');assert(android.host.textContent.includes('Automatic Android sharing is not available yet'));assert.equal(android.host.querySelector('.phone-safe-link'),null);
 const observer=setup('iPhone',false);await observer.host.querySelector('[data-free-key]').onsubmit({preventDefault(){},target:observer.host.querySelector('[data-free-key]')});assert.equal(observer.calls(),0);
 const ios=setup('iPhone');assert(!ios.host.querySelector('[data-free-key] button').disabled);const form=ios.host.querySelector('[data-free-key]');await form.onsubmit({preventDefault(){},target:form,submitter:form.querySelector('button')});assert.equal(ios.calls(),1);
 console.log('PASS: desktop has a credential-free iPhone handoff; Android availability stays honest; only the iPhone account owner can prepare a setup.');
})().catch(e=>{console.error(e);process.exit(1);});
