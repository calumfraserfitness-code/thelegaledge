export async function verifyStripeSignature(body,header,secret,now=Math.floor(Date.now()/1000)){
 const parts=String(header||'').split(',');const times=parts.filter(p=>p.startsWith('t='));
 if(times.length!==1||!/^t=\d+$/.test(times[0])||!secret)return false;
 const timestamp=Number(times[0].slice(2));if(Math.abs(now-timestamp)>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+body)));
 return parts.filter(p=>/^v1=[a-f0-9]{64}$/.test(p)).some(p=>{const bytes=p.slice(3).match(/../g).map(x=>parseInt(x,16));let diff=0;for(let i=0;i<32;i++)diff|=bytes[i]^mac[i];return diff===0;});
}
