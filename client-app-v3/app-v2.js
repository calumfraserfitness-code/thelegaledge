const SUPABASE_URL = 'https://baxvhilvrhshlfizakak.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DRoPSo_3TPlU8mMeLQNruw_82hanHNi';
const db = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY) ?? null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const iso = (date) => new Date(date).toISOString().slice(0, 10);
const fmt = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) => value
  ? new Date(value + (String(value).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-IE', options)
  : '—';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const title = (value) => String(value || '').replace(/\b\w/g, (letter) => letter.toUpperCase());
const monday = (value = new Date()) => {
  const date = new Date(value);
  const day = date.getDay();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
};

const state = {
  user: null,
  profile: null,
  role: null,
  preview: false,
  coachView: 'dashboard',
  clientView: 'planner',
  selectedSessionId: null,
  selectedNutritionPlanId: null,
  trainingCategory: 'weights',
  progressRange: 'all',
  clientTab: 'overview',
  clients: [],
  client: null,
  data: emptyData(),
  saveTimer: null
};

function emptyData() {
  return {
    weeks: [], sessions: [], exercises: [], programs: [], nutritionPlans: [],
    nutritionDays: [], meals: [], habits: [], habitLogs: [], steps: [],
    checkins: [], progress: [], onboarding: [], legal: [], diagnostics: [], files: [],
    mealAssignments: [], exerciseLogs: []
  };
}

function toast(message, tone = '') {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
}

function show(selector) {
  ['#auth', '#coachApp', '#clientApp'].forEach((id) => $(id)?.classList.add('hidden'));
  $(selector)?.classList.remove('hidden');
}

function setBusy(button, busy, label = 'Saving…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

function renderError(container, error, retry) {
  console.error(error);
  container.innerHTML = `<section class="panel error-state"><h2>Something went wrong</h2><p>${esc(error?.message || error)}</p><button class="btn primary" id="retryView">Try again</button></section>`;
  $('#retryView').onclick = retry;
}

function displayWeight(kg, signed = false) {
  if (kg == null || kg === '') return '—';
  const factor = state.client?.weight_unit === 'lbs' ? 2.2046226218 : 1;
  const unit = state.client?.weight_unit === 'lbs' ? 'lb' : 'kg';
  const value = Number(kg) * factor;
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)} ${unit}`;
}

function currentWeek() {
  return state.data.weeks.find((week) => {
    const start = new Date(`${week.week_start}T12:00:00`);
    const end = new Date(+start + 7 * 864e5);
    return new Date() >= start && new Date() < end;
  }) || state.data.weeks[0] || null;
}

function safeStepGoal(client = state.client) {
  return Math.max(8000, Number(client?.daily_steps_goal || 0));
}
function normalizeClient(client){return {...client,display_name:client.display_name||client.profile?.full_name||'Unnamed client',daily_steps_goal:safeStepGoal(client)};}

async function query(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
}

async function loadCoach() {
  const clients = await query('Clients', db.from('clients')
    .select('*,profile:profiles!clients_profile_id_fkey(full_name,email)')
    .order('start_date'));
  state.clients = clients.map(normalizeClient);
}

async function loadClientData(clientId) {
  const clientAtStart = clientId;
  const requests = await Promise.all([
    query('Weeks', db.from('program_weeks').select('*').eq('client_id', clientId).order('week_start', { ascending: false }).limit(104)),
    query('Programmes', db.from('training_programs').select('*,days:training_program_days(*,exercises:program_exercises(*))').eq('client_id', clientId).order('created_at', { ascending: false })),
    query('Nutrition plans', db.from('nutrition_plans').select('*,meals:meal_plan_meals(*,items:meal_plan_items(*))').eq('client_id', clientId).order('created_at', { ascending: false })),
    query('Habits', db.from('habits').select('*').eq('client_id', clientId).eq('active', true).order('sort_order')),
    query('Steps', db.from('step_entries').select('*').eq('client_id', clientId).order('entry_date', { ascending: false }).limit(370)),
    query('Check-ins', db.from('checkins').select('*').eq('client_id', clientId).order('submitted_at', { ascending: false }).limit(250)),
    query('Progress', db.from('progress_entries').select('*').eq('client_id', clientId).order('entry_date', { ascending: false }).limit(500)),
    query('Onboarding', db.from('onboarding_responses').select('*').eq('client_id', clientId).order('version', { ascending: false })),
    query('Legal records', db.from('legal_consents').select('*').eq('client_id', clientId).order('created_at', { ascending: false })),
    query('Reports', db.from('diagnostic_reports').select('*').eq('client_id', clientId).order('report_date', { ascending: false })),
    query('Files', db.from('client_files').select('*').eq('client_id', clientId).order('created_at', { ascending: false })),
    query('Meal assignments', db.from('meal_assignments').select('*,meal:meal_bank(*)').eq('client_id', clientId).order('sort_order')),
    query('Exercise logs', db.from('exercise_set_logs').select('*').eq('client_id', clientId).order('performed_at', { ascending: false }).limit(1000))
  ]);
  if (state.client?.id !== clientAtStart) return;
  const [weeks, programs, nutritionPlans, habits, steps, checkins, progress, onboarding, legal, diagnostics, files, mealAssignments, exerciseLogs] = requests;
  let sessions = [];
  let exercises = [];
  let nutritionDays = [];
  let meals = [];
  if (weeks.length) {
    const ids = weeks.map((week) => week.id);
    [sessions, nutritionDays] = await Promise.all([
      query('Scheduled sessions', db.from('training_sessions').select('*').in('week_id', ids).order('session_date')),
      query('Nutrition days', db.from('nutrition_days').select('*').in('week_id', ids).order('nutrition_date'))
    ]);
    if (sessions.length) exercises = await query('Exercises', db.from('exercises').select('*').in('session_id', sessions.map((s) => s.id)).order('sort_order'));
    if (nutritionDays.length) meals = await query('Meals', db.from('meals').select('*').in('nutrition_day_id', nutritionDays.map((d) => d.id)).order('sort_order'));
  }
  if (state.client?.id !== clientAtStart) return;
  const recoveredExercises = programs.flatMap((program) => (program.days || []).flatMap((day) => day.exercises || []));
  const exerciseIndex = new Map([...recoveredExercises, ...exercises].map((exercise) => [exercise.id, exercise]));
  state.data = { weeks, programs, nutritionPlans, habits, habitLogs: [], steps, checkins, progress, onboarding, legal, diagnostics, files, mealAssignments, exerciseLogs, sessions, exercises: [...exerciseIndex.values()], nutritionDays, meals };
}

function demoData() {
  const start = monday();
  const demoExercise = { id: 'demo-exercise', program_day_id: 'demo-day', session_id: 'demo-upper', name: 'Incline dumbbell press', sets: 3, reps: '8–10', rest_seconds: 120, rpe: 8, sort_order: 0, coach_instructions: 'Control the lowering phase and stop with two strong reps in reserve.', previous_performance: '30 lb × 10, 10, 9', video_url: 'https://www.youtube.com/' };
  return {
    ...emptyData(),
    weeks: [{ id: 'demo-week', week_start: iso(start), week_number: 8, title: 'Week 8', published: true }],
    programs: [{ id: 'demo-program', name: 'Strength and performance — Phase 2', status: 'active', days: [{ id: 'demo-day', program_id: 'demo-program', title: 'Upper body', training_type: 'weights', day_index: 0, exercises: [demoExercise] }] }],
    sessions: [
      { id: 'demo-upper', week_id: 'demo-week', programme_day_id: 'demo-day', session_date: iso(start), training_type: 'weights', title: 'Upper body', status: 'planned' },
      { id: 'demo-run', week_id: 'demo-week', session_date: iso(new Date(+start + 2 * 864e5)), training_type: 'cardio', title: 'Easy run', status: 'planned', duration_minutes: 30 }
    ],
    exercises: [demoExercise],
    nutritionPlans: [{ id: 'demo-nutrition', name: 'Training day', day_type: 'Training Day', calories: 2200, protein_g: 180, carbs_g: 220, fat_g: 65, is_active: true, meals: [
      { id: 'demo-meal', name: 'Breakfast', timing: 'Morning', items: [{ id: 'demo-item', name: 'Protein oats', quantity: 1, unit: 'bowl', description: 'Oats, Greek yoghurt, berries and protein.' }] }
    ] }],
    steps: [],
    checkins: [{ id: 'demo-checkin', week_number: 7, submitted_at: iso(new Date(Date.now() - 7 * 864e5)), weight_kg: 82.1, energy: 7, sleep: 8, stress: 5, training_adherence: 90, nutrition_adherence: 85, wins: 'Completed every planned session.', challenges: 'Two late work evenings.', original_answers: { 'What was your biggest win this week?': 'Completed every planned session.', 'What made the week difficult?': 'Two late work evenings.', 'How did training feel?': 'Strength improved on every pressing exercise.' }, coach_response: 'Strong week. Keep the same structure.' }],
    progress: [{ entry_date: iso(new Date(Date.now() - 21 * 864e5)), weight_kg: 84 }, { entry_date: iso(new Date()), weight_kg: 82.1 }]
  };
}

async function boot() {
  try {
    if (!db) throw new Error('The secure connection did not load. Refresh the page.');
    const { data: { user } } = await db.auth.getUser();
    if (!user) return show('#auth');
    state.user = user;
    state.profile = await query('Profile', db.from('profiles').select('*').eq('id', user.id).single());
    state.role = state.profile.role;
    if (state.role === 'coach') {
      await loadCoach();
      $('#coachName').textContent = state.profile.full_name || 'Coach';
      show('#coachApp');
      renderCoach();
      return;
    }
    const client = await query('Client profile', db.from('clients').select('*').eq('profile_id', user.id).single());
    state.client = { ...client, display_name: state.profile.full_name, daily_steps_goal: safeStepGoal(client) };
    await loadClientData(client.id);
    $('#clientHello').textContent = state.client.display_name;
    show('#clientApp');
    renderClient();
  } catch (error) {
    console.error('[boot]', error);
    $('#authMsg').textContent = error.message || 'Unable to load your account.';
    show('#auth');
  }
}

function preview(role) {
  state.preview = true;
  state.role = role;
  const demoClient = {
    id: 'demo-client', display_name: 'Preview Client', status: 'active', weight_unit: 'lbs',
    start_weight_kg: 84, goal_weight_kg: 79, daily_steps_goal: 8000,
    cardio_enabled: true, mobility_enabled: true, checkin_day: 5, track_weight: true,
    onboarding_status: 'complete', plan_status: 'published', portal_enabled: true
  };
  state.client = role === 'client' ? demoClient : null;
  state.clients = role === 'coach' ? [demoClient] : [];
  state.data = demoData();
  if (role === 'coach') {
    state.coachView = 'dashboard';
    show('#coachApp');
    renderCoach();
  } else {
    $('#clientHello').textContent = state.client.display_name;
    show('#clientApp');
    renderClient();
  }
}

function pageHead(kicker, heading, tools = '') {
  return `<div class="page-head"><div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(heading)}</h1></div><div class="head-tools">${tools}</div></div>`;
}

function clientHeader(kicker, heading, copy) {
  return `<div class="client-page-head"><span class="eyebrow">${esc(kicker)}</span><h1>${esc(heading)}</h1><p class="muted">${esc(copy)}</p></div>`;
}

function clientRows(clients) {
  if (!clients.length) return '<div class="empty">No clients in this view.</div>';
  return clients.map((client) => `<button class="client-row" data-client-id="${client.id}">
    <span class="avatar">${esc(client.display_name.split(' ').map((part) => part[0]).slice(0, 2).join(''))}</span>
    <span><span class="name">${esc(client.display_name)}</span><span class="sub">${esc(title(client.status || 'active'))} · ${client.weight_unit === 'lbs' ? 'US / lb' : 'Ireland / kg'}</span></span>
    <span class="hide-mobile"><span class="sub">Daily steps</span>${safeStepGoal(client).toLocaleString()}</span>
    <span class="hide-mobile"><span class="sub">Goal</span>${client.track_weight === false ? 'Performance / health' : (client.goal_weight_kg ? `${Number(client.goal_weight_kg) * (client.weight_unit === 'lbs' ? 2.20462 : 1) | 0} ${client.weight_unit === 'lbs' ? 'lb' : 'kg'}` : 'Not set')}</span>
    <span class="status">Open</span>
  </button>`).join('');
}

function bindClientRows() {
  $$('[data-client-id]').forEach((row) => row.onclick = async () => {
    const client = state.clients.find((item) => item.id === row.dataset.clientId);
    if (!client) return;
    state.client = client;
    state.data = emptyData();
    state.clientTab = 'overview';
    $('#coachMain').innerHTML = '<div class="loading-state">Loading client workspace…</div>';
    try {
      if (!state.preview) await loadClientData(client.id);
      else state.data = demoData();
      renderCoach();
    } catch (error) {
      renderError($('#coachMain'), error, () => row.click());
    }
  });
}

function renderCoach() {
  $$('#coachNav button').forEach((button) => button.classList.toggle('active', button.dataset.coachView === state.coachView));
  $('.sidebar')?.classList.remove('open');
  if (state.client) return renderClientWorkspace();
  return state.coachView === 'clients' ? renderRoster() : renderDashboard();
}

function renderDashboard() {
  const active = state.clients.filter((client) => client.status === 'active');
  const archived = state.clients.length - active.length;
  $('#coachMain').innerHTML = pageHead('COACH WORKSPACE', 'Client overview', '<button class="btn ghost" data-coach-view-link="clients">View all clients</button><button class="btn primary" data-add-client>+ Add client</button>') + `
    <div class="stats"><div class="stat"><span>ACTIVE CLIENTS</span><strong>${active.length}</strong></div><div class="stat"><span>PAST / ARCHIVED</span><strong>${archived}</strong></div><div class="stat"><span>CHECK-INS</span><strong>Weekly</strong></div><div class="stat"><span>STEP BASELINE</span><strong>8,000</strong></div></div>
    <section class="panel"><div class="panel-head"><div><h3>Active clients</h3><span class="sub">Open a client to manage their current week.</span></div></div>${clientRows(active)}</section>`;
  $('[data-coach-view-link]')?.addEventListener('click', () => { state.coachView = 'clients'; renderCoach(); });
  bindAddClient();
  bindClientRows();
}

function renderRoster() {
  $('#coachMain').innerHTML = pageHead('CLIENT MANAGEMENT', 'All clients', '<input id="clientSearch" class="search" placeholder="Search clients…"><button class="btn primary" data-add-client>+ Add client</button>') + `<section class="panel">${clientRows(state.clients)}</section>`;
  bindAddClient();
  bindClientRows();
  $('#clientSearch').oninput = (event) => $$('[data-client-id]').forEach((row) => row.classList.toggle('hidden', !row.innerText.toLowerCase().includes(event.target.value.toLowerCase())));
}

function bindAddClient() { $$('[data-add-client]').forEach((button) => button.onclick = showAddClient); }

function showAddClient() {
  const modal = document.createElement('div'); modal.className='modal-backdrop';
  modal.innerHTML=`<section class="modal-card"><div class="panel-head"><div><span class="eyebrow">5-MINUTE SETUP</span><h2>Add a client</h2></div><button class="icon-btn" data-close-modal>✕</button></div><form id="addClientForm" class="editor-grid"><label>Full name<input name="full_name" required></label><label>Email<input name="email" type="email" required></label><label>Phone<input name="phone" type="tel"></label><label>Temporary password<input name="password" type="password" minlength="8" required></label><label>Region<select name="market_region"><option value="us">United States · lb/oz</option><option value="ireland">Ireland · kg/g</option><option value="uk">United Kingdom</option><option value="other">Other</option></select></label><label>Check-in day<select name="checkin_day">${DAYS.map((day,index)=>`<option value="${index}" ${index===5?'selected':''}>${day}</option>`).join('')}</select></label><label>Daily steps<input name="daily_steps_goal" type="number" min="8000" step="500" value="8000"></label><label class="wide">Goals<textarea name="goal_summary" rows="3" required></textarea></label><label class="toggle-field"><input name="cardio_enabled" type="checkbox"> Cardio required</label><label class="toggle-field"><input name="mobility_enabled" type="checkbox" checked> Mobility required</label><p class="wide muted">The client must accept legal/privacy terms and complete onboarding before their plan unlocks.</p><button class="btn primary wide">Create secure client login</button></form></section>`;
  document.body.append(modal); modal.querySelector('[data-close-modal]').onclick=()=>modal.remove(); modal.onclick=(e)=>{if(e.target===modal)modal.remove();}; modal.querySelector('form').onsubmit=createClientAccount;
}

async function createClientAccount(event) {
  event.preventDefault(); const fd=new FormData(event.target); const payload=Object.fromEntries(fd.entries()); payload.cardio_enabled=fd.has('cardio_enabled'); payload.mobility_enabled=fd.has('mobility_enabled'); payload.daily_steps_goal=Number(payload.daily_steps_goal); payload.checkin_day=Number(payload.checkin_day);
  setBusy(event.submitter,true);
  try {
    if (state.preview) {
      state.clients.unshift(normalizeClient({id:`preview-${Date.now()}`,display_name:payload.full_name,email:payload.email,phone:payload.phone,market_region:payload.market_region,status:'active',daily_steps_goal:payload.daily_steps_goal,checkin_day:payload.checkin_day,goal_summary:payload.goal_summary,cardio_enabled:payload.cardio_enabled,mobility_enabled:payload.mobility_enabled,onboarding_status:'pending',plan_status:'draft'}));
      event.target.closest('.modal-backdrop').remove(); toast('Preview client created locally'); renderCoach(); return;
    }
    const {data,error}=await db.functions.invoke('provision-client',{body:payload}); if(error) throw error; if(data?.error) throw new Error(data.error); state.clients.unshift(normalizeClient(data.client)); event.target.closest('.modal-backdrop').remove(); toast('Client login created'); renderCoach();
  }
  catch(error){toast(error.message||'Could not create client','error');setBusy(event.submitter,false);}
}

const COACH_TABS = ['overview', 'planner', 'training', 'nutrition', 'check-ins', 'progress', 'onboarding', 'legal', 'diagnostics'];

function renderClientWorkspace() {
  const client = state.client;
  $('#coachMain').innerHTML = pageHead('CLIENT WORKSPACE', client.display_name, '<button class="btn ghost small" id="viewAsClient">View as client</button>') + `
    <div class="tabs" id="clientTabs">${COACH_TABS.map((tab) => `<button data-client-tab="${tab}" class="${state.clientTab === tab ? 'active' : ''}">${title(tab.replace('-', ' '))}</button>`).join('')}</div>
    <div id="clientWorkspaceBody"></div>`;
  $('#clientTabs').onclick = (event) => {
    const button = event.target.closest('[data-client-tab]');
    if (!button) return;
    state.clientTab = button.dataset.clientTab;
    renderClientWorkspace();
  };
  $('#viewAsClient').onclick = () => {
    $('#clientHello').textContent = client.display_name;
    $('#returnCoach').classList.remove('hidden');
    show('#clientApp');
    state.clientView = 'planner';
    renderClient();
  };
  const views = {
    overview: coachOverview, planner: coachPlanner, training: coachTraining,
    nutrition: coachNutrition, 'check-ins': coachCheckins, progress: coachProgress,
    onboarding: coachOnboarding, legal: coachLegal, diagnostics: coachDiagnostics
  };
  try { views[state.clientTab](); }
  catch (error) { renderError($('#clientWorkspaceBody'), error, renderClientWorkspace); }
}

function coachOverview() {
  const client = state.client;
  const latest = state.data.progress.find((entry) => entry.weight_kg != null)?.weight_kg ?? state.data.checkins.find((entry) => entry.weight_kg != null)?.weight_kg;
  const change = latest != null && client.start_weight_kg != null ? Number(latest) - Number(client.start_weight_kg) : null;
  const last = state.data.checkins[0];
  $('#clientWorkspaceBody').innerHTML = `<div class="metric-strip">
    <div class="metric"><span>START</span><strong>${displayWeight(client.start_weight_kg)}</strong></div>
    <div class="metric"><span>CURRENT</span><strong>${displayWeight(latest)}</strong></div>
    <div class="metric"><span>CHANGE</span><strong>${change == null ? '—' : displayWeight(change, true)}</strong></div>
    <div class="metric"><span>DAILY STEPS</span><strong>${safeStepGoal().toLocaleString()}</strong></div>
  </div><div class="grid-2"><section class="panel"><div class="panel-head"><h3>Client controls</h3></div>
    <form id="clientSettings" class="checkin-form">
      <label class="field">Status<select name="status"><option value="active">Active</option><option value="inactive">Past client</option><option value="archived">Archived</option></select></label>
      <label class="field">Check-in day<select name="checkin_day">${DAYS.map((day, index) => `<option value="${index}">${day}</option>`).join('')}</select></label>
      <label class="field">Daily steps<input name="daily_steps_goal" type="number" min="8000" step="500" value="${safeStepGoal()}"></label>
      <label class="field">Goal weight (${client.weight_unit === 'lbs' ? 'lb' : 'kg'})<input name="goal_weight_display" type="number" step="0.1" value="${client.goal_weight_kg ? (Number(client.goal_weight_kg) * (client.weight_unit === 'lbs' ? 2.20462 : 1)).toFixed(1) : ''}"></label>
      <label class="field"><input name="track_weight" type="checkbox" ${client.track_weight !== false ? 'checked' : ''}> Track weight</label>
      <label class="field"><input name="cardio_enabled" type="checkbox" ${client.cardio_enabled !== false ? 'checked' : ''}> Cardio enabled</label>
      <label class="field"><input name="mobility_enabled" type="checkbox" ${client.mobility_enabled !== false ? 'checked' : ''}> Mobility enabled</label>
      <label class="field"><input name="plan_published" type="checkbox" ${client.plan_status === 'published' ? 'checked' : ''}> Client workspace published</label>
      <button class="btn primary wide">Save controls</button>
    </form></section><section class="panel"><div class="panel-head"><h3>Latest check-in</h3></div>${last ? `<div class="score">${last.week_score ?? '—'}/10</div><p><b>Win</b><br>${esc(last.wins || '—')}</p><p><b>Challenge</b><br>${esc(last.challenges || '—')}</p>` : '<div class="empty">No check-ins yet.</div>'}</section></div>`;
  const form = $('#clientSettings');
  form.status.value = client.status || 'active';
  form.checkin_day.value = String(client.checkin_day ?? 5);
  form.onsubmit = saveClientControls;
}

async function saveClientControls(event) {
  event.preventDefault();
  const button = event.submitter;
  const fd = new FormData(event.target);
  const displayGoal = Number(fd.get('goal_weight_display') || 0);
  const changes = {
    status: fd.get('status'),
    checkin_day: Number(fd.get('checkin_day')),
    daily_steps_goal: Math.max(8000, Number(fd.get('daily_steps_goal') || 8000)),
    goal_weight_kg: displayGoal ? displayGoal / (state.client.weight_unit === 'lbs' ? 2.20462 : 1) : null,
    track_weight: fd.has('track_weight'),
    cardio_enabled: fd.has('cardio_enabled'),
    mobility_enabled: fd.has('mobility_enabled')
    ,plan_status: fd.has('plan_published') ? 'published' : 'coach_building'
    ,plan_published_at: fd.has('plan_published') ? new Date().toISOString() : null
    ,portal_enabled: fd.has('plan_published')
  };
  Object.assign(state.client, changes);
  if (state.preview) return toast('Preview controls updated');
  setBusy(button, true);
  try {
    await query('Client controls', db.from('clients').update(changes).eq('id', state.client.id).select());
    Object.assign(state.clients.find((c) => c.id === state.client.id), changes);
    toast('Client controls saved');
  } catch (error) { toast(error.message, 'error'); }
  finally { setBusy(button, false); }
}

function weekDays() {
  const week = currentWeek();
  const start = monday(week?.week_start || new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const dateObject = new Date(+start + index * 864e5);
    const date = iso(dateObject);
    return {
      dateObject,
      date,
      sessions: state.data.sessions.filter((session) => session.session_date === date),
      step: state.data.steps.find((entry) => entry.entry_date === date),
      nutrition: state.data.nutritionDays.find((entry) => entry.nutrition_date === date)
    };
  });
}

function plannerCards({ interactive = false } = {}) {
  const days = weekDays();
  return `<div class="week-grid">${days.map((day) => `<article class="day-card ${day.date === iso(new Date()) ? 'today' : ''}">
    <div class="day-head"><strong>${DAYS[day.dateObject.getDay()]}</strong><span>${day.dateObject.getDate()}</span></div>
    ${day.sessions.map((session) => `<div class="task-row ${session.status === 'completed' ? 'done' : ''}"><label class="task"><input type="checkbox" data-session-complete="${session.id}" ${session.status === 'completed' ? 'checked' : ''} ${interactive ? '' : 'disabled'}><span><b>${esc(session.title)}</b><small>${title(session.training_type)}${session.moved_from_date ? ` · Moved from ${fmt(session.moved_from_date, { weekday: 'long' })}` : ''}</small></span></label>${interactive ? `<button class="open-session" data-open-session="${session.id}" type="button">Open</button>` : ''}</div>`).join('')}
    <label class="task ${Number(day.step?.actual_steps || day.step?.steps || 0) >= safeStepGoal() ? 'done' : ''}"><input type="checkbox" data-step-date="${day.date}" ${Number(day.step?.actual_steps || day.step?.steps || 0) >= safeStepGoal() ? 'checked' : ''} ${interactive ? '' : 'disabled'}><span><b>${safeStepGoal().toLocaleString()} steps</b><small>Daily movement</small></span></label>
    ${day.nutrition ? `<div class="plan-item nutrition"><b>Nutrition</b><span>${day.nutrition.calorie_target || state.client.calorie_goal || 'Target'} kcal</span></div>` : ''}
    ${!day.sessions.length ? '<p class="source-gap">No training scheduled</p>' : ''}
  </article>`).join('')}</div>`;
}

function coachPlanner() {
  const week = currentWeek();
  $('#clientWorkspaceBody').innerHTML = `<div class="panel-head"><div><h3>${week ? esc(week.title || `Week ${week.week_number}`) : 'Current week'}</h3><span class="sub">${week?.published ? 'Published to client' : 'Draft'}</span></div>${week ? `<button class="btn primary small" id="publishWeek">${week.published ? 'Unpublish' : 'Publish week'}</button>` : ''}</div>${plannerCards()}`;
  $('#publishWeek')?.addEventListener('click', async (event) => {
    const published = !week.published;
    week.published = published;
    if (state.preview) return coachPlanner();
    setBusy(event.currentTarget, true);
    try {
      await query('Publish week', db.from('program_weeks').update({ published, published_at: published ? new Date().toISOString() : null }).eq('id', week.id).select());
      toast(published ? 'Week published' : 'Week unpublished');
      coachPlanner();
    } catch (error) { week.published = !published; toast(error.message, 'error'); setBusy(event.currentTarget, false); }
  });
}

function exerciseCard(exercise, loggable = false) {
  const previousLogs = (state.data.exerciseLogs || []).filter((log) => log.program_exercise_id === exercise.id || (exercise.exercise_bank_id && log.exercise_bank_id === exercise.exercise_bank_id));
  const latestBySet = new Map();
  previousLogs.forEach((log) => { if (!latestBySet.has(log.set_number)) latestBySet.set(log.set_number, log); });
  const previous = previousLogs.length
    ? [...latestBySet.values()].sort((a, b) => a.set_number - b.set_number).map((log) => `${log.load ?? '—'} ${log.load_unit || ''} × ${log.reps ?? '—'}`).join(' · ')
    : exercise.previous_performance;
  return `<article class="exercise-card"><div class="exercise-title"><div><span class="eyebrow">${exercise.sort_order != null ? `EXERCISE ${Number(exercise.sort_order) + 1}` : 'EXERCISE'}</span><h3>${esc(exercise.name)}</h3></div>${exercise.video_url ? `<a class="btn ghost small" href="${esc(exercise.video_url)}" target="_blank" rel="noopener">Watch video</a>` : '<span class="pill">NO VIDEO</span>'}</div>
    <div class="prescription-grid"><div><span>SETS</span><strong>${exercise.sets ?? '—'}</strong></div><div><span>REPS</span><strong>${esc(exercise.reps || '—')}</strong></div><div><span>REST</span><strong>${exercise.rest_seconds ? `${exercise.rest_seconds}s` : '—'}</strong></div><div><span>TEMPO / INTENSITY</span><strong>${esc(exercise.tempo || exercise.rpe || exercise.rir || '—')}</strong></div></div>
    ${previous ? `<p class="previous"><b>Previous:</b> ${esc(previous)}</p><details class="exercise-history"><summary>Exercise history</summary>${previousLogs.slice(0, 12).map((log) => `<div class="note-row"><b>${fmt(log.performed_at)}</b><span>Set ${log.set_number}: ${log.load ?? '—'} ${esc(log.load_unit || '')} × ${log.reps ?? '—'}</span></div>`).join('')}</details>` : ''}
    ${(exercise.coach_instructions || exercise.notes) ? `<p>${esc(exercise.coach_instructions || exercise.notes)}</p>` : ''}
    ${loggable ? `<form class="set-log" data-exercise-log="${exercise.id}">${Array.from({ length: Math.max(1, Number(exercise.sets || 1)) }, (_, index) => { const set = index + 1; const old = latestBySet.get(set); return `<div class="set-log-row"><b>Set ${set}</b><label>Reps<input name="reps_${set}" type="number" min="0" step="1" value="${old?.reps ?? ''}"></label><label>Load<input name="load_${set}" type="number" min="0" step="0.1" value="${old?.load ?? ''}"></label><label>RIR<input name="rir_${set}" type="number" min="0" max="10" step="0.5" value="${old?.rir ?? ''}"></label></div>`; }).join('')}<button class="btn primary small">Save workout sets</button></form>` : ''}
  </article>`;
}

function programDayExercises(day) {
  return [...(day.exercises || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function exercisesForSession(session) {
  const programmeDay = state.data.programs.flatMap((program) => program.days || []).find((day) => day.id === session.programme_day_id);
  if (programmeDay) return programDayExercises(programmeDay);
  return state.data.exercises.filter((exercise) => exercise.session_id === session.id);
}

function coachTraining() {
  const programs = state.data.programs;
  $('#clientWorkspaceBody').innerHTML = trainingSetupTools() + (programs.length ? programs.map(programBuilderMarkup).join('') : '<div class="empty">No programme has been assigned. Import a complete programme above.</div>');
  bindTrainingSetupTools();
  $$('[data-exercise-editor]').forEach((form) => form.onsubmit = saveExercisePrescription);
  $$('[data-toggle-day-form]').forEach((button) => button.onclick = () => $(`[data-add-day="${button.dataset.toggleDayForm}"]`)?.classList.toggle('hidden'));
  $$('[data-toggle-exercise-form]').forEach((button) => button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); $(`[data-add-exercise="${button.dataset.toggleExerciseForm}"]`)?.classList.toggle('hidden'); });
  $$('[data-add-day]').forEach((form) => form.onsubmit = addProgramDay);
  $$('[data-add-exercise]').forEach((form) => form.onsubmit = addProgramExercise);
  $$('[data-delete-exercise]').forEach((button) => button.onclick = () => deleteProgramExercise(button.dataset.deleteExercise));
}

function trainingPrompt() {
  const onboarding=state.data.onboarding[0]?.responses?.text||JSON.stringify(state.data.onboarding[0]?.responses||{});
  return `Build a scientific, practical training programme for ${state.client.display_name}, a busy legal professional. Use only the onboarding below. Do not invent injuries, equipment or availability. Return JSON only using this schema:\n{"programme_name":"12 Week Programme","days":[{"title":"Upper 1","training_type":"weights","coach_notes":"","exercises":[{"name":"Incline dumbbell press","sets":3,"reps":"6-10","rest_seconds":120,"tempo":"3-0-1","rpe":8,"rir":2,"superset_group":null,"video_url":null,"coach_instructions":""}]}]}\nValid training_type values: weights, resistance, cardio, mobility, recovery. Include mobility/cardio only when appropriate.\n\nONBOARDING:\n${onboarding}`;
}

function trainingSetupTools(){const week=currentWeek();return `<section class="panel fast-builder"><div class="panel-head"><div><span class="eyebrow">FAST BUILD</span><h2>Programme setup</h2><p class="muted">Copy the personalised prompt, paste the returned JSON, then edit every field below.</p></div><button class="btn ghost small" id="copyTrainingPrompt">Copy AI prompt</button></div><form id="trainingJsonForm"><label class="field">Programme JSON<textarea name="training_json" rows="7" placeholder='{"programme_name":"...","days":[...]}' required></textarea></label><button class="btn primary">Import programme</button></form><hr><form id="activityForm" class="editor-grid"><label>Activity<select name="training_type"><option value="cardio">Cardio</option><option value="mobility">Mobility</option><option value="recovery">Recovery</option><option value="weights">Weights</option></select></label><label>Date<input name="session_date" type="date" value="${iso(new Date())}" required></label><label>Title<input name="title" placeholder="e.g. Zone 2 bike" required></label><label>Duration (min)<input name="duration_minutes" type="number" min="0"></label><label class="wide">Instructions<textarea name="notes" rows="2"></textarea></label><button class="btn primary wide" ${week?'':'disabled'}>Add to current week</button></form>${state.data.sessions.map(sessionEditorMarkup).join('')}</section>`;}

function sessionEditorMarkup(s){return `<form class="session-editor" data-session-editor="${s.id}"><select name="training_type"><option value="weights">Weights</option><option value="resistance">Resistance</option><option value="cardio">Cardio</option><option value="mobility">Mobility</option><option value="recovery">Recovery</option></select><input name="session_date" type="date" value="${esc(s.session_date)}"><input name="title" value="${esc(s.title)}"><input name="duration_minutes" type="number" min="0" value="${s.duration_minutes??''}" placeholder="Minutes"><button class="btn ghost small">Save</button><button class="text-btn danger" type="button" data-delete-session="${s.id}">Delete</button></form>`;}

function bindTrainingSetupTools(){
  $('#copyTrainingPrompt')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(trainingPrompt());toast('Training prompt copied');});
  $('#trainingJsonForm')?.addEventListener('submit',importTrainingJson); $('#activityForm')?.addEventListener('submit',addActivitySession);
  $$('[data-session-editor]').forEach(form=>{form.training_type.value=state.data.sessions.find(s=>s.id===form.dataset.sessionEditor)?.training_type||'weights';form.onsubmit=saveActivitySession;});
  $$('[data-delete-session]').forEach(button=>button.onclick=()=>deleteActivitySession(button.dataset.deleteSession));
}

async function importTrainingJson(event){event.preventDefault();let parsed;try{parsed=JSON.parse(new FormData(event.target).get('training_json'));if(!parsed.programme_name||!Array.isArray(parsed.days)||!parsed.days.length)throw new Error('Programme name and days are required');for(const day of parsed.days){if(!day.title)throw new Error('Every day needs a title');if(!['weights','resistance','cardio','mobility','recovery'].includes(day.training_type||'weights'))throw new Error(`Invalid category: ${day.training_type}`);}}catch(error){return toast(`Invalid JSON: ${error.message}`,'error');}if(state.preview){state.data.programs.unshift({id:`preview-program-${Date.now()}`,name:parsed.programme_name,status:'draft',days:parsed.days.map((day,i)=>({...day,id:`preview-day-${i}`,day_index:i,exercises:(day.exercises||[]).map((ex,j)=>({...ex,id:`preview-ex-${i}-${j}`,sort_order:j}))}))});toast('Programme imported in preview');return coachTraining();}setBusy(event.submitter,true);try{const [program]=await query('Programme',db.from('training_programs').insert({client_id:state.client.id,name:parsed.programme_name,status:'draft',created_by:state.user.id}).select());program.days=[];for(let i=0;i<parsed.days.length;i++){const day=parsed.days[i];const [savedDay]=await query('Training day',db.from('training_program_days').insert({program_id:program.id,title:day.title,training_type:day.training_type||'weights',day_index:i,coach_notes:day.coach_notes||null}).select());savedDay.exercises=[];for(let j=0;j<(day.exercises||[]).length;j++){const ex=day.exercises[j];const allowed=Object.fromEntries(['name','sets','reps','load','rest_seconds','tempo','rpe','rir','superset_group','video_url','coach_instructions'].filter(key=>ex[key]!=null).map(key=>[key,ex[key]]));const [saved]=await query('Exercise',db.from('program_exercises').insert({...allowed,program_day_id:savedDay.id,sort_order:j}).select());savedDay.exercises.push(saved);state.data.exercises.push(saved);}program.days.push(savedDay);}state.data.programs.unshift(program);toast('Programme imported');coachTraining();}catch(error){console.error('[training-import]',error);toast(error.message,'error');setBusy(event.submitter,false);}}

async function addActivitySession(event){event.preventDefault();const week=currentWeek(),fd=new FormData(event.target);if(!week)return toast('Create a programme week first','error');const row={week_id:week.id,training_type:fd.get('training_type'),session_date:fd.get('session_date'),title:String(fd.get('title')).trim(),duration_minutes:Number(fd.get('duration_minutes'))||null,notes:String(fd.get('notes')||'').trim()||null};if(state.preview){state.data.sessions.push({...row,id:`preview-session-${Date.now()}`,status:'planned'});toast('Activity added in preview');return coachTraining();}try{const [saved]=await query('Activity',db.from('training_sessions').insert(row).select());state.data.sessions.push(saved);toast('Activity added');coachTraining();}catch(error){console.error('[activity-add]',error);toast(error.message,'error');}}
async function saveActivitySession(event){event.preventDefault();const fd=new FormData(event.target),id=event.target.dataset.sessionEditor;const patch={training_type:fd.get('training_type'),session_date:fd.get('session_date'),title:String(fd.get('title')).trim(),duration_minutes:Number(fd.get('duration_minutes'))||null};if(state.preview){Object.assign(state.data.sessions.find(s=>s.id===id),patch);toast('Activity saved in preview');return;}try{await query('Activity',db.from('training_sessions').update(patch).eq('id',id).select());Object.assign(state.data.sessions.find(s=>s.id===id),patch);toast('Activity saved');}catch(error){console.error('[activity-save]',error);toast(error.message,'error');}}
async function deleteActivitySession(id){if(!confirm('Delete this scheduled activity?'))return;if(state.preview){state.data.sessions=state.data.sessions.filter(s=>s.id!==id);toast('Activity deleted in preview');return coachTraining();}try{await query('Activity',db.from('training_sessions').delete().eq('id',id).select());state.data.sessions=state.data.sessions.filter(s=>s.id!==id);toast('Activity deleted');coachTraining();}catch(error){console.error('[activity-delete]',error);toast(error.message,'error');}}

function programBuilderMarkup(program) {
  const days = [...(program.days || [])].sort((a, b) => a.day_index - b.day_index);
  return `<section class="panel programme"><div class="panel-head"><div><span class="eyebrow">${title(program.status)}</span><h2>${esc(program.name)}</h2></div><button class="btn ghost small" data-toggle-day-form="${program.id}">+ Add training day</button></div><form class="editor-grid add-builder-form hidden" data-add-day="${program.id}"><label>Day name<input name="title" placeholder="e.g. Upper body" required></label><label>Category<select name="training_type"><option value="weights">Weights</option><option value="resistance">Resistance</option><option value="cardio">Cardio</option><option value="mobility">Mobility</option><option value="recovery">Recovery</option></select></label><label>Order<input name="day_index" type="number" min="0" value="${days.length}"></label><button class="btn primary small">Create day</button></form>${days.map(programDayBuilderMarkup).join('')}</section>`;
}

function programDayBuilderMarkup(day) {
  const exercises = programDayExercises(day);
  return `<details class="programme-day" open><summary><div><b>${esc(day.title)}</b><span class="sub">${title(day.training_type)} · ${exercises.length} exercises</span></div><button type="button" class="text-btn" data-toggle-exercise-form="${day.id}">+ Add exercise</button></summary><form class="editor-grid add-builder-form hidden" data-add-exercise="${day.id}"><label>Name<input name="name" required></label><label>Sets<input name="sets" type="number" min="1" value="3"></label><label>Reps<input name="reps" value="8–12"></label><label>Rest (sec)<input name="rest_seconds" type="number" min="0" value="90"></label><label class="wide">Video URL<input name="video_url" type="url"></label><label>Superset group<input name="superset_group"></label><label class="wide">Instructions<textarea name="coach_instructions" rows="2"></textarea></label><button class="btn primary small">Add exercise</button></form>${exercises.length ? exercises.map(exerciseEditorMarkup).join('') : '<div class="empty">No exercises yet.</div>'}</details>`;
}

function exerciseEditorMarkup(exercise) {
  return `${exerciseCard(exercise)}<form class="exercise-editor" data-exercise-editor="${exercise.id}"><div class="editor-grid"><label>Name<input name="name" value="${esc(exercise.name)}" required></label><label>Sets<input name="sets" type="number" min="1" value="${exercise.sets ?? ''}"></label><label>Reps<input name="reps" value="${esc(exercise.reps || '')}"></label><label>Rest (sec)<input name="rest_seconds" type="number" min="0" value="${exercise.rest_seconds ?? ''}"></label><label>Tempo<input name="tempo" value="${esc(exercise.tempo || '')}"></label><label>RPE<input name="rpe" type="number" min="1" max="10" step="0.5" value="${exercise.rpe ?? ''}"></label><label>RIR<input name="rir" type="number" min="0" max="10" step="0.5" value="${exercise.rir ?? ''}"></label><label>Superset<input name="superset_group" value="${esc(exercise.superset_group || '')}"></label><label class="wide">Video URL<input name="video_url" type="url" value="${esc(exercise.video_url || '')}"></label><label class="wide">Instructions<textarea name="coach_instructions" rows="2">${esc(exercise.coach_instructions || exercise.notes || '')}</textarea></label></div><div class="editor-actions"><button class="btn primary small">Save exercise</button><button class="btn ghost small danger" type="button" data-delete-exercise="${exercise.id}">Delete exercise</button></div></form>`;
}

async function addProgramDay(event) {
  event.preventDefault(); const program = state.data.programs.find((item) => item.id === event.target.dataset.addDay); const fd = new FormData(event.target);
  const row = { program_id: program.id, title: String(fd.get('title')).trim(), training_type: fd.get('training_type'), day_index: Number(fd.get('day_index') || 0) };
  if (state.preview) { program.days.push({ ...row, id: `preview-day-${Date.now()}`, exercises: [] }); return coachTraining(); }
  try { const [saved] = await query('Training day', db.from('training_program_days').insert(row).select()); saved.exercises = []; program.days.push(saved); toast('Training day added'); coachTraining(); } catch (error) { toast(error.message, 'error'); }
}

async function addProgramExercise(event) {
  event.preventDefault(); const day = state.data.programs.flatMap((program) => program.days || []).find((item) => item.id === event.target.dataset.addExercise); const fd = new FormData(event.target);
  const row = { program_day_id: day.id, name: String(fd.get('name')).trim(), sets: Number(fd.get('sets')) || null, reps: String(fd.get('reps') || '').trim() || null, rest_seconds: Number(fd.get('rest_seconds')) || null, video_url: String(fd.get('video_url') || '').trim() || null, superset_group: String(fd.get('superset_group') || '').trim() || null, coach_instructions: String(fd.get('coach_instructions') || '').trim() || null, sort_order: (day.exercises || []).length };
  if (state.preview) { const saved = { ...row, id: `preview-exercise-${Date.now()}` }; day.exercises.push(saved); state.data.exercises.push(saved); return coachTraining(); }
  try { const [saved] = await query('Exercise', db.from('program_exercises').insert(row).select()); day.exercises.push(saved); state.data.exercises.push(saved); toast('Exercise added'); coachTraining(); } catch (error) { toast(error.message, 'error'); }
}

async function deleteProgramExercise(id) {
  if (!confirm('Delete this exercise prescription?')) return;
  if (!state.preview) { try { await query('Delete exercise', db.from('program_exercises').delete().eq('id', id).select()); } catch (error) { return toast(error.message, 'error'); } }
  state.data.programs.forEach((program) => (program.days || []).forEach((day) => { day.exercises = (day.exercises || []).filter((item) => item.id !== id); })); state.data.exercises = state.data.exercises.filter((item) => item.id !== id); toast('Exercise deleted'); coachTraining();
}

async function saveExercisePrescription(event) {
  event.preventDefault();
  const exercise = state.data.exercises.find((item) => item.id === event.target.dataset.exerciseEditor);
  if (!exercise) return toast('Exercise not found', 'error');
  const fd = new FormData(event.target);
  const patch = Object.fromEntries(['name', 'reps', 'tempo', 'video_url', 'coach_instructions', 'superset_group'].map((key) => [key, String(fd.get(key) || '').trim() || null]));
  for (const key of ['sets', 'rest_seconds', 'rpe', 'rir']) patch[key] = fd.get(key) === '' ? null : Number(fd.get(key));
  Object.assign(exercise, patch);
  if (state.preview) { toast('Exercise updated in preview'); return coachTraining(); }
  setBusy(event.submitter, true);
  try { await query('Exercise update', db.from('program_exercises').update(patch).eq('id', exercise.id).select()); toast('Exercise saved'); coachTraining(); }
  catch (error) { toast(error.message, 'error'); setBusy(event.submitter, false); }
}

function macroStrip(plan) {
  return `<div class="macro-strip"><div><span>CALORIES</span><strong>${plan?.calories ?? state.client.calorie_goal ?? '—'}</strong></div><div><span>PROTEIN</span><strong>${plan?.protein_g ?? state.client.protein_goal_g ?? '—'} g</strong></div><div><span>CARBS</span><strong>${plan?.carbs_g ?? state.client.carbs_goal_g ?? '—'} g</strong></div><div><span>FAT</span><strong>${plan?.fat_g ?? state.client.fat_goal_g ?? '—'} g</strong></div></div>`;
}

function mealPlan(plan) {
  return `<article class="panel nutrition-plan"><div class="panel-head"><div><span class="eyebrow">${esc(plan.day_type || 'PLAN')}</span><h2>${esc(plan.name)}</h2></div><span class="pill">${plan.days_per_week ?? '—'} DAYS / WEEK</span></div>${macroStrip(plan)}
    <div class="meal-grid">${(plan.meals || []).sort((a, b) => a.sort_order - b.sort_order).map((meal) => `<section class="meal-card"><span class="eyebrow">${esc(meal.timing || 'MEAL')}</span><h3>${esc(meal.name)}</h3>${(meal.items || []).sort((a, b) => a.sort_order - b.sort_order).map((item) => `<div class="ingredient-row"><div><b>${esc(item.name)}</b>${item.description ? `<p>${esc(item.description)}</p>` : ''}</div><span>${esc([item.quantity, item.unit].filter((value) => value != null && value !== '').join(' ') || 'As directed')}</span></div>`).join('') || '<div class="empty">No ingredients were recovered for this meal.</div>'}</section>`).join('') || '<div class="empty">No meals have been added to this plan.</div>'}</div>
    ${plan.coach_notes ? `<div class="coach-note"><b>Coach notes</b><p>${esc(plan.coach_notes)}</p></div>` : ''}</article>`;
}

function ingredientAmount(ingredient) {
  const amount = [ingredient?.quantity, ingredient?.unit].filter((value) => value != null && value !== '').join(' ');
  return amount;
}

function nutritionUnit(amount, unit) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  const raw = `${amount}${unit ? ` ${unit}` : ''}`;
  if (state.client?.weight_unit !== 'lbs' || !Number.isFinite(n)) return raw;
  if (String(unit).toLowerCase() === 'g') return `${(n / 28.3495).toFixed(n < 30 ? 1 : 2).replace(/\.00$/, '')} oz`;
  if (String(unit).toLowerCase() === 'kg') return `${(n * 2.20462).toFixed(1)} lb`;
  if (String(unit).toLowerCase() === 'ml') return n >= 60 ? `${(n / 236.588).toFixed(2).replace(/0$/, '')} cups` : `${(n / 14.7868).toFixed(1)} tbsp`;
  return raw;
}

function usableIngredients(meal) {
  return (Array.isArray(meal?.ingredients) ? meal.ingredients : []).filter((ingredient) => {
    const name = String(ingredient?.name || '').trim();
    return name && !/days\/week|delete day type|add meal|save meal plan|import with ai/i.test(name);
  });
}

function recoveredMealDescription(meal) {
  const lines = String(meal?.preparation || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => ![
    meal?.meal_type, meal?.name
  ].includes(line) && !/^(import with ai|save meal plan|add meal|add day type|total:|days\/week|[1-7]|delete day type)$/i.test(line) && !/^\d+\s*kcal/i.test(line) && !/^[pcf]\s*\d+/i.test(line)) || '';
}

function inferredAmount(ingredient, meal) {
  const direct = ingredientAmount(ingredient);
  if (!direct) return '';
  if (ingredient.unit || !/^\d+(\.\d+)?$/.test(String(ingredient.quantity))) return nutritionUnit(ingredient.quantity, ingredient.unit);
  const name = String(ingredient.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(meal.preparation || '').match(new RegExp(`\\b${ingredient.quantity}\\s*(g|kg|ml|l|oz|lb|lbs|cup|cups|tbsp|tsp)\\b[^,.]*${name}`, 'i'));
  return match ? nutritionUnit(ingredient.quantity, match[1]) : String(ingredient.quantity);
}

function mealCardMarkup(meal, editable = false) {
  const ingredients = usableIngredients(meal);
  const description = recoveredMealDescription(meal);
  return `<section class="meal-card"><div class="meal-card-head"><div><span class="eyebrow">${esc(meal.meal_type || 'MEAL')}</span><h3>${esc(meal.name)}</h3></div><div><strong>${meal.calories ?? '—'} kcal</strong>${editable ? `<button class="text-btn" type="button" data-edit-meal="${meal.id}">Edit meal</button>` : ''}</div></div><div class="meal-macro-strip"><span>P ${meal.protein_g ?? '—'}g</span><span>C ${meal.carbs_g ?? '—'}g</span><span>F ${meal.fat_g ?? '—'}g</span></div>${ingredients.length ? `<h4 class="food-heading">Ingredients</h4><div class="ingredient-list">${ingredients.map((ingredient) => `<div><b>${esc(ingredient.name)}</b><span>${esc(inferredAmount(ingredient, meal) || 'Quantity not recovered')}</span></div>`).join('')}</div>` : '<div class="source-gap">Ingredients were not available in the recovered record.</div>'}${meal.cooking_instructions || description ? `<details class="meal-method" open><summary>Preparation</summary><p>${esc(meal.cooking_instructions || description)}</p></details>` : ''}${editable ? `<form class="meal-editor hidden" data-meal-editor="${meal.id}"><div class="editor-grid"><label>Name<input name="name" value="${esc(meal.name)}"></label><label>Meal type<input name="meal_type" value="${esc(meal.meal_type || '')}"></label><label>Calories<input name="calories" type="number" value="${meal.calories ?? ''}"></label><label>Protein (g)<input name="protein_g" type="number" value="${meal.protein_g ?? ''}"></label><label>Carbs (g)<input name="carbs_g" type="number" value="${meal.carbs_g ?? ''}"></label><label>Fat (g)<input name="fat_g" type="number" value="${meal.fat_g ?? ''}"></label><label class="wide">Ingredients — one per line (quantity | unit | food)<textarea name="ingredients" rows="5">${esc(ingredients.map((item) => `${item.quantity || ''} | ${item.unit || ''} | ${item.name}`).join('\n'))}</textarea></label><label class="wide">Preparation<textarea name="cooking_instructions" rows="5">${esc(meal.cooking_instructions || description)}</textarea></label></div><button class="btn primary small">Save meal</button></form>` : ''}</section>`;
}

function assignedMealsForPlan(plan) {
  return (state.data.mealAssignments || [])
    .filter((assignment) => assignment.nutrition_plan_id === plan.id && assignment.meal)
    .filter((assignment) => !/^add meal$/i.test(assignment.meal.name || ''))
    .filter((assignment) => !(assignment.meal.name === 'Meal' && /add meal/i.test(assignment.meal.preparation || '')))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function assignedMealPlan(plan, editable = false) {
  const assignments = assignedMealsForPlan(plan);
  const total = assignments.reduce((sum, { meal }) => ({ calories: sum.calories + Number(meal.calories || 0), protein: sum.protein + Number(meal.protein_g || 0), carbs: sum.carbs + Number(meal.carbs_g || 0), fat: sum.fat + Number(meal.fat_g || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  return `<article class="panel nutrition-plan"><div class="panel-head"><div><span class="eyebrow">${esc(nutritionDayLabel(plan))}</span><h2>${esc(nutritionDayLabel(plan))}</h2><p class="muted">${nutritionDayLabel(plan) === 'Busy Day' ? 'Prepare ahead, pack it, and keep the day simple.' : nutritionDayLabel(plan) === 'Training Day' ? 'Fuel training and recovery.' : 'Your lower-activity day structure.'}</p></div><span class="pill">${plan.days_per_week ?? '—'} DAYS / WEEK</span></div>${macroStrip(plan)}<div class="meal-grid">${assignments.map(({ meal }) => mealCardMarkup(meal, editable)).join('') || '<div class="empty">No assigned meals are available for this plan.</div>'}</div><div class="day-totals"><b>Meals shown</b><span>${Math.round(total.calories)} kcal</span><span>P ${Math.round(total.protein)}g</span><span>C ${Math.round(total.carbs)}g</span><span>F ${Math.round(total.fat)}g</span></div>${plan.coach_notes ? `<div class="coach-note"><b>Coach notes</b><p>${esc(plan.coach_notes)}</p></div>` : ''}</article>`;
}

function nutritionPlanMarkup(plan) {
  return assignedMealsForPlan(plan).length ? assignedMealPlan(plan) : mealPlan(plan);
}

function nutritionDayLabel(plan) {
  return /non[- ]?training|rest/i.test(plan?.day_type || plan?.name || '') ? 'Rest Day' : (plan?.day_type || plan?.name || 'Plan');
}

function nutritionImportPrompt() {
  const units = state.client?.weight_unit === 'lbs' ? 'US-friendly ounces, cups, tablespoons and counts' : 'grams, millilitres and counts';
  return `Create a personalised 3-day nutrition plan for ${state.client?.display_name || 'this client'} using ${units}. Return JSON only. Keep meals practical, measured and close to the stated daily macros. Use exactly three day types: Training Day, Rest Day, Busy Day. Busy Day must use portable, batch-prepared or genuinely quick meals. Do not include foods that conflict with the client's onboarding restrictions.\n\nSchema:\n{"days":[{"day_type":"Training Day","name":"Training Day","days_per_week":3,"calories":2200,"protein_g":180,"carbs_g":230,"fat_g":60,"coach_notes":"","meals":[{"name":"Meal name","meal_type":"Breakfast","calories":500,"protein_g":40,"carbs_g":55,"fat_g":12,"ingredients":[{"quantity":2,"unit":"oz","name":"oats"}],"cooking_instructions":"Clear numbered preparation steps","swaps":["Alternative"]}]}]}`;
}

