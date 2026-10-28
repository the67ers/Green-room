import { database } from './tournament-service';
import { Tournament } from './tournament.js';
export type CheckinWindow={id:string;generation:string;config:string;closes_at:number;status:string};
export const sqlNow="CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
export async function finalizeCheckin(){
  const db=database(),window=await db.prepare("SELECT * FROM checkin_windows WHERE id='main'").first<CheckinWindow>();
  if(!window||window.status!=='open'||window.closes_at>Date.now())return;
  const entries=await db.prepare('SELECT name FROM checkin_entries WHERE window_id = ? ORDER BY checked_at,id').bind(window.generation).all<{name:string}>();
  const config=JSON.parse(window.config),minimum=config.format==='four'?4:2;
  if(entries.results.length<minimum){await db.prepare("UPDATE checkin_windows SET status='insufficient' WHERE id='main' AND generation=? AND status='open'").bind(window.generation).run();return;}
  const t=new Tournament(entries.results.map(e=>e.name),config.title,config.random,config.format);
  const condition="EXISTS(SELECT 1 FROM checkin_windows WHERE id='main' AND generation=? AND status='open')";
  await db.batch([
    db.prepare(`INSERT INTO tournament_history (id,data,archived_at) SELECT ?,data,? FROM tournaments WHERE id='main' AND data <> 'null' AND ${condition}`).bind(crypto.randomUUID(),Date.now(),window.generation),
    db.prepare(`INSERT INTO tournaments (id,data,revision,updated_at) SELECT 'main',?,1,? WHERE ${condition} ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=tournaments.revision+1,updated_at=excluded.updated_at`).bind(JSON.stringify(t.data()),Date.now(),window.generation),
    db.prepare("UPDATE checkin_windows SET status='closed' WHERE id='main' AND generation=? AND status='open'").bind(window.generation),
  ]);
}
export async function checkinState(accountId?:string){
  const db=database(),w=await db.prepare("SELECT * FROM checkin_windows WHERE id='main'").first<CheckinWindow>();
  if(!w||w.status==='cancelled')return null;
  const entries=await db.prepare('SELECT account_id,name FROM checkin_entries WHERE window_id=? ORDER BY checked_at,id').bind(w.generation).all<{account_id:string;name:string}>();
  return {id:w.generation,...JSON.parse(w.config),closesAt:w.closes_at,status:w.status,serverNow:Date.now(),count:entries.results.length,names:entries.results.map(e=>e.name),checkedIn:entries.results.some(e=>e.account_id===accountId)};
}
