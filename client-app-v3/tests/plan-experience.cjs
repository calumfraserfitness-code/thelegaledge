const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path');
const app=fs.readFileSync(path.join(__dirname,'../app-v2.js'),'utf8').split('\nbindShell();')[0];
const helpers=fs.readFileSync(path.join(__dirname,'../plan-experience.js'),'utf8');
const ctx=vm.createContext({window:{supabase:null,addEventListener(){}},location:{hash:'',search:''},URLSearchParams,URL,console,Date,Set,Map,setTimeout,clearTimeout});
vm.runInContext(app+'\n'+helpers,ctx);
function check(src){return vm.runInContext(src,ctx)}
check("state.client={weight_unit:'lbs'}");
assert.equal(check("nutritionUnit(100,'g')"),'3.53 oz');
check("state.foodUnits='metric'");assert.equal(check("nutritionUnit(5,'oz')"),'141.75 g');
assert.equal(check("nutritionUnit(1,'slice')"),'1 slice');
assert.equal(check("safeMediaUrl('javascript:alert(1)')"),'');
assert.equal(check("recoveredMealDescription({preparation:'IMPORT WITH AI\\nTraining Day4×/wk'})"),'');
check(`var qaMeal={name:'Meal',calories:500,protein_g:30,carbs_g:50,fat_g:20,ingredients:[{name:'Food',quantity:100,unit:'g'}],cooking_instructions:'1. Prepare.\\n2. Serve.'};var qaDay={name:'Training Day',day_type:'Training Day',days_per_week:7,calories:500,protein_g:30,carbs_g:50,fat_g:20,meals:[qaMeal]};`);
assert.equal(check('validateNutritionImport({days:[qaDay]}).days.length'),1);
check("var seven={days:Array.from({length:7},(_,weekday)=>({...qaDay,name:'Day '+weekday,weekday,days_per_week:1}))}");assert.equal(check('validateNutritionImport(seven).days.length'),7);
assert.throws(()=>check('validateNutritionImport({days:[{...qaDay,calories:null}]})'),/required/);
assert.throws(()=>check('validateNutritionImport({days:seven.days.map(day=>({...day,weekday:0}))})'),/exactly once/);
check("state.data=emptyData();state.data.nutritionPlans=[{id:'training',day_type:'Training Day',is_active:true},{id:'wed',day_type:'Rest Day',source_json:{weekday:2},is_active:true}]");
assert.equal(check("planForDay({dateObject:new Date('2026-09-30T12:00:00'),sessions:[{training_type:'weights'}]}).id"),'wed');
check("state.data.programs=[{days:[{id:'mobility',exercises:[{id:'move',name:'Hip mobility',sets:2,reps:'30 seconds'}]}]}]");
assert.match(check("activityPrescription({id:'session',programme_day_id:'mobility'})"),/Hip mobility/);
check("state.mealBatchPortions=3");assert.equal(check("scaledIngredientAmount({quantity:100,unit:'g'}, {})"),'300 g');
console.log('PASS: seven-day and repeatable imports, missing-target rejection, unique weekdays, regional units, batch scaling, weekday precedence, mobility prescriptions, safe media URLs and source-menu filtering.');

vm.runInContext(fs.readFileSync(path.join(__dirname,'../firm-pilots.js'),'utf8'),ctx);
assert.equal(check("isOptionalProgramDay({}, {coach_notes:'OPTIONAL / BACKUP. Home session'})"),true);
assert.equal(check("isOptionalProgramDay({}, {coach_notes:'NEW DRAFT — proposed Monday'})"),false);
check("firmState.organizations=[{id:'firm',employee_count:20}]");
assert.throws(()=>check("validateFirmPilot({organization_id:'firm',name:'Pilot',capacity:21})"),/employees/);
assert.throws(()=>check("validateFirmPilot({organization_id:'firm',name:'Pilot',capacity:10,start_date:'2026-10-10',end_date:'2026-10-01'})"),/End date/);
assert.throws(()=>check("validateFirmPilot({organization_id:'firm',name:'Pilot',capacity:10,status:'active'})"),/dates/);
console.log('PASS: optional workout scheduling and corporate pilot validation.');


assert.equal(check("firmAssessmentOpens('midpoint',{start_date:'2026-10-05'})"),'2026-11-09');
assert.equal(check("firmAssessmentOpens('endline',{start_date:'2026-10-05',end_date:'2026-12-28'})"),'2026-12-21');
assert.equal(check("firmAssessmentOpens('midpoint',{})"),'');
console.log('PASS: participant assessment opening dates.');
