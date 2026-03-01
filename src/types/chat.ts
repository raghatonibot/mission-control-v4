export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isUser: boolean;
}

export interface Conversation {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  agentStatus: 'active' | 'idle' | 'offline';
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  messages: Message[];
}
