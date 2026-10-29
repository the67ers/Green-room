import * as checkin from '../app/api/checkin/route';
import * as signup from '../app/api/signup/route';
import * as history from '../app/api/history/route';
import * as admin from '../app/api/admin/route';
import * as accounts from '../app/api/accounts/route';
import * as tournament from '../app/api/tournament/route';
export default {async fetch(request: Request){
  if(new URL(request.url).pathname==='/api/signup')return request.method==='POST'?signup.POST(request):new Response('Method not allowed',{status:405});
  const routes: Record<string,(request:Request)=>Promise<Response>> = new URL(request.url).pathname==='/api/admin'
    ? {GET:admin.GET,POST:admin.POST,DELETE:admin.DELETE}
    : new URL(request.url).pathname==='/api/accounts'?{GET:accounts.GET,POST:accounts.POST,PATCH:accounts.PATCH,DELETE:accounts.DELETE}:new URL(request.url).pathname==='/api/checkin'?{POST:checkin.POST,PATCH:checkin.PATCH,DELETE:checkin.DELETE}:new URL(request.url).pathname==='/api/history'?{GET:history.GET}:{GET:tournament.GET,PUT:tournament.PUT,DELETE:tournament.DELETE};
  if(new URL(request.url).pathname==='/api/tournament'&&request.method==='POST')return tournament.POST(request);
  const handler=routes[request.method];return handler?handler(request):new Response('Method not allowed',{status:405});
}};
