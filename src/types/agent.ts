export type AgentStatus = 'active' | 'idle' | 'offline' | 'queued';
export type AgentType = 'autonomous' | 'operator';

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  status: AgentStatus;
  type: AgentType;
  avatar: string;
  memberSince: string;
  systemDirective?: string;
  tone?: 'creative' | 'professional' | 'casual';
  quirks?: string[];
  emojiUsage?: 'frequent' | 'occasional' | 'rare';
  formality?: 'casual' | 'professional' | 'formal';
  skills?: Skill[];
  skillsAllowed?: string[];
  toolsDenied?: string[];
  model?: 'openai-codex/gpt-5.2' | 'kimi-coding/k2p5' | string;
  lastActive?: string;
  currentTask?: string;
  currentRunId?: string | null;
  currentTaskTitle?: string | null;
  currentSessionKey?: string | null;
  currentModel?: string | null;
  runStage?: string;
  queueCount?: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon?: string;
}
