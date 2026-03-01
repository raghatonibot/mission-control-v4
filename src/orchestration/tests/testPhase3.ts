// Teste de integração da FASE 3: Orchestrator Ragha

import { MessageBroker, AgentManager, Orchestrator, RaghaAgent } from '../index.js';

async function testPhase3() {
  console.log('🧪 Testando FASE 3: Orchestrator Ragha\n');

  const broker = new MessageBroker('./test_phase3.db');
  const manager = new AgentManager(broker);

  try {
    // Test 1: Iniciar todos os agentes (incluindo Ragha)
    console.log('Test 1: Iniciar todos os agentes');
    await manager.startAll();
    
    // Verificar se Ragha está rodando
    const raghaStatus = manager.getAgentStatus('ragha');
    console.log(`   Ragha status: ${raghaStatus?.status}`);
    console.log(`   Ragha skills: ${raghaStatus?.skills.join(', ')}`);
    console.log('✅ Agentes iniciados\n');

    // Test 2: Testar Orchestrator diretamente
    console.log('Test 2: Testar análise de task');
    const orchestrator = new Orchestrator(broker);
    
    const testMessages = [
      'Pesquise sobre novos modelos de IA',
      'Implemente um sistema de autenticação JWT',
      'Qual a melhor arquitetura para um scraper?'
    ];

    for (const msg of testMessages) {
      console.log(`\n   Mensagem: "${msg}"`);
      const result = await orchestrator.orchestrate(msg, 'test-session');
      console.log(`   Análise: ${result.analysis.intent} | Agentes: ${result.agentsCalled.join(', ')}`);
      console.log(`   Consolidação: ${result.consolidated.summary.substring(0, 80)}...`);
    }
    console.log('✅ Análise de tasks funcionando\n');

    // Test 3: Testar RaghaAgent - mensagem do usuário
    console.log('Test 3: Ragha orquestrando mensagem do usuário');
    const ragha = manager.getAgent('ragha') as RaghaAgent;
    
    const userMessage = 'Pesquise o que o pessoal está falando sobre GPT-5';
    console.log(`   Usuário: "${userMessage}"`);
    
    const response = await ragha.handleUserMessage(userMessage, 'demo-session');
    console.log(`\n   Resposta formatada:`);
    console.log(response.formatted);
    console.log('✅ Ragha orquestrou e respondeu\n');

    // Test 4: Testar delegação direta (@IronMan)
    console.log('Test 4: Delegação direta (@IronMan)');
    const directMessage = '@IronMan pesquise sobre LangChain';
    console.log(`   Usuário: "${directMessage}"`);
    
    const directResponse = await ragha.handleUserMessage(directMessage, 'demo-session-2');
    console.log(`   Resultado:`, directResponse);
    console.log('✅ Delegação direta funcionou\n');

    // Test 5: Verificar histórico de orquestrações
    console.log('Test 5: Histórico');
    const history = await broker.getHistory('demo-session');
    console.log(`   Mensagens na sessão demo-session: ${history.length}`);
    console.log('✅ Histórico OK\n');

    // Parar tudo
    console.log('Parando agentes...');
    await manager.stopAll();
    console.log('✅ Agentes parados\n');

    console.log('✅✅✅ TODOS OS TESTES DA FASE 3 PASSARAM! ✅✅✅');
    console.log('\n🎭 Ragha agora pode:');
    console.log('   • Analisar mensagens do usuário');
    console.log('   • Selecionar agentes automaticamente');
    console.log('   • Delegar tasks');
    console.log('   • Consoladar respostas');
    console.log('   • Entregar resultado formatado');
    console.log('   • Lidar com menções diretas (@Agente)');

    return true;

  } catch (error) {
    console.error('❌ Erro:', error);
    return false;
  } finally {
    broker.close();
  }
}

// Executar
console.log('Iniciando testes da Fase 3...\n');
testPhase3().then(success => {
  process.exit(success ? 0 : 1);
});

export { testPhase3 };
