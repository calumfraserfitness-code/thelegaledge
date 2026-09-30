// Coach-operated firm pilot workflow. Sponsor output is aggregate-only.
const firmState = { organizations: [], pilots: [], participants: [], consents: [], resources: [], selected: null, loaded: false };
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
    const [organizations, pilots, participants, consents, resources] = await Promise.all([
      query('Firms', db.from('firm_organizations').select('*').order('created_at', { ascending: false })),
      query('Firm pilots', db.from('firm_pilots').select('*').order('created_at', { ascending: false })),
      query('Pilot roster', db.from('firm_participants').select('*').order('joined_at', { ascending: false })),
      query('Pilot consents', db.from('firm_consents').select('participant_id,accepted_at')),
      query('Firm resources', db.from('firm_resources').select('*').order('created_at', { ascending: false }))
    ]);
    Object.assign(firmState, { organizations, pilots, participants, consents, resources });
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
  main.innerHTML = pageHead('FIRM PILOTS', 'Pilot workspace') + '<section class="panel">Loading firm pilots…</section>';
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
  main.innerHTML = pageHead('FIRM PILOTS', 'Pilot workspace') + `
    <div class="firm-intro"><div><strong>90-day lawyer performance pilot</strong><p>Private coaching for each participant, with anonymous cohort reporting for the sponsor.</p></div><span>Coach only</span></div>
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
      <div class="firm-list">${roster.map(m => { const c = state.clients.find(x => x.id === m.client_id); const consent = firmState.consents.find(x => x.participant_id === m.id); return `<div><b>${esc(c?.display_name || 'Client')}</b><small>${esc(m.status)} · ${consent ? 'Consented' : 'Awaiting participant consent'}</small></div>`; }).join('') || '<p class="muted">No participants yet. Add an existing client; their individual coaching stays private.</p>'}</div></section>
      ${firmPilotReport(pilot, report)}
      <section class="panel"><h3>Firm resource library</h3><p class="muted">Tailor each resource to ${esc(org?.name || 'this firm')} and its ${pilot.capacity}-place pilot. Only published resources appear for members. No resource is sent automatically.</p>
        <form id="firmResourceForm" class="firm-form"><label>Title<input name="title" maxlength="160" required></label><label>Topic<input name="topic" maxlength="80" required></label><label>Short description<textarea name="summary" minlength="10" maxlength="500" required></textarea></label><label>Practical guidance<textarea name="body" rows="6" minlength="30" required></textarea></label><button class="btn primary">Save draft</button></form>
        <div class="firm-list">${firmState.resources.filter(r => r.pilot_id === pilot.id).map(r => `<article><b>${esc(r.title)}</b><small>${esc(r.topic)} · ${r.published ? 'Published to members' : 'Draft'}</small><p>${esc(r.summary)}</p><button class="btn ghost small" type="button" data-resource-publish="${esc(r.id)}">${r.published ? 'Unpublish' : 'Publish to members'}</button></article>`).join('') || '<p class="muted">No firm resources yet. Start with one of the ideas below.</p>'}</div>
        <h4>Ideas to tailor</h4><div class="firm-list">${firmResourceIdeas.map((idea, i) => `<button type="button" data-resource-idea="${i}"><b>${esc(idea[0])}</b><small>${esc(idea[1])}</small></button>`).join('')}</div>
      </section><section class="panel"><h3>Coaching cadence</h3><p>Monthly coaching calls, weekly check-ins, and a 5–10 minute Loom review with clear next steps. Assessments at baseline, midpoint, and endline feed the aggregate report.</p></section>` : ''}`;
  $('#firmOrganizationForm').onsubmit = saveFirmOrganization;
  $('#firmPilotForm').onsubmit = saveFirmPilot;
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

async function renderParticipantPilot() {
  const main = $('#clientMain');
  main.innerHTML = pageHead('FIRM PILOT', 'Your pilot') + '<section class="panel">Loading…</section>';
  try {
    if (state.preview) { main.innerHTML = pageHead('FIRM PILOT', 'Your pilot') + '<section class="panel"><h3>Private coaching</h3><p>If your firm sponsors a pilot, its invitation and optional assessments appear here. Your coaching records remain private.</p></section>'; return; }
    const memberships = await query('Your pilot', db.from('firm_participants').select('*').eq('client_id', state.client.id));
    if (!memberships.length) { main.innerHTML = pageHead('FIRM PILOT', 'Your pilot') + '<section class="panel"><p>No firm pilot invitation is linked to your account.</p></section>'; return; }
    const member = memberships[0];
    const [pilot] = await query('Pilot', db.from('firm_pilots').select('id,name,start_date,end_date,organization_id').eq('id', member.pilot_id));
    const [org] = pilot ? await query('Firm', db.from('firm_organizations').select('name').eq('id', pilot.organization_id)) : [];
    const [consents, assessments, resources] = await Promise.all([
      query('Pilot consent', db.from('firm_consents').select('*').eq('participant_id', member.id)),
      query('Your assessments', db.from('firm_assessments').select('phase,submitted_at').eq('participant_id', member.id)),
      query('Your firm resources', db.from('firm_resources').select('title,topic,summary,body,created_at').eq('pilot_id', member.pilot_id).eq('published', true).order('created_at', { ascending: false }))
    ]);
    main.innerHTML = pageHead('FIRM PILOT', pilot?.name || 'Your pilot') + `<section class="panel"><div class="panel-head"><div><h3>${esc(org?.name || 'Firm-sponsored coaching')}</h3><span class="sub">${fmt(pilot?.start_date)} – ${fmt(pilot?.end_date)}</span></div></div><p>Your training, nutrition, check-ins, messages and health records are private to you and your coach. The firm receives only anonymous group averages when at least five participants answer an assessment.</p>
      ${member.status === 'withdrawn' ? '<p>This invitation has been withdrawn.</p>' : consents.length ? '<p class="pill">Aggregate reporting consent recorded</p>' : '<button class="btn primary" id="acceptFirmConsent">I agree to anonymous group reporting</button>'}</section>
      ${member.status !== 'withdrawn' ? `<section class="panel"><div class="panel-head"><div><h3>Resources for ${esc(org?.name || 'your firm')}</h3><span class="sub">Practical guidance selected by your coach for this pilot.</span></div></div>${resources.map(r => `<article class="firm-resource"><span class="eyebrow">${esc(r.topic)}</span><h4>${esc(r.title)}</h4><p>${esc(r.summary)}</p><div class="resource-body">${esc(r.body).replaceAll('\n', '<br>')}</div></article>`).join('') || '<p class="muted">Your coach has not published any firm resources yet.</p>'}</section>` : ''}
      ${consents.length && member.status !== 'withdrawn' ? `<section class="panel"><h3>Short assessments</h3><p>Rate each from 1 to 10. Your individual answers stay private.</p>${firmPhases.map(phase => assessments.some(a => a.phase === phase) ? `<p>${title(phase)} submitted</p>` : `<form class="firm-assessment" data-phase="${phase}"><h4>${title(phase)}</h4><div class="firm-score-grid">${['energy','sleep','stress','workload','consistency'].map(key => `<label>${title(key)}<input name="${key}" type="number" min="1" max="10" required></label>`).join('')}</div><button class="btn primary">Submit ${phase}</button></form>`).join('')}</section>` : ''}`;
    $('#acceptFirmConsent') && ($('#acceptFirmConsent').onclick = async () => {
      try { await query('Pilot consent', db.from('firm_consents').insert({ participant_id: member.id, client_id: state.client.id }).select()); toast('Consent recorded'); renderParticipantPilot(); }
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

