import {finalizeCheckin,checkinState} from '../../../lib/checkin-service';
import {reportState,reportAction} from '../../../lib/match-report-service';
export const POST=reportAction;
import { currentUser, database, isAdmin, json, readJson, sameOrigin, validateTournament } from '../../../lib/tournament-service';
export const dynamic='force-dynamic';
export async function GET(request: Request) {
  await finalizeCheckin();
  const row=await database().prepare('SELECT data, revision FROM tournaments WHERE id = ?').bind('main').first<{data:string,revision:number}>();
  const user=await currentUser(request);
  const t=row?JSON.parse(row.data):null;
  return json({...t?await reportState(t,row!.revision,user):{playerId:null,reports:[]},checkin:await checkinState(user?.id),user,tournament:t,revision:row?.revision||0,admin:user?.role==='admin'});
}
export async function PUT(request: Request) {
  if(!sameOrigin(request))return json({error:'This request must come from the tournament app.'},403);
  if(!await isAdmin(request))return json({error:'Admin sign-in is required to change the tournament.'},401);
  const pending=await checkinState();if(pending?.status==='open')return json({error:'Check-in is open. Wait for it to close or cancel it first.'},409);
  let body,data;
  try{body=await readJson(request);if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new Error('Invalid tournament revision.');data=validateTournament(body.tournament);}catch(error){return json({error:error instanceof Error?error.message:'Invalid tournament.'},400);}
  const db=database();
  let row:{revision:number}|null=null;
  if(body.revision===0){row=await db.prepare('INSERT INTO tournaments (id,data,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING RETURNING revision').bind('main',JSON.stringify(data),Date.now()).first<{revision:number}>();}
  else {
    const update=db.prepare('UPDATE tournaments SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING revision').bind(JSON.stringify(data),Date.now(),'main',body.revision);
    if(body.archiveCurrent===true){
      const batch=await db.batch<{revision:number}>([
        db.prepare("INSERT INTO tournament_history (id,data,archived_at) SELECT ?,data,? FROM tournaments WHERE id = ? AND revision = ? AND data <> 'null'").bind(crypto.randomUUID(),Date.now(),'main',body.revision),update
      ]);
      row=batch[1].results[0]||null;
    }else row=await update.first<{revision:number}>();
  }
  if(!row)return json({error:'Another admin updated the tournament. The latest version has been loaded; please try your edit again.'},409);
  if(body.archiveCurrent===true)await db.prepare("UPDATE checkin_windows SET status='cancelled' WHERE id='main' AND status<>'open'").run();
  return json({tournament:data,revision:row.revision,admin:true});
}

export async function DELETE(request:Request){
  if(!sameOrigin(request))return json({error:'Invalid origin.'},403);
  if(!await isAdmin(request))return json({error:'Admin access is required.'},403);
  let body;try{body=await readJson(request,2000);}catch{return json({error:'Choose the current tournament.'},400);}
  if(!Number.isSafeInteger(body.revision)||body.revision<0)return json({error:'Invalid tournament revision.'},400);
  const db=database(),current=await db.prepare("SELECT revision FROM tournaments WHERE id='main'").first<{revision:number}>();
  if((current?.revision||0)!==body.revision)return json({error:'The tournament changed. Refresh and try again.'},409);
  const checkin=await checkinState();
  if((checkin?.id||null)!==(body.checkinId||null))return json({error:'Check-in changed. Refresh and try again.'},409);
  const results=await db.batch([
    db.prepare("INSERT INTO tournament_history (id,data,archived_at) SELECT ?,data,? FROM tournaments WHERE id='main' AND revision=? AND data <> 'null'").bind(crypto.randomUUID(),Date.now(),body.revision),
    db.prepare("UPDATE tournaments SET data='null', revision=revision+1 WHERE id='main' AND revision=?").bind(body.revision),
    db.prepare("UPDATE checkin_windows SET status='cancelled' WHERE id='main' AND generation=? AND (NOT EXISTS(SELECT 1 FROM tournaments WHERE id='main') OR EXISTS(SELECT 1 FROM tournaments WHERE id='main' AND revision=? AND data='null'))").bind(checkin?.id||'',body.revision+1),
  ]);
  if(current&&!results[1].meta.changes)return json({error:'The tournament changed. Refresh and try again.'},409);
  return json({success:true});
}
