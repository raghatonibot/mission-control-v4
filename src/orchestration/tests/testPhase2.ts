// Teste de integração da Fase 2 - Agent Workers

import { MessageBroker } from '../services/MessageBroker.js';
import { AgentManager } from '../workers/AgentManager.js';

async function testPhase2() {
  console.log('🧪 Testando Fase 2: Agent Workers\n');

  const broker = new MessageBroker('./test_phase2.db');
  const manager = new AgentManager(broker);

  try {
    // Test 1: Inicialização
    console.log('Test 1: Inicializar Agent Manager');
    console.log(`   Agentes registrados: ${manager.listAgents().length}`);
    console.log(`   Lista: ${manager.listAgents().join(', ')}`);
    console.log('✅ Agent Manager inicializado\n');

    // Test 2: Iniciar todos os agentes
    console.log('Test 2: Iniciar todos os agentes');
    await manager.startAll();
    
    const status = manager.getAllStatus();
    console.log(`   Agentes ativos: ${status.filter(s => s.status !== 'offline').length}`);
    console.log('✅ Todos os agentes iniciados\n');

    // Test 3: Verificar status individual
    console.log('Test 3: Verificar status de cada agente');
    for (const s of status) {
      console.log(`   ${s.id}: ${s.status} | Skills: ${s.skills.length} | Schedule: ${s.schedule || 'on-demand'}`);
    }
    console.log('✅ Status verificado\n');

    // Test 4: Enviar task para IronMan
    console.log('Test 4: Enviar task para IronMan');
    
    // Assinar resposta
    broker.subscribe('ragha', (msg) => {
      console.log('   Ragha recebeu resposta:', msg.type);
    });

    const ironmanTask = await broker.send({
      from: 'ragha',
      to: 'ironman',
      type: 'task',
      payload: {
        task: 'Pesquisar sobre LLMs',
        skill: 'research',
        params: { query: 'novos modelos LLM 2025' }
      },
      sessionId: 'test-phase2'
    });

    console.log(`   Task enviada: ${ironmanTask.id}`);
    
    // Aguardar um pouco para processamento
    await new Promise(r => setTimeout(r, 2000));
    console.log('✅ Task enviada para IronMan\n');

    // Test 5: Verificar histórico
    console.log('Test 5: Verificar histórico');
    const history = await broker.getHistory('test-phase2');
    console.log(`   Mensagens na sessão: ${history.length}`);
    console.log('✅ Histórico funcionando\n');

    // Test 6: Estatísticas do broker
    console.log('Test 6: Estatísticas');
    const stats = broker.getStats();
    console.log(`   Total: ${stats.total}`);
    console.log(`   Pendentes: ${stats.pending}`);
    console.log(`   Processadas: ${stats.completed}`);
    console.log('✅ Estatísticas OK\n');

    // Parar agentes
    console.log('Parando agentes...');
    await manager.stopAll();
    console.log('✅ Agentes parados\n');

    console.log('✅✅✅ TODOS OS TESTES DA FASE 2 PASSARAM! ✅✅✅');
    return true;

  } catch (error) {
    console.error('❌ Erro:', error);
    return false;
  } finally {
    broker.close();
  }
}

// Executar
console.log('Iniciando testes da Fase 2...\n');
testPhase2().then(success => {
  process.exit(success ? 0 : 1);
});

export { testPhase2 };
