import http from 'http';

// Testar extração de Instagram
const instagramUrl = 'https://www.instagram.com/reel/DVPVKdkjOs6/';

const data = JSON.stringify({
  message: `Analise este Instagram: ${instagramUrl}`,
  sessionId: 'test-instagram-' + Date.now()
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

console.log('🧪 Testando Instagram...\n');
console.log('📸 URL:', instagramUrl);
console.log('⏳ Testando BlackWidow...\n');

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📥 Resposta:');
    try {
      const result = JSON.parse(responseData);
      console.log('Status:', res.statusCode);
      console.log('Agentes:', result.agentsCalled?.join(', '));
      
      // Ver resultado do Instagram
      const bw = result.consolidated?.details?.blackwidow;
      if (bw?.data?.instagram) {
        console.log('\n📱 INSTAGRAM:');
        console.log(JSON.stringify(bw.data.instagram, null, 2));
      }
    } catch (e) {
      console.log('Raw:', responseData.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ ERRO:', error.message);
});

req.write(data);
req.end();
