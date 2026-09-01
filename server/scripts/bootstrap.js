import '../src/lib/env.js';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

function runNpx(args) {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    shell: false,
  });
}

console.log('[bootstrap] Sincronizando schema do PostgreSQL...');
runNpx(['prisma', 'db', 'push']);

const prisma = new PrismaClient();
try {
  const indicatorCount = await prisma.indicator.count();
  if (indicatorCount === 0) {
    console.log('[bootstrap] Banco vazio. Importando base inicial...');
    execFileSync(process.execPath, ['prisma/seed.js'], {
      cwd: new URL('..', import.meta.url),
      stdio: 'inherit',
    });
  } else {
    console.log(`[bootstrap] Banco já inicializado (${indicatorCount} indicadores). Seed ignorado.`);
  }
} finally {
  await prisma.$disconnect();
}

console.log('[bootstrap] Banco pronto.');
