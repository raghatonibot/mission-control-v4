export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'awaiting_approval' | 'cancelled' | 'backlog' | 'ready' | 'blocked' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  risk?: 'low' | 'high' | string;
  runStage?: 'none' | 'queued' | 'running' | 'stopping' | 'waiting' | 'review' | 'done' | 'failed' | 'stopped' | 'mixed';
  createdAt: string;
  updatedAt: string;
}
