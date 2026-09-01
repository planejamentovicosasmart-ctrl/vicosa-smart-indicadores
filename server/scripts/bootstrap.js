import '../src/lib/env.js';
import { execFileSync } from 'node:child_process';

function runNpx(args) {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    shell: false,
  });
}

console.log('[bootstrap] Sincronizando schema do PostgreSQL...');
runNpx(['prisma', 'db', 'push']);

console.log('[bootstrap] Sincronizando catálogo e dados fornecidos...');
execFileSync(process.execPath, ['prisma/seed.js'], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
});

console.log('[bootstrap] Banco pronto.');
