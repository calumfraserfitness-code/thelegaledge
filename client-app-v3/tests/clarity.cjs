const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const markup='<article><div class="prescription-grid"><div><span>SETS</span><strong>3</strong></div><div><span>TEMPO / INTENSITY</span><strong>RPE 7</strong></div></div><h4>How to do it</h4><ol><li>Move steadily.</li></ol><form><label>Reps<input name="reps_1"></label><label>RIR<input name="rir_1"></label></form></article>';
const noop=()=>{};
const ctx=vm.createContext({state:{role:'coach'},$:()=>null,document:{addEventListener:noop},exerciseCard:()=>markup,coachTraining:noop,renderClientWorkspace:noop,paintFirmPilots:noop,clientCoachingSupport:noop,clientHealth:noop,renderClient:noop,renderCoach:noop});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../clarity.js'),'utf8'),ctx);
assert.equal(vm.runInContext('exerciseCard({})',ctx),markup,'Coach retains advanced prescription and logging fields');
ctx.state.role='client';const client=vm.runInContext('exerciseCard({})',ctx);
assert.match(client,/<span>SETS<\/span><strong>3/);assert.match(client,/name="reps_1"/);assert.doesNotMatch(client,/TEMPO \/ INTENSITY|name="rir_1"/);assert.match(client,/<summary>Technique tips/);
console.log('PASS: client prescription clarity retains sets and logging while coach advanced fields stay intact.');
