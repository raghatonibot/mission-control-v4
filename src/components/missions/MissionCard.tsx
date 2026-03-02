import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Play, 
  Eye, 
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Pause,
  Square,
  MessageSquare,
  ListTodo,
  Zap
} from 'lucide-react';
import type { Run, RunStatus } from '@/types/run';
import { cn } from '@/lib/utils';

function cleanDisplayText(value?: string) {
  if (!value) return '';
  let out = String(value);
  if (/[ÃÂâ€œ€�™]/.test(out)) {
    try { out = decodeURIComponent(escape(out)); } catch {}
  }
  out = out
    .replace(/\uFFFD/g, '')
    .replace(/ã~¢|â€¢|Ã¢â‚¬Â¢/g, '•')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out;
}

function formatBrasiliaDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  }
}

// Status configuration with icons and colors
const STATUS_CONFIG: Record<RunStatus, { icon: React.ReactNode; label: string; color: string; bgColor: string; borderColor: string }> = {
  queued: { 
    icon: <Clock className="w-3 h-3" />, 
    label: '⏳ Pendente', 
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  running: {  
    icon: <Play className="w-3 h-3" />, 
    label: 'Executando', 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  stopping: {  
    icon: <Square className="w-3 h-3" />, 
    label: 'Parando', 
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30'
  },
  waiting: {  
    icon: <Eye className="w-3 h-3" />, 
    label: 'Aguardando', 
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  review: {  
    icon: <Eye className="w-3 h-3" />, 
    label: 'Review', 
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30'
  },
  done: {  
    icon: <CheckCircle2 className="w-3 h-3" />, 
    label: 'Feito', 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  failed: {  
    icon: <AlertCircle className="w-3 h-3" />, 
    label: 'Falhou', 
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  },
  stopped: {  
    icon: <Square className="w-3 h-3" />, 
    label: 'Parado', 
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30'
  },
};


interface MissionCardProps {
  run: Run;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onAdjust?: (id: string) => void;
  onPause?: (id: string) => void;
  onStop?: (id: string) => void;
  onRetry?: (id: string) => void;
  onMove?: (id: string, status: RunStatus) => void;
  className?: string;
}

// Mock steps based on run status for visual demonstration
function generateMockSteps(run: Run): { id: number; title: string; status: 'pending' | 'running' | 'completed' | 'failed' }[] {
  const steps = [
    { id: 1, title: 'Análise inicial', status: 'completed' as const },
    { id: 2, title: 'Execução principal', status: 'completed' as const },
    { id: 3, title: 'Verificação de resultado', status: 'completed' as const },
    { id: 4, title: 'Finalização', status: 'completed' as const },
  ];
  
  if (run.status === 'queued') {
    return steps.map(s => ({ ...s, status: 'pending' as const }));
  } else if (run.status === 'running') {
    return steps.map((s, i) => ({ 
      ...s, 
      status: i < 2 ? 'completed' : i === 2 ? 'running' : 'pending' as const 
    }));
  } else if (run.status === 'failed') {
    return steps.map((s, i) => ({ 
      ...s, 
      status: i < 2 ? 'completed' : 'failed' as const 
    }));
  } else if (run.status === 'done') {
    return steps.map(s => ({ ...s, status: 'completed' as const }));
  }
  
  return steps;
}

export function MissionCard({ 
  run, 
  onApprove, 
  onReject, 
  onPause,
  onAdjust,
  onStop,
  onRetry,
  onMove,
  className 
}: MissionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const status = STATUS_CONFIG[run.status];
  const steps = generateMockSteps(run);
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;
  
  const isInbox = run.status === 'queued';
  const isWorking = run.status === 'running' || run.status === 'stopping';
  const isReview = run.status === 'review' || run.status === 'waiting';
  
  // Mock comments for demonstration
  const mockComments = run.status === 'review' ? [
    { id: 1, author: run.agentName, text: 'Aguardando aprovação para prosseguir com a implementação.', time: '2 min atrás' },
  ] : [];
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        'bg-card border rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-200',
        isHovered ? 'shadow-lg border-border/80' : 'border-border/50',
        status.borderColor,
        className
      )}
    >
      {/* Status indicator stripe */}
      <div className={cn('h-1 w-full', status.bgColor.replace('/10', '/50'))} />
      
      <div className="p-4">
        {/* 1) Nome do agente/agentes */}
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="w-10 h-10 border-2 border-border/50 shrink-0">
            <AvatarImage src={`/agents/${run.agentId}.svg`} alt={cleanDisplayText(run.agentName || 'Agente')} />
            <AvatarFallback className={cn('text-sm font-medium', status.bgColor, status.color)}>
              {run.agentName?.charAt(0).toUpperCase() || 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h4 className="font-semibold text-white text-sm leading-tight line-clamp-1">{cleanDisplayText(run.agentName || 'Agente')}</h4>
          </div>
        </div>

        {/* 2) Tarefa resumida */}
        <div className="mb-2">
          <div className="text-xs text-muted-foreground line-clamp-2">{cleanDisplayText(run.taskTitle || run.summary || 'Sem tarefa')}</div>
        </div>

        {/* 3) Data/Hora */}
        <div className="mb-2 text-xs text-muted-foreground">{formatBrasiliaDateTime(run.lastUpdateAt || run.queuedAt)}</div>

        {/* 4) Modelo */}
        <div className="mb-2 text-xs text-muted-foreground line-clamp-1">{cleanDisplayText(run.model || 'modelo não definido')}</div>

        {/* 5) Status */}
        <div className="flex items-center gap-2 mb-3">
          <Badge className={cn('text-[10px] px-2 py-0.5', status.bgColor, status.color, status.borderColor)}>
            {status.icon}
            <span className="ml-1">{status.label}</span>
          </Badge>
          
          {run.attempt && run.attempt > 1 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-amber-400 border-amber-500/30">
              <RotateCcw className="w-3 h-3 mr-1" />
              Tentativa {run.attempt}
            </Badge>
          )}
        </div>
        

        {/* Inline Action Buttons */}
        <div className="mb-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
          {isInbox && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.(run.id);
                }}
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-amber-400/30 text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjust?.(run.id);
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Ajustar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-red-400/30 text-red-400 hover:bg-red-400/10 hover:text-red-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject?.(run.id);
                }}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Cancelar
              </Button>
            </>
          )}

          {isWorking && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onPause?.(run.id);
                }}
              >
                <Pause className="w-3.5 h-3.5 mr-1.5" />
                Pausar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-red-400/30 text-red-400 hover:bg-red-400/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onStop?.(run.id);
                }}
              >
                <Square className="w-3.5 h-3.5 mr-1.5" />
                Cancelar
              </Button>
            </>
          )}

          {isReview && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.(run.id);
                }}
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Aprovado
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-amber-400/30 text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject?.(run.id);
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Refazer
              </Button>
            </>
          )}

          {(run.status === 'failed' || run.status === 'stopped') && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] border-blue-400/30 text-blue-400 hover:bg-blue-400/10"
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.(run.id);
              }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          )}
          </div>
        </div>

        {/* Progress Bar (bottom) */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ListTodo className="w-3.5 h-3.5" />
              <span>Progresso</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{completedSteps}/{steps.length}</span>
              <span className="text-muted-foreground">({Math.round(progress)}%)</span>
            </div>
          </div>
          <div className="relative">
            <Progress value={progress} className="h-2" />
            {run.status === 'running' && (
              <motion.div
                className="absolute inset-0 h-2 rounded-full bg-emerald-400/30"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
        </div>

        {/* Footer - Expand */}
        <div className="flex items-center justify-end">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-white">
                {isExpanded ? (
                  <><ChevronUp className="w-4 h-4 mr-1" /> Menos</>
                ) : (
                  <><ChevronDown className="w-4 h-4 mr-1" /> Detalhes</>
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>
      
      {/* Expandable Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/50 bg-background/30"
          >
            <div className="p-4 space-y-4">
              {/* Step Timeline */}
              <div>
                <h5 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  Timeline de Steps
                </h5>
                <div className="space-y-2">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium',
                        step.status === 'completed' && 'bg-emerald-500/20 text-emerald-400',
                        step.status === 'running' && 'bg-blue-500/20 text-blue-400 animate-pulse',
                        step.status === 'failed' && 'bg-red-500/20 text-red-400',
                        step.status === 'pending' && 'bg-gray-500/20 text-gray-500'
                      )}>
                        {step.status === 'completed' ? <Check className="w-3 h-3" /> :
                         step.status === 'failed' ? <X className="w-3 h-3" /> :
                         index + 1}
                      </div>
                      <span className={cn(
                        'text-xs',
                        step.status === 'completed' && 'text-emerald-400 line-through',
                        step.status === 'running' && 'text-blue-400 font-medium',
                        step.status === 'failed' && 'text-red-400',
                        step.status === 'pending' && 'text-muted-foreground'
                      )}>
                        {step.title}
                      </span>
                      {step.status === 'running' && (
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-blue-400"
                          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Agent Comments */}
              {mockComments.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    Comentarios do Agente
                  </h5>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-2">
                      {mockComments.map((comment) => (
                        <div key={comment.id} className="bg-card border border-border/50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar className="w-5 h-5">
                              <AvatarFallback className="text-[8px] bg-violet-500/20 text-violet-400">
                                {comment.author.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] font-medium text-white">{comment.author}</span>
                            <span className="text-[10px] text-muted-foreground">• {comment.time}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* Move Actions */}
              {onMove && (
                <div>
                  <h5 className="text-xs font-semibold text-white mb-3">Mover para</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {(['queued', 'running', 'review', 'done'] as RunStatus[]).map((targetStatus) => (
                      <Button
                        key={targetStatus}
                        size="sm"
                        variant="outline"
                        disabled={run.status === targetStatus}
                        className={cn(
                          'h-6 px-2 text-[10px]',
                          run.status === targetStatus && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMove(run.id, targetStatus);
                        }}
                      >
                        {STATUS_CONFIG[targetStatus].label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Error details if failed */}
              {run.lastError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Erro
                  </h5>
                  <p className="text-xs text-red-300/90 line-clamp-3">{run.lastError}</p>
                </div>
              )}
              
              {/* Run metadata */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                <div>ID: <span className="text-white font-mono">{run.id.slice(0, 8)}...</span></div>
                {run.tokensOutEst && (
                  <div>Tokens: <span className="text-white">{run.tokensOutEst.toLocaleString()}</span></div>
                )}
                {run.retryCount !== undefined && (
                  <div>Retries: <span className="text-white">{run.retryCount}</span></div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}








