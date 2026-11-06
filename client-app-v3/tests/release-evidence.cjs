const assert=require('assert'),{manifest,verify,digest}=require('../scripts/release-evidence.cjs');
(async()=>{
 const sha='a'.repeat(40),m=manifest(sha);assert.equal(Object.keys(m.assets).length,4);assert(!JSON.stringify(m).includes('api_key'));assert.throws(()=>manifest('unknown'));
 const bytes={'index.html':Buffer.from('<script src="./vendor/supabase-2.107.0.js"></script>'),'vendor/supabase-2.107.0.js':Buffer.from('sdk'),'app-runtime.js':Buffer.from('runtime'),'app-runtime.css':Buffer.from('css')};m.assets=Object.fromEntries(Object.entries(bytes).map(([f,b])=>[f,digest(b)]));
 const fetcher=async(url,options)=>{assert.equal(options.redirect,'error');const file=url.pathname.slice(1);return {ok:true,arrayBuffer:async()=>file==='release-evidence.json'?Buffer.from(JSON.stringify(m)):bytes[file]};};
 assert.equal((await verify('https://example.invalid/',sha,fetcher)).assets_verified,4);await assert.rejects(verify('https://example.invalid/','b'.repeat(40),fetcher),/identity/);bytes['app-runtime.js']=Buffer.from('stale');await assert.rejects(verify('https://example.invalid/',sha,fetcher),/mismatch/);await assert.rejects(verify('http://example.invalid/',sha,fetcher),/HTTPS/);await assert.rejects(verify('https://example.invalid/path',sha,fetcher),/origin/);
 console.log('PASS exact-source release metadata and asset integrity with stale release/asset rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
