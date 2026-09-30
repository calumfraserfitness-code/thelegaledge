const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const ctx=vm.createContext({renderPilotDemo(){},Intl,Number,Math,Date,Set,console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../pilot-showcase.js'),'utf8'),ctx);
const model=vm.runInContext('pilotEconomics({firms:34,seats:10,cohorts:2,price:15000,weeklyMinutes:20,callMinutes:30,adminMinutes:5,onboardingMinutes:90,completionMinutes:30,hourlyCost:45,coachHours:22,workingWeeks:46,fixedCost:100000})',ctx);
assert.equal(model.revenue,1020000);assert.equal(model.participants,680);assert.equal(model.annualHours,5780);assert.equal(model.coaches,6);assert.equal(model.millionFirms,34);assert.equal(model.contribution,659900);
assert.equal(vm.runInContext('pilotPeople.length',ctx),10);
assert.equal(vm.runInContext("pilotPeople.filter(p=>p[2]==='active').length",ctx),8);
assert.equal(vm.runInContext('pilotWeekActions.minimum.length',ctx),7);
assert.throws(()=>vm.runInContext('pilotEconomics({firms:0})',ctx),/positive/);
console.log('PASS: hypothetical revenue, delivery cost, staffing, fictional cohort states and weekly modes.');

ctx.esc=value=>String(value??'').replace(/</g,'&lt;');ctx.title=value=>String(value);ctx.firmResourceIdeas=[];ctx.firmPhases=['baseline','midpoint','endline'];ctx.firmPilotReport=()=>'<section>Aggregate phase averages</section>';
vm.runInContext("pilotDraft.notes[0]='PRIVATE_SAMPLE_FEEDBACK';pilotDraft.reviews.add(0)",ctx);
assert.match(vm.runInContext('pilotDraftParticipant()',ctx),/PRIVATE_SAMPLE_FEEDBACK/);
for(const audience of ['hr','ceo']){vm.runInContext(`pilotDraft.audience='${audience}'`,ctx);const html=vm.runInContext('pilotDraftSponsor()',ctx);assert.doesNotMatch(html,/PRIVATE_SAMPLE_FEEDBACK|Alex Morgan|Jamie Reed/);assert.match(html,/1\/8 sample/);}
assert.match(vm.runInContext('pilotConnectedTraining()',ctx),/3 sets/);
assert.match(vm.runInContext('pilotConnectedMeals()',ctx),/200 g/);
const larger=vm.runInContext('pilotEconomics({firms:10,seats:25,cohorts:2,price:50000,weeklyMinutes:20,callMinutes:30,adminMinutes:5,onboardingMinutes:90,completionMinutes:30,hourlyCost:45,coachHours:22,workingWeeks:46,fixedCost:100000})',ctx);
assert.equal(larger.revenue,1000000);assert.equal(larger.coaches,5);
console.log('PASS: participant sees private sample coach feedback, CEO/HR views exclude it, sample plans and fewer-firm delivery calculations.');