function nutritionImportPanel() {
  return `<section id="nutritionImportPanel" class="panel import-prompt hidden"><div class="panel-head"><div><span class="eyebrow">FAST BUILD</span><h3>Import a complete 3-day plan</h3></div><button class="btn ghost small" type="button" id="copyNutritionPrompt">Copy AI prompt</button></div><p class="muted">Paste JSON with Training Day, Rest Day and Busy Day. The importer validates every meal before saving.</p><form id="nutritionJsonForm"><label class="field">Nutrition JSON<textarea name="nutrition_json" rows="12" placeholder='{"days":[...]}' required></textarea></label><button class="btn primary" type="submit">Validate & import plan</button></form></section>`;
}

async function copyNutritionPrompt() {
  try { await navigator.clipboard.writeText(nutritionImportPrompt()); toast('Nutrition prompt copied'); }
  catch { toast('Copy failed — select the prompt manually', 'error'); }
}

function validateNutritionImport(payload) {
  if (!payload || !Array.isArray(payload.days) || payload.days.length !== 3) throw new Error('JSON must contain exactly three days.');
  const required = ['Training Day', 'Rest Day', 'Busy Day'];
  required.forEach((type) => { if (!payload.days.some((day) => day.day_type === type)) throw new Error(`${type} is missing.`); });
  payload.days.forEach((day) => {
    if (!Array.isArray(day.meals) || !day.meals.length) throw new Error(`${day.day_type} needs at least one meal.`);
    ['calories', 'protein_g', 'carbs_g', 'fat_g'].forEach((key) => { if (!Number.isFinite(Number(day[key]))) throw new Error(`${day.day_type}: ${key} is required.`); });
    day.meals.forEach((meal) => {
      if (!meal.name || !Array.isArray(meal.ingredients) || !meal.ingredients.length) throw new Error(`${day.day_type}: every meal needs a name and ingredients.`);
      ['calories', 'protein_g', 'carbs_g', 'fat_g'].forEach((key) => { if (!Number.isFinite(Number(meal[key]))) throw new Error(`${meal.name}: ${key} is required.`); });
    });
  });
  return payload;
}

