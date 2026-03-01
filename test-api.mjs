import http from 'http';

const data = JSON.stringify({
  message: 'Pesquise sobre IA',
  sessionId: 'test-' + Date.now()
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
  timeout: 30000
};

console.log('🧪 Testando orquestração...\n');
console.log('📤 Enviando:', data);

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📥 Resposta recebida:');
    console.log('Status:', res.statusCode);
    try {
      const result = JSON.parse(responseData);
      console.log('\n✅ SUCESSO!');
      console.log('Agentes chamados:', result.agentsCalled?.join(', '));
      console.log('Tempo de execução:', result.executionTime + 'ms');
      console.log('Resumo:', result.consolidated?.summary);
      if (result.consolidated?.details?.ironman) {
        console.log('\n📊 Detalhes IronMan:');
        console.log(JSON.stringify(result.consolidated.details.ironman, null, 2));
      }
    } catch (e) {
      console.log('Resposta raw:', responseData);
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
