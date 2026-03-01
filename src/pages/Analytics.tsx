import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Run } from '@/types/run';
import type { Task } from '@/types/task';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Activity, CheckCircle, Clock, TrendingUp } from 'lucide-react';

export function Analytics() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const reload = async () => {
    try {
      const [r, t] = await Promise.all([api.runs(), api.tasks()]);
      setRuns(r.data || []);
      setTasks(t.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const agents = useMemo(() => {
    const names = Array.from(new Set(runs.map((r) => r.agentName).filter(Boolean)));
    return names.sort();
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (selectedAgent === 'all') return runs;
    return runs.filter((r) => r.agentName === selectedAgent);
  }, [runs, selectedAgent]);

  const totalRuns = filteredRuns.length;
  const doneRuns = filteredRuns.filter((r) => r.status === 'done').length;
  const runningRuns = filteredRuns.filter((r) => r.status === 'running').length;
  const successRate = totalRuns > 0 ? Math.round((doneRuns / totalRuns) * 100) : 0;

  const agentBars = useMemo(() => {
    const map = new Map<string, { name: string; done: number; running: number; failed: number }>();
    runs.forEach((r) => {
      const key = r.agentName || 'unknown';
      if (!map.has(key)) map.set(key, { name: key, done: 0, running: 0, failed: 0 });
      const row = map.get(key)!;
      if (r.status === 'done') row.done += 1;
      if (r.status === 'running') row.running += 1;
      if (r.status === 'failed') row.failed += 1;
    });
    return Array.from(map.values()).slice(0, 12);
  }, [runs]);

  const recentRuns = useMemo(() => filteredRuns.slice(0, 8), [filteredRuns]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-muted-foreground">Métricas reais por agente e execução</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload}>Atualizar</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={selectedAgent === 'all' ? 'default' : 'outline'} onClick={() => setSelectedAgent('all')}>Todos</Button>
        {agents.map((a) => (
          <Button key={a} size="sm" variant={selectedAgent === a ? 'default' : 'outline'} onClick={() => setSelectedAgent(a)}>{a}</Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Runs" value={totalRuns} subtitle="escopo filtrado" icon={Activity} />
        <MetricCard title="Concluídas" value={doneRuns} subtitle="status done" icon={CheckCircle} />
        <MetricCard title="Em execução" value={runningRuns} subtitle="status running" icon={Clock} />
        <MetricCard title="Success Rate" value={`${successRate}%`} subtitle="done / total" icon={TrendingUp} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 h-[360px]">
        <h3 className="font-semibold text-white mb-3">Runs por agente</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={agentBars}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="done" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="running" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Últimas runs</h3>
          <div className="space-y-2 max-h-72 overflow-auto">
            {recentRuns.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : recentRuns.map((r) => (
              <div key={r.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white line-clamp-1">{r.taskTitle}</p>
                  <span className="text-xs text-muted-foreground">{r.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{r.agentName} • {r.model}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Resumo Tasks</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Tasks</span><span className="text-white">{tasks.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Backlog</span><span className="text-white">{tasks.filter((t) => t.status === 'backlog').length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ready</span><span className="text-white">{tasks.filter((t) => t.status === 'ready').length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Done</span><span className="text-white">{tasks.filter((t) => t.status === 'done').length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Aguardando aprovação</span><span className="text-white">{tasks.filter((t) => t.status === 'awaiting_approval').length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
