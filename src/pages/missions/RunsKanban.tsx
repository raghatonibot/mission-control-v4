import { useEffect, useMemo, useState } from 'react';
import type { Run, RunStatus } from '@/types/run';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

const columns: { id: RunStatus; title: string }[] = [
  { id: 'queued', title: 'Fila' },
  { id: 'running', title: 'Rodando' },
  { id: 'stopping', title: 'Parando' },
  { id: 'waiting', title: 'Aguardando você' },
  { id: 'review', title: 'Em revisao' },
];

const AGENT_OPTIONS = ['ragha', 'ironman', 'fury', 'shuri', 'thor', 'hulk', 'pepper', 'blackwidow', 'hawkeye', 'wanda'];

type RunEvent = {
  at?: number | string;
  type?: string;
  from?: string;
  status?: string;
  tools?: string[];
  model?: string;
  tokensOutEst?: number;
  retryCount?: number;
  max?: number;
  nextRetryAt?: string;
  message?: string;
  error?: string;
};

type ThreadMessage = {
  role?: string;
  content?: string;
  at?: string | number;
};

function formatEvent(e: RunEvent) {
  const atVal = e?.at;
  const at = atVal
    ? (typeof atVal === 'number'
        ? new Date(atVal).toLocaleString()
        : new Date(String(atVal)).toLocaleString())
    : '';
  const type = String(e?.type || 'event');
  const from = e?.from ? `from=${e.from}` : '';
  const status = e?.status ? `status=${e.status}` : '';

  if (type === 'tool_violation') {
    const tools = Array.isArray(e?.tools) ? e.tools.join(', ') : '-';
    return `${at} ⬢ tool_violation ⬢ tools=${tools}`.trim();
  }

  if (type === 'usage_estimate') {
    const model = e?.model ? `model=${e.model}` : '';
    const t = Number.isFinite(e?.tokensOutEst) ? `tokens(est)=${e.tokensOutEst}` : '';
    return `${at} ⬢ usage_estimate ${model} ${t}`.trim();
  }

  if (type === 'retry_scheduled') {
    const rc = Number(e?.retryCount || 0);
    const mx = Number(e?.max || 0);
    const next = e?.nextRetryAt ? new Date(String(e.nextRetryAt)).toLocaleString() : '-';
    return `${at} ⬢ retry_scheduled ⬢ tentativa ${rc}/${mx} ⬢ próximo: ${next}`;
  }

  const msg = e?.message ? `msg: ${String(e.message).slice(0, 180)}` : '';
  const err = e?.error ? `erro: ${String(e.error).slice(0, 180)}` : '';
  return `${at} ⬢ ${type}${status ? ' ⬢ ' + status : ''}${from ? ' ⬢ ' + from : ''} ${msg || err}`.trim();
}

