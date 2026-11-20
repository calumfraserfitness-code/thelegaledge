const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');

const dom=new JSDOM('<div id="home"><h1 class="pch-heading">Today</h1><section class="pch-next"></section></div>',{
 url:'https://test.invalid',runScripts:'outside-only'
});
const w=dom.window,root=w.document.querySelector('#home');
let day='2026-11-20',lastRoute=null;
Object.assign(w,{
 state:{role:'client',user:{id:'account'},client:{id:'client',plan_status:'published'}},
 localCoachingDate:()=>day,
 esc:value=>String(value).replaceAll('<','&lt;')
});
w.eval(fs.readFileSync(require.resolve('../day-type.js'),'utf8'));
const sessions=[
 {id:'long',title:'Regular workout',training_type:'weights',duration_minutes:45,status:'planned',session_date:day},
 {id:'short',title:'Short <approved> workout',training_type:'cardio',duration_minutes:20,status:'planned',session_date:day},
 {id:'recovery',title:'Mobility',training_type:'mobility',duration_minutes:10,status:'planned',session_date:day},
 {id:'completed',title:'Already done',training_type:'recovery',duration_minutes:5,status:'completed',session_date:day},
 {id:'other',title:'Tomorrow’s session',training_type:'weights',duration_minutes:5,status:'planned',session_date:'2026-11-21'}
];
const pick=type=>root.querySelector('[data-day-type="'+type+'"]').click();
w.DayType.mount(root,{date:day,action:{route:'training'}},sessions.filter(s=>s.id!=='recovery'),()=>true,route=>{lastRoute=route;});
assert.equal(root.querySelector('[aria-pressed=true]').dataset.dayType,'normal');
pick('deadline');
assert.match(root.querySelector('[data-day-actions]').textContent,/Short <approved> workout/);
assert.equal(root.querySelector('approved'),null);
assert(root.querySelector('.pch-next').classList.contains('day-type-hidden'));
root.querySelector('[data-day-session]').click();
assert.equal(lastRoute,'training');
assert.equal(w.state.selectedSessionId,'short');
assert.equal(w.state.trainingCategory,'cardio');
pick('trial');
assert.match(root.querySelector('[data-day-actions]').textContent,/training optional today/);
assert.equal(w.DayType.get(day),'trial');
assert.equal(JSON.parse(w.localStorage.getItem('legal-edge-day-type:account:client')).type,'trial');
w.eval(fs.readFileSync(require.resolve('../day-type.js'),'utf8'));
assert.equal(w.DayType.get(day),'trial','choice survives a fresh module load');
w.state.user.id='different';
assert.equal(w.DayType.get(day),'normal');
w.state.user.id='account';
assert.equal(w.DayType.get('2026-11-21'),'normal');
pick('normal');
assert(!root.querySelector('.pch-next').classList.contains('day-type-hidden'));
assert.equal(root.querySelector('[data-day-actions]').textContent,'');
root.querySelector('.day-type').remove();
w.DayType.mount(root,{date:day,action:{route:'training'}},sessions,()=>true,route=>{lastRoute=route;});
pick('trial');
assert.match(root.querySelector('[data-day-actions]').textContent,/Mobility/);
root.querySelector('[data-day-session]').click();
assert.equal(w.state.trainingCategory,'mobility');
dom.window.close();