async function importNutritionJson(event) {
  event.preventDefault();
  let payload;
  try { payload = validateNutritionImport(JSON.parse(new FormData(event.target).get('nutrition_json'))); }
  catch (error) { return toast(error.message || 'Invalid JSON', 'error'); }
  if (state.preview) return toast('JSON validated. Sign in to save it.');
  setBusy(event.submitter, true);
  try {
    for (const day of payload.days) {
      const existing = state.data.nutritionPlans.find((plan) => plan.day_type === day.day_type || (day.day_type === 'Rest Day' && plan.day_type === 'Non-Training Day'));
      const planPatch = { client_id: state.client.id, name: day.name || day.day_type, day_type: day.day_type, days_per_week: Number(day.days_per_week || 1), calories: Number(day.calories), protein_g: Number(day.protein_g), carbs_g: Number(day.carbs_g), fat_g: Number(day.fat_g), coach_notes: day.coach_notes || null, is_active: true, source_system: 'coach_json', source_json: day };
      let plan;
      if (existing) {
        [plan] = await query('Nutrition plan import', db.from('nutrition_plans').update(planPatch).eq('id', existing.id).select());
        await query('Meal assignment reset', db.from('meal_assignments').delete().eq('nutrition_plan_id', existing.id).select());
      } else [plan] = await query('Nutrition plan import', db.from('nutrition_plans').insert(planPatch).select());
      for (let index = 0; index < day.meals.length; index += 1) {
        const meal = day.meals[index];
        const mealRow = { name: meal.name, meal_type: meal.meal_type || 'Meal', calories: Number(meal.calories), protein_g: Number(meal.protein_g), carbs_g: Number(meal.carbs_g), fat_g: Number(meal.fat_g), ingredients: meal.ingredients, cooking_instructions: meal.cooking_instructions || null, swaps: Array.isArray(meal.swaps) ? meal.swaps : [], tags: Array.isArray(meal.tags) ? meal.tags : [], source_system: 'coach_json' };
        const [savedMeal] = await query('Meal import', db.from('meal_bank').insert(mealRow).select());
        await query('Meal assignment', db.from('meal_assignments').insert({ meal_id: savedMeal.id, client_id: state.client.id, nutrition_plan_id: plan.id, historical: false, sort_order: index }).select());
      }
    }
    toast('Three-day nutrition plan imported');
    await loadClientData(state.client.id);
    state.selectedNutritionPlanId = state.data.nutritionPlans.find((plan) => plan.day_type === 'Training Day')?.id;
    coachNutrition();
  } catch (error) { toast(error.message || 'Import failed', 'error'); }
  finally { setBusy(event.submitter, false); }
}

