import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Run } from '@/types/run';

export function RunsFinalizadas() {
  const [runs, setRuns] = useState<Run[]>([]);

  const load = async () => {
    try {
      const res = await api.runs();
      setRuns((res.data || []) as Run[]);
    } catch {
      setRuns([]);
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 7000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo(
    () => runs.filter((r) => r.status === 'done' || r.status === 'failed' || r.status === 'stopped'),
    [runs]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Runs Finalizadas</h1>
        <p className="text-muted-foreground">Histórico de runs concluídas, falhadas e paradas</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 md:p-5">
        <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-auto pr-1">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma run finalizada ainda.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3 bg-background/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white line-clamp-1">{r.taskTitle}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-card">{r.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{r.agentName} • {r.model} • {r.id}</p>
                {r.summary ? <p className="text-xs text-foreground/90 mt-2 line-clamp-3">{r.summary}</p> : null}
                {r.lastError ? <p className="text-xs text-red-300 mt-2 line-clamp-2">erro: {r.lastError}</p> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
