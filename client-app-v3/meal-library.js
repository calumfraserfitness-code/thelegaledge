/* Paginated coach library. Personal plans and completion logs stay separate. */
(function () {
  'use strict';
  const PAGE = 24;
  let filters = { search: '', type: '', tag: '' }, page = 0;
  const original = coachNutrition;
  coachNutrition = function () {
    original();
    if (state.role !== 'coach' || !state.selectedNutritionPlanId) return;
    document.querySelector('#assignMealBank')?.remove();
    const actions = document.querySelector('.meal-build-actions');
    if (!actions) return;
    const host = document.createElement('details');
    host.className = 'meal-library';
    host.innerHTML = `<summary class="meal-library-toggle">Browse recipes & add meals</summary><header><div><p class="eyebrow">RECIPE LIBRARY</p><h3>Find the next meal</h3><p class="muted">Weighed portions and clear preparation. Choose meals for this client’s selected day.</p></div></header><form class="meal-library-search"><label>Search meals<input name="search" maxlength="100" placeholder="Chicken, quinoa, blueberries…" value="${esc(filters.search)}"></label><label>Meal type<select name="type"><option value="">All meals</option><option value="Breakfast">Breakfast</option><option value="Main meal">Main meals</option></select></label><label>Preference<select name="tag"><option value="">All preferences</option><option value="high-protein">25g+ protein</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="batch-friendly">Batch cooking</option></select></label><button class="btn primary small">Search library</button></form><p class="muted">New combinations use USDA SR Legacy 2018 estimates. Check product labels for allergens; portions and targets remain editable.</p><div class="meal-library-status" role="status"></div><div class="meal-library-results"></div><nav class="meal-library-paging" aria-label="Meal library pages"></nav><div class="meal-library-detail"></div>`;
    actions.after(host);
    const form = host.querySelector('form');
    form.elements.type.value = filters.type; form.elements.tag.value = filters.tag;
    form.onsubmit = e => { e.preventDefault(); const fd = new FormData(form); filters = { search: String(fd.get('search')).trim(), type: String(fd.get('type')), tag: String(fd.get('tag')) }; page = 0; search(host); };
    host.ontoggle = () => { if (host.open && !host.dataset.loaded) { host.dataset.loaded = 'true'; search(host); } };
  };
  function active(host, client, plan) { return host.isConnected && state.role === 'coach' && state.client?.id === client && state.selectedNutritionPlanId === plan; }
  async function search(host) {
    const client = state.client?.id, plan = state.selectedNutritionPlanId, request = Symbol();
    host.request = request;
    const status = host.querySelector('.meal-library-status'); status.textContent = 'Finding meals…';
    const results = host.querySelector('.meal-library-results'), paging = host.querySelector('.meal-library-paging');
    results.innerHTML = ''; paging.innerHTML = ''; host.querySelector('.meal-library-detail').innerHTML = '';
    try {
      let rows, count;
      if (state.preview) {
        const all = (window.mealLibraryPreview || []).filter(m => (!filters.search || m.name.toLowerCase().includes(filters.search.toLowerCase())) && (!filters.type || m.meal_type === filters.type) && (!filters.tag || m.tags?.includes(filters.tag)));
        count = all.length; rows = all.slice(page * PAGE, (page + 1) * PAGE);
      } else {
        let q = db.from('meal_bank').select('id,name,meal_type,calories,protein_g,carbs_g,fat_g,tags,source_system', { count: 'exact' }).order('name').order('id');
        if (filters.search) q = q.ilike('name', '%' + filters.search.replace(/[\\%_]/g, '\\$&') + '%');
        if (filters.type) q = q.eq('meal_type', filters.type);
        if (filters.tag) q = q.contains('tags', [filters.tag]);
        const response = await q.range(page * PAGE, (page + 1) * PAGE - 1);
        if (response.error) throw response.error;
        rows = response.data || []; count = response.count || 0;
      }
      if (!active(host, client, plan) || host.request !== request) return;
      status.textContent = count ? `${count.toLocaleString()} meals · showing ${page * PAGE + 1}–${page * PAGE + rows.length}${state.preview ? ' · sample preview' : ''}` : 'No matching meals. Try a different search.';
      results.innerHTML = rows.map(m => `<article class="meal-library-card"><span class="eyebrow">${esc(m.meal_type || 'Meal')}</span><h4>${esc(m.name)}</h4><p>${Math.round(Number(m.calories)||0)} kcal · ${Number(m.protein_g)||0}g protein</p><p class="muted">${Number(m.carbs_g)||0}g carbs · ${Number(m.fat_g)||0}g fat</p><button class="btn ghost small" data-recipe="${esc(m.id)}">View ingredients & choose</button></article>`).join('');
      results.querySelectorAll('[data-recipe]').forEach(b => b.onclick = () => detail(host, b.dataset.recipe, client, plan));
      paging.innerHTML = `<button class="btn ghost small" data-page="-1" ${page === 0 ? 'disabled' : ''}>Previous</button><span>Page ${page + 1} of ${Math.max(1, Math.ceil(count / PAGE))}</span><button class="btn ghost small" data-page="1" ${(page + 1) * PAGE >= count ? 'disabled' : ''}>Next</button>`;
      paging.querySelectorAll('button').forEach(b => b.onclick = () => { page += Number(b.dataset.page); search(host); });
    } catch (error) { if (active(host, client, plan) && host.request === request) { status.textContent = 'Could not load meals. Submit search to retry.'; toast(error.message || 'Meal library unavailable', 'error'); } }
  }
  async function detail(host, id, client, plan) {
    const panel = host.querySelector('.meal-library-detail'), token = Symbol(); panel.request = token; panel.textContent = 'Loading ingredients…';
    try {
      let meal;
      if (state.preview) meal = window.mealLibraryPreview.find(m => m.id === id);
      else { const r = await db.from('meal_bank').select('*').eq('id', id).single(); if (r.error) throw r.error; meal = r.data; }
      if (!active(host, client, plan) || panel.request !== token) return;
      const totals = {};
      const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
      const nutrientKeys = ['fibre_g','sodium_mg','calcium_mg','iron_mg','magnesium_mg','potassium_mg','vitamin_a_ug','vitamin_c_mg','vitamin_d_ug'];
      nutrientKeys.forEach(key => { if (ingredients.length && ingredients.every(i => Number.isFinite(i.nutrients?.[key]))) totals[key] = ingredients.reduce((n, i) => n + i.nutrients[key], 0); });
      const labels = {fibre_g:'Fibre',sodium_mg:'Sodium',calcium_mg:'Calcium',iron_mg:'Iron',magnesium_mg:'Magnesium',potassium_mg:'Potassium',vitamin_a_ug:'Vitamin A',vitamin_c_mg:'Vitamin C',vitamin_d_ug:'Vitamin D'};
      panel.innerHTML = `<h4>${esc(meal.name)}</h4><p>${Math.round(meal.calories)} kcal · ${meal.protein_g}g protein · ${meal.carbs_g}g carbs · ${meal.fat_g}g fat</p><ul>${ingredients.map(i => `<li><strong>${esc(i.name || i.food || 'Ingredient')}</strong> — ${esc(i.quantity ?? 'Amount not supplied')} ${esc(i.unit || '')}<small>${esc(i.description || '')}</small></li>`).join('')}</ul>${Object.keys(totals).length ? `<details><summary>Estimated fibre, minerals & vitamins</summary><p>${Object.entries(totals).map(([k,v]) => `${labels[k]}: ${v.toFixed(1)} ${k.endsWith('_ug') ? 'µg' : k.endsWith('_mg') ? 'mg' : 'g'}`).join(' · ')}</p><p class="muted">Only nutrients available for every ingredient are listed. Missing values are not zero.</p></details>` : ''}<p class="muted">${esc(meal.preparation || '')}</p><p class="meal-library-instructions">${esc(meal.cooking_instructions || 'Preparation not supplied; review before assigning.')}</p><form><input type="hidden" name="meal_id" value="${esc(meal.id)}"><button class="btn primary">Add to ${esc(state.data.nutritionPlans.find(p => p.id === plan)?.name || 'selected day')}</button><button type="button" class="btn ghost" data-close>Close recipe</button></form>`;
      panel.querySelector('[data-close]').onclick = () => { panel.innerHTML = ''; };
      panel.querySelector('form').onsubmit = e => {
        if (!active(host, client, plan)) { e.preventDefault(); return; }
        state.data.mealBank = [meal];
        assignMealFromBank(e, state.data.nutritionPlans.find(p => p.id === plan));
      };
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch(error) { if(active(host, client, plan) && panel.request === token) panel.textContent = 'Could not load this recipe. Try opening it again.'; }
  }
})();
