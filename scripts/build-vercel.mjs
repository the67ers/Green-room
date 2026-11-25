import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('vercel-dist', { recursive: true });
await copyFile('frontend/index.html', 'vercel-dist/index.html');
await cp('public', 'vercel-dist', { recursive: true });
console.log('Built Greenroom frontend for Vercel.');
