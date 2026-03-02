// Session Manager - Persistência de contexto entre sessões

import Database from 'better-sqlite3';
import type { AgentMessage } from '../types/AgentMessage.js';

export interface Session {
  id: string;
  userId?: string;
  createdAt: string;
  lastActivity: string;
  context: Record<string, any>;
}

export interface PersistedTask {
  id: string;
  sessionId: string;
  agentId: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Alert {
  id: string;
  agentId: string;
  type: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  data?: any;
  createdAt: string;
}

export class SessionManager {
  private db: Database.Database;

  constructor(dbPath: string = './data/sessions.db') {
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  private initDatabase(): void {
    // Tabela de sessões
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        created_at TEXT NOT NULL,
        last_activity TEXT NOT NULL,
        context TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
    `);

    // Tabela de tasks persistidas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS persisted_tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        error TEXT,
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_session ON persisted_tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON persisted_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent ON persisted_tasks(agent_id);
    `);

    // Tabela de alertas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        read INTEGER DEFAULT 0,
        data TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
      CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
      CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
    `);

    // Tabela de mensagens histórico
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_history (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        correlation_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_history_session ON message_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON message_history(timestamp);
    `);
  }

  // Criar ou obter sessão
  getOrCreateSession(sessionId: string, userId?: string): Session {
    let session = this.getSession(sessionId);
    
    if (!session) {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO sessions (id, user_id, created_at, last_activity, context)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(sessionId, userId || null, now, now, '{}');
      
      session = {
        id: sessionId,
        userId,
        createdAt: now,
        lastActivity: now,
        context: {}
      };
    }
    
    return session;
  }

  // Obter sessão
  getSession(sessionId: string): Session | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      context: JSON.parse(row.context)
    };
  }

  // Atualizar contexto da sessão
  updateSessionContext(sessionId: string, context: Record<string, any>): void {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET context = ?, last_activity = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(context), new Date().toISOString(), sessionId);
  }

  // Atualizar última atividade
  touchSession(sessionId: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions SET last_activity = ? WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), sessionId);
  }

  // Salvar mensagem no histórico
  saveMessage(message: AgentMessage): void {
    const stmt = this.db.prepare(`
      INSERT INTO message_history 
      (id, session_id, from_agent, to_agent, type, payload, timestamp, correlation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      message.id,
      message.sessionId,
      message.from,
      message.to,
      message.type,
      JSON.stringify(message.payload),
      message.timestamp,
      message.correlationId || null
    );
  }

  // Obter histórico de mensagens
  getMessageHistory(sessionId: string, limit: number = 50): AgentMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM message_history 
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(sessionId, limit) as any[];
    
    return rows.map(row => ({
      id: row.id,
      from: row.from_agent,
      to: row.to_agent,
      type: row.type,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
      sessionId: row.session_id,
      correlationId: row.correlation_id
    }));
  }

  // Criar task persistida
  createTask(task: Omit<PersistedTask, 'id'>): PersistedTask {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO persisted_tasks 
      (id, session_id, agent_id, task, status, started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      task.sessionId,
      task.agentId,
      task.task,
      task.status,
      new Date().toISOString()
    );
    
    return { ...task, id };
  }

  // Atualizar status da task
  updateTaskStatus(
    taskId: string, 
    status: PersistedTask['status'], 
    result?: any, 
    error?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE persisted_tasks 
      SET status = ?, result = ?, error = ?, completed_at = ?
      WHERE id = ?
    `);
    
    stmt.run(
      status,
      result ? JSON.stringify(result) : null,
      error || null,
      status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
      taskId
    );
  }

  // Obter tasks da sessão
  getTasks(sessionId: string): PersistedTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM persisted_tasks WHERE session_id = ? ORDER BY started_at DESC
    `);
    
    const rows = stmt.all(sessionId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      agentId: row.agent_id,
      task: row.task,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at
    }));
  }

  // Criar alerta
  createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'read'>): Alert {
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO alerts 
      (id, agent_id, type, message, priority, read, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      alert.agentId,
      alert.type,
      alert.message,
      alert.priority,
      0,
      alert.data ? JSON.stringify(alert.data) : null,
      now
    );
    
    return { ...alert, id, createdAt: now, read: false };
  }

  // Obter alertas não lidos
  getUnreadAlerts(priority?: Alert['priority']): Alert[] {
    let query = 'SELECT * FROM alerts WHERE read = 0';
    const params: any[] = [];
    
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      type: row.type,
      message: row.message,
      priority: row.priority,
      read: row.read === 1,
      data: row.data ? JSON.parse(row.data) : undefined,
      createdAt: row.created_at
    }));
  }

  // Marcar alerta como lido
  markAlertAsRead(alertId: string): void {
    const stmt = this.db.prepare('UPDATE alerts SET read = 1 WHERE id = ?');
    stmt.run(alertId);
  }

  // Marcar todos os alertas como lidos
  markAllAlertsAsRead(): void {
    this.db.prepare('UPDATE alerts SET read = 1').run();
  }

  // Limpar dados antigos
  cleanup(olderThanDays: number = 7): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const cutoffStr = cutoff.toISOString();

    // Limpar mensagens antigas
    this.db.prepare('DELETE FROM message_history WHERE timestamp < ?').run(cutoffStr);
    
    // Limpar tasks completadas/falhas antigas
    this.db.prepare('DELETE FROM persisted_tasks WHERE completed_at < ?').run(cutoffStr);
    
    // Limpar alertas lidos antigos
    this.db.prepare('DELETE FROM alerts WHERE read = 1 AND created_at < ?').run(cutoffStr);
  }

  // Estatísticas
  getStats(): {
    sessions: number;
    tasks: number;
    alerts: { total: number; unread: number; critical: number };
    messages: number;
  } {
    return {
      sessions: this.db.prepare('SELECT COUNT(*) as count FROM sessions').get().count,
      tasks: this.db.prepare('SELECT COUNT(*) as count FROM persisted_tasks').get().count,
      alerts: {
        total: this.db.prepare('SELECT COUNT(*) as count FROM alerts').get().count,
        unread: this.db.prepare('SELECT COUNT(*) as count FROM alerts WHERE read = 0').get().count,
        critical: this.db.prepare("SELECT COUNT(*) as count FROM alerts WHERE priority = 'critical' AND read = 0").get().count
      },
      messages: this.db.prepare('SELECT COUNT(*) as count FROM message_history').get().count
    };
  }

  close(): void {
    this.db.close();
  }
}
