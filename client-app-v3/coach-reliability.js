/* Read-only operational evidence, fetched only when the coach opens the disclosure. */
(function(){
 'use strict';
 let generation=0;
 const eligible=()=>state.role==='coach'&&!state.client&&!state.preview&&state.coachView==='dashboard';
 function stamp(value){const d=new Date(value);return value&&Number.isFinite(+d)?new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',dateStyle:'medium',timeStyle:'short'}).format(d):'Not recorded';}
 function count(n){return Number.isInteger(n)&&n>=0?n:null;}
 function cards(data,now=Date.now()){
  const a=data.alerts,h=data.health,b=data.backup;
  if(!a||!h||typeof a.capped!=='boolean'||typeof h.capped!=='boolean'||![a.enabled_devices,a.pending,a.pending_unattempted,a.failed,a.provider_accepted,h.keys_with_receipt,h.weekly_reports,h.report_clients].every(n=>count(n)!==null))throw Error('Status response was incomplete. Retry.');
  const age=b?.created_at?now-Date.parse(b.created_at):NaN,backupReady=!!b?.has_payload&&!!b?.has_hash&&Number.isFinite(age)&&age>=0&&age<=36*3600000;
  return [
   {title:'Your phone alerts',label:a.capped?'Status unavailable':a.failed?'Notification jobs need attention':a.enabled_devices?'Device registration saved':'No enabled devices',tone:a.capped||a.failed?'warn':a.enabled_devices?'neutral':'warn',text:a.capped?'The bounded read was incomplete. Do not treat these counts as zero.':a.enabled_devices+' enabled devices · '+a.pending+' pending · '+a.failed+' failed · '+a.provider_accepted+' provider-accepted in the last 7 days. '+(!a.enabled_devices&&a.pending_unattempted?'Unattempted jobs can wait for registration; this alone is not a worker failure. ':'')+'Registration and provider acceptance do not prove your phone displayed an alert.',action:'alerts',button:'Open phone alerts'},
   {title:'Saved recovery snapshot',label:backupReady?'Recent snapshot recorded':b?'Snapshot needs checking':'No snapshot recorded',tone:backupReady?'neutral':'warn',text:b?'Created '+stamp(b.created_at)+' Irish time. Payload '+(b.has_payload?'present':'missing')+'; hash '+(b.has_hash?'present':'missing')+'. This does not verify restoration, login recovery or uploaded file bytes.':'No scheduled snapshot metadata is available for this coach. An export is separate from a restore test.',action:'backup',button:'Open backups'},
   {title:'Watch & health sharing',label:h.capped?'Status unavailable':h.keys_with_receipt?'Automatic upload received':'No automatic upload received',tone:h.capped?'warn':'neutral',text:h.capped?'The bounded health status read was incomplete. Open the individual client to inspect their receipts.':h.keys_with_receipt+' sharing keys have received an upload'+(h.last_automatic_receipt_at?' · latest '+stamp(h.last_automatic_receipt_at):'')+'. '+h.weekly_reports+' weekly reports across '+h.report_clients+' clients'+(h.last_report_at?' · latest received '+stamp(h.last_report_at):'')+'. Reports are separate from live daily readings; an upload receipt does not guarantee ongoing background syncing.',action:'health',button:'View reports & connections'}
  ];
 }
 function mount(){
  if(!eligible())return;
  const host=document.querySelector('#coachMain'),target=host?.querySelector('#coachHomeFocus [data-home-primary]')||host;if(!target)return;
  const owner=state.user?.id;if(!owner)return;
  let panel=host.querySelector('#coachReliability');if(panel?.dataset.owner===owner)return;panel?.remove();
  panel=document.createElement('details');panel.id='coachReliability';panel.className='panel coach-reliability';panel.dataset.owner=owner;
  panel.innerHTML='<summary><span><strong>App status</strong><small>Phone alerts, backups and health sharing</small></span><span data-reliability-summary>Open to check</span></summary><div class="reliability-body"><p>Private coach status · checked on demand. No messages or test notifications are sent.</p><p data-reliability-status role="status">Open this section to check saved evidence.</p><div data-reliability-cards></div><button type="button" class="btn ghost small" data-reliability-refresh>Refresh status</button></div>';
  target.append(panel);
  let loaded=false,busy=false;
  const current=()=>eligible()&&state.user?.id===owner&&panel.isConnected;
  async function load(){
   if(!current()||busy)return;busy=true;const token=++generation,button=panel.querySelector('[data-reliability-refresh]'),status=panel.querySelector('[data-reliability-status]'),summary=panel.querySelector('[data-reliability-summary]');button.disabled=true;status.textContent='Checking saved status…';summary.textContent='Checking…';let timeout;
   try{
    const data=await Promise.race([query('App status',db.rpc('coach_operational_status')),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Status check timed out. Retry.')),10000);})]);
    if(!current()||token!==generation)return;
    if(data?.format!=='legal-edge-operational-status'||data.coach_id!==owner||!Number.isFinite(Date.parse(data.checked_at)))throw Error('Status for this account was not confirmed. Retry.');
    const rows=cards(data),grid=panel.querySelector('[data-reliability-cards]');grid.replaceChildren();
    for(const row of rows){const article=document.createElement('article'),title=document.createElement('h3'),label=document.createElement('strong'),text=document.createElement('p'),action=document.createElement('button');article.dataset.tone=row.tone;title.textContent=row.title;label.textContent=row.label;text.textContent=row.text;action.type='button';action.className='btn ghost small';action.textContent=row.button;action.onclick=()=>{if(!current())return;if(row.action==='health'){const group=document.querySelector('[data-home-group="watch"]');if(group){group.open=true;group.scrollIntoView?.({block:'start'});}return;}const source=document.getElementById(row.action==='alerts'?'csPhoneAlerts':'csBackups');if(source)source.click();else status.textContent='Open More → '+(row.action==='alerts'?'Phone alerts':'Backups')+'.';};article.append(title,label,text,action);grid.append(article);}
    loaded=true;summary.textContent=rows.some(r=>r.tone==='warn')?'Setup or checks needed':'Saved evidence loaded';status.textContent='Checked '+stamp(data.checked_at)+' Irish time. Physical-device behavior is separate.';
   }catch(e){if(current()&&token===generation){summary.textContent='Status unavailable';status.textContent=(loaded?'Previous figures below are out of date. ':'')+(e.message||'Status could not load. Retry.');}}
   finally{clearTimeout(timeout);busy=false;if(current()&&token===generation)button.disabled=false;}
  }
  panel.addEventListener('toggle',()=>{if(panel.open&&!loaded)load();});panel.querySelector('[data-reliability-refresh]').onclick=load;
 }
 const before=renderCoach;renderCoach=function(){const result=before();Promise.resolve(result).then(mount).catch(()=>{});return result;};
 window.CoachReliability={mount,cards};
})();
