/* On-demand coach evidence from the client records already loaded under RLS. */
(function () {
  'use strict';
  function markup() {
    const c=state.client,d=state.data,owned=r=>!r.client_id||r.client_id===c.id;
    const weights=progressData().entries;
    const photos=(d.files||[]).filter(r=>owned(r)&&r.file_type==='progress_photo');
    const reports=(typeof weeklyReports==='function'?weeklyReports():[]).filter(r=>owned(r.file));
    const strength=(d.exerciseLogs||[]).filter(owned);
    const names=new Set((d.mealAssignments||[]).filter(r=>owned(r)&&!r.historical&&r.meal).map(r=>String(r.meal.name).trim().toLowerCase()));
    const health=(d.healthDaily||[]).filter(owned);
    const today=localCoachingDate(),first=iso(new Date(new Date(today+'T12:00:00Z').getTime()-6*864e5));
    const currentWeeks=(d.weeks||[]).filter(w=>owned(w)&&w.published&&w.week_start>=first&&w.week_start<=today);
    const currentWeekIds=new Set(currentWeeks.map(w=>w.id));
    const todayMeal=(d.nutritionDays||[]).some(day=>currentWeekIds.has(day.week_id)&&day.nutrition_date===today&&(d.nutritionPlans||[]).some(plan=>plan.id===day.nutrition_plan_id&&owned(plan)&&plan.is_active!==false));
    let timezoneReady=false;try{if(c.timezone){new Intl.DateTimeFormat('en',{timeZone:c.timezone}).format(new Date());timezoneReady=true;}}catch{}
    const deadlineReady=c.checkin_day!==null&&c.checkin_day!==undefined&&c.checkin_day!==''&&Number.isInteger(Number(c.checkin_day))&&Number(c.checkin_day)>=0&&Number(c.checkin_day)<=6&&!!c.checkin_due_time&&timezoneReady;
    const rows=[
      ['Login',c.profile_id?'Account linked; client sign-in still needs testing':'No login linked'],
      ['Portal access',c.portal_enabled&&c.plan_status==='published'?'Portal enabled; workspace published':'Portal or workspace publication needs coach setup'],
      ['Onboarding',c.onboarding_status==='complete'?'Coaching profile complete':'Client onboarding needs completion'],
      ['Current published week',currentWeeks.length?'Published week covers '+today:'No published week covers '+today],
      ['Today’s nutrition',todayMeal?'Published menu assigned for '+today:'No published menu assigned for '+today],
      ['Check-in deadline',c.weekly_checkin_enabled===false?'Weekly check-ins disabled':deadlineReady?'Day, time and timezone configured':'Check-in day, due time or timezone needs coach setup'],
      ['Weight history',weights.length+' dated weigh-ins, including check-in weights'],
      ['Progress photos',photos.length+' saved photo records'],
      ['Strength history',strength.length?strength.length+' recorded sets':'No recorded sets saved; prescriptions are separate'],
      ['Meal options',names.size+' distinct assigned meal names'],
      ['Health reports',reports.length+' saved weekly reports'],
      ['Device readings',health.length?health.length+' saved daily readings; check Connected health for freshness':'No device readings received; report imports do not establish a device connection']
    ];
    return '<details class="panel" id="migrationReadiness"><summary>Client migration & launch checklist</summary><p>Saved records for '+esc(c.display_name)+'. Counts confirm records, not a successful phone test or a complete comparison with the old app.</p><div style="overflow-x:auto"><table class="trend-table"><thead><tr><th>Area</th><th>Current evidence</th></tr></thead><tbody>'+rows.map(([label,value])=>'<tr><th scope="row">'+esc(label)+'</th><td>'+esc(value)+'</td></tr>').join('')+'</tbody></table></div><h3>Tonight’s client walkthrough</h3><ol><li>Sign in directly at the Legal Edge website.</li><li>Log a workout set and meal, then reload to confirm both.</li><li>Submit a check-in and upload a progress photo; confirm them in coach view.</li><li>Use Busy Week when work, travel or recovery changes the week. Save it, then confirm the chosen focus in coach review.</li><li>Open Progress and Connected health to check dates and previous readings.</li></ol><p>Use the separately labelled QA client for test submissions. Recording view shows the selected client’s real records, so select the QA client before recording a public walkthrough.</p><button type="button" class="btn ghost" data-migration-progress>Open progress</button> <button type="button" class="btn ghost" data-migration-health>Open health connections</button></details>';
  }
  const before=coachOverview;
  coachOverview=function(){const result=before();const host=$('#clientWorkspaceBody');if(state.role!=='coach'||!state.client||!host)return result;host.insertAdjacentHTML('afterbegin',markup());host.querySelector('[data-migration-progress]').onclick=()=>{state.clientTab='progress';renderClientWorkspace();};host.querySelector('[data-migration-health]').onclick=()=>{state.clientTab='connections';renderClientWorkspace();};return result;};
})();
