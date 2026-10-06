const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const ctx=vm.createContext({document:{addEventListener(){}},esc:v=>String(v??'').replaceAll('<','&lt;'),exerciseCard:()=>'<article><span class="pill">NO VIDEO</span><div class="prescription-grid">sets</div><form>logging</form></article>',fullCoachingSample:()=>({exercises:[{name:'Dumbbell shoulder press'}]})});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../exercise-demos.js'),'utf8'),ctx);
const card=vm.runInContext("exerciseCard({name:'Seated Cable Row'},true)",ctx);
assert.match(card,/UCXxvVItLoM\?start=0&end=45/);assert.match(card,/youtube-nocookie/);assert.match(card,/<form>logging/);assert.doesNotMatch(card,/NO VIDEO/);
for(const name of ['Unsupported Row Variant','Standing Dumbbell Shoulder Press','Cable Row'])assert.equal(vm.runInContext(`rpDemoForExercise({name:${JSON.stringify(name)}})`,ctx),null);
assert.match(vm.runInContext("exerciseCard({name:'Unknown movement'})",ctx),/Demo not yet added/);
assert.equal(vm.runInContext('fullCoachingSample().exercises[0].name',ctx),'Seated dumbbell shoulder press');
console.log('PASS: exact equipment/variant matching, bounded 45-second embed request and preserved workout logging.');

assert.equal(vm.runInContext("rpDemoForExercise({name:'Neutral-Grip Lat Pulldown'}).id",ctx),'--utaPT7XYQ');
assert.ok(vm.runInContext('rpTechniqueDemos.length',ctx)>=35);

assert.ok(vm.runInContext('rpTechniqueDemos.every(d=>d.sourceUrl&&d.seconds===undefined||Number.isFinite(d.seconds)&&d.seconds>0&&d.seconds<=45)',ctx));
assert.equal(vm.runInContext('new Set(rpTechniqueDemos.map(d=>d.id)).size===rpTechniqueDemos.length',ctx),true);


assert.doesNotMatch(vm.runInContext("rpDemoMarkup(rpDemoForExercise({name:'Bird dog'}))",ctx),/undefined-second|45-second/);
