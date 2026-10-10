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
 function snapshot(meal){return {name:String(meal.name||'Meal').slice(0,200),meal_type:meal.meal_type||meal.timing||'Meal',...Object.fromEntries(fields.map(k=>[k,number(meal[k])])),ingredients:meal.ingredients||(meal.items||[]),cooking_instructions:meal.cooking_instructions||null,preparation:meal.preparation||null,swaps:meal.swaps||[],source_system:meal.source_system||null};}
 function slots(meals,entries=[]){
  const counts={};const rows=meals.map((meal,i)=>{let group=category(meal,i);if(/main meal/i.test(meal.meal_type||''))group=!counts.Lunch?'Lunch':!counts.Dinner?'Dinner':'Snacks';counts[group]=(counts[group]||0)+1;const key=group.toLowerCase()+'-'+counts[group];return {key,group,meal,entry:entries.find(e=>e.slot_key===key)};});
  entries.filter(e=>!rows.some(r=>r.key===e.slot_key)).forEach(entry=>rows.push({key:entry.slot_key,group:category(entry.meal_snapshot,3),meal:entry.meal_snapshot,entry}));
  return rows.map(row=>({...row,meal:row.entry?.meal_snapshot||row.meal,servings:number(row.entry?.servings)??1,eaten:row.entry?.eaten===true}));
 }
 function totals(rows,eatenOnly=false){
  const selected=rows.filter(r=>!eatenOnly||r.eaten);
  return Object.fromEntries(fields.map(k=>{const values=selected.map(r=>number(r.meal[k]));return [k,values.some(v=>v===null)?null:values.reduce((n,v,i)=>n+v*selected[i].servings,0)];}));
 }
 function targets(client,plan,day){
  const keys=['calorie_target','protein_target_g','carbs_target_g','fat_target_g'],clientKeys=['calorie_goal','protein_goal_g','carbs_goal_g','fat_goal_g'];
  return Object.fromEntries(fields.map((k,i)=>[k,number(day?.[keys[i]])??number(plan?.[k])??number(client?.[clientKeys[i]])]));
 }
 function comparable(original,candidate){
  const a=number(original?.calories),b=number(candidate?.calories),p=number(original?.protein_g),q=number(candidate?.protein_g);
  return a!==null&&a>0&&b!==null&&p!==null&&q!==null&&Math.abs(a-b)<=Math.max(50,a*.2)&&Math.abs(p-q)<=Math.max(5,p*.25);
 }
 const model={fields,number,category,snapshot,slots,totals,targets,comparable};
 root.DailyNutrition=model;if(typeof module!=='undefined')module.exports=model;
})(typeof window==='undefined'?globalThis:window);