function coachNutrition() {
  const plans = state.data.nutritionPlans.filter((plan) => plan.is_active !== false);
  const selected = plans.find((plan) => plan.id === state.selectedNutritionPlanId) || plans.find((plan) => nutritionDayLabel(plan) === 'Training Day') || plans[0];
  state.selectedNutritionPlanId = selected?.id || null;
  $('#clientWorkspaceBody').innerHTML = `<section class="nutrition-tools"><div><h2>Nutrition plan</h2><p class="muted">Edit targets and every food without leaving this page.</p></div><button class="btn gold" type="button" id="toggleNutritionImport">Import 3-day JSON</button></section>${nutritionImportPanel()}${plans.length ? `<div class="nutrition-day-tabs">${plans.map((plan) => `<button type="button" data-coach-nutrition-plan="${plan.id}" class="${plan.id === selected.id ? 'active' : ''}">${esc(nutritionDayLabel(plan))}</button>`).join('')}</div><form class="nutrition-editor" data-plan-editor="${selected.id}"><div class="editor-grid"><label>Plan name<input name="name" value="${esc(selected.name)}"></label><label>Day type<select name="day_type"><option${selected.day_type === 'Training Day' ? ' selected' : ''}>Training Day</option><option${selected.day_type === 'Rest Day' || selected.day_type === 'Non-Training Day' ? ' selected' : ''}>Rest Day</option><option${selected.day_type === 'Busy Day' ? ' selected' : ''}>Busy Day</option></select></label><label>Calories<input name="calories" type="number" min="0" value="${selected.calories ?? ''}"></label><label>Protein (g)<input name="protein_g" type="number" min="0" value="${selected.protein_g ?? ''}"></label><label>Carbs (g)<input name="carbs_g" type="number" min="0" value="${selected.carbs_g ?? ''}"></label><label>Fat (g)<input name="fat_g" type="number" min="0" value="${selected.fat_g ?? ''}"></label><label>Days/week<input name="days_per_week" type="number" min="0" max="7" value="${selected.days_per_week ?? 1}"></label><button class="btn primary small">Save targets</button></div></form>${assignedMealsForPlan(selected).length ? assignedMealPlan(selected, true) : mealPlan(selected)}` : '<div class="empty">No active nutrition plan is available for this client. Use Import 3-day JSON to add it.</div>'}`;
  $('#toggleNutritionImport').onclick = () => $('#nutritionImportPanel').classList.toggle('hidden');
  $('#nutritionJsonForm').onsubmit = importNutritionJson;
  $('#copyNutritionPrompt').onclick = copyNutritionPrompt;
  $$('[data-coach-nutrition-plan]').forEach((button) => button.onclick = () => { state.selectedNutritionPlanId = button.dataset.coachNutritionPlan; coachNutrition(); });
  $$('[data-plan-editor]').forEach((form) => form.onsubmit = saveNutritionTargets);
  $$('[data-edit-meal]').forEach((button) => button.onclick = () => $(`[data-meal-editor="${button.dataset.editMeal}"]`)?.classList.toggle('hidden'));
  $$('[data-meal-editor]').forEach((form) => form.onsubmit = saveMeal);
}

