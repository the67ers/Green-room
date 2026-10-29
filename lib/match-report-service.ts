import {Tournament} from './tournament.js';
import {currentUser,database,json,readJson,sameOrigin,AppUser} from './tournament-service';
export function playerFor(t:any,user:AppUser|null){if(!user)return null;const matches=t.players.filter((p:any)=>p.accountId?p.accountId===user.id:p.name.toLowerCase()===user.username.toLowerCase());return matches.length===1?matches[0]:null;}
export async function reportState(t:any,revision:number,user:AppUser|null){
 const me=playerFor(t,user);if(!user)return {playerId:null,reports:[]};
 const rows=await database().prepare('SELECT id,match_key,reporter,opponent,choice,status FROM match_reports WHERE revision=? ORDER BY created_at DESC').bind(revision).all();
 return {playerId:me?.id||null,reports:rows.results.filter((r:any)=>user.role==='admin'||r.reporter===user.id||r.opponent===user.id)};
}
export async function reportAction(request:Request){
 if(!sameOrigin(request))return json({error:'Invalid origin.'},403);
 const user=await currentUser(request);if(!user)return json({error:'Sign in first.'},401);
 let b;try{b=await readJson(request,2000);}catch{return json({error:'Invalid result report.'},400);}
 const db=database(),row=await db.prepare("SELECT data,revision FROM tournaments WHERE id='main'").first<{data:string;revision:number}>();
 if(!row||row.data==='null'||row.revision!==b.revision)return json({error:'The tournament changed. Refresh and report again.'},409);
 const t=Tournament.restore(JSON.parse(row.data)),m=t.rounds().flat().find((x:any)=>x.key===b.matchKey),me=playerFor(t,user);
 if(!m?.ready||m.complete)return json({error:'This match is not awaiting a result.'},409);
 const member=me&&[m.a.id,m.b.id].includes(me.id),id=row.revision+':'+m.key;
 if(b.action==='submit'){
  if(!member)return json({error:'Only players in this match can report it.'},403);
  if(![m.a.id,m.b.id,...(['swiss','robin'].includes(t.format)?[0]:[])].includes(b.choice))return json({error:'Choose a valid result.'},400);
  const other=me.id===m.a.id?m.b:m.a;
  let opponent=other.accountId;
  if(!opponent){const account=await db.prepare('SELECT id FROM accounts WHERE username=? AND disabled=0').bind(other.name.toLowerCase()).first<{id:string}>();opponent=account?.id;if(other.name.toLowerCase()==='admin')opponent='system-admin';}
  if(!opponent||opponent===user.id)return json({error:'Your opponent needs a linked account. Ask an admin to record this result.'},409);
  const inserted=await db.prepare("INSERT INTO match_reports (id,revision,match_key,reporter,opponent,choice,status,created_at) SELECT ?,?,?,?,?,?,'pending',? WHERE EXISTS(SELECT 1 FROM tournaments WHERE id='main' AND revision=?) ON CONFLICT(id) DO NOTHING RETURNING id").bind(id,row.revision,m.key,user.id,opponent,b.choice,Date.now(),row.revision).first();
  return inserted?json({success:true}):json({error:'A report already exists or the tournament changed. Refresh to review it.'},409);
 }
 const report=await db.prepare('SELECT * FROM match_reports WHERE id=?').bind(id).first<any>();if(!report)return json({error:'Report not found.'},404);
 if(b.action==='dispute'){
  if(report.opponent!==user.id)return json({error:'Only the opponent can dispute.'},403);
  const r=await db.prepare("UPDATE match_reports SET status='disputed' WHERE id=? AND status='pending' RETURNING id").bind(id).first();return r?json({success:true}):json({error:'Report changed.'},409);
 }
 const resolving=b.action==='resolve'&&user.role==='admin';
 if(!resolving&&(b.action!=='confirm'||report.opponent!==user.id))return json({error:'Opponent confirmation or admin access is required.'},403);
 if(!resolving&&report.status!=='pending')return json({error:'An admin must resolve this dispute.'},409);
 const choice=resolving?b.choice:report.choice;try{t.choose(m.r,m.m,choice);}catch{return json({error:'Invalid result.'},400);}
 const batch=await db.batch([
  db.prepare("UPDATE tournaments SET data=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=? AND EXISTS(SELECT 1 FROM match_reports WHERE id=? AND status=?) RETURNING revision").bind(JSON.stringify(t.data()),Date.now(),row.revision,id,report.status),
  db.prepare("UPDATE match_reports SET status='accepted' WHERE id=? AND EXISTS(SELECT 1 FROM tournaments WHERE id='main' AND revision=?)").bind(id,row.revision+1),
  db.prepare("UPDATE match_reports SET id=? || ':' || match_key,revision=? WHERE revision=? AND id<>? AND status IN ('pending','disputed') AND EXISTS(SELECT 1 FROM tournaments WHERE id='main' AND revision=? AND data=?)").bind(String(row.revision+1),row.revision+1,row.revision,id,row.revision+1,JSON.stringify(t.data())),
 ]);
 return batch[0].results.length?json({success:true}):json({error:'The match changed. Refresh and try again.'},409);
}
