const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function nutritionSections(record){
 const r=record?.responses||{};if(r.sections)return r.sections;if(!r.text)return r;
 const sections={},labels=['TRAINING','NUTRITION','LIFESTYLE'];let group,key;
 for(const raw of r.text.slice(r.text.indexOf('TRAINING\n\n')).split('\n')){const line=raw.trim();if(!line)continue;if(labels.includes(line)){group=line.toLowerCase();sections[group]={};key=null;continue;}if(!group)continue;if(/^[A-Z][A-Z0-9 /()–&?-]+$/.test(line)){key=line;sections[group][key]='';}else if(key)sections[group][key]+=(sections[group][key]?' ':'')+line;}
 return Object.keys(sections).length?sections:r;
}
export function generationTargets(raw){
 const calories=num(raw?.calories),protein_g=num(raw?.protein_g);
 if(!(calories>0&&calories<=10000&&protein_g>0&&protein_g<=600))throw Error('Set the coach calorie and protein targets before generating meals.');
 const targets={calories,protein_g};for(const k of ['carbs_g','fat_g']){const v=num(raw?.[k]);if(v!==null&&v<0)throw Error('Targets cannot be negative.');targets[k]=v;}
 return targets;
}
const str={type:'string'},number={type:'number'},obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const ingredient=obj({name:str,quantity:number,unit:str});
const meal=obj({name:str,meal_type:{type:'string',enum:['Breakfast','Lunch','Dinner','Snack']},calories:number,protein_g:number,carbs_g:number,fat_g:number,ingredients:{type:'array',minItems:1,maxItems:12,items:ingredient},cooking_instructions:str,swaps:{type:'array',maxItems:3,items:str}});
export const mealDraftSchema=obj({review_notes:{type:'array',maxItems:8,items:str},days:{type:'array',minItems:1,maxItems:1,items:obj({name:str,day_type:{type:'string',enum:['Training Day']},days_per_week:{type:'integer',enum:[7]},calories:number,protein_g:number,carbs_g:number,fat_g:number,coach_notes:str,meals:{type:'array',minItems:1,maxItems:8,items:meal}})}});
export function validateGeneratedDraft(output,targets){
 if(!output||!Array.isArray(output.days)||output.days.length!==1)throw Error('AI did not return one complete everyday menu. Try again.');
 const day=output.days[0];if(day.day_type!=='Training Day'||day.days_per_week!==7||!Array.isArray(day.meals)||day.meals.length<1||day.meals.length>8)throw Error('The generated menu is incomplete. Try again.');
 const keys=['calories','protein_g','carbs_g','fat_g'],totals=Object.fromEntries(keys.map(k=>[k,0]));
 for(const meal of day.meals){if(!String(meal.name||'').trim()||!String(meal.cooking_instructions||'').trim()||!Array.isArray(meal.ingredients)||!meal.ingredients.length)throw Error('A recipe is missing ingredients or cooking steps. Try again.');
  for(const i of meal.ingredients)if(!String(i.name||'').trim()||!(num(i.quantity)>0)||!String(i.unit||'').trim())throw Error('Ingredient quantities are incomplete. Try again.');
  for(const k of keys){const n=num(meal[k]);if(n===null||n<0)throw Error('A recipe has invalid nutrition estimates. Try again.');meal[k]=Math.round(n*10)/10;totals[k]+=meal[k];}
  const energy=meal.protein_g*4+meal.carbs_g*4+meal.fat_g*9;if(Math.abs(energy-meal.calories)>Math.max(100,meal.calories*.15))throw Error('Recipe calories and macros do not reconcile. Try again.');
 }
 if(Math.abs(totals.calories-targets.calories)>Math.max(100,targets.calories*.1)||Math.abs(totals.protein_g-targets.protein_g)>Math.max(10,targets.protein_g*.1))throw Error('The menu does not fit the coach calorie/protein targets closely enough. Try again.');
 for(const k of ['carbs_g','fat_g'])if(targets[k]!==null&&Math.abs(totals[k]-targets[k])>10)throw Error('The menu does not fit the coach macro targets. Try again.');
 for(const k of keys)day[k]=targets[k]??Math.round(totals[k]*10)/10;
 day.coach_notes='AI draft — ingredient nutrition and portions are estimates. Reviewed by the coach before use. '+String(day.coach_notes||'').slice(0,1500);
 return {payload:{days:output.days},review_notes:(output.review_notes||[]).map(String).slice(0,8)};
}
