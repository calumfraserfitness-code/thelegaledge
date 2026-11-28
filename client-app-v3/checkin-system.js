/* Saved check-ins, private phone alerts and coach reviews share one account boundary. */
(() => {
 let account='',channel=null,timer=null,inFlight=null,refreshRequest=0,routed=false;
 const editedForms=new WeakSet(),editedControls=new WeakSet(),formSnapshots=new WeakMap();let workspaceStatus=null,pendingDisplay=null,workspaceRender=0;
 document.addEventListener('input',markEdited,true);document.addEventListener('change',markEdited,true);
 function markEdited(e){if(e.target.closest?.('#clientWorkspaceBody'))editedControls.add(e.target);const form=e.target.closest?.('#clientWorkspaceBody form');if(form)editedForms.add(form);}
 const originalCoach=renderCoach,originalClient=renderClient;
 const reportError=e=>toast(e.message||'This action could not complete.','error');
 function bounded(promise,message,ms=12000){let timeout;return Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timeout));}
 function sameAccount(owner){if(!owner||state.user?.id!==owner)throw Error('Account changed. Reopen notification settings.');}
 async function pushCall(body,owner=state.user?.id){sameAccount(owner);const {data:{session}}=await bounded(db.auth.getSession(),'Sign-in check timed out. Try again.');sameAccount(owner);if(!session||session.user?.id!==owner)throw Error('Sign in again.');const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(SUPABASE_URL+'/functions/v1/coaching-push',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const data=await r.json();sameAccount(owner);if(!r.ok)throw Error(data.error||'Notification setup failed.');return data;}catch(e){if(e.name==='AbortError')throw Error('Notification setup timed out. Try again.');throw e;}finally{clearTimeout(timeout);}}
 function panel(content){document.querySelector('#csModal')?.remove();const el=document.createElement('div');el.id='csModal';el.className='cs-modal';el.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="csTitle"><button class="text-btn cs-close" aria-label="Close">Close ×</button>'+content+'</section>';document.body.append(el);el.querySelector('.cs-close').onclick=()=>el.remove();el.addEventListener('click',e=>{if(e.target===el)el.remove();});el.querySelector('button')?.focus();}
 const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 async function alerts(){
  panel('<span class="eyebrow">YOUR DEVICE</span><h2 id="csTitle">Phone notifications</h2><p>Get an alert when '+(state.role==='coach'?'a client submits a check-in. Tap it to open your review queue.':'your coach posts a completed review.')+'</p>'+(ios()&&!installed()?'<div class="cs-note"><strong>One-time iPhone setup</strong><ol><li>Open this app in Safari.</li><li>Tap Share → Add to Home Screen.</li><li>Open Legal Edge from that icon, sign in, then enable notifications here.</li></ol></div>':'')+'<p id="csPushStatus" role="status">Checking this device…</p><div class="cs-actions"><button class="btn primary" id="csEnable">Enable notifications</button><button class="btn ghost" id="csTest">Send me a test alert</button><button class="text-btn" id="csDisable">Turn off on this device</button></div><p class="muted">Alerts contain no health readings, check-in answers or client names. Delivery depends on your phone, browser and Focus settings.</p>');
  const owner=state.user?.id,status=document.querySelector('#csPushStatus'),current=()=>state.user?.id===owner&&status.isConnected;
  const enable=document.querySelector('#csEnable'),test=document.querySelector('#csTest'),disable=document.querySelector('#csDisable');
  enable.disabled=true;test.disabled=true;disable.disabled=true;
  const retry=document.createElement('button');retry.className='btn ghost';retry.textContent='Retry device check';retry.hidden=true;status.after(retry);retry.onclick=()=>alerts().catch(reportError);
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)||(ios()&&!installed())){status.textContent='Install the Home Screen app to enable iPhone alerts. Other supported browsers can enable alerts here.';document.querySelector('#csEnable').disabled=true;document.querySelector('#csTest').disabled=true;return;}
  let reg,sub;
  try{reg=await bounded(navigator.serviceWorker.register('./service-worker.js',{scope:'./'}),'Device setup timed out. Retry the device check.');await bounded(navigator.serviceWorker.ready,'Device setup timed out. Retry the device check.');sameAccount(owner);sub=await bounded(reg.pushManager.getSubscription(),'Device check timed out. Try again.');sameAccount(owner);if(!current())return;
   let saved=false;if(sub){const row=await bounded(query('Notification registration',db.from('coaching_push_subscriptions').select('id').eq('user_id',owner).eq('endpoint',sub.endpoint).eq('enabled',true).maybeSingle()),'Registration check timed out. Retry the device check.');sameAccount(owner);saved=!!row?.id;}
   if(!current())return;enable.disabled=false;disable.disabled=!sub;test.disabled=!(saved&&Notification.permission==='granted');
   status.textContent=Notification.permission==='denied'?'Notifications are blocked. Allow them in your browser or phone settings.':saved&&Notification.permission==='granted'?'This device is saved for this account. Send a test alert, then confirm it appears on your phone.':sub?'This browser has a subscription, but it is not enabled for this account. Tap Enable notifications to reconnect it.':'Notifications are not enabled on this device yet.';
  }catch(e){if(current()){status.textContent=e.message;retry.hidden=false;}return;}
  enable.onclick=async e=>{e.target.disabled=true;test.disabled=true;try{
   // Request permission directly inside the tap, before any network await.
   sameAccount(owner);const permission=await Notification.requestPermission();sameAccount(owner);if(permission!=='granted')throw Error('Notifications were not allowed.');
   const config=await pushCall({action:'config'},owner);sameAccount(owner);
   const raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),key=Uint8Array.from(raw,c=>c.charCodeAt(0));
   const existing=await bounded(reg.pushManager.getSubscription(),'Device check timed out. Try again.');sameAccount(owner);
   const subscription=existing||await bounded(reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key}),'Device permission timed out. Retry Enable notifications.');sameAccount(owner);
   if(!current())return;const saved=await pushCall({action:'subscribe',subscription:subscription.toJSON()},owner);if(!saved.saved)throw Error('Device registration was not confirmed. Try again.');if(!current())return;localStorage.setItem('lec-push-account',owner);test.disabled=false;disable.disabled=false;status.textContent='Saved for this account. Send a test alert to confirm it reaches your phone.';
  }catch(e){if(current())status.textContent=e.message;}finally{if(current())e.target.disabled=false;}};
  test.onclick=async()=>{test.disabled=true;try{sameAccount(owner);await pushCall({action:'test'},owner);if(current())status.textContent='Test accepted by the push service. Check your phone notifications; acceptance does not confirm it appeared.';}catch(e){if(current())status.textContent=e.message;}finally{if(current())test.disabled=false;}};
  disable.onclick=async()=>{disable.disabled=true;try{sameAccount(owner);await disconnectPush();if(current()){test.disabled=true;status.textContent='Notifications turned off on this device.';}}catch(e){if(current()){status.textContent=e.message;disable.disabled=false;}}};
 }
 async function disconnectPush(owner=state.user?.id){
  sameAccount(owner);if(!('serviceWorker' in navigator))return;
  const reg=await bounded(navigator.serviceWorker.getRegistration(),'Device disconnect timed out. Try again.');sameAccount(owner);
  const sub=await bounded(reg?.pushManager.getSubscription(),'Device disconnect timed out. Try again.');sameAccount(owner);if(!sub)return;
  const removed=await bounded(sub.unsubscribe(),'Device disconnect timed out. Try again.');sameAccount(owner);
  if(!removed){
   const remaining=await bounded(reg.pushManager.getSubscription(),'Device disconnect timed out. Try again.');sameAccount(owner);
   if(remaining)throw Error('Device alerts could not be disconnected. Try again before signing out.');
  }
  localStorage.removeItem('lec-push-account');
  try{await pushCall({action:'unsubscribe',endpoint:sub.endpoint},owner);}catch{ /* The confirmed unsubscribed endpoint cannot receive alerts. */ }
 }
 function entriesOwner(){return [state.user?.id,state.role,state.client?.id,String(state.preview)].join(':');}
 function stamp(value){try{return window.CheckinStatus?.stamp(value,Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Dublin')||new Date(value).toLocaleString();}catch{return 'time unavailable';}}
 function workspaceEntries(){
  if(state.role!=='coach'||!state.client||state.preview)return;
  const host=document.querySelector('#coachMain'),body=host?.querySelector('#clientWorkspaceBody');if(!body)return;
  const owner=entriesOwner();let panel=host.querySelector('#csSavedEntries');
  if(!panel||panel.dataset.owner!==owner){panel?.remove();panel=document.createElement('section');panel.id='csSavedEntries';panel.className='cs-saved-entries';panel.dataset.owner=owner;panel.setAttribute('aria-label','Saved client entries');
   const text=document.createElement('p');text.dataset.entriesStatus='';text.setAttribute('role','status');
   const button=document.createElement('button');button.type='button';button.className='btn ghost small';button.textContent='Refresh saved entries';button.onclick=()=>{if(entriesOwner()===owner&&panel.isConnected)refreshCheckins({manual:true});};panel.append(text,button);body.before(panel);
  }
  if(workspaceStatus?.owner!==owner)workspaceStatus={owner,text:'Saved client entries · refresh to check weights, check-ins and health reports.'};
  for(const form of body.querySelectorAll('form'))if(!formSnapshots.has(form))formSnapshots.set(form,formSnapshot(form));
  panel.querySelector('[data-entries-status]').textContent=workspaceStatus.text;
  panel.querySelector('button').disabled=!!inFlight&&inFlight.owner===owner;
 }
 function statusEntries(text){workspaceStatus={owner:entriesOwner(),text};workspaceEntries();}
 function formSnapshot(form){return JSON.stringify([...form.elements].filter(field=>field.type!=='hidden'&&!['submit','button','reset'].includes(field.type)).map(field=>[field.name,field.type,field.type==='file'?[...field.files].map(file=>[file.name,file.size,file.lastModified]):field.type==='checkbox'||field.type==='radio'?field.checked:field.value]));}
 function hasWorkInProgress(body){
  if(!body)return true;
  if(body.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return true;
  if(body.querySelector('iframe,[aria-busy="true"],[data-saving]:not([data-saving="false"]),button:disabled[data-label],[data-brief-generate]:disabled,[data-brief-save]:disabled,[data-brief-prepare]:disabled'))return true;
  if([...body.querySelectorAll('input,textarea,select,[contenteditable="true"]')].some(control=>editedControls.has(control)))return true;
  if([...body.querySelectorAll('audio,video')].some(media=>!media.paused&&!media.ended))return true;
  return [...body.querySelectorAll('form')].some(form=>editedForms.has(form)||formSnapshots.has(form)&&formSnapshot(form)!==formSnapshots.get(form));
 }
 function refreshWeightFacts(body){
  if(state.clientTab!=='overview'||typeof clientSummaryModel!=='function'||typeof displayWeight!=='function')return;
  const weight=clientSummaryModel().weight,metrics=body?.querySelectorAll('.metric-strip .metric strong');
  if(metrics?.length>=3){metrics[1].textContent=weight?displayWeight(weight.value):'—';metrics[2].textContent=weight&&finiteRecorded(state.client.start_weight_kg)?displayWeight(Number(weight.value)-Number(state.client.start_weight_kg),true):'—';}
  const fact=body?.querySelector('.client-saved-summary .client-summary-facts > p');if(fact){const label=document.createElement('b');label.textContent='Latest recorded weight';fact.replaceChildren(label,document.createElement('br'),document.createTextNode(weight?displayWeight(weight.value)+' · '+fmt(weight.date)+' · '+weight.source:'No weigh-in recorded yet.'));}
 }
 function refreshHealthFacts(){
  if(state.role!=='coach'||state.clientTab!=='overview'||typeof clientSummaryModel!=='function')return;
  const facts=document.querySelectorAll('#clientWorkspaceBody .client-summary-facts > p');if(facts.length<3)return;const m=clientSummaryModel();
  const put=(node,label,value)=>{const b=document.createElement('b');b.textContent=label;node.replaceChildren(b,document.createElement('br'),document.createTextNode(value));};
  put(facts[1],'Saved reports',(m.healthReports||[]).length+' weekly health reports · '+m.blood.length+' blood reports · '+m.genetics.length+' genetic reports');
  put(facts[2],'Daily device readings',m.lastReading?'Latest received: '+hubStamp(m.lastReading.last_synced_at)+' · '+title(m.lastReading.source||'device'):'No daily device readings received. Weekly reports are shown separately.');
 }
 async function refreshCheckins(options={}){
  if(!state.user||state.preview||document.hidden)return;
  const owner=entriesOwner();if(inFlight?.owner===owner)return inFlight.promise;
  const user=state.user.id,id=state.client?.id,role=state.role,version=++refreshRequest;
  const active=()=>version===refreshRequest&&entriesOwner()===owner;
  const running={owner,promise:null};inFlight=running;workspaceEntries();
  running.promise=(async()=>{try{
   if(id){
    const beforeChecks=JSON.stringify(state.data.checkins||[]),beforeProgress=JSON.stringify(state.data.progress||[]),beforeDrafts=JSON.stringify(state.data.reviewDrafts||[]),beforeDraftAvailability=state.data.reviewDraftsAvailable,beforeDraftRevision=state.data.reviewDraftsRevision||0;
    const reportRows=()=> (state.data.files||[]).filter(row=>row.file_type==='health_weekly_report');
    const healthBefore={files:JSON.stringify(reportRows()),daily:JSON.stringify(state.data.healthDaily||[]),imports:JSON.stringify(state.data.healthImports||[])};
    const reads=await Promise.allSettled([
     query('Latest check-ins',db.from('checkins').select('*').eq('client_id',id).order('submitted_at',{ascending:false}).order('id',{ascending:false}).limit(250)),
     query('Latest progress',db.from('progress_entries').select('*').eq('client_id',id).order('entry_date',{ascending:false}).limit(500)),
     query('Latest health reports',db.from('client_files').select('*').eq('client_id',id).eq('file_type','health_weekly_report').order('created_at',{ascending:false}).limit(100)),
     query('Latest health readings',db.from('client_health_daily').select('*').eq('client_id',id).order('date',{ascending:false}).limit(90)),
     query('Latest health imports',db.from('client_health_imports').select('*').eq('client_id',id).order('imported_at',{ascending:false}).limit(20)),
     role==='coach'?query('Private check-in reply drafts',db.from('coach_checkin_reply_drafts').select('*').eq('client_id',id).eq('coach_id',user).order('updated_at',{ascending:false}).limit(250)):Promise.resolve([])
    ]);if(!active())return;
    let changed=false,raced=false;
    for(const [index,key,before]of [[0,'checkins',beforeChecks],[1,'progress',beforeProgress]]){
     if(reads[index].status!=='fulfilled')continue;
     // An in-flight read must not replace a save that completed after the read started.
     if(JSON.stringify(state.data[key]||[])!==before){raced=true;continue;}
     const rows=reads[index].value.filter(row=>row.client_id===id);if(JSON.stringify(rows)!==before){state.data[key]=rows;changed=true;}
    }
    const healthStatus={...(state.healthReportsStatus||{}),clientId:id,accountId:user};
    for(const [index,name,key,cap] of [[2,'files','files',100],[3,'daily','healthDaily',90],[4,'imports','healthImports',20]]){
     const read=reads[index];if(read.status==='rejected'){healthStatus[name]='error';continue;}
     healthStatus[name]='ready';healthStatus[name+'Capped']=read.value.length>=cap;
     const current=name==='files'?reportRows():state.data[key]||[];
     if(JSON.stringify(current)!==healthBefore[name]){raced=true;continue;}
     const rows=read.value.filter(row=>row.client_id===id&&(name!=='files'||row.file_type==='health_weekly_report'));
     if(name==='files'){
      const oldest=rows.at(-1)?.created_at,older=rows.length>=cap?current.filter(row=>row.created_at&&row.created_at<oldest&&!rows.some(f=>f.id===row.id)):[];
      state.data.files=[...(state.data.files||[]).filter(row=>row.file_type!=='health_weekly_report'),...rows,...older];
     }else state.data[key]=rows;
    }
    state.healthReportsStatus=healthStatus;
    let privateChanged=false;
    if(role==='coach'){
     if(JSON.stringify(state.data.reviewDrafts||[])!==beforeDrafts||state.data.reviewDraftsAvailable!==beforeDraftAvailability||(state.data.reviewDraftsRevision||0)!==beforeDraftRevision)raced=true;
     else{state.data.reviewDraftsRevision=beforeDraftRevision+1;if(reads[5].status==='rejected')state.data.reviewDraftsAvailable=false;else{state.data.reviewDraftsAvailable=true;const drafts=reads[5].value.filter(row=>row.client_id===id&&row.coach_id===user);privateChanged=JSON.stringify(drafts)!==beforeDrafts||beforeDraftAvailability!==true;state.data.reviewDrafts=drafts;}}
    }
    const failed=reads.some(r=>r.status==='rejected');
    if(role==='coach'){
     const body=document.querySelector('#clientWorkspaceBody'),pending=pendingDisplay?.owner===owner&&pendingDisplay.body===body&&pendingDisplay.tab===state.clientTab&&pendingDisplay.render===workspaceRender,needsDisplay=changed||privateChanged&&state.clientTab==='check-ins'||pending,canRepaint=needsDisplay&&['overview','check-ins','progress'].includes(state.clientTab)&&!hasWorkInProgress(body);
     if(canRepaint){await Promise.resolve(renderClientWorkspace());if(!active())return;pendingDisplay=null;}else if(needsDisplay){pendingDisplay={owner,body,tab:state.clientTab,render:workspaceRender};refreshWeightFacts(body);}
     const base=failed?'Some saved entries could not refresh. Your last loaded records remain available.':raced?'A save completed while checking. Your saved entries were kept; refresh again for the latest records.':'Saved entries checked '+stamp(new Date().toISOString())+'.';
     statusEntries(base+(needsDisplay&&!canRepaint?' New saved records are loaded. Your current edits and video stay open; reopen Overview, Check-ins or Progress when ready.':needsDisplay?' Updated entries are shown.':''));
    }else if(role==='client'){reviewCard();window.PracticeFeedback?.refresh?.();}
    if(role==='coach'&&typeof refreshCoachReplyAvailability==='function')refreshCoachReplyAvailability();
    state.recoveryTrendRefresh={accountId:user,clientId:id,checkins:reads[0].status==='fulfilled'?'ready':'error',daily:reads[3].status==='fulfilled'?'ready':'error'};
    refreshHealthFacts();window.CoachHealthReports?.mount?.();window.WeighInRoutine?.mount?.();window.RecoveryTrends?.mount?.();
    Promise.resolve(window.WeeklyRecap?.refresh?.()).catch(()=>{});
   }
   if(!active())return;
   if(role==='coach'&&!id&&state.coachView==='reviews'&&!document.activeElement?.matches('input,textarea,select'))await renderReviewQueue(0);
   if(role==='coach'&&!id&&state.coachView==='dashboard'&&!document.activeElement?.matches('input,textarea,select')){await window.LegalEdgePriorities?.refreshAttention?.();window.FlexibleCompletion?.refreshCoach?.();window.CoachHealthReports?.refreshHome?.();}
  }catch{if(active()&&role==='coach'&&id)statusEntries('Saved entries could not refresh. Your last loaded records and edits remain available. Try Refresh saved entries again.');}
  finally{if(inFlight===running){inFlight=null;if(active())workspaceEntries();}}})();return running.promise;
 }
 function reviewCard(){if(state.role!=='client'||state.client?.onboarding_status!=='complete')return;if(state.clientView==='today'&&window.LegalEdgePriorities){if(document.querySelector('#personalCoachingHome'))window.PersonalCoachingHome?.arrange?.();else{window.LegalEdgePriorities.home();window.PersonalCoachingHome?.mount?.();}return;}const c=state.data.checkins.find(c=>(c.client_id===state.client?.id||state.preview&&!c.client_id)&&c.reviewed_at&&c.review_channel!=='whatsapp'&&(c.coach_response||c.voice_note_url));let card=document.querySelector('#csCoachReview');if(!c){card?.remove();return;}
  const url=safeMediaUrl(c.voice_note_url),loom=url?.match(/^https:\/\/(?:www\.)?loom\.com\/share\/([a-f0-9]{32})(?:[?/#]|$)/i);
  const stamp=[c.id,c.reviewed_at,c.coach_response,url].join('|');if(card?.dataset.stamp===stamp)return;if(!card){card=document.createElement('section');card.id='csCoachReview';card.className='panel cs-review';document.querySelector('#clientMain')?.prepend(card);}card.dataset.stamp=stamp;
  card.innerHTML='<span class="eyebrow">YOUR COACH REVIEW</span><h2>Your coach’s next steps</h2><p class="muted">'+esc(fmt(c.reviewed_at))+' · Your submitted check-in stays saved.</p>'+(loom?'<button type="button" class="cs-play" data-cs-play><span>▶</span><strong>Your weekly video review</strong><small>Watch your coach’s feedback</small></button>':'')+(url?'<a class="btn primary" href="'+esc(url)+'" target="_blank" rel="noopener">Watch your coach’s review ↗</a>':'')+(c.coach_response?'<p class="cw-lines">'+esc(c.coach_response)+'</p>':'')+(c.focus_next_week?'<h3>Agreed next steps</h3><p class="cw-lines">'+esc(c.focus_next_week)+'</p>':'');
  if(loom)card.querySelector('[data-cs-play]').onclick=e=>{e.currentTarget.outerHTML='<div class="cs-video"><iframe src="https://www.loom.com/embed/'+loom[1]+'" title="Your private coach review" allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';};
 }
 function connect(){
  if(state.preview||!state.user||!['coach','client'].includes(state.role)||typeof db.channel!=='function')return;
  const user=state.user.id,role=state.role,key=[user,role,role==='client'?state.client?.id:''].join(':');if(account===key)return;
  if(channel)db.removeChannel(channel);clearInterval(timer);account=key;
  const filter=role==='client'&&state.client?{filter:'client_id=eq.'+state.client.id}:{};
  const changed=payload=>{if(account!==key||state.user?.id!==user||state.role!==role)return;if(role==='coach'&&payload.table==='checkins'&&payload.eventType==='INSERT')toast('New client check-in received. Open Check-ins to review.');refreshCheckins();};
  channel=db.channel('checkin-account-'+key).on('postgres_changes',{event:'*',schema:'public',table:'checkins',...filter},changed).on('postgres_changes',{event:'*',schema:'public',table:'progress_entries',...filter},changed).on('postgres_changes',{event:'*',schema:'public',table:'client_files',...filter},changed).on('postgres_changes',{event:'*',schema:'public',table:'client_health_daily',...filter},changed).on('postgres_changes',{event:'*',schema:'public',table:'client_health_imports',...filter},changed).subscribe();
  timer=setInterval(refreshCheckins,30000);
 }
 document.addEventListener('visibilitychange',refreshCheckins);window.addEventListener('focus',refreshCheckins);
 if(typeof renderClientWorkspace==='function'){const originalWorkspace=renderClientWorkspace;renderClientWorkspace=function(){workspaceRender++;pendingDisplay=null;const result=originalWorkspace();Promise.resolve(result).then(workspaceEntries).catch(()=>{});return result;};}
 window.CoachingEntrySync={refresh:refreshCheckins,mount:workspaceEntries};
 async function backups(){
  const owner=state.user?.id;
  panel('<span class="eyebrow">COACH OPERATIONS</span><h2 id="csTitle">Saved data & backups</h2><p>Download a private coaching-data snapshot. It includes check-ins, reviews, plans and saved client records. Keep it somewhere secure.</p><button class="btn primary" id="csExport">Download coaching backup</button><p id="csBackupStatus" role="status"></p><p class="muted">Check-in edits are also versioned in private recovery storage. This export excludes login passwords, provider credentials and uploaded file bytes. Those require a separate full-project backup.</p>');
  const status=document.querySelector('#csBackupStatus'),current=()=>state.user?.id===owner&&status.isConnected;
  document.querySelector('#csExport').onclick=async e=>{e.target.disabled=true;try{
   sameAccount(owner);if(state.role!=='coach')throw Error('Coach access required.');
   const data=await query('Coaching backup',db.rpc('export_coaching_backup'));sameAccount(owner);if(!current())return;
   if(data?.format!=='legal-edge-coaching-backup'||data.coach_id!==owner||!Array.isArray(data.tables?.checkins))throw Error('A complete backup for this account was not confirmed. Retry the export.');
   const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Legal-Edge-Coaching-Backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   status.textContent='Backup exported. '+data.tables.checkins.length+' saved check-ins included.';
  }catch(e){if(current())status.textContent=e.message;}finally{if(current())e.target.disabled=false;}};
 }
 function controls(){connect();workspaceEntries();const history=document.querySelector('#coachCheckinForm')?.closest('.data-entry-panel');if(history&&!history.closest('.cs-history')){const d=document.createElement('details');d.className='cs-history';d.innerHTML='<summary>Add a past check-in</summary>';history.before(d);d.append(history);}if(state.role==='coach'&&!document.querySelector('#csCoachTools')){const nav=document.querySelector('#coachNav');if(nav){nav.insertAdjacentHTML('beforeend','<div id="csCoachTools" class="cs-tools"><button class="side-link" id="csPhoneAlerts">Phone alerts</button><button class="side-link" id="csBackups">Backups</button><a class="side-link" href="./firms-walkthrough.html" target="_blank" rel="noopener">Corporate walkthrough ↗</a></div>');document.querySelector('#csPhoneAlerts').onclick=()=>alerts().catch(reportError);document.querySelector('#csBackups').onclick=()=>backups();}}
  if(state.role==='client'&&!document.querySelector('#csClientAlerts')){const menu=document.querySelector('#clientApp .account-menu > div');if(menu){const b=document.createElement('button');b.id='csClientAlerts';b.textContent='Notifications';b.onclick=()=>alerts().catch(reportError);menu.append(b);}}
  if(!routed&&state.user){routed=true;const q=new URLSearchParams(location.search);if(q.get('section')==='reviews'&&state.role==='coach'){state.client=null;state.coachView='reviews';const checkin=q.get('checkin');Promise.resolve(renderReviewQueue(0)).then(async()=>{if(!checkin||! /^[0-9a-f-]{36}$/i.test(checkin))return;const {data,error}=await db.from('checkins').select('id,client_id').eq('id',checkin).maybeSingle();if(error||!data){toast('This check-in is unavailable for this account.','error');return;}const button=document.createElement('button');button.dataset.reviewClient=data.client_id;button.dataset.reviewCheckin=data.id;await openQueuedReview(button);}).catch(reportError);}else if(q.get('section')==='checkin'&&state.role==='client'){state.clientView='checkin';renderClient();}}
 }
 renderCoach=function(){const r=originalCoach();Promise.resolve(r).then(controls).catch(()=>{});return r;};
 renderClient=function(){const r=originalClient();Promise.resolve(r).then(()=>{controls();reviewCard();}).catch(()=>{});return r;};
 // Disable this account's subscription before sign-out, rather than leaving alerts on a shared phone.
 document.addEventListener('click',async e=>{const b=e.target.closest('.logout');if(!b||state.preview)return;e.preventDefault();e.stopImmediatePropagation();const owner=state.user?.id;try{await disconnectPush(owner);sameAccount(owner);}catch(err){toast(err.message||'Could not disable device alerts. Try again before signing out.','error');return;}if(channel)db.removeChannel(channel);clearInterval(timer);await db.auth.signOut();location.reload();},true);
})();
