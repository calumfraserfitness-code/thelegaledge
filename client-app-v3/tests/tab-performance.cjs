/* Source layout constraints only; jsdom does not perform physical-device layout. */
const assert=require('assert'),fs=require('fs'),vm=require('vm'),{JSDOM}=require('jsdom');
const css=fs.readFileSync(__dirname+'/../tab-performance.css','utf8'),navSource=fs.readFileSync(__dirname+'/../navigation-clear.js','utf8');
const dom=new JSDOM('<main id="clientMain"></main><nav id="clientNav" class="client-nav"></nav><style>'+css+'</style>',{runScripts:'outside-only'}),w=dom.window;
Object.assign(w,{$:selector=>w.document.querySelector(selector),state:{clientView:'today'}});
vm.runInContext(navSource.slice(navSource.indexOf('function updateClientNav(){'),navSource.indexOf('const clearClientRenderBefore=')),dom.getInternalVMContext());w.updateClientNav();
const count=w.document.querySelectorAll('#clientNav button').length;assert.equal(count,6,'The real client navigation exposes six destinations');
const rules=[...w.document.querySelector('style').sheet.cssRules],phone=rules.find(rule=>rule.conditionText==='(max-width:600px)'),small=rules.find(rule=>rule.conditionText==='(max-width:420px)');assert(phone&&small);
const nav=[...phone.cssRules].find(rule=>rule.selectorText==='#clientNav'),button=[...phone.cssRules].find(rule=>rule.selectorText==='#clientNav button');
assert.equal(nav.style.display,'grid');assert.equal(nav.style.getPropertyValue('grid-template-columns'),'repeat(6,minmax(0,1fr))');assert.equal(button.style.getPropertyValue('min-width'),'0');assert.equal(button.style.getPropertyValue('white-space'),'normal');
const gap=parseFloat(nav.style.gap),padding=parseFloat(nav.style.getPropertyValue('padding-left'))+parseFloat(nav.style.getPropertyValue('padding-right'));
for(const width of [320,360,375,390,414,600]){const track=(width-padding-(count-1)*gap)/count;assert(track>=44,'Each visible destination retains at least a 44px column at '+width+'px');assert(track*count+gap*(count-1)+padding<=width+.001,'Declared grid columns fit '+width+'px');}
assert(css.includes('100dvh'));assert(css.includes('100svh'));assert(!/opacity|visibility\s*:\s*hidden|display\s*:\s*none/.test(css),'Surface CSS must not hide slow-loading content');dom.window.close();console.log('PASS six real client destinations fit declared phone grid constraints; stable viewport surfaces do not mask loading or errors');