async function saveMeal(event) {
  event.preventDefault();
  const id = event.target.dataset.mealEditor;
  const assignment = state.data.mealAssignments.find((item) => item.meal?.id === id);
  if (!assignment) return toast('Meal not found', 'error');
  const fd = new FormData(event.target);
  const ingredients = String(fd.get('ingredients') || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const [quantity, unit, ...name] = line.split('|').map((part) => part.trim()); return { quantity: quantity || null, unit: unit || null, name: name.join(' | ') || unit || quantity }; }).filter((item) => item.name);
  const patch = { name: String(fd.get('name') || '').trim(), meal_type: String(fd.get('meal_type') || '').trim() || null, ingredients, cooking_instructions: String(fd.get('cooking_instructions') || '').trim() || null };
  for (const key of ['calories', 'protein_g', 'carbs_g', 'fat_g']) patch[key] = fd.get(key) === '' ? null : Number(fd.get(key));
  Object.assign(assignment.meal, patch);
  if (state.preview) { toast('Meal updated in preview'); return coachNutrition(); }
  setBusy(event.submitter, true);
  try { await query('Meal update', db.from('meal_bank').update(patch).eq('id', id).select()); toast('Meal saved'); coachNutrition(); }
  catch (error) { toast(error.message, 'error'); setBusy(event.submitter, false); }
}

async function saveNutritionTargets(event) {
  event.preventDefault();
  const plan = state.data.nutritionPlans.find((item) => item.id === event.target.dataset.planEditor);
  const fd = new FormData(event.target);
  const patch = { name: String(fd.get('name') || '').trim(), day_type: String(fd.get('day_type') || plan.day_type), days_per_week: Number(fd.get('days_per_week') || 1) };
  for (const key of ['calories', 'protein_g', 'carbs_g', 'fat_g']) patch[key] = fd.get(key) === '' ? null : Number(fd.get(key));
  Object.assign(plan, patch);
  if (state.preview) { toast('Nutrition targets updated in preview'); return coachNutrition(); }
  setBusy(event.submitter, true);
  try { await query('Nutrition plan update', db.from('nutrition_plans').update(patch).eq('id', plan.id).select()); toast('Nutrition targets saved'); coachNutrition(); }
  catch (error) { toast(error.message, 'error'); setBusy(event.submitter, false); }
}

function answersFor(checkin) {
  if (checkin.original_answers && Object.keys(checkin.original_answers).length) return Object.entries(checkin.original_answers);
  return [
    ['Biggest win', checkin.wins], ['Challenges', checkin.challenges],
    ['Training feedback', checkin.training_summary], ['Nutrition feedback', checkin.food_summary],
    ['Support needed', checkin.support_needed], ['Anything else', checkin.client_notes]
  ].filter(([, value]) => value);
}

function checkinCard(checkin, coach = false) {
  const answers = answersFor(checkin);
  return `<details class="checkin-card rich-checkin" ${checkin === state.data.checkins[0] ? 'open' : ''}><summary><div><span class="eyebrow">WEEK ${checkin.week_number || '—'}</span><h3>${esc(checkin.original_date_text || fmt(checkin.submitted_at))}</h3></div><div class="score">${checkin.week_score ?? '—'}/10</div></summary>
    <div class="detail-list"><div class="detail"><label>Weight</label>${displayWeight(checkin.weight_kg)}</div><div class="detail"><label>Energy</label>${checkin.energy ?? '—'}/10</div><div class="detail"><label>Sleep</label>${checkin.sleep ?? '—'}/10</div><div class="detail"><label>Stress</label>${checkin.stress ?? '—'}/10</div><div class="detail"><label>Training</label>${checkin.training_adherence ?? '—'}%</div><div class="detail"><label>Nutrition</label>${checkin.nutrition_adherence ?? '—'}%</div><div class="detail"><label>Average steps</label>${checkin.average_steps ? Number(checkin.average_steps).toLocaleString() : '—'}</div></div>
    <div class="original-answers">${answers.length ? answers.map(([question, answer]) => `<div class="answer-block"><h4>${esc(question)}</h4><p>${esc(answer)}</p></div>`).join('') : '<p class="source-gap">No written response was submitted for this week.</p>'}</div>
    ${checkin.voice_note_url ? `<a class="loom-card" href="${esc(checkin.voice_note_url)}" target="_blank" rel="noopener"><span>▶</span><div><b>Weekly check-in video</b><small>Open coach review</small></div></a>` : ''}
    ${coach ? `<label class="field">Coach response<textarea data-checkin-response="${checkin.id}">${esc(checkin.coach_response || '')}</textarea></label><label class="field">Weekly video URL<input type="url" data-checkin-video="${checkin.id}" value="${esc(checkin.voice_note_url || '')}"></label>` : (checkin.coach_response ? `<div class="coach-note"><b>Coach response</b><p>${esc(checkin.coach_response)}</p></div>` : '')}
  </details>`;
}

function coachCheckins() {
  $('#clientWorkspaceBody').innerHTML = `<div class="performance-hero"><div><span class="eyebrow">CHECK-IN HISTORY</span><h2>${state.data.checkins.length} weekly reviews</h2><span class="sub">Original answers remain attached to their submitted week.</span></div></div>${state.data.checkins.map((checkin) => checkinCard(checkin, true)).join('') || '<div class="empty">No check-ins yet.</div>'}`;
  $$('[data-checkin-response],[data-checkin-video]').forEach((field) => field.addEventListener('change', async () => {
    if (state.preview) return toast('Preview saved');
    const id = field.dataset.checkinResponse || field.dataset.checkinVideo;
    const patch = field.dataset.checkinResponse ? { coach_response: field.value } : { voice_note_url: field.value || null };
    try { await query('Check-in update', db.from('checkins').update(patch).eq('id', id).select()); toast('Check-in review saved'); }
    catch (error) { toast(error.message, 'error'); }
  }));
}

function chart(values, colour = '#b99853') {
  const list = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (list.length < 2) return '<div class="empty">More data is needed for a trend chart.</div>';
  const width = 700, height = 180, min = Math.min(...list), max = Math.max(...list), spread = max - min || 1;
  const points = list.map((value, index) => `${20 + index * (width - 40) / (list.length - 1)},${height - 20 - (value - min) * (height - 40) / spread}`).join(' ');
  return `<svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Historical trend"><polyline fill="none" stroke="${colour}" stroke-width="4" points="${points}"/></svg>`;
}

function coachProgress() {
  $('#clientWorkspaceBody').innerHTML = progressDashboardMarkup();
  bindProgressRange(coachProgress);
}

function progressData() {
  const entries = [...state.data.progress].filter((entry) => entry.weight_kg != null).sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
  const start = Number(state.client.start_weight_kg ?? entries[0]?.weight_kg);
  const current = Number(entries.at(-1)?.weight_kg);
  const goal = Number(state.client.goal_weight_kg);
  const change = Number.isFinite(start) && Number.isFinite(current) ? current - start : null;
  const remaining = Number.isFinite(goal) && Number.isFinite(current) ? goal - current : null;
  const journey = Number.isFinite(goal) && Number.isFinite(start) ? goal - start : null;
  const progress = journey && change != null ? Math.max(0, Math.min(100, Math.round(change / journey * 100))) : null;
  const days = entries.length > 1 ? Math.max(1, (new Date(entries.at(-1).entry_date) - new Date(entries[0].entry_date)) / 864e5) : 0;
  return { entries, start, current, goal, change, remaining, progress, weeklyRate: days && change != null ? change / (days / 7) : null };
}

function rangeEntries(entries) {
  if (state.progressRange === 'all') return entries;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(state.progressRange) * 7);
  return entries.filter((entry) => new Date(`${entry.entry_date}T12:00:00`) >= cutoff);
}

