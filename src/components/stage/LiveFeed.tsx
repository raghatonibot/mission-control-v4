import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import type { Activity } from '@/types/activity';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

interface LiveFeedProps {
  activities: Activity[];
  filter?: string;
  className?: string;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/20',
  },
  error: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/20',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/20',
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/20',
  },
};

export function LiveFeed({ activities, filter = 'all', className }: LiveFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom for live feed
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities]);
  
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4 flex flex-col h-full', className)}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-semibold text-white">Live Feed</h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>
      
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="space-y-2 pr-2">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No activity for {filter} filter</p>
            </div>
          ) : (
            activities.map((activity) => {
              const config = typeConfig[activity.type];
              const Icon = config.icon;
              
              return (
                <div
                  key={activity.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.color)} />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      {activity.agentName && (
                        <span className="text-sm font-medium text-white">{activity.agentName}</span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 break-words">{activity.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
