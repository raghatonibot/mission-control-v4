// Base Agent - Classe base para todos os agentes do sistema

import { EventEmitter } from 'events';
import type { MessageBroker } from '../services/MessageBroker.js';
import type { AgentMessage, AgentId, TaskRequest, TaskResponse, Priority } from '../types/AgentMessage.js';

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  skills: string[];
  model: string;
  schedule?: string;
  maxConcurrentTasks?: number;
}

export interface TaskContext {
  message: AgentMessage;
  startTime: number;
  timeout?: NodeJS.Timeout;
}

export abstract class BaseAgent extends EventEmitter {
  public readonly id: AgentId;
  public readonly name: string;
  public readonly description: string;
  public readonly skills: string[];
  public readonly model: string;
  public readonly schedule?: string;
  
  protected broker: MessageBroker;
  protected isRunning: boolean = false;
  protected activeTasks: Map<string, TaskContext> = new Map();
  protected maxConcurrentTasks: number;
  protected unsubscribe?: () => void;
  protected status: 'idle' | 'busy' | 'error' = 'idle';
  protected lastActivity: Date | null = null;

  constructor(config: AgentConfig, broker: MessageBroker) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.skills = config.skills;
    this.model = config.model;
    this.schedule = config.schedule;
    this.maxConcurrentTasks = config.maxConcurrentTasks || 3;
    this.broker = broker;
  }

  // Iniciar o agente
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn(`⚠️ Agente ${this.id} já está rodando`);
      return;
    }

    console.log(`🚀 Iniciando agente: ${this.name} (${this.id})`);
    
    this.isRunning = true;
    this.status = 'idle';
    
    // Assinar mensagens
    this.unsubscribe = this.broker.subscribe(this.id, (message) => {
      this.handleMessage(message);
    });

    this.emit('started', { agentId: this.id, timestamp: new Date() });
    
    // Notificar Ragha
    await this.sendStatusToRagha('online');
  }

  // Parar o agente
  async stop(): Promise<void> {
    console.log(`🛑 Parando agente: ${this.name} (${this.id})`);
    
    this.isRunning = false;
    
    // Cancelar assinatura
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    // Cancelar tasks pendentes
    for (const [taskId, context] of this.activeTasks) {
      if (context.timeout) {
        clearTimeout(context.timeout);
      }
    }
    this.activeTasks.clear();

    this.emit('stopped', { agentId: this.id, timestamp: new Date() });
    
    // Notificar Ragha
    await this.sendStatusToRagha('offline');
  }

  // Processar mensagem recebida
  protected async handleMessage(message: AgentMessage): Promise<void> {
    if (!this.isRunning) {
      console.warn(`⚠️ Agente ${this.id} recebeu mensagem mas não está rodando`);
      return;
    }

    // Verificar se pode aceitar mais tasks
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      console.warn(`⚠️ Agente ${this.id} atingiu limite de tasks (${this.maxConcurrentTasks})`);
      await this.sendErrorResponse(message, 'Agent busy - max concurrent tasks reached');
      return;
    }

    this.lastActivity = new Date();
    this.status = 'busy';

    const taskId = message.id;
    const context: TaskContext = {
      message,
      startTime: Date.now()
    };

    this.activeTasks.set(taskId, context);

    try {
      console.log(`📥 ${this.id} recebeu task: ${message.payload.task || message.type}`);
      
      // Executar a task
      const result = await this.executeTask(message.payload, message);
      
      // Enviar resposta
      await this.sendResponse(message, result);
      
      console.log(`✅ ${this.id} completou task: ${taskId}`);

    } catch (error) {
      console.error(`❌ ${this.id} falhou na task ${taskId}:`, error);
      await this.sendErrorResponse(message, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.activeTasks.delete(taskId);
      
      // Atualizar status
      if (this.activeTasks.size === 0) {
        this.status = 'idle';
      }
    }
  }

  // Método abstrato - cada agente implementa sua lógica
  abstract executeTask(payload: any, message: AgentMessage): Promise<any>;

  // Enviar resposta de sucesso
  protected async sendResponse(message: AgentMessage, data: any): Promise<void> {
    const executionTime = Date.now() - this.activeTasks.get(message.id)!.startTime;

    await this.broker.respond(
      message.from as AgentId,
      message.correlationId || message.id,
      {
        success: true,
        data,
        executionTime,
        agentId: this.id
      },
      message.sessionId
    );
  }

  // Enviar resposta de erro
  protected async sendErrorResponse(message: AgentMessage, error: string): Promise<void> {
    await this.broker.respond(
      message.from as AgentId,
      message.correlationId || message.id,
      {
        success: false,
        error,
        agentId: this.id
      },
      message.sessionId
    );
  }

  // Enviar alerta para Ragha
  protected async sendAlert(message: string, priority: Priority = 'medium', data?: any): Promise<void> {
    await this.broker.sendAlert(this.id, message, priority, data);
  }

  // Enviar status para Ragha
  protected async sendStatusToRagha(status: 'online' | 'offline' | 'error'): Promise<void> {
    await this.broker.send({
      from: this.id,
      to: 'ragha',
      type: 'status',
      payload: {
        status,
        activeTasks: this.activeTasks.size,
        lastActivity: this.lastActivity
      },
      sessionId: 'system'
    });
  }

  // Verificar se tem uma skill específica
  hasSkill(skillName: string): boolean {
    return this.skills.includes(skillName);
  }

  // Getters
  getStatus(): 'idle' | 'busy' | 'error' {
    return this.status;
  }

  getActiveTasksCount(): number {
    return this.activeTasks.size;
  }

  getLastActivity(): Date | null {
    return this.lastActivity;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
