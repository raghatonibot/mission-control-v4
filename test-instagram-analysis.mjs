import http from 'http';

const instagramUrl = 'https://www.instagram.com/reel/DVPVKdkjOs6/';

const data = JSON.stringify({
  message: `Analise este Instagram: ${instagramUrl}`,
  sessionId: 'analysis-' + Date.now()
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
  timeout: 90000
};

console.log('🎬 Extraindo vídeo do Instagram...\n');
console.log('URL:', instagramUrl);
console.log('Usando sessão: @pretododia');
console.log('⏳ Extraindo conteúdo completo...\n');

const startTime = Date.now();

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Análise completa em ${elapsed}ms\n`);
    
    try {
      const result = JSON.parse(responseData);
      
      if (result.consolidated?.details?.blackwidow?.data?.instagram) {
        const ig = result.consolidated.details.blackwidow.data.instagram;
        console.log('📱 RESULTADO DO INSTAGRAM:\n');
        console.log(JSON.stringify(ig, null, 2));
      } else {
        console.log('📋 Resultado completo:');
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (e) {
      console.log('Resposta:', responseData.substring(0, 2000));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro:', error.message);
});

req.write(data);
req.end();
