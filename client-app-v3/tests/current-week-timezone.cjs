const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../app-v2.js','utf8'),body=source.slice(source.indexOf('function currentWeek()'),source.indexOf('function safeStepGoal'));
let now='2026-11-02T00:30:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return +new Date(now);}}
const state={client:{id:'own',timezone:'America/New_York'},data:{weeks:[{id:'peer',client_id:'peer',week_start:'2026-10-26'},{id:'previous',client_id:'own',week_start:'2026-10-26'},{id:'current',client_id:'own',week_start:'2026-11-02'}]}};
const c=vm.createContext({Date:Clock,Intl,state,iso:date=>date.toISOString().slice(0,10),monday:()=>new Clock('2026-11-02T00:00:00Z')});vm.runInContext(body,c);
assert.equal(c.currentWeek().id,'previous','New York still uses Sunday’s own training week when the coach host has reached Monday');
state.client.timezone='Europe/Dublin';assert.equal(c.currentWeek().id,'current');
now='2026-11-01T23:30:00Z';state.client.timezone='Australia/Sydney';assert.equal(c.currentWeek().id,'current','The client’s Monday applies even when the host is still Sunday');
now='2026-03-30T00:30:00Z';state.client.timezone='America/New_York';state.data.weeks=[{id:'dst-previous',client_id:'own',week_start:'2026-03-23'},{id:'dst-current',client_id:'own',week_start:'2026-03-30'}];assert.equal(c.currentWeek().id,'dst-previous','DST offsets do not move the client into the host week');
state.client.timezone='invalid/zone';assert.equal(c.currentWeek(),null,'Invalid client timezone cannot open another week');
console.log('PASS client-local current week, cross-midnight/DST selection, peer exclusion and invalid-timezone handling');
