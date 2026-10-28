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
export async function isAdmin(request: Request) {
  const token = cookieToken(request);
  if (!token) return false;
  const found = await database().prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?').bind(await hash(token), Date.now()).first();
  return !!found;
}
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
