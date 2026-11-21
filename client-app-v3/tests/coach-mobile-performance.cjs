/* Navigation responds to structure and breakpoint changes, not every saved-status update. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
async function exercise(source,verify=true){
 const dom=new JSDOM('<div id="coachApp"><nav id="coachNav"></nav><main id="coachMain"><p id="saveStatus" role="status">Ready</p></main></div>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let navScans=0,mobile=true,selected=0;
 Object.assign(w,{$:selector=>{if(selector==='#cmNav')navScans++;return w.document.querySelector(selector);},matchMedia:()=>({matches:mobile}),scrollTo(){},coachingSettings(){},state:{role:'coach',client:null,coachView:'dashboard',user:{id:'owner'},clients:[]},renderCoach(){}});
 vm.runInContext(source,dom.getInternalVMContext());
 await new Promise(resolve=>w.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 const settle=()=>new Promise(resolve=>setTimeout(resolve,35));await settle();navScans=0;
 for(let i=0;i<12;i++){w.document.getElementById('saveStatus').textContent='Saving '+i;await settle();}
 const statusScans=navScans;
 if(verify)assert.equal(statusScans,0,'Saved-status updates must not rebuild/scan phone navigation');
 navScans=0;for(let i=0;i<20;i++)w.dispatchEvent(new w.Event('resize'));await settle();const resizeScans=navScans;
 if(verify)assert.equal(resizeScans,0,'Same-breakpoint resize does not rescan navigation');
 const panel=w.document.createElement('section');panel.id='psWatchFeed';panel.className='panel';panel.innerHTML='<h2>Watch data</h2>';w.document.getElementById('coachMain').append(panel);await settle();
 assert(panel.closest('.cm-secondary'),'A late root setup/watch panel still receives its mobile disclosure');
 if(verify)assert.equal(navScans,1,'Late structural insertion needs one settling scan');
 w.state.client={id:'client-a'};w.state.clientTab='overview';const tabs=w.document.createElement('nav');tabs.id='clientTabs';tabs.innerHTML='<button data-client-tab="overview">Overview</button><button data-client-tab="training">Training</button>';tabs.querySelector('[data-client-tab="training"]').onclick=()=>selected++;w.document.getElementById('coachMain').append(tabs);await settle();
 const picker=w.document.getElementById('cmClientTab');assert(picker,'A late client workspace still receives a phone picker');picker.value='training';picker.dispatchEvent(new w.Event('change'));assert.equal(selected,1,'Existing tab click handlers are preserved');
 w.state.clientTab='overview';w.CoachMobile.sync();assert.equal(picker.value,'overview','Reused tabs keep the picker selected value in sync');
 const connection=w.document.createElement('button');connection.dataset.clientTab='connections';connection.textContent='Connections';connection.onclick=()=>selected+=10;tabs.append(connection);w.state.clientTab='connections';w.CoachMobile.sync();assert.equal(picker.value,'connections','Late tab options are available in the existing picker');assert.equal(w.document.querySelectorAll('#cmClientTab').length,1,'Picker is reused without duplicates');picker.dispatchEvent(new w.Event('change'));assert.equal(selected,11,'Late options use the current button handler');
 navScans=0;mobile=false;w.dispatchEvent(new w.Event('resize'));await settle();if(verify)assert.equal(navScans,1,'Crossing the breakpoint performs one scan');
 const result={status_updates:12,status_navigation_scans:statusScans,same_breakpoint_resize_events:20,resize_navigation_scans:resizeScans};dom.window.close();return result;
}
(async()=>{const source=fs.readFileSync(process.argv[2]||__dirname+'/../coach-mobile.js','utf8'),result=await exercise(source,!process.argv[2]);console.log(JSON.stringify(result));console.log('PASS phone navigation: status changes stay local; late panels/tabs and breakpoint changes remain functional');})().catch(error=>{console.error(error);process.exitCode=1;});
