import { currentUser, database, derivePassword, json, randomHex, readJson, sameOrigin } from '../../../lib/tournament-service';
export const dynamic='force-dynamic';
const projection='id,COALESCE(display_username,username) AS username,email,role,disabled,created_at';
export async function GET(request:Request){
  const user=await currentUser(request);if(user?.role!=='admin')return json({error:'Admin access is required.'},403);
  const rows=await database().prepare(`SELECT ${projection} FROM accounts ORDER BY username`).all();
  return json({accounts:[{id:'system-admin',username:'admin',role:'admin',disabled:0,protected:true},...rows.results],currentUserId:user.id});
}
async function mutate(request:Request,method:string){
  if(!sameOrigin(request))return json({error:'Invalid origin.'},403);
  const user=await currentUser(request);if(user?.role!=='admin')return json({error:'Admin access is required.'},403);
  const db=database();let body;
  try{body=await readJson(request,5000);}catch{return json({error:'Enter valid account details.'},400);}
  const passwordValid=(p:unknown)=>typeof p==='string'&&p.length>=8&&p.length<=200;
  if(method==='POST'){
    const displayUsername=typeof body.username==='string'?body.username.trim():'';
    const username=displayUsername.toLowerCase();
    if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username))return json({error:'Use 3–32 letters, numbers, dots, dashes, or underscores for the username.'},400);
    if(username==='admin')return json({error:'The original admin account is protected.'},409);
    if(!['viewer','admin'].includes(body.role)||!passwordValid(body.password))return json({error:'Choose a role and a password with 8–200 characters.'},400);
    if(body.role==='admin'&&!user.protected)return json({error:'Only the original admin can give admin access.'},403);
    const id=crypto.randomUUID(),salt=randomHex(),passwordHash=await derivePassword(body.password,salt);
    const result=await db.prepare('INSERT INTO accounts (id,username,display_username,role,disabled,password_hash,salt,created_at) VALUES (?,?,?,?,0,?,?,?) ON CONFLICT(username) DO NOTHING RETURNING id').bind(id,username,displayUsername,body.role,passwordHash,salt,Date.now()).first();
    return result?json({success:true},201):json({error:'That username is already in use.'},409);
  }
  if(typeof body.id!=='string')return json({error:'Choose an account.'},400);
  if(body.id==='system-admin')return json({error:'The original admin account is protected.'},403);
  const existing=await db.prepare('SELECT id,role FROM accounts WHERE id = ?').bind(body.id).first<{id:string;role:string}>();
  if(!existing)return json({error:'Account not found.'},404);
  if(body.id===user.id)return json({error:'Use another admin account to change your own account.'},400);
  if(!user.protected&&(body.role!==undefined||existing.role==='admin'))return json({error:'Only the original admin can change admin permissions or manage admin accounts.'},403);
  if(method==='DELETE'){
    await db.batch([db.prepare('DELETE FROM admin_sessions WHERE account_id = ?').bind(body.id),db.prepare('DELETE FROM accounts WHERE id = ?').bind(body.id)]);return json({success:true});
  }
  const changes:string[]=[],values:(string|number)[]=[];
  if(body.username!==undefined){
    const display=typeof body.username==='string'?body.username.trim():'';const normalized=display.toLowerCase();
    if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(normalized))return json({error:'Use a valid username with 3–32 characters.'},400);
    if(normalized==='admin')return json({error:'The original admin username is protected.'},409);
    const duplicate=await db.prepare('SELECT id FROM accounts WHERE username = ? AND id <> ?').bind(normalized,body.id).first();
    if(duplicate)return json({error:'That username is already in use.'},409);
    changes.push('username = ?','display_username = ?');values.push(normalized,display);
  }
  if(body.role!==undefined){if(!['admin','viewer'].includes(body.role))return json({error:'Choose a valid role.'},400);changes.push('role = ?');values.push(body.role);}
  if(body.disabled!==undefined){if(typeof body.disabled!=='boolean')return json({error:'Choose a valid account status.'},400);changes.push('disabled = ?');values.push(body.disabled?1:0);}
  if(body.password!==undefined){if(!passwordValid(body.password))return json({error:'Passwords must contain 8–200 characters.'},400);const salt=randomHex();changes.push('password_hash = ?','salt = ?');values.push(await derivePassword(body.password,salt),salt);}
  if(!changes.length)return json({error:'Choose a change to make.'},400);
  await db.batch([db.prepare(`UPDATE accounts SET ${changes.join(',')} WHERE id = ?`).bind(...values,body.id),db.prepare('DELETE FROM admin_sessions WHERE account_id = ?').bind(body.id)]);
  return json({success:true});
}
export const POST=(request:Request)=>mutate(request,'POST');
export const PATCH=(request:Request)=>mutate(request,'PATCH');
export const DELETE=(request:Request)=>mutate(request,'DELETE');
