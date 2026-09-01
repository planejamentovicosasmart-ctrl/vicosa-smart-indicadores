import '../src/lib/env.js';
import { prisma } from '../src/lib/prisma.js';
import { runResearchBatch } from '../src/services/agent.js';

try {
  const result = await runResearchBatch({ mode: 'scheduled' });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
