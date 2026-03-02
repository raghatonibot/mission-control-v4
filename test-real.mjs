import http from 'http';

const data = JSON.stringify({
  message: 'Pesquise sobre IA no Reddit',
  sessionId: 'test-real-' + Date.now()
});

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/orchestration/orchestrate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 60000
};

console.log('🧪 Testando com DADOS REAIS...\n');
console.log('📤 Enviando:', data);
console.log('⏳ Isso pode levar 30-60 segundos...\n');

const startTime = Date.now();

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    const elapsed = Date.now() - startTime;
    console.log(`\n📥 Resposta em ${elapsed}ms:`);
    console.log('Status:', res.statusCode);
    
    try {
      const result = JSON.parse(responseData);
      console.log('\n✅ SUCESSO!');
      console.log('Agentes:', result.agentsCalled?.join(', '));
      
      // Verificar se tem dados reais
      const reddit = result.consolidated?.details?.ironman?.data?.reddit;
      const twitter = result.consolidated?.details?.ironman?.data?.twitter;
      
      if (reddit) {
        console.log('\n📊 REDDIT:');
        console.log('  Total posts:', reddit.total_posts);
        console.log('  Subreddits:', reddit.subreddits?.join(', '));
        console.log('  Note:', reddit.note);
      }
      
      if (twitter) {
        console.log('\n📊 TWITTER:');
        console.log('  Total tweets:', twitter.total_tweets);
        console.log('  Note:', twitter.note);
      }
      
    } catch (e) {
      console.log('\nResposta raw:', responseData.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ ERRO:', error.message);
});

req.on('timeout', () => {
  console.error('\n⏱️ TIMEOUT');
  req.destroy();
});

req.write(data);
req.end();
