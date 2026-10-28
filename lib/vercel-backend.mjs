export async function proxyBackend(request, endpoint) {
  const allowed = {admin:['GET','POST','DELETE'],tournament:['GET','PUT','DELETE'],accounts:['GET','POST','PATCH','DELETE'],history:['GET'],checkin:['POST','DELETE']}[endpoint] || [];
  if (!allowed.includes(request.method)) return Response.json({error:'Method not allowed.'},{status:405});
  const origin = new URL(request.url).origin;
  if (request.method !== 'GET' && request.headers.get('origin') !== origin) {
    return Response.json({error:'Invalid origin.'},{status:403});
  }
  const backend = process.env.GREENROOM_BACKEND_URL;
  const token = process.env.GREENROOM_BACKEND_TOKEN;
  if (!backend || !token) return Response.json({error:'Tournament backend is not configured.'},{status:503});
  try {
    const target = new URL('/api/' + endpoint, backend);
    if(endpoint==='history')target.search=new URL(request.url).search;
    if (target.protocol !== 'https:') throw Error('Invalid backend configuration');
    const headers = new Headers({'OAI-Sites-Authorization':'Bearer '+token});
    // Forward only the application session, never platform login cookies.
    const session = request.headers.get('cookie')?.match(/(?:^|;\s*)(gr_admin=[a-f0-9]{64})(?:;|$)/)?.[1];
    if (session) headers.set('cookie', session);
    let body;
    if (request.method !== 'GET') {
      if (request.method !== 'DELETE' && !request.headers.get('content-type')?.startsWith('application/json')) return Response.json({error:'JSON required.'},{status:400});
      body = await request.text();
      if (new TextEncoder().encode(body).length > 200000) return Response.json({error:'Request too large.'},{status:413});
      if (endpoint === 'admin' && request.method === 'POST') {
        let login;
        try { login = JSON.parse(body); } catch { return Response.json({error:'Enter your username and password.'},{status:400}); }
        if (typeof login.username !== 'string' || !login.username.trim()) return Response.json({error:'Incorrect username or password.'},{status:401});
      }
      headers.set('content-type','application/json');
      headers.set('origin',target.origin);
    }
    const upstream = await fetch(target, {method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(20000)});
    if (!upstream.headers.get('content-type')?.includes('application/json')) return Response.json({error:'Tournament backend is temporarily unavailable.'},{status:502});
    const responseHeaders = new Headers({'content-type':'application/json','cache-control':'no-store'});
    for (const cookie of upstream.headers.getSetCookie()) {
      if (/^gr_admin=/.test(cookie)) responseHeaders.append('set-cookie',cookie);
    }
    return new Response(await upstream.text(),{status:upstream.status,headers:responseHeaders});
  } catch {
    return Response.json({error:'Tournament backend is temporarily unavailable.'},{status:502});
  }
}
