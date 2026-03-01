// Teste da Fase 1: Message Broker

import { MessageBroker } from '../services/MessageBroker.js';
import type { AgentId, TaskRequest } from '../types/AgentMessage.js';

async function testMessageBroker() {
  console.log('🧪 Testando Message Broker...\n');

  const broker = new MessageBroker('./test_queue.db');

  try {
    // Test 1: Enviar e receber mensagem simples
    console.log('Test 1: Enviar mensagem simples');
    const message = await broker.send({
      from: 'ragha',
      to: 'ironman',
      type: 'task',
      payload: { task: 'pesquisar sobre LLMs' },
      sessionId: 'test-session-1'
    });
    console.log('✅ Mensagem enviada:', message.id);

    // Test 2: Receber mensagem
    const received = await broker.receive('ironman');
    console.log('✅ Mensagens recebidas:', received.length);
    console.log('   Conteúdo:', received[0]?.payload);

    // Test 3: Marcar como processada
    await broker['queue'].mark(message.id, 'completed');
    console.log('✅ Mensagem marcada como processada');

    // Test 4: Enviar task e aguardar resposta (simulado)
    console.log('\nTest 4: RPC - Send and Wait');
    
    // Assinar como se fosse o agente IronMan
    const unsubscribe = broker.subscribe('ironman', async (msg) => {
      console.log('   IronMan recebeu:', msg.payload.task);
      
      // Simular processamento
      await new Promise(r => setTimeout(r, 100));
      
      // Responder
      await broker.respond(
        'ragha' as AgentId,
        msg.correlationId!,
        {
          success: true,
          data: { result: 'Pesquisa completa! Encontrado: 5 LLMs novas' },
          agentId: 'ironman'
        },
        msg.sessionId
      );
      console.log('   IronMan respondeu');
    });

    // Enviar task e aguardar
    const response = await broker.sendTaskAndWait(
      'ragha',
      'ironman',
      {
        task: 'Pesquisar LLMs',
        priority: 'high',
        skill: 'reddit-scraper',
        params: { subreddit: 'artificial' },
        sessionId: 'test-session-2'
      },
      5000 // 5s timeout
    );

    console.log('✅ Ragha recebeu resposta:', response);

    unsubscribe();

    // Test 5: Estatísticas
    console.log('\nTest 5: Estatísticas');
    const stats = broker.getStats();
    console.log('   Total mensagens:', stats.total);
    console.log('   Pendentes:', stats.pending);
    console.log('   Processadas:', stats.completed);

    // Test 6: Histórico
    console.log('\nTest 6: Histórico da sessão');
    const history = await broker.getHistory('test-session-2');
    console.log('   Mensagens na sessão:', history.length);

    console.log('\n✅ Todos os testes passaram!');
    return true;

  } catch (error) {
    console.error('❌ Erro:', error);
    return false;
  } finally {
    broker.close();
  }
}

// Executar
console.log('Iniciando testes...\n');
testMessageBroker().then(success => {
  process.exit(success ? 0 : 1);
});

export { testMessageBroker };
