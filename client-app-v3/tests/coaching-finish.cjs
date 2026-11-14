const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="clientApp"><main id="clientMain"><form><input name="minutes" value="24"></form></main></div><div id="coachApp" class="hidden"><main id="coachMain"></main></div>',{runScripts:'outside-only'}),w=dom.window;
let online=true;Object.defineProperty(w.navigator,'onLine',{get:()=>online});
Object.assign(w,{state:{role:'client',user:{id:'client-account'},preview:false},renderClient(){},renderCoach(){}});
vm.runInContext(fs.readFileSync(__dirname+'/../coaching-finish.js','utf8'),dom.getInternalVMContext());
(async()=>{
 w.CoachingFinish.refresh();assert(!w.document.getElementById('coachingConnectionStatus'));
 online=false;w.dispatchEvent(new w.Event('offline'));const box=w.document.getElementById('coachingConnectionStatus');assert(box);assert(box.textContent.includes('retry saving'));assert(!box.textContent.includes('saved'));assert.equal(w.document.querySelector('input').value,'24','Connection guidance never resets input');
 w.CoachingFinish.refresh();assert.equal(w.document.querySelectorAll('#coachingConnectionStatus').length,1);
 w.document.getElementById('clientMain').innerHTML='<p>Another client screen</p>';w.renderClient();await new Promise(r=>setImmediate(r));assert(w.document.getElementById('coachingConnectionStatus'),'A rerender retains offline guidance without an observer');
 online=true;w.dispatchEvent(new w.Event('online'));assert(!w.document.getElementById('coachingConnectionStatus'),'Reconnection does not claim a save');
 online=false;w.state.preview=true;w.CoachingFinish.refresh();assert(!w.document.getElementById('coachingConnectionStatus'),'No real-network status in samples');
 w.state.preview=false;w.state.user=null;w.CoachingFinish.refresh();assert(!w.document.getElementById('coachingConnectionStatus'),'No stale account status after sign-out');
 const css=fs.readFileSync(__dirname+'/../coaching-finish.css','utf8');assert(css.includes('prefers-reduced-motion'));assert(css.includes(':focus-visible'));assert(css.includes('font-size:16px'));assert(!/^(?:body|html|button|input)[{\s]/m.test(css),'Finishing rules stay scoped');
 console.log('PASS scoped finishing rules and honest offline guidance preserve input and never imply a save');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
