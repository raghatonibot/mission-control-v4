import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Agent } from '@/types/agent';
import type { Run } from '@/types/run';
import { RUN_STAGE_LABEL, RUN_STAGE_BADGE } from '@/lib/runStage';

type StageEvent = {
  at?: number | string;
  type?: string;
  runId?: string;
  status?: string;
  error?: string;
};

export function Stage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);

  const reload = async () => {
    try {
      const [a, r, e] = await Promise.all([api.agents(), api.runs(), api.events({ limit: 120 })]);
      setAgents(a.data || []);
      const rs = r.data || [];
      setRuns(rs);
      setEvents((e.data.events || []) as StageEvent[]);
      if (selectedRun) {
        const next = rs.find((x) => x.id === selectedRun.id);
        setSelectedRun(next || null);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(id);
  }, []);

  const activeRuns = useMemo(
    () => runs.filter((r) => ['running', 'queued', 'stopping', 'review', 'waiting'].includes(r.status)),
    [runs]
  );

  const onPause = async (id: string) => { await api.pauseRun(id); await reload(); };
  const onStop = async (id: string) => { await api.stopRun(id); await reload(); };
  const onRetry = async (id: string) => { await api.retryRun(id); await reload(); };

  const runEvents = useMemo(
    () => (selectedRun ? events.filter((e) => e.runId === selectedRun.id).slice(0, 20) : []),
    [events, selectedRun]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mission Stage</h1>
          <p className="text-muted-foreground">Operação em tempo real com ações diretas</p>
        </div>
        <Button size="sm" variant="outline" onClick={reload}>Atualizar</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Agentes</h3>
          <div className="space-y-2 max-h-[440px] overflow-auto">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                <div className="text-sm text-foreground">{a.emoji} {a.name}</div>
                <Badge variant="secondary" className={a.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}>
                  {a.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
          <h3 className="font-semibold text-white mb-3">Runs ativas ({activeRuns.length})</h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {activeRuns.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem runs ativas.</div>
            ) : (
              activeRuns.map((r) => (
                <div key={r.id} className={`border rounded-lg p-3 ${selectedRun?.id === r.id ? 'border-emerald-500/60' : 'border-border'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setSelectedRun(r)} className="text-sm font-medium text-foreground line-clamp-1 text-left hover:text-emerald-300">
                      {r.taskTitle}
                    </button>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${RUN_STAGE_BADGE[r.status]}`}>
                      {RUN_STAGE_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{r.agentName} • {r.model}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => onPause(r.id)}>Pausar</Button>
                    <Button size="sm" variant="outline" onClick={() => onStop(r.id)}>Parar</Button>
                    <Button size="sm" variant="outline" onClick={() => onRetry(r.id)}>Retry</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3">Event Stream {selectedRun ? `(run ${selectedRun.id.slice(0, 8)})` : '(geral)'}</h3>
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {(selectedRun ? runEvents : events.slice(0, 20)).length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem eventos.</div>
          ) : (
            (selectedRun ? runEvents : events.slice(0, 20)).map((e, i) => (
              <div key={i} className="text-xs border border-border rounded-lg px-3 py-2 text-foreground/90">
                {e.at ? new Date(e.at).toLocaleString() : '-'} • {e.type} • run={e.runId}
                {e.status ? ` • status=${e.status}` : ''}
                {e.error ? ` • erro=${String(e.error).slice(0, 120)}` : ''}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
