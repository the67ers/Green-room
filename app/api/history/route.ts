import { database, isAdmin, json } from '../../../lib/tournament-service';
import { Tournament } from '../../../lib/tournament.js';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  if(!await isAdmin(request))return json({error:'Admin access is required.'},403);
  const id=new URL(request.url).searchParams.get('id');
  if(id){const row=await database().prepare('SELECT id,data,archived_at FROM tournament_history WHERE id = ?').bind(id).first<{id:string;data:string;archived_at:number}>();return row?json({id:row.id,tournament:JSON.parse(row.data),archivedAt:row.archived_at}):json({error:'Tournament not found.'},404);}
  const rows=await database().prepare('SELECT id,data,archived_at FROM tournament_history ORDER BY archived_at DESC LIMIT 100').all<{id:string;data:string;archived_at:number}>();
  return json({tournaments:rows.results.map(row=>{const t=Tournament.restore(JSON.parse(row.data)),matches=t.rounds().flat(),played=matches.filter(m=>m.complete&&!m.automatic).length;return {id:row.id,title:t.title,format:t.format,players:t.players.length,played,total:t.totalMatches(),archivedAt:row.archived_at,complete:played===t.totalMatches()};})});
}
