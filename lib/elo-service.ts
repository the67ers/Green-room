import {database} from './tournament-service';
import {Tournament} from './tournament.js';
import {ratedChanges} from './elo-formula.js';
export async function ratings(){const rows=await database().prepare('SELECT account_id,elo FROM account_ratings').all<{account_id:string;elo:number}>();return new Map(rows.results.map(r=>[r.account_id,r.elo]));}
export async function hydrateElo(data:any){if(!data)return data;const values=await ratings();return {...data,players:data.players.map((p:any)=>({...p,elo:values.get(p.accountId)|| (values.has(p.accountId)?0:400)}))};}
export async function commitElo(next:any,revision:number,newEvent=false,report?:{id:string;status:string}){
 const db=database(),row=await db.prepare("SELECT data,revision FROM tournaments WHERE id='main'").first<{data:string;revision:number}>();
 if((row?.revision||0)!==revision)return null;
 const before=row&&JSON.parse(row.data),fresh=newEvent||!before;
 if(!fresh&&(before.format!==next.format||JSON.stringify(before.players.map((p:any)=>p.name))!==JSON.stringify(next.players.map((p:any)=>p.name))))throw Error('End this tournament before changing its rated format or lineup.');
 if(next.format!=='elo')throw Error('Create a new tournament to change formats.');
 if(fresh&&Object.keys(next.results).length)throw Error('New Elo tournaments must start without results. Rated backups cannot be replayed for points.');
 const accounts=await db.prepare('SELECT id,username,disabled FROM accounts').all<{id:string;username:string;disabled:number}>();
 const used=new Set<string>();
 for(const p of next.players){const old=!fresh&&before.players.find((x:any)=>x.id===p.id);let id=old?.accountId||p.accountId;const account=id?accounts.results.find(a=>a.id===id&&!a.disabled):accounts.results.find(a=>a.username===p.name.toLowerCase()&&!a.disabled);if((id==='system-admin')||(!id&&p.name.toLowerCase()==='admin'))id='system-admin';else id=account?.id;if(!id||used.has(id))throw Error('Elo needs one active account per player. Use exact usernames or timed check-in.');p.accountId=id;used.add(id);}
 const ratingRows=await db.prepare('SELECT account_id,elo,games FROM account_ratings').all<{account_id:string;elo:number;games:number|null}>();
 const initial=new Map(ratingRows.results.map(r=>[r.account_id,r.elo])),rawGames=new Map(ratingRows.results.map(r=>[r.account_id,r.games])),initialGames=new Map<string,number>();
 const history= [...used].some(id=>rawGames.get(id)==null)?(await db.prepare("SELECT data FROM tournament_history").all<{data:string}>()).results.map(r=>JSON.parse(r.data)):[];
 const previous=[...history,...(before?[before]:[])].filter(t=>t?.format==='elo');
 for(const id of used){initialGames.set(id,rawGames.get(id)??previous.reduce((sum,t)=>sum+Object.values(t.eloLedger||{}).filter((l:any)=>l.a===id||l.b===id).length,0));}
 const values=new Map(initial),games=new Map(initialGames),ledger:any=fresh?{}:{...(before.eloLedger||{})};
 const current=(id:string)=>values.get(id)??400;
 const matches=Tournament.restore(next).rounds().flat().filter((m:any)=>m.complete&&!m.automatic);
 const changed=new Set(Object.keys(ledger).filter(k=>!matches.some((m:any)=>m.key===k&&m.a.accountId===ledger[k].a&&m.b.accountId===ledger[k].b&&next.results[k]===ledger[k].choice)));
 for(const key of changed){const l=ledger[key];values.set(l.a,current(l.a)-(l.aDelta??l.delta));values.set(l.b,current(l.b)-(l.bDelta??-l.delta));games.set(l.a,(games.get(l.a)??0)-1);games.set(l.b,(games.get(l.b)??0)-1);}
 const oldLedger={...ledger};for(const key of changed)delete ledger[key];
 for(const m of matches){
  if(ledger[m.key])continue;
  const a=m.a.accountId,b=m.b.accountId,prior=oldLedger[m.key],same=prior&&prior.a===a&&prior.b===b;
  const aBefore=same?prior.aBefore:current(a),bBefore=same?prior.bBefore:current(b),aGames=same?(prior.aGames??Math.max(0,games.get(a)??0)):(games.get(a)??0),bGames=same?(prior.bGames??Math.max(0,games.get(b)??0)):(games.get(b)??0);
  const firstGame=same?(prior.firstGame===true):(aGames===0&&bGames===0);
  const shift=same?(prior.shift??0):[-4,-2,2,4][crypto.getRandomValues(new Uint32Array(1))[0]%4];
  const outcome=m.draw?0:m.winner.id===m.a.id?1:-1;
  const {aDelta,bDelta}=ratedChanges(aBefore,bBefore,outcome,firstGame,shift);
  values.set(a,current(a)+aDelta);values.set(b,current(b)+bDelta);games.set(a,(games.get(a)??0)+1);games.set(b,(games.get(b)??0)+1);
  ledger[m.key]={a,b,aBefore,bBefore,aGames,bGames,firstGame,shift,aDelta,bDelta,choice:next.results[m.key]};
 }
 for(const id of used)if(current(id)<0)throw Error('This correction would make a rating negative after an admin adjustment. Adjust the account rating first.');
 next.eloLedger=ledger;next.eloWrite=crypto.randomUUID();next.players=next.players.map((p:any)=>({...p,elo:current(p.accountId)}));
 const serialized=JSON.stringify(next),guards="NOT EXISTS(SELECT 1 FROM json_each(?) AS snapshot LEFT JOIN account_ratings AS rating ON rating.account_id=json_extract(snapshot.value,'$[0]') WHERE COALESCE(rating.elo,400)<>json_extract(snapshot.value,'$[1]') OR COALESCE(rating.games,-1)<>json_extract(snapshot.value,'$[2]'))",guardValues=[JSON.stringify([...used].map(id=>[id,initial.get(id)??400,rawGames.get(id)??-1]))];
 let sql=revision===0?"INSERT INTO tournaments (id,data,revision,updated_at) SELECT 'main',?,1,? WHERE "+guards+" ON CONFLICT(id) DO NOTHING RETURNING revision":"UPDATE tournaments SET data=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=? AND "+guards;
 const params:any[]=[serialized,Date.now(),...(revision===0?[]:[revision]),...guardValues];if(report){sql+=' AND EXISTS(SELECT 1 FROM match_reports WHERE id=? AND status=?)';params.push(report.id,report.status);}if(revision!==0)sql+=' RETURNING revision';
 const guard="EXISTS(SELECT 1 FROM tournaments WHERE id='main' AND revision=? AND data=?)";
 const statements=[db.prepare(sql).bind(...params)];
 const changes=[...used].filter(id=>current(id)!==(initial.get(id)??400)||rawGames.get(id)!==games.get(id)).map(id=>[id,current(id),games.get(id)??0]);
 if(changes.length)statements.push(db.prepare(`INSERT INTO account_ratings (account_id,elo,games) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?) WHERE ${guard} ON CONFLICT(account_id) DO UPDATE SET elo=excluded.elo,games=excluded.games`).bind(JSON.stringify(changes),revision+1,serialized));
 if(newEvent&&before)statements.push(db.prepare(`INSERT INTO tournament_history (id,data,archived_at) SELECT ?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),JSON.stringify(before),Date.now(),revision+1,serialized));
 if(report){statements.push(db.prepare(`UPDATE match_reports SET status='accepted' WHERE id=? AND ${guard}`).bind(report.id,revision+1,serialized));statements.push(db.prepare(`UPDATE match_reports SET id=?||':'||match_key,revision=? WHERE revision=? AND id<>? AND status IN ('pending','disputed') AND ${guard}`).bind(String(revision+1),revision+1,revision,report.id,revision+1,serialized));}
 const result=await db.batch(statements);return result[0].results.length?{tournament:next,revision:revision+1}:null;
}
