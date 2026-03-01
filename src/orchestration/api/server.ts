// Servidor API - Inicialização do sistema completo

import express from 'express';
import cors from 'cors';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAPIRoutes } from './routes.js';
import {
  MessageBroker,
  AgentManager,
  Orchestrator,
  SessionManager,
  CronService
} from '../index.js';

export interface ServerConfig {
  port: number;
  dataPath: string;
}

import { mkdirSync } from 'fs';
import { dirname } from 'path';

export class OrchestrationServer {
  private app: express.Application;
  private broker: MessageBroker;
  private manager: AgentManager;
  private orchestrator: Orchestrator;
  private sessionManager: SessionManager;
  private cronService: CronService;
  private config: ServerConfig;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      port: config.port || 3005,
      dataPath: config.dataPath || './data'
    };

    // Criar diretório de dados se não existir
    try {
      mkdirSync(this.config.dataPath, { recursive: true });
    } catch (e) {
      // Ignora se já existe
    }

    this.app = express();
    this.setupMiddleware();
    
    // Inicializar serviços
    this.broker = new MessageBroker(`${this.config.dataPath}/messages.db`);
    this.manager = new AgentManager(this.broker);
    this.orchestrator = new Orchestrator(this.broker);
    this.sessionManager = new SessionManager(`${this.config.dataPath}/sessions.db`);
    this.cronService = new CronService(this.broker, this.manager);
    
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    const apiRoutes = createAPIRoutes(
      this.broker,
      this.manager,
      this.orchestrator,
      this.sessionManager,
      this.cronService
    );

    this.app.use('/api/orchestration', apiRoutes);

    // Rota raiz
    this.app.get('/', (req, res) => {
      res.json({
        service: 'CarvalhoAI Orchestration',
        version: '1.0.0',
        endpoints: [
          '/api/orchestration/health',
          '/api/orchestration/agents/status',
          '/api/orchestration/orchestrate',
          '/api/orchestration/sessions/:id/history',
          '/api/orchestration/alerts',
          '/api/orchestration/stats'
        ]
      });
    });
  }

  async start(): Promise<void> {
    console.log('🚀 Iniciando Orchestration Server...\n');

    // 1. Iniciar agentes
    console.log('1️⃣ Iniciando agentes...');
    await this.manager.startAll();
    console.log('   ✅ Agentes iniciados\n');

    // 2. Iniciar cron jobs
    console.log('2️⃣ Iniciando Cron Service...');
    this.cronService.startAll();
    console.log('   ✅ Cron Service iniciado\n');

    // 3. Iniciar servidor HTTP
    console.log('3️⃣ Iniciando servidor HTTP...');
    this.app.listen(this.config.port, () => {
      console.log(`   ✅ Servidor rodando na porta ${this.config.port}\n`);
    });

    console.log('🎉 Sistema completo iniciado!\n');
    console.log(`📡 API disponível em: http://localhost:${this.config.port}/api/orchestration`);
    console.log('📊 Dashboard: http://localhost:3004 (Mission Control)');
  }

  async stop(): Promise<void> {
    console.log('\n🛑 Parando servidor...\n');

    this.cronService.stopAll();
    await this.manager.stopAll();
    this.broker.close();
    this.sessionManager.close();

    console.log('✅ Servidor parado');
  }

  getApp(): express.Application {
    return this.app;
  }

  getServices() {
    return {
      broker: this.broker,
      manager: this.manager,
      orchestrator: this.orchestrator,
      sessionManager: this.sessionManager,
      cronService: this.cronService
    };
  }
}

// Se executado diretamente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${__filename}`) {
  const server = new OrchestrationServer({
    port: 3005,
    dataPath: './data'
  });

  server.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}
