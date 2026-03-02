import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  sender: string;
  content: string;
  timestamp: string;
}

interface AgentConversationProps {
  conversations: { id: string; agents: string[]; messages: Message[] }[];
  className?: string;
}

const agentColors: Record<string, string> = {
  'Strategist': 'text-violet-400',
  'Copy': 'text-blue-400',
  'Code Agent': 'text-emerald-400',
  'Research Agent': 'text-amber-400',
  'Arturo': 'text-pink-400',
};

export function AgentConversation({ conversations, className }: AgentConversationProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4', className)}>
      <h3 className="font-semibold text-white mb-4">Agent Conversations</h3>
      
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-4">
          {conversations.map((conv) => (
            <div key={conv.id} className="space-y-2">
              {/* Conversation header */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>💬</span>
                <span>{conv.agents.join(' + ')}</span>
              </div>
              
              {/* Messages */}
              <div className="space-y-1 pl-4 border-l-2 border-border">
                {conv.messages.map((msg, idx) => (
                  <div key={idx} className="text-sm">
                    <span className={cn('font-medium', agentColors[msg.sender] || 'text-white')}>
                      {msg.sender}:
                    </span>{' '}
                    <span className="text-muted-foreground">{msg.content}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
