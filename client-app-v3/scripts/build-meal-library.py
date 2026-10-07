"""Generate 2,680 distinct, weighed meal combinations from the committed USDA reference.
No client records or personal targets are changed. Run from any working directory.
"""
import json,hashlib,pathlib,itertools
ROOT=pathlib.Path(__file__).resolve().parents[1]
REF=json.loads((ROOT/'data/usda-ingredient-reference.json').read_text())
FOODS={f['fdc_id']:f for f in REF['foods']}
P=[('Chicken breast',171077,180,'Cook chicken to 74°C / 165°F.','meat'),('Lean turkey mince',172850,180,'Cook turkey to 74°C / 165°F.','meat'),('Lean beef mince',174030,180,'Cook mince to 71°C / 160°F.','meat'),('Salmon',175167,160,'Cook fish to 63°C / 145°F.','fish'),('Cod',171955,180,'Cook fish to 63°C / 145°F.','fish'),('Shrimp',175179,180,'Cook shrimp until flesh is opaque and pearly.','shellfish'),('Firm tofu',172475,200,'Drain tofu, pat dry, cube and cook until hot.','soy'),('Cooked lentils',172421,240,'Use already cooked lentils; drain and heat thoroughly.','plant'),('Cooked kidney beans',173740,240,'Use already cooked kidney beans; drain and heat thoroughly.','plant'),('Cooked chickpeas',173757,240,'Use already cooked chickpeas; drain and heat thoroughly.','plant')]
S=[('White rice',168877,70,'dry'),('Brown rice',169703,70,'dry'),('Quinoa',168874,70,'dry'),('Pasta',169736,75,'dry'),('Couscous',169699,70,'dry'),('Potatoes',170026,250,'raw'),('Sweet potato',168482,250,'raw'),('Bulgur',170688,70,'dry')]
V=[('Broccoli',170379),('Carrots',170393),('Green beans',169961),('Cauliflower',169986),('Courgette / zucchini',169291),('Red pepper',170108),('Spinach',168462),('White mushrooms',169251)]
F=[('Lemon & pepper',[(167747,20,'Lemon juice','raw'),(170931,.5,'Black pepper','dry')]),('Tomato & oregano',[(169074,80,'No-added-salt tomato sauce','as sold'),(171328,1,'Oregano','dry')]),('Paprika & garlic',[(171329,2,'Paprika','dry'),(169230,3,'Garlic','raw')]),('Ginger & cumin',[(169231,3,'Ginger','raw'),(170923,1,'Cumin','dry')])]
def item(i,g,name,basis):
 f=FOODS[i];return {'name':name,'quantity':g,'unit':'g','description':f'Weigh {basis}; edible portion, one serving.','weight_basis':basis,'fdc_id':i,'nutrition_source':REF['dataset'],'source_description':f['description'],'nutrients':{n:round(v*g/100,4) for n,v in f['per_100g'].items()}}
def recipe(name,kind,items,instructions,tags):
 common=set.intersection(*(set(i['nutrients']) for i in items));totals={n:round(sum(i['nutrients'][n] for i in items),1) for n in common}
 assert 150<totals['calories']<1500
 if totals['protein_g']>=25:tags+=['high-protein']
 key=hashlib.sha256(json.dumps([(i['fdc_id'],i['quantity']) for i in items]).encode()).hexdigest()
 return {'name':name,'meal_type':kind,**{n:totals[n] for n in ['calories','protein_g','carbs_g','fat_g']},'ingredients':items,'preparation':'One serving. Weigh the listed raw, dry or cooked amounts BEFORE following the cooking instructions. USDA SR Legacy 2018 estimates; brands and cooking losses vary. Check packaging for allergens and substitutions.','cooking_instructions':instructions,'tags':tags+['usda-estimate','one-serving'],'swaps':[],'source_system':'usda-meal-combinations-v1','source_hash':'usda-combination-v1:'+key}
rows=[]
for p,s,v,f in itertools.product(P,S,V,F):
 pn,pi,pg,step,pt=p;sn,si,sg,sb=s;vn,vi=v;fn,season=f
 ingredients=[item(pi,pg,pn,'cooked' if pt=='plant' else 'raw'),item(si,sg,sn,sb),item(vi,180,vn,'raw'),item(171413,8,'Olive oil','as sold')]+[item(i,g,n,b) for i,g,n,b in season]
 tags=['main-meal','batch-friendly'];tags+=['vegan','vegetarian'] if pt in ['plant','soy'] else []
 if sn in ['Pasta','Couscous','Bulgur']:tags+=['contains-wheat']
 if pt in ['fish','shellfish','soy']:tags+=['contains-'+pt]
 starch='Dice the potatoes and roast until tender, usually 25–35 minutes.' if sb=='raw' else 'Cook the dry grain or pasta in water following the packet; do not re-weigh it cooked.'
 steps=f'1. {starch}\n2. Cut the vegetables; use the measured oil to roast or sauté them until tender. Spinach only needs brief wilting.\n3. {step} Cook raw meat or fish separately from ready-to-eat foods.\n4. Add the measured seasonings near the end; warm tomato sauce if used. Serve all components as one portion. Refrigerate leftovers within 2 hours.'
 rows.append(recipe(f'{pn} · {sn} · {vn} · {fn}','Main meal',ingredients,steps,tags))
B=[('Greek yogurt',170894,200,'milk'),('Cottage cheese',172182,200,'milk'),('Skim milk porridge',169868,250,'milk'),('Soy milk porridge',175215,250,'soy')]
FR=[('Banana',173944),('Blueberries',171711),('Strawberries',167762),('Raspberries',167755),('Apple',171688),('Orange',169097)]
T=[('Walnuts',170187),('Pistachios',170184),('Chia seeds',170554),('Almonds',170567),('Sunflower seeds',170562)]
for b,f,t in itertools.product(B,FR,T):
 bn,bi,bg,allergen=b;fn,fi=f;tn,ti=t
 ing=[item(bi,bg,'Unsweetened soy milk' if bi==175215 else 'Skim milk' if bi==169868 else bn,'as sold'),item(169705,40,'Oats','dry'),item(fi,80,fn,'raw'),item(ti,10,tn,'as sold')]
 tags=['breakfast','contains-'+allergen,'contains-oats'];tags+=['contains-tree-nuts'] if ti in [170187,170184,170567] else []
 tags+=['vegan','vegetarian'] if allergen=='soy' else ['vegetarian']
 steps='1. Weigh the fruit after peeling where needed; wash and chop it.\n'
 steps+=('2. Simmer the measured oats with the measured milk, stirring until cooked; add water if needed.\n' if 'porridge' in bn else '2. Mix the measured oats into the yogurt or cottage cheese. Cover and refrigerate to soften, or serve immediately.\n')
 steps+='3. Add the measured fruit and topping. This is one portion; keep milk products chilled.'
 rows.append(recipe(f'{bn} · oats · {fn} · {tn}','Breakfast',ing,steps,tags))
assert len(rows)==2680 and len({r['source_hash'] for r in rows})==2680
for r in rows:
 for n in ['calories','protein_g','carbs_g','fat_g']:assert abs(r[n]-sum(i['nutrients'][n] for i in r['ingredients']))<.051
out=pathlib.Path(__import__('sys').argv[1]) if len(__import__('sys').argv)>1 else ROOT/'data/generated-meals.json'
out.write_text(json.dumps(rows,separators=(',',':')))
print(json.dumps({'recipes':len(rows),'main_meals':2560,'breakfasts':120,'min_kcal':min(x['calories'] for x in rows),'max_kcal':max(x['calories'] for x in rows),'output':str(out)}))
