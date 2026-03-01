import type { Run } from '@/types/run';

export type RunStage = Run['status'];

export const RUN_STAGE_ORDER: RunStage[] = ['queued', 'running', 'review', 'waiting', 'stopping', 'done', 'failed', 'stopped'];

export const RUN_STAGE_LABEL: Record<RunStage, string> = {
  queued: 'Fila',
  running: 'Rodando',
  review: 'Em revisão',
  waiting: 'Aguardando',
  stopping: 'Parando',
  done: 'Feitas',
  failed: 'Falhas',
  stopped: 'Paradas',
};

export const RUN_STAGE_BADGE: Record<RunStage, string> = {
  queued: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  running: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  review: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  waiting: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  stopping: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  done: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  failed: 'bg-red-500/20 text-red-300 border-red-500/40',
  stopped: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

export const RUN_STAGE_DOT: Record<RunStage, string> = {
  queued: 'bg-violet-400',
  running: 'bg-blue-400',
  review: 'bg-emerald-400',
  waiting: 'bg-amber-400',
  stopping: 'bg-orange-400',
  done: 'bg-emerald-400',
  failed: 'bg-red-400',
  stopped: 'bg-slate-400',
};

export function countRunStages(runs: Run[]) {
  const base: Record<RunStage, number> = {
    queued: 0,
    running: 0,
    review: 0,
    waiting: 0,
    stopping: 0,
    done: 0,
    failed: 0,
    stopped: 0,
  };
  for (const r of runs) base[r.status] = (base[r.status] || 0) + 1;
  return base;
}
