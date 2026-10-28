const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const html=fs.readFileSync(require('path').join(__dirname,'../frontend/index.html'),'utf8');for(const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);const ctx={};vm.createContext(ctx);vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]+'\nthis.Tournament=Tournament',ctx);const T=ctx.Tournament;
for(const format of ['single','two','four'])for(let n=format==='four'?4:2;n<=100;n++){
 let t=new T(Array.from({length:n},(_,i)=>'Student '+(i+1)),'Test',false,format),played=0;
 for(let r=0;r<t.rounds().length;r++)for(let x of t.rounds()[r])if(x.ready){t.choose(r,x.m,x.a.id);played++;}
 assert.equal(played,n-1);assert.equal(t.rounds().at(-1)[0].winner.id,1);assert.equal(JSON.stringify(T.restore(t.data()).data()),JSON.stringify(t.data()));
 let first=t.rounds().flat().find(x=>x.ready);t.choose(first.r,first.m,first.b.id);assert.equal(t.rounds().at(-1)[0].winner?.id,n===2?first.b.id:undefined);
}
for(let n=2;n<=100;n++){
 let t=new T(Array.from({length:n},(_,i)=>'Student '+i),'Robin',false,'robin'),rounds=t.rounds(),pairs=new Set();
 for(const round of rounds){let participants=new Set();for(let m of round){assert(!participants.has(m.a.id));assert(!participants.has(m.b.id));participants.add(m.a.id);participants.add(m.b.id);let k=[m.a.id,m.b.id].sort((a,b)=>a-b).join('-');assert(!pairs.has(k));pairs.add(k);t.results[m.key]=0;}}
 assert.equal(pairs.size,n*(n-1)/2);assert(t.rounds().flat().every(m=>m.complete&&m.draw));assert(t.standings().every(p=>p.points===(n-1)/2&&p.played===n-1));assert.equal(JSON.stringify(T.restore(t.data()).data()),JSON.stringify(t.data()));
 let m=t.rounds()[0][0];t.choose(0,0,m.a.id);assert.equal(t.standings()[0].id,m.a.id);assert.equal(t.standings()[0].points,n/2);assert.equal(t.rounds()[0][0].draw,false);
}
let old=new T(['A','B','C']);old.choose(0,1,2);let d=old.data();d.version=1;delete d.format;assert.equal(T.restore(d).format,'single');assert.throws(()=>T.restore({...d,results:{'9-9':1}}));assert.throws(()=>new T(['A','B'], 'Four',false,'four'));
console.log('PASS: all 2–100 player elimination formats and round-robin schedules; advancement, byes, correction clearing, draw scoring, tied ranks, backups and v1 compatibility.');
