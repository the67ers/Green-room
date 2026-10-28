import { currentUser,database,json,readJson,sameOrigin } from '../../../lib/tournament-service';
import { finalizeCheckin,checkinState,sqlNow } from '../../../lib/checkin-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'Invalid origin.'},403);
  const user=await currentUser(request);if(!user)return json({error:'Sign in to check in.'},401);
  let body;try{body=await readJson(request,3000);}catch{return json({error:'Invalid check-in request.'},400);}
  await finalizeCheckin();const db=database();
  if(body.action==='create'){
    if(user.role!=='admin')return json({error:'Admin access is required.'},403);
    if(typeof body.title!=='string'||!body.title.trim()||!['single','two','four','robin'].includes(body.format)||!Number.isInteger(body.minutes)||body.minutes<1||body.minutes>1440)return json({error:'Choose a name, format, and a check-in time between 1 and 1,440 minutes.'},400);
    const generation=crypto.randomUUID(),config=JSON.stringify({title:body.title.trim().slice(0,70),format:body.format,random:body.random!==false});
    const row=await db.prepare("INSERT INTO checkin_windows (id,generation,config,closes_at,status) VALUES ('main',?,?,?,'open') ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,config=excluded.config,closes_at=excluded.closes_at,status='open' WHERE checkin_windows.status<>'open' RETURNING generation").bind(generation,config,Date.now()+body.minutes*60000).first();
    return row?json({checkin:await checkinState(user.id)},201):json({error:'Check-in is already open. Cancel it before creating another tournament.'},409);
  }
  if(typeof body.windowId!=='string')return json({error:'Choose the current check-in window.'},400);
  const id=body.windowId+':'+user.id;
  const row=await db.prepare(`INSERT INTO checkin_entries (id,window_id,account_id,name,checked_at) SELECT ?,?,?,?,${sqlNow} FROM checkin_windows WHERE id='main' AND generation=? AND status='open' AND closes_at>${sqlNow} AND (SELECT count(*) FROM checkin_entries WHERE window_id=?)<100 ON CONFLICT(id) DO NOTHING RETURNING id`).bind(id,body.windowId,user.id,user.username,body.windowId,body.windowId).first();
  if(!row)return json({error:'Check-in is closed, full, or you have already checked in.'},409);
  return json({checkin:await checkinState(user.id)});
}
export async function DELETE(request:Request){
  if(!sameOrigin(request))return json({error:'Invalid origin.'},403);
  const user=await currentUser(request);if(user?.role!=='admin')return json({error:'Admin access is required.'},403);
  await database().prepare("UPDATE checkin_windows SET status='cancelled' WHERE id='main' AND status IN ('open','insufficient')").run();
  return json({success:true});
}
