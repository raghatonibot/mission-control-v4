import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Activity } from '@/types/activity';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

interface ActivityItemProps {
  activity: Activity;
  className?: string;
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

export function ActivityItem({ activity, className }: ActivityItemProps) {
  const config = typeConfig[activity.type];
  const Icon = config.icon;
  
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg hover:bg-card/50 transition-colors cursor-pointer group',
        className
      )}
    >
      {/* Icon */}
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', config.bgColor)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {activity.agentName && (
            <span className="text-sm font-medium text-white">{activity.agentName}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{activity.message}</p>
      </div>
    </div>
  );
}
