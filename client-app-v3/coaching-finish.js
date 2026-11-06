/* Connection state is informational. It never claims a save or queues client data. */
(function(){
 'use strict';
 function refresh(){
  const existing=document.getElementById('coachingConnectionStatus');
  if(state.preview||!state.user?.id||!['coach','client'].includes(state.role)||navigator.onLine!==false){existing?.remove();return;}
  const client=document.getElementById('clientApp'),coach=document.getElementById('coachApp');
  const host=client&&!client.classList.contains('hidden')?document.getElementById('clientMain'):coach&&!coach.classList.contains('hidden')?document.getElementById('coachMain'):null;
  if(!host){existing?.remove();return;}
  const box=existing||document.createElement('div');box.id='coachingConnectionStatus';box.className='coaching-connection-status';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  if(!existing)box.innerHTML='<div><strong>You’re offline</strong>Keep your entries on this screen and retry saving when you reconnect.</div>';
  if(box.parentElement!==host||host.firstElementChild!==box)host.prepend(box);
 }
 for(const name of ['renderClient','renderCoach']){const before=window[name];if(typeof before!=='function')continue;window[name]=function(...args){const result=before.apply(this,args);Promise.resolve(result).then(refresh).catch(()=>{});return result;};}
 window.addEventListener('online',refresh);window.addEventListener('offline',refresh);document.addEventListener('DOMContentLoaded',refresh);
 window.CoachingFinish={refresh};
})();
