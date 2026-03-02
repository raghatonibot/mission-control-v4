export type MissionStatus = 'proposed' | 'running' | 'completed' | 'failed';
export type MissionPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Mission {
  id: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  status: MissionStatus;
  priority: MissionPriority;
  steps: number;
  completedSteps: number;
  createdAt: string;
  updatedAt: string;
  approved?: boolean;
}

export interface MissionColumn {
  id: MissionStatus;
  title: string;
  missions: Mission[];
}
