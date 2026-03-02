// Fila de mensagens usando SQLite (simpler than Redis for now)

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import type { AgentMessage, AgentId } from '../types/AgentMessage.js';

export class DatabaseQueue extends EventEmitter {
  private db: Database.Database;
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(dbPath: string = './data/agent_queue.db') {
    super();
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  private initDatabase() {
    // Criar tabela de mensagens
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        session_id TEXT NOT NULL,
        correlation_id TEXT,
        parent_id TEXT,
        status TEXT DEFAULT 'pending',
        read INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_to_agent ON messages(to_agent);
      CREATE INDEX IF NOT EXISTS idx_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_correlation ON messages(correlation_id);

      CREATE TABLE IF NOT EXISTS agent_registry (
        agent_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        last_seen TEXT,
        capabilities TEXT
      );
    `);
  }

  // Enviar mensagem
  async enqueue(message: AgentMessage): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO messages 
      (id, from_agent, to_agent, type, payload, timestamp, session_id, correlation_id, parent_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.from,
      message.to,
      message.type,
      JSON.stringify(message.payload),
      message.timestamp,
      message.sessionId,
      message.correlationId || null,
      message.parentId || null,
      message.status || 'pending'
    );

    // Emitir evento para listeners em tempo real
    this.emit('message', message);
    this.emit(`message:${message.to}`, message);
  }

  // Receber mensagens para um agente
  async dequeue(agentId: AgentId, limit: number = 10): Promise<AgentMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE to_agent = ? AND status = 'pending'
      ORDER BY timestamp ASC
      LIMIT ?
    `);

    const rows = stmt.all(agentId, limit);
    
    return rows.map(this.rowToMessage);
  }

  // Marcar mensagem como lida/processada
  async markAsProcessed(messageId: string, status: 'completed' | 'failed' = 'completed'): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages SET status = ?, read = 1 WHERE id = ?
    `);
    stmt.run(status, messageId);
  }

  // Buscar mensagem por ID
  async getMessage(messageId: string): Promise<AgentMessage | null> {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
    const row = stmt.get(messageId);
    return row ? this.rowToMessage(row) : null;
  }

  // Buscar histórico de uma sessão
  async getSessionHistory(sessionId: string, limit: number = 50): Promise<AgentMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(sessionId, limit);
    return rows.map(this.rowToMessage);
  }

  // Buscar mensagens por correlationId (para rastrear request/response)
  async getByCorrelationId(correlationId: string): Promise<AgentMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE correlation_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(correlationId);
    return rows.map(this.rowToMessage);
  }

  // Assinar mensagens para um agente (long polling)
  subscribe(agentId: AgentId, callback: (message: AgentMessage) => void): () => void {
    const eventName = `message:${agentId}`;
    this.on(eventName, callback);

    // Retornar função para cancelar assinatura
    return () => {
      this.off(eventName, callback);
    };
  }

  // Polling para agentes (fallback se EventEmitter não funcionar)
  startPolling(agentId: AgentId, callback: (messages: AgentMessage[]) => void, intervalMs: number = 1000): void {
    this.stopPolling(agentId);

    const interval = setInterval(async () => {
      const messages = await this.dequeue(agentId, 10);
      if (messages.length > 0) {
        callback(messages);
        // Marcar como processando
        for (const msg of messages) {
          await this.mark(msg.id, 'processing');
        }
      }
    }, intervalMs);

    this.pollingIntervals.set(agentId, interval);
  }

  stopPolling(agentId: AgentId): void {
    const interval = this.pollingIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(agentId);
    }
  }

  // Método público para marcar como processado (usado no teste)
  async mark(messageId: string, status: 'completed' | 'failed' | 'processing'): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages SET status = ?, read = 1 WHERE id = ?
    `);
    stmt.run(status, messageId);
  }

  private rowToMessage(row: any): AgentMessage {
    return {
      id: row.id,
      from: row.from_agent,
      to: row.to_agent,
      type: row.type,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
      sessionId: row.session_id,
      correlationId: row.correlation_id,
      parentId: row.parent_id,
      status: row.status
    };
  }

  // Estatísticas
  getStats(): { total: number; pending: number; processing: number; completed: number } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const pending = this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'pending'").get().count;
    const processing = this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'processing'").get().count;
    const completed = this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'completed'").get().count;

    return { total, pending, processing, completed };
  }

  // Limpar mensagens antigas
  cleanup(olderThanDays: number = 7): void {
    const stmt = this.db.prepare(`
      DELETE FROM messages 
      WHERE timestamp < datetime('now', '-${olderThanDays} days')
    `);
    stmt.run();
  }

  close(): void {
    // Parar todos os polling
    for (const [agentId, interval] of this.pollingIntervals) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    
    this.db.close();
  }
}
