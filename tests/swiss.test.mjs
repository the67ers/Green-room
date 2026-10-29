import assert from 'node:assert/strict';
import {Tournament} from '../lib/tournament.js';
for(let n=2;n<=100;n++){
 const t=new Tournament(Array.from({length:n},(_,i)=>'P'+i),'Swiss',false,'swiss');
 const limit=Math.ceil(Math.log2(n));let byes=new Set();
 for(let r=0;r<limit;r++){
  const round=t.rounds()[r],seen=new Set();assert(round);
  for(const m of round){for(const p of [m.a,m.b].filter(Boolean)){assert(!seen.has(p.id));seen.add(p.id);}if(m.automatic){assert(!byes.has(m.a.id));byes.add(m.a.id);}else t.choose(r,m.m,(r+m.m)%3===0?0:m.a.id);}
  assert.equal(seen.size,n);assert.deepEqual(Tournament.restore(t.data()).data(),t.data());
 }
 assert.equal(t.rounds().length,limit);assert(t.rounds().flat().every(m=>m.complete));assert.equal(t.standings().reduce((s,p)=>s+p.points,0),Math.ceil(n/2)*limit);
 if(limit>1){const m=t.rounds()[0].find(m=>m.ready);t.choose(0,m.m,m.b.id);assert.equal(t.rounds().length,2);assert(!Object.keys(t.results).some(k=>Number(k.split('-')[0])>0));}
}
console.log('PASS: Swiss 2–100 players, round progression, one appearance per round, bye rotation, points, restore and correction clearing.');
