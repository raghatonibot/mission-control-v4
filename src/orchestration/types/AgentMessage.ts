// Tipos de mensagens entre agentes

export type MessageType = 'task' | 'response' | 'alert' | 'status' | 'heartbeat';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentMessage {
  id: string;
  from: string;           // 'ragha', 'ironman', 'thor', etc.
  to: string;             // destinatário ou 'broadcast'
  type: MessageType;
  payload: {
    task?: string;
    data?: any;
    priority?: Priority;
    deadline?: string;
    skill?: string;        // qual skill usar
    params?: any;          // parâmetros da skill
  };
  timestamp: string;
  sessionId: string;      // para rastrear conversa
  correlationId?: string; // para associar request/response
  parentId?: string;      // mensagem pai (thread)
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface TaskRequest {
  task: string;
  skill?: string;
  params?: any;
  priority: Priority;
  deadline?: Date;
}

export interface TaskResponse {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
  agentId: string;
}

export type AgentId = 
  | 'ragha' 
  | 'ironman' 
  | 'fury' 
  | 'shuri' 
  | 'thor' 
  | 'hulk' 
  | 'pepper' 
  | 'blackwidow' 
  | 'hawkeye' 
  | 'wanda';

export const AGENT_LIST: AgentId[] = [
  'ragha', 'ironman', 'fury', 'shuri', 'thor', 
  'hulk', 'pepper', 'blackwidow', 'hawkeye', 'wanda'
];
