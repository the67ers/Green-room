import { env } from 'cloudflare:workers';
import { Tournament } from './tournament.js';

export function database() {
  if (!env.DB) throw new Error('Tournament storage is unavailable.');
  return env.DB;
}
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
export function sameOrigin(request: Request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}
export async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
}
export function cookieToken(request: Request) {
  return request.headers.get('Cookie')?.match(/(?:^|;\s*)gr_admin=([a-f0-9]{64})(?:;|$)/)?.[1] || '';
}
export function sessionCookie(request: Request, value: string, maxAge = 28800) {
  return `gr_admin=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export type AppUser = {id:string;username:string;role:'admin'|'viewer';protected:boolean};
export async function currentUser(request: Request): Promise<AppUser|null> {
  const token=cookieToken(request);if(!token)return null;
  const session=await database().prepare('SELECT account_id FROM admin_sessions WHERE token_hash = ? AND expires_at > ?').bind(await hash(token),Date.now()).first<{account_id:string|null}>();
  if(!session)return null;
  if(!session.account_id)return {id:'system-admin',username:'admin',role:'admin',protected:true};
  const user=await database().prepare('SELECT id,COALESCE(display_username,username) AS username,role FROM accounts WHERE id = ? AND disabled = 0').bind(session.account_id).first<{id:string;username:string;role:'admin'|'viewer'}>();
  return user?{...user,protected:false}:null;
}
export async function isAdmin(request: Request) {return (await currentUser(request))?.role==='admin';}
export async function derivePassword(password:string,salt:string) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256);
  return Array.from(new Uint8Array(bits),n=>n.toString(16).padStart(2,'0')).join('');
}
export function equalHash(a:string,b:string) {if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function randomHex(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
export async function readJson(request: Request, limit = 200000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Use JSON for this request.');
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request body is missing.');
  const chunks: Uint8Array[] = [];let size=0;
  while (true) {const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Request is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function validateTournament(data: unknown) {
  return Tournament.restore(data).data();
}
