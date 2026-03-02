#!/usr/bin/env node
/**
 * Script de inicialização do Sistema de Orquestração
 * CarvalhoAI - Multi-Agent System
 */

import { OrchestrationServer } from './src/orchestration/api/server.ts';

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🎭 CARVALHOAI - SISTEMA DE ORQUESTRAÇÃO            ║
║                  Multi-Agent System                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

const PORT = process.env.PORT || 3005;
const DATA_PATH = process.env.DATA_PATH || './data';

const server = new OrchestrationServer({
  port: PORT,
  dataPath: DATA_PATH
});

// Iniciar
server.start().catch(error => {
  console.error('❌ Erro ao iniciar:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Recebido SIGINT, parando gracefully...');
  await server.stop();
  console.log('✅ Servidor parado. Até logo!');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Recebido SIGTERM, parando gracefully...');
  await server.stop();
  console.log('✅ Servidor parado. Até logo!');
  process.exit(0);
});
