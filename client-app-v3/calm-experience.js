/* A focused client experience. Graphics show actual readings, never made-up device data. */
function calmSparkline(rows,key,label,maxGap=1,periodLabel="recorded days"){
 const ordered=[...rows].sort((a,b)=>a.date.localeCompare(b.date)),valid=ordered.filter(r=>finiteRecorded(r[key]));
 if(valid.length<2)return '<div class="calm-chart-empty">'+(valid.length?'One recorded day':'Awaiting readings')+'</div>';
 const values=valid.map(r=>Number(r[key])),low=Math.min(...values),high=Math.max(...values),span=high-low||1;
 const start=Date.parse(ordered[0].date+'T12:00:00Z'),end=Date.parse(ordered.at(-1).date+'T12:00:00Z'),days=Math.max(1,(end-start)/864e5);
 let paths=[],current=[];let prior=null;
 for(const r of ordered){if(!finiteRecorded(r[key])){if(current.length)paths.push(current);current=[];prior=null;continue;}if(prior&&(Date.parse(r.date)-Date.parse(prior))/864e5>maxGap){if(current.length)paths.push(current);current=[];}
 const x=8+(Date.parse(r.date+'T12:00:00Z')-start)/864e5/days*204,y=60-(Number(r[key])-low)/span*46;current.push([x,y]);prior=r.date;}if(current.length)paths.push(current);
 return '<svg class="calm-sparkline" viewBox="0 0 220 72" role="img" aria-label="'+esc(label+'; '+valid.length+' '+periodLabel)+'"><path class="calm-chart-baseline" d="M8 64H212"/>'+paths.map(p=>'<path d="'+p.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join(' ')+'"/>').join('')+paths.flatMap(p=>p.map(([x,y])=>'<circle cx="'+x.toFixed(2)+'" cy="'+y.toFixed(2)+'" r="2.4"/>')).join('')+'</svg>';
}
function calmWeeklySeries(reports,key){
 const seen=new Set();return reports.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.period_end||'')).filter(r=>{const id=(r.provider||'')+'|'+r.period_start+'|'+r.period_end;if(seen.has(id))return false;seen.add(id);return true;}).map(r=>({date:r.period_end,[key]:r.metrics?.[key],provider:r.provider,period_start:r.period_start}));
}
function calmWeeklyMetric(reports,key){
 const series=calmWeeklySeries(reports,key).sort((a,b)=>b.date.localeCompare(a.date)),latest=series.find(r=>finiteRecorded(r[key]));
 if(!latest)return null;
 // Compare only adjacent, non-overlapping reports from the same provider.
 const prior=series.find(r=>r.provider===latest.provider&&r.date<latest.period_start&&finiteRecorded(r[key]));
 const change=prior&&(Date.parse(latest.date)-Date.parse(prior.date))/864e5<=9?Number(latest[key])-Number(prior[key]):null;
 return {latest,change,rows:series.filter(r=>r.provider===latest.provider)};
}
healthSummaryMarkup=function(){
 const rows=recentHealthRows(7),latest=[...rows].sort((a,b)=>b.date.localeCompare(a.date))[0],reports=weeklyReports(),avg=k=>{const v=rows.filter(r=>finiteRecorded(r[k])).map(r=>Number(r[k]));return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
 const definitions=[['steps','average_steps','Steps',v=>Math.round(v).toLocaleString()],['sleep_minutes','sleep_hours','Sleep',v=>Math.floor(Math.round(v)/60)+'h '+(Math.round(v)%60)+'m'],['resting_heart_rate','resting_heart_rate','Resting heart rate',v=>Math.round(v)+' bpm']];
 const metrics=definitions.map(([daily,key,label,format])=>{const value=avg(daily),weekly=calmWeeklyMetric(reports,key);if(value!==null)return `<article><span>${label}</span><strong>${format(value)}</strong><small>Daily average · ${esc(fmt(rows[0]?.date))}</small>${calmSparkline(rows,daily,label)}</article>`;
 if(!weekly)return `<article><span>${label}</span><strong>—</strong><small>Not recorded</small><div class="calm-chart-empty">Awaiting readings</div></article>`;
 const v=Number(weekly.latest[key]),change=weekly.change,unit=key==='average_steps'?' steps':key==='sleep_hours'?' h':' bpm';
 return `<article><span>${label}</span><strong>${format(daily==='sleep_minutes'?v*60:v)}</strong><small>Weekly report · ended ${esc(fmt(weekly.latest.date))}</small>${calmSparkline(weekly.rows,key,label,9,'weekly reports')}<small>${change===null?'':(change>0?'+':'')+change.toLocaleString(undefined,{maximumFractionDigits:1})+unit+' vs previous report'}</small></article>`;});
 const weight=[...rows].sort((a,b)=>b.date.localeCompare(a.date)).find(r=>finiteRecorded(r.weight_kg)),weeklyWeight=calmWeeklyMetric(reports,'weight_kg');
 const weightText=weight?'Latest weight '+esc(displayWeight(weight.weight_kg))+' · '+esc(fmt(weight.date)):weeklyWeight?'Reported weight '+esc(displayWeight(Number(weeklyWeight.latest.weight_kg)))+' · weekly report ended '+esc(fmt(weeklyWeight.latest.date)):'Weight not recorded';
 return `<section class="calm-health health-summary"><header><div><span class="eyebrow">YOUR HEALTH AT A GLANCE</span><h2>Small steps. Clear progress.</h2></div><span class="calm-source">${state.preview?'Fictional example':latest?'Latest daily reading '+esc(fmt(latest.date)):reports.length?'Latest weekly report ended '+esc(fmt(reports[0].period_end)):'No readings yet'}</span></header><div class="calm-metric-grid">${metrics.join('')}</div><footer><span>${weightText}</span><span>${rows.length?rows.length+' recorded days':reports.length?'Saved weekly averages · report dates shown above':'Your readings appear after a confirmed upload'}</span></footer>${weeklyWeight?`<details class="calm-reports"><summary>Weight across weekly reports</summary>${calmSparkline(weeklyWeight.rows,'weight_kg','Reported weight in kilograms',9,'weekly reports')}</details>`:''}${reports.length?`<details class="calm-reports"><summary>Weekly watch reports · ${reports.length}</summary><p class="muted">Weekly summaries stay separate from daily readings. Imported email reports retain their review status.</p>${reports.map(weeklyReportCard).join('')}</details>`:''}</section>`;
};
const calmClientToday=clientToday;
clientToday=function(){calmClientToday();const host=$('#clientMain');host.classList.add('calm-today');const lead=host.querySelector('.client-page-head,.client-heading,.client-header');if(lead)lead.classList.add('calm-welcome');
 // Extra guidance remains accessible without dominating today's prescribed actions.
 const primary=[...host.querySelectorAll(':scope > section.panel')].slice(0,2);if(primary.length===2){const grid=document.createElement('div');grid.className='calm-today-primary';primary[0].before(grid);primary.forEach(n=>grid.append(n));}
 const notes=[...host.querySelectorAll(':scope > section.panel')].filter(n=>n.querySelector('.eyebrow')?.textContent==='WEEKLY FOCUS'||['Your coach’s next steps','Upcoming coaching review'].includes(n.querySelector('h2')?.textContent));if(notes.length){const details=document.createElement('details');details.className='calm-more';const summary=document.createElement('summary');summary.textContent='Coach notes & next review';details.append(summary);notes[0].before(details);notes.forEach(n=>details.append(n));}
 for(const selector of ['.milestone-strip','.cw-goals','#cwTimingPanel']){const node=host.querySelector(selector);if(node&&node.tagName!=='DETAILS'){const target=selector==='.cw-goals'?node.closest('section'):node;const detail=document.createElement('details');detail.className='calm-more';const summary=document.createElement('summary');summary.textContent=selector==='.milestone-strip'?'Your progress milestones':selector==='.cw-goals'?'Your agreed goals':'Adjust this week';target.replaceWith(detail);detail.append(summary,target);}}
};
function calmConnectionsPaint(host){if(!host.isConnected)return;host.classList.add('calm-connections');const hero=host.querySelector('.hub-hero');if(hero){hero.querySelector('h1').textContent='Your health, in one place.';hero.querySelector('p').textContent='See the readings you share with your coach. Manage your phone or add a weekly report.';}
 const phone=host.querySelector('.hub-phone-start');if(phone){phone.querySelector('h2').textContent='iPhone & Apple Watch';phone.querySelector('p').textContent='Use a free Apple Shortcut to share approved Health readings on your chosen days.';phone.querySelector('.hub-phone-actions small').textContent='Free Apple Shortcuts · iPhone setup required · sharing is optional.';phone.querySelector('[data-hub-provider="apple_health"]').textContent='Set up phone sharing';}
 const recent=host.querySelector('.hub-recent');if(recent)recent.replaceWith(document.createRange().createContextualFragment(healthSummaryMarkup()));
 const grid=host.querySelector('.hub-strength-only');if(grid){const heading=grid.previousElementSibling;if(heading?.classList.contains('hub-section-title'))heading.remove();const extra=document.createElement('details');extra.className='calm-more';extra.innerHTML='<summary>Garmin options</summary>';grid.replaceWith(extra);extra.append(grid);}
 const others=host.querySelector('.hub-other-apps summary');if(others)others.textContent='Other apps and connections';
 const foot=host.querySelector('.hub-footer');if(foot)foot.innerHTML='<p>Private to you and your coach. Individual health readings stay out of employer reports.</p>';
};
