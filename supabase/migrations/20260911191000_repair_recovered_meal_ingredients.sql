update public.meal_bank set ingredients='[{"name":"low-fat Greek yogurt","quantity":10,"unit":"oz"},{"name":"raisin bran","quantity":0.8,"unit":"oz"},{"name":"berries","quantity":3,"unit":"oz"},{"name":"wholegrain toast","quantity":1,"unit":"slice"}]'::jsonb,
  cooking_instructions='Add the raisin bran and berries to the Greek yogurt. Serve with the wholegrain toast.'
where id in ('915d3c22-d4e5-411b-82d3-604c8fb8e646','98a962ed-6f21-45a8-8d8c-57cd5a0f329e');

update public.meal_bank set ingredients='[{"name":"chicken or turkey","quantity":5,"unit":"oz"},{"name":"wholegrain wrap","quantity":1,"unit":"wrap"},{"name":"light cheese","quantity":1,"unit":"oz"},{"name":"salad mix","quantity":1,"unit":"serving"},{"name":"low-calorie dressing","quantity":1,"unit":"oz"},{"name":"apple, orange or banana","quantity":1,"unit":"medium"}]'::jsonb,
  cooking_instructions='Fill the wholegrain wrap with the cooked chicken or turkey, light cheese, salad mix and dressing. Serve with one medium piece of fruit.'
where id='8563f3eb-8e9c-4a15-813f-f55f2b2e9549';

update public.meal_bank set ingredients='[{"name":"lean chicken, turkey, lean beef or fish","quantity":5,"unit":"oz"},{"name":"potatoes or rice","quantity":5,"unit":"oz"},{"name":"vegetables","quantity":4,"unit":"oz"},{"name":"light sauce","quantity":1,"unit":"serving"},{"name":"olive oil","quantity":1,"unit":"tbsp"}]'::jsonb,
  cooking_instructions='Cook the selected lean protein with the olive oil. Serve with potatoes or rice, vegetables and a light sauce.'
where id='d924bdb1-a468-4960-8953-01f6deb8972f';