export function RunsKanban({ runs, onReload }: { runs: Run[]; onReload: () => void }) {
  const isTerminalRun = (status?: RunStatus) => status === 'failed' || status === 'stopped' || status === 'done';
  const byStatus = useMemo(() => {
    const map = new Map<RunStatus, Run[]>();
    for (const c of columns) map.set(c.id, []);
    for (const r of runs) (map.get(r.status) || map.get('queued')!).push(r);
    return map;
  }, [runs]);

  const [openRun, setOpenRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [reassignAgent, setReassignAgent] = useState('ragha');
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [notes, setNotes] = useState<{ comments: Array<{ id?: string; text?: string; author?: string }>; findings: Array<{ id?: string; text?: string; author?: string }> }>({ comments: [], findings: [] });
  const [commentDraft, setCommentDraft] = useState('');
  const [findingDraft, setFindingDraft] = useState('');

  const openRunId = openRun?.id;
  const openRunStatus = openRun?.status;
  const openRunNextRetryAt = openRun?.nextRetryAt;

  useEffect(() => {
    if (!openRunId) return;
    let alive = true;

    const load = async () => {
      try {
        const [ev, th, nt] = await Promise.all([api.events({ runId: openRunId, limit: 500 }), api.runThread(openRunId, 120), api.cardNotes('run', openRunId)]);
        if (!alive) return;
        setEvents((ev.data.events || []) as RunEvent[]);
        setThread((th.data || []) as ThreadMessage[]);
        setNotes({ comments: (nt.data.comments || []) as Array<{ id?: string; text?: string; author?: string }>, findings: (nt.data.findings || []) as Array<{ id?: string; text?: string; author?: string }> });
      } catch {
        if (!alive) return;
        setEvents([]);
        setThread([]);
      }
    };

    void load();
    const id = window.setInterval(() => {
      void load();
    }, 3000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [openRunId]);

  useEffect(() => {
    const needsClock = openRunStatus === 'stopping' || (openRunStatus === 'queued' && !!openRunNextRetryAt);
    if (!needsClock) return;
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [openRunStatus, openRunNextRetryAt]);

  const stop = async (id: string) => {
    await api.stopRun(id);
    onReload();
  };

  const pause = async (id: string) => {
    await api.pauseRun(id);
    onReload();
  };

  const retry = async (id: string) => {
    await api.retryRun(id);
    onReload();
  };

  const reassign = async (id: string, agentId?: string) => {
    const run = runs.find((x) => x.id === id);
    if (!isTerminalRun(run?.status)) return;
    const target = String(agentId || reassignAgent || '').trim();
    if (!target) return;
    await api.reassignRun(id, target);
    onReload();
  };

  const lines = useMemo(() => events.map(formatEvent), [events]);
  const threadLines = useMemo(
    () =>
      thread.map((m) => {
        const at = m?.at ? new Date(m.at).toLocaleString() : '';
        const role = String(m?.role || 'msg');
        const body = String(m?.content || '').replace(/\s+/g, ' ').slice(0, 500);
        return `${at} ⬢ ${role} ⬢ ${body}`.trim();
      }),
    [thread]
  );

  return (
    <>
      <Dialog open={!!openRun} onOpenChange={(v) => (v ? undefined : setOpenRun(null))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Timeline do Run</DialogTitle>
            <DialogDescription>
              {openRun
                ? `${openRun.id} ⬢ ${openRun.agentName} ⬢ ${openRun.status}`
                : ''}
              {openRun?.status === 'review' ? (
                <div className="mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                    Em revisao (verifier)
                  </span>
                </div>
              ) : null}
              {openRun?.status === 'stopping' && openRun?.stopRequestedAt ? (
                <div className="text-xs text-muted-foreground mt-1">
                  Parando há {Math.max(0, Math.floor((nowTs - new Date(openRun.stopRequestedAt).getTime()) / 1000))}s
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                Tentativa: {Number(openRun?.attempt || 1)} ⬢ Retries: {Number(openRun?.retryCount || 0)}
              </div>
              {openRun?.status === 'queued' && openRun?.nextRetryAt ? (
                <div className="text-xs text-amber-300">
                  Retry agendado em {Math.max(0, Math.floor((new Date(openRun.nextRetryAt).getTime() - nowTs) / 1000))}s
                </div>
              ) : null}
              {openRun?.lastError ? (
                <div className="text-xs text-red-300 line-clamp-2">Ultimo erro: {openRun.lastError}</div>
              ) : null}
              {Number.isFinite(openRun?.tokensOutEst) ? (
                <div className="text-xs text-muted-foreground">
                  Tokens (est.): {openRun?.tokensOutEst}
                </div>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {openRun && (
            <div className="space-y-3">
              <div className="text-sm text-foreground/90">
                <div className="font-medium">{openRun.taskTitle}</div>
                {openRun.summary && <div className="text-muted-foreground mt-1 whitespace-pre-wrap">{openRun.summary}</div>}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {isTerminalRun(openRun.status) && (
                  <>
                    <select
                      value={reassignAgent}
                      onChange={(e) => setReassignAgent(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {AGENT_OPTIONS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </>
                )}
                {(openRun.status === 'running' || openRun.status === 'stopping' || openRun.status === 'queued' || openRun.status === 'waiting' || openRun.status === 'review') && (
                  <>
                    {(openRun.status === 'waiting' || openRun.status === 'review') && (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={async () => { await api.decide({ entityType: 'run', id: openRun.id, decision: 'approve' }); onReload(); setOpenRun(null); }}>
                          Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => { await api.decide({ entityType: 'run', id: openRun.id, decision: 'reject' }); onReload(); setOpenRun(null); }}>
                          Rejeitar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => pause(openRun.id)}>
                      Pausar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => stop(openRun.id)}>
                      Parar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => api.stopRunAll(openRun.id)}>
                      Parar Tudo
                    </Button>
                  </>
                )}
                {(openRun.status === 'failed' || openRun.status === 'stopped') && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => retry(openRun.id)}>
                      Retry
                    </Button>
                  </>
                )}
                {isTerminalRun(openRun.status) && (
                  <Button size="sm" variant="outline" onClick={() => reassign(openRun.id, reassignAgent)}>
                    Reatribuir
                  </Button>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <div className="text-sm font-semibold text-white">Comentários e Achados</div>
                <div className="text-xs text-muted-foreground">Comentários: {notes.comments.length} ⬢ Achados: {notes.findings.length}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{notes.comments.slice(-1)[0]?.text || 'Sem comentário'}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{notes.findings.slice(-1)[0]?.text || 'Sem achado'}</div>
                <div className="flex gap-2">
                  <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Novo comentário" className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1" />
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!openRun || !commentDraft.trim()) return;
                    await api.addCardComment('run', openRun.id, commentDraft.trim());
                    const nt = await api.cardNotes('run', openRun.id);
                    setNotes({ comments: (nt.data.comments || []) as Array<{ id?: string; text?: string; author?: string }>, findings: (nt.data.findings || []) as Array<{ id?: string; text?: string; author?: string }> });
                    setCommentDraft('');
                  }}>Salvar</Button>
                </div>
                <div className="flex gap-2">
                  <input value={findingDraft} onChange={(e) => setFindingDraft(e.target.value)} placeholder="Novo achado" className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1" />
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!openRun || !findingDraft.trim()) return;
                    await api.addCardFinding('run', openRun.id, findingDraft.trim());
                    const nt = await api.cardNotes('run', openRun.id);
                    setNotes({ comments: (nt.data.comments || []) as Array<{ id?: string; text?: string; author?: string }>, findings: (nt.data.findings || []) as Array<{ id?: string; text?: string; author?: string }> });
                    setFindingDraft('');
                  }}>Salvar</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-white">Eventos</div>
                    <div className="text-xs text-muted-foreground">{lines.length}</div>
                  </div>
                  <ScrollArea className="h-[360px]">
                    <div className="space-y-2 pr-4">
                      {lines.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Sem eventos para este run ainda.</div>
                      ) : (
                        lines.map((t, idx) => (
                          <div key={idx} className="text-xs text-foreground/90 bg-background/40 border border-border rounded-lg p-2">
                            {t}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-white">Thread do agente</div>
                    <div className="text-xs text-muted-foreground">{threadLines.length}</div>
                  </div>
                  <ScrollArea className="h-[360px]">
                    <div className="space-y-2 pr-4">
                      {threadLines.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Sem thread disponível para este run.</div>
                      ) : (
                        threadLines.map((t, idx) => (
                          <div key={idx} className="text-xs text-foreground/90 bg-background/40 border border-border rounded-lg p-2">
                            {t}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max h-[calc(100vh-260px)]">
          {columns.map((col) => (
            <div key={col.id} className="bg-card border border-border rounded-xl p-3 w-[320px] shrink-0 min-h-0 flex flex-col">
              <div className="sticky top-0 z-10 bg-card/95 backdrop-blur rounded-md flex items-center justify-between mb-3 py-1">
                <h3 className="text-sm font-semibold text-white">{col.title}</h3>
                <span className="text-xs text-muted-foreground">{byStatus.get(col.id)!.length}</span>
              </div>

              <div className="space-y-2 overflow-y-auto pr-1">
              {byStatus.get(col.id)!.map((r) => (
                <div key={r.id} className="border border-border rounded-lg p-3 min-h-[150px] cursor-pointer" onClick={() => { setOpenRun(r); setReassignAgent(String(r.agentId || 'ragha')); }}>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{r.agentName} ⬢ {r.model}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-background/50">{String(r.priority || 'medium')}</span>
                    {r.status === 'review' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                        verifier
                      </span>
                    ) : null}
                    {r.status === 'stopping' && r.stopRequestedAt ? (
                      <span>⬢ parando há {Math.max(0, Math.floor((nowTs - new Date(r.stopRequestedAt).getTime()) / 1000))}s</span>
                    ) : null}
                    {r.status === 'queued' && r.nextRetryAt ? (
                      <span className="text-amber-300">⬢ retry em {Math.max(0, Math.floor((new Date(r.nextRetryAt).getTime() - nowTs) / 1000))}s</span>
                    ) : null}
                  </div>
                  <div className="font-medium text-white text-sm mt-1 line-clamp-2">{r.taskTitle}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">tentativa {Number(r.attempt || 1)} ⬢ retries {Number(r.retryCount || 0)}</div>
                  {r.summary && <div className="text-xs text-muted-foreground mt-2 line-clamp-3">{r.summary}</div>}
                  {r.lastError && <div className="text-xs text-red-300/90 mt-1 line-clamp-2">erro: {r.lastError}</div>}
                  <div className="flex flex-wrap gap-2 pt-3" onClick={(e) => e.stopPropagation()}>
                    {(r.status === 'running' || r.status === 'stopping' || r.status === 'queued' || r.status === 'waiting' || r.status === 'review') && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => pause(r.id)}>
                          Pausar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => stop(r.id)}>
                          Parar
                        </Button>
                      </>
                    )}
                    {(r.status === 'failed' || r.status === 'stopped') && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => retry(r.id)}>
                          Retry
                        </Button>
                      </>
                    )}
                    {isTerminalRun(r.status) && (
                      <Button size="sm" variant="outline" onClick={() => reassign(r.id, r.agentId)}>
                        Reatribuir
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {byStatus.get(col.id)!.length === 0 && <div className="text-xs text-muted-foreground">Sem runs</div>}
            </div>
          </div>
          ))}
        </div>
      </div>
    </>
  );
}





