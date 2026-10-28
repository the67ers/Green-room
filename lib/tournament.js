
'use strict';
class Tournament {
 constructor(names,title='School Championship',random=false,format='single'){
  if(!Array.isArray(names)||names.length<2||names.length>100||names.some(n=>typeof n!=='string'||!n.trim()||n.length>80))throw Error('Enter 2–100 names, each 1–80 characters.');
  if(!['single','two','four','robin'].includes(format))throw Error('Choose a valid tournament format.');if(format==='four'&&names.length<4)throw Error('Four regions need at least 4 players.');this.format=format;
  const lineup=names.map(n=>n.trim());if(random)for(let i=lineup.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[lineup[i],lineup[j]]=[lineup[j],lineup[i]];}
  this.title=String(title).trim().slice(0,70)||'School Championship';this.players=lineup.map((name,i)=>({id:i+1,name,seed:i+1}));this.size=2**Math.ceil(Math.log2(names.length));this.results={};
  let seeds=[1,2];while(seeds.length<this.size){const sum=seeds.length*2+1;seeds=seeds.flatMap(n=>[n,sum-n]);}this.seeds=seeds;this.demo=false;
 }
 rounds(){if(this.format==='robin')return this.robinRounds();let rounds=[];for(let r=0;r<Math.log2(this.size);r++){let matches=[];for(let m=0;m<this.size/2**(r+1);m++){
   let a,b,readyA=true,readyB=true;
   if(r===0){a=this.players[this.seeds[m*2]-1]||null;b=this.players[this.seeds[m*2+1]-1]||null;}else{let x=rounds[r-1][m*2],y=rounds[r-1][m*2+1];a=x.winner;b=y.winner;readyA=x.complete;readyB=y.complete;}
   let key=r+'-'+m;let automatic=readyA&&readyB&&(!a||!b);let selected=this.results[key];let winner=automatic?(a||b):(a&&b&&(selected===a.id||selected===b.id)?(selected===a.id?a:b):null);let complete=automatic||!!winner;
   matches.push({r,m,key,a,b,winner,complete,automatic,ready:!!a&&!!b&&readyA&&readyB});
  }rounds.push(matches);}return rounds;}
 choose(r,m,id){if(this.format==='robin'){let x=this.rounds()[r]?.[m];if(!x||![0,x.a.id,x.b.id].includes(id))throw Error('Invalid result.');if(this.results[x.key]===id)return false;this.results[x.key]=id;return true;}let rounds=this.rounds(),match=rounds[r]?.[m];if(!match?.ready||![match.a.id,match.b.id].includes(id))throw Error('This match is not ready.');if(match.winner?.id===id)return false;this.results[match.key]=id;for(let next=r+1,k=Math.floor(m/2);next<rounds.length;next++,k=Math.floor(k/2))delete this.results[next+'-'+k];return true;}
 robinRounds(){
  if(!this.fixtures){let ring=this.players.map(p=>p.id);if(ring.length%2)ring.push(null);this.fixtures=[];for(let r=0;r<ring.length-1;r++){let games=[];for(let m=0;m<ring.length/2;m++){let a=ring[m],b=ring[ring.length-1-m];if(a&&b)games.push([a,b]);}this.fixtures.push(games);ring.splice(1,0,ring.pop());}}
  return this.fixtures.map((games,r)=>games.map(([a,b],m)=>{a=this.players[a-1];b=this.players[b-1];let key=r+'-'+m,v=this.results[key],complete=v===0||v===a.id||v===b.id;return {r,m,key,a,b,ready:true,automatic:false,complete,draw:complete&&v===0,winner:v===a.id?a:v===b.id?b:null};}));
 }
 totalMatches(){return this.format==='robin'?this.players.length*(this.players.length-1)/2:this.players.length-1;}
 standings(){let rows=this.players.map(p=>({...p,played:0,wins:0,draws:0,losses:0,points:0}));for(let m of this.rounds().flat()){if(!m.complete)continue;for(let p of [m.a,m.b]){let row=rows[p.id-1];row.played++;if(m.draw){row.draws++;row.points+=.5;}else if(m.winner.id===p.id){row.wins++;row.points++;}else row.losses++;}}return rows.sort((a,b)=>b.points-a.points||b.wins-a.wins||a.seed-b.seed);}
 static restore(data){if(!data||![1,2].includes(data.version)||!Array.isArray(data.players))throw Error('That file is not a Greenroom tournament backup.');let t=new Tournament(data.players.map(p=>p.name),data.title,false,data.format||'single');if(!data.results||typeof data.results!=='object'||Array.isArray(data.results))throw Error('The backup results are invalid.');t.demo=data.demo===true;let count=0;for(let round of t.rounds())for(let x of round){let k=x.key;if(Object.prototype.hasOwnProperty.call(data.results,k)){let match=t.format==='robin'?x:t.rounds()[x.r][x.m],id=data.results[k];if(!Number.isInteger(id)||!match.ready||![match.a.id,match.b.id,...(t.format==='robin'?[0]:[])].includes(id))throw Error('The backup has an invalid match result.');t.results[k]=id;count++;}}if(count!==Object.keys(data.results).length)throw Error('The backup contains unknown matches.');return t;}
 data(){return {version:2,title:this.title,players:this.players,results:this.results,demo:this.demo,format:this.format};}
}

export { Tournament };
