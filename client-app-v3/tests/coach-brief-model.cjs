const assert=require('assert'),fs=require('fs'),path=require('path');
(async()=>{
 const {buildContext,validateBrief,briefSchema,localDate}=await import('../../supabase/functions/generate-coach-brief/model.mjs');
 const client={id:'own',coach_id:'coach',display_name:'Client Person',email:'client@example.com',phone:'+353 871234567',goal_summary:'Maintain weight',timezone:'America/New_York',weight_unit:'lbs'};
 const rows={onboarding:[{client_id:'own',version:1,responses:{sections:{nutrition:{foods_to_avoid:'Old answer'}}}},{client_id:'own',version:2,submitted_at:'2026-11-01',responses:{sections:{nutrition:{food_restrictions:'Kosher; no meat and dairy',email:'client@example.com'},training:{equipment:'Dumbbells',work_schedule:'Long office days'},identity:{name:'Client Person',address:'private'}}}},{client_id:'peer',version:9,responses:{sections:{nutrition:{foods_to_avoid:'PRIVATE PEER'}}}}],
 preferences:[{client_id:'own',notes:'No shellfish. Client Person contact client@example.com or +353 871234567'}],
 checkins:[{client_id:'own',submitted_at:'2026-10-30',source_system:'legacy_coach_ui',wins:'Used hotel gym',training_adherence:0},{client_id:'peer',wins:'PRIVATE PEER'}],
 weeks:[{id:'w',client_id:'own'},{id:'p',client_id:'peer'}],sessions:[{week_id:'w',session_date:'2026-11-01',title:'Coach bike',training_type:'cardio',duration_minutes:30,status:'completed',source_metadata:{cardio_log:{activity:'Cycling',duration_minutes:24,distance_km:null,logged_at:'2026-11-01T12:00:00Z'}}},{week_id:'p',session_date:'2026-11-01',title:'PRIVATE PEER'},{week_id:'w',session_date:'2026-01-01',title:'Too old'}],
 sets:[{client_id:'own',performed_at:'2026-11-01T12:00:00Z',exercise_name:'Press',load:20,load_unit:'lbs',reps:8},{client_id:'peer',performed_at:'2026-11-01',exercise_name:'PRIVATE PEER'}],
 calls:[{client_id:'own',coach_id:'coach',matching_status:'matched',occurred_at:'2026-10-31',summary:'Client Person trained. Email client@example.com',analysis:{next_steps:'No new weight-loss goal'}},{client_id:'own',coach_id:'other',matching_status:'matched',summary:'PRIVATE PEER'}],
 guidance:[{client_id:'own',published:false,body:'UNPUBLISHED'},{client_id:'own',published:true,title:'Call recap',body:'Approved plan',created_at:'2026-11-01'}],
 focus:[{client_id:'own',starts_on:'2026-11-01',expires_on:'2026-11-10',description:'Two strength sessions'},{client_id:'own',starts_on:'2026-10-01',expires_on:'2026-10-05',description:'EXPIRED'}]};
 const legacy=buildContext(client,{onboarding:[{client_id:'own',version:3,responses:{text:'TRAINING\nEQUIPMENT\nDUMBBELLS AND BENCH\nNUTRITION\nFOODS TO AVOID\nNO PORK OR SHELLFISH'}}]},new Date('2026-11-02T16:00:00Z'));
 assert(JSON.stringify(legacy).includes('NO PORK OR SHELLFISH'),'All-caps restrictions remain answers');assert(JSON.stringify(legacy).includes('DUMBBELLS AND BENCH'));
 const context=buildContext(client,rows,new Date('2026-11-02T16:00:00Z')),text=JSON.stringify(context);
 assert(!text.includes('PRIVATE PEER'));assert(!text.includes('UNPUBLISHED'));assert(!text.includes('EXPIRED'));assert(!text.includes('Too old'));assert(!text.includes('Old answer'));assert(text.includes('Kosher'));assert(text.includes('Dumbbells'));assert(text.includes('Long office days'));
 assert(!text.includes('Client Person'));assert(!text.includes('client@example.com'));assert(!text.includes('+353 871234567'));
 const cardio=context.sources.find(s=>s.kind==='session').data;assert.equal(cardio.prescribed_duration_minutes,30);assert.equal(cardio.actual_cardio.duration_minutes,24);assert.equal(cardio.actual_cardio.distance_km,null);
 assert.equal(context.sources.find(s=>s.kind==='checkin').data.submission_time_verified,false);
 assert.equal(context.sources.find(s=>s.kind==='set').data.load_unit,'lbs');
 assert.equal(localDate(new Date('2026-11-02T01:00:00Z'),'America/New_York'),'2026-11-01');
 const output={summary:'A bounded review.',wins:[{text:'Recorded cycling',evidence:[context.sources.find(s=>s.kind==='session').id]}],attention:[],questions:['How did that feel?'],suggested_response:'Good to see the recorded session. How did it feel?',gaps:['Confirm next week’s equipment.']};
 const validated=validateBrief(output,context);assert(validated.sources.length);assert(validated.gaps.length>output.gaps.length);assert.deepEqual(validated.sources[0],{id:'profile-1',label:'Agreed coaching goal and preferences',date:null});
 assert.throws(()=>validateBrief({...output,wins:[{text:'Invented',evidence:['invented-source']}]},context),/unknown source/);
 assert.throws(()=>validateBrief({...output,suggested_response:''},context),/invalid brief text/);
 assert.equal(briefSchema.additionalProperties,false);assert(briefSchema.required.includes('suggested_response'));
 const sql=fs.readFileSync(path.join(__dirname,'../../supabase/schema/coach-review-briefs.sql'),'utf8');assert(sql.includes('enable row level security'));assert(sql.includes('with check'));assert(sql.includes('security invoker'));assert(!/security definer/i.test(sql));assert(sql.includes('pg_advisory_xact_lock'));assert(sql.includes("interval '60 seconds'"));
 console.log('PASS private coaching brief: owner filtering, latest intake, actual cardio, source references, identifier removal, dates, bounded schema and coach-only storage');
})().catch(e=>{console.error(e);process.exitCode=1;});
