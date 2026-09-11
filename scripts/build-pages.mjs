import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const astroOutput = join(projectRoot, 'dist');
const pagesOutput = join(projectRoot, 'dist-pages');

rmSync(pagesOutput, { recursive: true, force: true });
mkdirSync(pagesOutput, { recursive: true });
cpSync(join(astroOutput, 'client'), pagesOutput, { recursive: true });
cpSync(join(astroOutput, 'server'), join(pagesOutput, '_server'), { recursive: true });
rmSync(join(pagesOutput, '_server', 'wrangler.json'), { force: true });
// The adapter redirects `wrangler deploy` to its Workers config. This project
// intentionally targets Pages advanced mode, so remove that generated redirect.
rmSync(join(projectRoot, '.wrangler', 'deploy', 'config.json'), { force: true });
writeFileSync(
  join(pagesOutput, '_worker.js'),
  `import application from './_server/entry.mjs';

function canonicalPath(pathname) {
  let decoded = pathname;
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.replaceAll('\\\\', '/').replace(/\\/{2,}/g, '/').toLowerCase();
}

export default {
  fetch(request, env, context) {
    const pathname = canonicalPath(new URL(request.url).pathname);
    if (pathname === '/_worker.js' || pathname === '/_server' || pathname.startsWith('/_server/')) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        },
      });
    }
    return application.fetch(request, env, context);
  },
};
`,
  'utf8',
);
writeFileSync(
  join(pagesOutput, '.assetsignore'),
  ['/wrangler.json', '/.dev.vars', '/_worker.js', '/_server/'].join('\n') + '\n',
  'utf8',
);

console.log('Cloudflare Pages SSR bundle assembled in dist-pages/.');
