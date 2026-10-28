declare namespace Cloudflare {
  interface Env { DB?: D1Database; BUCKET?: R2Bucket; ADMIN_PASSWORD?: string; }
}
declare module '*.html?raw' { const html: string; export default html; }
