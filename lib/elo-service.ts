import {database} from './tournament-service';
import {Tournament} from './tournament.js';
import {eloDelta} from './elo-formula.js';
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
 const initial=await ratings(),values=new Map(initial),ledger:any=fresh?{}:{...(before.eloLedger||{})};
 const current=(id:string)=>values.get(id)??400;
 const matches=Tournament.restore(next).rounds().flat().filter((m:any)=>m.complete&&!m.automatic);
 const changed=new Set(Object.keys(ledger).filter(k=>!matches.some((m:any)=>m.key===k&&m.a.accountId===ledger[k].a&&m.b.accountId===ledger[k].b&&next.results[k]===ledger[k].choice)));
 for(const key of changed){const l=ledger[key];values.set(l.a,current(l.a)-l.delta);values.set(l.b,current(l.b)+l.delta);}
 const oldLedger={...ledger};for(const key of changed)delete ledger[key];
 for(const m of matches){if(ledger[m.key])continue;const a=m.a.accountId,b=m.b.accountId,prior=oldLedger[m.key],aBefore=prior&&prior.a===a&&prior.b===b?prior.aBefore:current(a),bBefore=prior&&prior.a===a&&prior.b===b?prior.bBefore:current(b),delta=eloDelta(aBefore,bBefore,m.draw?0:m.winner.id===m.a.id?1:-1);values.set(a,current(a)+delta);values.set(b,current(b)-delta);ledger[m.key]={a,b,aBefore,bBefore,delta,choice:next.results[m.key]};}
 for(const id of used)if(current(id)<0)throw Error('This correction would make a rating negative after an admin adjustment. Adjust the account rating first.');
 next.eloLedger=ledger;next.eloWrite=crypto.randomUUID();next.players=next.players.map((p:any)=>({...p,elo:current(p.accountId)}));
 const serialized=JSON.stringify(next),guards=[...used].map(()=>"COALESCE((SELECT elo FROM account_ratings WHERE account_id=?),400)=?").join(' AND '),guardValues=[...used].flatMap(id=>[id,initial.get(id as string)??400]);
 let sql=revision===0?"INSERT INTO tournaments (id,data,revision,updated_at) SELECT 'main',?,1,? WHERE "+guards+" ON CONFLICT(id) DO NOTHING RETURNING revision":"UPDATE tournaments SET data=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=? AND "+guards;
 const params:any[]=[serialized,Date.now(),...(revision===0?[]:[revision]),...guardValues];if(report){sql+=' AND EXISTS(SELECT 1 FROM match_reports WHERE id=? AND status=?)';params.push(report.id,report.status);}if(revision!==0)sql+=' RETURNING revision';
 const guard="EXISTS(SELECT 1 FROM tournaments WHERE id='main' AND revision=? AND data=?)";
 const statements=[db.prepare(sql).bind(...params)];
 for(const id of used){const change=current(id as string)-(initial.get(id as string)??400);if(change)statements.push(db.prepare(`INSERT INTO account_ratings (account_id,elo) SELECT ?,? WHERE ${guard} ON CONFLICT(account_id) DO UPDATE SET elo=account_ratings.elo+?`).bind(id,current(id as string),revision+1,serialized,change));}
 if(newEvent&&before)statements.push(db.prepare(`INSERT INTO tournament_history (id,data,archived_at) SELECT ?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),JSON.stringify(before),Date.now(),revision+1,serialized));
 if(report){statements.push(db.prepare(`UPDATE match_reports SET status='accepted' WHERE id=? AND ${guard}`).bind(report.id,revision+1,serialized));statements.push(db.prepare(`UPDATE match_reports SET id=?||':'||match_key,revision=? WHERE revision=? AND id<>? AND status IN ('pending','disputed') AND ${guard}`).bind(String(revision+1),revision+1,revision,report.id,revision+1,serialized));}
 const result=await db.batch(statements);return result[0].results.length?{tournament:next,revision:revision+1}:null;
}
