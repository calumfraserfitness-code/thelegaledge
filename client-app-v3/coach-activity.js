/* Auth event metadata is distinct from page opens and imported history. */
(function(){
 'use strict';let generation=0;
 function stamp(v){if(!v)return 'No record';const d=new Date(v);return Number.isFinite(+d)?new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'Unavailable';}
 function eligible(){return state.role==='coach'&&!state.client&&['dashboard','clients'].includes(state.coachView);}
 function mount(){
  if(!eligible())return;const host=$('#coachMain');if(!host)return;
  host.querySelector('#coachActivity')?.remove();const panel=document.createElement('section');panel.id='coachActivity';panel.className='panel activity-panel';
  panel.innerHTML='<div class="panel-head"><div><span class="eyebrow">CLIENT ACTIVITY</span><h2>Who is using the app?</h2></div><button class="btn ghost small" type="button" data-activity-refresh>Refresh</button></div><p>Irish time · counts cover the last 7 days. Sign-in is not a page-open tracker; saved sessions can reopen without signing in. Legacy-labelled imports are excluded. Saved activity does not identify who entered it.</p><div data-activity-status role="status">Loading activity…</div>';
  host.prepend(panel);const user=state.user?.id,view=state.coachView;
  async function load(){const token=++generation;const active=()=>token===generation&&eligible()&&state.user?.id===user&&state.coachView===view&&panel.isConnected;
   const status=panel.querySelector('[data-activity-status]'),button=panel.querySelector('button');button.disabled=true;status.textContent='Loading activity…';
   try{if(state.preview){status.textContent='Sign in as coach to see real client activity.';return;}
    const rows=await query('Client activity',db.rpc('coach_client_activity'));if(!active())return;
    const clients=state.clients.filter(c=>['active','ending'].includes(c.status)&&c.portal_enabled&&!/(demo|test)/i.test(c.display_name||''));
    status.innerHTML='<div class="activity-scroll"><table><thead><tr><th>Client</th><th>Last sign-in</th><th>Workout saved</th><th>Check-in submitted</th><th>Food saved</th></tr></thead><tbody>'+clients.map(c=>{const r=rows.find(x=>x.client_id===c.id);return '<tr><th scope="row"><button type="button" class="text-btn" data-activity-client="'+esc(c.id)+'">'+esc(c.display_name)+'</button></th>'+(!r?'<td colspan="4">Activity unavailable</td>':['last_sign_in_at','last_workout_at','last_checkin_at','last_food_at'].map((key,i)=>'<td>'+esc(stamp(r[key]))+(i?'<small>'+Number(r[['','sets_7d','checkins_7d','food_7d'][i]]||0)+' '+['','sets','check-ins','food logs'][i]+' / 7 days</small>':'')+'</td>').join(''))+'</tr>';}).join('')+'</tbody></table></div><small>Refreshed '+esc(stamp(new Date().toISOString()))+' · Refresh to check again.</small>';
    status.querySelectorAll('tbody tr').forEach(tr=>tr.querySelectorAll('td').forEach((td,i)=>{td.dataset.activityLabel=['Last sign-in','Workout saved','Check-in submitted','Food saved'][i];}));
    status.querySelectorAll('[data-activity-client]').forEach(b=>{b.dataset.clientId=b.dataset.activityClient;});bindClientRows();
   }catch(e){if(active())status.textContent='Activity could not load. Use Refresh to retry; missing evidence is not zero activity.';}finally{if(active())button.disabled=false;}
  }
  panel.querySelector('button').onclick=load;load();
 }
 const before=renderCoach;renderCoach=function(){const result=before();if(result?.then)return Promise.resolve(result).then(v=>{mount();return v;});mount();return result;};
})();
