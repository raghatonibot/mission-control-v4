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
