// API client para o serviço de orquestração

const ORCHESTRATION_URL = 'http://localhost:3005/api/orchestration';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ORCHESTRATION_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  return res.json();
}

export const orchestrationApi = {
  // Health check
  health: () => request<{ status: string; timestamp: string; services: Record<string, string> }>('/health'),

  // Agentes
  getAgentsStatus: () => request<{ timestamp: string; agents: AgentStatus[] }>('/agents/status'),
  getAgentStatus: (agentId: string) => request<AgentStatus>(`/agents/${agentId}/status`),

  // Orquestração
  orchestrate: (message: string, sessionId?: string, context?: Record<string, any>) =>
    request<OrchestrationResult>('/orchestrate', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId, context }),
    }),

  // Mensagem direta para agente
  sendMessageToAgent: (agentId: string, message: string, sessionId?: string) =>
    request<AgentMessage>(`/agents/${agentId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    }),

  // Sessões
  getSessionHistory: (sessionId: string, limit?: number) =>
    request<{ sessionId: string; messages: AgentMessage[] }>(`/sessions/${sessionId}/history?limit=${limit || 50}`),
  getSessionContext: (sessionId: string) =>
    request<{ sessionId: string; context: Record<string, any>; createdAt: string; lastActivity: string }>(`/sessions/${sessionId}/context`),
  updateSessionContext: (sessionId: string, context: Record<string, any>) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/context`, {
      method: 'POST',
      body: JSON.stringify({ context }),
    }),

  // Alertas
  getAlerts: (params?: { priority?: string; unread?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.priority) qs.set('priority', params.priority);
    if (params?.unread) qs.set('unread', 'true');
    return request<{ count: number; alerts: Alert[] }>(`/alerts?${qs.toString()}`);
  },
  markAlertAsRead: (alertId: string) =>
    request<{ success: boolean }>(`/alerts/${alertId}/read`, { method: 'POST' }),
  markAllAlertsAsRead: () =>
    request<{ success: boolean }>('/alerts/read-all', { method: 'POST' }),

  // Tasks
  getSessionTasks: (sessionId: string) =>
    request<{ sessionId: string; tasks: PersistedTask[] }>(`/sessions/${sessionId}/tasks`),

  // Cron
  getCronSchedule: () => request<{ tasks: CronTask[] }>('/cron/schedule'),
  controlCron: (taskName: string, action: 'start' | 'stop') =>
    request<{ success: boolean; task: string; action: string }>(`/cron/${taskName}/${action}`, { method: 'POST' }),

  // Estatísticas
  getStats: () => request<SessionStats>('/stats'),
};

// Tipos
export interface AgentStatus {
  id: string;
  name: string;
  status: 'online' | 'busy' | 'offline' | 'error';
  skills: number;
  completedTasks: number;
  currentTask?: string;
  lastActivity?: string;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task' | 'response' | 'alert' | 'status' | 'broadcast';
  payload: any;
  timestamp: string;
  sessionId: string;
  correlationId?: string;
}

export interface OrchestrationResult {
  agentsCalled: string[];
  results: Record<string, any>;
  executionTime: number;
  consolidated: {
    summary: string;
    details: string;
    recommendations: string[];
  };
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

export interface CronTask {
  name: string;
  agentId: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface SessionStats {
  timestamp: string;
  sessions: {
    sessions: number;
    tasks: number;
    alerts: { total: number; unread: number; critical: number };
    messages: number;
  };
  agents: {
    total: number;
    active: number;
    busy: number;
  };
  cron: {
    total: number;
    running: number;
  };
  broker: {
    messagesSent: number;
    messagesReceived: number;
    tasksCompleted: number;
    activeSubscriptions: number;
  };
}
