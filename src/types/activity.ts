export type ActivityType = 'info' | 'success' | 'error' | 'warning';

export interface Activity {
  id: string;
  type: ActivityType;
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
