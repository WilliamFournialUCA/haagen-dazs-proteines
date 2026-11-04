const assert=require('node:assert/strict');
const {project}=require('../questionnaire-cross-model.js');
const data={variables:{x:{options:['a','b']},y:{options:['c','d']},z:{options:['e','f']}},
 groups:{'16':{n:4,cross:{'x|y':{n:3,rows:['a','b'],columns:['c','d'],counts:[[2,0],[0,1]]}}}},
 three_way:{version:1,triples:[['x','y','z']],groups:{'16':{tables:[{n:3,cells:[[0,1,0,2],[1,0,1,1]]}]}}}};
assert.deepEqual(project(data,'16','x','y'),{n:3,total:4,missing:1,cells:[[0,0,0,2],[1,1,0,1]]});
for(const axes of [['x','y','z'],['x','z','y'],['y','x','z'],['y','z','x'],['z','x','y'],['z','y','x']]){
 const result=project(data,'16',...axes);
 assert.equal(result.n,3);assert.equal(result.missing,1);
 const original=[0,1,0],keys=['x','y','z'];
 assert.deepEqual(result.cells[0],[...axes.map(k=>original[keys.indexOf(k)]),2]);
 assert.equal(result.cells.reduce((s,c)=>s+c[3],0),result.n);
}
assert.throws(()=>project(data,'16','x','x','z'),/distinct/);
assert.throws(()=>project(data,'16','variant','y'),/distinct/);
const old={...data,three_way:undefined};
assert.throws(()=>project(old,'16','x','y','z'),/pending/);
assert.equal(project(old,'16','x','y').n,3); // Old snapshots still support pairs.
console.log('Projection des tableaux : deux variables et six permutations à trois variables vérifiées.');
