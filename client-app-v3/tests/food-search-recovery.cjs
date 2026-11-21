const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const dom=new JSDOM('<div id="clientWorkspaceBody"></div><input id="coachDailyDate" value="2026-10-16">',{url:'https://example.invalid',runScripts:'outside-only'}),w=dom.window;
let rejectRead=false,rejectSave=false,resolveSearch,writes=0;
const context={owner:'a',date:'2026-10-16'};
Object.assign(w,{$:s=>w.document.querySelector(s),esc:s=>String(s??''),state:{preview:false,role:'client',user:{id:'u'},client:{id:'a'}},coachNutrition:()=>{},renderCoach:()=>{},toast:()=>{},localCoachingDate:()=>context.date});
w.DailyNutrition=require('../daily-nutrition-model.js');w.DailyNutritionAccess={context:()=>context};
w.db={from(){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>{if(rejectRead)throw Error('offline');return{data:{notes:'Saved restriction'}};},upsert:async()=>{writes++;if(rejectSave)throw Error('offline');return{};}};return q;},functions:{invoke:()=>new Promise(r=>resolveSearch=r)}};
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../food-anywhere.js'),'utf8'),dom.getInternalVMContext());
(async()=>{
 rejectRead=true;w.FoodAnywhere.open();await tick();let form=w.document.querySelector('#faPreferences');assert(form.querySelector('button').disabled);assert(w.document.querySelector('#faPreferenceStatus').textContent.includes('could not load'));await form.onsubmit({preventDefault(){}});assert.equal(writes,0,'do not overwrite preferences after a failed read');
 rejectRead=false;w.FoodAnywhere.open();await tick();form=w.document.querySelector('#faPreferences');assert.equal(form.elements.notes.value,'Saved restriction');rejectSave=true;await form.onsubmit({preventDefault(){}});assert(w.document.querySelector('#faPreferenceStatus').textContent.includes('Try again'));assert(!form.querySelector('button').disabled);rejectSave=false;await form.onsubmit({preventDefault(){}});assert(w.document.querySelector('#faPreferenceStatus').textContent.includes('saved'));
 w.FoodAnywhere.close();w.state.role='coach';w.FoodAnywhere.open();const search=w.document.querySelector('#faForm');search.elements.query.value='food';const pending=search.onsubmit({preventDefault(){},target:search});w.document.querySelector('#coachDailyDate').value='2026-10-17';resolveSearch({data:{foods:[{name:'Obsolete food'}]}});await pending;assert(w.document.querySelector('#faResults').textContent.includes('date changed'));assert(!w.document.querySelector('[data-fa-log]'));w.FoodAnywhere.close();dom.window.close();
 const {foodAnswers}=await import('../../supabase/functions/food-anywhere/context.mjs');
 assert.deepEqual(foodAnswers({responses:{sections:{nutrition:{food_restrictions:'No pork',foods_to_avoid:'Mushrooms',current_weight:90,email:'private'},lifestyle:{medical:'private'}}}}),{food_restrictions:'No pork',foods_to_avoid:'Mushrooms'});
 assert.equal(foodAnswers({responses:{text:'TRAINING\n\nEXPERIENCE\nAdvanced\nNUTRITION\n\nALLERGIES AND FOODS TO AVOID\nNo shellfish\nLIFESTYLE\n\nPRIVATE\nNot food'}})['ALLERGIES AND FOODS TO AVOID'],'No shellfish');
 console.log('PASS: preference load/save failures and retry, no blind overwrite, selected-date stale response rejection, food-only onboarding context.');
})().catch(e=>{console.error(e);process.exit(1);});
