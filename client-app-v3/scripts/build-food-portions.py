"""Extract audited household references from the official USDA SR Legacy CSV files.
Usage: python scripts/build-food-portions.py /path/to/unzipped/USDA/directory
"""
import csv,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
inputs=pathlib.Path(sys.argv[1])
# Reference portion descriptions must match USDA records; grams below are derived per one listed unit.
choices={
167747:[('cup','cup','')],167755:[('cup','cup','')],167762:[('cup','cup, halves','halved')],168462:[('cup','cup','loosely filled')],168482:[('cup','cup, cubes','cubed')],168874:[('cup','cup','dry')],168877:[('cup','cup','dry')],168878:[('cup','cup','cooked')],169074:[('cup','cup','')],169097:[('medium orange','fruit (2-5/8" dia)','')],169230:[('clove','clove','')],169231:[('teaspoon','tsp','grated')],169251:[('cup','cup, pieces or slices','sliced')],169291:[('cup','cup, chopped','chopped')],169699:[('cup','cup','dry')],169703:[('cup','cup','dry')],169705:[('cup','cup','whole oat groats')],169736:[('cup','cup penne','dry penne')],169868:[('cup','cup','')],169961:[('cup','cup 1/2" pieces','chopped')],169986:[('cup','cup chopped (1/2" pieces)','chopped')],170026:[('cup','cup, diced','diced'),('medium potato','Potato medium (2-1/4" to 3-1/4" dia)','')],170108:[('cup','cup, chopped','chopped')],170184:[('cup','cup','shelled')],170187:[('cup','cup, chopped','chopped')],170379:[('cup','cup chopped','chopped')],170393:[('cup','cup chopped','chopped')],170457:[('cup','cup, chopped or sliced','chopped')],170567:[('cup','cup, whole','whole')],170688:[('cup','cup','dry')],170894:[('pot','container','170g reference pot')],170923:[('teaspoon','tsp, whole','whole')],170931:[('teaspoon','tsp, ground','ground')],171077:[('raw chicken breast','piece','reference size; pieces vary')],171287:[('large egg','large','without shell')],171300:[('cup','cup (8 fl oz)','Greek yogurt density reference')],171328:[('teaspoon','tsp, leaves','dried leaves')],171329:[('teaspoon','tsp','')],171413:[('teaspoon','tsp','')],171477:[('cup','cup, chopped or diced','chopped, cooked')],171650:[('cup','cup (1 NLEA serving)','raisin bran reference')],171688:[('cup','cup, quartered or chopped','chopped'),('medium apple','medium (3" dia)','edible portion')],171705:[('cup','cup, cubes','cubed'),('avocado','avocado, NS as to Florida or California','flesh only')],171711:[('cup','cup','')],171955:[('raw cod fillet','fillet','reference size; fillets vary')],172182:[('cup','cup (not packed)','not packed')],172183:[('cup','cup',''),('large egg white','large','')],172421:[('cup','cup','cooked')],172470:[('tablespoon','tbsp','level')],172475:[('cup','cup','firm tofu'),('block','block','324g reference block')],172688:[('slice','slice','wholegrain bread reference')],173439:[('cup','cup, shredded','shredded')],173740:[('cup','cup','cooked')],173757:[('cup','cup','cooked')],173904:[('cup','cup','dry rolled oats')],173905:[('cup','cup','cooked porridge')],173910:[('biscuit','biscuits (1 NLEA serving)','large shredded-wheat reference biscuit')],173944:[('medium banana','medium (7" to 7-7/8" long)','peeled')],174081:[('wrap','tortilla 1 serving','41g wholewheat reference wrap')],175167:[('raw salmon fillet','fillet','reference size; fillets vary')],175215:[('cup','cup','')]
}
portions={}
for r in csv.DictReader(open(inputs/'food_portion.csv')):
 i=int(r['fdc_id']);amount=float(r['amount'] or 0)
 if i in choices and amount>0:
  for unit,match,form in choices[i]:
   if r['modifier']==match:portions.setdefault(i,[]).append({'unit':unit,'form':form,'grams':round(float(r['gram_weight'])/amount,4),'usda_modifier':r['modifier'],'usda_amount':amount,'usda_gram_weight':float(r['gram_weight'])})
foods={int(r['fdc_id']):r['description'] for r in csv.DictReader(open(inputs/'food.csv'))}
for i in choices:
 if i not in portions: print('MISSING',i,choices[i])
result={'source':'USDA FoodData Central SR Legacy, April 2018','source_url':'https://fdc.nal.usda.gov/download-datasets/','foods':{str(i):{'description':foods[i],'portions':p} for i,p in portions.items()}}
(root/'data/food-portion-reference.json').write_text(json.dumps(result,indent=2)+'\n')
print('foods',len(portions))
