-- Normalize only quantities explicitly present in recovered Legal Edge source text.
update public.meal_bank set ingredients = '[{"quantity":200,"unit":"g","name":"cooked chicken breast"},{"quantity":300,"unit":"g","name":"cooked rice"},{"quantity":150,"unit":"g","name":"mixed vegetables"},{"quantity":50,"unit":"g","name":"avocado"}]'::jsonb
where id in ('5d41a712-5b6d-4fdf-90b6-07773cea09db','ea5dfd20-0615-4633-bf60-ac220cdc78ab');

update public.meal_bank set ingredients = '[{"quantity":200,"unit":"g","name":"cooked lean turkey"},{"quantity":200,"unit":"g","name":"cooked quinoa"},{"quantity":150,"unit":"g","name":"mixed vegetables"},{"quantity":50,"unit":"g","name":"avocado"}]'::jsonb
where id = '9db9a6dd-ca98-4162-b032-4437f4fcc5ed';

update public.meal_bank set ingredients = '[{"quantity":5,"unit":"oz","name":"lean chicken, turkey, lean beef or fish"},{"quantity":5,"unit":"oz","name":"potatoes or rice"},{"quantity":4,"unit":"oz","name":"vegetables"},{"quantity":1,"unit":"serving","name":"light sauce"},{"quantity":1,"unit":"tbsp","name":"olive oil"}]'::jsonb,
  cooking_instructions = 'Cook the selected lean protein with the potatoes or rice and vegetables. Use the light sauce to serve and the olive oil for cooking or dressing.'
where id = '0988cffa-534e-46db-852f-56ac1577adac';

update public.meal_bank set ingredients = '[{"quantity":5,"unit":"oz","name":"chicken or turkey"},{"quantity":1,"unit":"whole","name":"wholegrain wrap"},{"quantity":1,"unit":"oz","name":"light cheese"},{"quantity":1,"unit":"serving","name":"salad mix"},{"quantity":1,"unit":"oz","name":"low-calorie dressing"},{"quantity":1,"unit":"medium","name":"apple, orange or banana"}]'::jsonb,
  cooking_instructions = 'Fill the wholegrain wrap with chicken or turkey, light cheese, salad mix and dressing. Serve the fruit alongside.'
where id = '983286c7-4445-4f48-bf9c-393aba624e1d';

update public.meal_bank set ingredients = '[{"quantity":220,"unit":"g","name":"cooked chicken breast"},{"quantity":2,"unit":"large","name":"high-fiber tortillas"},{"quantity":70,"unit":"g","name":"avocado"},{"quantity":40,"unit":"g","name":"reduced-fat shredded cheese"},{"quantity":100,"unit":"g","name":"lettuce, tomato and onion"},{"quantity":80,"unit":"g","name":"salsa"},{"quantity":10,"unit":"g","name":"olive oil"}]'::jsonb
where id in ('724edb7d-0f1a-4d9a-a247-201668cc7d4a','b2b9fafd-0fa6-4cce-bb88-f32562ec0c4f');
