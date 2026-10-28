import * as admin from '../app/api/admin/route';
import * as tournament from '../app/api/tournament/route';
export default {async fetch(request: Request){
  const routes: Record<string,(request:Request)=>Promise<Response>> = new URL(request.url).pathname==='/api/admin'
    ? {GET:admin.GET,POST:admin.POST,DELETE:admin.DELETE}
    : {GET:tournament.GET,PUT:tournament.PUT};
  const handler=routes[request.method];return handler?handler(request):new Response('Method not allowed',{status:405});
}};
