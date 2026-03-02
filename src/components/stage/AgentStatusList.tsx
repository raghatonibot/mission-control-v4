import type { Agent } from '@/types/agent';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AgentStatusListProps {
  agents: Agent[];
  className?: string;
}

export function AgentStatusList({ agents, className }: AgentStatusListProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4', className)}>
      <h3 className="font-semibold text-white mb-4">Agents</h3>
      
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-card/50 transition-colors cursor-pointer group"
            >
              {/* Status dot */}
              <div className="relative">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={agent.avatar} alt={agent.name} />
                  <AvatarFallback className="bg-card text-xs">
                    {agent.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card',
                    agent.status === 'active' && 'bg-emerald-400',
                    agent.status === 'idle' && 'bg-amber-400',
                    agent.status === 'offline' && 'bg-gray-400'
                  )}
                />
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                  <span className="text-xs">{agent.emoji}</span>
                </div>
                <span
                  className={cn(
                    'text-xs capitalize',
                    agent.status === 'active' && 'text-emerald-400',
                    agent.status === 'idle' && 'text-amber-400',
                    agent.status === 'offline' && 'text-gray-400'
                  )}
                >
                  {agent.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
