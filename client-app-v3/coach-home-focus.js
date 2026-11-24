/* Coach Home keeps check-ins and the client directory in view. */
(function(){
 'use strict';
 let observer=null,scheduled=false;
 const sections=[['activity','Client activity','Sign-ins and saved training/check-ins'],['setup','Onboarding & setup','Submitted profiles, busy-week setups and plan checks'],['watch','Watch connections','Received readings and connection status'],['health','Health reports & app status','Saved reports, phone alerts and backups'],['other','Other tools','Additional coaching controls']];
 function eligible(){return state.role==='coach'&&!state.client&&state.coachView==='dashboard';}
 function groupFor(node){
  if(['coachActivity','coachCompletionFeed'].includes(node.id))return 'activity';
  if(['coachHealthReportInbox','coachReliability'].includes(node.id))return 'health';
  if(node.id==='psWatchFeed')return 'watch';
  if(['psInbox','bwCoachQueue'].includes(node.id)||node.querySelector('.qa-table')||/^(Client plan QA|Plan completeness)$/.test(node.querySelector('h3')?.textContent||''))return 'setup';
  return 'other';
 }
 function compactWatch(panel){
  const grid=panel.querySelector('.ps-watch-grid');if(!grid)return;
  let empty=0;grid.querySelectorAll(':scope > article').forEach(card=>{const received=!!card.querySelector('dl')||/^Phone upload received/.test(card.querySelector('small')?.textContent||'');card.hidden=!received;if(!received)empty++;});
  let note=panel.querySelector('[data-home-watch-empty]');if(!note){note=document.createElement('p');note.dataset.homeWatchEmpty='';grid.before(note);}
  const message=empty===grid.children.length?'No client readings have arrived yet. Open a client’s Progress → Devices for connection setup.':empty+' clients have no received readings yet. Their connection setup stays in each client’s Progress → Devices.';
  if(note.textContent!==message)note.textContent=message;
  note.hidden=empty===0;
 }
 function checkinInbox(shell,attention){
  const box=shell.querySelector('[data-home-checkins]'),coverage=shell.querySelector('[data-home-coverage]');
  let data;try{data=JSON.parse(attention?.dataset.homeCheckins||'null');}catch{}
  const user=state.user?.id;
  const rows=(data?.available||data?.pending_available)?(data.rows||[])
   .filter(r=>!r.reviewed_at&&(!r.source_system||/^client_weekly_v[23]$/.test(r.source_system))&&state.clients?.some(c=>c.id===r.client_id))
   .sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at))):[];
  const signature=JSON.stringify({user,data,rows});if(box.dataset.signature===signature)return;box.dataset.signature=signature;
  const loaded=data?.available&&data.pending_available!==false;
  const status=box.querySelector('[data-home-checkin-status]');
  status.textContent=rows.length?rows.length+' to review'+(loaded?'':' · list may be incomplete')
   :data?(loaded?'All caught up':'Check-ins unavailable'):state.preview?'':'Checking…';
  const list=box.querySelector('[data-home-review-list]');list.replaceChildren();coverage.replaceChildren();
  coverage.hidden=!rows.length;
  if(rows.length){const title=document.createElement('h3');title.textContent='Check-in call coverage';coverage.append(title);}
  for(const [index,row] of rows.entries()){
   const client=state.clients.find(c=>c.id===row.client_id);
   const article=document.createElement('article'),summary=document.createElement('div'),name=document.createElement('strong'),date=document.createElement('small'),button=document.createElement('button');
   article.className='home-checkin-row';name.textContent=client.display_name;
   button.className='btn ghost small';button.type='button';button.textContent='Review';
   button.setAttribute('aria-label','Review check-in for '+client.display_name);
   button.dataset.homeCheckinClient=row.client_id;button.dataset.checkinId=row.id;
   button.onclick=async()=>{if(!eligible()||state.user?.id!==user||!button.isConnected)return;state.client=client;state.clientTab='check-ins';try{if(await loadClientData(client.id)===false)return;if(state.role==='coach'&&state.user?.id===user&&state.client?.id===client.id){renderCoach();const form=Array.from(document.querySelectorAll('[data-coach-review]')).find(f=>f.dataset.coachReview===row.id);if(form){const details=form.closest('details');if(details)details.open=true;form.scrollIntoView?.({block:'center'});}}}catch(e){if(state.user?.id===user)toast(e.message,'error');}};
   date.className='sub';date.textContent=window.CheckinStatus.submissionLabel(row);
   summary.append(name,date);article.append(summary,button);if(index<3)list.append(article);
   const record=document.createElement('article'),label=document.createElement('p');
   label.textContent=client.display_name+' · Submitted '+window.CheckinStatus.stamp(row.submitted_at,'Europe/Dublin');
   record.className='home-checkin-row';record.append(label);coverage.append(record);
  }
  const refresh=box.querySelector('[data-home-checkin-refresh]');
  refresh.hidden=!data||loaded;refresh.disabled=false;
  refresh.onclick=()=>{if(!eligible()||state.user?.id!==user||!refresh.isConnected)return;const retry=attention?.querySelector('.panel-head button');if(retry&&!retry.disabled){refresh.disabled=true;retry.click();}else if(!retry){window.LegalEdgePriorities?.refreshAttention?.();}};
  // Only an explicit tap reads matched call metadata. It never marks the check-in reviewed.
  coverage.querySelectorAll('article').forEach((article,index)=>{
   const row=rows[index],button=document.createElement('button'),note=document.createElement('p');button.type='button';button.className='text-btn';button.textContent='Check whether a later call covered this';note.className='home-call-coverage';note.setAttribute('role','status');article.append(button,note);
   button.onclick=async()=>{
    if(!eligible()||state.user?.id!==user||!button.isConnected)return;button.disabled=true;note.textContent='Checking matched call records…';
    try{const calls=await query('Check-in call coverage',db.from('coaching_recording_events').select('id,client_id,coach_id,occurred_at').eq('coach_id',user).eq('client_id',row.client_id).eq('matching_status','matched').gte('occurred_at',row.submitted_at).lte('occurred_at',new Date().toISOString()).order('occurred_at',{ascending:false}).limit(1));
     if(!eligible()||state.user?.id!==user||!button.isConnected)return;
     if(calls.some(c=>c.client_id!==row.client_id||c.coach_id!==user||!Number.isFinite(Date.parse(c.occurred_at))||Date.parse(c.occurred_at)<Date.parse(row.submitted_at)||Date.parse(c.occurred_at)>Date.now()))throw Error('Call ownership or timing could not be confirmed.');
     note.textContent=calls.length?'A matched call is recorded on '+window.CheckinStatus.stamp(calls[0].occurred_at,'Europe/Dublin')+'. Open the client’s Calls to check whether you covered this submission. It stays awaiting review until you confirm.':'No later matched recording was found. This does not prove no call took place. Review the submission as usual.';
     if(calls.length){const open=document.createElement('button');open.type='button';open.className='btn ghost small';open.textContent='Open call history';note.append(document.createElement('br'),open);open.onclick=async()=>{if(!eligible()||state.user?.id!==user||!open.isConnected)return;const c=state.clients.find(c=>c.id===row.client_id);if(!c)return;state.client=c;state.clientTab='support';try{if(await loadClientData(c.id)===false)return;if(state.role==='coach'&&state.user?.id===user&&state.client?.id===c.id)renderCoach();}catch(e){if(state.user?.id===user)toast(e.message,'error');}};}
    }catch{if(eligible()&&state.user?.id===user&&button.isConnected)note.textContent='Call coverage unavailable. Open the client’s Calls to check; this submission remains awaiting review.';}
    finally{if(button.isConnected)button.disabled=false;}
   };
  });
 }
 function dataAvailable(panel){try{const data=JSON.parse(panel.dataset.homeCheckins);return data.available&&data.pending_available!==false;}catch{return false;}}
 function arrange(){
  scheduled=false;if(!eligible())return;const host=$('#coachMain');if(!host)return;
  let shell=host.querySelector('#coachHomeFocus');
  if(!shell){
   shell=document.createElement('div');shell.id='coachHomeFocus';
   shell.innerHTML='<section class="panel home-checkin-inbox" data-home-checkins aria-labelledby="homeReviewHeading"><div class="home-review-heading"><div><h1 id="homeReviewHeading">Check-ins</h1><span data-home-checkin-status role="status"></span></div><button type="button" class="btn primary small" data-home-route="reviews">Review check-ins</button></div><div data-home-review-list></div><button type="button" class="btn ghost small" data-home-checkin-refresh hidden>Retry</button></section><div data-home-directory></div><details class="home-focus-tools"><summary>Coach tools</summary><div class="home-tool-links"><button type="button" class="btn ghost small" data-home-route="clients">All clients</button>'+(!state.preview?'<button type="button" class="btn ghost small" data-home-route="roadmaps" data-cr-hub>Goals & plans</button>':'')+'</div>'+sections.map(([key,title,sub])=>'<details data-home-group="'+key+'"><summary><span><strong>'+title+'</strong><small>'+sub+'</small></span></summary><div data-home-content="'+key+'">'+(key==='health'?'<div data-home-primary></div>':key==='activity'?'<section class="panel" data-home-coverage hidden></section>':'')+'</div></details>').join('')+'</details>';
   host.prepend(shell);const user=state.user?.id;
   shell.querySelectorAll('[data-home-route]').forEach(button=>button.onclick=()=>{if(!button.isConnected||!eligible()||state.user?.id!==user)return;state.coachView=button.dataset.homeRoute;renderCoach();});
  }
  const attention=host.querySelector('#priorityAttention');
  checkinInbox(shell,attention);
  if(attention&&attention.parentElement!==shell.querySelector('[data-home-content="setup"]'))shell.querySelector('[data-home-content="setup"]').append(attention);
  if(attention){
   const status=attention.querySelector('[data-priority-status]');
   if(status){
    const rows=Array.from(status.querySelectorAll(':scope > .priority-issue'));
    const setup=rows.filter(row=>{const id=row.querySelector('[data-priority-client]')?.dataset.priorityClient;return state.clients?.find(c=>c.id===id)?.portal_enabled===false;});
    if(setup.length){let disclosure=status.querySelector('[data-home-pending-setup]');if(!disclosure){disclosure=document.createElement('details');disclosure.dataset.homePendingSetup='';disclosure.innerHTML='<summary>Client setups not yet enabled</summary>';const footer=status.querySelector(':scope > small');if(footer)footer.before(disclosure);else status.append(disclosure);}setup.forEach(row=>disclosure.append(row));}
    const review=rows.filter(row=>!setup.includes(row)&&row.textContent.includes('Check-in ready to review'));
    review.forEach(row=>{row.hidden=!!attention.dataset.homeCheckins&&dataAvailable(attention);});
    const first=Array.from(status.querySelectorAll(':scope > .priority-issue')).find(row=>!review.includes(row));review.forEach(row=>{if(first&&Array.from(status.children).indexOf(row)>Array.from(status.children).indexOf(first))first.before(row);});
   }
  }
  const directory=host.querySelector('#homeClientDirectory');
  if(directory&&directory.parentElement!==shell.querySelector('[data-home-directory]'))shell.querySelector('[data-home-directory]').append(directory);
  // Move the original tools so their handlers and receipt status survive.
  Array.from(host.children).filter(node=>node!==shell).forEach(node=>{
   if(node.classList.contains('page-head')){node.hidden=true;return;}
   shell.querySelector('[data-home-content="'+groupFor(node)+'"]'+(node.id==='coachHealthReportInbox'?' [data-home-primary]':'')).append(node);
  });
  const watch=host.querySelector('#psWatchFeed');if(watch)compactWatch(watch);
  // Async modules replace these cards after initial rendering. Return them to the same group.
  ['coachActivity','psInbox','bwCoachQueue','psWatchFeed'].forEach(id=>{const node=host.querySelector('#'+id);if(!node)return;const target=shell.querySelector('[data-home-content="'+groupFor(node)+'"]');if(node.parentElement!==target)target.append(node);});
 }
 function schedule(){if(!scheduled){scheduled=true;queueMicrotask(arrange);}}
 function mount(){
  observer?.disconnect();observer=null;if(!eligible())return;
  arrange();const host=$('#coachMain');if(!host)return;
  observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length))schedule();});
  observer.observe(host,{childList:true,subtree:true});
 }
 const before=renderCoach;renderCoach=function(){observer?.disconnect();const result=before();Promise.resolve(result).then(mount).catch(()=>{});return result;};
 window.CoachHomeFocus={arrange,mount};
})();
