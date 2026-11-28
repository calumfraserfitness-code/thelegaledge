/* Token hash stays in the fragment and is removed before exchanging it. */
(async function(){
 'use strict';const status=document.getElementById('recoveryStatus'),form=document.getElementById('passwordSetup'),login=document.getElementById('recoveryLogin');
 const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token_hash');history.replaceState(null,'',location.pathname);
 if(!token||params.get('type')!=='recovery'){status.textContent='This password link is incomplete. Ask Calum for a fresh link.';return;}
 const api=window.supabase.createClient('https://baxvhilvrhshlfizakak.supabase.co','sb_publishable_DRoPSo_3TPlU8mMeLQNruw_82hanHNi',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'legal-edge-password-recovery',lock:async(_name,_wait,fn)=>await fn()}});
 let timeout;const bounded=promise=>Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('The request timed out. Reopen the link to retry.')),15000);})]).finally(()=>clearTimeout(timeout));
 try{const {data,error}=await bounded(api.auth.verifyOtp({token_hash:token,type:'recovery'}));if(error||!data?.user||!data?.session)throw Error('This link has expired or has already been used. Ask Calum for a fresh link.');status.textContent='Choose a new password for '+data.user.email+'.';form.hidden=false;}
 catch(e){status.textContent=e.message;return;}
 let saving=false;form.onsubmit=async e=>{e.preventDefault();if(saving)return;const password=form.elements.password.value;if(password.length<12||password!==form.elements.confirm.value){status.textContent='Use at least 12 characters and make sure both passwords match.';return;}saving=true;const button=form.querySelector('button');button.disabled=true;status.textContent='Saving your new password…';
  try{const {error}=await bounded(api.auth.updateUser({password}));if(error)throw error;form.reset();form.hidden=true;status.textContent='Your password is saved. Open the app and sign in with your email and new password.';login.hidden=false;}
  catch(e){status.textContent='Password save was not confirmed. '+e.message;}finally{saving=false;button.disabled=false;}
 };
})();