function progressDashboardMarkup() {
  const model = progressData(), shown = rangeEntries(model.entries), factor = state.client.weight_unit === 'lbs' ? 2.20462 : 1;
  const value = (kg, signed = false) => Number.isFinite(kg) ? displayWeight(kg, signed) : '—';
  const measures = ['waist_cm','chest_cm','hips_cm','arm_cm','thigh_cm'].map((key) => { const rows = state.data.progress.filter((entry) => entry[key] != null).sort((a,b) => String(a.entry_date).localeCompare(String(b.entry_date))); return rows.length ? { name: title(key.replace('_cm','')), start: Number(rows[0][key]), current: Number(rows.at(-1)[key]) } : null; }).filter(Boolean);
  return `<div class="progress-hero"><div><span>Current</span><strong>${value(model.current)}</strong><small>${model.entries.at(-1) ? `Latest weigh-in ${fmt(model.entries.at(-1).entry_date)}` : 'No weigh-ins'}</small></div><div class="goal-progress"><span>Goal progress</span><strong>${model.progress == null ? '—' : `${model.progress}%`}</strong><div class="progress-bar"><i style="width:${model.progress || 0}%"></i></div></div></div><div class="progress-metrics"><div><span>Start</span><strong>${value(model.start)}</strong></div><div><span>Total change</span><strong>${value(model.change, true)}</strong></div><div><span>Goal</span><strong>${value(model.goal)}</strong></div><div><span>To goal</span><strong>${value(model.remaining, true)}</strong></div><div><span>Weekly rate</span><strong>${value(model.weeklyRate, true)}</strong></div><div><span>Weigh-ins</span><strong>${model.entries.length}</strong></div></div><section class="panel"><div class="panel-head"><h3>Weight trend</h3><div class="range-tabs">${['4','8','12','all'].map((range) => `<button data-progress-range="${range}" class="${state.progressRange === range ? 'active' : ''}">${range === 'all' ? 'All time' : `${range} weeks`}</button>`).join('')}</div></div>${chart(shown.map((entry) => Number(entry.weight_kg) * factor))}<div>${shown.slice().reverse().map((entry) => `<div class="note-row"><b>${fmt(entry.entry_date)}</b><span>${displayWeight(entry.weight_kg)}${entry.waist_cm ? ` · Waist ${entry.waist_cm} cm` : ''}</span></div>`).join('') || '<div class="empty">No entries in this range.</div>'}</div></section>${measures.length ? `<section class="panel measurement-panel"><div class="panel-head"><h3>Measurements</h3></div><div class="measurement-grid">${measures.map((measure) => `<div><span>${measure.name}</span><strong>${measure.current} cm</strong><small>${measure.start} cm start · ${(measure.current - measure.start).toFixed(1)} cm</small></div>`).join('')}</div></section>` : ''}${milestones()}`;
}

function bindProgressRange(render) { $$('[data-progress-range]').forEach((button) => button.onclick = () => { state.progressRange = button.dataset.progressRange; render(); }); }

function responseTree(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(responseTree).join('');
  if (typeof value === 'object') return Object.entries(value).map(([key, child]) => `<section class="response-group"><h3>${esc(title(key.replaceAll('_', ' ')))}</h3>${responseTree(child)}</section>`).join('');
  return `<p>${esc(value)}</p>`;
}

function coachOnboarding() {
  const record = state.data.onboarding[0];
  $('#clientWorkspaceBody').innerHTML = record ? `<section class="panel"><div class="panel-head"><div><h2>Onboarding responses</h2><span class="sub">Submitted ${fmt(record.submitted_at || record.created_at)}</span></div></div>${responseTree(record.responses)}</section>` : '<div class="empty">No onboarding record is available.</div>';
}

function coachLegal() {
  $('#clientWorkspaceBody').innerHTML = state.data.legal.length ? state.data.legal.map((record) => `<section class="panel"><div class="panel-head"><div><h2>Consent record</h2><span class="sub">${fmt(record.signed_at || record.accepted_at || record.created_at)}</span></div><span class="pill">RECORDED</span></div><div class="detail-list">${Object.entries(record).filter(([key, value]) => !['id', 'client_id', 'created_at'].includes(key) && value != null && value !== '').map(([key, value]) => `<div class="detail"><label>${esc(title(key.replaceAll('_', ' ')))}</label>${esc(typeof value === 'object' ? JSON.stringify(value) : value)}</div>`).join('')}</div></section>`).join('') : '<div class="empty">No legal or consent record is available.</div>';
}

function diagnosticCard(report) {
  const data = report.data || {};
  const markers = Array.isArray(data.markers) ? data.markers : [];
  const genetics = data.genetic_data || {};
  const score = report.score ?? data.health_score;
  const flagged = markers.filter((marker) => !['optimal','normal'].includes(String(marker.status || marker.classification || '').toLowerCase()));
  const section = (heading, value, colour) => value ? `<section class="report-section" style="--accent:${colour}"><span class="eyebrow">${heading}</span><div>${responseTree(value)}</div></section>` : '';
  const priorities = Array.isArray(genetics.top_priorities) ? genetics.top_priorities : [];
  const categoryNotes = genetics.category_notes && typeof genetics.category_notes === 'object' ? genetics.category_notes : {};
  const geneticInsights = Object.entries(categoryNotes).map(([name, insight]) => `<section class="genetic-card"><span class="eyebrow">${esc(title(name.replaceAll('_',' ')))}</span>${insight?.summary ? `<h3>${esc(insight.summary)}</h3>` : ''}${insight?.key_findings ? `<div class="finding-list">${responseTree(insight.key_findings)}</div>` : ''}${insight?.what_it_means ? `<p>${esc(insight.what_it_means)}</p>` : ''}</section>`).join('');
  const priorityMarkup = priorities.length ? `<section class="priority-panel"><span class="eyebrow">TOP PRIORITIES</span><div>${priorities.map((item, index) => `<article><b>${index + 1}</b><p>${esc(typeof item === 'object' ? item.title || item.priority || item.summary || JSON.stringify(item) : item)}</p></article>`).join('')}</div></section>` : '';
  return `<article class="diagnostic-report"><header class="report-cover"><div><span class="eyebrow">${esc(title(report.report_type || 'report'))} · ${fmt(report.report_date)}</span><h2>${esc(report.title || 'Diagnostic report')}</h2><p>${esc(data.lab_source || '')}</p></div>${score != null ? `<div class="health-ring"><strong>${score}</strong><span>SCORE</span></div>` : ''}</header><section class="report-summary"><span class="eyebrow">EXECUTIVE SUMMARY</span><p>${esc(report.summary || data.coach_summary || genetics.overview || 'No coach summary recorded.')}</p></section>${priorityMarkup}${geneticInsights ? `<section class="genetic-grid">${geneticInsights}</section>` : ''}${markers.length ? `<section class="report-table"><div class="panel-head"><div><h3>Blood markers</h3><span class="sub">${markers.length} tested · ${flagged.length} requiring attention</span></div></div><div class="data-table"><div class="data-head"><span>Marker</span><span>Result</span><span>Reference</span><span>Status</span></div>${markers.map((marker) => `<div class="data-row"><b>${esc(marker.marker_name || marker.name)}</b><span>${esc(marker.value)} ${esc(marker.unit || '')}</span><span>${esc(marker.reference_range_low ?? marker.reference_low ?? '—')}–${esc(marker.reference_range_high ?? marker.reference_high ?? '—')}</span><span class="marker-status">${esc(marker.status || marker.classification || '—')}</span></div>`).join('')}</div></section>` : ''}<div class="recommendation-grid">${section('NUTRITION', data.action_nutrition || genetics.recommendations?.nutrition, '#4cc9a4')}${section('TRAINING', data.action_training || genetics.recommendations?.training, '#5da9e9')}${section('SUPPLEMENTS', data.action_supplements || genetics.recommendations?.supplements, '#d3a64b')}${section('RECOVERY', data.action_recovery || genetics.recommendations?.recovery, '#9d72d5')}</div>${section('FOLLOW-UP TESTING', data.action_followup || genetics.followup_bloodwork, '#d98585')}${data.loom_url ? `<a class="loom-card" href="${esc(data.loom_url)}" target="_blank" rel="noopener"><span>▶</span><div><b>Coach video walkthrough</b><small>${esc(data.loom_description || 'Open report review')}</small></div></a>` : ''}</article>`;
}

function coachDiagnostics() {
  $('#clientWorkspaceBody').innerHTML = diagnosticsMarkup();
}

function diagnosticsMarkup() {
  const blood = state.data.diagnostics.filter((report) => /blood|lab/i.test(`${report.report_type} ${report.title}`));
  const genetics = state.data.diagnostics.filter((report) => /genetic|genome|dna/i.test(`${report.report_type} ${report.title}`));
  const other = state.data.diagnostics.filter((report) => !blood.includes(report) && !genetics.includes(report));
  return state.data.diagnostics.length ? `<div class="diagnostic-group"><h2>Blood Work</h2>${blood.map(diagnosticCard).join('') || '<div class="empty compact">No blood work report.</div>'}</div><div class="diagnostic-group"><h2>Genetic Testing</h2>${genetics.map(diagnosticCard).join('') || '<div class="empty compact">No genetic report.</div>'}</div>${other.length ? `<div class="diagnostic-group"><h2>Other Reports</h2>${other.map(diagnosticCard).join('')}</div>` : ''}` : '<div class="empty">No diagnostic reports are available.</div>';
}

function renderClient() {
  if (!state.client) return;
  if(!state.preview&&state.client.onboarding_status!=='complete') return renderActivation();
  if(!state.preview&&state.client.plan_status!=='published') return renderPlanPending();
  $('#clientNav').classList.remove('hidden');
  $$('#clientNav button').forEach((button) => button.classList.toggle('active', button.dataset.clientView === state.clientView));
  const views = {
    planner: clientPlanner, training: clientTraining,
    nutrition: clientNutrition, checkin: clientCheckin, progress: clientProgress,
    onboarding: clientOnboarding, legal: clientLegal, diagnostics: clientDiagnostics
  };
  try { (views[state.clientView] || clientPlanner)(); }
  catch (error) { renderError($('#clientMain'), error, renderClient); }
}

function renderActivation(){if(state.client.onboarding_status==='pending_legal')return renderLegalGate();return renderOnboardingWizard();}
function renderLegalGate(){show('#clientApp');$('#clientNav').classList.add('hidden');$('#clientMain').innerHTML=clientHeader('STEP 1 OF 2','Legal, health and privacy consent','Please read and accept before starting onboarding.')+`<form id="legalGate" class="panel legal-gate"><h2>Coaching participation and privacy notice</h2><p>The Legal Edge provides fitness, nutrition and lifestyle coaching and is not a substitute for medical diagnosis or treatment. You agree to disclose relevant health limitations and seek medical clearance where appropriate.</p><p>Your account stores coaching, health, progress and optional diagnostic information so your coach can deliver the service. Your information is restricted to you and authorised coaching staff, subject to the privacy policy and applicable law. Marketing use of photos is never automatic.</p><label class="toggle-field"><input name="health" type="checkbox" required> I confirm the information I provide will be accurate and I will report relevant health changes.</label><label class="toggle-field"><input name="privacy" type="checkbox" required> I accept the coaching privacy notice and account data processing.</label><label class="field">Full legal name<input name="signature_name" required></label><label class="field">Country<input name="country" required></label><label class="field">Date of birth<input name="date_of_birth" type="date" required></label><button class="btn primary">Accept and continue</button><small class="muted">Document version 1.0 · Solicitor reviewed</small></form>`;$('#legalGate').onsubmit=submitLegalGate;}
async function submitLegalGate(event){event.preventDefault();const fd=new FormData(event.target),now=new Date().toISOString();const row={client_id:state.client.id,consent_type:'coaching_privacy_health',document_name:'Coaching participation and privacy notice',document_version:'1.0',signed_at:now,accepted_at:now,signature_name:fd.get('signature_name'),signature_date:iso(new Date()),country:fd.get('country'),date_of_birth:fd.get('date_of_birth'),details:{health_confirmed:true,privacy_accepted:true,solicitor_reviewed:true}};setBusy(event.submitter,true);try{await query('Consent',db.from('legal_consents').upsert(row,{onConflict:'client_id,document_version'}).select());state.client.onboarding_status='pending_onboarding';renderOnboardingWizard();}catch(error){console.error('[legal-consent]',error);toast(error.message,'error');setBusy(event.submitter,false);}}
function renderOnboardingWizard(){show('#clientApp');$('#clientNav').classList.add('hidden');$('#clientMain').innerHTML=clientHeader('STEP 2 OF 2','Build your coaching profile','Training, nutrition and lifestyle. Usually 8–10 minutes.')+`<form id="onboardingWizard" class="panel onboarding-wizard"><h2>Training</h2><div class="editor-grid"><label>Training days available<input name="training_days" type="number" min="1" max="7" required></label><label>Experience<select name="training_experience"><option>Beginner</option><option>Intermediate 1–3 years</option><option>Advanced 3+ years</option></select></label><label>Preferred time<input name="preferred_training_time" required></label><label>Preferred style<input name="preferred_style"></label><label class="wide">Injuries, pain or limitations<textarea name="injuries" required></textarea></label><label>Gym name<input name="gym_name"></label><label>Gym town/city<input name="gym_location"></label><label class="wide">Equipment available<textarea name="equipment"></textarea></label></div><h2>Nutrition</h2><div class="editor-grid"><label>Current weight<input name="current_weight" type="number" step="0.1" required></label><label>Weight unit<select name="weight_unit"><option value="lb">lb</option><option value="kg">kg</option></select></label><label>Meals per day<input name="meals_per_day" type="number" min="1" max="8"></label><label>Prep time<select name="meal_prep_time"><option>Under 15 minutes</option><option>Up to 30 minutes</option><option>Up to 60 minutes</option></select></label><label class="wide">Typical day of eating<textarea name="typical_eating" required></textarea></label><label class="wide">Allergies, restrictions and foods to avoid<textarea name="food_restrictions"></textarea></label><label class="wide">Foods you want included<textarea name="foods_to_include"></textarea></label></div><h2>Lifestyle</h2><div class="editor-grid"><label>Work pattern<input name="work_pattern" placeholder="Office, hybrid, unpredictable…" required></label><label>Typical work hours<input name="work_hours"></label><label>Sleep hours<input name="sleep_hours" type="number" step="0.5"></label><label>Current daily steps<input name="current_steps" type="number"></label><label>Wearable<select name="wearable"><option value="none">None</option><option>Apple Watch</option><option>Google / Fitbit</option><option>Garmin</option><option>WHOOP</option><option>Oura</option><option>Other</option></select></label><label>Stress level (1–10)<input name="stress" type="number" min="1" max="10"></label><label class="wide">Primary goals and what success looks like<textarea name="goals" required></textarea></label><label class="wide">Travel, alcohol, family or schedule factors<textarea name="lifestyle_factors"></textarea></label></div><button class="btn primary">Submit onboarding</button></form>`;$('#onboardingWizard').onsubmit=submitOnboardingWizard;}
async function submitOnboardingWizard(event){event.preventDefault();const responses=Object.fromEntries(new FormData(event.target).entries()),now=new Date().toISOString();setBusy(event.submitter,true);try{await query('Onboarding',db.from('onboarding_responses').upsert({client_id:state.client.id,version:2,submitted_at:now,completed_at:now,responses:{sections:{training:{training_days:responses.training_days,experience:responses.training_experience,preferred_time:responses.preferred_training_time,style:responses.preferred_style,injuries:responses.injuries,gym_name:responses.gym_name,gym_location:responses.gym_location,equipment:responses.equipment},nutrition:{current_weight:responses.current_weight,weight_unit:responses.weight_unit,meals_per_day:responses.meals_per_day,meal_prep_time:responses.meal_prep_time,typical_eating:responses.typical_eating,restrictions:responses.food_restrictions,foods_to_include:responses.foods_to_include},lifestyle:{work_pattern:responses.work_pattern,work_hours:responses.work_hours,sleep_hours:responses.sleep_hours,current_steps:responses.current_steps,wearable:responses.wearable,stress:responses.stress,goals:responses.goals,lifestyle_factors:responses.lifestyle_factors}}}},{onConflict:'client_id,version'}).select());state.client.onboarding_status='complete';state.client.plan_status='coach_building';renderPlanPending();}catch(error){console.error('[onboarding-submit]',error);toast(error.message,'error');setBusy(event.submitter,false);}}
function renderPlanPending(){show('#clientApp');$('#clientNav').classList.add('hidden');$('#clientMain').innerHTML=`<section class="pending-plan"><img src="./assets/legal-edge-logo.svg" alt="The Legal Edge"><span class="eyebrow">ONBOARDING COMPLETE</span><h1>Your plan is being built.</h1><p>Calum is reviewing your training, nutrition and lifestyle information. Your full coaching workspace will unlock when the plan is published, normally within 24–48 hours.</p><div class="status-track"><span class="done">Account</span><span class="done">Legal</span><span class="done">Onboarding</span><span>Coach review</span></div></section>`;}

