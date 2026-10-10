/* Daily meals use additive food logs; original programmes and assignments are never edited. */
(function(){
 'use strict';
 const M=window.DailyNutrition,host=()=>$('#clientMain');
 let owner=null,logs=[],favourites=[],loaded=false,loadError='',loading=null,dateChoice=null,libraryFilter='All',searchText='',sheet=null,busy=false;
 const ownerKey=()=>`${state.preview?'sample':state.user?.id||''}:${state.client?.id||''}`;
 function reset(){owner=ownerKey();logs=[];favourites=[];loaded=false;loadError='';loading=null;dateChoice=null;sheet=null;busy=false;libraryFilter='All';searchText='';}
 function date(){return dateChoice||state.selectedNutritionDate||localCoachingDate();}
 function current(){
  const d=date(),w=state.data.weeks.find(w=>d>=w.week_start&&d<=iso(new Date(new Date(w.week_start+'T12:00:00Z').getTime()+6*864e5)));
  const day=(w?.published||state.preview)?state.data.nutritionDays.find(n=>n.week_id===w?.id&&n.nutrition_date===d):null;
  const plan=day?state.data.nutritionPlans.find(p=>p.id===day.nutrition_plan_id):null;
  const meals=plan?mealsForNutritionPlan(plan):[];
  const entries=logs.filter(e=>e.entry_date===d);
  return {date:d,day,plan,rows:M.slots(meals,entries),targets:M.targets(state.client,plan,day),week:w};
 }
 function recipes(){
  const published=new Set(state.data.weeks.filter(w=>w.published||state.preview).map(w=>w.id));
  const planIds=new Set(state.data.nutritionDays.filter(n=>published.has(n.week_id)).map(n=>n.nutrition_plan_id));
  const result=[];
  for(const plan of state.data.nutritionPlans.filter(p=>planIds.has(p.id)&&p.is_active!==false)){
   M.slots(mealsForNutritionPlan(plan)).forEach(({meal,group},i)=>{
    const key=String(meal.id||`${plan.id}:${i}`);
    if(!result.some(r=>r.key===key))result.push({key,group,meal,plan});
   });
  }
  return result;
 }
 async function load(){
  if(loaded||loading)return loading;
  if(state.preview){loaded=true;paint();return;}
  const key=owner,client=state.client.id;
  loading=(async()=>{
   try{
    const [a,b]=await Promise.all([
     query('Daily food log',db.from('client_food_entries').select('*').eq('client_id',client).order('entry_date',{ascending:false}).limit(1000)),
     query('Saved recipes',db.from('client_recipe_favourites').select('*').eq('client_id',client).limit(500))
    ]);
    if(owner!==key||ownerKey()!==key)return;
    logs=a;favourites=b;loaded=true;loadError='';
   }catch(e){if(owner===key){loadError='Your food log could not load. Your assigned meals are still available.';}}
   finally{if(owner===key){loading=null;if(state.clientView==='nutrition')paint();}}
  })();return loading;
 }
 const value=(n,unit='')=>n===null?'Not supplied':`${Math.round(n).toLocaleString()}${unit}`;
 function summary(meal,servings=1){return `${value(M.number(meal.calories)===null?null:Number(meal.calories)*servings,' kcal')} · ${value(M.number(meal.protein_g)===null?null:Number(meal.protein_g)*servings,'g protein')}`;}
 function openRoute(route){state.clientView=route;renderClient();}
 function paint(){
  if(owner!==ownerKey())reset();
  const m=current(),today=localCoachingDate(),consumed=loaded?M.totals(m.rows,true):Object.fromEntries(M.fields.map(k=>[k,null])),planned=M.totals(m.rows),eaten=m.rows.filter(r=>r.eaten).length;
  state.foodUnits=state.foodUnits||(state.client?.weight_unit==='kg'?'metric':'us');
  host().innerHTML=`<div class="dn-page"><header class="dn-heading"><div><span class="eyebrow">YOUR NUTRITION</span><h1>Food that fits your day.</h1><p>Choose your meals. Keep it simple.</p></div><button class="btn ghost small" id="dnLibrary">Recipe library</button></header>
   <div class="dn-date-row"><div><span class="dn-dot"></span><strong>${m.date===today?'Today':fmt(m.date,{weekday:'long'})}</strong><span>${fmt(m.date,{day:'numeric',month:'long'})}</span></div><details class="dn-history"><summary>Past logs & another date</summary><label class="dn-date-label">View date<input id="dnDate" type="date" value="${m.date}"></label></details>${m.date!==today?'<button class="text-btn" id="dnToday">Back to today</button>':''}</div>
   <section class="dn-target-panel" aria-label="Daily targets"><div class="dn-target-intro"><span class="eyebrow">YOUR DAILY TARGETS</span><span>${m.plan?esc(m.plan.day_type||'Assigned plan'):'Coach targets'}</span></div><div class="dn-targets">${M.fields.map((k,i)=>`<div><small>${['Calories','Protein','Carbs','Fat'][i]}</small><strong>${m.targets[k]===null?'To agree':Math.round(m.targets[k]).toLocaleString()}<em>${m.targets[k]===null?'':['kcal','g','g','g'][i]}</em></strong></div>`).join('')}</div></section>
   <section class="dn-intake"><div><span class="eyebrow">LOGGED SO FAR</span><strong>${value(consumed.calories,' kcal')} <small>${m.targets.calories===null?'':`of ${Math.round(m.targets.calories).toLocaleString()} kcal`}</small></strong><p>${eaten} ${eaten===1?'meal':'meals'} logged${m.rows.length?` · ${m.rows.length-eaten} still to go`:''}</p></div><div class="dn-progress-bars">${M.fields.slice(1).map((k,i)=>{const ratio=m.targets[k]>0&&consumed[k]!==null?Math.min(100,consumed[k]/m.targets[k]*100):0;return `<div><span>${['Protein','Carbs','Fat'][i]}</span><b>${value(consumed[k],'g')} ${m.targets[k]===null?'':`/ ${Math.round(m.targets[k])}g`}</b><div class="dn-track"><span style="width:${ratio}%"></span></div></div>`;}).join('')}</div></section>
   ${loadError?`<div class="dn-notice" role="status">${esc(loadError)} <button class="text-btn" id="dnRetry">Retry</button></div>`:!loaded?'<p class="muted" role="status">Loading your saved food log…</p>':''}
   <div class="dn-section-heading"><h2>Your meals</h2><span>Recipe details only when you need them</span></div>
   <div class="dn-meals">${m.rows.map((r,i)=>`<article class="dn-meal ${r.eaten?'dn-eaten':''}"><div class="dn-meal-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</div><div class="dn-meal-body"><div class="dn-meal-label"><span class="eyebrow">${esc(r.group)}</span>${r.eaten?'<span class="dn-status">Logged</span>':''}</div><h3>${esc(r.meal.name)}</h3><p>${esc(summary(r.meal,r.servings))}${r.servings!==1?` · ${r.servings} servings`:''}</p><div class="dn-meal-actions"><button class="text-btn" data-dn-recipe="${esc(r.key)}">View recipe</button><button class="text-btn" data-dn-swap="${esc(r.key)}" ${r.eaten?'disabled title="Undo this log before changing the meal"':''}>Swap meal</button><button class="btn ${r.eaten?'ghost':'primary'} small" data-dn-log="${esc(r.key)}" ${!loaded||busy?'disabled':''}>${r.eaten?'Undo log':'Log eaten'}</button></div></div></article>`).join('')||`<div class="dn-empty"><h3>${m.day?'No recipes assigned for this day yet.':'No published meal schedule for this date.'}</h3><p>Your coach’s daily targets are above. Browse your assigned recipes or log food you’ve eaten.</p><button class="btn ghost" id="dnEmptyLibrary">Choose a recipe</button></div>`}</div>
   <div class="dn-daily-actions"><button class="btn ghost" id="dnQuickLog" ${!loaded?'disabled':''}>+ Quick food log</button><span>Only logged food counts towards your intake.</span></div>
   <details class="dn-details"><summary>Chosen meal totals</summary><p>${value(planned.calories,' kcal')} · ${value(planned.protein_g,'g protein')} · ${value(planned.carbs_g,'g carbs')} · ${value(planned.fat_g,'g fat')}</p><p>Estimates from your saved recipes. Choosing a meal does not mark it eaten. Missing nutrients keep the relevant total unknown.</p></details>
   ${m.plan?.coach_notes?`<aside class="dn-coach-note"><span class="eyebrow">FROM YOUR COACH</span><p>${esc(m.plan.coach_notes)}</p></aside>`:''}
   <details class="dn-details dn-week"><summary>Shopping list</summary>${shoppingListMarkup(weeklyNutritionSelection().days)}</details>

   <div id="dnSheetHost"></div></div>`;
  $('#dnLibrary').onclick=()=>openLibrary();$('#dnEmptyLibrary')?.addEventListener('click',()=>openLibrary());
  $('#dnDate').onchange=e=>{if(!e.target.value)return;dateChoice=e.target.value;state.selectedNutritionDate=null;sheet=null;paint();};
  $('#dnToday')?.addEventListener('click',()=>{dateChoice=null;state.selectedNutritionDate=null;sheet=null;paint();});
  $$('[data-dn-date]').forEach(b=>b.onclick=()=>{dateChoice=b.dataset.dnDate;state.selectedNutritionDate=null;sheet=null;paint();});
  $$('[data-dn-recipe]').forEach(b=>b.onclick=()=>openRecipe(current().rows.find(r=>r.key===b.dataset.dnRecipe)));
  $$('[data-dn-swap]').forEach(b=>b.onclick=()=>openLibrary(b.dataset.dnSwap));
  $$('[data-dn-log]').forEach(b=>b.onclick=()=>{const r=current().rows.find(r=>r.key===b.dataset.dnLog);save(r,!r.eaten);});
  $('#dnQuickLog').onclick=quickLog;$('#dnRetry')?.addEventListener('click',()=>{loadError='';load();paint();});
  if(sheet)renderSheet();
 }
 async function save(row,eaten,meal=row.meal,servings=row.servings||1){
  if(busy||!loaded)return;
  const key=ownerKey(),d=date(),client=state.client.id;
  const payload={client_id:client,entry_date:d,slot_key:row.key,meal_snapshot:M.snapshot(meal),servings,eaten};
  busy=true;paint();
  try{
   const saved=state.preview?{...payload,id:`sample:${d}:${row.key}`}: (await query('Save food log',db.from('client_food_entries').upsert(payload,{onConflict:'client_id,entry_date,slot_key'}).select()))[0];
   if(!saved)throw new Error('Your food log was not saved. Try again.');
   if(ownerKey()!==key)return;
   const i=logs.findIndex(e=>e.entry_date===d&&e.slot_key===row.key);if(i<0)logs.push(saved);else logs[i]=saved;
   sheet=null;toast(state.preview?'Sample food updated locally':eaten?'Food logged':'Meal saved');
  }catch(e){if(ownerKey()===key)toast(e.message,'error');}
  finally{if(ownerKey()===key){busy=false;if(state.clientView==='nutrition')paint();}}
 }
 function showSheet(content,title){
  const h=$('#dnSheetHost');if(!h)return;
  h.innerHTML=`<div class="dn-sheet-overlay"><section class="dn-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><header><h2>${esc(title)}</h2><button class="btn ghost small" id="dnClose" aria-label="Close ${esc(title)}">Close</button></header><div class="dn-sheet-content">${content}</div></section></div>`;
  const panel=h.querySelector('[role=dialog]');$('#dnClose').onclick=closeSheet;
  panel.onkeydown=e=>{if(e.key==='Escape')closeSheet();if(e.key==='Tab'){const all=[...panel.querySelectorAll('button:not(:disabled),input,select,textarea,a[href]')];const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};panel.focus();
 }
 function closeSheet(){sheet=null;$('#dnSheetHost').innerHTML='';$('#dnLibrary')?.focus();}
 function recipeKey(meal){return String(meal.id||meal.name||'Meal').slice(0,190);}
 function openRecipe(row){if(!row)return;sheet={type:'recipe',row};renderSheet();}
 function openLibrary(slot=null){sheet={type:'library',slot};libraryFilter='All';searchText='';renderSheet();}
 function renderSheet(){if(sheet?.type==='recipe')recipeSheet();else if(sheet?.type==='library')librarySheet();else if(sheet?.type==='quick')quickLog();}
 function recipeSheet(){
  const {row}=sheet,meal=row.meal,found=recipes().find(r=>r.meal.name===meal.name),key=found?.key||row.key||recipeKey(meal),star=favourites.some(f=>f.recipe_key===key);
  const quantities=(meal.ingredients||meal.items||[]).map(cleanIngredient);
  showSheet(`<span class="eyebrow">${esc(row.group||M.category(meal))}</span><h3 class="dn-recipe-title">${esc(meal.name)}</h3><p>${esc(summary(meal))} · per serving</p><p class="muted">${esc(meal.source_system?.includes('usda')?'USDA-based estimates; brands and preparation can vary.':'Nutrition from your coach’s saved recipe. Check product labels for allergens.')}</p><div class="dn-recipe-controls"><label>Measurements<select id="dnUnits"><option value="us" ${state.foodUnits==='us'?'selected':''}>Ounces / US measures</option><option value="metric" ${state.foodUnits==='metric'?'selected':''}>Grams / ml</option></select></label><label>Prepare servings<select id="dnBatch">${[1,2,3,4,7].map(n=>`<option ${Number(state.mealBatchPortions||1)===n?'selected':''}>${n}</option>`).join('')}</select></label><button class="btn ghost small" id="dnFavourite" ${!loaded?'disabled':''}>${star?'Saved recipe ✓':'Save favourite'}</button></div><h4>Ingredients</h4><ul class="dn-ingredients">${quantities.map(i=>`<li><span>${esc(i.name)}</span><strong>${esc(scaledIngredientAmount(i,meal)||'Ask coach for amount')}</strong></li>`).join('')||'<li>Ingredient details not supplied. Ask your coach.</li>'}</ul><h4>How to make it</h4>${meal.cooking_instructions?cookingStepsMarkup(meal.cooking_instructions):'<p>Preparation instructions have not been supplied.</p>'}${meal.swaps?.length?`<details class="dn-details"><summary>Coach’s substitution notes</summary><p>${meal.swaps.map(s=>esc(humanValue(s))).join('<br>')}</p></details>`:''}<p class="muted">Batch quantities help with preparation. They do not multiply your food log or change your targets.</p>${sheet.returnSlot?'<button class="btn primary" id="dnChooseRecipe">Use this meal</button>':''}`, 'Recipe');
  $('#dnUnits').onchange=e=>{state.foodUnits=e.target.value;recipeSheet();};$('#dnBatch').onchange=e=>{state.mealBatchPortions=Number(e.target.value);recipeSheet();};
  $('#dnFavourite').onclick=async e=>{
   const own=ownerKey();setBusy(e.currentTarget,true);
   try{
    if(state.preview){favourites=star?favourites.filter(f=>f.recipe_key!==key):[...favourites,{recipe_key:key,meal_snapshot:M.snapshot(meal)}];}
    else if(star){const r=await db.from('client_recipe_favourites').delete().eq('client_id',state.client.id).eq('recipe_key',key);if(r.error)throw r.error;if(ownerKey()===own)favourites=favourites.filter(f=>f.recipe_key!==key);}
    else{const [r]=await query('Save favourite',db.from('client_recipe_favourites').upsert({client_id:state.client.id,recipe_key:key,meal_snapshot:M.snapshot(meal)},{onConflict:'client_id,recipe_key'}).select());if(ownerKey()===own&&r)favourites.push(r);}
    if(ownerKey()===own&&sheet?.type==='recipe')recipeSheet();
   }catch(err){toast(err.message,'error');setBusy(e.currentTarget,false);}
  };
  $('#dnChooseRecipe')?.addEventListener('click',()=>{const r=current().rows.find(r=>r.key===sheet.returnSlot);if(r&&!r.eaten)save(r,false,meal,1);});
 }
 function librarySheet(){
  const slot=sheet.slot,original=current().rows.find(r=>r.key===slot),all=recipes();
  let candidates=original?all.filter(r=>r.group===original.group):all;
  candidates=candidates.filter(r=>(libraryFilter==='All'||libraryFilter==='Saved'&&favourites.some(f=>f.recipe_key===r.key)||r.group===libraryFilter)&&(!searchText||r.meal.name.toLowerCase().includes(searchText.toLowerCase())));
  if(original)candidates.sort((a,b)=>Number(M.comparable(original.meal,b.meal))-Number(M.comparable(original.meal,a.meal)));
  showSheet(`<p>${original?'Alternatives from your personal menus. Compare calories and protein before choosing.':'Your coach-assigned recipes, ready to repeat.'}</p><label class="dn-search">Search your recipes<input id="dnSearch" type="search" placeholder="Find a meal…" value="${esc(searchText)}"></label><div class="dn-library-filters">${(original?['All','Saved']:['All','Breakfast','Lunch','Dinner','Snacks','Saved']).map(f=>`<button type="button" class="btn ${f===libraryFilter?'primary':'ghost'} small" data-dn-filter="${f}">${f}</button>`).join('')}</div><div class="dn-library-results"></div><p class="muted">Your personal library only contains assigned recipes. Ask your coach to add meals that suit your preferences.</p>`,original?`Swap ${original.group.toLowerCase()}`:'Recipe library');
  function results(){const h=$('.dn-library-results');h.innerHTML=candidates.map((r,i)=>`<article><div><span class="eyebrow">${esc(r.group)}${original&&M.comparable(original.meal,r.meal)?' · SIMILAR CALORIES & PROTEIN':''}</span><h3>${esc(r.meal.name)}</h3><p>${esc(summary(r.meal))}</p></div><div><button class="btn ghost small" data-dn-library-recipe="${i}">Recipe</button><button class="btn primary small" data-dn-choose="${i}" ${!loaded||busy?'disabled':''}>${original?'Choose swap':'Add to day'}</button></div></article>`).join('')||'<div class="dn-empty">No matching assigned recipes.</div>';
   h.querySelectorAll('[data-dn-library-recipe]').forEach(b=>b.onclick=()=>{const r=candidates[Number(b.dataset.dnLibraryRecipe)];sheet={type:'recipe',row:{meal:r.meal,group:r.group},returnSlot:slot};recipeSheet();});
   h.querySelectorAll('[data-dn-choose]').forEach(b=>b.onclick=()=>{const r=candidates[Number(b.dataset.dnChoose)];save(original||{key:r.group.toLowerCase()+'-extra-'+crypto.randomUUID(),group:r.group},false,r.meal,1);});
  }results();
  $('#dnSearch').oninput=e=>{searchText=e.target.value;candidates=(original?all.filter(r=>r.group===original.group):all).filter(r=>(libraryFilter==='All'||libraryFilter==='Saved'&&favourites.some(f=>f.recipe_key===r.key)||r.group===libraryFilter)&&r.meal.name.toLowerCase().includes(searchText.toLowerCase()));results();};
  $$('[data-dn-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.dnFilter;librarySheet();});
 }
 function quickLog(){
  sheet={type:'quick'};showSheet(`<p>Use the food label or your own tracked values. Leave unknown nutrients blank.</p><form id="dnQuickForm"><label>Food or meal<input name="name" maxlength="200" required placeholder="e.g. Lunch leftovers"></label><div class="dn-quick-grid">${M.fields.map((k,i)=>`<label>${['Calories (kcal)','Protein (g)','Carbs (g)','Fat (g)'][i]}<input name="${k}" type="number" inputmode="decimal" min="0" max="10000" step="any" placeholder="Optional"></label>`).join('')}</div><p class="muted">Enter totals for the amount you ate. This adds a food log; it does not change your coaching plan.</p><button class="btn primary">Log food eaten</button></form>`,'Quick food log');
  $('#dnQuickForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),meal={name:String(f.get('name')).trim(),meal_type:'Snack',...Object.fromEntries(M.fields.map(k=>[k,M.number(f.get(k))]))};if(!meal.name)return;save({key:'quick-'+crypto.randomUUID(),servings:1},true,meal,1);};
 }
 // The outer renderer still enforces the existing account, consent and plan gates.
 renderWeeklyNutrition=function(){if(owner!==ownerKey())reset();if(!dateChoice&&state.selectedNutritionDate&&state.selectedNutritionDate!==localCoachingDate())dateChoice=state.selectedNutritionDate;paint();load();};
 window.openDailyNutritionDate=function(d){if(owner!==ownerKey())reset();dateChoice=d||null;state.selectedNutritionDate=null;renderClient();};
 const previousRender=renderClient;
 renderClient=function(){
  if(owner!==ownerKey())reset();
  previousRender();
  const ready=state.preview||(state.client?.onboarding_status==='complete'&&state.client?.plan_status==='published');if(!ready)return;
  const routes=['progress','diagnostics','health'];
  if(routes.includes(state.clientView)&&!$('#dnProgressNav')){
   const nav=document.createElement('nav');nav.id='dnProgressNav';nav.className='dn-subnav';nav.setAttribute('aria-label','Progress sections');nav.innerHTML=[['progress','Overview'],['diagnostics','Diagnostics'],['health','Devices']].map(([k,label])=>`<button type="button" class="btn ${k===state.clientView?'primary':'ghost'} small" data-dn-route="${k}">${label}</button>`).join('');host().prepend(nav);nav.querySelectorAll('button').forEach(b=>b.onclick=()=>openRoute(b.dataset.dnRoute));
  }
  if(state.clientView==='training'&&!$('#dnSchedule')){const b=document.createElement('button');b.id='dnSchedule';b.className='btn ghost small dn-schedule';b.textContent='Arrange my week';b.onclick=()=>openRoute('planner');host().prepend(b);}
  updateClientNav();
 };
 document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.logout').forEach(b=>b.addEventListener('click',()=>{owner=null;logs=[];favourites=[];loaded=false;sheet=null;}));});
})();
