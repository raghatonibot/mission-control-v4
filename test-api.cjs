// Teste via API REST
const http = require('http');

const data = JSON.stringify({
  message: "Pesquise sobre IA",
  sessionId: "test-" + Date.now()
});

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/orchestration/orchestrate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🧪 Testando via API...\n');

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Resposta:');
    try {
      const result = JSON.parse(responseData);
      console.log(JSON.stringify(result, null, 2));
      console.log('\n✅ FUNCIONOU!');
    } catch (e) {
      console.log(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro:', error.message);
});

req.write(data);
req.end();
