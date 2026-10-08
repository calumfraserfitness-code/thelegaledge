const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/../calm-experience.js','utf8');
let rows=[];const ctx=vm.createContext({Date,Number,Math,state:{preview:false},clientToday(){},healthSummaryMarkup(){},recentHealthRows:()=>rows,weeklyReports:()=>[],weeklyReportCard(){},finiteRecorded:v=>v!==null&&v!==undefined&&Number.isFinite(Number(v)),esc:s=>String(s).replaceAll('<','&lt;'),fmt:x=>x,displayWeight:x=>x+' kg'});vm.runInContext(code,ctx);
assert(ctx.calmSparkline([], 'steps','Steps').includes('Awaiting readings'));
assert(ctx.calmSparkline([{date:'2026-10-01',steps:0}], 'steps','Steps').includes('One recorded day'));
let svg=ctx.calmSparkline([{date:'2026-10-01',steps:10},{date:'2026-10-03',steps:20}], 'steps','Steps');assert.equal((svg.match(/<circle/g)||[]).length,2);assert(!svg.includes('L212'));
rows=[{date:'2026-10-01',weight_kg:80,steps:0},{date:'2026-10-02',steps:100}];const h=ctx.healthSummaryMarkup();assert(h.includes('80 kg'));assert(h.includes('Not recorded'));assert(h.includes('>50<'));assert(!h.includes('live connection'));
console.log('PASS: recorded-only visuals, date gaps, zero readings, missing fields and latest available weight.');
