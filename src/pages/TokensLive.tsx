import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type ModelUsage = {
  model: string;
  provider?: string;
  source?: string;
  input: number;
  output: number;
  total: number;
  messages: number;
};

type UsageEvent = {
  at: string;
  atMs: number;
  model: string;
  provider: string;
  source: string;
  agentId?: string;
  runId?: string;
  taskId?: string;
  taskClass?: string;
  input: number;
  output: number;
  total: number;
};

type UsagePayload = {
  activatedAt?: string;
  window?: { start?: string; end?: string };
  totals?: { input: number; output: number; total: number; messages: number };
  models?: ModelUsage[];
  events?: UsageEvent[];
};

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TokensLive() {
  const [data, setData] = useState<UsagePayload>({});
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState('');
  const [source, setSource] = useState<'local' | 'remote' | ''>('');
  const [agentId, setAgentId] = useState('');
  const [runId, setRunId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [taskClass, setTaskClass] = useState('');
  const [peakThreshold, setPeakThreshold] = useState<number>(800);
  const [showFilters, setShowFilters] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const load = async () => {
    try {
      const res = await api.tokenUsageLive({
        start: start ? new Date(start).toISOString() : undefined,
        end: end ? new Date(end).toISOString() : undefined,
        model: model || undefined,
        provider: provider || undefined,
        source: source || undefined,
        agentId: agentId || undefined,
        runId: runId || undefined,
        taskId: taskId || undefined,
        taskClass: taskClass || undefined,
        eventsLimit: 800,
      });
      setData((res.data || {}) as UsagePayload);
    } catch {
      setData({});
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, model, provider, source, agentId, runId, taskId, taskClass]);

  const setLastHour = () => {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 60 * 1000);
    setStart(toLocalDateTimeInput(from));
    setEnd(toLocalDateTimeInput(now));
  };

  const resetFilters = () => {
    setStart('');
    setEnd('');
    setModel('');
    setProvider('');
    setSource('');
    setAgentId('');
    setRunId('');
    setTaskId('');
    setTaskClass('');
  };

  const resetWindow = async () => {
    await api.tokenUsageReset();
    await load();
  };

  const totalIn = Number(data.totals?.input || 0);
  const totalOut = Number(data.totals?.output || 0);
  const total = Number(data.totals?.total || 0);
  const models = Array.isArray(data.models) ? data.models : [];
  const events = useMemo(() => (Array.isArray(data.events) ? data.events : []), [data.events]);

  const localTotal = models.filter((m) => m.source === 'local').reduce((acc, m) => acc + Number(m.total || 0), 0);
  const remoteTotal = models.filter((m) => m.source !== 'local').reduce((acc, m) => acc + Number(m.total || 0), 0);
  const localPct = total > 0 ? ((localTotal / total) * 100) : 0;

  const peakBySecond = useMemo(() => {
    const bySec = new Map<string, { second: string; total: number; input: number; output: number; events: number }>();
    for (const e of events) {
      const d = new Date(e.at);
      const second = d.toLocaleString();
      const prev = bySec.get(second) || { second, total: 0, input: 0, output: 0, events: 0 };
      prev.total += Number(e.total || 0);
      prev.input += Number(e.input || 0);
      prev.output += Number(e.output || 0);
      prev.events += 1;
      bySec.set(second, prev);
    }
    return [...bySec.values()].sort((a, b) => b.total - a.total);
  }, [events]);

  const peaks = peakBySecond.filter((p) => p.total >= peakThreshold).slice(0, 8);

  const exportCurrentCsv = () => {
    const rows: string[][] = [
      ['at_iso', 'at_local', 'model', 'provider', 'source', 'agentId', 'runId', 'taskId', 'taskClass', 'input', 'output', 'total'],
      ...events.map((e) => [
        e.at,
        new Date(e.at).toLocaleString(),
        e.model,
        e.provider,
        e.source,
        e.agentId || '',
        e.runId || '',
        e.taskId || '',
        e.taskClass || '',
        String(e.input || 0),
        String(e.output || 0),
        String(e.total || 0),
      ]),
    ];
    downloadCsv('tokens-filtered-events.csv', rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle Real de Tokens</h1>
          <p className="text-muted-foreground">Filtros por período com precisão de segundos + quebra por modelo</p>
          <p className="text-xs text-muted-foreground mt-1">
            Janela base: {data.activatedAt ? new Date(data.activatedAt).toLocaleString() : '-'}
          </p>
        </div>
        <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
          <Button className="w-full md:w-auto" variant="outline" onClick={setLastHour}>Última 1h</Button>
          <Button className="w-full md:w-auto" variant="outline" onClick={() => setShowFilters((v) => !v)}>{showFilters ? 'Ocultar filtros' : 'Filtros'}</Button>
          <Button className="w-full md:w-auto" variant="outline" onClick={() => setShowInsights((v) => !v)}>{showInsights ? 'Ocultar insights' : 'Insights'}</Button>
          <Button className="w-full md:w-auto" variant="outline" onClick={resetWindow}>Resetar janela</Button>
          <Button className="col-span-2 md:col-span-1 w-full md:w-auto" variant="outline" onClick={exportCurrentCsv}>Export CSV</Button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Filtros específicos</h3>
            <Button variant="outline" onClick={resetFilters}>Limpar filtros</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input className="h-9 rounded-md border border-border bg-background px-2 text-sm" type="datetime-local" step={1} value={start} onChange={(e) => setStart(e.target.value)} />
            <input className="h-9 rounded-md border border-border bg-background px-2 text-sm" type="datetime-local" step={1} value={end} onChange={(e) => setEnd(e.target.value)} />
            <input className="h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="modelo" value={model} onChange={(e) => setModel(e.target.value)} />
            <input className="h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="provider" value={provider} onChange={(e) => setProvider(e.target.value)} />
            <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={source} onChange={(e) => setSource(e.target.value as 'local' | 'remote' | '')}>
              <option value="">local+remoto</option>
              <option value="local">local</option>
              <option value="remote">remoto</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input className="h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="agentId" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
            <input className="h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="runId" value={runId} onChange={(e) => setRunId(e.target.value)} />
            <input className="h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="taskId" value={taskId} onChange={(e) => setTaskId(e.target.value)} />
            <input className="h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="taskClass (ex: cron, routine-monitor)" value={taskClass} onChange={(e) => setTaskClass(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Input</p>
          <p className="text-2xl font-bold text-foreground">{totalIn.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Output</p>
          <p className="text-2xl font-bold text-foreground">{totalOut.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground">{total.toLocaleString()}</p>
        </div>
      </div>

      {showInsights && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Local total</p>
              <p className="text-2xl font-bold text-foreground">{localTotal.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Remoto total</p>
              <p className="text-2xl font-bold text-foreground">{remoteTotal.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">% Local</p>
              <p className="text-2xl font-bold text-foreground">{localPct.toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Alertas de pico (por segundo)</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">limite:</span>
                <input
                  className="h-8 w-28 rounded-md border border-border bg-background px-2 text-sm"
                  type="number"
                  min={1}
                  value={peakThreshold}
                  onChange={(e) => setPeakThreshold(Number(e.target.value || 0))}
                />
              </div>
            </div>

            {peaks.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem pico acima do limite no filtro atual.</div>
            ) : (
              <div className="space-y-2">
                {peaks.map((p) => (
                  <div key={p.second} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-sm font-medium text-foreground">{p.second}</p>
                    <p className="text-xs text-muted-foreground">eventos: {p.events}</p>
                    <p className="text-sm text-foreground/90 mt-1">
                      in: {p.input.toLocaleString()} • out: {p.output.toLocaleString()} • total: {p.total.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Por modelo</h3>
          <span className="text-xs text-muted-foreground">{models.length} modelos</span>
        </div>
        <div className="space-y-2">
          {models.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem uso no filtro atual.</div>
          ) : (
            models.map((m) => (
              <div key={`${m.model}:${m.provider}:${m.source}`} className="rounded-lg border border-border p-3 bg-background/40">
                <p className="text-sm font-medium text-foreground">{m.model}</p>
                <p className="text-xs text-muted-foreground">{m.provider || '-'} • {m.source || '-'} • msgs: {m.messages}</p>
                <p className="text-sm text-foreground/90 mt-1">
                  in: {Number(m.input || 0).toLocaleString()} • out: {Number(m.output || 0).toLocaleString()} • total: {Number(m.total || 0).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Eventos (timestamp exato)</h3>
          <span className="text-xs text-muted-foreground">{events.length} linhas</span>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2 max-h-96 overflow-auto">
          {events.slice(0, 80).map((e) => (
            <div key={`${e.atMs}:${e.model}:${e.input}:${e.output}`} className="rounded-lg border border-border p-3 bg-background/40">
              <p className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</p>
              <p className="text-sm font-medium text-foreground mt-1">{e.model}</p>
              <p className="text-xs text-muted-foreground">{e.source} • {e.taskClass || 'general'}</p>
              <p className="text-xs text-muted-foreground">agent: {e.agentId || '-'} • run: {e.runId || '-'}</p>
              <p className="text-sm text-foreground/90 mt-1">
                in: {Number(e.input || 0).toLocaleString()} • out: {Number(e.output || 0).toLocaleString()} • total: {Number(e.total || 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Desktop/tablet: table */}
        <div className="hidden md:block max-h-96 overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[980px] text-xs md:text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="text-left">
                <th className="p-2">Horário</th>
                <th className="p-2">Modelo</th>
                <th className="p-2">Fonte</th>
                <th className="p-2">Agent</th>
                <th className="p-2">Run</th>
                <th className="p-2">Task</th>
                <th className="p-2">Classe</th>
                <th className="p-2">In</th>
                <th className="p-2">Out</th>
                <th className="p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={`${e.atMs}:${e.model}:${e.input}:${e.output}`} className="border-t border-border/60">
                  <td className="p-2 whitespace-nowrap">{new Date(e.at).toLocaleString()}</td>
                  <td className="p-2">{e.model}</td>
                  <td className="p-2">{e.source}</td>
                  <td className="p-2">{e.agentId || '-'}</td>
                  <td className="p-2">{e.runId || '-'}</td>
                  <td className="p-2">{e.taskId || '-'}</td>
                  <td className="p-2">{e.taskClass || '-'}</td>
                  <td className="p-2">{Number(e.input || 0).toLocaleString()}</td>
                  <td className="p-2">{Number(e.output || 0).toLocaleString()}</td>
                  <td className="p-2">{Number(e.total || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
