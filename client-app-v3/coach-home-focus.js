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
  const user=state.user?.id,rows=data?.available?(data.rows||[]).filter(r=>state.clients?.some(c=>c.id===r.client_id)).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at))):[],pending=rows.filter(r=>!r.reviewed_at).length;
  const signature=JSON.stringify({user,data,rows});if(box.dataset.signature===signature)return;box.dataset.signature=signature;
  const title=!data?'Checking check-ins…':!data.available?'Check-in status unavailable':pending+' check-in'+(pending===1?'':'s')+' ready for review';
  box.replaceChildren();const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='THIS WEEK · CLIENT CHECK-INS';const heading=document.createElement('h2');heading.textContent=title;box.append(eyebrow,heading);
  const note=document.createElement('p');note.textContent=!data?'Reading saved submissions.':!data.available?'Use Refresh in Needs attention. Missing evidence is not zero check-ins.':'Submission times below are Irish time. Each client’s week follows their saved timezone.';box.append(note);
  for(const row of rows){const article=document.createElement('article'),client=state.clients.find(c=>c.id===row.client_id),name=document.createElement('strong'),stamp=document.createElement('small'),badge=document.createElement('span'),button=document.createElement('button');article.className='home-checkin-row';name.textContent=client.display_name;stamp.textContent='Submitted '+window.CheckinStatus.stamp(row.submitted_at,'Europe/Dublin');badge.className='home-checkin-badge';badge.textContent=row.reviewed_at?'Reviewed':'NEW · Awaiting your review';button.className='btn ghost small';button.type='button';button.textContent=row.reviewed_at?'View check-in':'Review check-in';button.dataset.clientId=row.client_id;button.onclick=async()=>{if(!eligible()||state.user?.id!==user||!button.isConnected)return;state.client=client;state.clientTab='check-ins';try{await loadClientData(client.id);if(state.user?.id===user&&state.client?.id===client.id)renderCoach();}catch(e){if(state.user?.id===user)toast(e.message,'error');}};const text=document.createElement('div');text.append(name,stamp,badge);article.append(text,button);box.append(article);}
  if(data?.available&&!rows.length){const empty=document.createElement('p');empty.textContent='No saved submission found for the current client weeks. Open Check-ins to see older records.';box.append(empty);}
  if(data?.checked_at){const checked=document.createElement('small');checked.textContent='Checked '+window.CheckinStatus.stamp(data.checked_at,'Europe/Dublin');box.append(checked);}
  const alerts=document.createElement('button');alerts.type='button';alerts.className='btn ghost small';alerts.textContent='Set up phone alerts';alerts.onclick=()=>{if(eligible()&&state.user?.id===user&&alerts.isConnected)document.getElementById('csPhoneAlerts')?.click();};box.append(alerts);
 }
 function arrange(){
  scheduled=false;if(!eligible())return;const host=$('#coachMain');if(!host)return;
  let shell=host.querySelector('#coachHomeFocus');
  if(!shell){
   shell=document.createElement('div');shell.id='coachHomeFocus';
   shell.innerHTML='<header class="home-focus-heading"><span class="eyebrow">YOUR COACHING DESK</span><h1>What needs you today?</h1><p>Review check-ins first. Everything else is below when you need it.</p><div><button type="button" class="btn primary" data-home-route="reviews">Review check-ins</button><button type="button" class="btn ghost" data-home-route="clients">All clients</button></div></header><div data-home-primary></div><div class="home-focus-tools">'+sections.map(([key,title,sub])=>'<details data-home-group="'+key+'"><summary><span><strong>'+title+'</strong><small>'+sub+'</small></span><span aria-hidden="true">+</span></summary><div data-home-content="'+key+'"></div></details>').join('')+'</div>';
   host.prepend(shell);const user=state.user?.id;
   shell.querySelectorAll('[data-home-route]').forEach(button=>button.onclick=()=>{if(!button.isConnected||!eligible()||state.user?.id!==user)return;state.coachView=button.dataset.homeRoute;renderCoach();});
  }
  const attention=host.querySelector('#priorityAttention');
  checkinInbox(shell,attention);
  if(attention&&attention.parentElement!==shell.querySelector('[data-home-primary]'))shell.querySelector('[data-home-primary]').append(attention);
  if(attention){
   const status=attention.querySelector('[data-priority-status]');
   if(status){
    const rows=Array.from(status.querySelectorAll(':scope > .priority-issue'));
    const setup=rows.filter(row=>{const id=row.querySelector('[data-priority-client]')?.dataset.priorityClient;return state.clients?.find(c=>c.id===id)?.portal_enabled===false;});
    if(setup.length){let disclosure=status.querySelector('[data-home-pending-setup]');if(!disclosure){disclosure=document.createElement('details');disclosure.dataset.homePendingSetup='';disclosure.innerHTML='<summary>Client setups not yet enabled</summary>';const footer=status.querySelector(':scope > small');if(footer)footer.before(disclosure);else status.append(disclosure);}setup.forEach(row=>disclosure.append(row));}
    const review=rows.filter(row=>!setup.includes(row)&&row.textContent.includes('Check-in ready to review'));
    review.forEach(row=>{row.hidden=!!attention.dataset.homeCheckins;});
    const first=Array.from(status.querySelectorAll(':scope > .priority-issue')).find(row=>!review.includes(row));review.forEach(row=>{if(first&&Array.from(status.children).indexOf(row)>Array.from(status.children).indexOf(first))first.before(row);});
   }
  }
  // Move, never reconstruct, original tools: their handlers, receipts and retry states survive.
  Array.from(host.children).filter(node=>node!==shell&&node.id!=='priorityAttention').forEach(node=>{shell.querySelector('[data-home-content="'+groupFor(node)+'"]').append(node);});
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
