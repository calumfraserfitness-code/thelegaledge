// Coach-operated firm pilot workflow. Sponsor output is aggregate-only.
const firmState = { organizations: [], pilots: [], participants: [], consents: [], resources: [], briefs: [], selected: null, loaded: false };
const firmPhases = ['baseline', 'midpoint', 'endline'];
const firmResourceIdeas = [
  ['Deadline-week nutrition', 'Nutrition', 'A realistic meal structure for late meetings and unpredictable lunch breaks.', 'Choose a reliable breakfast, prepare a portable lunch, and decide on one easy dinner before the busiest day begins. Keep water available at your desk. Make the plan fit your actual meeting schedule and any food restrictions recorded with your coach.'],
  ['Movement between matters', 'Movement', 'Short movement breaks that fit between calls and long periods at a desk.', 'Use a short walk or gentle mobility break between blocks of work. Start with a duration that is realistic for your day, then build consistency. Your personal training plan remains the source for exercise targets and any injury modifications.'],
  ['Sleep after a late finish', 'Recovery', 'A practical wind-down when work ends later than planned.', 'Set a repeatable final work step, prepare what you need for the next morning, and give yourself a short transition before bed. Discuss persistent sleep problems with an appropriate clinician.'],
  ['Travel-day defaults', 'Travel', 'Keep useful routines while moving between offices, courts or clients.', 'Plan a simple meal and movement option before travel. Keep a portable snack that suits your preferences, check what facilities are available, and choose the smallest workout that fits. Your coach can adjust the plan for the trip.']
];

async function loadFirmPilots() {
  if (state.preview) {
    if (!firmState.loaded) {
      firmState.organizations = [{ id: 'demo-firm', name: 'Example firm', contact_name: 'Pilot contact' }];
      firmState.pilots = [{ id: 'demo-pilot', organization_id: 'demo-firm', name: '90-day lawyer performance pilot', capacity: 10, status: 'planning', minimum_report_count: 5 }];
      firmState.participants = [];
      firmState.consents = [];
    }
  } else {
    const [organizations, pilots, participants, consents, resources, briefs] = await Promise.all([
      query('Firms', db.from('firm_organizations').select('*').order('created_at', { ascending: false })),
      query('Firm pilots', db.from('firm_pilots').select('*').order('created_at', { ascending: false })),
      query('Pilot roster', db.from('firm_participants').select('*').order('joined_at', { ascending: false })),
      query('Pilot consents', db.from('firm_consents').select('participant_id,accepted_at')),
      query('Firm resources', db.from('firm_resources').select('*').order('created_at', { ascending: false })),
      query('Firm programme briefs', db.from('firm_programme_briefs').select('*'))
    ]);
    Object.assign(firmState, { organizations, pilots, participants, consents, resources, briefs });
  }
  firmState.loaded = true;
  if (!firmState.pilots.some(p => p.id === firmState.selected)) firmState.selected = firmState.pilots[0]?.id || null;
}

function firmPilotReport(pilot, rows) {
  const threshold = Math.max(5, Number(pilot.minimum_report_count) || 5);
  const byPhase = new Map(rows.map(row => [row.phase, row]));
  return `<section class="panel"><div class="panel-head"><div><h3>Sponsor-safe report</h3><span class="sub">Only group averages from consenting respondents. Minimum ${threshold} responses per phase.</span></div></div>
    <div class="firm-report"><div class="firm-report-head"><span>Assessment</span><span>Responses</span><span>Energy</span><span>Sleep</span><span>Stress</span><span>Workload</span><span>Consistency</span></div>
    ${firmPhases.map(phase => { const row = byPhase.get(phase); return `<div class="firm-report-row"><b>${title(phase)}</b>${row
      ? `<span>${row.respondents}</span><span>${row.energy}</span><span>${row.sleep}</span><span>${row.stress}</span><span>${row.workload}</span><span>${row.consistency}</span>`
      : `<span class="muted firm-suppressed">Suppressed until ${threshold} responses</span>`}</div>`; }).join('')}</div>
    <p class="muted">No individual scores, coaching notes, health data, or identifiable responses belong in a sponsor report. Review this summary before sharing it outside the coaching team.</p></section>`;
}

async function renderFirmPilots() {
  const main = $('#coachMain');
  main.innerHTML = pageHead('CORPORATE COACHING', 'Firms & pilot rosters') + '<section class="panel">Loading firm pilots…</section>';
  try {
    await loadFirmPilots();
    if (state.coachView !== 'firms' || state.client) return;
    await paintFirmPilots();
  } catch (error) { renderError(main, error, renderFirmPilots); }
}

