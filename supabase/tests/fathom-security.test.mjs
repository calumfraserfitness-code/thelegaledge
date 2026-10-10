import test from 'node:test';
import assert from 'node:assert/strict';
import {matchClient,verifySignature} from '../functions/_shared/fathom-security.mjs';
const client={id:'client',profile_id:'profile',display_name:'Garrett Lyons',email:'client@example.invalid'};
test('email alone is insufficient; name and linked active-client candidate required',()=>{
 assert.equal(matchClient({calendar_invitees:[{email:client.email,name:'Other Person'}]},[client]).status,'unmatched');
 const meeting={calendar_invitees:[{email:client.email,name:'GARRETT LYONS'}]};
 assert.equal(matchClient(meeting,[client]).client.id,'client');
 assert.equal(matchClient(meeting,[{...client,profile_id:null}]).status,'unmatched');
 assert.equal(matchClient(meeting,[client,{...client,id:'duplicate'}]).status,'ambiguous');
});
test('signed raw bytes, timestamp freshness and multiple signatures',async()=>{
 const bytes=crypto.getRandomValues(new Uint8Array(32)),secret='whsec_'+Buffer.from(bytes).toString('base64'),raw='{"recording_id":123}',stamp=String(Math.floor(Date.now()/1000));
 const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`delivery.${stamp}.${raw}`))).toString('base64');
 const headers=new Headers({'webhook-id':'delivery','webhook-timestamp':stamp,'webhook-signature':`v1,invalid v1,${sig}`});
 assert.equal(await verifySignature(headers,raw,secret),true);
 assert.equal(await verifySignature(headers,raw+' ',secret),false);
 assert.equal(await verifySignature(headers,raw,secret,Date.now()+360000),false);
 headers.set('webhook-timestamp','NaN');assert.equal(await verifySignature(headers,raw,secret),false);
});
