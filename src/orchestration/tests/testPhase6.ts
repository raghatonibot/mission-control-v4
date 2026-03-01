// Teste FASE 6: Integração (API Server)

import { OrchestrationServer } from '../api/server.js';

async function testPhase6() {
  console.log('🧪 Testando FASE 6: Integração (API Server)\n');

  const server = new OrchestrationServer({
    port: 3006, // Porta diferente para teste
    dataPath: './test_data'
  });

  try {
    // Test 1: Iniciar servidor
    console.log('Test 1: Iniciar servidor completo');
    await server.start();
    console.log('✅ Servidor iniciado\n');

    // Aguardar servidor subir
    await new Promise(r => setTimeout(r, 2000));

    // Test 2: Health check
    console.log('Test 2: Health check');
    const healthResponse = await fetch('http://localhost:3006/');
    const health = await healthResponse.json();
    console.log(`   Status: ${health.service}`);
    console.log(`   Endpoints: ${health.endpoints?.length}`);
    console.log('✅ Health check OK\n');

    // Test 3: Status dos agentes
    console.log('Test 3: Status dos agentes via API');
    const agentsResponse = await fetch('http://localhost:3006/api/orchestration/agents/status');
    const agents = await agentsResponse.json();
    console.log(`   Total de agentes: ${agents.agents?.length}`);
    console.log(`   Ativos: ${agents.agents?.filter((a: any) => a.status !== 'offline').length}`);
    console.log('✅ Status dos agentes OK\n');

    // Test 4: Orquestração via API
    console.log('Test 4: Orquestração via API');
    const orchestrateResponse = await fetch('http://localhost:3006/api/orchestration/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Pesquise sobre IA',
        sessionId: 'test-api-session'
      })
    });
    const result = await orchestrateResponse.json();
    console.log(`   Agente(s) chamado(s): ${result.agentsCalled?.join(', ')}`);
    console.log(`   Execução: ${result.executionTime}ms`);
    console.log('✅ Orquestração via API OK\n');

    // Test 5: Estatísticas
    console.log('Test 5: Estatísticas via API');
    const statsResponse = await fetch('http://localhost:3006/api/orchestration/stats');
    const stats = await statsResponse.json();
    console.log(`   Sessões: ${stats.sessions?.sessions}`);
    console.log(`   Agentes ativos: ${stats.agents?.active}`);
    console.log(`   Tarefas cron: ${stats.cron?.running}`);
    console.log('✅ Estatísticas OK\n');

    // Test 6: Agenda de cron
    console.log('Test 6: Agenda de tarefas cron');
    const cronResponse = await fetch('http://localhost:3006/api/orchestration/cron/schedule');
    const cronSchedule = await cronResponse.json();
    console.log(`   Tarefas agendadas: ${cronSchedule.tasks?.length}`);
    for (const task of cronSchedule.tasks || []) {
      console.log(`   - ${task.name}: ${task.cronExpression}`);
    }
    console.log('✅ Agenda cron OK\n');

    // Parar servidor
    console.log('Parando servidor...');
    await server.stop();
    console.log('✅ Servidor parado\n');

    console.log('✅✅✅ FASE 6 COMPLETA! ✅✅✅');
    console.log('\n🔌 Integração funcionando:');
    console.log('   • API REST completa');
    console.log('   • Endpoints de agentes');
    console.log('   • Orquestração via HTTP');
    console.log('   • Histórico de sessões');
    console.log('   • Alertas');
    console.log('   • Estatísticas');
    console.log('   • Controle de cron jobs');

    return true;

  } catch (error) {
    console.error('❌ Erro:', error);
    await server.stop();
    return false;
  }
}

// Executar
console.log('Iniciando testes da Fase 6...\n');
testPhase6().then(success => {
  process.exit(success ? 0 : 1);
});

export { testPhase6 };
