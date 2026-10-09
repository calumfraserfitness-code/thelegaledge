export const normalizedName=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function matchClient(meeting,clients){
 const invitees=Array.isArray(meeting.calendar_invitees)?meeting.calendar_invitees:[];
 const speakers=Array.isArray(meeting.transcript)?meeting.transcript:[];
 const matches=clients.filter(c=>c.profile_id&&invitees.some(i=>{
  const email=String(i.email||'').trim().toLowerCase(),expected=String(c.email||'').trim().toLowerCase(),name=normalizedName(c.display_name);
  return email&&email===expected&&name.split(' ').length>=2&&(
   normalizedName(i.name)===name||normalizedName(i.matched_speaker_display_name)===name||speakers.some(s=>String(s.speaker?.matched_calendar_invitee_email||'').toLowerCase()===email&&normalizedName(s.speaker?.display_name)===name));
 }));
 return {client:matches.length===1?matches[0]:null,status:matches.length===1?'matched':matches.length>1?'ambiguous':'unmatched'};
}
export async function verifySignature(headers,raw,secret,now=Date.now()){
 try{
  const id=headers.get('webhook-id'),stamp=headers.get('webhook-timestamp'),signature=headers.get('webhook-signature');
  if(!id||id.length>256||!stamp||!/^\d{1,12}$/.test(stamp)||!signature||!secret?.startsWith('whsec_'))return false;
  const seconds=Number(stamp);if(!Number.isSafeInteger(seconds)||Math.abs(now/1000-seconds)>300)return false;
  const bytes=Uint8Array.from(atob(secret.slice(6)),x=>x.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const part of signature.split(/\s+/)){
   const [version,value]=part.split(',');if(version!=='v1'||!value)continue;
   try{if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(value),x=>x.charCodeAt(0)),new TextEncoder().encode(`${id}.${stamp}.${raw}`)))return true;}catch{}
  }
 }catch{}
 return false;
}