async function paintFirmPilots() {
  const main = $('#coachMain');
  const pilot = firmState.pilots.find(p => p.id === firmState.selected);
  const org = firmState.organizations.find(o => o.id === pilot?.organization_id);
  const roster = firmState.participants.filter(m => m.pilot_id === pilot?.id);
  const activeRoster=roster.filter(m=>m.status!=='withdrawn');
  let report = [];
  if (pilot && !state.preview) report = await query('Aggregate pilot report', db.rpc('firm_pilot_summary', { target_pilot_id: pilot.id }));
  const weekStart=iso(monday());
  const weeklyReport=pilot&&!state.preview?await query('Weekly group check-in report',db.rpc('firm_weekly_summary',{target_pilot_id:pilot.id,target_week:weekStart})):null;
  const checkins=pilot&&!state.preview&&activeRoster.length?await query('Pilot weekly reviews',db.from('checkins').select('id,client_id,submitted_at,reviewed_at').in('client_id',activeRoster.map(m=>m.client_id)).gte('submitted_at',weekStart+'T00:00:00Z').order('submitted_at',{ascending:false}).limit(500)):state.preview&&state.sampleClientData?activeRoster.flatMap(m=>(state.sampleClientData.get(m.client_id)?.checkins||[]).filter(c=>String(c.submitted_at||'').slice(0,10)>=weekStart)):[];
  main.innerHTML = pageHead('CORPORATE COACHING', 'Firms & pilot rosters') + `
    <div class="firm-intro"><div><strong>90-day lawyer performance pilot</strong><p>Private coaching for each participant, with anonymous cohort reporting for the sponsor.</p></div><span>Coach only</span></div>
    ${pilot?firmDeliveryMarkup(pilot,activeRoster,checkins)+firmProgrammeBriefMarkup(pilot):''}
    <div class="firm-grid"><section class="panel"><div class="panel-head"><h3>Firms</h3></div>
      <form id="firmOrganizationForm" class="firm-form"><label>Firm name<input name="name" maxlength="160" required></label><label>Number of employees<input name="employee_count" type="number" min="1" max="100000"></label><label>Contact name<input name="contact_name"></label><label>Contact email<input name="contact_email" type="email"></label><button class="btn primary">Add firm</button></form>
      <div class="firm-list">${firmState.organizations.map(o => `<div><b>${esc(o.name)}</b><small>${o.employee_count ? `${Number(o.employee_count).toLocaleString()} employees · ` : ''}${esc(o.contact_name || 'No contact recorded')}</small></div>`).join('') || '<p class="muted">Add the first firm to start a pilot.</p>'}</div></section>
    <section class="panel"><div class="panel-head"><h3>Pilots</h3></div>
      <form id="firmPilotForm" class="firm-form"><label>Firm<select name="organization_id" required><option value="">Choose firm</option>${firmState.organizations.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></label><label>Pilot name<input name="name" value="90-day lawyer performance pilot" required></label><div class="firm-dates"><label>Start<input name="start_date" type="date"></label><label>End<input name="end_date" type="date"></label></div><label>Capacity<input name="capacity" type="number" min="5" max="100" value="10" required></label><button class="btn primary" ${firmState.organizations.length ? '' : 'disabled'}>Create pilot</button></form>
      <div class="firm-list">${firmState.pilots.map(p => `<button type="button" data-pilot-id="${esc(p.id)}" class="firm-pilot-choice ${p.id === firmState.selected ? 'active' : ''}"><b>${esc(p.name)}</b><small>${esc(firmState.organizations.find(o => o.id === p.organization_id)?.name || '')} · ${esc(p.status)}</small></button>`).join('') || '<p class="muted">No pilots created yet.</p>'}</div></section></div>
    ${pilot ? `<section class="panel"><div class="panel-head"><div><h3>${esc(org?.name || 'Firm')} · roster</h3><span class="sub">${activeRoster.length}/${pilot.capacity} participants · ${roster.filter(m => firmState.consents.some(c => c.participant_id === m.id)).length} consented</span></div><span class="pill">${esc(pilot.status)}</span></div>
      <form id="firmPilotEditForm" class="firm-form"><h4>Pilot settings</h4><label>Pilot name<input name="name" value="${esc(pilot.name)}" maxlength="160" required></label><div class="firm-dates"><label>Start<input name="start_date" type="date" value="${esc(pilot.start_date||'')}"></label><label>End<input name="end_date" type="date" value="${esc(pilot.end_date||'')}"></label></div><label>Places<input name="capacity" type="number" min="${Math.max(5,activeRoster.length)}" max="100" value="${pilot.capacity}" required></label><label>Status<select name="status">${['planning','inviting','active','complete'].map(status=>`<option value="${status}" ${status===pilot.status?'selected':''}>${title(status)}</option>`).join('')}</select></label><button class="btn primary">Save pilot settings</button></form>
      <p class="muted">Readiness: ${activeRoster.filter(m=>state.clients.find(c=>c.id===m.client_id)?.profile_id).length} linked logins · ${roster.filter(m=>firmState.consents.some(c=>c.participant_id===m.id)).length} consents · ${firmState.resources.filter(r=>r.pilot_id===pilot.id&&r.published).length} published resources. Create a client and link their login in the client roster before adding them here. Adding a participant does not send an email.</p>
      <form id="firmMemberForm" class="firm-member-form"><label>Add existing coaching client<select name="client_id" required><option value="">Choose client</option>${state.clients.filter(c => (state.preview||c.profile_id) && !roster.some(m => m.client_id === c.id)).map(c => `<option value="${esc(c.id)}">${esc(c.display_name)}</option>`).join('')}</select></label><button class="btn primary" ${activeRoster.length >= pilot.capacity || pilot.status==='complete' ? 'disabled' : ''}>Add to pilot</button></form>
      <details><summary>Create a new participant and private login</summary><form id="firmNewParticipantForm" class="firm-form"><label>Full name<input name="full_name" maxlength="160" required></label><label>Email<input name="email" type="email" required></label><label>Phone (optional)<input name="phone" type="tel"></label><label>Temporary password<input name="password" type="password" minlength="12" autocomplete="new-password" required></label><label>Region<select name="market_region"><option value="ireland">Ireland</option><option value="uk">UK</option><option value="us">USA</option><option value="other">Other</option></select></label><label>Goal (optional)<textarea name="goal_summary" rows="2"></textarea></label><p class="muted">Creates one private account linked to this pilot. First sign-in opens legal consent and onboarding. Collect weight and lifestyle details privately during onboarding. Share login details directly with the participant; no email is sent.</p><button class="btn primary" ${activeRoster.length>=pilot.capacity||pilot.status==='complete'?'disabled':''}>Create participant + login</button><p id="firmNewParticipantError" role="alert"></p></form></details>
      <div class="firm-list">${roster.map(m => { const c = state.clients.find(x => x.id === m.client_id); const consent = firmState.consents.find(x => x.participant_id === m.id); return `<div><b>${esc(c?.display_name || 'Client')}</b><small>${esc(m.status)} · ${consent ? 'Consented' : 'Awaiting participant consent'}</small><button class="btn ghost small" type="button" data-firm-client="${esc(m.client_id)}">Open coaching workspace</button><button class="btn ghost small" data-firm-client="${esc(m.client_id)}" data-review-tab="training">Training</button><button class="btn ghost small" data-firm-client="${esc(m.client_id)}" data-review-tab="nutrition">Nutrition</button><button class="btn ghost small" data-firm-client="${esc(m.client_id)}" data-review-tab="planner">Planner</button><button class="btn ghost small" data-firm-client="${esc(m.client_id)}" data-review-tab="check-ins">Check-ins</button><button class="btn ghost small" data-firm-client="${esc(m.client_id)}" data-review-tab="progress">Progress</button></div>`; }).join('') || '<p class="muted">No participants yet. Add an existing client; their individual coaching stays private.</p>'}</div></section>
      ${firmWeeklyReportMarkup(weeklyReport)}${firmPilotReport(pilot, report)}
      <section class="panel"><h3>Firm resource library</h3><p class="muted">Tailor each resource to ${esc(org?.name || 'this firm')} and its ${pilot.capacity}-place pilot. Only published resources appear for members. No resource is sent automatically.</p>
        <form id="firmResourceForm" class="firm-form"><label>Title<input name="title" maxlength="160" required></label><label>Topic<input name="topic" maxlength="80" required></label><label>Short description<textarea name="summary" minlength="10" maxlength="500" required></textarea></label><label>Practical guidance<textarea name="body" rows="6" minlength="30" required></textarea></label><button class="btn primary">Save draft</button></form>
        <div class="firm-list">${firmState.resources.filter(r => r.pilot_id === pilot.id).map(r => `<article><b>${esc(r.title)}</b><small>${esc(r.topic)} · ${r.published ? 'Published to members' : 'Draft'}</small><p>${esc(r.summary)}</p><button class="btn ghost small" type="button" data-resource-publish="${esc(r.id)}">${r.published ? 'Unpublish' : 'Publish to members'}</button></article>`).join('') || '<p class="muted">No firm resources yet. Start with one of the ideas below.</p>'}</div>
        <h4>Ideas to tailor</h4><div class="firm-list">${firmResourceIdeas.map((idea, i) => `<button type="button" data-resource-idea="${i}"><b>${esc(idea[0])}</b><small>${esc(idea[1])}</small></button>`).join('')}</div>
      </section><section class="panel"><h3>Coaching cadence</h3><p>Monthly coaching calls, weekly check-ins, and a 5–10 minute Loom review with clear next steps. Assessments at baseline, midpoint, and endline feed the aggregate report.</p></section>` : ''}`;
  $$('[data-firm-client]').forEach(button=>button.onclick=()=>openFirmClient(button.dataset.firmClient,button.dataset.reviewTab||'overview'));
  $('#firmProgrammeBriefForm')?.addEventListener('submit',saveFirmProgrammeBrief);
  $('#firmOrganizationForm').onsubmit = saveFirmOrganization;
  $('#firmPilotForm').onsubmit = saveFirmPilot;
  $('#firmNewParticipantForm') && ($('#firmNewParticipantForm').onsubmit = createFirmParticipant);
  $('#firmPilotEditForm') && ($('#firmPilotEditForm').onsubmit = updateFirmPilot);
  $('#firmMemberForm') && ($('#firmMemberForm').onsubmit = saveFirmMember);
  $('#firmResourceForm') && ($('#firmResourceForm').onsubmit = saveFirmResource);
  $$('[data-resource-idea]').forEach(button => button.onclick = () => {
    const [name, topic, summary, body] = firmResourceIdeas[Number(button.dataset.resourceIdea)];
    const form = $('#firmResourceForm');
    form.elements.title.value = name; form.elements.topic.value = topic;
    form.elements.summary.value = summary; form.elements.body.value = body;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $$('[data-resource-publish]').forEach(button => button.onclick = () => toggleFirmResource(button));
  $$('[data-pilot-id]').forEach(button => button.onclick = () => { firmState.selected = button.dataset.pilotId; paintFirmPilots().catch(error => renderError(main, error, renderFirmPilots)); });
}

function firmDeliveryMarkup(pilot,roster,checkins){
  const linked=roster.filter(m=>state.clients.find(c=>c.id===m.client_id)?.profile_id).length;
  const ready=roster.filter(m=>firmState.consents.some(c=>c.participant_id===m.id)).length;
  const unreviewed=checkins.filter(c=>!c.reviewed_at);
  const date=days=>pilot.start_date?fmt(iso(new Date(+new Date(pilot.start_date+'T12:00:00Z')+days*864e5))):'Set launch date';
  return `<section class="panel firm-delivery"><div class="panel-head"><div><span class="eyebrow">DELIVERY OVERVIEW</span><h3>One cohort. A clear service rhythm.</h3><span class="sub">Coach-only operations. Individual information stays out of the sponsor report.</span></div></div><div class="firm-operations">${[[roster.length,'Enrolled'],[linked,'Linked logins'],[ready,'Reporting consents'],[unreviewed.length,'Reviews due this week']].map(([value,label])=>`<article><strong>${value}</strong><small>${label}</small></article>`).join('')}</div><div class="firm-calendar">${[['Launch / baseline',date(0)],['First monthly call',date(28)],['Midpoint',date(42)],['Second monthly call',date(56)],['Endline / continuation',pilot.end_date?fmt(pilot.end_date):date(84)]].map(([name,when])=>`<article><b>${name}</b><small>${esc(when)}</small></article>`).join('')}</div><p class="muted">Thursday: participant check-in. Friday / Saturday: personal Loom and up to three priorities. Every four weeks: private 30-minute call. Milestone dates are planning references; calls and reminders are not automatically booked or sent.</p><h4>Private weekly review queue</h4>${unreviewed.length?unreviewed.map(c=>`<div class="firm-review-item"><div><b>${esc(state.clients.find(x=>x.id===c.client_id)?.display_name||'Client')}</b><small>Submitted ${fmt(c.submitted_at)} · awaiting review</small></div><button class="btn ghost small" data-firm-client="${esc(c.client_id)}" data-review-tab="check-ins">Open check-in</button></div>`).join(''):'<p class="muted">No unreviewed check-ins submitted this week. This does not indicate that every participant has checked in.</p>'}</section>`;
}
async function openFirmClient(id,tab){
  const client=state.clients.find(c=>c.id===id);if(!client)return toast('Client is unavailable','error');
  state.client=client;state.clientTab=COACH_TABS.includes(tab)?tab:'overview';state.selectedNutritionPlanId=null;state.data=emptyData();
  try{if(state.preview)state.data=state.sampleClientData?.get(id)||demoData();else await loadClientData(id);renderCoach();}
  catch(error){state.client=null;toast(error.message,'error');renderCoach();}
}

async function saveFirmResource(event) {
  event.preventDefault(); const button = event.submitter; const fd = new FormData(event.target);
  const row = { pilot_id: firmState.selected, title: String(fd.get('title')).trim(), topic: String(fd.get('topic')).trim(), summary: String(fd.get('summary')).trim(), body: String(fd.get('body')).trim(), published: false };
  setBusy(button, true);
  try {
    if (state.preview) row.id = `preview-resource-${Date.now()}`;
    else Object.assign(row, (await query('Firm resource', db.from('firm_resources').insert(row).select()))[0]);
    firmState.resources.unshift(row); await paintFirmPilots(); toast('Firm resource saved as a draft');
  } catch (error) { toast(error.message, 'error'); setBusy(button, false); }
}

async function toggleFirmResource(button) {
  const resource = firmState.resources.find(r => r.id === button.dataset.resourcePublish);
  if (!resource) return;
  const published = !resource.published;
  setBusy(button, true);
  try {
    if (!state.preview) await query('Firm resource', db.from('firm_resources').update({ published, published_at: published ? new Date().toISOString() : null }).eq('id', resource.id).select());
    resource.published = published; await paintFirmPilots(); toast(published ? 'Published to pilot members' : 'Resource unpublished');
  } catch (error) { toast(error.message, 'error'); setBusy(button, false); }
}

async function saveFirmOrganization(event) {
  event.preventDefault(); const button = event.submitter; const fd = new FormData(event.target);
  const row = { coach_id: state.user?.id, name: String(fd.get('name')).trim(), employee_count: fd.get('employee_count') ? Number(fd.get('employee_count')) : null, contact_name: String(fd.get('contact_name') || '').trim() || null, contact_email: String(fd.get('contact_email') || '').trim() || null };
  setBusy(button, true);
  try { if (state.preview) row.id = `preview-firm-${Date.now()}`; else Object.assign(row, (await query('Firm', db.from('firm_organizations').insert(row).select()))[0]); firmState.organizations.unshift(row); await paintFirmPilots(); toast('Firm saved'); }
  catch (error) { toast(error.message, 'error'); setBusy(button, false); }
}

async function saveFirmPilot(event) {
  event.preventDefault(); const button = event.submitter; const fd = new FormData(event.target);
  const row = { coach_id: state.user?.id, organization_id: fd.get('organization_id'), name: String(fd.get('name')).trim(), start_date: fd.get('start_date') || null, end_date: fd.get('end_date') || null, capacity: Number(fd.get('capacity')), minimum_report_count: 5, status: 'planning' };
  try { validateFirmPilot(row); } catch(error) { return toast(error.message,'error'); }
  setBusy(button, true);
  try { if (state.preview) row.id = `preview-pilot-${Date.now()}`; else Object.assign(row, (await query('Pilot', db.from('firm_pilots').insert(row).select()))[0]); firmState.pilots.unshift(row); firmState.selected = row.id; await paintFirmPilots(); toast('Pilot created'); }
  catch (error) { toast(error.message, 'error'); setBusy(button, false); }
}

function validateFirmPilot(row) {
  const org=firmState.organizations.find(o=>o.id===row.organization_id);
  if(!row.name || !Number.isInteger(row.capacity) || row.capacity<5 || row.capacity>100) throw new Error('Enter a pilot name and 5–100 places.');
  if(org?.employee_count && row.capacity>org.employee_count) throw new Error('Pilot places cannot exceed firm employees.');
  if(row.start_date && row.end_date && row.end_date<row.start_date) throw new Error('End date must follow the start date.');
  if(row.status==='active' && (!row.start_date||!row.end_date)) throw new Error('Set start and end dates before activating the pilot.');
}
async function updateFirmPilot(event) {
  event.preventDefault();const fd=new FormData(event.target),pilot=firmState.pilots.find(p=>p.id===firmState.selected);
  const patch={name:String(fd.get('name')).trim(),start_date:fd.get('start_date')||null,end_date:fd.get('end_date')||null,capacity:Number(fd.get('capacity')),status:fd.get('status')};
  try {
    validateFirmPilot({...pilot,...patch});
    if(patch.capacity<firmState.participants.filter(m=>m.pilot_id===pilot.id&&m.status!=='withdrawn').length) throw new Error('Capacity cannot be below the active roster.');
    setBusy(event.submitter,true);
    if(!state.preview){const [saved]=await query('Pilot settings',db.from('firm_pilots').update(patch).eq('id',pilot.id).select());if(!saved)throw new Error('Pilot was not updated. Reload and try again.');}
    Object.assign(pilot,patch);await paintFirmPilots();toast('Pilot settings saved');
  }catch(error){toast(error.message,'error');setBusy(event.submitter,false);}
}

async function createFirmParticipant(event){
  event.preventDefault();const fd=new FormData(event.target),button=event.submitter;
  const payload={pilot_id:firmState.selected,full_name:String(fd.get('full_name')).trim(),email:String(fd.get('email')).trim(),password:String(fd.get('password')),phone:String(fd.get('phone')||'').trim(),market_region:fd.get('market_region'),goal_summary:String(fd.get('goal_summary')||'').trim()};
  const pilot=firmState.pilots.find(p=>p.id===payload.pilot_id);
  if(!pilot||pilot.status==='complete'||firmState.participants.filter(m=>m.pilot_id===pilot.id&&m.status!=='withdrawn').length>=pilot.capacity)return toast('This pilot is closed or full','error');
  setBusy(button,true,'Creating participant…');
  try{
    if(state.preview){
      const id=`preview-client-${Date.now()}`;
      state.clients.unshift({id,display_name:payload.full_name,email:payload.email,status:'active',profile_id:'demo-profile',onboarding_status:'pending_legal'});
      firmState.participants.unshift({id:`preview-member-${Date.now()}`,pilot_id:pilot.id,client_id:id,status:'invited'});
    }else{
      const {data,error}=await db.functions.invoke('provision-client',{body:payload});
      if(error){let detail=error.message;try{detail=(await error.context.json()).error||detail;}catch{}throw new Error(detail);}
      if(data?.error)throw new Error(data.error);
      if(!data?.client||!data?.participant)throw new Error('Account response incomplete. Check the client roster before retrying.');
      state.clients.unshift(normalizeClient(data.client));firmState.participants.unshift(data.participant);
    }
    event.target.reset();payload.password='';await paintFirmPilots();toast(state.preview?'Sample participant added; no account created':'Participant login created. Share access privately.');
  }catch(error){$('#firmNewParticipantError').textContent=error.message;toast(error.message,'error');setBusy(button,false);}
}

async function saveFirmMember(event) {
  event.preventDefault(); const button = event.submitter; const fd = new FormData(event.target);
  const row = { pilot_id: firmState.selected, client_id: fd.get('client_id'), status: 'invited' };
  const pilot=firmState.pilots.find(p=>p.id===row.pilot_id),client=state.clients.find(c=>c.id===row.client_id);
  if(!client || (!state.preview&&!client.profile_id))return toast('Link a private client login before adding this participant','error');
  if(pilot.status==='complete'||firmState.participants.filter(m=>m.pilot_id===pilot.id&&m.status!=='withdrawn').length>=pilot.capacity)return toast('This pilot is closed or full','error');
  setBusy(button, true);
  try { if (state.preview) row.id = `preview-member-${Date.now()}`; else Object.assign(row, (await query('Pilot participant', db.from('firm_participants').insert(row).select()))[0]); firmState.participants.unshift(row); await paintFirmPilots(); toast('Client added to pilot'); }
  catch (error) { toast(error.message, 'error'); setBusy(button, false); }
}

function firmAssessmentOpens(phase,pilot){
  if(phase==='baseline')return null;
  const base=phase==='midpoint'?pilot.start_date:(pilot.end_date||pilot.start_date);
  if(!base)return '';
  const offset=phase==='midpoint'?35:(pilot.end_date?-7:77);
  return iso(new Date(+new Date(base+'T12:00:00Z')+offset*864e5));
}
async function renderParticipantPilot() {
  const main = $('#clientMain');
  main.innerHTML = pageHead('FIRM PILOT', 'Your pilot') + '<section class="panel">Loading…</section>';
  try {
    if (state.preview) { main.innerHTML = pageHead('FIRM PILOT', 'Your pilot') + '<section class="panel"><h3>Private coaching</h3><p>If your firm sponsors a pilot, its invitation and optional assessments appear here. Your coaching records remain private.</p></section>'; return; }
    const memberships = await query('Your pilot', db.from('firm_participants').select('*').eq('client_id', state.client.id).order('joined_at',{ascending:false}));
    if (!memberships.length) { main.innerHTML = pageHead('FIRM PILOT', 'Your pilot') + '<section class="panel"><p>No firm pilot invitation is linked to your account.</p></section>'; return; }
    const member = memberships.find(m=>m.status!=='withdrawn')||memberships[0];
    const [pilot] = await query('Pilot', db.from('firm_pilots').select('id,name,start_date,end_date,organization_id').eq('id', member.pilot_id));
    const [org] = pilot ? await query('Firm', db.from('firm_organizations').select('name').eq('id', pilot.organization_id)) : [];
    const [consents, assessments, resources] = await Promise.all([
      query('Pilot consent', db.from('firm_consents').select('*').eq('participant_id', member.id)),
      query('Your assessments', db.from('firm_assessments').select('phase,submitted_at').eq('participant_id', member.id)),
      query('Your firm resources', db.from('firm_resources').select('title,topic,summary,body,created_at').eq('pilot_id', member.pilot_id).eq('published', true).order('created_at', { ascending: false }))
    ]);
    main.innerHTML = pageHead('FIRM PILOT', pilot?.name || 'Your pilot') + `<section class="panel"><div class="panel-head"><div><h3>${esc(org?.name || 'Firm-sponsored coaching')}</h3><span class="sub">${fmt(pilot?.start_date)} – ${fmt(pilot?.end_date)}</span></div></div><p>Your individual training, nutrition, check-ins, messages and health records are private to you and your coach. The firm receives group assessment averages only when at least five people respond. You can separately opt into weekly group energy, sleep and stress ratings; your written check-in answers remain private.</p>
      ${member.status === 'withdrawn' ? '<p>This invitation has been withdrawn.</p>' : consents.length ? '<p class="pill">Aggregate reporting consent recorded</p>' : '<label><input type="checkbox" id="weeklyReportingConsent"> Include my energy, sleep and stress check-in ratings in weekly anonymous group averages. Written answers, goals and body data stay private.</label><button class="btn primary" id="acceptFirmConsent">I agree to anonymous assessment reporting</button>'}</section>
      ${member.status !== 'withdrawn' ? `<section class="panel"><div class="panel-head"><div><h3>Resources for ${esc(org?.name || 'your firm')}</h3><span class="sub">Practical guidance selected by your coach for this pilot.</span></div></div>${resources.map(r => `<article class="firm-resource"><span class="eyebrow">${esc(r.topic)}</span><h4>${esc(r.title)}</h4><p>${esc(r.summary)}</p><div class="resource-body">${esc(r.body).replaceAll('\n', '<br>')}</div></article>`).join('') || '<p class="muted">Your coach has not published any firm resources yet.</p>'}</section>` : ''}
      ${consents.length && member.status !== 'withdrawn' ? `<section class="panel"><h3>Short assessments</h3><p>Rate each from 1 to 10. Your individual answers stay private.</p>${firmPhases.map(phase => assessments.some(a => a.phase === phase) ? `<p>${title(phase)} submitted</p>` : (firmAssessmentOpens(phase,pilot)===''||firmAssessmentOpens(phase,pilot)>iso(new Date())) ? `<p class="muted">${title(phase)} ${firmAssessmentOpens(phase,pilot)?'opens '+fmt(firmAssessmentOpens(phase,pilot)):'will open once programme dates are confirmed'}.</p>` : `<form class="firm-assessment" data-phase="${phase}"><h4>${title(phase)}</h4><div class="firm-score-grid">${['energy','sleep','stress','workload','consistency'].map(key => `<label>${title(key)}<input name="${key}" type="number" min="1" max="10" required></label>`).join('')}</div><button class="btn primary">Submit ${phase}</button></form>`).join('')}</section>` : ''}`;
    $('#acceptFirmConsent') && ($('#acceptFirmConsent').onclick = async () => {
      try { await query('Pilot consent', db.from('firm_consents').insert({ participant_id: member.id, client_id: state.client.id,include_weekly_ratings:!!$('#weeklyReportingConsent')?.checked }).select()); toast('Consent recorded'); renderParticipantPilot(); }
      catch (error) { toast(error.message, 'error'); }
    });
    $$('.firm-assessment').forEach(form => form.onsubmit = async event => {
      event.preventDefault(); const button = event.submitter; const fd = new FormData(form);
      const row = { participant_id: member.id, client_id: state.client.id, phase: form.dataset.phase };
      for (const key of ['energy','sleep','stress','workload','consistency']) row[key] = Number(fd.get(key));
      setBusy(button, true);
      try { await query('Assessment', db.from('firm_assessments').insert(row).select()); toast('Assessment saved'); renderParticipantPilot(); }
      catch (error) { toast(error.message, 'error'); setBusy(button, false); }
    });
  } catch (error) { renderError(main, error, renderParticipantPilot); }
}


function firmWeeklyReportMarkup(report){
 if(!report)return '';
 return `<section class="panel"><h3>Weekly group check-in draft</h3><p>Week beginning ${fmt(report.week_start)} · ${report.respondents} consenting respondents. Uses one latest response per person; excludes responses before consent or pilot enrolment.</p><div class="firm-operations">${[['energy','Energy'],['sleep','Sleep quality'],['stress','Stress']].map(([key,label])=>`<article><strong>${report[key]==null?'Withheld':esc(report[key])+'/10'}</strong><small>${label} · ${report[key+'_count']} valid responses</small></article>`).join('')}</div><p class="muted">Each metric needs ${report.minimum_count} valid responses. Only participants who explicitly opt into weekly ratings are included. Written answers, weight, goals and private feedback never appear here. Employer accounts see consented group reports through their private portal. Reports refresh automatically while open; no report email is sent.</p></section>`;
}

function firmProgrammeBriefMarkup(pilot){
 const brief=firmState.briefs.find(b=>b.pilot_id===pilot.id)||{};
 return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">COMPANY OBJECTIVES</span><h3>Agree what this pilot needs to deliver</h3><span class="sub">Saved separately for this pilot. Coach-only working brief; no employer access or automatic sharing.</span></div></div><form id="firmProgrammeBriefForm" class="firm-form" data-brief-pilot-id="${esc(pilot.id)}"><label>What does the firm want to improve?<textarea name="objective" minlength="10" maxlength="2000" required placeholder="For example: practical support for volunteers during deadline and travel weeks.">${esc(brief.objective||'')}</textarea></label><label>Success criteria agreed before launch<textarea name="success_criteria" minlength="10" maxlength="3000" required placeholder="Specify activation and response coverage targets, the measures to review, and delivery commitments.">${esc(brief.success_criteria||'')}</textarea></label><label>Working patterns and delivery constraints<textarea name="constraints" maxlength="3000" placeholder="Office locations, shift patterns, busy periods, eligible volunteers and available coaching capacity.">${esc(brief.constraints||'')}</textarea></label><label>Pilot review date<input type="date" name="review_date" value="${esc(brief.review_date||'')}"></label><label>Continuation recommendation<select name="recommendation">${[['pending','Pending evidence review'],['continue','Continue'],['adjust','Adjust programme'],['pause','Pause expansion']].map(([key,label])=>`<option value="${key}" ${brief.recommendation===key?'selected':''}>${label}</option>`).join('')}</select></label><label>Next action and evidence supporting it<textarea name="next_action" maxlength="3000" placeholder="Record the decision owner, next step and limitations. Do not include private participant records.">${esc(brief.next_action||'')}</textarea></label><button class="btn primary">Save firm brief</button><p class="muted">Use participation, agreed delivery and eligible group assessments to review the pilot. Company productivity, absence, retention and financial return need separate evidence; they are not calculated from personal check-ins.</p></form></section>`;
}
async function saveFirmProgrammeBrief(event){
 event.preventDefault();const form=event.currentTarget,button=event.submitter,pilotId=form.dataset.briefPilotId,fd=new FormData(form);
 const row={pilot_id:pilotId,objective:String(fd.get('objective')||'').trim(),success_criteria:String(fd.get('success_criteria')||'').trim(),constraints:String(fd.get('constraints')||'').trim(),review_date:fd.get('review_date')||null,recommendation:fd.get('recommendation'),next_action:String(fd.get('next_action')||'').trim(),updated_at:new Date().toISOString()};
 if(row.objective.length<10||row.success_criteria.length<10)return toast('Add the firm objective and measurable success criteria','error');
 setBusy(button,true);
 try{
  const saved=state.preview?row:(await query('Firm programme brief',db.from('firm_programme_briefs').upsert(row,{onConflict:'pilot_id'}).select()))[0];
  if(!saved)throw new Error('Brief was not saved. Reload and try again.');
  const old=firmState.briefs.find(b=>b.pilot_id===pilotId);if(old)Object.assign(old,saved);else firmState.briefs.push(saved);
  if(state.coachView==='firms'&&!state.client&&firmState.selected===pilotId)await paintFirmPilots();
  toast(state.preview?'Sample firm brief updated; reload resets it':'Firm brief saved');
 }catch(error){toast(error.message,'error');setBusy(button,false);}
}
