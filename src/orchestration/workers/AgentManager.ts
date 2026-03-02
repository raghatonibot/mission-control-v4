// Agent Manager - Gerenciador de todos os agentes do sistema

import { MessageBroker } from '../services/MessageBroker.js';
import { BaseAgent, AgentConfig } from './BaseAgent.js';
import { IronManAgent } from './IronManAgent.js';
import { ThorAgent } from './ThorAgent.js';
import { ShuriAgent } from './ShuriAgent.js';
import { BlackWidowAgent } from './BlackWidowAgent.js';
import { HawkeyeAgent } from './HawkeyeAgent.js';
import { FuryAgent } from './FuryAgent.js';
import { HulkAgent } from './HulkAgent.js';
import { PepperAgent } from './PepperAgent.js';
import { WandaAgent } from './WandaAgent.js';
import type { AgentId } from '../types/AgentMessage.js';

export interface AgentStatus {
  id: AgentId;
  name: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  activeTasks: number;
  lastActivity: Date | null;
  skills: string[];
  schedule?: string;
}

export class AgentManager {
  private agents: Map<AgentId, BaseAgent> = new Map();
  private broker: MessageBroker;
  private isRunning: boolean = false;

  constructor(broker: MessageBroker) {
    this.broker = broker;
    this.initializeAgents();
  }

  private initializeAgents(): void {
    console.log('🤖 Inicializando agentes...');

    // Criar instâncias de cada agente
    this.agents.set('ironman', new IronManAgent(this.broker));
    this.agents.set('thor', new ThorAgent(this.broker));
    this.agents.set('shuri', new ShuriAgent(this.broker));
    this.agents.set('blackwidow', new BlackWidowAgent(this.broker));
    this.agents.set('hawkeye', new HawkeyeAgent(this.broker));
    this.agents.set('fury', new FuryAgent(this.broker));
    this.agents.set('hulk', new HulkAgent(this.broker));
    this.agents.set('pepper', new PepperAgent(this.broker));
    this.agents.set('wanda', new WandaAgent(this.broker));

    console.log(`✅ ${this.agents.size} agentes inicializados`);
  }

  // Iniciar todos os agentes
  async startAll(): Promise<void> {
    console.log('🚀 Iniciando todos os agentes...');

    for (const [id, agent] of this.agents) {
      try {
        await agent.start();
        console.log(`   ✅ ${id} iniciado`);
      } catch (error) {
        console.error(`   ❌ Falha ao iniciar ${id}:`, error);
      }
    }

    this.isRunning = true;
    console.log('✅ Todos os agentes iniciados');
  }

  // Parar todos os agentes
  async stopAll(): Promise<void> {
    console.log('🛑 Parando todos os agentes...');

    for (const [id, agent] of this.agents) {
      try {
        await agent.stop();
        console.log(`   ✅ ${id} parado`);
      } catch (error) {
        console.error(`   ❌ Falha ao parar ${id}:`, error);
      }
    }

    this.isRunning = false;
    console.log('✅ Todos os agentes parados');
  }

  // Iniciar agente específico
  async startAgent(agentId: AgentId): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agente não encontrado: ${agentId}`);
    }

    await agent.start();
  }

  // Parar agente específico
  async stopAgent(agentId: AgentId): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agente não encontrado: ${agentId}`);
    }

    await agent.stop();
  }

  // Obter status de todos os agentes
  getAllStatus(): AgentStatus[] {
    const statuses: AgentStatus[] = [];

    for (const [id, agent] of this.agents) {
      statuses.push({
        id,
        name: agent.name,
        status: agent.isActive() ? agent.getStatus() : 'offline',
        activeTasks: agent.getActiveTasksCount(),
        lastActivity: agent.getLastActivity(),
        skills: agent.skills,
        schedule: agent.schedule
      });
    }

    return statuses;
  }

  // Obter status de um agente específico
  getAgentStatus(agentId: AgentId): AgentStatus | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return {
      id: agentId,
      name: agent.name,
      status: agent.isActive() ? agent.getStatus() : 'offline',
      activeTasks: agent.getActiveTasksCount(),
      lastActivity: agent.getLastActivity(),
      skills: agent.skills,
      schedule: agent.schedule
    };
  }

  // Obter agente por ID
  getAgent(agentId: AgentId): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  // Verificar se está rodando
  isActive(): boolean {
    return this.isRunning;
  }

  // Listar todos os agentes
  listAgents(): AgentId[] {
    return Array.from(this.agents.keys());
  }
}
