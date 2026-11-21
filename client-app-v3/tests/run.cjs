const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');let failed=0;
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:10000});if(result.status!==0){failed++;console.error(file,result.stderr||result.error);}}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const match of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"\s]*)?"/g)){if(!fs.existsSync(path.join(root,match[1]))){failed++;console.error('Missing entry-page asset:',match[1]);}}
const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.cjs')&&f!=='run.cjs').sort();
for(const file of files){const result=spawnSync(process.execPath,[path.join(__dirname,file)],{encoding:'utf8',timeout:25000});if(result.status!==0){failed++;console.error('FAIL',file,result.stdout,result.stderr,result.error||'');}else console.log('PASS',file);}
console.log(`${files.length} regression scripts; ${failed} failures.`);process.exitCode=failed?1:0;
