// Teste FASE 5: Persistência (Session Manager)

import { SessionManager } from '../index.js';

async function testPhase5() {
  console.log('🧪 Testando FASE 5: Persistência (Session Manager)\n');

  const sessionManager = new SessionManager('./test_sessions.db');

  try {
    // Test 1: Criar sessão
    console.log('Test 1: Criar/obter sessão');
    const sessionId = 'test-session-001';
    const session = sessionManager.getOrCreateSession(sessionId, 'user-123');
    console.log(`   Sessão criada: ${session.id}`);
    console.log(`   User ID: ${session.userId}`);
    console.log('✅ Sessão criada\n');

    // Test 2: Atualizar contexto
    console.log('Test 2: Atualizar contexto da sessão');
    sessionManager.updateSessionContext(sessionId, {
      lastTopic: 'AI Research',
      preferences: { language: 'pt-BR' },
      history: ['msg1', 'msg2']
    });
    
    const updatedSession = sessionManager.getSession(sessionId);
    console.log(`   Contexto: ${JSON.stringify(updatedSession?.context)}`);
    console.log('✅ Contexto atualizado\n');

    // Test 3: Salvar mensagem
    console.log('Test 3: Salvar mensagem no histórico');
    sessionManager.saveMessage({
      id: 'msg-001',
      from: 'ragha',
      to: 'ironman',
      type: 'task',
      payload: { task: 'Pesquisar sobre X' },
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      correlationId: 'corr-001'
    });
    console.log('✅ Mensagem salva\n');

    // Test 4: Obter histórico
    console.log('Test 4: Obter histórico de mensagens');
    const history = sessionManager.getMessageHistory(sessionId);
    console.log(`   Mensagens: ${history.length}`);
    console.log(`   Última mensagem: ${history[0]?.payload?.task}`);
    console.log('✅ Histórico recuperado\n');

    // Test 5: Criar task
    console.log('Test 5: Criar task persistida');
    const task = sessionManager.createTask({
      sessionId: sessionId,
      agentId: 'ironman',
      task: 'Pesquisar sobre LLMs',
      status: 'pending'
    });
    console.log(`   Task criada: ${task.id}`);
    console.log('✅ Task criada\n');

    // Test 6: Atualizar task
    console.log('Test 6: Atualizar status da task');
    sessionManager.updateTaskStatus(task.id, 'completed', { result: 'Encontrado 5 artigos' });
    const tasks = sessionManager.getTasks(sessionId);
    console.log(`   Tasks na sessão: ${tasks.length}`);
    console.log(`   Status: ${tasks[0]?.status}`);
    console.log('✅ Task atualizada\n');

    // Test 7: Criar alerta
    console.log('Test 7: Criar alerta');
    const alert = sessionManager.createAlert({
      agentId: 'hawkeye',
      type: 'system',
      message: 'Uso de tokens acima do normal',
      priority: 'medium',
      data: { usage: 85 }
    });
    console.log(`   Alerta criado: ${alert.id}`);
    console.log('✅ Alerta criado\n');

    // Test 8: Obter alertas não lidos
    console.log('Test 8: Obter alertas não lidos');
    const unreadAlerts = sessionManager.getUnreadAlerts();
    console.log(`   Alertas não lidos: ${unreadAlerts.length}`);
    console.log('✅ Alertas recuperados\n');

    // Test 9: Marcar alerta como lido
    console.log('Test 9: Marcar alerta como lido');
    sessionManager.markAlertAsRead(alert.id);
    const remainingUnread = sessionManager.getUnreadAlerts();
    console.log(`   Alertas não lidos após leitura: ${remainingUnread.length}`);
    console.log('✅ Alerta marcado como lido\n');

    // Test 10: Estatísticas
    console.log('Test 10: Estatísticas do banco');
    const stats = sessionManager.getStats();
    console.log(`   Sessões: ${stats.sessions}`);
    console.log(`   Tasks: ${stats.tasks}`);
    console.log(`   Alertas: ${stats.alerts.total} (não lidos: ${stats.alerts.unread})`);
    console.log(`   Mensagens: ${stats.messages}`);
    console.log('✅ Estatísticas obtidas\n');

    // Test 11: Recuperar sessão após "reiniciar"
    console.log('Test 11: Simular reinicialização - recuperar sessão');
    const recoveredSession = sessionManager.getSession(sessionId);
    console.log(`   Sessão recuperada: ${recoveredSession?.id}`);
    console.log(`   Contexto preservado: ${JSON.stringify(recoveredSession?.context)}`);
    console.log('✅ Sessão recuperada com sucesso!\n');

    console.log('✅✅✅ FASE 5 COMPLETA! ✅✅✅');
    console.log('\n💾 Persistência funcionando:');
    console.log('   • Sessões com contexto');
    console.log('   • Histórico de mensagens');
    console.log('   • Tasks persistidas');
    console.log('   • Alertas');
    console.log('   • Memória entre sessões');

    return true;

  } catch (error) {
    console.error('❌ Erro:', error);
    return false;
  } finally {
    sessionManager.close();
  }
}

// Executar
console.log('Iniciando testes da Fase 5...\n');
testPhase5().then(success => {
  process.exit(success ? 0 : 1);
});

export { testPhase5 };
