const https = require('https');
const http = require('http');

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://e-archive-pmn.vercel.app';

const urls = [
  { path: '/', name: 'Page d\'accueil' },
  { path: '/login', name: 'Page de connexion' },
  { path: '/register', name: 'Page d\'inscription' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/dashboard/documents', name: 'Documents' },
  { path: '/dashboard/upload', name: 'Upload' },
  { path: '/dashboard/messages', name: 'Messagerie' },
  { path: '/dashboard/shares', name: 'Partages' },
  { path: '/dashboard/users', name: 'Utilisateurs' },
];

function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, (res) => {
      if (res.statusCode === 200 || res.statusCode === 307 || res.statusCode === 308) {
        resolve({ success: true, status: res.statusCode });
      } else {
        resolve({ success: false, status: res.statusCode });
      }
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
  });
}

async function main() {
  if (process.env.VERCEL !== '1' && !process.env.CHECK_DEPLOY) {
    console.log('\n⏭️  Vérification du déploiement ignorée (pas sur Vercel)');
    console.log('💡 Pour forcer la vérification, utilisez: npm run check:deploy\n');
    process.exit(0);
  }

  console.log('\n🔍 Vérification du déploiement...\n');
  console.log(`📍 URL de base: ${BASE_URL}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const { path, name } of urls) {
    const fullUrl = `${BASE_URL}${path}`;
    process.stdout.write(`Vérification de ${name.padEnd(25)}... `);

    const result = await checkUrl(fullUrl);

    if (result.success) {
      console.log(`✅ OK (${result.status})`);
      successCount++;
    } else {
      console.log(`❌ ERREUR ${result.error || result.status}`);
      failCount++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Résultat : ${successCount}/${urls.length} pages accessibles`);
  console.log(`✅ Succès : ${successCount}`);
  console.log(`❌ Échecs : ${failCount}`);
  console.log(`${'='.repeat(50)}\n`);

  if (failCount > 0) {
    console.log('⚠️  Certaines pages ne sont pas accessibles.');
    console.log('Vérifiez les logs Vercel pour plus de détails.\n');
    process.exit(1);
  } else {
    console.log('🎉 Déploiement validé avec succès!\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Erreur lors de la vérification:', error);
  process.exit(1);
});
