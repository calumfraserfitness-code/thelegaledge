/* Coach summaries use this client's saved plans and recorded observations only. */
function clientSummaryModel(){
 const date=localCoachingDate(),data=state.data,client=state.client;
 const day=data.nutritionDays.find(d=>d.nutrition_date===date),today=day?data.nutritionPlans.find(p=>p.id===day.nutrition_plan_id):null;
 const plans=data.nutritionPlans.filter(p=>p.is_active!==false);
 const weights=[...data.progress.map(p=>({date:p.entry_date,value:p.weight_kg,source:'Progress entry'})),...data.checkins.map(p=>({date:p.submitted_at?.slice(0,10),value:p.weight_kg,source:'Check-in'}))].filter(p=>p.date&&finiteRecorded(p.value)).sort((a,b)=>b.date.localeCompare(a.date));
 const healthReports=(data.files||[]).filter(r=>r.client_id===client.id&&r.file_type==='health_weekly_report');
 const reports=(data.diagnostics||[]).filter(r=>!r.client_id||r.client_id===client.id),blood=reports.filter(r=>/blood|lab/i.test(r.report_type+' '+r.title)),genetics=reports.filter(r=>/genetic|genome|dna/i.test(r.report_type+' '+r.title));
 const daily=(data.healthDaily||[]).filter(r=>r.client_id===client.id).sort((a,b)=>String(b.last_synced_at||b.date).localeCompare(String(a.last_synced_at||a.date)));
 return {date,today,plans,weight:weights[0]||null,blood,genetics,healthReports,lastReading:daily[0]||null};
}
function savedMacroRow(plan){return `<tr><td>${esc(plan.name)}</td>${['calories','protein_g','carbs_g','fat_g'].map(k=>'<td>'+(finiteRecorded(plan[k])?Math.round(Number(plan[k])).toLocaleString():'To agree')+'</td>').join('')}</tr>`;}
function clientSummaryMarkup(){
 const m=clientSummaryModel(),legacy=state.client,legacyEnergy=[legacy.protein_goal_g,legacy.carbs_goal_g,legacy.fat_goal_g].every(finiteRecorded)?Number(legacy.protein_goal_g)*4+Number(legacy.carbs_goal_g)*4+Number(legacy.fat_goal_g)*9:null;
 const mismatch=legacyEnergy!==null&&finiteRecorded(legacy.calorie_goal)&&Math.abs(legacyEnergy-Number(legacy.calorie_goal))>Math.max(100,Number(legacy.calorie_goal)*.1);
 return `<section class="panel client-saved-summary"><span class="eyebrow">SAVED CLIENT PLAN</span><h2>Nutrition, progress & health</h2><p>${m.today?'Today: '+esc(m.today.name)+'.':'No dated menu is assigned for today.'} These are planned portions and targets; eating them is never logged automatically.</p><div class="client-summary-table"><table><caption>Daily menu targets · grams of protein, carbs and fat</caption><thead><tr><th>Menu</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead><tbody>${m.plans.map(savedMacroRow).join('')||'<tr><td colspan="5">No active nutrition menu saved.</td></tr>'}</tbody></table></div>${mismatch?'<p class="muted">The older headline calories and macros do not reconcile. Review those in Client details; the day-specific menu targets above are shown in Nutrition.</p>':''}<div class="client-summary-facts"><p><b>Latest recorded weight</b><br>${m.weight?displayWeight(m.weight.value)+' · '+esc(fmt(m.weight.date))+' · '+esc(m.weight.source):'No weigh-in recorded yet.'}</p><p><b>Saved reports</b><br>${m.healthReports.length} weekly health report${m.healthReports.length===1?'':'s'} · ${m.blood.length} blood report${m.blood.length===1?'':'s'} · ${m.genetics.length} genetic report${m.genetics.length===1?'':'s'}</p><p><b>Daily device readings</b><br>${m.lastReading?'Latest received: '+esc(hubStamp(m.lastReading.last_synced_at))+' · '+esc(title(m.lastReading.source||'device')):'No daily device readings received. Weekly reports are shown separately.'}</p></div><div class="client-summary-actions"><button class="btn ghost" data-summary-tab="nutrition">Edit meals & macros</button><button class="btn ghost" data-summary-tab="progress">View progress</button><button class="btn ghost" data-summary-tab="diagnostics">Blood work & genetics</button><button class="btn ghost" data-summary-tab="connections">Health reports & devices</button></div></section>`;
}

function coachBloodWorkMarkup(reports){
 const latest=[...reports].sort((a,b)=>String(b.report_date||'').localeCompare(String(a.report_date||'')))[0];
 if(!latest)return '';
 const data=latest.data||{},markers=Array.isArray(data.markers)?data.markers:[];
 const flags=markers.filter(m=>['high','low','out of range','abnormal','flagged'].includes(String(m.status||m.classification||'').toLowerCase()));
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?esc(fmt(v)):'';
 const label=latest.title||'Latest report',collected=date(latest.report_date),repeat=date(data.followup_target_date);
 return '<section class="panel coach-blood-work"><div class="panel-head"><div><h2>Blood work</h2><p>'+esc(label)+(collected?' · '+collected:'')+'</p></div>'+
  '<button type="button" class="btn ghost small" data-summary-tab="diagnostics">Open full report</button></div>'+
  (flags.length?'<h3>Flagged results</h3><ul>'+flags.slice(0,3).map(m=>'<li><span>'+esc(m.marker_name||m.name)+'</span><strong>'+
   esc([m.value,m.unit].filter(v=>v!=null&&v!=='').join(' '))+'</strong><small>'+esc(title(m.status||m.classification))+'</small></li>').join('')+
   '</ul>'+(flags.length>3?'<p>'+flags.length+' flagged results in the full report</p>':''):'')+
  (repeat?'<p class="coach-blood-repeat">Repeat-test target <strong>'+repeat+'</strong></p>':'')+'</section>';
}
const savedSummaryOverviewBefore=coachOverview;
coachOverview=function(){savedSummaryOverviewBefore();const host=$('#clientWorkspaceBody');if(!host)return;host.insertAdjacentHTML('afterbegin',coachBloodWorkMarkup(clientSummaryModel().blood)+clientSummaryMarkup());host.querySelectorAll('[data-summary-tab]').forEach(b=>b.onclick=()=>{state.clientTab=b.dataset.summaryTab;renderClientWorkspace();});
 // Use the most recent observation across progress entries and check-ins.
 const m=clientSummaryModel(),metrics=host.querySelectorAll('.metric-strip .metric strong');if(metrics.length>=3){metrics[1].textContent=m.weight?displayWeight(m.weight.value):'—';metrics[2].textContent=m.weight&&finiteRecorded(state.client.start_weight_kg)?displayWeight(Number(m.weight.value)-Number(state.client.start_weight_kg),true):'—';}
};
const savedSummaryTodayBefore=clientToday;
clientToday=function(){savedSummaryTodayBefore();const m=todayCoachingModel(),meals=$('#clientMain .pw-meals');if(m.mealPlan&&meals)meals.insertAdjacentHTML('beforebegin',nutritionTargets(m.mealPlan));};
