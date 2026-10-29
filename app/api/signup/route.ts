import {database,derivePassword,hash,json,randomHex,readJson,sameOrigin,sessionCookie} from '../../../lib/tournament-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Invalid origin.'},403);
 const db=database(),now=Date.now(),key='signup:'+await hash(request.headers.get('cf-connecting-ip')||'preview');
 const attempt=await db.prepare('INSERT INTO login_attempts (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING count').bind(key,now+3600000,now,now,now+3600000).first<{count:number}>();
 if(attempt&&attempt.count>120)return json({error:'Too many sign-up attempts. Please try again later.'},429,{'Retry-After':'3600'});
 let body;try{body=await readJson(request,3000);}catch{return json({error:'Enter your username, email, and password.'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Enter valid account details.'},400);
 const display=typeof body.username==='string'?body.username.trim():'',username=display.toLowerCase(),email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username))return json({error:'Use 3–32 letters, numbers, dots, dashes, or underscores for your username.'},400);
 if(username==='admin')return json({error:'That username is reserved.'},409);
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Enter a valid email address.'},400);
 if(typeof body.password!=='string'||body.password.length<8||body.password.length>200)return json({error:'Use a password with 8–200 characters.'},400);
 const id=crypto.randomUUID(),salt=randomHex(),passwordHash=await derivePassword(body.password,salt),token=randomHex();
 const result=await db.batch([
  db.prepare("INSERT INTO accounts (id,username,display_username,email,role,disabled,password_hash,salt,created_at) VALUES (?,?,?,?,'viewer',0,?,?,?) ON CONFLICT DO NOTHING RETURNING id").bind(id,username,display,email,passwordHash,salt,now),
  db.prepare('INSERT INTO admin_sessions (token_hash,expires_at,account_id) SELECT ?,?,id FROM accounts WHERE id=?').bind(await hash(token),now+28800000,id),
 ]);
 if(!result[0].results.length)return json({error:'That username or email is already in use. Try signing in instead.'},409);
 return json({signedIn:true},201,{'Set-Cookie':sessionCookie(request,token)});
}
