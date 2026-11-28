/* One coach editor, backed by the existing scoped meal and target saves. */
(function(){
 let owner=null,date=null;
 const original=coachNutrition;
 nutritionImportPrompt=function(){return window.clientNutritionDraftPrompt(state.client,state.data.onboarding[0]?.responses||{});};
 const previousImportPanel=nutritionImportPanel;nutritionImportPanel=function(){return previousImportPanel().replace('Import 1–7 complete days. Use repeatable Training/Rest/Busy days, or seven named weekdays.','Import one everyday menu that repeats across the week.');};
 function weekFor(d){return state.data.weeks.find(w=>d>=w.week_start&&d<=iso(new Date(new Date(w.week_start+'T12:00:00Z').getTime()+6*864e5)));}
 function assigned(d){const w=weekFor(d);return state.data.nutritionDays.find(n=>n.week_id===w?.id&&n.nutrition_date===d);}
 function openClient(){state.clientView='nutrition';$('#clientHello').textContent=state.client.display_name;$('#returnCoach').classList.remove('hidden');show('#clientApp');window.openDailyNutritionDate(date);}
 coachNutrition=function(){
  const key=state.client?.id;if(owner!==key){owner=key;date=localCoachingDate();const day=assigned(date);state.selectedNutritionPlanId=day?.nutrition_plan_id||null;}
  original();const host=$('#clientWorkspaceBody');if(!host)return;
  const plans=state.data.nutritionPlans.filter(p=>p.is_active!==false),selected=plans.find(p=>p.id===state.selectedNutritionPlanId),day=assigned(date),week=weekFor(date);
  host.querySelector('.nutrition-day-tabs')?.remove();
  const wrap=document.createElement('div');wrap.className='coach-daily-workspace';while(host.firstChild)wrap.append(host.firstChild);host.append(wrap);
  const head=document.createElement('section');head.id='coachNutritionDaily';head.className='panel coach-daily-head';head.innerHTML=`<div class="panel-head"><div><span class="eyebrow">DAILY MEALS</span><h2>Meals for this client</h2><p>Edit meals, portions and targets below. Clients see their assigned meals for today.</p></div><button type="button" class="btn primary" id="coachDailyPreview">See the client’s meals</button></div><div class="coach-daily-controls"><label>View date<input id="coachDailyDate" type="date" value="${date}"></label><label>Menu to edit<select id="coachDailyMenu">${plans.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?.id?'selected':''}>${esc(p.name||p.day_type||'Menu')}</option>`).join('')}</select></label></div><p id="coachDailyAssignment" role="status">${day?`Assigned: ${esc(plans.find(p=>p.id===day.nutrition_plan_id)?.name||'Saved menu')}${week?.published?' · visible to client':' · week awaiting publication'}`:'No menu assigned to this date. Editing a menu does not assign it.'}</p><div class="coach-daily-actions"><button type="button" class="btn ghost" id="coachDailyAssign" ${selected&&week?'':'disabled'}>Use this menu for ${date===localCoachingDate()?'today':esc(fmt(date))}</button><button type="button" class="btn ghost" id="coachDailyRepeat" ${selected&&week?'':'disabled'}>Use this menu for the rest of this week</button></div>${week?'':'<p>Create this coaching week in Weekly plan before assigning meals.</p>'}`;wrap.prepend(head);
  $('#coachDailyMenu').onchange=e=>{state.selectedNutritionPlanId=e.target.value;coachNutrition();};
  $('#coachDailyDate').onchange=e=>{if(!e.target.value)return;date=e.target.value;const d=assigned(date);if(d)state.selectedNutritionPlanId=d.nutrition_plan_id;coachNutrition();};
  $('#coachDailyPreview').onclick=openClient;
  const trackingTitle='Your food tracking routine',trackingCategory='meal_example';
  const trackingRows=()=> (state.data.coachingGuidance||[]).filter(g=>g.client_id===state.client.id&&g.category===trackingCategory&&g.title===trackingTitle);
  const tracking=document.createElement('form');tracking.className='coach-daily-controls';tracking.id='coachDailyTracking';
  tracking.innerHTML=`<label>Food tracking experience<select name="mode"><option value="optional">Meal plan first · optional tracking</option><option value="daily" ${trackingRows().some(g=>g.published)?'selected':''}>Daily tracking · visible log controls</option></select></label><button class="btn ghost small">Save preference</button>`;
  head.append(tracking);
  tracking.onsubmit=async e=>{
   e.preventDefault();
   const clientId=state.client.id,userId=state.user?.id,mode=new FormData(tracking).get('mode'),published=mode==='daily',existing=trackingRows(),button=e.submitter||tracking.querySelector('button');
   const active=()=>state.client?.id===clientId&&state.user?.id===userId&&state.role==='coach';
   if(!active()||!['daily','optional'].includes(mode))return;
   if(existing.some(g=>g.published)===published)return toast('Food tracking preference already saved');
   const row={client_id:clientId,category:trackingCategory,title:trackingTitle,body:'Keep using food tracking if it helps you. Your logged food, meal plan and agreed targets remain separate.',published};
   setBusy(button,true);
   try{
    const saved=state.preview?(existing.length?existing.map(g=>({...g,published})):[{...row,id:'sample-tracking-preference'}]):existing.length?await query('Save food tracking preference',db.from('client_coaching_guidance').update({published}).eq('client_id',clientId).eq('category',trackingCategory).eq('title',trackingTitle).select()):await query('Save food tracking preference',db.from('client_coaching_guidance').insert(row).select());
    if(!Array.isArray(saved)||!saved.length)throw Error('Preference save was not confirmed.');
    if(!active())return;
    state.data.coachingGuidance=[...(state.data.coachingGuidance||[]).filter(g=>!(g.client_id===clientId&&g.category===trackingCategory&&g.title===trackingTitle)),...saved];
    toast('Food tracking preference saved');coachNutrition();
   }catch(err){if(active())toast(err.message,'error');}finally{setBusy(button,false);}
  };

  $('#coachDailyAssign').onclick=e=>saveDates([date],e.target);
  $('#coachDailyRepeat').onclick=e=>{const end=iso(new Date(new Date(week.week_start+'T12:00:00Z').getTime()+6*864e5)),dates=[];for(let d=date;d<=end;d=iso(new Date(new Date(d+'T12:00:00Z').getTime()+864e5)))dates.push(d);saveDates(dates,e.target);};
  const editor=wrap.querySelector('[data-plan-editor]');if(editor){const details=document.createElement('details');details.className='coach-menu-details';details.innerHTML='<summary>Menu name & planning defaults</summary>';editor.prepend(details);for(const name of ['name','day_type','days_per_week']){const field=editor.elements.namedItem(name);if(field)details.append(field.closest('label'));}}
  const tools=wrap.querySelector('.nutrition-tools');if(tools){tools.querySelector('h2').textContent='Edit daily targets & meals';tools.querySelector('p').textContent='Save each change. Recipe edits stay personal to this client.';const importButton=tools.querySelector('#toggleNutritionImport'),advanced=document.createElement('details');advanced.className='coach-menu-details';advanced.innerHTML='<summary>Import or replace menus</summary><p>Use your existing import tools when you need a new menu.</p>';if(importButton){advanced.append(importButton);tools.after(advanced);}}
  if(selected){const notes=document.createElement('form');notes.className='panel coach-daily-notes';notes.innerHTML=`<label>Client nutrition note<textarea name="coach_notes" rows="3">${esc(selected.coach_notes||'')}</textarea></label><button class="btn ghost">Save client note</button>`;wrap.append(notes);notes.onsubmit=async e=>{e.preventDefault();const clientId=state.client.id,planId=selected.id,patch={coach_notes:new FormData(notes).get('coach_notes')||null};setBusy(e.submitter,true);try{const saved=state.preview?{...selected,...patch}:await query('Save nutrition note',db.from('nutrition_plans').update(patch).eq('id',planId).eq('client_id',clientId).select().single());if(!saved?.id)throw Error('Note save was not confirmed.');if(state.client?.id!==clientId)return;Object.assign(selected,saved);toast('Client note saved');coachNutrition();}catch(err){toast(err.message,'error');}finally{setBusy(e.submitter,false);}};}
 };
 async function saveDates(dates,button){
  const clientId=state.client.id,plan=state.data.nutritionPlans.find(p=>p.id===state.selectedNutritionPlanId),week=weekFor(date);if(!plan||!week)return;
  if(dates.some(d=>assigned(d)?.adhered))return toast('Choose days that have not already been completed.','error');
  setBusy(button,true);try{
   const rows=state.preview?dates.map(d=>({id:assigned(d)?.id||'sample-daily-'+d,week_id:week.id,nutrition_date:d,nutrition_plan_id:plan.id,calorie_target:plan.calories,protein_target_g:plan.protein_g,carbs_target_g:plan.carbs_g,fat_target_g:plan.fat_g,adhered:false})):await query('Assign daily meals',db.rpc('assign_client_daily_menu',{p_client:clientId,p_plan:plan.id,p_week:week.id,p_dates:dates}));
   if(!Array.isArray(rows)||rows.length!==new Set(dates).size)throw Error('All dates were not confirmed. Reload before retrying.');if(state.client?.id!==clientId)return;
   const replace=new Set(rows.map(r=>r.week_id+':'+r.nutrition_date));state.data.nutritionDays=[...state.data.nutritionDays.filter(r=>!replace.has(r.week_id+':'+r.nutrition_date)),...rows];toast(`${rows.length} ${rows.length===1?'day':'days'} assigned${week.published?'':' · publish the week when ready'}`);coachNutrition();
  }catch(err){toast(err.message,'error');}finally{setBusy(button,false);}
 }
})();
