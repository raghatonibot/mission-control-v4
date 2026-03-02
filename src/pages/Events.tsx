import { useEffect, useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type EventItem = {
  at?: number | string;
  type?: string;
  runId?: string;
  from?: string;
  tools?: string[];
  model?: string;
  tokensOutEst?: number;
  message?: string;
};

function formatAt(v?: number | string) {
  if (!v) return '-';
  return typeof v === 'number' ? new Date(v).toLocaleString() : new Date(String(v)).toLocaleString();
}

export function Events() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [kind, setKind] = useState<'all' | 'status' | 'tool_violation' | 'usage_estimate'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EventItem | null>(null);

  const load = async () => {
    try {
      const res = await api.events({ limit: 200 });
      setItems((res.data.events || []) as EventItem[]);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const byKind = kind === 'all' ? items : items.filter((e) => String(e?.type || '') === kind);
    const q = query.trim().toLowerCase();
    if (!q) return byKind;
    return byKind.filter((e) =>
      [e.type, e.runId, e.from, e.message, e.model].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [items, kind, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Eventos</h1>
        <p className="text-muted-foreground">Timeline com interações, @menções e alertas</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-foreground">Event Stream</h3>
          <input
            className="ml-auto bg-background border border-border rounded-md px-3 py-1.5 text-sm"
            placeholder="Buscar evento..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={load}>Atualizar</Button>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button size="sm" variant={kind === 'all' ? 'default' : 'outline'} onClick={() => setKind('all')}>Todos</Button>
          <Button size="sm" variant={kind === 'status' ? 'default' : 'outline'} onClick={() => setKind('status')}>Status</Button>
          <Button size="sm" variant={kind === 'tool_violation' ? 'default' : 'outline'} onClick={() => setKind('tool_violation')}>Tool violation</Button>
          <Button size="sm" variant={kind === 'usage_estimate' ? 'default' : 'outline'} onClick={() => setKind('usage_estimate')}>Usage</Button>
          <span className="text-sm text-muted-foreground">{filtered.length} eventos</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ScrollArea className="lg:col-span-2 h-[calc(100vh-320px)]">
            <div className="space-y-2 pr-4">
              {filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum evento ainda.</div>
              ) : (
                filtered.map((e, idx) => (
                  <button key={idx} onClick={() => setSelected(e)} className="w-full text-left text-sm text-foreground/90 bg-background/40 border border-border rounded-lg p-3 hover:border-emerald-500/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{String(e.type || 'event')}</span>
                      <span className="text-xs text-muted-foreground">{formatAt(e.at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.message || '-'} {e.runId ? `• run=${e.runId}` : ''}</p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="border border-border rounded-xl p-4 bg-background/30">
            <h4 className="font-semibold text-white mb-3">Detalhe do evento</h4>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Clique em um evento para ver detalhes.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Tipo:</span> <span className="text-white">{selected.type || '-'}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="text-white">{formatAt(selected.at)}</span></div>
                <div><span className="text-muted-foreground">Run:</span> <span className="text-white">{selected.runId || '-'}</span></div>
                <div><span className="text-muted-foreground">Origem:</span> <span className="text-white">{selected.from || '-'}</span></div>
                <div><span className="text-muted-foreground">Modelo:</span> <span className="text-white">{selected.model || '-'}</span></div>
                <div><span className="text-muted-foreground">Mensagem:</span>
                  <p className="text-white mt-1 whitespace-pre-wrap">{selected.message || '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
