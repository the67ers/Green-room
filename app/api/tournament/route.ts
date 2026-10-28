import {finalizeCheckin,checkinState} from '../../../lib/checkin-service';
import { currentUser, database, isAdmin, json, readJson, sameOrigin, validateTournament } from '../../../lib/tournament-service';
export const dynamic='force-dynamic';
export async function GET(request: Request) {
  await finalizeCheckin();
  const row=await database().prepare('SELECT data, revision FROM tournaments WHERE id = ?').bind('main').first<{data:string,revision:number}>();
  const user=await currentUser(request);
  return json({checkin:await checkinState(user?.id),user,tournament:row?JSON.parse(row.data):null,revision:row?.revision||0,admin:user?.role==='admin'});
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
        db.prepare('INSERT INTO tournament_history (id,data,archived_at) SELECT ?,data,? FROM tournaments WHERE id = ? AND revision = ?').bind(crypto.randomUUID(),Date.now(),'main',body.revision),update
      ]);
      row=batch[1].results[0]||null;
    }else row=await update.first<{revision:number}>();
  }
  if(!row)return json({error:'Another admin updated the tournament. The latest version has been loaded; please try your edit again.'},409);
  await db.prepare("UPDATE checkin_windows SET status='cancelled' WHERE id='main' AND status<>'open'").run();
  return json({tournament:data,revision:row.revision,admin:true});
}
