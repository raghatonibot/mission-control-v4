import { Link, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types/chat';

interface ConversationListProps {
  conversations: Conversation[];
  className?: string;
  onSelect?: () => void;
}

export function ConversationList({ conversations, className, onSelect }: ConversationListProps) {
  const { agentId } = useParams();

  return (
    <div className={cn('bg-card border border-border rounded-2xl overflow-hidden', className)}>
      <div className="px-4 py-4 border-b border-border bg-background/30">
        <h3 className="font-semibold text-foreground">Agentes</h3>
        <p className="text-sm text-muted-foreground">Selecione com quem falar</p>
      </div>

      <div className="px-2 py-2 overflow-hidden">
        <div className="space-y-1">
          {conversations.map((conv) => {
            const selected = agentId === conv.agentId;
            return (
              <Link
                key={conv.id}
                to={`/chat/${conv.agentId}`}
                onClick={() => onSelect?.()}
                className={cn(
                  'group relative flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors min-w-0',
                  selected ? 'bg-background/80' : 'hover:bg-background/50'
                )}
              >
                <span className={cn('absolute left-0 top-2 bottom-2 w-[2px] rounded-r', selected ? 'bg-emerald-400' : 'bg-transparent')} />

                <div className="relative shrink-0 ml-1">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={conv.agentAvatar} alt={conv.agentName} />
                    <AvatarFallback className="bg-card">{conv.agentName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
                      conv.agentStatus === 'active' && 'bg-emerald-400',
                      conv.agentStatus === 'idle' && 'bg-amber-400',
                      conv.agentStatus === 'offline' && 'bg-gray-400'
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{conv.agentName}</p>
                </div>

                {conv.unreadCount > 0 && (
                  <span className="bg-emerald-400 text-background text-xs font-medium min-w-5 h-5 px-1 rounded-full flex items-center justify-center shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
