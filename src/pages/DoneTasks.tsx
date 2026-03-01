import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type DoneTask = {
  id: string;
  title: string;
  priority?: string;
  source?: string;
  completedAt?: string | null;
  finalRunId?: string | null;
  finalAgentName?: string | null;
  finalSummary?: string;
};

export function DoneTasks() {
  const [items, setItems] = useState<DoneTask[]>([]);

  const load = async () => {
    try {
      const res = await api.doneTasks();
      setItems((res.data || []) as DoneTask[]);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 7000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo(() => items, [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tarefas Feitas</h1>
        <p className="text-muted-foreground">Histórico finalizado com resumo e agente responsável</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Concluídas</h3>
          <span className="text-sm text-muted-foreground">{rows.length} itens</span>
        </div>

        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-3 pr-4">
            {rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma tarefa concluída ainda.</div>
            ) : (
              rows.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-medium text-foreground">{t.title}</p>
                    <Badge variant="secondary">done</Badge>
                    {t.priority ? <Badge variant="outline">{t.priority}</Badge> : null}
                    {t.source ? <Badge variant="outline">{t.source}</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Agente: {t.finalAgentName || '-'} • Run: {t.finalRunId || '-'} • Concluída em:{' '}
                    {t.completedAt ? new Date(t.completedAt).toLocaleString() : '-'}
                  </p>
                  {t.finalSummary ? (
                    <p className="text-sm text-foreground/90 mt-2 line-clamp-3">{t.finalSummary}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">Sem resumo final.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
