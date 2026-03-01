import { useEffect, useMemo, useState } from 'react';
import { VirtualOffice } from '@/components/dashboard/VirtualOffice';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { api } from '@/lib/api';
import type { Agent } from '@/types/agent';
import type { Run } from '@/types/run';
import type { Task } from '@/types/task';
import { AlertTriangle, Bot, ClipboardList, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EventItem = {
  at?: number | string;
  type?: string;
  runId?: string;
  message?: string;
};

function fmtAt(v?: number | string) {
  if (!v) return '-';
  return typeof v === 'number' ? new Date(v).toLocaleTimeString() : new Date(String(v)).toLocaleTimeString();
}

export function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  const reload = async (opts?: { alive?: () => boolean; inFlightRef?: { current: boolean } }) => {
    const alive = opts?.alive || (() => true);
    const inFlightRef = opts?.inFlightRef;
    if (inFlightRef?.current) return;
    if (inFlightRef) inFlightRef.current = true;
    try {
      const [a, r, t, e] = await Promise.all([
        api.agentsLive().catch(() => api.agents()),
        api.runs(),
        api.tasks(),
        api.events({ limit: 40 }),
      ]);

      if (!alive()) return;
      const agentData = Array.isArray((a as { data?: unknown[] }).data) ? ((a as { data?: unknown[] }).data as Agent[]) : [];
      setAgents(agentData || []);
      setRuns(r.data || []);
      setTasks(t.data || []);
      setEvents(((e.data.events || []) as EventItem[]).slice(0, 12));
    } catch {
      // noop
    } finally {
      if (inFlightRef) inFlightRef.current = false;
    }
  };

  useEffect(() => {
    let alive = true;
    const inFlightRef = { current: false };

    void reload({ alive: () => alive, inFlightRef });
    const id = window.setInterval(() => void reload({ alive: () => alive, inFlightRef }), 6000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const runsAtivas = useMemo(() => runs.filter((r) => ['queued', 'running', 'review', 'waiting', 'stopping'].includes(r.status)).length, [runs]);
  const tasksCriticas = useMemo(() => tasks.filter((t) => ['critical', 'high'].includes(String(t.priority)) && t.status !== 'done').length, [tasks]);
  const alertas = useMemo(() => runs.filter((r) => r.status === 'failed').length, [runs]);
  const agentesOnline = useMemo(() => agents.filter((a) => ['active', 'online'].includes(String(a.status))).length, [agents]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Início</h1>
          <p className="text-muted-foreground">Controle operacional com foco no que importa agora</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void reload()}>Atualizar</Button>
      </div>

      {/* Escritório virtual em evidência */}
      <VirtualOffice height={560} />

      {/* poucos cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Runs ativas" value={runsAtivas} subtitle="execução em andamento" icon={PlayCircle} />
        <MetricCard title="Tasks críticas" value={tasksCriticas} subtitle="alta/critical pendentes" icon={ClipboardList} />
        <MetricCard title="Alertas" value={alertas} subtitle="runs com falha" icon={AlertTriangle} />
        <MetricCard title="Saúde dos agentes" value={`${agentesOnline}/${agents.length || 0}`} subtitle="online/total" icon={Bot} />
      </div>

      {/* feed compacto */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Feed rápido</h3>
          <span className="text-xs text-muted-foreground">últimos {events.length}</span>
        </div>
        <div className="space-y-2 max-h-56 overflow-auto">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos recentes.</p>
          ) : (
            events.map((e, i) => (
              <div key={i} className="text-sm border border-border rounded-lg px-3 py-2 bg-background/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground font-medium">{String(e.type || 'event')}</span>
                  <span className="text-xs text-muted-foreground">{fmtAt(e.at)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {e.message || '-'} {e.runId ? `• run=${e.runId}` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
