// Send food-specific answers only, never the whole onboarding record or identity.
export function foodAnswers(record){
 const r=record?.responses||{};let sections=r.sections||r;
 if(r.text&&!r.sections){
  sections={};let group,key;
  for(const raw of String(r.text).split('\n')){const line=raw.trim();if(!line)continue;if(['TRAINING','NUTRITION','LIFESTYLE'].includes(line)){group=line.toLowerCase();sections[group]={};key=null;continue;}if(group!=='nutrition')continue;if(/^[A-Z][A-Z0-9 /()–&?-]+$/.test(line)){key=line;sections[group][key]='';}else if(key)sections[group][key]+=(sections[group][key]?' ':'')+line;}
 }
 const nutrition=sections.nutrition||sections.Nutrition||{};
 return Object.fromEntries(Object.entries(nutrition).filter(([key])=>/allerg|restrict|avoid|dislike|include|food|meal|kosher|vegetar|vegan|gluten|dairy|shellfish|pork|diet/i.test(key)).map(([key,value])=>[key.slice(0,120),String(value??'').slice(0,1500)]));
}
