// Message Broker - Interface principal para comunicação entre agentes

import { DatabaseQueue } from './DatabaseQueue.js';
import type { AgentMessage, AgentId, TaskRequest, TaskResponse, Priority } from '../types/AgentMessage.js';

export class MessageBroker {
  private queue: DatabaseQueue;
  private responseListeners: Map<string, (message: AgentMessage) => void> = new Map();

  constructor(dbPath?: string) {
    this.queue = new DatabaseQueue(dbPath);
    
    // Ouvir todas as mensagens para gerenciar responses
    this.queue.on('message', (message: AgentMessage) => {
      if (message.type === 'response' && message.correlationId) {
        const listener = this.responseListeners.get(message.correlationId);
        if (listener) {
          listener(message);
          this.responseListeners.delete(message.correlationId);
        }
      }
    });
  }

  // Enviar mensagem
  async send(message: Omit<AgentMessage, 'id' | 'timestamp' | 'status'>): Promise<AgentMessage> {
    const fullMessage: AgentMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    await this.queue.enqueue(fullMessage);
    return fullMessage;
  }

  // Enviar tarefa e aguardar resposta (RPC style)
  async sendTaskAndWait(
    from: AgentId,
    to: AgentId,
    task: TaskRequest,
    timeoutMs: number = 300000 // 5 minutos padrão
  ): Promise<TaskResponse> {
    const correlationId = this.generateId();

    // Enviar task
    await this.send({
      from,
      to,
      type: 'task',
      payload: task,
      sessionId: task.sessionId || 'default',
      correlationId,
      parentId: task.parentId
    });

    // Aguardar resposta
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseListeners.delete(correlationId);
        reject(new Error(`Timeout waiting for response from ${to} after ${timeoutMs}ms`));
      }, timeoutMs);

      this.responseListeners.set(correlationId, (message: AgentMessage) => {
        clearTimeout(timeout);
        
        if (message.payload?.error) {
          resolve({
            success: false,
            error: message.payload.error,
            agentId: to
          });
        } else {
          resolve({
            success: true,
            data: message.payload?.data,
            executionTime: message.payload?.executionTime,
            agentId: to
          });
        }
      });
    });
  }

  // Receber mensagens (para agentes consumirem)
  async receive(agentId: AgentId, limit: number = 10): Promise<AgentMessage[]> {
    return this.queue.dequeue(agentId, limit);
  }

  // Assinar mensagens em tempo real
  subscribe(agentId: AgentId, callback: (message: AgentMessage) => void): () => void {
    return this.queue.subscribe(agentId, callback);
  }

  // Iniciar polling (para agentes que não usam EventEmitter)
  startPolling(
    agentId: AgentId, 
    callback: (messages: AgentMessage[]) => void, 
    intervalMs: number = 1000
  ): void {
    this.queue.startPolling(agentId, callback, intervalMs);
  }

  stopPolling(agentId: AgentId): void {
    this.queue.stopPolling(agentId);
  }

  // Responder a uma mensagem
  async respond(
    to: AgentId,
    correlationId: string,
    response: TaskResponse,
    sessionId: string
  ): Promise<void> {
    await this.send({
      from: response.agentId,
      to,
      type: 'response',
      payload: response,
      sessionId,
      correlationId
    });
  }

  // Enviar alerta
  async sendAlert(
    from: AgentId,
    message: string,
    priority: Priority = 'medium',
    data?: any
  ): Promise<void> {
    await this.send({
      from,
      to: 'ragha', // Alertas sempre vão para o orquestrador
      type: 'alert',
      payload: { message, priority, data },
      sessionId: 'system'
    });
  }

  // Broadcast para todos os agentes
  async broadcast(
    from: AgentId,
    type: 'status' | 'alert' | 'heartbeat',
    payload: any,
    sessionId: string = 'broadcast'
  ): Promise<void> {
    const agents: AgentId[] = ['ironman', 'fury', 'shuri', 'thor', 'hulk', 'pepper', 'blackwidow', 'hawkeye', 'wanda'];
    
    for (const agent of agents) {
      await this.send({
        from,
        to: agent,
        type,
        payload,
        sessionId
      });
    }
  }

  // Histórico
  async getHistory(sessionId: string, limit?: number): Promise<AgentMessage[]> {
    return this.queue.getSessionHistory(sessionId, limit);
  }

  // Estatísticas
  getStats() {
    return this.queue.getStats();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  cleanup(olderThanDays?: number): void {
    this.queue.cleanup(olderThanDays);
  }

  close(): void {
    this.queue.close();
  }
}
