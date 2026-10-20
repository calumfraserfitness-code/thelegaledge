/* Authenticated, fixed-origin proxy for official US menu data. No client records. */
let cached=null,pending=null;
const items=[['200463','big-mac'],['200466','quarter-pounder-with-cheese'],['200476','double-quarter-pounder-with-cheese'],['200491','mcdouble']];
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 const authorization=req.headers.authorization;if(!authorization?.startsWith('Bearer '))return res.status(401).json({error:'Sign in required'});
 try{
  const user=await fetch('https://baxvhilvrhshlfizakak.supabase.co/auth/v1/user',{headers:{Authorization:authorization,apikey:'sb_publishable_DRoPSo_3TPlU8mMeLQNruw_82hanHNi'},signal:AbortSignal.timeout(10000)});
  if(!user.ok)return res.status(401).json({error:'Sign in required'});
  if(cached&&cached.until>Date.now())return res.json(cached.data);
  if(!pending)pending=Promise.all(items.map(async([id,slug])=>{const r=await fetch(`https://www.mcdonalds.com/dnaapp/itemDetails?country=US&language=en&showLiveData=true&item=${id}`,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Official feed unavailable');const {item}=await r.json(),n=item?.nutrient_facts?.nutrient||[];if(!item?.item_name)throw Error('No menu item');const nutrient=id=>{const v=n.find(x=>Number(x.id)===id)?.value;return v!==undefined&&Number.isFinite(Number(v))?Number(v):null;};return{name:item.item_name,calories:nutrient(2),protein_g:nutrient(11),carbs_g:nutrient(22),fat_g:nutrient(21),portion:'1 standard menu item',source_system:'mcdonalds_us_official',source_url:`https://www.mcdonalds.com/us/en-us/product/${slug}.html`,quality:'Official US menu values; preparation varies',allergen_note:'Check the current official ingredient and allergen list before ordering.'};})).then(foods=>{cached={until:Date.now()+3600000,data:{foods,retrieved_at:new Date().toISOString()}};return cached.data;}).finally(()=>pending=null);
  return res.json(await pending);
 }catch(_){return res.status(503).json({error:'Official menu source unavailable'});}
};
