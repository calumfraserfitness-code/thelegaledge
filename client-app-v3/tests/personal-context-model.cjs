const assert=require('assert'),fs=require('fs'),vm=require('vm');
const M=require('../personal-context-model.js'),now='2026-11-02T13:00:00Z';
const client={id:'own',display_name:'Client Person',email:'client@example.invalid',phone:'+353871234567',goal_summary:'Build strength with Client Person',timezone:'Europe/Dublin'};
const data={onboarding:[
 {client_id:'other',version:999,responses:{sections:{nutrition:{food_restrictions:'PRIVATE PEER RULE'},training:{equipment:'PRIVATE PEER GYM'}}}},
 {client_id:'own',version:1,submitted_at:'2026-10-01',responses:{sections:{nutrition:{food_restrictions:'OLD VERSION RULE'}}}},
 {client_id:'own',version:2,submitted_at:'2026-10-31',responses:{sections:{nutrition:{food_restrictions:'Kosher: no pork, shellfish or meat/dairy combinations',foods_to_include:'Eggs and oats',meal_prep_time:'Up to 30 minutes',current_weight:'180',height:'71',email:'private@example.invalid'},training:{equipment:'Dumbbells and a bench',preferred_training_time:'6am',session_minutes:30,preferred_style:'Strength',gym_name:'DO NOT LEAK NAMED GYM'},lifestyle:{work_hours:'60 hours, busy Thursdays',work_pattern:'Hybrid',support_preferences:'Short video',date_of_birth:'PRIVATE DOB'},goals:{goals:'Client-reported goal'}}}},
 {client_id:'own',version:3,is_draft:true,responses:{sections:{nutrition:{food_restrictions:'UNSUBMITTED DRAFT'}}}}
 ],coachingGuidance:[{client_id:'other',title:'Agreed focus · peer',body:'PRIVATE PEER FOCUS',published:true},{client_id:'own',title:'Previous focus · old',body:'EXPIRED PREVIOUS FOCUS',published:true},{client_id:'own',title:'Agreed focus · private',body:'UNPUBLISHED FOCUS',published:false},{client_id:'own',title:'Agreed focus · current',body:'Record your weights and reps',published:true,created_at:'2026-11-01T12:00:00Z'}]};
const opts={now,foodPreferences:[{client_id:'other',notes:'PRIVATE PEER NOTE'},{client_id:'own',notes:'Avoid very spicy food. Contact client@example.invalid, +353871234567 or https://example.invalid/private',updated_at:'2026-11-01'}],weeklyFocus:[
 {client_id:'other',description:'PRIVATE PEER ACTION',approved_at:'2026-11-01',starts_on:'2026-11-02',expires_on:'2026-11-08'},
 {client_id:'own',description:'Prepare a packed lunch',approved_at:'2026-11-01',starts_on:'2026-11-02',expires_on:'2026-11-08'},
 {client_id:'own',description:'EXPIRED ACTION',approved_at:'2026-10-01',starts_on:'2026-10-01',expires_on:'2026-10-31'},
 {client_id:'own',description:'COMPLETED ACTION',approved_at:'2026-11-01',completed_at:'2026-11-02',starts_on:'2026-11-02',expires_on:'2026-11-08'},
 {client_id:'own',description:'UNAPPROVED ACTION',starts_on:'2026-11-02',expires_on:'2026-11-08'}
 ],busyWeeks:[{client_id:'own',week_start:'2026-10-26',work_hours:99},{client_id:'own',week_start:'2026-11-02',work_hours:45,training_windows:0,travel:false,session_minutes:20,location:'hotel',meal_access:'limited',updated_at:'2026-11-02'}]};
const before=JSON.stringify({client,data,opts}),result=M.build(client,data,opts),text=JSON.stringify(result);
assert.equal(result.as_of,'2026-11-02');assert(result.goal.value.includes('[identity omitted]'));
assert(result.food.requirements.some(r=>r.value.includes('Kosher')));assert(result.food.preferences.some(r=>r.value==='Eggs and oats'));
assert(result.training.equipment.some(r=>r.value==='Dumbbells and a bench'));assert(result.training.availability.some(r=>r.value==='6am'));
assert(result.training.availability.some(r=>r.value==='training windows: 0'),'Zero is a recorded value, not missing');assert(result.training.availability.some(r=>r.value==='travel: false'));
assert(result.work.some(r=>r.value.includes('60 hours')));assert(result.work.some(r=>r.value.includes('45')));assert(!result.work.some(r=>r.value.includes('99')),'Prior week setup is excluded');
assert.deepEqual(result.priorities.map(r=>r.value),['Prepare a packed lunch']);assert.equal(result.priorities[0].expires_on,'2026-11-08');assert.equal(result.published_focus[0].value,'Record your weights and reps');
for(const forbidden of ['PRIVATE PEER','OLD VERSION','UNSUBMITTED','DO NOT LEAK','PRIVATE DOB','UNPUBLISHED','EXPIRED','COMPLETED ACTION','UNAPPROVED','client@example.invalid','+353871234567','https://example.invalid','Client Person'])assert(!text.includes(forbidden),forbidden);
assert(result.food.requirements.every(r=>r.source&&Object.hasOwn(r,'recorded_at')),'Every fact has provenance');assert.equal(JSON.stringify({client,data,opts}),before,'Inputs stay unchanged');
const legacy=M.build({id:'old'}, {onboarding:[{client_id:'old',responses:{text:'Name\nPRIVATE IDENTITY\n\nTRAINING\n\nEQUIPMENT AVAILABLE\nDumbbells\nPREFERRED TRAINING TIME\nMornings\n\nNUTRITION\n\nFOOD ALLERGIES / INTOLERANCES\nNONE\nFOODS TO AVOID\nNO PORK OR SHELLFISH\nMEALS PER DAY\n3\n\nLIFESTYLE\n\nHOURS PER WEEK\n50'}}]}, {now});
assert(legacy.food.requirements.some(r=>r.value==='NONE'));assert(legacy.food.preferences.some(r=>r.value==='NO PORK OR SHELLFISH'));assert(legacy.training.equipment.some(r=>r.value==='Dumbbells'));assert(legacy.work.some(r=>r.value==='50'));assert(!JSON.stringify(legacy).includes('PRIVATE IDENTITY'));
const blank=M.build({id:'a',timezone:'Invalid/Timezone'},{onboarding:[{responses:{sections:{training:{equipment:'UNSCOPED ROW'}}}}]}, {now});assert.equal(blank.as_of,null);assert(blank.gaps.some(s=>s.includes('timezone')));assert(!JSON.stringify(blank).includes('UNSCOPED'));
assert.equal(M.build({},data,opts),null);assert.throws(()=>M.build(client,data,{now:'invalid'}));
// Large free-text cannot turn the context into an unbounded intake dump.
const huge=M.build({id:'a'},{onboarding:[{client_id:'a',responses:{sections:{nutrition:{food_restrictions:'x'.repeat(100000),foods_to_include:'y'.repeat(100000)},training:{equipment:'z'.repeat(100000)}}}}]}, {now});assert(JSON.stringify(huge).length<13000);
// The exact same browser file works without CommonJS or app globals.
const context={Intl,Date};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../personal-context-model.js','utf8'),context);assert.equal(context.PersonalCoachingContext.build(client,data,opts).as_of,'2026-11-02');
console.log('PASS personal context: scoped/latest intake, legacy answers, real zero, current approved actions, provenance, identity redaction and bounded output');
