import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Activity } from '@/types/activity';
import { Activity as ActivityIcon, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivityFeedProps {
  activities: Activity[];
  title?: string;
  maxHeight?: string;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  error: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
};

export function ActivityFeed({ activities, title = 'Atividades Recentes', maxHeight = '400px' }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activities]);
  
  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <ActivityIcon className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      
      <ScrollArea ref={scrollRef} className="flex-1" style={{ maxHeight }}>
        <div className="space-y-2 pr-2">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma atividade recente</p>
            </div>
          ) : (
            activities.map((activity) => {
              const config = typeConfig[activity.type];
              const Icon = config.icon;
              
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-card/70 transition-colors"
                >
                  {/* Icon */}
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', config.bgColor)}>
                    <Icon className={cn('w-4 h-4', config.color)} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      {activity.agentName && (
                        <span className="text-sm font-medium text-white">{activity.agentName}</span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: ptBR })}
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
