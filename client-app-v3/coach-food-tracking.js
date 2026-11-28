/* Read-only coach view of explicitly recorded food, never inferred intake. */
(function(){
 'use strict';
 const M=window.DailyNutrition;
 const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
 const mondayOf=date=>shift(date,-(new Date(date+'T12:00:00Z').getUTCDay()+6)%7);
 let owner=null,selectedWeek=null;
 function enabled(){
  const id=state.client?.id;
  return !!id&&state.role==='coach'&&(state.data.coachingGuidance||[]).some(g=>g.client_id===id&&g.published&&g.category==='meal_example'&&g.title==='Your food tracking routine');
 }
 function schedule(start,client){
  const week=(state.data.weeks||[]).find(w=>w.week_start===start&&(w.published||state.preview)&&(!w.client_id||w.client_id===client.id));
  return Array.from({length:7},(_,i)=>{
   const date=shift(start,i),day=week&&(state.data.nutritionDays||[]).find(d=>d.week_id===week.id&&d.nutrition_date===date);
   const plan=day&&(state.data.nutritionPlans||[]).find(p=>p.id===day.nutrition_plan_id&&(!p.client_id||p.client_id===client.id));
   return {date,keys:plan?M.slots(mealsForNutritionPlan(plan)).map(r=>r.key):[],targets:day?M.targets(client,plan,day,date):{}};
  });
 }
 function metric(label,pct,n,d,unit){
  return '<div class="cft-metric"><span>'+esc(label)+'</span><strong>'+(pct===null?'—':pct+'%')+'</strong><small>'+n+' of '+d+' '+esc(unit)+'</small><progress max="100" value="'+(pct??0)+'" aria-label="'+esc(label)+'" '+(pct===null?'hidden':'')+'></progress></div>';
 }
 const number=(v,unit='')=>M.number(v)===null?'—':Math.round(Number(v)).toLocaleString()+unit;
 function markup(model,week,today,full){
  const kpis='<div class="cft-metrics">'+metric('Days with food logged',model.daysPercentage,model.logged,model.elapsed,'finished days')+metric('Planned meals logged',model.mealsPercentage,model.matched,model.planned,'planned slots')+metric('Fully logged meal plans',model.completePercentage,model.complete,model.assignedDays,'planned days')+'</div>';
  const table='<div class="cft-table-scroll"><table><caption>Recorded food by day</caption><thead><tr><th scope="col">Day</th><th scope="col">Meals logged</th><th scope="col">Calories</th><th scope="col">Protein</th><th scope="col">Carbs</th><th scope="col">Fat</th></tr></thead><tbody>'+model.rows.map(r=>'<tr><th scope="row">'+esc(fmt(r.date,{weekday:'short',day:'numeric',month:'short'}))+(r.today?' <small>Today · in progress</small>':'')+'</th><td>'+(r.assigned?r.matched+' / '+r.assigned+' ('+Math.round(100*r.matched/r.assigned)+'%)':'No planned slots')+(r.extra?' + '+r.extra+' other':'')+(r.items?'':'<small>No food logged</small>')+'</td>'+M.fields.map((k,i)=>'<td>'+number(r.totals[k],i?'g':'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  const checkin=(state.data.checkins||[]).filter(row=>row.client_id===state.client.id&&row.period_start===week&&M.number(row.nutrition_adherence)!==null&&Number(row.nutrition_adherence)<=100).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at)))[0];
  const selfReport=checkin?'<p class="cft-note"><strong>Check-in nutrition adherence (self-reported):</strong> '+number(checkin.nutrition_adherence,'%')+'. This is separate from food-record coverage.</p>':'';
  return kpis+'<p class="cft-note">Completed days only in the percentages; today is shown separately. A saved swap or undone record is not a logged meal. Unrecorded food is unknown, not zero intake.</p>'+selfReport+(full?table:'<button class="btn ghost small" type="button" data-cft-open>See daily calories, macros & records</button>');
 }
 async function mount(full){
  const root=$('#clientWorkspaceBody');if(!root||!enabled())return;
  root.querySelector('[data-cft]')?.remove();
  const client=state.client,user=state.user?.id,key=(user||'sample')+':'+client.id,today=localCoachingDate(),currentWeek=mondayOf(today);
  if(owner!==key){owner=key;selectedWeek=currentWeek;}
  if(!selectedWeek||selectedWeek>currentWeek)selectedWeek=currentWeek;
  const box=document.createElement('section');box.className='panel coach-food-tracking';box.dataset.cft='';box.innerHTML='<div class="cft-head"><div><span class="eyebrow">NUTRITION · TRACKING</span><h2>Food logging consistency</h2><p data-cft-period></p></div><button type="button" class="btn ghost small" data-cft-refresh>Refresh</button></div><div class="cft-week"><button type="button" class="btn ghost small" data-cft-prev>Previous week</button><button type="button" class="btn ghost small" data-cft-next>Next week</button><button type="button" class="text-btn" data-cft-current>This week</button></div><div data-cft-content role="status">Loading recorded food…</div>';
  (full?(root.querySelector('.coach-daily-workspace')||root):root).prepend(box);
  const valid=()=>box.isConnected&&state.role==='coach'&&state.client?.id===client.id&&state.user?.id===user;
  let request=0;
  async function read(){
   const start=selectedWeek,seq=++request,end=shift(start,6),last=end<today?end:today;
   const content=box.querySelector('[data-cft-content]');
   box.querySelector('[data-cft-period]').textContent=fmt(start,{day:'numeric',month:'short'})+' – '+fmt(end,{day:'numeric',month:'short'});
   box.querySelector('[data-cft-next]').disabled=start===currentWeek;
   box.querySelector('[data-cft-current]').hidden=start===currentWeek;
   content.textContent='Loading recorded food…';
   try{
    const days=schedule(start,client),entries=[];
    if(!state.preview){
     const size=500;
     for(let offset=0;;offset+=size){
      const page=await query('Food tracking summary',db.from('client_food_entries').select('client_id,entry_date,slot_key,eaten,servings,meal_snapshot').eq('client_id',client.id).gte('entry_date',start).lte('entry_date',last).order('entry_date').order('slot_key').range(offset,offset+size-1));
      if(!valid()||seq!==request)return;
      if(page.some(r=>r.client_id!==client.id))throw Error('Record ownership could not be confirmed.');
      entries.push(...page);if(page.length<size)break;
     }
    }
    if(!valid()||seq!==request)return;
    const model=M.trackingSummary({days,entries,today,clientId:client.id,startDate:client.start_date});
    content.innerHTML=markup(model,start,today,full);
    const open=content.querySelector('[data-cft-open]');if(open)open.onclick=()=>{if(!valid())return;state.clientTab='nutrition';renderClientWorkspace();};
   }catch(e){if(valid()&&seq===request)content.textContent='Food tracking could not load. Refresh to try again.';}
  }
  const choose=n=>{if(!valid())return;selectedWeek=shift(selectedWeek,n);read();};
  box.querySelector('[data-cft-prev]').onclick=()=>choose(-7);
  box.querySelector('[data-cft-next]').onclick=()=>{if(selectedWeek<currentWeek)choose(7);};
  box.querySelector('[data-cft-current]').onclick=()=>{if(valid()){selectedWeek=currentWeek;read();}};
  box.querySelector('[data-cft-refresh]').onclick=()=>{if(valid())read();};
  read();
 }
 const overview=coachOverview;coachOverview=function(){const result=overview();mount(false);return result;};
 const nutrition=coachNutrition;coachNutrition=function(){const result=nutrition();mount(true);return result;};
})();