function clientToday() {
  const today = iso(new Date());
  const sessions = state.data.sessions.filter((session) => session.session_date === today);
  const step = state.data.steps.find((entry) => entry.entry_date === today);
  const actual = Number(step?.actual_steps || step?.steps || 0);
  const plan = state.data.nutritionPlans.find((entry) => entry.is_active !== false);
  const tasks = sessions.length + 1;
  const complete = sessions.filter((session) => session.status === 'completed').length + (actual >= safeStepGoal() ? 1 : 0);
  $('#clientMain').innerHTML = clientHeader('TODAY', `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${state.client.display_name.split(' ')[0]}.`, 'Everything important for today, in one place.') + `
    <div class="today-score"><div><strong>${complete}/${tasks}</strong><span>completed</span></div><div class="progress-bar"><i style="width:${tasks ? complete / tasks * 100 : 0}%"></i></div></div>
    <div class="today-grid"><section class="panel"><div class="panel-head"><h3>Today’s plan</h3></div>${sessions.map((session) => taskMarkup(session)).join('') || '<div class="empty">No training is scheduled today.</div>'}<label class="task ${actual >= safeStepGoal() ? 'done' : ''}"><input type="checkbox" data-step-date="${today}" ${actual >= safeStepGoal() ? 'checked' : ''}><span><b>${safeStepGoal().toLocaleString()} steps</b><small>${actual ? `${actual.toLocaleString()} recorded` : 'Daily movement target'}</small></span></label></section>
    <section class="panel"><div class="panel-head"><h3>Nutrition targets</h3></div>${macroStrip(plan)}</section></div>
    ${milestones()}`;
  bindCompletionActions();
}

function milestones() {
  const entries = [...state.data.progress].filter((entry) => entry.weight_kg != null).sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
  const latest = entries.at(-1)?.weight_kg;
  const loss = latest != null && state.client.start_weight_kg != null ? (Number(state.client.start_weight_kg) - Number(latest)) * (state.client.weight_unit === 'lbs' ? 2.20462 : 1) : 0;
  const checkins = state.data.checkins;
  const cards = [
    ['Weight', loss >= 5 ? `${loss.toFixed(1)} ${state.client.weight_unit === 'lbs' ? 'lb' : 'kg'} down` : 'Progress building'],
    ['Consistency', checkins.length >= 4 ? `${Math.min(checkins.length, 4)} weeks recorded` : 'Build a four-week streak'],
    ['Training', checkins.some((item) => Number(item.training_adherence) >= 90) ? '90%+ adherence week' : 'Complete the planned week'],
    ['Recovery', checkins.some((item) => Number(item.sleep) >= 8) ? 'Strong sleep week' : 'Build recovery consistency']
  ];
  return `<section class="milestone-strip">${cards.map(([name, value]) => `<div><span>${name}</span><strong>${value}</strong></div>`).join('')}</section>`;
}

function taskMarkup(session) {
  return `<label class="task ${session.status === 'completed' ? 'done' : ''}"><input type="checkbox" data-session-complete="${session.id}" ${session.status === 'completed' ? 'checked' : ''}><span><b>${esc(session.title)}</b><small>${title(session.training_type)}${session.duration_minutes ? ` · ${session.duration_minutes} min` : ''}</small></span></label>`;
}

function clientPlanner() {
  const days = weekDays();
  const scheduled = days.reduce((count, day) => count + day.sessions.length + 1, 0);
  const completed = days.reduce((count, day) => count + day.sessions.filter((session) => session.status === 'completed').length + (Number(day.step?.actual_steps || day.step?.steps || 0) >= safeStepGoal() ? 1 : 0), 0);
  $('#clientMain').innerHTML = clientHeader('YOUR WEEK', 'Weekly planner', 'Training, steps, cardio, mobility and nutrition together.') + `<div class="planner-adherence"><strong>${completed}/${scheduled} completed</strong><span>${scheduled ? Math.round(completed / scheduled * 100) : 0}% adherence</span></div>${plannerCards({ interactive: true })}`;
  bindCompletionActions();
  bindOpenSessions();
}

function bindOpenSessions() {
  $$('[data-open-session]').forEach((button) => button.onclick = () => {
    state.selectedSessionId = button.dataset.openSession;
    state.clientView = 'training';
    renderClient();
  });
}

function bindCompletionActions() {
  $$('[data-session-complete]').forEach((input) => input.onchange = async () => {
    const session = state.data.sessions.find((item) => item.id === input.dataset.sessionComplete);
    if (!session) return;
    const previous = session.status;
    session.status = input.checked ? 'completed' : 'planned';
    input.closest('.task')?.classList.toggle('done', input.checked);
    if (state.preview) return toast('Preview updated');
    try {
      await query('Session completion', db.from('training_sessions').update({ status: session.status, completed_at: input.checked ? new Date().toISOString() : null }).eq('id', session.id).select());
      toast('Weekly plan updated');
    } catch (error) { session.status = previous; input.checked = previous === 'completed'; input.closest('.task')?.classList.toggle('done', input.checked); toast(error.message, 'error'); }
  });
  $$('[data-step-date]').forEach((input) => input.onchange = async () => {
    const date = input.dataset.stepDate;
    const old = state.data.steps.find((entry) => entry.entry_date === date);
    const actual = input.checked ? safeStepGoal() : 0;
    const row = { client_id: state.client.id, entry_date: date, target_steps: safeStepGoal(), actual_steps: actual };
    if (old) Object.assign(old, row); else state.data.steps.push(row);
    input.closest('.task')?.classList.toggle('done', input.checked);
    if (state.preview) return toast('Preview updated');
    try {
      await query('Steps', db.from('step_entries').upsert(row, { onConflict: 'client_id,entry_date' }).select());
      toast('Steps updated');
    } catch (error) { if (old) old.actual_steps = old.steps = input.checked ? 0 : safeStepGoal(); input.checked = !input.checked; input.closest('.task')?.classList.toggle('done', input.checked); toast(error.message, 'error'); }
  });
}

