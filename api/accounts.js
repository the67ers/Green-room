import { proxyBackend } from '../lib/vercel-backend.mjs';
export default { fetch(request) { return proxyBackend(request, 'accounts'); } };
