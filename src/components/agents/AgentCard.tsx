import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { Agent } from '@/types/agent';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: Agent;
  className?: string;
}

export function AgentCard({ agent, className }: AgentCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        to={`/agents/${agent.id}`}
        className={cn(
          'block bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-colors',
          className
        )}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="w-12 h-12 border-2 border-border">
            <AvatarImage src={agent.avatar || `/agents/${agent.id}.svg?v=1`} alt={agent.name} />
            <AvatarFallback className="bg-card text-lg">
              {agent.emoji}
            </AvatarFallback>
          </Avatar>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
              <span className="text-xs">{agent.emoji}</span>
            </div>
            <p className="text-sm text-muted-foreground truncate">{agent.role}</p>
            
            {/* Status and Type */}
            <div className="flex items-center gap-2 mt-3">
              <StatusBadge status={agent.status} />
              <span className="text-xs text-muted-foreground capitalize">
                {agent.type === 'autonomous' ? 'Autônomo' : agent.type === 'operator' ? 'Operador' : agent.type}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
