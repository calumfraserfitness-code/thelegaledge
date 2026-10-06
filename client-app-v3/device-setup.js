// Official Health Auto Export deep-link format. Credentials remain in memory;
// never send setup links to analytics, a QR service, chat, or localStorage.
function appleExporterSetup(token,scopes){
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid device key');
 const names={steps:'Step Count',sleep_minutes:'Sleep Analysis',weight_kg:'Weight & Body Mass',resting_heart_rate:'Resting Heart Rate',consumed_calories:'Dietary Energy',protein_g:'Protein',carbs_g:'Carbohydrates',fat_g:'Total Fat',water_ml:'Dietary Water'};
 if(!scopes.length||scopes.some(s=>!names[s]))return null;
 const settings={url:'https://baxvhilvrhshlfizakak.supabase.co/functions/v1/health-device-ingest',name:'Legal Edge daily health',format:'json',datatype:'healthMetrics',metrics:scopes.map(s=>names[s]).join(','),period:'none',interval:'days',aggregatedata:'true',aggregatesleep:'true',exportversion:'v2',syncinterval:'minutes',syncquantity:'15',headers:'X-Legal-Edge-Key,'+token+',Content-Type,application/json',requesttimeout:'60',batchrequests:'false',notifywhenrun:'false',enabled:'true'};
 return 'com.HealthExport://automation?'+Object.entries(settings).map(([k,v])=>k+'='+encodeURIComponent(v)).join('&');
}
function attachAppleExporterSetup(container,token,scopes){
 const link=appleExporterSetup(token,scopes);if(!link)return;
 const panel=document.createElement('div');panel.className='panel';
 const open=document.createElement('a');open.className='btn primary';open.href=link;open.textContent='Open Health Auto Export';
 const note=document.createElement('p');note.textContent='This opens the installed Health Auto Export app. If Safari says the address is invalid, install that exact app first or use the setup below. Apple Health itself cannot open this automation link.';
 const app=document.createElement('a');app.className='btn ghost';app.href='https://apps.apple.com/app/id1115567069';app.textContent='Install the correct iPhone app';
 const help=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Safari link failed? Set it up inside the phone app';help.append(summary);
 const instructions=document.createElement('p');instructions.textContent='In Health Auto Export, open Automations → + → REST API. Set JSON, Health Metrics, daily aggregation, date range Default, sleep aggregation on, and automatic sync on. Choose only the readings you approved. Add the endpoint and header below, then Run once. Automation requires its Premium feature.';help.append(instructions);
 const fields=[['Endpoint','https://baxvhilvrhshlfizakak.supabase.co/functions/v1/health-device-ingest'],['Header name','X-Legal-Edge-Key'],['Header value',token]];
 for(const [label,value]of fields){const row=document.createElement('div');const title=document.createElement('strong');title.textContent=label;const button=document.createElement('button');button.type='button';button.className='btn ghost small';button.textContent='Copy '+label.toLowerCase();button.onclick=async()=>{try{await navigator.clipboard.writeText(value);button.textContent='Copied';}catch{button.textContent='Select the value below';}};const input=document.createElement('input');input.readOnly=true;input.value=value;input.type=label==='Header value'?'password':'text';input.autocomplete='off';row.append(title,button,input);if(label==='Header value'){const reveal=document.createElement('button');reveal.type='button';reveal.className='text-btn';reveal.textContent='Show key';reveal.onclick=()=>{input.type=input.type==='password'?'text':'password';};row.append(reveal);}help.append(row);}
 const selected=document.createElement('p');selected.textContent='Readings: '+scopes.join(', ');help.append(selected);
 panel.append(open,app,note,help);container.append(panel);
}
