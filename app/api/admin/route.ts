import { env } from 'cloudflare:workers';
import { cookieToken, database, hash, isAdmin, json, readJson, sameOrigin, sessionCookie } from '../../../lib/tournament-service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return json({admin:await isAdmin(request)});
}
export async function POST(request: Request) {
  if(!sameOrigin(request))return json({error:'This request must come from the tournament app.'},403);
  if(!env.ADMIN_PASSWORD)return json({error:'Admin sign-in is unavailable.'},503);
  const db=database(),now=Date.now();
  const key=await hash(request.headers.get('cf-connecting-ip')||'local-preview');
  const attempt=await db.prepare('INSERT INTO login_attempts (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at <= ? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at <= ? THEN ? ELSE expires_at END RETURNING count').bind(key,now+15*60*1000,now,now,now+15*60*1000).first<{count:number}>();
  if(attempt&&attempt.count>10)return json({error:'Too many attempts. Try again in 15 minutes.'},429,{'Retry-After':'900'});
  let password: unknown;
  try{password=(await readJson(request,2000)).password;}catch{return json({error:'Enter your admin password.'},400);}
  if(typeof password!=='string'||password.length>200)return json({error:'Incorrect admin password.'},401);
  const a=await hash(password),b=await hash(env.ADMIN_PASSWORD);let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  if(diff)return json({error:'Incorrect admin password.'},401);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
  await db.batch([
    db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
    db.prepare('INSERT INTO admin_sessions (token_hash,expires_at) VALUES (?,?)').bind(await hash(token),now+28800000),
    db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key),
  ]);
  return json({admin:true},200,{'Set-Cookie':sessionCookie(request,token)});
}
export async function DELETE(request: Request) {
  if(!sameOrigin(request))return json({error:'Invalid origin.'},403);
  const token=cookieToken(request);if(token)await database().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await hash(token)).run();
  return json({admin:false},200,{'Set-Cookie':sessionCookie(request,'',0)});
}
