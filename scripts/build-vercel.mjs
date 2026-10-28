import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('vercel-dist', { recursive: true });
await copyFile('frontend/index.html', 'vercel-dist/index.html');
console.log('Built Greenroom frontend for Vercel.');
