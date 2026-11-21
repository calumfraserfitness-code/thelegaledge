/* A private, saved week focus with published coach alternatives and recoverable workout swaps. */
(function(){
 'use strict';
 const M=window.BusyWeekModel,defaults={work_hours:40,sleep_hours:7,training_windows:3,session_minutes:45,energy:4,recovery:4,health:'none',travel:false,location:'gym',meal_access:'prepared'};
 let cache={key:'',loaded:false,record:null,settings:null,swaps:[],error:'',request:null};
 const week=()=>{const d=new Date(localCoachingDate()+'T12:00:00Z'),n=d.getUTCDay();d.setUTCDate(d.getUTCDate()-(n===0?6:n-1));return d.toISOString().slice(0,10);};
 const key=()=>[state.user?.id,state.client?.id,week(),state.preview].join('|');
 function own(){if(cache.key!==key())cache={key:key(),loaded:false,record:null,settings:null,swaps:[],error:'',request:null};return cache;}
 function sessions(){const w=state.data.weeks.find(w=>w.week_start===week()&&(w.published||state.preview));return (state.data.sessions||[]).filter(s=>s.week_id===w?.id);}
 function model(v=own().record||defaults){return M.focus(v,own().settings,sessions());}
 async function load(){const c=own();if(c.loaded)return;if(c.request)return c.request;const client=state.client?.id;if(!client)return;
  c.request=(async()=>{try{if(state.preview){c.loaded=true;return;}const values=await Promise.all([
   query('Busy week',db.from('client_busy_weeks').select('*').eq('client_id',client).eq('week_start',week())),
   query('Busy week options',db.from('client_busy_week_settings').select('*').eq('client_id',client)),
   query('Workout alternatives',db.from('busy_week_session_swaps').select('*').eq('client_id',client))]);
   if(c.key!==key())return;[c.record,c.settings,c.swaps]=[values[0][0]||null,values[1][0]||null,values[2]];c.loaded=true;c.error='';
  }catch(e){if(c.key===key())c.error=e.message;}finally{c.request=null;}})();return c.request;
 }
 function go(view){state.clientView=view;renderClient();}
 function summary(v){const m=model(v),cfg=own().settings?.published?own().settings:null;
  const note=m.mode==='heavy'?cfg?.heavy_notes:m.mode==='crisis'?cfg?.crisis_notes:null;
  return `<div class="bw-recommendation" data-bw-mode="${m.mode}"><span class="eyebrow">${own().record?'WEEK FOCUS':'YOUR RECOMMENDATION'}</span><h3>${esc(m.label)}${m.travel?' · Travel':''}</h3><p>${m.reasons.map(esc).join(' · ')}</p><div class="bw-mode-rail">${['normal','heavy','crisis'].map(mode=>`<span class="${m.mode===mode?'active':''}">${esc(M.labels[mode])}</span>`).join('')}</div>${m.mode==='review'?'<p>Flagged for your coach. Pause the affected training and ask for a reviewed plan before progressing.</p>':`<p>${sessions().filter(s=>['weights','resistance','cardio'].includes(s.training_type)).length} assigned workouts → <b>${m.cap} priority ${m.cap===1?'workout':'workouts'}</b> this week · ${m.done} already completed.</p><p>${m.mode==='normal'?'Follow your regular assigned sessions.':m.mode==='heavy'?'Protect the priority workouts and make the rest optional.':'Keep the smallest realistic commitment. Extra sessions are optional; do not cram them in.'}</p>`}${note?`<p><b>Coach guidance:</b> ${esc(note)}</p>`:''}${m.short.length?'<p class="bw-review">Your available time is shorter than a priority workout. Ask your coach for a shorter prescription; the app keeps your assigned sets and rest.</p>':''}</div>`;
 }
 function guideSessions(selectedWeek){
  if(!selectedWeek||!selectedWeek.published&&!state.preview)return [];
  return (state.data.sessions||[]).filter(s=>s.week_id===selectedWeek.id&&(!s.client_id||s.client_id===state.client.id)&&
   ['weights','resistance','cardio'].includes(s.training_type)&&['planned','completed'].includes(s.status));
 }
 function guide(selectedWeek,settings){
  const workouts=guideSessions(selectedWeek),pending=workouts.filter(s=>s.status==='planned');
  const plan=settings?.published?settings:null;
  const preferred=[plan?.heavy_day_a,plan?.heavy_day_b].filter(Boolean);
  const priority=s=>s.source_metadata?.optional===true?3:preferred.includes(s.programme_day_id)?0:s.training_type==='cardio'?2:1;
  pending.sort((a,b)=>priority(a)-priority(b)||(a.sort_order||0)-(b.sort_order||0)||String(a.session_date).localeCompare(String(b.session_date)));
  const done=workouts.length-pending.length;
  const choice=(drop,cap)=>{
   const length=Math.min(Math.max(0,pending.length-drop),Number.isInteger(cap)?Math.max(0,cap-done):pending.length);
   return pending.slice(0,length);
  };
  const foodNote=(state.data.coachingGuidance||[]).filter(g=>g.client_id===state.client.id&&g.published&&g.category==='eating_out'&&g.body?.trim())
   .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0];
  const menuIds=new Set((state.data.nutritionDays||[]).filter(day=>day.week_id===selectedWeek.id).map(day=>day.nutrition_plan_id));
  const quickMenu=(state.data.nutritionPlans||[]).find(menu=>menuIds.has(menu.id)&&menu.is_active!==false&&
   (!menu.client_id||menu.client_id===state.client.id)&&(menu.day_type==='Busy Day'||/\b(?:busy|deadline) day\b/i.test(menu.name||'')));
  const meal=quickMenu&&typeof mealsForNutritionPlan==='function'?mealsForNutritionPlan(quickMenu).find(item=>item.name&&/lunch|dinner|main meal/i.test(item.meal_type||'')):null;
  return {pending,busy:choice(1,plan?.heavy_sessions),packed:choice(2,plan?.crisis_sessions),
   busyNote:plan?.heavy_notes?.trim(),packedNote:plan?.crisis_notes?.trim(),
   food:plan?.office_food?.trim()||foodNote?.body?.trim()||(meal?'Start with '+meal.name+' from your assigned busy-day meals. Decide when you’ll prep or pack it.':'Pick an easy meal from your plan and decide ahead of time what you’ll prep, pack or order.')};
 }
 function mount(){
  if(typeof document==='undefined'||!['training','planner'].includes(state.clientView))return;
  const host=$('#clientMain');
  if(!host||!state.client||!state.preview&&(state.client.onboarding_status!=='complete'||state.client.plan_status!=='published'))return;
  const selectedWeek=typeof clientTrainingWeek==='function'?clientTrainingWeek():state.data.weeks.find(w=>w.week_start===week());
  if(!guideSessions(selectedWeek).length)return;
  host.querySelector('#bwOptional')?.remove();
  const box=document.createElement('details');box.className='panel bw-simple';box.id='bwOptional';box.open=Boolean(state.openBusyWeekGuide);
  state.openBusyWeekGuide=false;
  const c=own(),route=state.clientView,active=()=>box.isConnected&&c.key===key()&&state.clientView===route;
  function paint(){
   const prompt=guide(selectedWeek,c.settings);
   const review=c.record?.mode==='review'&&c.record.week_start===selectedWeek.week_start;
   const names=items=>items.map(s=>esc(s.title)).join(' · ');
   const row=(title,items,note)=>'<div><h3>'+title+'</h3><p>'+(items.length?'Prioritise <strong>'+names(items)+'</strong>.':'Let the remaining sessions go for this week.')+'</p>'+
    (items.length&&note?'<details><summary>Coach’s workout advice</summary><p class="cw-lines">'+esc(note)+'</p></details>':'')+'</div>';
   const reduction=items=>prompt.pending.length-items.length;
   const dropLabel=items=>'Drop '+reduction(items)+' '+(reduction(items)===1?'session':'sessions');
   const training=review?'<p>Pause any affected training. Ask Calum to review your plan before picking it back up.</p>':
    prompt.pending.length>1?'<div class="bw-simple-choices">'+row('Short on time? '+dropLabel(prompt.busy),prompt.busy,prompt.busyNote)+
     (prompt.packed.length<prompt.busy.length?row('Week gone sideways? '+dropLabel(prompt.packed),prompt.packed,prompt.packedNote):'')+'</div>':
    prompt.pending.length===1?'<p>If you have a realistic window, keep <strong>'+names(prompt.pending)+'</strong>. If not, let it go for this week.</p>':'<p>Your scheduled sessions are complete.</p>';
   const swap=c.swaps.find(s=>s.session_id===state.selectedSessionId);
   const canRestore=route==='training'&&swap&&state.data.sessions.some(s=>s.id===swap.session_id&&s.status!=='completed');
   box.innerHTML='<summary>Busy week? Here’s what to keep</summary><div id="bwClient">'+training+
    (prompt.pending.length&&!review?'<p>Pick days that fit. Leave the rest and get back to your usual plan next week.</p>':'')+
    '<h3>Keep meals simple</h3><p class="cw-lines">'+esc(prompt.food)+'</p><button type="button" class="btn ghost small" data-bw-meals>Open my meal plan</button>'+
    (canRestore?'<button type="button" class="btn ghost small" data-bw-restore>Restore original workout</button>':'')+'</div>';
   box.querySelector('[data-bw-meals]').onclick=()=>{if(active())go('nutrition');};
   box.querySelector('[data-bw-restore]')?.addEventListener('click',async e=>{
    const button=e.currentTarget;if(!active()||state.preview||button.disabled)return;
    const session=state.data.sessions.find(s=>s.id===swap.session_id);setBusy(button,true);
    try{
     const saved=await query('Restore workout',db.rpc('use_busy_week_workout',{p_session:session.id,p_location:'original'}));
     if(!active())return;if(saved?.id!==session.id)throw Error('Workout change was not confirmed.');
     Object.assign(session,saved);c.swaps=c.swaps.filter(s=>s.session_id!==session.id);renderClient();toast('Original workout restored');
    }catch(error){if(active())toast(error.message,'error');}finally{setBusy(button,false);}
   });
  }
  const anchor=host.querySelector('.training-category-tabs,.client-page-head');
  if(anchor)anchor.after(box);else host.prepend(box);
  paint();
  if(!c.loaded&&!c.error)load().then(()=>{if(active()&&c.loaded)paint();});
 }
 function coachCard(){const c=own();if(!c.loaded)return `<section class="panel bw-system" id="bwCoach"><h2>Busy Week System</h2><p>${esc(c.error||'Loading the client’s saved week…')}</p>${c.error?'<button class="btn ghost" data-bw-coach-retry>Retry</button>':''}</section>`;
  const cfg=c.settings||{},days=state.data.programs.flatMap(p=>(p.days||[]).filter(d=>['weights','resistance','cardio'].includes(d.training_type)&&d.exercises?.length).map(d=>({...d,program:p.title||p.name||'Assigned programme'})));
  const options=(id)=>'<option value="">Not assigned yet</option>'+days.map(d=>`<option value="${esc(d.id)}" ${id===d.id?'selected':''}>${esc(d.program+' · '+d.title)}</option>`).join('');
  return `<section class="panel bw-system" id="bwCoach"><span class="eyebrow">PRIVATE CLIENT ADAPTATION</span><h2>Busy Week System</h2>${c.record?summary(c.record)+`<p>Saved ${esc(fmt(c.record.updated_at))} · ${c.record.work_hours} work hours · ${c.record.sleep_hours}h sleep · ${c.record.session_minutes}min windows · ${esc(c.record.location)} · ${esc(c.record.meal_access)} meals</p>`:'<p>No saved busy-week setup for the current week.</p>'}<p>${cfg.home_day_id?'Home alternative assigned.':'Home alternative needs assignment.'} ${cfg.hotel_day_id?'Hotel alternative assigned.':'Hotel alternative needs assignment.'}</p><details><summary>Coach options for demanding weeks</summary><form id="bwCoachForm"><div class="bw-fields"><label>Heavy week · priority sessions<input type="number" name="heavy_sessions" min="0" max="7" value="${cfg.heavy_sessions??2}" required></label><label>Crisis minimum · priority sessions<input type="number" name="crisis_sessions" min="0" max="7" value="${cfg.crisis_sessions??1}" required></label><label>Home alternative<select name="home_day_id">${options(cfg.home_day_id)}</select></label><label>Hotel alternative<select name="hotel_day_id">${options(cfg.hotel_day_id)}</select></label><label>Heavy week · Full body A<select name="heavy_day_a">${options(cfg.heavy_day_a)}</select></label><label>Heavy week · Full body B<select name="heavy_day_b">${options(cfg.heavy_day_b)}</select></label>${[['heavy_notes','Heavy week instructions'],['crisis_notes','Crisis minimum instructions'],['office_food','Office meal options'],['takeaway_food','Takeaway meal options'],['late_food','Late-night food guidance'],['recovery_notes','Recovery adjustments']].map(([n,label])=>`<label>${label}<textarea name="${n}" maxlength="2000" rows="2">${esc(cfg[n]||'')}</textarea></label>`).join('')}<label class="bw-toggle"><input type="checkbox" name="published" ${cfg.published?'checked':''}> Publish these options to this client</label></div><p>Choose alternatives from this client’s assigned programmes. Their usual exercises, sets and food targets stay saved.</p><button class="btn primary">Save coach options</button><p role="status"></p></form></details></section>`;
 }
 function mountCoach(){if(typeof document==='undefined'||!document)return;const host=$('#clientWorkspaceBody');if(!host||!state.client)return;host.querySelector('#bwCoach')?.remove();host.insertAdjacentHTML('afterbegin',coachCard());const c=own(),form=$('#bwCoachForm');$('#bwCoach [data-bw-coach-retry]')?.addEventListener('click',()=>{c.error='';load().then(mountCoach);});
  if(form)form.onsubmit=async e=>{e.preventDefault();if(form.dataset.saving==='true'||c.key!==key())return;const fd=new FormData(form),row={client_id:state.client.id,heavy_sessions:Number(fd.get('heavy_sessions')),crisis_sessions:Number(fd.get('crisis_sessions')),published:fd.has('published')};for(const n of ['heavy_notes','crisis_notes','office_food','takeaway_food','late_food','recovery_notes'])row[n]=String(fd.get(n)||'').trim();for(const n of ['home_day_id','hotel_day_id','heavy_day_a','heavy_day_b'])row[n]=fd.get(n)||null;const status=form.querySelector('[role=status]');if(row.crisis_sessions>row.heavy_sessions){status.textContent='The crisis minimum must not exceed the heavy week.';return;}form.dataset.saving='true';setBusy(e.submitter,true);try{const saved=state.preview?row:(await query('Busy week coach options',db.from('client_busy_week_settings').upsert(row,{onConflict:'client_id'}).select()))[0];if(!saved||Object.entries(row).some(([k,v])=>saved[k]!==v))throw Error('Coach options were not confirmed. Retry.');if(c.key!==key())return;c.settings=saved;toast('Busy week options saved');mountCoach();}catch(err){if(c.key===key())status.textContent=err.message;}finally{delete form.dataset.saving;setBusy(e.submitter,false);}};
  if(!c.loaded&&!c.error)load().then(()=>{if(c.key===key()&&state.role==='coach'&&state.clientTab==='overview')mountCoach();});
 }
 const priorLoad=loadClientData;loadClientData=async function(id){cache={key:'',loaded:false,record:null,settings:null,swaps:[],error:'',request:null};return priorLoad(id);};
 for(const name of ['clientPlanner','clientTraining']){
  const before=window[name];window[name]=function(...args){const result=before(...args);mount();return result;};
 }
 const priorOverview=coachOverview;coachOverview=function(){const r=priorOverview();mountCoach();return r;};
 if(typeof window.renderDashboard==='function'){
  const beforeDashboard=renderDashboard;renderDashboard=function(){const result=beforeDashboard(),host=$('#coachMain'),account=state.user?.id;
   if(state.preview||!host||state.role!=='coach')return result;
   host.querySelector('#bwCoachQueue')?.remove();host.insertAdjacentHTML('afterbegin','<section class="panel bw-system" id="bwCoachQueue"><h2>Busy Week System</h2><p>Loading this week’s client setups…</p></section>');const panel=$('#bwCoachQueue');
   query('Busy week coach queue',db.from('client_busy_weeks').select('client_id,week_start,mode,travel,updated_at').gte('week_start',new Date(Date.now()-8*864e5).toISOString().slice(0,10)).order('updated_at',{ascending:false})).then(rows=>{
    if(typeof document==='undefined'||!document||state.user?.id!==account||state.client||!panel.isConnected)return;
    const active=rows.map(r=>({row:r,client:state.clients.find(c=>c.id===r.client_id&&c.status==='active'&&!c.deleted_at)})).filter(x=>{if(!x.client)return false;try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:x.client.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),d=Object.fromEntries(parts.map(p=>[p.type,p.value])),date=new Date(d.year+'-'+d.month+'-'+d.day+'T12:00:00Z'),n=date.getUTCDay();date.setUTCDate(date.getUTCDate()-(n===0?6:n-1));return x.row.week_start===date.toISOString().slice(0,10);}catch{return false;}}).sort((a,b)=>(a.row.mode==='review'?-1:0)-(b.row.mode==='review'?-1:0));
    panel.innerHTML='<span class="eyebrow">PRIVATE COACH VIEW</span><h2>Busy Week System</h2>'+active.map(({row,client})=>`<button class="bw-workout" data-bw-client="${esc(client.id)}"><span>${esc(client.display_name)} · ${esc(M.labels[row.mode])}${row.travel?' · Travel':''}</span><small>${row.mode==='review'?'Needs your review':'Week focus saved'} · ${esc(fmt(row.updated_at))}</small></button>`).join('')+(active.length?'':'<p>No client setups saved for the current week yet.</p>');
    panel.querySelectorAll('[data-bw-client]').forEach(b=>b.onclick=async()=>{const id=b.dataset.bwClient;state.client=state.clients.find(c=>c.id===id);state.clientTab='overview';try{await loadClientData(id);if(state.client?.id===id&&state.user?.id===account)renderCoach();}catch(e){toast(e.message,'error');}});
   }).catch(e=>{if(typeof document!=='undefined'&&document&&panel.isConnected&&state.user?.id===account)panel.innerHTML='<h2>Busy Week System</h2><p>'+esc(e.message)+'</p><button class="btn ghost" id="bwQueueRetry">Retry</button>';panel.querySelector('#bwQueueRetry')?.addEventListener('click',()=>renderDashboard());});return result;
  };
 }
 window.BusyWeekAccess={week,model,reload:async()=>{own().loaded=false;await load();},mount,mountCoach};
})();
