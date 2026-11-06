const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx=vm.createContext({coachNutrition(){},Number,String,Array});vm.runInContext(fs.readFileSync(__dirname+'/../meal-library.js','utf8'),ctx);
let p=ctx.mealLibraryPresentation({name:'Apple',calories:180,protein_g:15,preparation:'Apple 150g Greek Yoghurt 150g'});assert.equal(p.name,'Apple & Greek yogurt');assert.equal(p.ingredients.length,2);
p=ctx.mealLibraryPresentation({name:'Apple',calories:80,protein_g:0,preparation:'Apple 150g'});assert.equal(p.name,'Apple');
p=ctx.mealLibraryPresentation({name:'Ancient Nutrition Protein',calories:330,protein_g:38,preparation:'1 serving protein drink 3 soft boiled eggs'});assert.equal(p.ingredients[1].quantity,3);
const meal=n=>({name:'Beef & Rice',ingredients:[{name:'rice (dry)',quantity:n,unit:'g'}]});assert.notEqual(ctx.mealLibraryPresentation(meal(100)).description,ctx.mealLibraryPresentation(meal(120)).description);
assert.equal(ctx.mealLibraryNumber(null),'—');assert.equal(ctx.mealLibraryNumber(0),'0');
console.log('PASS: source-backed combined meal names, distinct portions and unknown nutrients.');
