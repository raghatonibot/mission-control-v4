import { useEffect, useMemo, useState } from 'react';
import type { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

export function TasksBoard({ tasks, onReload }: { tasks: Task[]; onReload: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notesByTask, setNotesByTask] = useState<Record<string, { comments: Array<{ id?: string; text?: string; author?: string }>; findings: Array<{ id?: string; text?: string; author?: string }> }>>({});
  const [drafts, setDrafts] = useState<Record<string, { comment: string; finding: string }>>({});

  useEffect(() => {
    let alive = true;
    const loadNotes = async () => {
      const entries = await Promise.all(
        tasks.slice(0, 80).map(async (t) => {
          try {
            const res = await api.cardNotes('task', t.id);
            return [t.id, { comments: res.data.comments || [], findings: res.data.findings || [] }] as const;
          } catch {
            return [t.id, { comments: [], findings: [] }] as const;
          }
        })
      );
      if (!alive) return;
      setNotesByTask(Object.fromEntries(entries));
    };
    void loadNotes();
    return () => {
      alive = false;
    };
  }, [tasks]);

  const byStatus = useMemo(() => {
    const order: Task['status'][] = ['awaiting_approval', 'backlog', 'ready', 'blocked', 'done'];
    const map = new Map<Task['status'], Task[]>();
    for (const s of order) map.set(s, []);
    for (const t of tasks) (map.get(t.status) || map.get('backlog')!).push(t);
    return { order, map };
  }, [tasks]);

  const create = async () => {
    if (!title.trim()) return;
    await api.createTask({ title: title.trim(), description: description.trim() || undefined, priority: 'medium', source: 'ui', autoRun: true });
    setTitle('');
    setDescription('');
    onReload();
  };

  const move = async (id: string, status: Task['status']) => {
    await api.updateTask(id, { status });
    onReload();
  };

  const statusLabel: Record<Task['status'], string> = {
    awaiting_approval: 'Aguardando você',
    cancelled: 'Cancelado',
    backlog: 'Backlog',
    ready: 'Pronto',
    blocked: 'Bloqueado',
    done: 'Feito',
  };

  const runStageLabel: Record<string, string> = {
    none: 'sem run',
    queued: 'fila',
    running: 'rodando',
    stopping: 'parando',
    waiting: 'aguardando',
    review: 'revisão',
    done: 'runs concluídas',
    failed: 'falha em run',
    stopped: 'runs paradas',
    mixed: 'misto',
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <Card className="bg-card border border-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Kanban de subagentes" />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que é e qual saída esperada" />
          </div>
        </div>
        <div className="pt-3">
          <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={create}>Criar Task</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 min-h-0">
        {byStatus.order.map((status) => (
          <div key={status} className="bg-card border border-border rounded-xl p-3 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">{statusLabel[status]}</h3>
              <span className="text-xs text-muted-foreground">{byStatus.map.get(status)!.length}</span>
            </div>
            <div className="space-y-2 overflow-y-auto">
              {byStatus.map.get(status)!.map((t) => (
                <div key={t.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-white text-sm">{t.title}</div>
                    <div className="flex items-center gap-1">
                      {t.runStage && t.runStage !== 'none' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                          {runStageLabel[t.runStage] || t.runStage}
                        </span>
                      ) : null}
                      {t.risk === 'high' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">alto risco</span>
                      ) : null}
                    </div>
                  </div>
                  {t.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{t.description}</div>}
                  <div className="flex flex-wrap gap-2 pt-3">
                    {(t.runStage === 'none' || t.runStage === 'failed' || t.runStage === 'stopped' || t.runStage === 'done') && status !== 'cancelled' && (
                      <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={async () => { await api.startTask(t.id); onReload(); }}>
                        Começar
                      </Button>
                    )}
                    {status === 'awaiting_approval' && (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={async () => { await api.decide({ entityType: 'task', id: t.id, decision: 'approve' }); onReload(); }}>
                          Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => { await api.decide({ entityType: 'task', id: t.id, decision: 'reject' }); onReload(); }}>
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {status !== 'backlog' && (
                      <Button size="sm" variant="outline" onClick={() => move(t.id, 'backlog')}>Backlog</Button>
                    )}
                    {status !== 'ready' && (
                      <Button size="sm" variant="outline" onClick={() => move(t.id, 'ready')}>Pronto</Button>
                    )}
                    {status !== 'blocked' && (
                      <Button size="sm" variant="outline" onClick={() => move(t.id, 'blocked')}>Bloqueado</Button>
                    )}
                    {status !== 'done' && (
                      <Button size="sm" variant="outline" onClick={() => move(t.id, 'done')}>Feito</Button>
                    )}
                  </div>
                  <div className="mt-3 space-y-2 border-t border-border pt-2">
                    <div className="text-[11px] text-muted-foreground">Comentários ({notesByTask[t.id]?.comments?.length || 0}) • Achados ({notesByTask[t.id]?.findings?.length || 0})</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2">{notesByTask[t.id]?.comments?.slice(-1)[0]?.text || 'Sem comentários'}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2">{notesByTask[t.id]?.findings?.slice(-1)[0]?.text || 'Sem achados'}</div>
                    <div className="flex gap-2">
                      <Input
                        value={drafts[t.id]?.comment || ''}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { comment: e.target.value, finding: prev[t.id]?.finding || '' } }))}
                        placeholder="Novo comentário"
                      />
                      <Button size="sm" variant="outline" onClick={async () => {
                        const text = (drafts[t.id]?.comment || '').trim();
                        if (!text) return;
                        await api.addCardComment('task', t.id, text);
                        const res = await api.cardNotes('task', t.id);
                        setNotesByTask((prev) => ({ ...prev, [t.id]: { comments: res.data.comments || [], findings: res.data.findings || [] } }));
                        setDrafts((prev) => ({ ...prev, [t.id]: { comment: '', finding: prev[t.id]?.finding || '' } }));
                      }}>Salvar</Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={drafts[t.id]?.finding || ''}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { comment: prev[t.id]?.comment || '', finding: e.target.value } }))}
                        placeholder="Novo achado"
                      />
                      <Button size="sm" variant="outline" onClick={async () => {
                        const text = (drafts[t.id]?.finding || '').trim();
                        if (!text) return;
                        await api.addCardFinding('task', t.id, text);
                        const res = await api.cardNotes('task', t.id);
                        setNotesByTask((prev) => ({ ...prev, [t.id]: { comments: res.data.comments || [], findings: res.data.findings || [] } }));
                        setDrafts((prev) => ({ ...prev, [t.id]: { comment: prev[t.id]?.comment || '', finding: '' } }));
                      }}>Salvar</Button>
                    </div>
                  </div>
                </div>
              ))}
              {byStatus.map.get(status)!.length === 0 && (
                <div className="text-xs text-muted-foreground">Sem tasks</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
