export function signedCopyText(b) {
 if(!b?.contract_body||!b?.privacy_body||!b?.signature_name||!b?.signed_at)throw Error('Incomplete signed copy');
 return `${b.contract_title}\nVersion ${b.contract_version}\n\n${b.contract_body}\n\nELECTRONIC ACCEPTANCE\nName: ${b.signature_name}\nAddress: ${b.address}\nSigned: ${b.signed_at}\nClient record: ${b.client_id}\n\nPRIVACY AND HEALTH CONSENT\nVersion ${b.privacy_version}\nAccepted: ${b.privacy_accepted_at}\n\n${b.privacy_body}\n\nRecord fingerprint (SHA-256): ${b.record_hash}\n\nYour saved copy is also available in your Legal Edge account.`;
}
export async function sendSignedCopy(job,fetcher=fetch) {
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+job.api_key,'Content-Type':'application/json','Idempotency-Key':'legal-edge-signed-copy/'+job.id},body:JSON.stringify({from:'Legal Edge Coaching <'+job.sender+'>',to:[job.recipient],subject:'Your Legal Edge coaching agreement and privacy consent',text:signedCopyText(job.bundle)}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Email provider returned '+response.status);
 const data=await response.json();if(!data.id)throw Error('Email provider did not return a receipt');return data.id;
}
export async function verifiedSender(key,sender,fetcher=fetch){
 if(!/^re_[A-Za-z0-9_-]{10,}$/.test(key||'')||! /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(sender||''))throw Error('Enter a valid Resend API key and sender address.');
 const response=await fetcher('https://api.resend.com/domains',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Unable to verify this key and sending domain. The key needs domain-read access.');
 const domains=await response.json(),host=sender.split('@')[1].toLowerCase();
 if(!domains.data?.some(d=>d.name.toLowerCase()===host&&d.status==='verified'&&d.capabilities?.sending!=='disabled'))throw Error('Verify this sender domain in Resend before connecting.');
}
