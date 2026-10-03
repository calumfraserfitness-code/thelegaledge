// Official Health Auto Export deep-link format. Credentials remain in memory;
// never send setup links to analytics, a QR service, chat, or localStorage.
function appleExporterSetup(token,scopes){
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid device key');
 const names={steps:'Step Count',sleep_minutes:'Sleep Analysis'};
 if(!scopes.length||scopes.some(s=>!names[s]))return null;
 const settings={url:'https://baxvhilvrhshlfizakak.supabase.co/functions/v1/health-device-ingest',name:'Legal Edge daily health',format:'json',datatype:'healthMetrics',metrics:scopes.map(s=>names[s]).join(','),period:'none',interval:'days',aggregatedata:'true',aggregatesleep:'true',exportversion:'v2',syncinterval:'minutes',syncquantity:'15',headers:'X-Legal-Edge-Key,'+token+',Content-Type,application/json',requesttimeout:'60',batchrequests:'false',notifywhenrun:'false',enabled:'true'};
 return 'com.HealthExport://automation?'+Object.entries(settings).map(([k,v])=>k+'='+encodeURIComponent(v)).join('&');
}
function attachAppleExporterSetup(container,token,scopes){
 const link=appleExporterSetup(token,scopes);if(!link){container.insertAdjacentHTML('beforeend','<p class="muted">For optional nutrition, weight or heart rate, use the manual settings above and choose the matching metrics in your exporter.</p>');return;}
 const panel=document.createElement('div');panel.className='panel';const button=document.createElement('button');button.type='button';button.className='btn primary';button.textContent='Set up on this iPhone';button.onclick=()=>{location.href=link;};const note=document.createElement('p');note.textContent='Open this page in Safari on your iPhone with Health Auto Export installed. This button passes your private upload key into the exporter and configures only your selected Steps/Sleep metrics. Approve those Health permissions there, then run the automation once. Keep setup links private.';panel.append(button,note);container.append(panel);
}
