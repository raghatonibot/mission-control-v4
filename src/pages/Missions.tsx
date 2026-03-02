import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, ListTodo, Play, Kanban, Lightbulb } from 'lucide-react';
// import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Task } from '@/types/task';
import type { Run } from '@/types/run';
import { MissionsKanban } from '@/components/missions/MissionsKanban';
import { TasksBoard } from '@/pages/missions/TasksBoard';
import { RunsKanban } from '@/pages/missions/RunsKanban';
import { BacklogBoard } from '@/components/missions/BacklogBoard';
import { countRunStages, RUN_STAGE_DOT, RUN_STAGE_LABEL, RUN_STAGE_ORDER } from '@/lib/runStage';

export function Missions() {
  const [tab, setTab] = useState<'tasks' | 'runs' | 'backlog'>('runs'); // Default to runs for new kanban
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'pipeline' | 'list'>('kanban'); // New kanban as default
  const [nowTs, setNowTs] = useState(() => Date.now());

  const reload = async (opts?: { alive?: () => boolean; inFlightRef?: { current: boolean } }) => {
    const alive = opts?.alive || (() => true);
    const inFlightRef = opts?.inFlightRef;
    if (inFlightRef?.current) return;
    if (inFlightRef) inFlightRef.current = true;
    try {
      const [t, r] = await Promise.all([api.tasks(), api.runs()]);
      if (!alive()) return;
      setTasks(t.data || []);
      setRuns(r.data || []);
    } catch {
      // ignore
    } finally {
      if (inFlightRef) inFlightRef.current = false;
    }
  };

  useEffect(() => {
    let alive = true;
    const inFlightRef = { current: false };

    void reload({ alive: () => alive, inFlightRef });
    const id = window.setInterval(() => {
      setNowTs(Date.now());
      void reload({ alive: () => alive, inFlightRef });
    }, 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const stats = useMemo(() => countRunStages(runs), [runs]);
  const retryingNow = useMemo(
    () => runs.filter((r) => r.status === 'queued' && !!r.nextRetryAt && new Date(r.nextRetryAt).getTime() > nowTs).length,
    [runs, nowTs]
  );

  const activeRuns = useMemo(
    () => runs.filter((r) => ['queued', 'running', 'stopping', 'waiting', 'review'].includes(String(r.status))),
    [runs]
  );
  // const taskRows = useMemo(() => tasks.slice(0, 200), [tasks]);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Missões</h1>
          <p className="text-muted-foreground">Gerencie execuções com visualização Kanban</p>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'runs' && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'kanban' | 'pipeline' | 'list')}>
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="kanban" className="gap-2">
                  <Kanban className="w-4 h-4" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <Play className="w-4 h-4" />
                  Lista
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'tasks' | 'runs' | 'backlog')}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="runs" className="gap-2">
              <Play className="w-4 h-4" />
              Runs
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodo className="w-4 h-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="backlog" className="gap-2">
              <Lightbulb className="w-4 h-4" />
              Ideias
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {retryingNow > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-sm text-amber-300">
          Retries agendados agora: {retryingNow}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {RUN_STAGE_ORDER.map((s) => (
          <div key={s} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${RUN_STAGE_DOT[s]}`} />
              <span className="text-xs text-muted-foreground">{RUN_STAGE_LABEL[s]}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats[s] || 0}</p>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        {tab === 'tasks' ? (
          <TasksBoard tasks={tasks} onReload={reload} />
        ) : tab === 'backlog' ? (
          <BacklogBoard />
        ) : (
          <>
            {viewMode === 'kanban' && (
              <MissionsKanban runs={runs} onReload={reload} />
            )}
            {viewMode === 'pipeline' && (
              <RunsKanban runs={runs} onReload={reload} />
            )}
            {viewMode === 'list' && (
              <div className="bg-card border border-border rounded-xl p-4 md:p-5">
                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-auto">
                  {activeRuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem runs ativas.</p>
                  ) : (
                    activeRuns.map((r) => (
                      <div key={r.id} className="rounded-lg border border-border p-3 bg-background/40">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white line-clamp-1">{r.taskTitle}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-card">{r.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{r.agentName} • {r.model}</p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          tentativa {Number(r.attempt || 1)} • retries {Number(r.retryCount || 0)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}



