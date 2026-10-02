// Progressive disclosure preserves the original forms, handlers and saved records.
function foldCoachContent(node,label,container){
 if(!node||node.closest('.le-fold'))return;
 const fold=document.createElement('details');fold.className='le-fold';
 const summary=document.createElement('summary');summary.textContent=label;fold.append(summary);
 node.before(fold);fold.append(node);if(container)container.append(fold);return fold;
}
function simplifyCoachTraining(){
 const body=$('#clientWorkspaceBody');if(!body)return;
 const tools=document.createElement('section');tools.className='le-coach-tools';body.append(tools);
 const setup=body.querySelector('.fast-builder');foldCoachContent(setup,'Manage programme & weekly schedule',tools);
 for(const panel of [...body.querySelectorAll(':scope > .panel')]){
  const heading=panel.querySelector('h2')?.textContent||'';
  if(/technique library|Exercise \/ video bank/.test(heading))foldCoachContent(panel,heading,tools);
 }
 body.querySelectorAll('[data-exercise-editor]').forEach(form=>foldCoachContent(form,'Edit this exercise'));
}
const trainingBeforeClarity=coachTraining;
coachTraining=function(){trainingBeforeClarity();simplifyCoachTraining();};
function simplifyCoachTabs(){
 const tabs=$('#clientTabs');if(!tabs)return;
 const more=document.createElement('details');more.className='le-more-tabs';more.innerHTML='<summary>More</summary><div></div>';
 const advanced=['onboarding','legal','diagnostics','goals','support'];
 for(const button of [...tabs.querySelectorAll('button')])if(advanced.includes(button.dataset.clientTab)){more.lastElementChild.append(button);if(button.classList.contains('active'))more.open=true;}
 if(more.lastElementChild.childElementCount)tabs.append(more);
}
const workspaceBeforeClarity=renderClientWorkspace;
renderClientWorkspace=function(){workspaceBeforeClarity();simplifyCoachTabs();};
const firmsBeforeClarity=paintFirmPilots;
paintFirmPilots=async function(){await firmsBeforeClarity();const main=$('#coachMain');if(state.client||state.coachView!=='firms')return;
 const roster=main.querySelector('#firmPilotEditForm')?.closest('.panel');
 if(roster){const introduction=main.querySelector('.firm-intro');introduction?.after(roster);
  foldCoachContent(roster.querySelector('#firmPilotEditForm'),'Pilot settings');
  foldCoachContent(roster.querySelector('#firmMemberForm'),'Add an existing client');
  roster.querySelectorAll('button[data-firm-client]').forEach(button=>{if(button.textContent!=='Open coaching workspace')button.hidden=true;else button.textContent='Open client';});
  const readiness=[...roster.children].find(n=>n.matches('p.muted'));if(readiness)foldCoachContent(readiness,'Account readiness');
 }
 for(const node of [...main.children]){
  if(node===roster||node.classList.contains('page-head')||node.classList.contains('firm-intro')||node.getAttribute('role')==='status')continue;
  const heading=node.querySelector('h3')?.textContent||'';
  if(node.classList.contains('firm-delivery'))foldCoachContent(node,'Weekly reviews & coaching schedule');
  else if(node.querySelector('#firmProgrammeBriefForm'))foldCoachContent(node,'Company objectives & review brief');
  else if(node.classList.contains('firm-grid'))foldCoachContent(node,'Manage firms & pilots');
  else if(node.matches('.panel'))foldCoachContent(node,heading||'Programme details');
 }
};
function refreshPreviewControl(){
 const banner=$('.cw-demo-banner');if(!banner)return;
 banner.classList.add('le-preview-bar');banner.innerHTML='<span>Sample preview</span><label>Viewing <select aria-label="Preview view"><option value="firms">Coach · Corporate</option><option value="clients">Coach · 1-to-1</option><option value="participant">Client</option><option value="sponsor">CEO / HR</option></select></label><small>Fictional data · resets on reload</small>';
 const select=banner.querySelector('select');select.value=new URLSearchParams(location.search).get('view')==='client'?'participant':state.coachView==='firms'?'firms':'clients';select.onchange=()=>openSampleScene(select.value);
}
document.addEventListener('DOMContentLoaded',refreshPreviewControl);
// Clear client prescriptions: sets, repetitions and rest first. Advanced fields stay coach-side.
const cardBeforeClarity=exerciseCard;
exerciseCard=function(exercise,loggable=false){let html=cardBeforeClarity(exercise,loggable);
 const inClientView=state.role==='client'||Boolean($('#clientApp')&&!$('#clientApp').classList.contains('hidden'));
 if(!inClientView)return html;
 html=html.replace(/<div><span>TEMPO \/ INTENSITY<\/span><strong>[\s\S]*?<\/strong><\/div>/,'');
 html=html.replace(/<label>RIR<input[^>]*><\/label>/g,'');
 html=html.replace(/<h4>How to do it<\/h4><ol>([\s\S]*?)<\/ol>/g,'<details class="le-instructions"><summary>Technique tips</summary><ol>$1</ol></details>');
 return html;
};
const supportBeforeClarity=clientCoachingSupport;
clientCoachingSupport=function(){supportBeforeClarity();const main=$('#clientMain');
 const guidance=[...main.querySelectorAll(':scope > .panel')].find(p=>p.querySelector('.cw-guidance'));if(guidance)foldCoachContent(guidance,'Tips for busy weeks & eating out');
};
const healthBeforeClarity=clientHealth;
clientHealth=function(){healthBeforeClarity();const main=$('#clientMain');
 main.querySelector('.live-health .eyebrow').textContent='ACCOUNT CONNECTION';
 main.querySelector('.live-health .sub').textContent='Connect your Fitbit account to share steps, sleep, heart rate and weight. Requires Fitbit setup and your permission.';
 const oauth=(state.data.healthConnections||[]).find(c=>c.provider==='fitbit'&&c.status==='connected'&&!c.scopes?.includes('file_import'));
 $('#syncFitbit').disabled=!oauth;$('#syncFitbit').textContent='Refresh Fitbit data';
 if(!oauth)$('#fitbitStatus').textContent=state.preview?'Live connections require your signed-in client account. This sample does not connect a device.':'No Fitbit account linked yet.';
 const imports=main.querySelector('.health-import');foldCoachContent(imports,'Import a health export');
 main.querySelectorAll('.connection-list article').forEach(article=>{
  const name=article.querySelector('h3').textContent;
  const provider=name.startsWith('Apple')?'apple_health':name.startsWith('Google')?'health_connect':'fitbit';
  const connection=(state.data.healthConnections||[]).find(c=>c.provider===provider);
  const fileOnly=connection?.scopes?.includes('file_import')||provider!=='fitbit';
  article.querySelector('.pill').textContent=connection?.status==='connected'?(fileOnly?'FILE IMPORTED':'ACCOUNT LINKED'):(provider==='fitbit'?'NOT LINKED':'PHONE SYNC NOT AVAILABLE');
  article.querySelector('p').textContent=provider==='fitbit'?(connection?.status==='connected'?'Latest data: '+fmt(connection.last_synced_at):'Connect your Fitbit account above.'):(connection?.status==='connected'?'Latest file import: '+fmt(connection.last_synced_at):'Automatic sync needs the Legal Edge phone integration. You can import a file for now.');
 });
 const history=[...main.children].find(n=>n.querySelector('h3')?.textContent==='Import history');foldCoachContent(history,'Import history');
};
