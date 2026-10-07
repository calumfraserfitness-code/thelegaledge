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

assert.ok(vm.runInContext('rpTechniqueDemos.every(d=>d.sourceUrl&&d.seconds===undefined||!d.sourceUrl&&d.seconds===undefined&&/^[A-Za-z0-9_-]{11}$/.test(d.id)||Number.isFinite(d.seconds)&&d.seconds>0&&d.seconds<=45)',ctx));
assert.equal(vm.runInContext('new Set(rpTechniqueDemos.map(d=>d.id)).size===rpTechniqueDemos.length',ctx),true);


assert.doesNotMatch(vm.runInContext("rpDemoMarkup(rpDemoForExercise({name:'Bird dog'}))",ctx),/undefined-second|45-second/);
const situp=vm.runInContext("rpDemoMarkup(rpDemoForExercise({name:'Sit-ups'}))",ctx);assert.match(situp,/2o9zkR0hMB8\?start=0&end=45/);assert.match(situp,/Catalyst Athletics/);assert.doesNotMatch(situp,/Renaissance Periodization/);
assert.equal(vm.runInContext("rpDemoForExercise({name:'Kneeling Push Ups'}).id",ctx),'physitrack-kneeling-push-up');
assert.equal(vm.runInContext("rpDemoForExercise({name:'Wall Sit'}).id",ctx),'physitrack-wall-sit');
assert.equal(vm.runInContext("rpDemoForExercise({name:'Seated upper-back rotation'}).id",ctx),'physitrack-seated-thoracic');
assert.equal(vm.runInContext("rpDemoForExercise({name:'Front Plank'}).id",ctx),'physitrack-front-plank');
assert.equal(vm.runInContext("rpDemoForExercise({name:'Side Plank'})",ctx),null);
assert.equal(vm.runInContext("rpTechniqueDemos.flatMap(d=>d.aliases).length===new Set(rpTechniqueDemos.flatMap(d=>d.aliases)).size",ctx),true);
console.log('PASS additional home/mobility movements, exact aliases and no ambiguous side-plank substitution.');
