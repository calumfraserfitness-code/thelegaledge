/* Coach Home is an action inbox. Secondary tools remain intact behind disclosure. */
(function(){
 'use strict';
 let observer=null,scheduled=false;
 const sections=[['activity','Client activity','Sign-ins and saved training/check-ins'],['setup','Onboarding & setup','Submitted profiles, busy-week setups and plan checks'],['watch','Watch connections','Received readings and connection status'],['directory','All clients & tools','Client directory and other coach tools']];
 function eligible(){return state.role==='coach'&&!state.client&&state.coachView==='dashboard';}
 function groupFor(node){
  if(node.id==='coachActivity')return 'activity';
  if(node.id==='psWatchFeed')return 'watch';
  if(['psInbox','bwCoachQueue'].includes(node.id)||node.querySelector('.qa-table')||/^(Client plan QA|Plan completeness)$/.test(node.querySelector('h3')?.textContent||''))return 'setup';
  return 'directory';
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
  let box=shell.querySelector('[data-home-checkins]');if(!box){box=document.createElement('section');box.className='panel home-checkin-inbox';box.dataset.homeCheckins='';box.setAttribute('aria-live','polite');shell.querySelector('[data-home-primary]').before(box);}
  let data;try{data=JSON.parse(attention?.dataset.homeCheckins||'null');}catch{}
  const user=state.user?.id,rows=data?.available?(data.rows||[]).filter(r=>state.clients?.some(c=>c.id===r.client_id)).sort((a,b)=>Number(!!a.reviewed_at)-Number(!!b.reviewed_at)||String(b.submitted_at).localeCompare(String(a.submitted_at))):[],pending=rows.filter(r=>!r.reviewed_at&&(!r.source_system||/^client_weekly_v[23]$/.test(r.source_system))).length;
  const signature=JSON.stringify({user,data,rows});if(box.dataset.signature===signature)return;box.dataset.signature=signature;
  const title=!data?'Checking check-ins…':!data.available?'Check-in status unavailable':data.pending_available===false?'Outstanding reviews unavailable':!rows.some(r=>!r.reviewed_at)?'All check-ins reviewed':pending+' check-in'+(pending===1?'':'s')+' ready for review';
  box.replaceChildren();const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='YOUR COACHING ACTION LIST';const heading=document.createElement('h2');heading.textContent=title;box.append(eyebrow,heading);
  const note=document.createElement('p');note.textContent=!data?'Reading saved submissions.':!data.available?'Use Refresh to retry. Missing evidence is not zero check-ins.':'This inbox shows this week’s submissions and all outstanding reviews. Reviewed check-ins stay in All clients → open client → Check-ins. Dates below use Irish time.';box.append(note);if(data?.available){const imported=rows.filter(r=>!r.reviewed_at&&r.source_system&&!/^client_weekly_v[23]$/.test(r.source_system)).length;if(imported){const history=document.createElement('p');history.textContent=imported+' imported check-ins also have no recorded review. Their original submission times are unverified.';box.append(history);}}
  if(data?.available&&data.statuses){const totals=document.createElement('div');totals.className='home-checkin-totals';totals.setAttribute('aria-label','Current week check-in status');for(const [label,caption] of [['Submitted','Awaiting review this week'],['Reviewed','Reviewed this week'],['Overdue','Overdue this week'],['Due','Still due this week']]){const item=document.createElement('div'),number=document.createElement('strong'),text=document.createElement('span');number.textContent=data.statuses.filter(r=>r.label===label).length;text.textContent=caption;item.append(number,text);totals.append(item);}box.append(totals);const unset=data.statuses.filter(r=>['Deadline not configured','Timezone needs setup'].includes(r.label)).length;if(unset){const warning=document.createElement('p');warning.textContent=unset+' client deadlines need setup. They are not counted as overdue.';box.append(warning);}}
  const older=document.createElement('details');older.className='home-checkin-older';const summary=document.createElement('summary');summary.textContent='More submissions ('+Math.max(0,rows.length-5)+')';older.append(summary);
  for(const [index,row] of rows.entries()){ const article=document.createElement('article'),client=state.clients.find(c=>c.id===row.client_id),name=document.createElement('strong'),stamp=document.createElement('small'),badge=document.createElement('span'),button=document.createElement('button');article.className='home-checkin-row';name.textContent=client.display_name;stamp.textContent=(row.source_system&&!/^client_weekly_v[23]$/.test(row.source_system)?'Imported time unverified · ':'Submitted ')+window.CheckinStatus.stamp(row.submitted_at,'Europe/Dublin')+(row.period_start?' · Week '+row.period_start:'');badge.className='home-checkin-badge';badge.textContent=row.reviewed_at?'Reviewed':'NEW · Awaiting your review';button.className='btn ghost small';button.type='button';button.textContent=row.reviewed_at?'View check-in':'Review check-in';button.dataset.homeCheckinClient=row.client_id;button.dataset.checkinId=row.id;button.onclick=async()=>{if(!eligible()||state.user?.id!==user||!button.isConnected)return;state.client=client;state.clientTab='check-ins';try{if(await loadClientData(client.id)===false)return;if(state.role==='coach'&&state.user?.id===user&&state.client?.id===client.id){renderCoach();const form=Array.from(document.querySelectorAll('[data-coach-review]')).find(f=>f.dataset.coachReview===row.id);if(form){const details=form.closest('details');if(details)details.open=true;form.scrollIntoView?.({block:'center'});}}}catch(e){if(state.user?.id===user)toast(e.message,'error');}};const text=document.createElement('div');text.append(name,stamp,badge);article.append(text,button);(index<5?box:older).append(article);}
  if(rows.length>5)box.append(older);
  // Only an explicit tap reads matched call metadata. It never marks the check-in reviewed.
  box.querySelectorAll('[data-home-checkin-client]').forEach(review=>{
   const row=rows.find(r=>r.client_id===review.dataset.homeCheckinClient&&r.id===review.dataset.checkinId);
   if(!row||row.reviewed_at||row.source_system&&!/^client_weekly_v[23]$/.test(row.source_system))return;
   const article=review.closest('article'),button=document.createElement('button'),note=document.createElement('p');button.type='button';button.className='text-btn';button.textContent='Check whether a later call covered this';note.className='home-call-coverage';note.setAttribute('role','status');article.append(button,note);
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
  if(data?.available&&!rows.length){const empty=document.createElement('p');empty.textContent='No current-week submissions or outstanding reviews found in the loaded records. Open Check-ins for history.';box.append(empty);}
  const actions=(data?.actions||[]).filter(r=>state.clients?.some(c=>c.id===r.client_id&&c.portal_enabled!==false));
  if(actions.length){const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent='Other actions needing you';section.className='home-next-actions';section.append(heading);
   for(const item of actions){const c=state.clients.find(c=>c.id===item.client_id),row=document.createElement('article'),text=document.createElement('p'),button=document.createElement('button');text.textContent=c.display_name+' · '+item.notes.join(' · ');button.type='button';button.className='btn ghost small';button.textContent='Open client';button.onclick=async()=>{if(!eligible()||state.user?.id!==user||!button.isConnected)return;state.client=c;state.clientTab='overview';try{if(await loadClientData(c.id)===false)return;if(state.role==='coach'&&state.user?.id===user&&state.client?.id===c.id)renderCoach();}catch(e){if(state.user?.id===user)toast(e.message,'error');}};row.append(text,button);section.append(row);}box.append(section);
  }
  if(data?.checked_at){const checked=document.createElement('small');checked.textContent='Checked '+window.CheckinStatus.stamp(data.checked_at,'Europe/Dublin');box.append(checked);}
  const refresh=document.createElement('button');refresh.type='button';refresh.className='btn ghost small';refresh.textContent='Refresh check-ins';refresh.dataset.homeCheckinRefresh='';refresh.onclick=()=>{if(!eligible()||state.user?.id!==user||!refresh.isConnected)return;const retry=attention?.querySelector('.panel-head button');if(retry&&!retry.disabled){refresh.disabled=true;refresh.textContent='Checking…';retry.click();}else if(!retry){window.LegalEdgePriorities?.refreshAttention?.();}};box.append(refresh);
  const alerts=document.createElement('button');alerts.type='button';alerts.className='btn ghost small';alerts.textContent='Set up phone alerts';alerts.onclick=()=>{if(eligible()&&state.user?.id===user&&alerts.isConnected)document.getElementById('csPhoneAlerts')?.click();};box.append(alerts);
 }
 function dataAvailable(panel){try{const data=JSON.parse(panel.dataset.homeCheckins);return data.available&&data.pending_available!==false;}catch{return false;}}
 function arrange(){
  scheduled=false;if(!eligible())return;const host=$('#coachMain');if(!host)return;
  let shell=host.querySelector('#coachHomeFocus');
  if(!shell){
   shell=document.createElement('div');shell.id='coachHomeFocus';
   shell.innerHTML='<header class="home-focus-heading"><span class="eyebrow">YOUR COACHING DESK</span><h1>What needs you today?</h1><p>Check-ins, call context and client plan gaps. Start with the actions below.</p><div><button type="button" class="btn primary" data-home-route="reviews">Review check-ins</button><button type="button" class="btn ghost" data-home-route="clients">All clients</button></div></header><div data-home-primary></div><div class="home-focus-tools">'+sections.map(([key,title,sub])=>'<details data-home-group="'+key+'"><summary><span><strong>'+title+'</strong><small>'+sub+'</small></span><span aria-hidden="true">+</span></summary><div data-home-content="'+key+'"></div></details>').join('')+'</div>';
   if(!state.preview)shell.querySelector('.home-focus-heading > div').insertAdjacentHTML('beforeend','<button type="button" class="btn ghost cr-hub-entry" data-home-route="roadmaps" data-cr-hub>Goals & long-term plans</button>');
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
  // Move, never reconstruct, original tools: their handlers, receipts and retry states survive.
  Array.from(host.children).filter(node=>node!==shell&&node.id!=='priorityAttention'&&node.id!=='coachCompletionFeed'&&node.id!=='coachHealthReportInbox').forEach(node=>{shell.querySelector('[data-home-content="'+groupFor(node)+'"]').append(node);});
  const reports=host.querySelector('#coachHealthReportInbox'),primary=shell.querySelector('[data-home-primary]');if(reports&&reports.parentElement!==primary)primary.prepend(reports);
  const feed=host.querySelector('#coachCompletionFeed');if(feed&&feed.parentElement!==shell.querySelector('[data-home-primary]'))shell.querySelector('[data-home-primary]').append(feed);
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
