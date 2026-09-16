const fs = require('fs');
const path = require('path');

const standalone = '.next/standalone';
if (!fs.existsSync(standalone)) {
  console.error('❌ .next/standalone introuvable. Lancez npm run build');
  process.exit(1);
}

if (fs.existsSync('.env')) {
  fs.copyFileSync('.env', path.join(standalone, '.env'));
  console.log('✅ .env copié');
}

const dbSrc = 'prisma/dev.db';
if (!fs.existsSync(dbSrc)) {
  console.error('❌ prisma/dev.db introuvable. Lancez prisma db push');
  process.exit(1);
}

const dbDestDir = path.join(standalone, 'prisma');
fs.mkdirSync(dbDestDir, { recursive: true });
fs.copyFileSync(dbSrc, path.join(dbDestDir, 'dev.db'));
console.log('✅ prisma/dev.db copié');
console.log('\n✅ Standalone prêt.');