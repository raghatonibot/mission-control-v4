export type RunStatus = 'queued' | 'running' | 'stopping' | 'waiting' | 'review' | 'done' | 'failed' | 'stopped';
export type RunPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Run {
  id: string;
  taskId: string;
  taskTitle: string;
  agentId: string;
  agentName: string;
  model: string;
  status: RunStatus;
  priority: RunPriority;
  queuedAt: string;
  startedAt?: string;
  endedAt?: string;
  lastUpdateAt?: string;
  stopRequestedAt?: string;
  tokensOutEst?: number;
  summary?: string;
  logs?: string[];
  outputs?: Array<{ label: string; url?: string; path?: string }>;
  // Retry/runtime observability
  attempt?: number;
  retryCount?: number;
  nextRetryAt?: string;
  lastError?: string;
  // Integration handles
  sessionKey?: string;
}
