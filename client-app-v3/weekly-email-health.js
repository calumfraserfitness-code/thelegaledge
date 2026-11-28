/* Clients using the verified email-import route have no duplicate upload workflow. */
(function(){
 'use strict';
 const preference='Health report delivery · weekly email';
 function guidance(client=state.client,data=state.data){
  if(!client?.id)return null;
  return (data.coachingGuidance||[]).find(g=>g.client_id===client.id&&g.published&&g.category==='recovery'&&g.title===preference)||null;
 }
 const reportDate=date=>date?fmt(date,{day:'numeric',month:'short',year:'numeric'}):'Not supplied';
 const ownReports=()=>weeklyReports().filter(r=>r.file?.client_id===state.client?.id);
 const emailReport=r=>r.source_system==='forwarded_health_email'&&r.provider==='Google / Fitbit';
 const beforeUpload=mountWeeklyReport;
 mountWeeklyReport=function(host,week){if(guidance())return;return beforeUpload(host,week);};
 const beforeHealth=clientHealth;
 clientHealth=function(){
  const setting=guidance();if(!setting)return beforeHealth();
  const host=$('#clientMain');if(!host)return;
  const all=ownReports(),rows=all.filter(emailReport),other=all.filter(r=>!emailReport(r)),latest=rows[0];
  host.innerHTML=clientHeader('','Health reports','Your weekly Google Health summary.')+
   '<section class="panel"><h2>Forward your weekly report</h2><p>'+esc(setting.body)+'</p></section>'+
   '<section class="panel"><h2>'+ (latest?'Latest report received':'Waiting for your first report')+'</h2>'+
   (latest?weeklyReportCard(latest):'<p>Your report will appear here after your email has been received and imported.</p>')+
   (rows.length>1?'<details><summary>Previous reports ('+(rows.length-1)+')</summary>'+rows.slice(1).map(weeklyReportCard).join('')+'</details>':'')+(other.length?'<details><summary>Other saved reports ('+other.length+')</summary>'+other.map(weeklyReportCard).join('')+'</details>':'')+'</section>';
 };
 function coachCard(){
  if(state.role!=='coach'||state.clientTab!=='overview'||!guidance())return;
  const host=$('#coachClientOverview');if(!host)return;
  const client=state.client,user=state.user?.id,m=window.CoachHealthReports?.model(client,state.data);
  const reports=(m?.reports||[]).filter(r=>r.provider==='Google / Fitbit'&&r.source==='Imported from forwarded email');
  const latest=reports[0],box=host.querySelector('#covWeeklyEmailHealth')||document.createElement('section');
  box.id='covWeeklyEmailHealth';box.className='panel cov-email-health';
  box.innerHTML='<div class="cov-row"><h2>Weekly Google Health report</h2><button type="button" class="btn ghost small" data-email-health-open>View reports</button></div>'+
   (m?.filesState==='error'?'<p>Report refresh unavailable. The last saved report, if any, is shown below.</p>':'')+
   (latest?'<p><strong>'+esc(reportDate(latest.periodStart)+' – '+reportDate(latest.periodEnd))+'</strong> · '+esc(reports.length+' saved report'+(reports.length===1?'':'s'))+'</p><p class="muted">Latest reporting period · received via their forwarded email.</p>':'<p>No forwarded Google Health report in the loaded records.</p>')+
   '<p class="muted">They only need to forward the weekly email. No extra app upload.</p>';
  if(!box.isConnected)host.append(box);
  box.querySelector('[data-email-health-open]').onclick=()=>{if(box.isConnected&&state.role==='coach'&&state.client?.id===client.id&&state.user?.id===user){state.clientTab='connections';renderClientWorkspace();}};
 }
 const overview=coachOverview;coachOverview=function(){const r=overview();coachCard();return r;};
 const workspace=renderClientWorkspace;renderClientWorkspace=function(){const r=workspace();coachCard();return r;};
 window.WeeklyEmailHealth={guidance,coachCard};
})();
