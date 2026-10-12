const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-manifest.json'),'utf8'));
const sources=manifest.scripts.map(file=>({file,code:fs.readFileSync(path.join(root,file),'utf8')}));
// Retain separate global-script semantics: concatenation would hoist later overrides.
const code='(function(){const sources='+JSON.stringify(sources)+';for(const source of sources){const script=document.createElement("script");script.dataset.legalEdgeSource=source.file;script.textContent=source.code+"\\n//# sourceURL="+location.origin+"/"+source.file;document.head.append(script);}})();\n';
fs.writeFileSync(path.join(root,'app-runtime.js'),code);fs.writeFileSync(path.join(root,'app-runtime.css'),manifest.styles.map(file=>'/* '+file+' */\n'+fs.readFileSync(path.join(root,file),'utf8')).join('\n'));
console.log('Built runtime: '+sources.length+' script sources and '+manifest.styles.length+' styles in two requests.');
