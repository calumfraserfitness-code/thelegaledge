const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../app-v2.js','utf8');
const code=source.slice(source.indexOf('function progressData() {'),source.indexOf('\nfunction rangeEntries('));
const c=vm.createContext({state:{client:{id:'j',start_weight_kg:84},data:{progress:[{client_id:'j',entry_date:'2026-09-03',weight_kg:82.55}],checkins:[{client_id:'j',submitted_at:'2026-09-03T12:00:00Z',weight_kg:82.55},{client_id:'j',submitted_at:'2026-10-08T12:00:00Z',weight_kg:82.1},{client_id:'other',submitted_at:'2026-10-09T12:00:00Z',weight_kg:90},{submitted_at:'2026-10-10',weight_kg:''},{submitted_at:'2026-10-11',weight_kg:0}]}}});
vm.runInContext(code,c);let model=vm.runInContext('progressData()',c);
assert.equal(model.entries.length,2,'same-day progress and check-in count once');assert.equal(model.current,82.1,'latest check-in weight reaches chart');assert.equal(model.entries[0].weight_kg,82.55);assert.equal(model.entries.at(-1).entry_date,'2026-10-08');
c.state.data.progress.push({entry_date:'2026-10-08',weight_kg:82.2});assert.equal(vm.runInContext('progressData().current',c),82.2,'explicit progress row takes precedence');
console.log('PASS: latest check-in weights reach charts, duplicate dates collapse, invalid weights and other clients excluded.');
