import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MissionCard } from '@/components/missions/MissionCard';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Inbox, 
  Play, 
  Eye, 
  CheckCircle2, 
  AlertTriangle,
  Plus,
  Filter,
  Search,
  Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Run, RunStatus } from '@/types/run';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// Column configuration
interface ColumnConfig {
  id: RunStatus;
  title: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'queued',
    title: 'Inbox',
    icon: <Inbox className="w-4 h-4" />,
    description: 'Pendente',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  {
    id: 'running',
    title: 'Working',
    icon: <Play className="w-4 h-4" />,
    description: 'Executando',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  {
    id: 'review',
    title: 'Review',
    icon: <Eye className="w-4 h-4" />,
    description: 'Em revisão',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
  },
  {
    id: 'done',
    title: 'Done',
    icon: <CheckCircle2 className="w-4 h-4" />,
    description: 'Concluído',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'failed',
    title: 'Failed',
    icon: <AlertTriangle className="w-4 h-4" />,
    description: 'Falhou / Parou',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
];

interface MissionsKanbanProps {
  runs: Run[];
  onReload: () => void;
}

export function MissionsKanban({ runs, onReload }: MissionsKanbanProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  
  // Filter runs based on search and priority
  const filteredRuns = useMemo(() => {
    return runs.filter(run => {
      const matchesSearch = !searchQuery || 
        run.taskTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.agentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.model?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPriority = !filterPriority || run.priority === filterPriority;
      
      return matchesSearch && matchesPriority;
    });
  }, [runs, searchQuery, filterPriority]);
  
  // Group runs by status
  const runsByColumn = useMemo(() => {
    const map = new Map<RunStatus, Run[]>();
    
    // Initialize empty arrays for each column
    for (const col of COLUMNS) {
      map.set(col.id, []);
    }
    
    // Assign runs to columns
    for (const run of filteredRuns) {
      // Map 'waiting' and 'stopping' to appropriate columns for simplicity
      let targetStatus: RunStatus = run.status;
      if (run.status === 'waiting') targetStatus = 'review';
      if (run.status === 'stopping') targetStatus = 'running';
      if (run.status === 'stopped') targetStatus = 'failed';
      
      const column = map.get(targetStatus);
      if (column) {
        column.push(run);
      }
    }
    
    return map;
  }, [filteredRuns]);
  
  // Action handlers - using available API methods
  const handleApprove = async (id: string) => {
    await api.decide({ entityType: 'run', id, decision: 'approve' });
    onReload();
  };
  
  const handleReject = async (id: string) => {
    await api.decide({ entityType: 'run', id, decision: 'reject' });
    onReload();
  };
  
  const handlePause = async (id: string) => {
    await api.pauseRun(id);
    onReload();
  };
  
  const handleStop = async (id: string) => {
    await api.stopRun(id);
    onReload();
  };
  
  const handleRetry = async (id: string) => {
    await api.retryRun(id);
    onReload();
  };
  
  const handleMove = async (id: string, targetStatus: RunStatus) => {
    // Map simplified statuses back to actual API actions
    if (targetStatus === 'done') {
      // Can't directly set to done - would need specific API
      console.log('Move to done:', id);
    }
    onReload();
  };
  
  const handleDragStart = (e: React.DragEvent, runId: string, currentStatus: RunStatus) => {
    e.dataTransfer.setData('runId', runId);
    e.dataTransfer.setData('currentStatus', currentStatus);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = async (e: React.DragEvent, targetStatus: RunStatus) => {
    e.preventDefault();
    const runId = e.dataTransfer.getData('runId');
    const currentStatus = e.dataTransfer.getData('currentStatus') as RunStatus;
    
    if (runId && currentStatus !== targetStatus) {
      await handleMove(runId, targetStatus);
    }
  };
  
  const priorityOptions = [
    { value: 'critical', label: 'Crítica', color: 'text-red-400' },
    { value: 'high', label: 'Alta', color: 'text-red-400' },
    { value: 'medium', label: 'Média', color: 'text-yellow-400' },
    { value: 'low', label: 'Baixa', color: 'text-emerald-400' },
  ];
  
  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header with search and filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
      >
        <div className="relative flex-1 max-w-md"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar missões..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        
        <div className="flex items-center gap-2"
        >
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Prioridade:</span>
          </div>
          
          <div className="flex gap-1"
          >
            <Button
              size="sm"
              variant={filterPriority === null ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => setFilterPriority(null)}
            >
              Todas
            </Button>
            {priorityOptions.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={filterPriority === opt.value ? 'default' : 'outline'}
                className={cn('h-7 px-2 text-xs', filterPriority === opt.value && opt.color)}
                onClick={() => setFilterPriority(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Kanban Board */}
      <div className="flex-1 min-h-0 overflow-x-auto"
      >
        <div className="flex gap-4 h-full min-w-max pb-2"
        >
          {COLUMNS.map((column) => {
            const columnRuns = runsByColumn.get(column.id) || [];
            
            return (
              <motion.div
                key={column.id}
                layout
                className={cn(
                  'w-[320px] shrink-0 flex flex-col rounded-xl border transition-colors',
                  column.bgColor,
                  column.borderColor,
                  'bg-opacity-30'
                )}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className={cn(
                  'p-3 border-b rounded-t-xl',
                  column.bgColor,
                  column.borderColor
                )}
                >
                  <div className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2"
                    >
                      <div className={cn('p-1.5 rounded-lg bg-background/50', column.color)}
                      >
                        {column.icon}
                      </div>
                      <div>
                        <h3 className={cn('font-semibold text-sm', column.color)}
                        >
                          {column.title}
                        </h3>
                        <p className="text-[10px] text-muted-foreground"
                        >
                          {column.description}
                        </p>
                      </div>
                    </div>
                    
                    <Badge variant="secondary" className="text-xs"
                    >
                      {columnRuns.length}
                    </Badge>
                  </div>
                </div>
                
                {/* Column Content */}
                <ScrollArea className="flex-1 p-3"
                >
                  <div className="space-y-3 min-h-[100px]"
                  >
                    {columnRuns.map((run, index) => (
                      <motion.div
                        key={run.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        draggable
                        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, run.id, column.id)}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <MissionCard
                          run={run}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          onPause={handlePause}
                          onStop={handleStop}
                          onRetry={handleRetry}
                          onMove={handleMove}
                        />
                      </motion.div>
                    ))}
                    
                    {columnRuns.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center"
                      >
                        <div className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center mb-2',
                          column.bgColor
                        )}
                        >
                          {column.icon}
                        </div>
                        <p className="text-xs text-muted-foreground"
                        >
                          Nenhuma missão
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Column Footer */}
                <div className="p-3 border-t border-border/30"
                >
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-8 text-xs text-muted-foreground hover:text-white"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Adicionar missão
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Quick Stats Footer */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/50"
      >
        <div className="flex items-center gap-1.5"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Total: {runs.length} missões</span>
        </div>
        <div className="flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400"
          />
          <span>{runsByColumn.get('queued')?.length || 0} pendentes</span>
        </div>
        <div className="flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"
          />
          <span>{runsByColumn.get('running')?.length || 0} executando</span>
        </div>
        <div className="flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-full bg-violet-400"
          />
          <span>{runsByColumn.get('review')?.length || 0} em revisão</span>
        </div>
      </div>
    </div>
  );
}



