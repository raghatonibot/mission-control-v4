import http from 'http';

const data = JSON.stringify({
  url: 'https://www.instagram.com/reel/DVPVKdkjOs6/',
  source: 'instagram'
});

const options = {
  hostname: 'localhost',
  port: 3004,
  path: '/api/stash',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 90000
};

console.log('🧪 Testando API /api/stash...\n');
console.log('URL: http://localhost:3004/api/stash');
console.log('Payload:', data);
console.log('\n⏳ Enviando requisição...\n');

const startTime = Date.now();

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Resposta em ${elapsed}ms (Status: ${res.statusCode})\n`);
    
    try {
      const result = JSON.parse(responseData);
      console.log('Resultado:');
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Resposta bruta:');
      console.log(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Erro:', error.message);
});

req.write(data);
req.end();
