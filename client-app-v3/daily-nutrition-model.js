/* Pure daily-food model. Unknown nutritional values remain unknown. */
(function(root){
 'use strict';
 const fields=['calories','protein_g','carbs_g','fat_g'];
 function number(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;}
 function category(meal,index=0){
  const type=String(meal.meal_type||meal.timing||'');
  if(/breakfast|meal\s*1/i.test(type))return 'Breakfast';
  if(/lunch|meal\s*2/i.test(type))return 'Lunch';
  if(/dinner|supper|meal\s*3/i.test(type))return 'Dinner';
  if(/snack|meal\s*[4-9]/i.test(type))return 'Snacks';
  return ['Breakfast','Lunch','Dinner','Snacks'][Math.min(index,3)];
 }
 function snapshot(meal){return {name:String(meal.name||'Meal').slice(0,200),meal_type:meal.meal_type||meal.timing||'Meal',...Object.fromEntries(fields.map(k=>[k,number(meal[k])])),ingredients:meal.ingredients||(meal.items||[]),cooking_instructions:meal.cooking_instructions||null,preparation:meal.preparation||null,swaps:meal.swaps||[],source_system:meal.source_system||null,source_url:meal.source_url||null,quality:meal.quality||null,portion:meal.portion||null,retrieved_at:meal.retrieved_at||null,allergen_note:meal.allergen_note||null};}
 function slots(meals,entries=[]){
  const counts={};const rows=meals.map((meal,i)=>{let group=category(meal,i);if(/main meal/i.test(meal.meal_type||''))group=!counts.Lunch?'Lunch':!counts.Dinner?'Dinner':'Snacks';counts[group]=(counts[group]||0)+1;const key=group.toLowerCase()+'-'+counts[group];return {key,group,meal,entry:entries.find(e=>e.slot_key===key)};});
  entries.filter(e=>!rows.some(r=>r.key===e.slot_key)).forEach(entry=>rows.push({key:entry.slot_key,group:category(entry.meal_snapshot,3),meal:entry.meal_snapshot,entry}));
  return rows.map(row=>({...row,meal:row.entry?.meal_snapshot||row.meal,servings:number(row.entry?.servings)??1,eaten:row.entry?.eaten===true}));
 }
 function totals(rows,eatenOnly=false){
  const selected=rows.filter(r=>!eatenOnly||r.eaten);
  return Object.fromEntries(fields.map(k=>{const values=selected.map(r=>number(r.meal[k]));return [k,values.some(v=>v===null)?null:values.reduce((n,v,i)=>n+v*selected[i].servings,0)];}));
 }
 function targetRange(client,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;
  const weekday=new Date(date+'T12:00:00Z').getUTCDay();
  return (client?.nutrition_target_ranges||[]).find(r=>r.start_date<=date&&r.end_date>=date&&Array.isArray(r.weekdays)&&r.weekdays.includes(weekday)&&number(r.calorie_min)>0&&number(r.calorie_max)>=number(r.calorie_min))||null;
 }
 function targets(client,plan,day,date=day?.nutrition_date){
  const keys=['calorie_target','protein_target_g','carbs_target_g','fat_target_g'],clientKeys=['calorie_goal','protein_goal_g','carbs_goal_g','fat_goal_g'];
  const result=Object.fromEntries(fields.map((k,i)=>[k,number(day?.[keys[i]])??number(plan?.[k])??number(client?.[clientKeys[i]])]));
  const range=targetRange(client,date);if(range){result.calories=Number(range.calorie_max);if(range.macro_review_required){result.carbs_g=null;result.fat_g=null;}}
  return result;
 }
 function comparable(original,candidate){
  const a=number(original?.calories),b=number(candidate?.calories),p=number(original?.protein_g),q=number(candidate?.protein_g);
  return a!==null&&a>0&&b!==null&&p!==null&&q!==null&&Math.abs(a-b)<=Math.max(50,a*.2)&&Math.abs(p-q)<=Math.max(5,p*.25);
 }
 function mealIdeas(recipes,rows,goals,group='All'){
  const eaten=totals(rows,true),remaining=Object.fromEntries(fields.map(k=>[k,number(goals[k])===null||eaten[k]===null?null:goals[k]-eaten[k]]));
  const portions=Math.max(1,rows.filter(r=>!r.eaten).length),families=new Map();
  for(const recipe of recipes){
   if(group!=='All'&&recipe.group!==group)continue;
   const meal=recipe.meal,cal=number(meal.calories),protein=number(meal.protein_g);
   const known=fields.filter(k=>remaining[k]!==null&&number(meal[k])!==null);
   const score=known.length?known.reduce((n,k)=>{const available=Math.max(0,remaining[k]),amount=number(meal[k]),scale=Math.max(k==='calories'?100:10,available);return n+Math.abs(amount-available/portions)/scale+(amount>available?(amount-available)/scale*3:0);},0)/known.length:Infinity;
   const fits=remaining.calories!==null&&cal!==null&&cal<=Math.max(0,remaining.calories);
   const after=Object.fromEntries(fields.map(k=>[k,remaining[k]===null||number(meal[k])===null?null:remaining[k]-number(meal[k])]));
   const item={...recipe,score,fits,after,remaining,comparable:remaining.calories!==null&&cal!==null&&remaining.protein_g!==null&&protein!==null};
   const key=recipe.group+':'+String(meal.name).trim().toLowerCase(),old=families.get(key);
   if(!old||score<old.score)families.set(key,item);
  }
  return [...families.values()].sort((a,b)=>a.score-b.score||String(a.meal.name).localeCompare(String(b.meal.name)));
 }
 const model={fields,number,category,snapshot,slots,totals,targets,targetRange,comparable,mealIdeas};
 root.DailyNutrition=model;if(typeof module!=='undefined')module.exports=model;
})(typeof window==='undefined'?globalThis:window);
