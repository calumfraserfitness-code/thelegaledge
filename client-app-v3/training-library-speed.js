/* The optional catalogue is fetched on demand and rendered one small page at a time. */
(function(){
 'use strict';let library={owner:'',rows:null,at:0,request:null};
 const owner=()=>[state.user?.id,state.role,state.preview?'sample':'live'].join(':');
 exerciseBankMarkup=function(){return '<section class="panel bank-panel"><h2>Exercise / video bank</h2><p>Search your exercise library when you need to add a movement.</p><button type="button" class="btn ghost" data-bank-open>Open exercise library</button><div data-bank-library></div></section>';};
 const before=coachTraining;
 coachTraining=function(){const result=before(),host=$('#clientWorkspaceBody'),box=host?.querySelector('.bank-panel');if(!box||state.role!=='coach'||!state.client)return result;
  const client=state.client.id,user=state.user?.id,key=owner(),active=()=>box.isConnected&&state.role==='coach'&&state.user?.id===user&&state.client?.id===client&&owner()===key;
  let opened=false,page=0,term='';
  function paint(){if(!active())return;const all=state.data.exerciseBank||[],matches=all.filter(r=>!term||[r.name,r.category,r.body_area].join(' ').toLowerCase().includes(term)),pages=Math.max(1,Math.ceil(matches.length/24));page=Math.min(page,pages-1);const rows=matches.slice(page*24,(page+1)*24),days=state.data.programs.flatMap(p=>p.days||[]),target=box.querySelector('[data-bank-library]');
   target.innerHTML='<label>Search exercises<input type="search" data-bank-find placeholder="Name, equipment or movement"></label><p role="status">'+(matches.length?'Showing '+(page*24+1)+'–'+Math.min((page+1)*24,matches.length)+' of '+matches.length+' exercises.':'No matching exercises.')+'</p>'+(rows.length&&days.length?'<form id="addBankExercise" class="editor-grid bank-assign"><label>Exercise<select name="exercise_bank_id">'+rows.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+'</option>').join('')+'</select></label><label>Training day<select name="program_day_id">'+days.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.title)+'</option>').join('')+'</select></label><label>Sets<input name="sets" type="number" min="1" value="3"></label><label>Reps<input name="reps" value="8–12"></label><label>Rest (seconds)<input name="rest_seconds" type="number" min="0" value="90"></label><button class="btn primary">Add to programme</button></form>':'')+'<div class="bank-grid">'+rows.map(r=>'<article class="bank-card"><div><b>'+esc(r.name)+'</b><small>'+esc(r.category||r.body_area||'Exercise')+'</small></div>'+(safeMediaUrl(r.video_url)?'<a href="'+esc(safeMediaUrl(r.video_url))+'" target="_blank" rel="noopener">Video</a>':'<span class="muted">No video</span>')+'</article>').join('')+'</div><div class="brief-actions"><button type="button" class="btn ghost" data-bank-page="-1" '+(page===0?'disabled':'')+'>Previous</button><button type="button" class="btn ghost" data-bank-page="1" '+(page>=pages-1?'disabled':'')+'>Next</button></div>';
   const search=target.querySelector('[data-bank-find]');search.value=term;search.oninput=()=>{if(!active())return;term=search.value.toLowerCase();page=0;const cursor=search.selectionStart;paint();const next=target.querySelector('[data-bank-find]');next.focus();try{next.setSelectionRange(cursor,cursor);}catch{}};
   target.querySelector('#addBankExercise')?.addEventListener('submit',addExerciseFromBank);target.querySelectorAll('[data-bank-page]').forEach(b=>b.onclick=()=>{if(active()){page+=Number(b.dataset.bankPage);paint();}});
  }
  async function open(){if(!active()||opened)return;opened=true;const button=box.querySelector('[data-bank-open]'),target=box.querySelector('[data-bank-library]');button.disabled=true;target.textContent='Loading your exercise library…';
   try{
    if(state.preview){paint();button.hidden=true;return;}
    if(library.owner!==key)library={owner:key,rows:null,at:0,request:null};const entry=library;
    if(!entry.rows||Date.now()-entry.at>300000){if(!entry.request)entry.request=query('Exercise library',db.from('exercise_bank').select('*').order('name').limit(1000)).then(rows=>{if(owner()===key){entry.rows=rows;entry.at=Date.now();}return rows;}).finally(()=>{entry.request=null;});await entry.request;}
    if(!active())return;state.data.exerciseBank=entry.rows||[];button.hidden=true;paint();
   }catch{if(active()){opened=false;button.disabled=false;target.textContent='The exercise library could not load. Open it again to retry.';}}
  }
  box.querySelector('[data-bank-open]').onclick=open;const fold=box.closest('details');if(fold)fold.addEventListener('toggle',()=>{if(fold.open)open();});return result;
 };
})();
