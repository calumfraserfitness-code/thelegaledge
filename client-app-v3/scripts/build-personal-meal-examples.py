"""Build varied one-serving examples from a supplied daily target, never client identity.
Usage: python scripts/build-personal-meal-examples.py targets.json output.json
Targets: {calories, protein_g, carbs_g, fat_g, kosher: bool}.
Output is optional recipe data, not a replacement programme. No database writes.
"""
import json, pathlib, sys, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
FOODS={f['fdc_id']:f for f in json.loads((ROOT/'data/usda-ingredient-reference.json').read_text())['foods']}
KEYS=['calories','protein_g','carbs_g','fat_g']
# (FDC ID, display name, weighing basis, starting grams, minimum, maximum).
def food(i,n,b,g,lo,hi):return (i,n,b,g,lo,hi)
Y=lambda g=250:food(170894,'0% Greek yogurt','as sold',g,150,400)
O=lambda g=45:food(169705,'Oats','dry',g,25,100)
M=lambda g=150:food(169868,'Skim milk','as sold',g,100,250)
B=lambda g=80:food(172688,'Wholegrain bread','as sold, before toasting',g,50,150)
E=lambda g=50:food(171287,'Whole egg (without shell; 50g is about 1 large egg)','raw',g,g,g)
W=lambda g=150:food(172183,'Egg whites','raw',g,75,250)
V=lambda:food(170457,'Tomato','raw',100,100,100)
A=lambda g=35:food(171705,'Avocado flesh','raw, skin and stone removed',g,20,80)
I=lambda g=8:food(171413,'Olive oil','as sold',g,0,20)
BAN=lambda g=100:food(173944,'Banana','raw, peeled',g,60,150)
PB=lambda g=15:food(172470,'Smooth peanut butter','as sold',g,5,25)
AL=lambda g=15:food(170567,'Almonds','as sold',g,5,25)
C=lambda g=180:food(171477,'Plain chicken breast','cooked, skin removed',g,100,260)
T=lambda g=200:food(172850,'Lean turkey mince','raw',g,120,300)
R=lambda g=75:food(168877,'White rice','dry',g,40,130)
P=lambda g=250:food(170026,'Potato','raw',g,150,400)
recipes=[
 ('Greek Yogurt Bowl','Breakfast',[Y(),O(),food(171711,'Blueberries','raw',100,100,100),AL()], 'Mix the yogurt and oats. Add the washed berries and measured almonds. Serve chilled.','dairy'),
 ('Warm Protein Oats','Breakfast',[O(),M(),Y(200),BAN(),PB()], 'Cook the oats with the measured milk and a little water until soft. Take off the heat, then stir in the yogurt. Top with banana and peanut butter.','dairy'),
 ('Scrambled Eggs on Toast','Breakfast',[E(100),W(),B(),V(),I(5)], 'Toast the bread without extra butter. Heat the measured oil in a nonstick pan and scramble the egg and whites until set. Serve with the tomato.','pareve'),
 ('Egg & Avocado Breakfast Sandwich','Breakfast',[E(),W(),B(),A(),V()], 'Cook the egg and whites in a nonstick pan until set, adding a splash of water if needed. Fill the bread with egg, avocado and tomato. No butter or cheese is included.','pareve'),
 ('Wholegrain Cereal & Protein Shake','Breakfast',[food(173910,'Plain shredded wheat cereal','dry',50,30,100),M(),Y(),BAN(),AL(10)], 'Pour half the measured milk over the cereal. Blend the remaining milk, yogurt and banana into a protein-rich shake; add water if needed. Eat the measured almonds alongside. No protein powder is needed.','dairy'),
 ('Banana & Peanut Butter Protein Smoothie','Breakfast',[Y(),M(),O(30),BAN(),PB()], 'Blend all measured ingredients with water or ice until smooth. Drink the whole batch as one serving. No extra protein powder is included.','dairy'),
 ('Cottage Cheese Toast & Apple','Breakfast',[food(172182,'Low-fat cottage cheese','as sold',220,150,350),B(),food(171688,'Apple','raw, edible portion',120,120,120),AL(10)], 'Toast the bread without extra butter. Spoon on the cottage cheese. Serve with the sliced apple and measured almonds.','dairy'),
 ('Banana Oat Pancakes','Breakfast',[E(),W(100),O(),Y(150),BAN(80),I(3)], 'Blend the oats, egg, whites and banana. Brush a nonstick pan with the measured oil and cook small pancakes on both sides until set throughout. Serve with the measured yogurt.','dairy'),
 ('Chicken & Avocado Sandwich','Lunch',[C(),B(110),A(50),V(),I(5)], 'Use plain cooked chicken, with no butter or dairy sauce. Fill the bread with chicken, avocado and tomato; use the measured olive oil as dressing.','meat'),
 ('Turkey Tomato Pasta','Lunch',[T(),food(169736,'Pasta','dry',75,40,130),food(169074,'No-added-salt tomato sauce','as sold',150,150,150),I()], 'Cook the dry pasta according to the packet. Brown the turkey in the measured oil until cooked through (74°C / 165°F). Stir in the tomato sauce and pasta. No cheese is included.','meat'),
 ('Tofu & Rice Bowl','Lunch',[food(172475,'Firm tofu','drained, before cooking',300,200,400),R(),food(170379,'Broccoli','raw',150,150,150),I(3)], 'Cook the weighed dry rice in water. Cube the drained tofu and cook in the measured oil until hot. Steam the broccoli and serve together. No extra sauce is included.','pareve'),
 ('Chicken & Potato Tray Bake','Dinner',[food(171077,'Chicken breast','raw',230,150,350),P(),food(170393,'Carrot','raw',150,150,150),I(15)], 'Dice the potato and carrot small. Toss with the measured oil and roast at 200°C / 390°F until tender. Cook the chicken alongside until its centre reaches 74°C / 165°F. Serve the whole measured portion.','meat'),
 ('Turkey Burger & Potato Wedges','Dinner',[T(),B(),P(200),V()], 'Shape the turkey into a patty. Bake on a nonstick tray with the potato wedges, using no extra oil. Cook the turkey to 74°C / 165°F and potatoes until tender. Serve in the bread with tomato; no cheese or creamy sauce is included.','meat'),
 ('Chicken & Rice Stir-fry','Dinner',[food(171077,'Chicken breast','raw',230,150,350),R(),food(170108,'Red pepper','raw',180,180,180),I(15)], 'Cook the weighed dry rice in water. Slice the chicken and pepper. Stir-fry in the measured oil until chicken reaches 74°C / 165°F; add a little water if needed. Fold in the rice. No extra sauce is included.','meat')
]
def build(target):
 out=[]
 for name,kind,parts,steps,status in recipes:
  fraction=.25 if kind=='Breakfast' else .375
  goal=[target[k]*fraction for k in KEYS]
  grams=[p[3] for p in parts]
  def totals(gs):return [sum(FOODS[p[0]]['per_100g'][k]*g/100 for p,g in zip(parts,gs)) for k in KEYS]
  def loss(gs):return sum(((v-t)/max(t,5))**2 for v,t in zip(totals(gs),goal))
  for step in [20,10,5]:
   for _ in range(500):
    current=loss(grams);best=None
    for j,p in enumerate(parts):
     for delta in [-step,step]:
      trial=grams.copy();trial[j]=max(p[4],min(p[5],trial[j]+delta));score=loss(trial)
      if score<current-1e-9:current=score;best=trial
    if best is None:break
    grams=best
  items=[]
  for p,g in zip(parts,grams):
   if not g:continue
   f=FOODS[p[0]]
   items.append({'name':p[1], 'quantity':g,'unit':'g','weight_basis':p[2],'description':'Weigh '+p[2]+'.','fdc_id':p[0],'nutrition_source':'USDA SR Legacy 2018','source_description':f['description'],'nutrients':{k:round(f['per_100g'][k]*g/100,4) for k in KEYS}})
  macro={k:round(v,1) for k,v in zip(KEYS,totals(grams))}
  assert abs(macro['calories']-goal[0])<=goal[0]*.13,(name,macro,goal)
  assert abs(macro['protein_g']-goal[1])<=max(10,goal[1]*.16),(name,macro,goal)
  note='One serving. Amounts are for this recipe only; compare chosen daily totals with your daily targets. USDA estimates; product labels vary.'
  kosher=target.get('kosher',False)
  if kosher:
   note+=' Kosher ingredient rules: no pork, shellfish or meat/dairy combinations. Use kosher-certified packaged products and kosher meat; follow your usual separate preparation and waiting practices.'
   steps='Use kosher-certified ingredients and appropriate separate utensils. '+steps
  tags=['personal-meal-example','one-serving','recipe-family:'+name.lower(),('contains-milk' if status=='dairy' else 'meat-meal' if status=='meat' else 'no-meat-or-dairy-ingredients')]
  if kosher:tags+=['kosher-ingredients-required']
  digest=hashlib.sha256(json.dumps([name,items,kosher],sort_keys=True).encode()).hexdigest()
  out.append({'name':name,'meal_type':kind,**macro,'ingredients':items,'preparation':note,'cooking_instructions':steps+'\n\n'+note,'swaps':[],'tags':tags,'source_system':'usda-personal-meal-examples-v1','source_hash':'personal-examples-v1:'+digest})
 return out
if __name__=='__main__':
 rows=build(json.loads(pathlib.Path(sys.argv[1]).read_text()));pathlib.Path(sys.argv[2]).write_text(json.dumps(rows))
 print(json.dumps([{'name':r['name'],**{k:r[k] for k in KEYS}} for r in rows],indent=2))
