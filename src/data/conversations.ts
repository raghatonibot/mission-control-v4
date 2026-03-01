import type { Conversation } from '@/types/chat';

const agents = [
  { id: 'ragha', name: 'Ragha' },
  { id: 'ironman', name: 'IronMan' },
  { id: 'fury', name: 'Fury' },
  { id: 'shuri', name: 'Shuri' },
  { id: 'thor', name: 'Thor' },
  { id: 'hulk', name: 'Hulk' },
  { id: 'pepper', name: 'Pepper' },
  { id: 'blackwidow', name: 'BlackWidow' },
  { id: 'hawkeye', name: 'Hawkeye' },
  { id: 'wanda', name: 'Wanda' },
];

export const conversations: Conversation[] = agents.map((a) => ({
  id: `conv-${a.id}`,
  agentId: a.id,
  agentName: a.name,
  agentAvatar: '',
  agentStatus: a.id === 'ragha' ? 'active' : 'idle',
  lastMessage: `Canal direto com ${a.name}`,
  lastMessageTime: new Date().toISOString(),
  unreadCount: 0,
  messages: [],
}));

export const agentConversations = conversations;
