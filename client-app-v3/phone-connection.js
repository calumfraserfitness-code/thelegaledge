/* Guided device setup. Raw upload credentials exist only in this page's memory. */
let phoneFlowDispose=null;
function phonePlatform(ua=navigator.userAgent,touch=navigator.maxTouchPoints){
 if(/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&touch>1))return 'ios';
 if(/Android/i.test(ua))return 'android';
 return 'desktop';
}
function phoneSetupUrl(preview=false){
 const url=new URL(location.pathname,location.origin);
 if(preview){url.searchParams.set('workspace','demo');url.searchParams.set('section','client');}
 url.searchParams.set('setup','health');return url.href;
}
function phoneMetricLabel(key){return {steps:'Steps',sleep_minutes:'Sleep',weight_kg:'Weight',resting_heart_rate:'Resting heart rate',consumed_calories:'Logged calories',protein_g:'Protein',carbs_g:'Carbohydrates',fat_g:'Fat',water_ml:'Water'}[key]||key;}
function phoneMetricValue(key,value){
 if(value==null||!Number.isFinite(Number(value)))return 'Not received';
 const n=Number(value);
 if(key==='sleep_minutes')return (n/60).toFixed(1)+' h';
 if(key==='weight_kg')return n.toFixed(1)+' kg';
 return n.toLocaleString(undefined,{maximumFractionDigits:0})+({resting_heart_rate:' bpm',consumed_calories:' kcal',protein_g:' g',carbs_g:' g',fat_g:' g',water_ml:' mL'}[key]||'');
}
function openPhoneConnection(target,options){
 phoneFlowDispose?.();
 const {owner,preview,keys,daily,createConnection,readKey,refreshData,revokeConnection,isActive,nutrition=false}=options;
 const platform=phonePlatform(),canPrepare=owner&&platform==='ios';
 let step=0,scopes=nutrition?['consumed_calories','protein_g','carbs_g','fat_g']:['steps','sleep_minutes'],credential=null,keyId=null,timer=null,inFlight=false,disposed=false;
 const validKeys=keys.filter(k=>k.provider==='apple_health'&&!k.revoked_at&&Date.parse(k.expires_at)>Date.now());
 let existing=validKeys.find(k=>k.last_received_at)||validKeys[0];
 if(existing){step=3;keyId=existing.id;scopes=existing.scopes||scopes;}
 const live=()=>!disposed&&isActive()&&target.isConnected;
 const stop=()=>{disposed=true;clearInterval(timer);credential=null;};phoneFlowDispose=stop;
 const progress=()=>`<ol class="phone-progress" aria-label="Phone setup progress">${['Readings','Phone app','Permission','First sync'].map((label,i)=>`<li ${i===step?'aria-current="step"':''} class="${i===step?'current':i<step?'complete':''}"><span>${i<step?'✓':i+1}</span>${label}</li>`).join('')}</ol>`;
 function shell(body){
  target.innerHTML=`<section class="phone-flow"><header><div><span class="eyebrow">DAILY HEALTH</span><h2>Connect your iPhone</h2></div><button type="button" class="hub-close" id="phoneClose" aria-label="Close phone setup">✕</button></header>${preview?'<p class="phone-preview">Preview only. No account is connected and no health data is sent.</p>':''}${progress()}<div class="phone-stage">${body}</div></section>`;
  target.querySelector('#phoneClose').onclick=()=>{stop();target.replaceChildren();};
  target.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function draw(){
  if(!live())return;
  if(step===0){
   shell(`<span class="phone-step-label">STEP 1 OF 4</span><h3>What would you like to share?</h3><p>Your iPhone and Apple Watch use one connection. Start with the readings useful to your coaching.</p><form id="phoneReadings"><div class="phone-metric-options">${['steps','sleep_minutes'].map(k=>`<label><input type="checkbox" name="scope" value="${k}" ${scopes.includes(k)?'checked':''}><span>${phoneMetricLabel(k)}</span></label>`).join('')}</div><details><summary>Optional weight, heart rate and nutrition</summary><div class="phone-metric-options">${['weight_kg','resting_heart_rate','consumed_calories','protein_g','carbs_g','fat_g','water_ml'].map(k=>`<label><input type="checkbox" name="scope" value="${k}" ${scopes.includes(k)?'checked':''}><span>${phoneMetricLabel(k)}</span></label>`).join('')}</div><p>Only readings already stored in Apple Health can be shared.</p></details><div class="phone-flow-actions"><button class="btn primary">Continue</button></div><p class="phone-inline-error" id="phoneReadingsError" role="alert"></p></form>`);
   target.querySelector('#phoneReadings').onsubmit=e=>{e.preventDefault();scopes=new FormData(e.target).getAll('scope');if(!scopes.length){target.querySelector('#phoneReadingsError').textContent='Select at least one reading to continue.';return;}step=1;draw();};return;
  }
  if(step===1){
   const desktop=platform!=='ios';
   shell(`<span class="phone-step-label">STEP 2 OF 4</span><h3>${desktop&&!preview?'Continue on your iPhone':'Get the phone app ready'}</h3><p>Health Auto Export sends your selected daily totals to Legal Edge automatically. Its paid automation feature is required.</p>${desktop?`<div class="phone-device-handoff"><strong>${platform==='android'?'Using an Android phone?':'Open this page on your iPhone'}</strong><p>${platform==='android'?'Automatic Android sharing is not available yet. You can keep using your coaching plan and enter steps manually.':'Use your existing Legal Edge account on the phone. The link contains no account key or health data.'}</p><a class="phone-safe-link" href="${esc(phoneSetupUrl(preview))}">${esc(phoneSetupUrl(preview))}</a><button type="button" class="btn ghost" id="phoneCopyLink">Copy phone link</button><span id="phoneCopyStatus" role="status"></span></div>`:''}<a class="btn ghost" href="https://www.healthyapps.dev/" target="_blank" rel="noopener">Get Health Auto Export</a><details class="phone-help"><summary>Using Garmin or MyFitnessPal?</summary><p>Allow Garmin Connect or MyFitnessPal to write your chosen readings into Apple Health first. For Garmin, sync your watch in Garmin Connect. Only supported readings actually present in Apple Health can arrive.</p></details><div class="phone-flow-actions"><button type="button" class="btn ghost" id="phoneBack">Back</button><button type="button" class="btn primary" id="phoneInstalled" ${canPrepare||preview?'':'disabled'}>${preview?'Preview next step':'The phone app is ready'}</button></div>`);
   target.querySelector('#phoneBack').onclick=()=>{step=0;draw();};target.querySelector('#phoneInstalled').onclick=()=>{step=2;draw();};
   target.querySelector('#phoneCopyLink')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(phoneSetupUrl(preview));target.querySelector('#phoneCopyStatus').textContent='Link copied';}catch{target.querySelector('#phoneCopyStatus').textContent='Select and copy the link above.';}});return;
  }
  if(step===2){
   shell(`<span class="phone-step-label">STEP 3 OF 4</span><h3>Approve your selected readings</h3><p>${scopes.map(phoneMetricLabel).map(esc).join(' · ')}</p><form id="phoneConsent"><label class="phone-consent"><input type="checkbox" required><span>Allow these readings to be shared with Legal Edge and my coach automatically for six months. I can disconnect at any time.</span></label><div class="phone-flow-actions"><button type="button" class="btn ghost" id="phoneBack">Back</button><button class="btn primary" ${canPrepare||preview?'':'disabled'}>${preview?'Preview phone setup':'Prepare my phone setup'}</button></div><p class="phone-inline-error" id="phonePrepareError" role="alert"></p></form>`);
   target.querySelector('#phoneBack').onclick=()=>{step=1;draw();};
   target.querySelector('#phoneConsent').onsubmit=async e=>{e.preventDefault();if(preview){step=3;draw();return;}if(!canPrepare||inFlight)return;inFlight=true;setBusy(e.submitter,true);try{const saved=await createConnection(scopes);if(!live())return;credential=saved.token;keyId=saved.id;existing={id:keyId,scopes,expires_at:saved.expires_at};step=3;draw();startPolling();}catch(err){if(live()){target.querySelector('#phonePrepareError').textContent=err.message||'Could not save your setup. Please retry.';setBusy(e.submitter,false);}}finally{inFlight=false;}};return;
  }
  shell(`<span class="phone-step-label">STEP 4 OF 4</span><h3>${existing?.last_received_at?'Your phone has sent data':'Finish on your iPhone'}</h3>${credential?'<div id="phoneOpenExporter"></div>':preview?'<p>On a real iPhone, your next button opens Health Auto Export with your selected readings already configured.</p><button class="btn primary" disabled>Open phone setup · preview</button>':existing?.last_received_at?'':`<p>A setup key is saved, but no upload has arrived. If you closed the page before opening the phone setup, prepare a new setup below.</p>`}<div id="phoneReceipt" class="phone-receipt" role="status"></div><details class="phone-help"><summary>First sync not arriving?</summary><ol><li>Open Health Auto Export and approve your selected Health permissions.</li><li>Open the Legal Edge automation and run it once with your iPhone unlocked.</li><li>Check the selected readings exist in Apple Health. For Garmin, sync your watch first.</li></ol><p>Keep the automation enabled. iOS controls background delivery, so updates may be delayed. You do not need to keep Legal Edge open.</p></details>${!preview&&existing?`<p class="phone-expiry">Sharing ends ${esc(hubStamp(existing.expires_at))}.</p><div class="phone-flow-actions"><button class="btn ghost" type="button" id="phoneNewSetup">Prepare another setup</button><button class="btn ghost" type="button" id="phoneDisconnect">Disconnect this setup</button></div>`:''}`);
  if(credential){const button=document.createElement('button');button.className='btn primary';button.type='button';button.textContent='Open phone setup';button.onclick=()=>{location.href=appleExporterSetup(credential,scopes);};target.querySelector('#phoneOpenExporter').append(button);const note=document.createElement('p');note.textContent='Approve the Health permissions in the phone app, then run the Legal Edge automation once. Return here to confirm receipt.';target.querySelector('#phoneOpenExporter').append(note);}
  paintReceipt(existing);
  target.querySelector('#phoneNewSetup')?.addEventListener('click',()=>{clearInterval(timer);credential=null;keyId=null;existing=null;step=0;draw();});
  target.querySelector('#phoneDisconnect')?.addEventListener('click',async e=>{setBusy(e.target,true);try{await revokeConnection(keyId);if(!live())return;clearInterval(timer);credential=null;existing=null;keyId=null;shell('<h3>Phone sharing disconnected</h3><p>This setup can no longer upload readings. Your previously saved history remains available.</p><button class="btn primary" id="phoneRestart">Set up again</button>');target.querySelector('#phoneRestart').onclick=()=>{step=0;draw();};}catch(err){toast(err.message,'error');setBusy(e.target,false);}});
 }
 function paintReceipt(key,rows=daily){
  const el=target.querySelector('#phoneReceipt');if(!el)return;
  if(preview){el.innerHTML='<strong>First upload confirmation</strong><p>In your real account, this will confirm receipt from your phone. No sync is simulated here.</p>';return;}
  if(!key?.last_received_at){el.innerHTML='<strong>Waiting for the first upload</strong><p>Your account is ready. Approve sharing and run the phone automation once. This screen checks automatically.</p>';return;}
  const row=rows.filter(r=>r.source==='apple_health').sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  const stale=Date.now()-Date.parse(key.last_received_at)>48*3600e3;
  el.innerHTML=`<strong>${stale?'No recent upload':'Upload received'} · ${esc(hubStamp(key.last_received_at))}</strong><p>${stale?'Open the phone app, check its permissions and run the automation again.':'Your phone has delivered an upload. Recorded readings appear below; missing readings stay blank.'}</p>${row?`<small>Latest recorded day: ${esc(fmt(row.date))}</small><dl class="phone-readings">${scopes.map(k=>`<div><dt>${esc(phoneMetricLabel(k))}</dt><dd>${esc(phoneMetricValue(k,row[k]))}</dd></div>`).join('')}</dl>`:'<p>No daily readings are available yet.</p>'}`;
 }
 async function check(){
  if(!live()){stop();return;}if(document.hidden||inFlight||!keyId)return;
  inFlight=true;try{const key=await readKey(keyId);if(!live())return;if(key.revoked_at||Date.parse(key.expires_at)<=Date.now()){clearInterval(timer);credential=null;target.querySelector('#phoneReceipt').innerHTML='<strong>Sharing ended</strong><p>Prepare a new setup to continue sharing.</p>';return;}if(key.last_received_at){existing={...existing,...key};const result=await refreshData();if(live())paintReceipt(existing,result.daily);}else paintReceipt(key);}
  catch{if(live()){const el=target.querySelector('#phoneReceipt');if(el)el.innerHTML='<strong>Unable to check receipt right now</strong><p>We will retry automatically. A connection has not been confirmed.</p>';}}finally{inFlight=false;}
 }
 function startPolling(){clearInterval(timer);if(preview||!keyId)return;timer=setInterval(check,10000);}
 if(!owner&&!preview){shell('<h3>Managed by this client</h3><p>The client approves sharing on their own phone. You can view the readings they have shared in their coaching workspace.</p>');return;}
 draw();startPolling();
}
