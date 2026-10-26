/* Temporary launch navigation: keep stored Playbook content and workout choices intact. */
(function(){
 'use strict';
 const retired=new Set(['playbook','learning','resources','playbook-manager']);
 function tidy(){
  if(typeof document==='undefined'||!document)return;
  document.querySelectorAll('#clientNav [data-client-view="playbook"],#clientNav [data-client-view="learning"],#coachNav [data-coach-view="resources"],#coachNav [data-coach-view="playbook-manager"],[data-clean-setting="playbook-manager"],[data-clear-setting="resources"],[data-clear-setting="learning"],#pbPlanReady,#pbCoachTools,#pbEmployerReport').forEach(el=>el.remove());
  document.querySelector('#psLearnLink')?.closest('section')?.remove();
 }
 const nav=updateClientNav;
 updateClientNav=function(){const result=nav();tidy();return result;};
 const client=renderClient;
 renderClient=function(){if(retired.has(state.clientView))state.clientView='today';const result=client();tidy();if(result?.then)return Promise.resolve(result).then(value=>{tidy();return value;});Promise.resolve().then(tidy);return result;};
 const coach=renderCoach;
 renderCoach=function(){if(!state.client&&retired.has(state.coachView))state.coachView='settings';const result=coach();tidy();if(result?.then)return Promise.resolve(result).then(value=>{tidy();return value;});Promise.resolve().then(tidy);return result;};
 const settings=coachingSettings;
 coachingSettings=function(){const result=settings();tidy();return result;};
 const employer=renderEmployerPortal;
 renderEmployerPortal=async function(){const result=await employer();tidy();return result;};
 window.LegalEdgePlaybook={open:()=>{state.clientView='today';return renderClient();}};
 document.addEventListener('DOMContentLoaded',tidy);
})();
