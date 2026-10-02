const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const ctx=vm.createContext({esc:v=>String(v??'').replaceAll('<','&lt;'),exerciseCard:()=>'<article><span class="pill">NO VIDEO</span><div class="prescription-grid">sets</div><form>logging</form></article>',fullCoachingSample:()=>({exercises:[{name:'Dumbbell shoulder press'}]})});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../exercise-demos.js'),'utf8'),ctx);
const card=vm.runInContext("exerciseCard({name:'Seated Cable Row'},true)",ctx);
assert.match(card,/UCXxvVItLoM\?start=0&end=45/);assert.match(card,/youtube-nocookie/);assert.match(card,/<form>logging/);assert.doesNotMatch(card,/NO VIDEO/);
for(const name of ['Chest-Supported T-Bar Row','Standing Dumbbell Shoulder Press','Neutral-Grip Lat Pulldown','Cable Row'])assert.equal(vm.runInContext(`rpDemoForExercise({name:${JSON.stringify(name)}})`,ctx),null);
assert.match(vm.runInContext("exerciseCard({name:'Unknown movement'})",ctx),/Demo not yet added/);
assert.equal(vm.runInContext('fullCoachingSample().exercises[0].name',ctx),'Seated dumbbell shoulder press');
console.log('PASS: exact equipment/variant matching, bounded 45-second embed request and preserved workout logging.');
