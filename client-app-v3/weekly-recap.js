/* A dated, coach-approved recap. Private preparation never publishes or sends feedback. */
(function(){
 'use strict';
 const stores=new Map();let account=null;
 const fields='client_id,coach_id,week_start,revision,payload,body,published_at';
 const privateFields='client_id,coach_id,week_start,revision,payload,body,created_at,updated_at';
 const model=()=>window.WeeklyRecapModel;
 const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
 const clone=value=>JSON.parse(JSON.stringify(value));
 function isCoach(){return state.role==='coach'&&!!document.querySelector('#coachApp:not(.hidden) #clientWorkspaceBody');}
 function isClient(){return ['client','coach'].includes(state.role)&&state.clientView==='today'&&!!document.querySelector('#clientApp:not(.hidden) #personalCoachingHome');}
 function key(){return [state.user?.id,state.client?.id,state.role,isCoach()?'coach':'client',String(state.preview)].join('|');}
 function owner(){return {user:state.user?.id,client:state.client?.id,role:state.role,key:key()};}
 function current(value){return state.user?.id===value.user&&state.client?.id===value.client&&state.role===value.role&&key()===value.key;}
 function stateFor(){
  if(account!==state.user?.id){stores.clear();account=state.user?.id;}
  const k=key();if(!stores.has(k))stores.set(k,{publicRows:[],privateRows:[],loaded:false,available:false,loading:false,request:0,readAt:0,selected:null,editors:new Map(),notice:''});
  if(stores.size>16)stores.delete(stores.keys().next().value);return stores.get(k);
 }
 function periodEnd(start){return model().addDays(start,6);}
 function periodLabel(start){return fmt(start)+' – '+fmt(periodEnd(start));}
 function validRow(row,clientId,coachId,privateRow){return row&&row.client_id===clientId&&(privateRow?row.coach_id===coachId:typeof row.coach_id==='string'&&Boolean(row.coach_id))&&dateOnly(row.week_start)&&Number.isInteger(row.revision)&&row.revision>0&&row.payload?.version===1&&row.payload.period_start===row.week_start&&(!privateRow?Boolean(row.published_at):true);}
 function byWeek(rows,start){return rows.find(row=>row.week_start===start);}
 function defaultPeriod(){return model().build(state.client,state.data,{now:new Date(),preview:state.preview}).period_start;}
 function editor(c,start){
  if(!c.editors.has(start)){
   const draft=byWeek(c.privateRows,start),published=byWeek(c.publicRows,start),saved=draft||published;
   c.editors.set(start,{snapshot:saved?clone(saved.payload):null,revision:Math.max(draft?.revision||0,published?.revision||0),dirty:false,busy:false,preparing:false,notice:draft?'Saved privately. The client sees only the last published recap.':published?'The published recap is loaded. Changes stay private until you publish again.':'Prepare the recorded figures, then add the focus you have agreed with this client.'});
  }
  return c.editors.get(start);
 }
 function finite(value){return typeof value==='number'&&Number.isFinite(value);}
 function count(value){return finite(value)&&value>=0?String(Math.round(value)):'—';}
 function weight(value,client,change=false){
  if(!finite(value))return '—';const pounds=client.weight_unit==='lbs',n=value*(pounds?2.20462:1);
  return (change&&n>0?'+':'')+n.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})+' '+(pounds?'lb':'kg');
 }
 function weightMarkup(snapshot,client,coach){
  const w=snapshot.weight;if(!w?.enabled||w.status==='disabled')return '';
  const n=w.current?.count||0,previous=w.previous?.count||0;
  let text=w.status==='trend'?'Average '+weight(w.current.average_kg,client)+' · '+weight(w.change_kg,client,true)+' versus the previous week':n>=3?'Average '+weight(w.current.average_kg,client)+' · '+n+' saved weigh-in days':n?n+' saved weigh-in '+(n===1?'day':'days')+' · more readings are needed for a weekly trend':'No weigh-in recorded for this period';
  const note=w.status==='trend'?n+' reading days this week; '+previous+' in the previous week.':'A weekly trend uses at least 3 separate reading days in each week.';
  return '<div class="wr-weight"><strong>Weight</strong><p>'+esc(text)+'</p><small>'+esc(note)+'</small>'+(coach&&w.conflict_dates?.length?'<p class="wr-warning" role="status">Different weight values were saved on '+esc(w.conflict_dates.join(', '))+'. Check the source records before publishing.</p>':'')+'</div>';
 }
 function figuresMarkup(snapshot,client,coach=false){
  if(!snapshot)return '<p class="muted">No recap figures prepared yet.</p>';
  const r=snapshot.recorded_sessions||{};
  return '<div class="wr-figures"><div><strong>'+esc(count(r.completed))+'</strong><span>recorded completed sessions</span><small>'+esc(count(r.strength))+' strength · '+esc(count(r.cardio))+' cardio'+(r.other?' · '+esc(count(r.other))+' other':'')+'</small></div>'+(r.logged_strength?'<div><strong>'+esc(count(r.logged_strength))+'</strong><span>strength sessions with saved sets</span><small>May overlap completed sessions; not an additional total.</small></div>':'')+(r.cardio_minutes?'<div><strong>'+esc(count(r.cardio_minutes))+' min</strong><span>recorded cardio</span></div>':'')+(r.practice_days?'<div><strong>'+esc(count(r.practice_days))+'</strong><span>days with saved practice</span><small>Practice ticks are separate from sessions.</small></div>':'')+'</div>'+weightMarkup(snapshot,client,coach)+(coach?'<details class="wr-evidence"><summary>Recorded figures & gaps</summary><p>Prepared '+esc(fmt(snapshot.prepared_at))+'. These figures are a saved snapshot.</p><ul>'+(snapshot.gaps||[]).map(g=>'<li>'+esc(g)+'</li>').join('')+'</ul></details>':'');
 }
 function publicationMarkup(row,client,compact=false){
  const p=row.payload;
  return '<div class="wr-publication"><div class="wr-period"><strong>'+esc(periodLabel(row.week_start))+'</strong>'+(p.in_progress?'<span class="pill">Week in progress</span>':'')+'</div>'+figuresMarkup(p,client)+(p.biggest_win?'<div class="wr-copy"><h3>Biggest win</h3><p>'+esc(p.biggest_win)+'</p></div>':'')+'<div class="wr-copy"><h3>One focus for '+esc(fmt(p.next_week_start))+' – '+esc(fmt(p.next_week_end))+'</h3><p>'+esc(p.focus||'No agreed focus is saved in this recap.')+'</p></div>'+(p.coach_note?'<div class="wr-copy"><h3>From Calum</h3><p>'+esc(p.coach_note)+'</p></div>':'')+'<small class="muted">Approved by Calum · '+esc(fmt(row.published_at))+' · based on saved records</small></div>';
 }
 async function read(c,force=false){
  if(state.preview){c.loaded=true;c.available=true;return;}
  if(c.loading||!force&&c.loaded&&Date.now()-c.readAt<30000)return;
  const scope=owner(),clientId=scope.client,coachId=state.client.coach_id,coach=isCoach(),request=++c.request,mutation=c.mutationRevision||0;c.loading=true;
  try{
   const queries=[query('Published weekly recaps',db.from('client_weekly_recaps').select(fields).eq('client_id',clientId).order('week_start',{ascending:false}).limit(26))];
   if(coach)queries.push(query('Private weekly recap drafts',db.from('coach_weekly_recap_drafts').select(privateFields).eq('client_id',clientId).eq('coach_id',scope.user).order('week_start',{ascending:false}).limit(26)));
   const result=await Promise.all(queries);if(!current(scope)||c.request!==request||(c.mutationRevision||0)!==mutation)return;
   if(result.some((rows,i)=>!Array.isArray(rows)||rows.some(row=>!validRow(row,clientId,coachId,i===1))))throw Error('The saved recap could not be verified.');
   c.publicRows=result[0];c.privateRows=coach?result[1]:[];c.loaded=true;c.available=true;c.readAt=Date.now();c.notice='';
   for(const [start,e]of c.editors){const draft=byWeek(c.privateRows,start),published=byWeek(c.publicRows,start),latest=Math.max(draft?.revision||0,published?.revision||0),saved=draft||published;if(!e.dirty&&!e.busy&&!e.preparing){e.snapshot=saved?clone(saved.payload):null;e.revision=latest;e.conflict=false;e.notice=draft?'Saved privately. The client sees only the last published recap.':published?'The published recap is loaded. Changes stay private until you publish again.':'Prepare the recorded figures, then add the focus you have agreed with this client.';}else if(latest!==e.revision&&!e.busy){e.conflict=true;e.notice='This recap changed elsewhere. Your edits are kept; copy them before reloading the saved version.';}}
  }catch(error){if(current(scope)&&c.request===request&&(c.mutationRevision||0)===mutation){c.available=false;c.loaded=true;c.notice=error.message||'Weekly recaps could not load. Retry.';}}
  finally{if(c.request===request)c.loading=false;if(current(scope)&&c.request===request){if(isCoach())syncCoach(c);else clientMount(c);}}
 }
 async function evidence(client,start){
  const M=model(),previous=M.addDays(start,-7),end=M.addDays(start,7),lower=M.addDays(previous,-1),upper=M.addDays(end,1),nextEnd=M.addDays(start,13);
  async function bounded(label,q,limit){const rows=await query(label,q);if(!Array.isArray(rows)||rows.length>=limit)throw Error(label+' could not be read completely. Your current recap is kept.');return rows;}
  const weeks=await bounded('Recap programme weeks',db.from('program_weeks').select('id,client_id,week_start,published').eq('client_id',client.id).eq('published',true).order('week_start',{ascending:false}).limit(201),201);
  if(weeks.some(w=>w.client_id!==client.id))throw Error('Programme ownership could not be verified.');
  const sessionQuery=weeks.length?bounded('Recap recorded sessions',db.from('training_sessions').select('id,week_id,session_date,title,training_type,status,duration_minutes,completed_at,source_system,source_metadata,updated_at').in('week_id',weeks.map(w=>w.id)).limit(2001),2001):Promise.resolve([]);
  const [sessions,progress,checkins,exerciseLogs,focus]=await Promise.all([
   sessionQuery,
   bounded('Recap saved weights',db.from('progress_entries').select('id,client_id,entry_date,weight_kg').eq('client_id',client.id).gte('entry_date',previous).lt('entry_date',end).limit(501),501),
   bounded('Recap saved check-ins',db.from('checkins').select('id,client_id,period_start,submitted_at,weight_kg,wins,original_answers,source_system').eq('client_id',client.id).or('and(period_start.gte.'+previous+',period_start.lte.'+start+'),and(submitted_at.gte.'+lower+'T00:00:00Z,submitted_at.lt.'+upper+'T00:00:00Z)').order('submitted_at',{ascending:false}).limit(251),251),
   bounded('Recap recorded sets',db.from('exercise_set_logs').select('id,client_id,training_session_id,program_exercise_id,performed_at,exercise_name,completed,reps,load,load_unit,duration_seconds').eq('client_id',client.id).gte('performed_at',lower+'T00:00:00Z').lt('performed_at',upper+'T00:00:00Z').limit(1001),1001),
   bounded('Recap agreed next focus',db.from('client_weekly_focus').select('id,client_id,description,starts_on,expires_on,completed_at,archived_at,approved_at').eq('client_id',client.id).is('archived_at',null).not('approved_at','is',null).lte('starts_on',nextEnd).gte('expires_on',end).order('approved_at',{ascending:false}).limit(101),101)
  ]);
  for(const rows of [progress,checkins,exerciseLogs,focus])if(rows.some(r=>r.client_id!==client.id))throw Error('Recap source ownership could not be verified.');
  return {weeks,sessions,progress,checkins,exerciseLogs,focus};
 }
 function selected(c){if(!c.selected)c.selected=defaultPeriod();return c.selected;}
 function setStatus(root,text){const node=root?.querySelector('[data-wr-status]');if(node)node.textContent=text;}
 function syncCoach(c){
  const root=document.querySelector('#coachWeeklyRecap');if(!root)return;const start=selected(c),e=editor(c,start),form=root.querySelector('form');
  if(!form){coachPaint(root,c);return;}
  const available=c.available||state.preview,busy=e.busy||e.preparing||e.reloading;
  const fieldset=form.querySelector('[data-wr-fields]');if(fieldset)fieldset.hidden=!e.snapshot;
  for(const name of ['biggest_win','focus','coach_note'])if(form.elements[name]&&form.elements[name].value!==(e.snapshot?.[name]||''))form.elements[name].value=e.snapshot?.[name]||'';
  const figures=form.querySelector('[data-wr-figures]');if(figures)figures.innerHTML=figuresMarkup(e.snapshot,state.client,true);
  const approved=root.querySelector('[data-wr-approved]'),published=byWeek(c.publicRows,start);if(approved)approved.innerHTML=published?'<details class="wr-approved"><summary>Currently visible to the client</summary>'+publicationMarkup(published,state.client)+'</details>':'<p class="muted">No recap is published for this week.</p>';
  for(const button of form.querySelectorAll('button'))button.disabled=busy||!available||Boolean(e.conflict&&button.matches('[data-wr-save]'));
  // Keep newer typing available during a save; the submitted snapshot is immutable.
  for(const field of form.querySelectorAll('textarea'))field.disabled=!available;
  const week=root.querySelector('[data-wr-week]');if(week)week.disabled=busy;
  const retry=root.querySelector('[data-wr-retry]');if(retry)retry.disabled=c.loading;
  const conflict=root.querySelector('[data-wr-conflict]');if(conflict)conflict.hidden=!e.conflict;const reload=root.querySelector('[data-wr-reload]');if(reload)reload.disabled=busy||c.loading;
  setStatus(root,c.available?e.notice:(c.notice||'Saved recaps could not load. Retry before preparing or publishing.'));
 }
 function coachPaint(root,c){
  const client=state.client,scope=owner(),start=selected(c),e=editor(c,start),weeks=model().weeks(client,{now:new Date(),limit:13});
  const periods=new Map(weeks.map(w=>[w.period_start,w]));for(const r of [...c.publicRows,...c.privateRows])if(!periods.has(r.week_start))periods.set(r.week_start,{period_start:r.week_start,period_end:periodEnd(r.week_start),in_progress:false});
  if(!periods.has(start))periods.set(start,{period_start:start,period_end:periodEnd(start),in_progress:false});
  const published=byWeek(c.publicRows,start),p=e.snapshot;
  root.innerHTML='<span class="eyebrow">WEEKLY RECAP</span><h2>A short review, approved by you.</h2><p>Prepare the recorded figures, add one agreed focus and publish when ready.</p><label class="wr-week">Week<select data-wr-week>'+[...periods.values()].sort((a,b)=>b.period_start.localeCompare(a.period_start)).map(w=>'<option value="'+esc(w.period_start)+'" '+(w.period_start===start?'selected':'')+'>'+esc(periodLabel(w.period_start))+(w.in_progress?' · in progress':'')+'</option>').join('')+'</select></label><p class="muted" data-wr-status role="status"></p><button type="button" class="btn ghost small" data-wr-retry>Refresh saved recaps</button><form class="wr-editor"><div class="wr-prepare"><button type="button" class="btn ghost" data-wr-prepare>'+(p?'Refresh recorded figures':'Prepare recap')+'</button><small>Reads fresh saved records. Your written edits are retained.</small></div><div data-wr-figures>'+figuresMarkup(p,client,true)+'</div><div data-wr-fields '+(!p?'hidden':'')+'><label>Biggest win<textarea name="biggest_win" maxlength="1000" rows="2"></textarea><small>Prefilled from the client’s check-in when available. Keep the wording accurate.</small></label><label>One agreed focus for next week<textarea name="focus" maxlength="1000" rows="2" required></textarea><small>Add the focus you have agreed with this client. Preparing figures does not agree a new target.</small></label><label>Your short note (optional)<textarea name="coach_note" maxlength="2000" rows="3"></textarea></label><div class="wr-actions"><button type="submit" class="btn ghost" formnovalidate data-wr-save="private">Save private draft</button><button type="submit" class="btn primary" data-wr-save="publish">Publish recap</button></div></div></form><div data-wr-approved></div>';
  const form=root.querySelector('form');for(const name of ['biggest_win','focus','coach_note']){const input=form.elements[name];input.value=p?.[name]||'';input.oninput=()=>{if(!current(scope)||!root.isConnected||!e.snapshot)return;e.snapshot[name]=input.value;e.edits=(e.edits||0)+1;e.dirty=true;e.notice='Unsaved private edits · kept while you move between tabs.';setStatus(root,e.notice);};}
  const conflict=document.createElement('div');conflict.dataset.wrConflict='';conflict.className='wr-conflict';conflict.hidden=true;conflict.innerHTML='<p>Your local edits are retained. Copy them before replacing them with the current saved version.</p><div class="wr-actions"><button type="button" class="btn ghost small" data-wr-copy>Copy current text</button><button type="button" class="btn ghost small" data-wr-reload>Reload saved version and replace edits</button></div><label data-wr-manual-copy hidden>Copy this text before reloading<textarea readonly rows="5"></textarea></label>';root.querySelector('[data-wr-status]').after(conflict);
  conflict.querySelector('[data-wr-copy]').onclick=async()=>{if(!current(scope)||!root.isConnected)return;const text=['Biggest win: '+(e.snapshot?.biggest_win||''),'Agreed focus: '+(e.snapshot?.focus||''),'Coach note: '+(e.snapshot?.coach_note||'')].join('\n\n');try{await navigator.clipboard.writeText(text);if(current(scope)&&root.isConnected)setStatus(root,'Current written edits copied. Reload the saved version when ready.');}catch{if(current(scope)&&root.isConnected){const label=conflict.querySelector('[data-wr-manual-copy]'),field=label.querySelector('textarea');label.hidden=false;field.value=text;field.focus();field.select();setStatus(root,'Copy the selected text before reloading the saved version.');}}};
  conflict.querySelector('[data-wr-reload]').onclick=async()=>{if(!current(scope)||!root.isConnected||e.busy||e.preparing||e.reloading||c.loading)return;const edits=e.edits||0;e.reloading=true;syncCoach(c);try{await read(c,true);if(!current(scope)||!root.isConnected||selected(c)!==start||!c.available)return;if((e.edits||0)!==edits){e.notice='Your newer typing was kept. Copy it before choosing Reload saved version again.';return;}const draft=byWeek(c.privateRows,start),publication=byWeek(c.publicRows,start),saved=draft||publication;e.snapshot=saved?clone(saved.payload):null;e.revision=Math.max(draft?.revision||0,publication?.revision||0);e.dirty=false;e.conflict=false;e.notice='Saved version loaded. Your previous local edits have been replaced.';}finally{e.reloading=false;if(current(scope))syncCoach(c);}};
  root.querySelector('[data-wr-week]').onchange=event=>{if(!current(scope)||e.busy||e.preparing||e.reloading)return;c.selected=event.target.value;coachPaint(root,c);};
  root.querySelector('[data-wr-retry]').onclick=()=>{if(current(scope))read(c,true);};
  root.querySelector('[data-wr-prepare]').onclick=()=>prepare(root,c,e,start,scope);
  form.onsubmit=event=>save(event,root,c,e,start,scope);
  syncCoach(c);
 }
 async function prepare(root,c,e,start,scope){
  if(!current(scope)||!root.isConnected||!c.available||e.preparing||e.busy||e.reloading)return;
  e.preparing=true;e.notice='Reading the saved records for this recap…';syncCoach(c);
  try{
   const client={...state.client},data=state.preview?state.data:await evidence(client,start);
   if(!current(scope))return;const snapshot=model().build(client,data,{now:new Date(),periodStart:start,preview:state.preview});
   if(e.snapshot)for(const name of ['biggest_win','focus','coach_note'])snapshot[name]=e.snapshot[name]||'';
   e.snapshot=snapshot;e.dirty=true;e.notice='Recorded figures prepared. Review them and add the agreed next focus; nothing is published.';
   if(root.isConnected&&selected(c)===start)coachPaint(root,c);
  }catch(error){if(current(scope)){e.notice='Not prepared. '+(error.message||'The records could not load. Your current recap is kept.');if(root.isConnected)setStatus(root,e.notice);}}
  finally{e.preparing=false;if(current(scope))syncCoach(c);}
 }
 function body(snapshot,client){
  const r=snapshot.recorded_sessions||{},parts=['Weekly recap · '+periodLabel(snapshot.period_start),count(r.completed)+' recorded completed sessions ('+count(r.strength)+' strength, '+count(r.cardio)+' cardio).'];
  if(r.practice_days)parts.push(count(r.practice_days)+' days with saved practice.');
  if(snapshot.weight?.status==='trend')parts.push('Average weight '+weight(snapshot.weight.current.average_kg,client)+'; '+weight(snapshot.weight.change_kg,client,true)+' versus the previous week.');
  if(snapshot.biggest_win)parts.push('Biggest win: '+snapshot.biggest_win);parts.push('Agreed focus for '+fmt(snapshot.next_week_start)+' – '+fmt(snapshot.next_week_end)+': '+snapshot.focus);if(snapshot.coach_note)parts.push(snapshot.coach_note);return parts.join('\n\n');
 }
 async function save(event,root,c,e,start,scope){
  event.preventDefault();if(!current(scope)||!root.isConnected||!c.available||e.busy||e.preparing||e.reloading||!e.snapshot)return;
  const publish=event.submitter?.dataset.wrSave==='publish',snapshot=clone(e.snapshot),fingerprint=JSON.stringify(snapshot),client={...state.client};
  if(publish&&!String(snapshot.focus||'').trim()){e.notice='Add the focus you have agreed with this client before publishing.';setStatus(root,e.notice);return;}
  e.busy=true;e.notice=publish?'Publishing the approved recap…':'Saving the private recap…';syncCoach(c);
  try{
   let result;if(state.preview){const row={client_id:client.id,coach_id:scope.user,week_start:start,revision:e.revision+1,payload:snapshot,body:body(snapshot,client),published_at:new Date().toISOString()};result=publish?{draft:null,publication:row}:{draft:{...row,published_at:undefined},publication:byWeek(c.publicRows,start)||null};}
   else result=await query('Save weekly recap',db.rpc('save_weekly_recap',{p_client:client.id,p_week_start:start,p_snapshot:snapshot,p_body:body(snapshot,client),p_expected_version:e.revision,p_publish:publish}));
   if(!current(scope))return;const draft=result?.draft,publication=result?.publication;
   if(draft&&!validRow(draft,client.id,scope.user,true)||publication&&!validRow(publication,client.id,scope.user,false)||publish&&(!publication||publication.coach_id!==scope.user)||!publish&&!draft)throw Error('The recap save was not confirmed. Your edits are still here.');
   c.mutationRevision=(c.mutationRevision||0)+1;
   c.privateRows=c.privateRows.filter(r=>r.week_start!==start);if(draft)c.privateRows.push(draft);
   if(publication){c.publicRows=c.publicRows.filter(r=>r.week_start!==start);c.publicRows.push(publication);}
   e.revision=Math.max(draft?.revision||0,publication?.revision||0);e.dirty=JSON.stringify(e.snapshot)!==fingerprint;e.conflict=false;
   e.notice=(publish?'Published to the client’s Home.':'Private draft saved. The published recap is unchanged.')+(e.dirty?' Your newer edits are still here and remain unsaved.':'');
   if(root.isConnected)setStatus(root,e.notice);c.readAt=Date.now();
  }catch(error){if(current(scope)){e.notice='Not saved. '+(error.message||'Your current edits are kept; retry.');if(/changed|conflict|version/i.test(error.message||''))e.conflict=true;if(root.isConnected)setStatus(root,e.notice);}}
  finally{e.busy=false;if(current(scope))syncCoach(c);}
 }
 function coachMount(c){
  const host=document.querySelector('#coachApp:not(.hidden) #clientWorkspaceBody');if(!host||!['overview','check-ins'].includes(state.clientTab))return;
  let box=host.querySelector('#coachWeeklyRecap');if(!box){const details=document.createElement('details');details.className='panel wr-coach';details.innerHTML='<summary>Weekly recap <small>Prepare, review and publish</small></summary><div id="coachWeeklyRecap"></div>';const brief=host.querySelector('#coachReviewBrief');if(brief)brief.after(details);else host.append(details);box=details.querySelector('#coachWeeklyRecap');coachPaint(box,c);}
  else syncCoach(c);
 }
 function clientMount(c){
  const home=document.querySelector('#clientApp:not(.hidden) #personalCoachingHome');if(!home||!isClient())return;let box=home.querySelector('#clientWeeklyRecap');
  if(!box){box=document.createElement('section');box.id='clientWeeklyRecap';box.className='panel wr-client';const secondary=home.querySelector('[data-pch-secondary]');if(secondary)secondary.before(box);else home.append(box);}
  const rows=c.publicRows.filter(r=>validRow(r,state.client.id,state.client.coach_id,false)).sort((a,b)=>b.week_start.localeCompare(a.week_start));
  const signature=JSON.stringify([rows,c.available,c.loaded,c.notice]);if(box.dataset.signature===signature)return;box.dataset.signature=signature;
  if(!rows.length){if(c.loaded&&c.available){box.remove();return;}box.innerHTML='<span class="eyebrow">YOUR WEEKLY RECAP</span><p role="status">'+esc(c.loaded?'Your saved recap could not load. Try again.':'Reading your approved recap…')+'</p>'+(c.loaded?'<button type="button" class="btn ghost small" data-wr-client-retry>Retry recap</button>':'');}
  else box.innerHTML='<span class="eyebrow">YOUR WEEKLY RECAP</span><h2>Your week, made clear.</h2>'+(!c.available?'<p class="muted" role="status">Your recap could not refresh. Your previous approved recap is shown.</p>':'')+publicationMarkup(rows[0],state.client,true)+(rows.length>1?'<details class="wr-history"><summary>Earlier weekly recaps</summary>'+rows.slice(1,13).map(row=>'<details><summary>'+esc(periodLabel(row.week_start))+'</summary>'+publicationMarkup(row,state.client)+'</details>').join('')+'</details>':'');
  const button=box.querySelector('[data-wr-client-retry]'),scope=owner();if(button)button.onclick=()=>{if(current(scope))read(c,true);};
 }
 function mount(){
  if(!model()||!state.client||state.client.onboarding_status!=='complete')return;if(!isClient()&&!(isCoach()&&['overview','check-ins'].includes(state.clientTab)))return;
  const c=stateFor();if(isCoach())coachMount(c);else clientMount(c);read(c);
 }
 function refresh(){if(!state.client||!isClient()&&!(isCoach()&&['overview','check-ins'].includes(state.clientTab)))return;const c=stateFor();return read(c);}
 for(const name of ['renderClient','renderClientWorkspace','clientToday']){
  const before=window[name];if(typeof before!=='function')continue;window[name]=function(...args){const scope=owner(),result=before(...args);Promise.resolve(result).then(()=>{if(state.user?.id===scope.user&&state.client?.id===scope.client&&state.role===scope.role)mount();}).catch(()=>{});return result;};
 }
 window.WeeklyRecap={mount,refresh,body,figuresMarkup};
})();
