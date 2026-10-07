# Measured recipe combinations

2,680 unique single-serving combinations were inserted into the production meal bank on 7 October 2026, without modifying existing meals, assigned client plans or completion history.

- 2,560 main meals: 10 protein components × 8 starches × 8 vegetables × 4 seasoning combinations.
- 120 breakfasts: 4 bases × 6 fruits × 5 toppings.
- USDA SR Legacy 2018 ingredient records; original download: https://fdc.nal.usda.gov/download-datasets/ . USDA food data is public domain.
- Every ingredient specifies grams and raw, dry, cooked or as-sold weight basis. Macros are sums of the food values per 100g multiplied by the ingredient grams. Cooking losses and brand differences are not modelled. These are recipe estimates, not laboratory measurements.
- Ingredient JSON retains FDC IDs, source descriptions and per-portion nutrient estimates. Fibre/micronutrients display only when all ingredients contain the relevant value; missing is never interpreted as zero.
- Preference tags describe the ingredients. Always check packaging for allergens and certification. These recipes do not imply kosher certification or allergy-safe manufacture.
- Cooking temperature references: https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures . Use a food thermometer for meat and fish.

Run `python scripts/build-meal-library.py /tmp/generated-meals.json` to reproduce from the committed minimal ingredient reference. Source hashes are stable for each ingredient-ID/quantity combination. Insert with `ON CONFLICT (source_hash) DO NOTHING`; do not replace personal meal records.

The coach library searches the database with exact counts, filters and 24-row ranges. It retrieves full ingredients only after a recipe is selected. Existing assigned meals still load per client under RLS. Fictional preview uses a small sample; it never accesses production records.

Verified: all 2,680 distinct source hashes; no missing required macro values; calorie range 312.3–838.2 kcal; all ingredient sums match recipe macros to rounding tolerance; coach can retrieve pages after offset 2,400; an unrelated client cannot retrieve unassigned recipes. RLS test rolls back.
