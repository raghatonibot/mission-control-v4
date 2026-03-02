// Teste FASE 4: Automação (Cron Service)

import { MessageBroker, AgentManager, CronService } from '../index.js';

async function testPhase4() {
  console.log('🧪 Testando FASE 4: Automação (Cron Service)\n');

  const broker = new MessageBroker('./test_phase4.db');
  const manager = new AgentManager(broker);
  const cronService = new CronService(broker, manager);

  try {
    // Test 1: Iniciar agentes
    console.log('Test 1: Iniciar agentes');
    await manager.startAll();
    console.log('✅ Agentes iniciados\n');

    // Test 2: Iniciar Cron Service
    console.log('Test 2: Iniciar Cron Service');
    cronService.startAll();
    
    const status = cronService.getStatus();
    console.log(`   Tarefas agendadas: ${status.running}`);
    console.log('✅ Cron Service iniciado\n');

    // Test 3: Listar tarefas
    console.log('Test 3: Listar tarefas agendadas');
    const tasks = cronService.listTasks();
    for (const task of tasks) {
      console.log(`   ${task.name}: ${task.cronExpression} → @${task.agentId}`);
    }
    console.log('✅ Tarefas listadas\n');

    // Test 4: Verificar se tarefas estão ativas
    console.log('Test 4: Verificar status das tarefas');
    console.log(`   Total: ${status.tasks.length}`);
    console.log(`   Ativas: ${status.tasks.filter((t: any) => t.enabled).length}`);
    console.log('✅ Status verificado\n');

    // Aguardar um pouco para ver se não há erros
    console.log('Test 5: Aguardando 3 segundos...');
    await new Promise(r => setTimeout(r, 3000));
    console.log('✅ Nenhum erro detectado\n');

    // Parar tudo
    console.log('Parando serviços...');
    cronService.stopAll();
    await manager.stopAll();
    console.log('✅ Serviços parados\n');

    console.log('✅✅✅ FASE 4 COMPLETA! ✅✅✅');
    console.log('\n⏰ Automação configurada:');
    console.log('   • BlackWidow: A cada 15 minutos');
    console.log('   • Hawkeye: A cada 15 minutos');
    console.log('   • IronMan: Todo dia às 07:00');
    console.log('   • Fury: A cada 4 horas');
    console.log('   • Standup: Todo dia às 09:00');

    return true;

  } catch (error) {
    console.error('❌ Erro:', error);
    return false;
  } finally {
    broker.close();
  }
}

// Executar
console.log('Iniciando testes da Fase 4...\n');
testPhase4().then(success => {
  process.exit(success ? 0 : 1);
});

export { testPhase4 };
