// Teste rápido de orquestração
import { Orchestrator, MessageBroker } from './src/orchestration/index.js';

async function test() {
  console.log('🧪 Testando orquestração...\n');
  
  const broker = new MessageBroker('./test_data/messages.db');
  const orchestrator = new Orchestrator(broker);
  
  try {
    console.log('📤 Enviando: "Pesquise sobre IA"');
    const result = await orchestrator.orchestrate('Pesquise sobre IA', 'test-001');
    
    console.log('\n📥 Resultado:');
    console.log(`   Agentes chamados: ${result.agentsCalled.join(', ')}`);
    console.log(`   Tempo: ${result.executionTime}ms`);
    console.log(`   Resumo: ${result.consolidated.summary}`);
    
    console.log('\n✅ FUNCIONOU!');
  } catch (error) {
    console.error('❌ ERRO:', error);
  } finally {
    broker.close();
  }
}

test();
