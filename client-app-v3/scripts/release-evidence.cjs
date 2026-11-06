/* Generated public build metadata contains only source identity and public asset hashes. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function manifest(sha){
 if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('A full source commit SHA is required.');
 const files=['index.html','vendor/supabase-2.107.0.js','app-runtime.js','app-runtime.css'];
 return {format:'legal-edge-release-evidence',source_branch:'release/daily-nutrition-20261009',commit_sha:sha,assets:Object.fromEntries(files.map(file=>[file,digest(fs.readFileSync(path.join(root,file)))]))};
}
async function verify(url,expected,fetcher=fetch){
 if(!/^[a-f0-9]{40}$/.test(expected||''))throw Error('Specify the exact expected source commit.');
 const base=new URL(url);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('Use the HTTPS app origin only.');
 const read=async(file)=>{const response=await fetcher(new URL(file,base),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(file+' returned HTTP '+response.status);return Buffer.from(await response.arrayBuffer());};
 const evidence=JSON.parse((await read('release-evidence.json')).toString('utf8'));
 if(evidence.format!=='legal-edge-release-evidence'||evidence.commit_sha!==expected||evidence.source_branch!=='release/daily-nutrition-20261009')throw Error('Live source identity does not match the expected release.');
 for(const file of ['index.html','vendor/supabase-2.107.0.js','app-runtime.js','app-runtime.css']){
  const bytes=await read(file);if(digest(bytes)!==evidence.assets?.[file])throw Error('Live asset mismatch: '+file);
  if(file==='index.html'&&(!bytes.toString().includes('vendor/supabase-2.107.0.js')||/cdn\.jsdelivr\.net.*supabase|unpkg\.com.*supabase/.test(bytes.toString())))throw Error('Pinned local authentication SDK is not selected.');
 }
 return {commit_sha:expected,assets_verified:4};
}
module.exports={manifest,verify,digest};
if(require.main===module){
 if(process.argv[2]==='--verify')verify(process.argv[3],process.argv[4]).then(result=>console.log('Verified live release:',JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
 else {const sha=process.env.VERCEL_GIT_COMMIT_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();fs.writeFileSync(path.join(root,'release-evidence.json'),JSON.stringify(manifest(sha),null,2)+'\n');console.log('Built exact-source release evidence.');}
}