function clientTraining() {
  const week = currentWeek();
  const allSessions = state.data.sessions.filter((session) => !week || session.week_id === week.id);
  const categories = [
    ['weights', 'Weights', allSessions.filter((session) => ['weights', 'resistance'].includes(session.training_type)).length],
    ['cardio', 'Cardio', allSessions.filter((session) => session.training_type === 'cardio').length],
    ['mobility', 'Mobility', allSessions.filter((session) => ['mobility', 'recovery'].includes(session.training_type)).length],
    ['steps', 'Steps', 7]
  ];
  const categoryTabs = `<div class="training-category-tabs">${categories.map(([key, label, count]) => `<button type="button" data-training-category="${key}" class="${state.trainingCategory === key ? 'active' : ''}"><b>${label}</b><span>${count}</span></button>`).join('')}</div>`;
  if (state.trainingCategory === 'steps') {
    const days = weekDays();
    $('#clientMain').innerHTML = clientHeader('', 'Training & activity', 'Your weights, cardio, mobility and steps in one clear place.') + categoryTabs + `<section class="panel"><div class="panel-head"><div><h2>Daily steps</h2><span class="sub">Minimum ${safeStepGoal().toLocaleString()} each day</span></div></div><div class="activity-list">${days.map((day) => { const actual = Number(day.step?.actual_steps || day.step?.steps || 0); return `<label class="task ${actual >= safeStepGoal() ? 'done' : ''}"><input type="checkbox" data-step-date="${day.date}" ${actual >= safeStepGoal() ? 'checked' : ''}><span><b>${fmt(day.date, { weekday: 'long', day: 'numeric', month: 'short' })}</b><small>${actual ? `${actual.toLocaleString()} recorded` : `${safeStepGoal().toLocaleString()} target`}</small></span></label>`; }).join('')}</div></section>`;
    bindTrainingCategoryTabs(); bindCompletionActions(); return;
  }
  if (state.trainingCategory === 'cardio' || state.trainingCategory === 'mobility') {
    const sessions = allSessions.filter((session) => state.trainingCategory === 'cardio' ? session.training_type === 'cardio' : ['mobility', 'recovery'].includes(session.training_type));
    $('#clientMain').innerHTML = clientHeader('', 'Training & activity', 'Your weights, cardio, mobility and steps in one clear place.') + categoryTabs + `<section class="panel"><div class="panel-head"><div><h2>${state.trainingCategory === 'cardio' ? 'Cardio' : 'Mobility & recovery'}</h2><span class="sub">${sessions.length} sessions this week</span></div></div><div class="activity-list">${sessions.map((session) => `<div class="activity-session">${taskMarkup(session)}${session.notes ? `<p>${esc(session.notes)}</p>` : ''}<div class="activity-rx">${session.duration_minutes ? `<span>${session.duration_minutes} min</span>` : ''}${session.distance_km ? `<span>${session.distance_km} km</span>` : ''}${session.zone ? `<span>${esc(session.zone)}</span>` : ''}${session.heart_rate_target ? `<span>${esc(session.heart_rate_target)}</span>` : ''}</div></div>`).join('') || '<div class="empty">Nothing assigned in this section.</div>'}</div></section>`;
    bindTrainingCategoryTabs(); bindCompletionActions(); return;
  }
  const sessions = allSessions.filter((session) => ['weights', 'resistance'].includes(session.training_type));
  const selected = sessions.find((session) => session.id === state.selectedSessionId);
  if (!selected) {
    $('#clientMain').innerHTML = clientHeader('', 'Training & activity', 'Your weights, cardio, mobility and steps in one clear place.') + categoryTabs + `<div class="session-picker">${sessions.map((session) => `<button class="session-tile" data-open-session="${session.id}"><span>${fmt(session.session_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><strong>${esc(session.title)}</strong><small>${exercisesForSession(session).length} exercises · ${session.status === 'completed' ? 'Completed' : 'Planned'}</small></button>`).join('') || '<div class="empty">No weights or resistance session is scheduled this week.</div>'}</div>`;
    bindTrainingCategoryTabs(); return bindOpenSessions();
  }
  $('#clientMain').innerHTML = `<button class="text-btn back-to-sessions" id="backToSessions">← All sessions</button>` + clientHeader('', selected.title, fmt(selected.session_date, { weekday: 'long', day: 'numeric', month: 'long' })) + categoryTabs + `<section class="panel workout"><div class="panel-head"><div><h2>Workout prescription</h2><span class="sub">${exercisesForSession(selected).length} exercises</span></div>${taskMarkup(selected)}</div>${exercisesForSession(selected).map((exercise) => exerciseCard(exercise, true)).join('') || '<div class="empty">No exercise prescription is attached to this workout.</div>'}</section>`;
  $('#backToSessions').onclick = () => { state.selectedSessionId = null; clientTraining(); };
  bindTrainingCategoryTabs();
  bindCompletionActions();
  $$('[data-exercise-log]').forEach((form) => form.onsubmit = saveExerciseLog);
}

function bindTrainingCategoryTabs() {
  $$('[data-training-category]').forEach((button) => button.onclick = () => { state.trainingCategory = button.dataset.trainingCategory; state.selectedSessionId = null; clientTraining(); });
}

function clientOnboarding() {
  const record = state.data.onboarding[0];
  $('#clientMain').innerHTML = clientHeader('', 'Onboarding', 'Your original coaching profile and responses.') + (record ? `<section class="panel response-sheet">${responseTree(record.responses)}</section>` : '<div class="empty">No onboarding record is available.</div>');
}

function clientLegal() {
  $('#clientMain').innerHTML = clientHeader('', 'Legal & consent', 'Your recorded agreements and consent history.') + (state.data.legal.length ? state.data.legal.map((record) => `<section class="panel legal-record"><div class="panel-head"><h2>${esc(record.document_name || record.consent_type || 'Consent record')}</h2><span>${fmt(record.signed_at || record.accepted_at || record.created_at)}</span></div>${responseTree(record.details || record.responses || record.visible_content)}</section>`).join('') : '<div class="empty">No legal or consent record is available.</div>');
}

async function saveExerciseLog(event) {
  event.preventDefault();
  const exercise = state.data.exercises.find((item) => item.id === event.target.dataset.exerciseLog);
  const fd = new FormData(event.target);
  const rows = Array.from({ length: Math.max(1, Number(exercise.sets || 1)) }, (_, index) => {
    const set = index + 1;
    const reps = Number(fd.get(`reps_${set}`) || 0);
    const load = Number(fd.get(`load_${set}`) || 0);
    const rir = Number(fd.get(`rir_${set}`) || 0);
    return { client_id: state.client.id, program_exercise_id: exercise.id, exercise_bank_id: exercise.exercise_bank_id || null, performed_at: new Date().toISOString(), set_number: set, reps: reps || null, load: load || null, load_unit: state.client.weight_unit === 'lbs' ? 'lb' : 'kg', rir: rir || null, completed: Boolean(reps || load) };
  }).filter((row) => row.reps != null || row.load != null);
  if (!rows.length) return toast('Enter reps or load before saving', 'error');
  if (state.preview) { state.data.exerciseLogs.unshift(...rows.map((row, index) => ({ ...row, id: `preview-log-${Date.now()}-${index}` }))); toast('Set log saved in preview'); return clientTraining(); }
  setBusy(event.submitter, true);
  try { const saved = await query('Exercise log', db.from('exercise_set_logs').insert(rows).select()); state.data.exerciseLogs.unshift(...saved); toast('Exercise log saved'); clientTraining(); }
  catch (error) { toast(error.message, 'error'); }
  finally { setBusy(event.submitter, false); }
}

function clientCardio() {
  const sessions = state.data.sessions.filter((session) => session.training_type === 'cardio');
  $('#clientMain').innerHTML = clientHeader('CONDITIONING', 'Cardio', 'Structured running, cycling, swimming, boxing and conditioning.') + `<section class="panel">${sessions.map(taskMarkup).join('') || '<div class="empty">No cardio is assigned.</div>'}</section>`;
  bindCompletionActions();
}

function clientMobility() {
  const sessions = state.data.sessions.filter((session) => session.training_type === 'mobility' || session.training_type === 'recovery');
  $('#clientMain').innerHTML = clientHeader('RECOVERY', 'Mobility', 'Optional mobility and recovery work from your coach.') + `<section class="panel">${sessions.map(taskMarkup).join('') || '<div class="empty">No mobility work is assigned.</div>'}</section>`;
  bindCompletionActions();
}

function clientSteps() {
  const goal = safeStepGoal();
  const entries = state.data.steps.slice(0, 30);
  const latest = Number(entries[0]?.actual_steps || entries[0]?.steps || 0);
  $('#clientMain').innerHTML = clientHeader('DAILY MOVEMENT', 'Steps', 'Walking belongs here, separate from structured cardio.') + `<div class="performance-hero"><div><span class="eyebrow">DAILY MINIMUM</span><h2>${goal.toLocaleString()} steps</h2></div><div class="hero-score"><strong>${latest ? latest.toLocaleString() : '—'}</strong><span>LATEST</span></div></div><section class="panel">${entries.map((entry) => `<div class="note-row"><b>${fmt(entry.entry_date)}</b><span>${Number(entry.actual_steps || entry.steps || 0).toLocaleString()} / ${goal.toLocaleString()}</span></div>`).join('') || '<div class="empty">No steps recorded yet.</div>'}</section>`;
}

function clientNutrition() {
  const plans = state.data.nutritionPlans.filter((plan) => plan.is_active !== false);
  const selected = plans.find((plan) => plan.id === state.selectedNutritionPlanId) || plans.find((plan) => nutritionDayLabel(plan) === 'Training Day') || plans[0];
  state.selectedNutritionPlanId = selected?.id || null;
  $('#clientMain').innerHTML = clientHeader('', 'Nutrition', 'Your targets, exact foods and preparation for each type of day.') + (plans.length ? `<div class="nutrition-day-tabs">${plans.map((plan) => `<button type="button" data-nutrition-plan="${plan.id}" class="${plan.id === selected.id ? 'active' : ''}">${esc(nutritionDayLabel(plan))}</button>`).join('')}</div>${nutritionPlanMarkup(selected)}` : '<div class="empty">No active nutrition plan is available.</div>');
  $$('[data-nutrition-plan]').forEach((button) => button.onclick = () => { state.selectedNutritionPlanId = button.dataset.nutritionPlan; clientNutrition(); });
}

function slider(name, label, value = 5, inverse = false) {
  return `<label class="slider-field"><span>${esc(label)}</span><output data-slider-output="${name}">${value}</output><input name="${name}" type="range" min="1" max="10" value="${value}" data-inverse="${inverse}"><small>1 — 10</small></label>`;
}

function clientCheckin() {
  const unit = state.client.weight_unit === 'lbs' ? 'lb' : 'kg';
  $('#clientMain').innerHTML = clientHeader('WEEKLY REVIEW', 'Check-in', `Your check-in day is ${DAYS[state.client.checkin_day ?? 5]}. Missed weeks can still be submitted.`) + `<form id="checkinForm" class="panel checkin-form quick-checkin"><div class="checkin-grid"><label class="field">Week number<input name="week_number" type="number" min="1" value="${currentWeek()?.week_number || ''}"></label><label class="field">Weight (${unit})<input name="weight_display" type="number" step="0.1"></label><label class="field">Average daily steps<input name="average_steps" type="number"></label><label class="field">Training completed %<input name="training_adherence" type="number" min="0" max="100"></label><label class="field">Nutrition adherence %<input name="nutrition_adherence" type="number" min="0" max="100"></label></div><div class="checkin-sliders">${slider('energy', 'Energy')}${slider('sleep', 'Sleep')}${slider('stress', 'Stress', 5, true)}${slider('hunger', 'Hunger', 5, true)}${slider('cravings', 'Cravings', 5, true)}</div><label class="field wide">Biggest win<textarea name="wins" rows="2"></textarea></label><label class="field wide">Main challenge or feedback<textarea name="challenges" rows="2"></textarea></label><label class="field wide">Support needed next week<textarea name="support_needed" rows="2"></textarea></label><button class="btn primary wide">Submit weekly check-in</button></form><section class="client-history"><div class="panel-head"><h2>Previous check-ins</h2><span class="pill">${state.data.checkins.length} WEEKS</span></div>${state.data.checkins.map((checkin) => checkinCard(checkin)).join('') || '<div class="empty">No previous check-ins.</div>'}</section>`;
  $$('input[type="range"]').forEach((input) => input.oninput = () => $(`[data-slider-output="${input.name}"]`).textContent = input.value);
  $('#checkinForm').onsubmit = submitCheckin;
}

async function submitCheckin(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const weightDisplay = Number(fd.get('weight_display') || 0);
  const row = { client_id: state.client.id, submitted_at: new Date().toISOString() };
  for (const [key, value] of fd) {
    if (key === 'weight_display') continue;
    row[key] = ['week_number', 'average_steps', 'training_adherence', 'nutrition_adherence', 'energy', 'sleep', 'stress', 'hunger', 'cravings'].includes(key) ? (value === '' ? null : Number(value)) : (value || null);
  }
  if (weightDisplay) row.weight_kg = weightDisplay / (state.client.weight_unit === 'lbs' ? 2.20462 : 1);
  if (state.preview) { state.data.checkins.unshift({ ...row, id: `preview-${Date.now()}` }); toast('Check-in submitted in preview'); return clientCheckin(); }
  setBusy(event.submitter, true, 'Submitting…');
  try {
    const [saved] = await query('Check-in', db.from('checkins').insert(row).select());
    state.data.checkins.unshift(saved);
    if (row.weight_kg) {
      const progressRow = { client_id: state.client.id, entry_date: iso(new Date()), weight_kg: row.weight_kg, steps: row.average_steps || null };
      const [progress] = await query('Progress', db.from('progress_entries').upsert(progressRow, { onConflict: 'client_id,entry_date' }).select());
      const index = state.data.progress.findIndex((entry) => entry.entry_date === progress.entry_date);
      if (index >= 0) state.data.progress[index] = progress; else state.data.progress.unshift(progress);
    }
    toast('Check-in and progress saved');
    clientCheckin();
  } catch (error) { toast(error.message, 'error'); }
  finally { setBusy(event.submitter, false); }
}

function clientProgress() {
  const photos = state.data.files.filter((file) => file.file_type === 'progress_photo');
  $('#clientMain').innerHTML = clientHeader('', 'Progress', '') + progressDashboardMarkup() + `<form id="progressForm" class="panel checkin-form"><div class="panel-head wide"><h3>Log progress</h3></div><label class="field">Weight (${state.client.weight_unit === 'lbs' ? 'lb' : 'kg'})<input name="weight_display" type="number" step="0.1" inputmode="decimal"></label><label class="field">Waist (cm)<input name="waist_cm" type="number" step="0.1" inputmode="decimal"></label><button class="btn primary wide">Save progress</button></form><section class="panel"><div class="panel-head"><div><h3>Progress photos</h3><span class="sub">Front, side and back by week</span></div><span class="pill">${photos.length} PHOTOS</span></div><form id="photoForm" class="photo-form"><label>View<select name="photo_view"><option>front</option><option>side</option><option>back</option></select></label><label>Week<input name="week_number" type="number" min="1" value="${currentWeek()?.week_number || ''}"></label><label>Photo<input name="photo" type="file" accept="image/*" required></label><button class="btn primary">Upload photo</button></form>${photos.map((photo) => `<div class="note-row"><b>Week ${photo.week_number || '—'} · ${title(photo.photo_view || 'photo')}</b><span>${fmt(photo.created_at)} · ${esc(photo.original_name || '')}</span></div>`).join('') || '<div class="empty">No progress photos yet.</div>'}</section>`;
  bindProgressRange(clientProgress);
  $('#progressForm').onsubmit = submitProgress;
  $('#photoForm').onsubmit = uploadProgressPhoto;
}

async function uploadProgressPhoto(event) {
  event.preventDefault();
  if (state.preview) return toast('Photo upload is available after sign in');
  const fd = new FormData(event.target), file = fd.get('photo'), view = fd.get('photo_view');
  const week = Number(fd.get('week_number')) || null;
  const path = `${state.client.id}/${Date.now()}-${view}-${String(file.name).replace(/[^a-z0-9._-]/gi, '-')}`;
  setBusy(event.submitter, true, 'Uploading…');
  try {
    const { error: uploadError } = await db.storage.from('client-files').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const [saved] = await query('Photo record', db.from('client_files').insert({ client_id: state.client.id, uploaded_by: state.user.id, file_type: 'progress_photo', storage_path: path, original_name: file.name, mime_type: file.type, week_number: week, photo_view: view }).select());
    state.data.files.unshift(saved); toast('Progress photo uploaded'); clientProgress();
  } catch (error) { toast(error.message, 'error'); setBusy(event.submitter, false); }
}

async function submitProgress(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const display = Number(fd.get('weight_display') || 0);
  const row = { client_id: state.client.id, entry_date: iso(new Date()), weight_kg: display ? display / (state.client.weight_unit === 'lbs' ? 2.20462 : 1) : null, waist_cm: Number(fd.get('waist_cm')) || null };
  if (state.preview) { state.data.progress.unshift(row); toast('Progress saved in preview'); return clientProgress(); }
  setBusy(event.submitter, true);
  try {
    const [saved] = await query('Progress', db.from('progress_entries').upsert(row, { onConflict: 'client_id,entry_date' }).select());
    const index = state.data.progress.findIndex((entry) => entry.entry_date === saved.entry_date);
    if (index >= 0) state.data.progress[index] = saved; else state.data.progress.unshift(saved);
    toast('Progress saved');
    clientProgress();
  } catch (error) { toast(error.message, 'error'); }
  finally { setBusy(event.submitter, false); }
}

function clientDiagnostics() {
  $('#clientMain').innerHTML = clientHeader('', 'Diagnostics', '') + diagnosticsMarkup();
}

function bindShell() {
  $('#loginForm').onsubmit = async (event) => {
    event.preventDefault();
    $('#authMsg').textContent = 'Signing in…';
    if (!db) return $('#authMsg').textContent = 'Secure login failed to load. Refresh the page.';
    const { error } = await db.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
    if (error) return $('#authMsg').textContent = error.message;
    await boot();
  };
  $('#resetBtn').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email) return $('#authMsg').textContent = 'Enter your email first.';
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    $('#authMsg').textContent = error ? error.message : 'Password reset email sent.';
  };
  $('#ownerSetupBtn').onclick = () => $('#authMsg').textContent = 'Coach account setup is disabled on the public client app. Use the authorised account.';
  $('#coachPreviewBtn').onclick = () => preview('coach');
  $('#clientPreviewBtn').onclick = () => preview('client');
  $('#mobileMenu').onclick = () => $('.sidebar')?.classList.toggle('open');
  $('#returnCoach').onclick = () => { $('#returnCoach').classList.add('hidden'); show('#coachApp'); renderCoach(); };
  $$('.logout').forEach((button) => button.onclick = async () => {
    if (!state.preview && db) await db.auth.signOut();
    location.reload();
  });
  $('#coachNav').onclick = (event) => {
    const button = event.target.closest('[data-coach-view]');
    if (!button) return;
    state.coachView = button.dataset.coachView;
    state.client = null;
    state.data = emptyData();
    renderCoach();
  };
  $('#clientNav').onclick = (event) => {
    const button = event.target.closest('[data-client-view]');
    if (!button || button.classList.contains('hidden')) return;
    state.clientView = button.dataset.clientView;
    renderClient();
  };
  $$('.account-menu [data-account-view]').forEach((button) => button.onclick = () => {
    state.clientView = button.dataset.accountView;
    renderClient();
    button.closest('details').open = false;
  });
}

bindShell();
boot();
