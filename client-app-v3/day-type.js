/* A daily view of the published plan for days with less time. */
(function(){
 'use strict';
 const types={
  normal:{label:'Normal day',when:'Your usual routine fits.'},
  deadline:{label:'Deadline day',when:'Work is tight, but you have a short window.'},
  trial:{label:'Trial or closing day',when:'Work takes most of the day and training may need to wait.'}
 };
 const recoveryTypes=['mobility','recovery'];
 const trainingTypes=['weights','resistance','cardio',...recoveryTypes];
 const valid=type=>Object.hasOwn(types,type);
 function storageKey(){
  const owner=state.preview?'sample':state.user?.id;
  return owner&&state.client?.id?'legal-edge-day-type:'+owner+':'+state.client.id:null;
 }
 let choice=null;
 function get(date){
  const key=storageKey();
  if(!key)return 'normal';
  if(choice?.key===key&&choice.date===date)return choice.type;
  try{
   const saved=JSON.parse(localStorage.getItem(key));
   if(saved?.date===date&&valid(saved.type))return saved.type;
  }catch{}
  return 'normal';
 }
 function save(date,type){
  const key=storageKey();
  if(!key)return;
  choice={key,date,type};
  try{localStorage.setItem(key,JSON.stringify({date,type}));}catch{}
 }
 function shortSession(type,date,sessions){
  if(type==='normal')return null;
  return sessions.filter(s=>s.session_date===date&&s.status==='planned'&&
   (!window.FlexibleCompletion||!window.FlexibleCompletion.done(s,date))&&
   (type==='trial'?recoveryTypes:trainingTypes).includes(s.training_type)&&
   Number(s.duration_minutes)>0&&Number(s.duration_minutes)<=(type==='trial'?15:30))
   .sort((a,b)=>Number(a.duration_minutes)-Number(b.duration_minutes))[0]||null;
 }
 function mount(root,m,sessions,active,route){
  if(!storageKey()||(!state.preview&&state.client.plan_status!=='published'))return;
  const section=document.createElement('section');
  section.className='panel day-type';
  section.setAttribute('aria-labelledby','dayTypeHeading');
  section.innerHTML='<h2 id="dayTypeHeading">What kind of day is it?</h2><div class="day-type-options" role="group" aria-label="Day type">'+
   Object.entries(types).map(([id,t])=>'<button type="button" data-day-type="'+id+'" aria-pressed="false"><strong>'+t.label+'</strong><span>'+t.when+'</span></button>').join('')+
   '</div><div data-day-actions></div>';
  root.querySelector('.pch-heading').after(section);
  const actions=section.querySelector('[data-day-actions]');
  function paint(){
   const type=get(m.date),adjusted=type!=='normal',trial=type==='trial';
   section.querySelectorAll('[data-day-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.dayType===type)));
   const regularNext=root.querySelector('.pch-next');
   if(regularNext&&m.action.route==='training')regularNext.classList.toggle('day-type-hidden',adjusted);
   if(!adjusted){actions.innerHTML='';return;}
   const session=shortSession(type,m.date,sessions);
   const training=session?esc(session.title)+' · '+esc(session.duration_minutes)+' min. Open it when you have room.':
    trial?'Keep training optional today. Pick a realistic time for your next session when work eases.':
    'Use an assigned short session if one fits. Move today’s workout to a better slot if you need to.';
   const nutrition=trial?'Pick an easy meal you already know you can get or bring to work.':
    'Use an assigned meal you can pack, prep quickly, or reheat.';
   const checkin=state.client.weekly_checkin_enabled!==false;
   actions.innerHTML='<dl class="day-type-actions"><div><dt>Training</dt><dd>'+training+(session?'<button type="button" class="text-btn" data-day-session>Open short session</button>':
    '<button type="button" class="text-btn" data-day-planner>Open schedule</button>')+'</dd></div>'+
    '<div><dt>Food</dt><dd>'+nutrition+'<button type="button" class="text-btn" data-day-meals>See quick meal options</button></dd></div>'+
    (checkin?'<div><dt>Check-in</dt><dd>'+(m.saved?'Your check-in is in.':trial?
     'When you have a minute, tell Calum what you managed and what needs to move.':
     'Keep it brief. Tell Calum what worked and where you need a hand.')+'<button type="button" class="text-btn" data-day-checkin>'+(m.saved?'View saved check-in':'Open check-in')+'</button></dd></div>':'')+'</dl>';
   actions.querySelector('[data-day-session]')?.addEventListener('click',()=>{
    if(!active())return;
    state.selectedSessionId=session.id;
    state.trainingCategory=recoveryTypes.includes(session.training_type)?'mobility':session.training_type==='cardio'?'cardio':'weights';
    route('training');
   });
   actions.querySelector('[data-day-planner]')?.addEventListener('click',()=>{if(active())route('planner');});
   actions.querySelector('[data-day-meals]')?.addEventListener('click',()=>{
    if(!active())return;
    if(window.openDailyNutritionDate){
     state.clientView='nutrition';window.openDailyNutritionDate(null);
    }else route('nutrition');
   });
   actions.querySelector('[data-day-checkin]')?.addEventListener('click',()=>{if(active()){state.checkinWeek=null;route('checkin');}});
  }
  section.querySelectorAll('[data-day-type]').forEach(button=>button.onclick=()=>{
   if(!active()||localCoachingDate()!==m.date)return;
   save(m.date,button.dataset.dayType);paint();
  });
  paint();
 }
 window.DayType={get,mount};
})();
