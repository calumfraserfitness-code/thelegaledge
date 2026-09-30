// Shared plan presentation; demo state is local and never provisions accounts.
function safeMediaUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
function activityPrescription(session) {
  const day = state.data.programs.flatMap(program => program.days || []).find(item => item.id === session.programme_day_id);
  const exercises = exercisesForSession(session);
  return `${day?.coach_notes ? `<p>${esc(day.coach_notes)}</p>` : ''}${exercises.map(exercise => exerciseCard(exercise, false)).join('')}${day?.recovery_notes ? `<p>${esc(day.recovery_notes)}</p>` : ''}`;
}
function cookingStepsMarkup(value) {
  const text = String(value || '').trim();
  const steps = text.split(/\n+|(?:\s+)(?=\d+[.)]\s)/).map(line => line.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
  return `<ol class="cooking-steps">${steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>`;
}
function scaledIngredientAmount(ingredient, meal) {
  const portions = Number(state.mealBatchPortions || 1);
  if (portions === 1) return inferredAmount(ingredient, meal);
  const quantity = Number(ingredient.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || !ingredient.unit) return inferredAmount(ingredient, meal);
  return nutritionUnit(Number((quantity * portions).toFixed(2)), ingredient.unit);
}
function mealsForNutritionPlan(plan) {
  if (!plan) return [];
  const assignments = assignedMealsForPlan(plan);
  if (assignments.length) return assignments.map(item => item.meal);
  return (plan.meals || []).map(meal => ({ ...meal, meal_type: meal.timing,
    ingredients: (meal.items || []).map(item => ({name:item.name,quantity:item.quantity,unit:item.unit})),
    cooking_instructions: meal.cooking_instructions || null }));
}
function weeklyNutritionSelection() {
  const week = currentWeek();
  const assignedIds = new Set(state.data.nutritionDays.filter(day => day.week_id === week?.id).map(day => day.nutrition_plan_id));
  const plans = state.data.nutritionPlans.filter(plan => plan.is_active !== false || assignedIds.has(plan.id));
  const visibleWeek = state.role === 'coach' || state.preview || week?.published;
  const days = weekDays().map(day => ({...day, plan: visibleWeek ? plans.find(plan => plan.id === day.nutrition?.nutrition_plan_id) : null}));
  const requested = days.find(day => day.date === state.selectedNutritionDate && day.plan);
  const today = days.find(day => day.date === iso(new Date()) && day.plan);
  const selected = plans.find(plan => plan.id === state.selectedNutritionPlanId) || requested?.plan || today?.plan || plans[0];
  return {plans, days, selected, visibleWeek};
}
function shoppingListMarkup(days) {
  const totals = new Map();
  let assigned = 0, incomplete = 0;
  days.forEach(day => {
    if (!day.plan) return;
    assigned++;
    const meals = mealsForNutritionPlan(day.plan);
    if (!meals.length) incomplete++;
    meals.forEach(meal => usableIngredients(meal).map(cleanIngredient).forEach(item => {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || !item.unit) { incomplete++; return; }
      let unit = String(item.unit).trim().toLowerCase(), amount = quantity;
      if (unit === 'kg') { unit='g'; amount*=1000; }
      if (['lb','lbs'].includes(unit)) { unit='oz'; amount*=16; }
      const key = `${item.name.toLowerCase()}|${unit}`;
      const current = totals.get(key) || {...item,unit,quantity:0}; current.quantity += amount; totals.set(key,current);
    }));
  });
  return `<details class="panel shopping-list"><summary>Shopping list · ${assigned}/7 days assigned</summary><p class="muted">Totals for the meals assigned in this week. Different foods and measurement types stay separate.</p>${incomplete ? '<p class="source-gap">Some saved meals lack quantities. This list is incomplete; ask your coach before shopping.</p>' : ''}<div class="ingredient-list">${[...totals.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(item=>`<div><b>${esc(item.name)}</b><span>${esc(nutritionUnit(Number(item.quantity.toFixed(2)),item.unit))}</span></div>`).join('') || '<p>No measured meals assigned to this week yet.</p>'}</div></details>`;
}
function renderWeeklyNutrition() {
  const {plans,days,selected,visibleWeek} = weeklyNutritionSelection();
  state.selectedNutritionPlanId = selected?.id || null;
  const assignedDay = days.find(day => day.date === state.selectedNutritionDate && day.plan?.id === selected?.id);
  $('#clientMain').innerHTML = clientHeader('', 'Your meals', 'Choose a day. Follow the ingredients and preparation below.') +
    `<section class="nutrition-week panel"><div class="panel-head"><div><h2>This week</h2><span class="sub">${fmt(days[0].date)} – ${fmt(days[6].date)}</span></div></div>${!visibleWeek ? '<p>Your coach is reviewing this week’s assignments. Your saved meal plans are below.</p>' : ''}<div class="nutrition-week-days">${days.map(day=>`<button type="button" data-meal-date="${day.date}" ${day.plan ? `data-open-meal-plan="${day.plan.id}"` : 'disabled'} class="${day.date===state.selectedNutritionDate?'active':''}"><b>${DAYS[day.dateObject.getDay()].slice(0,3)}</b><span>${day.plan ? esc(nutritionDayLabel(day.plan)) : 'Awaiting assignment'}</span><small>${day.plan ? `${mealsForNutritionPlan(day.plan).length} meals` : 'Coach review'}</small></button>`).join('')}</div></section>` +
    (plans.length ? `<div class="nutrition-day-tabs" aria-label="Available meal plans">${plans.map(plan=>`<button type="button" data-nutrition-plan="${plan.id}" class="${plan.id===selected.id?'active':''}">${esc(nutritionDayLabel(plan))}</button>`).join('')}</div><section class="nutrition-controls panel"><div><b>${assignedDay ? esc(DAYS[assignedDay.dateObject.getDay()]) : 'Meal plan'} · ${esc(nutritionDayLabel(selected))}</b><p class="muted">Amounts below are ${Number(state.mealBatchPortions||1)===1?'for one portion':`for ${state.mealBatchPortions} portions total`}. Nutrition targets are per day.</p></div><label>Batch preparation<select id="mealBatchPortions" aria-label="Batch preparation">${[1,2,3,4,7].map(n=>`<option value="${n}" ${Number(state.mealBatchPortions||1)===n?'selected':''}>${n===1?'1 portion':`${n} portions`}</option>`).join('')}</select></label><label>Food measurements<select id="foodUnits" aria-label="Food measurements"><option value="metric" ${state.foodUnits==='metric'?'selected':''}>Grams / ml</option><option value="us" ${(state.foodUnits|| (state.client?.weight_unit==='lbs'?'us':'metric'))==='us'?'selected':''}>Ounces / US measures</option></select></label></section>${nutritionPlanMarkup(selected)}${shoppingListMarkup(days)}` : '<section class="panel empty">Your coach has not added a meal plan yet.</section>');
  $$('[data-nutrition-plan]').forEach(button=>button.onclick=()=>{state.selectedNutritionDate=null;state.selectedNutritionPlanId=button.dataset.nutritionPlan;renderWeeklyNutrition();});
  $('#mealBatchPortions')?.addEventListener('change',event=>{state.mealBatchPortions=Number(event.target.value);renderWeeklyNutrition();});
  $('#foodUnits')?.addEventListener('change',event=>{state.foodUnits=event.target.value;renderWeeklyNutrition();});
  bindMealPlanLinks();
}
function bindMealPlanLinks() {
  $$('[data-open-meal-plan]').forEach(button=>button.onclick=()=>{
    state.selectedNutritionPlanId=button.dataset.openMealPlan;
    state.selectedNutritionDate=button.dataset.mealDate;
    state.clientView='nutrition';renderClient();
  });
}
function renderPilotDemo() {
  const auth = $('#auth');
  show('#auth');
  auth.innerHTML=`<div class="auth-brand"><img class="brand-logo auth-logo" src="./assets/legal-edge-logo.svg" alt="The Legal Edge"><span class="eyebrow">FIRM PERFORMANCE PILOT</span><h1>A healthier team.<br><em>A practical plan.</em></h1><p>Personal coaching that fits demanding legal work, tailored to the people in your firm.</p><a class="btn ghost" href="./">Back to sign in</a></div><section class="auth-card"><span class="pill">INTERACTIVE DEMONSTRATION</span><h2>Explore your firm’s pilot</h2><p>See the participant experience with sample meals, a weekly planner and firm resources. This demonstration creates no accounts and saves no information.</p><form id="pilotDemoSetup"><label>Firm name<input name="firm" value="Example law firm" maxlength="120" required></label><label>Employees in firm<input name="employees" type="number" min="1" max="100000" value="50" required></label><label>Pilot places<input name="capacity" type="number" min="5" max="100" value="10" required></label><button class="btn primary">Open participant experience</button></form><p class="muted">Real participants receive a private coach-issued login. A live firm enrolment and invitation service is still being built.</p></section>`;
  $('#pilotDemoSetup').onsubmit=event=>{
    event.preventDefault();const fd=new FormData(event.target);
    const employeeCount=Number(fd.get('employees')),capacity=Number(fd.get('capacity'));
    if(capacity>employeeCount)return toast('Pilot places cannot exceed the firm employee count','error');
    state.demoFirm={name:String(fd.get('firm')).trim(),employees:employeeCount,capacity};
    preview('client');state.hasPilot=true;state.client.display_name='Example participant';
    state.data.weeks[0].published=true;
    const weekStart = monday();
    state.data.sessions.push({id:'sample-lower',week_id:state.data.weeks[0].id,session_date:iso(new Date(+weekStart+4*864e5)),title:'Lower body',training_type:'resistance',status:'planned'}, {id:'sample-mobility',week_id:state.data.weeks[0].id,session_date:iso(new Date(+weekStart+3*864e5)),title:'Desk-day mobility',training_type:'mobility',duration_minutes:10,status:'planned'});
    state.data.exercises.push({id:'sample-squat',session_id:'sample-lower',name:'Goblet squat',sets:3,reps:'8–12',rest_seconds:90,coach_instructions:'Use a comfortable range and controlled tempo.'}, {id:'sample-move',session_id:'sample-mobility',name:'Gentle hip mobility',sets:2,reps:'30 seconds per side',rest_seconds:30,coach_instructions:'Move gently within a comfortable range.'});
    const base=state.data.nutritionPlans[0];
    const breakfast={id:'sample-breakfast',meal_type:'Breakfast',name:'Yogurt, oats & berries',calories:450,protein_g:30,carbs_g:60,fat_g:10,ingredients:[{name:'Greek yogurt',quantity:200,unit:'g'},{name:'oats',quantity:50,unit:'g'},{name:'berries',quantity:100,unit:'g'}],cooking_instructions:'1. Spoon the yogurt into a bowl.\n2. Stir in the oats and top with berries.\n3. Cover and refrigerate if preparing ahead.'};
    const lunch={id:'sample-lunch',meal_type:'Lunch',name:'Chicken & rice lunch box',calories:600,protein_g:45,carbs_g:70,fat_g:15,ingredients:[{name:'cooked chicken breast',quantity:150,unit:'g'},{name:'cooked rice',quantity:180,unit:'g'},{name:'mixed vegetables',quantity:150,unit:'g'},{name:'olive oil',quantity:10,unit:'g'}],cooking_instructions:'1. Use cooked chicken and rice.\n2. Heat the vegetables and combine with the rice.\n3. Add chicken and olive oil. Portion into your lunch box.'};
    const dinner={id:'sample-dinner',meal_type:'Dinner',name:'Salmon, potatoes & greens',calories:650,protein_g:45,carbs_g:65,fat_g:23,ingredients:[{name:'salmon fillet',quantity:150,unit:'g'},{name:'potatoes',quantity:250,unit:'g'},{name:'green vegetables',quantity:150,unit:'g'}],cooking_instructions:'1. Cook the potatoes using your preferred method.\n2. Cook the salmon until fully cooked and steam the greens.\n3. Serve together.'};
    state.data.nutritionPlans=Array.from({length:7},(_,weekday)=>({...base,id:`sample-plan-${weekday}`,name:DAYS[(weekday+1)%7],day_type:[0,2,4].includes(weekday)?'Training Day':'Rest Day',days_per_week:1,calories:1700,protein_g:120,carbs_g:195,fat_g:48,source_json:{weekday},meals:[]}));
    state.data.mealAssignments=state.data.nutritionPlans.flatMap(plan=>[breakfast,lunch,dinner].map((meal,index)=>({id:`${plan.id}-${index}`,nutrition_plan_id:plan.id,sort_order:index,meal:{...meal,id:`${plan.id}-meal-${index}`}})));
    state.data.nutritionDays=weekDays().map((day,index)=>({id:`sample-nutrition-${index}`,week_id:state.data.weeks[0].id,nutrition_date:day.date,nutrition_plan_id:state.data.nutritionPlans[index].id,calorie_target:1700,adhered:false}));
    const banner=document.createElement('section');banner.className='pilot-demo-banner';banner.innerHTML=`<div><b>${esc(state.demoFirm.name)} · ${capacity}-place pilot</b><span>Sample participant · demonstration only · ${employeeCount} employees</span></div><a href="?pilot=demo" class="btn ghost small">Pilot setup</a><button id="demoSponsorReport" class="btn ghost small">Sponsor report</button><button id="demoFirmResources" class="btn ghost small">Firm resources</button>`;
    $('#clientApp').insertBefore(banner,$('#clientMain'));
    $('#demoSponsorReport').onclick=()=>{$('#clientMain').innerHTML=clientHeader('FIRM SUMMARY','Sponsor report','Demonstration · no real participant responses')+firmPilotReport({minimum_report_count:5},[]);};
    $('#demoFirmResources').onclick=()=>{$('#clientMain').innerHTML=clientHeader('FIRM RESOURCES',state.demoFirm.name,'Examples of resources selected for your team.')+firmResourceIdeas.map(([name,topic,summary,body])=>`<section class="panel"><span class="eyebrow">${esc(topic)}</span><h2>${esc(name)}</h2><p>${esc(summary)}</p><p>${esc(body)}</p></section>`).join('');};
    $('#clientHello').textContent='Example participant';state.clientView='nutrition';renderClient();
  };
}
if (new URLSearchParams(location.search).get('pilot')==='demo') {
  // All deferred application scripts, including the pilot module, load first.
  window.addEventListener('DOMContentLoaded',renderPilotDemo,{once:true});
}

function updatePlannerAdherence() {
  const container = $('.planner-adherence');
  if (!container) return;
  const days = weekDays();
  const total = days.reduce((sum,day)=>sum+day.sessions.length+1+(day.nutrition?1:0),0);
  const done = days.reduce((sum,day)=>sum+day.sessions.filter(session=>session.status==='completed').length+(Number(day.step?.actual_steps || day.step?.steps || 0)>=safeStepGoal()?1:0)+(day.nutrition?.adhered?1:0),0);
  container.querySelector('strong').textContent=`${done}/${total} completed`;
  container.querySelector('span').textContent=`${total?Math.round(done/total*100):0}% adherence`;
}
