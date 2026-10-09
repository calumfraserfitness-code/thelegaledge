const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {JSDOM}=require('jsdom');
function setup(platform,owner=true,connected=false){
 const dom=new JSDOM('<main id="host"></main>',{pretendToBeVisual:true,url:'https://legal-edge-client-app.vercel.app/?setup=health&token=private&client_id=other'});
 dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
 const host=dom.window.document.querySelector('#host');let calls=0;const polls=[];
 const ctx=vm.createContext({URL,Date,Number,console,clearInterval(){},setInterval(fn){polls.push(fn);return polls.length;},TextDecoder,Uint8Array,atob,FormData:dom.window.FormData,window:dom.window,document:dom.window.document,navigator:{userAgent:platform,maxTouchPoints:0,clipboard:{writeText:async()=>{}}},location:dom.window.location,state:{data:{files:[]}},hubProviders:[{id:'apple_health'}],coachCheckins(){},clientCheckin(){},healthSummaryMarkup(){return ''},toast(){},setBusy(){},esc:s=>s,hubStamp:s=>s,phoneFlowDispose:null});
 vm.runInContext(fs.readFileSync(__dirname+'/../phone-connection.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync(__dirname+'/../device-setup.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync(__dirname+'/../free-health.js','utf8'),ctx);
 ctx.openPhoneConnection(host,{owner,preview:false,keys:[],isActive:()=>true,createConnection:async()=>{calls++;if(connected)return {id:'fixture-key',token:'a'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString()};throw Error('test failure');},readKey:async()=>({last_received_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()}),refreshData:async()=>undefined});
 return {host,calls:()=>calls,polls};
}
(async()=>{
 const desktop=setup('Desktop');const link=desktop.host.querySelector('.phone-safe-link');assert(link);assert.equal(link.href,'https://legal-edge-client-app.vercel.app/?setup=health');assert(desktop.host.textContent.includes('Continue on your iPhone'));assert(desktop.host.querySelector('[data-free-key] button').disabled);await desktop.host.querySelector('[data-free-key]').onsubmit({preventDefault(){},target:desktop.host.querySelector('[data-free-key]')});assert.equal(desktop.calls(),0);
 const android=setup('Android');assert(android.host.textContent.includes('Automatic Android sharing is not available yet'));assert.equal(android.host.querySelector('.phone-safe-link'),null);
 const observer=setup('iPhone',false);await observer.host.querySelector('[data-free-key]').onsubmit({preventDefault(){},target:observer.host.querySelector('[data-free-key]')});assert.equal(observer.calls(),0);
 const chooser=setup('Desktop');chooser.host.querySelector('[data-auto-exporter]').onclick();assert(chooser.host.textContent.includes('Connect your iPhone'));assert(chooser.host.textContent.includes('What would you like to share?'));
 const ios=setup('iPhone');assert(!ios.host.querySelector('[data-free-key] button').disabled);const form=ios.host.querySelector('[data-free-key]');await form.onsubmit({preventDefault(){},target:form,submitter:form.querySelector('button')});assert.equal(ios.calls(),1);
 const flow=setup('iPhone',true,true);flow.host.querySelector('[data-auto-exporter]').onclick();let form1=flow.host.querySelector('#phoneReadings');form1.onsubmit({preventDefault(){},target:form1});flow.host.querySelector('#phoneInstalled').onclick();let consent=flow.host.querySelector('#phoneConsent');consent.querySelector('input').checked=true;await consent.onsubmit({preventDefault(){},target:consent,submitter:consent.querySelector('button.btn.primary')});assert(flow.host.querySelector('a[href^="com.HealthExport:"]'));assert(flow.host.textContent.includes('Waiting for the first upload'));await flow.polls.at(-1)();assert(flow.host.textContent.includes('Upload received'));
 console.log('PASS: desktop has a credential-free iPhone handoff; Android availability stays honest; only the iPhone account owner can prepare a setup.');
})().catch(e=>{console.error(e);process.exit(1);});
