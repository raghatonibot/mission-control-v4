import { cn } from '@/lib/utils';

type StatusType = 'active' | 'idle' | 'offline' | 'queued' | 'running' | 'completed' | 'failed' | 'proposed';

interface StatusBadgeProps {
  status: StatusType;
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; color: string; bgColor: string; dotColor: string }> = {
  active: {
    label: 'Ativo',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-400/10',
    dotColor: 'bg-emerald-500',
  },
  idle: {
    label: 'Ocioso',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-400/10',
    dotColor: 'bg-amber-500',
  },
  offline: {
    label: 'Offline',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-400/10',
    dotColor: 'bg-gray-500',
  },
  queued: {
    label: 'Em fila',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-400/10',
    dotColor: 'bg-indigo-500',
  },
  running: {
    label: 'Em execução',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-400/10',
    dotColor: 'bg-blue-500',
  },
  completed: {
    label: 'Concluído',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-400/10',
    dotColor: 'bg-emerald-500',
  },
  failed: {
    label: 'Falhou',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-400/10',
    dotColor: 'bg-red-500',
  },
  proposed: {
    label: 'Proposto',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-400/10',
    dotColor: 'bg-violet-500',
  },
};

export function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.color,
        config.bgColor,
        'border-transparent',
        className
      )}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
      )}
      {config.label}
    </span>
  );
}
