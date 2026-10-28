import { env } from 'cloudflare:workers';
import { cookieToken, currentUser, database, derivePassword, equalHash, randomHex, hash, json, readJson, sameOrigin, sessionCookie } from '../../../lib/tournament-service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const user=await currentUser(request);return json({admin:user?.role==='admin',user});
}
export async function POST(request: Request) {
  if(!sameOrigin(request))return json({error:'This request must come from the tournament app.'},403);
  if(!env.ADMIN_PASSWORD)return json({error:'Admin sign-in is unavailable.'},503);
  const db=database(),now=Date.now();
  const key=await hash(request.headers.get('cf-connecting-ip')||'local-preview');
  const attempt=await db.prepare('INSERT INTO login_attempts (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at <= ? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at <= ? THEN ? ELSE expires_at END RETURNING count').bind(key,now+15*60*1000,now,now,now+15*60*1000).first<{count:number}>();
  if(attempt&&attempt.count>10)return json({error:'Too many attempts. Try again in 15 minutes.'},429,{'Retry-After':'900'});
  let password: unknown,username:unknown;
  try{const body=await readJson(request,2000);password=body.password;username=body.username;}catch{return json({error:'Enter your username and password.'},400);}
  const invalid=()=>json({error:'Incorrect username or password.'},401);
  if(typeof password!=='string'||password.length>200||typeof username!=='string'||username.length>32)return invalid();
  username=username.trim().toLowerCase();
  let accountId:string|null=null;
  if(username==='admin') {
    if(!equalHash(await hash(password),await hash(env.ADMIN_PASSWORD)))return invalid();
  } else {
    const account=await db.prepare('SELECT id,password_hash,salt,disabled FROM accounts WHERE username = ?').bind(username).first<{id:string;password_hash:string;salt:string;disabled:number}>();
    const supplied=await derivePassword(password,account?.salt||'missing-account-salt');
    if(!account||account.disabled||!equalHash(supplied,account.password_hash))return invalid();
    accountId=account.id;
  }
  const token=randomHex();
  await db.batch([
    db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
    db.prepare('INSERT INTO admin_sessions (token_hash,expires_at,account_id) VALUES (?,?,?)').bind(await hash(token),now+28800000,accountId),
    db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key),
  ]);
  return json({signedIn:true},200,{'Set-Cookie':sessionCookie(request,token)});
}
export async function DELETE(request: Request) {
  if(!sameOrigin(request))return json({error:'Invalid origin.'},403);
  const token=cookieToken(request);if(token)await database().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await hash(token)).run();
  return json({admin:false},200,{'Set-Cookie':sessionCookie(request,'',0)});
}
