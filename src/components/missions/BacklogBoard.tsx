import { useState, useMemo, useEffect } from 'react';
import { Plus, Link2, Trash2, Edit2, X, Check, Lightbulb, ArrowRight, Play, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { BacklogItem } from '@/types/backlog';

const STORAGE_KEY = 'mc_backlog_items';

export type IdeaStatus = 'todo' | 'analyzing' | 'ready';

const STATUS_CONFIG: Record<
  IdeaStatus,
  { label: string; color: string; border: string; bg: string }
> = {
  todo: {
    label: 'A Fazer',
    color: 'text-slate-300',
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/10',
  },
  analyzing: {
    label: 'Em Analise',
    color: 'text-amber-300',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
  },
  ready: {
    label: 'Pronto',
    color: 'text-emerald-300',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
  },
};

const PRIORITY_COLORS = {
  high: 'bg-red-500/20 text-red-300 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const PRIORITY_DOTS = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

function loadItems(): BacklogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BacklogItem[]) : [];
  } catch {
    return [];
  }
}

function saveItems(items: BacklogItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Detecta se é touch device
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function BacklogBoard() {
  const [items, setItems] = useState<BacklogItem[]>(() => loadItems());
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(isTouchDevice());
  }, []);

  const [form, setForm] = useState<{
    title: string;
    link: string;
    description: string;
    tags: string;
    priority: 'low' | 'medium' | 'high';
    status: IdeaStatus;
  }>({
    title: '',
    link: '',
    description: '',
    tags: '',
    priority: 'medium',
    status: 'todo',
  });

  const itemsByStatus = useMemo(() => {
    const grouped: Record<IdeaStatus, BacklogItem[]> = {
      todo: [],
      analyzing: [],
      ready: [],
    };
    items.forEach((item) => {
      const status = (item.status as IdeaStatus) || 'todo';
      grouped[status].push(item);
    });
    (Object.keys(grouped) as IdeaStatus[]).forEach((status) => {
      grouped[status].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
    return grouped;
  }, [items]);

  const handleAdd = () => {
    const newItem: BacklogItem = {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      link: form.link.trim() || undefined,
      description: form.description.trim() || undefined,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      priority: form.priority,
      status: form.status,
      createdAt: new Date().toISOString(),
    };
    const updated = [newItem, ...items];
    setItems(updated);
    saveItems(updated);
    setIsAdding(false);
    setForm({ title: '', link: '', description: '', tags: '', priority: 'medium', status: 'todo' });
  };

  const handleUpdate = (id: string) => {
    const updated = items.map((item) =>
      item.id === id
        ? {
            ...item,
            title: form.title.trim(),
            link: form.link.trim() || undefined,
            description: form.description.trim() || undefined,
            tags: form.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
            priority: form.priority,
            status: form.status,
            updatedAt: new Date().toISOString(),
          }
        : item
    );
    setItems(updated);
    saveItems(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    saveItems(updated);
  };

  const moveStatus = (id: string, newStatus: IdeaStatus) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, status: newStatus, updatedAt: new Date().toISOString() } : item
    );
    setItems(updated);
    saveItems(updated);
  };

  const startEdit = (item: BacklogItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      link: item.link || '',
      description: item.description || '',
      tags: item.tags.join(', '),
      priority: item.priority,
      status: (item.status as IdeaStatus) || 'todo',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setForm({ title: '', link: '', description: '', tags: '', priority: 'medium', status: 'todo' });
  };

  const FormFields = ({
    onSave,
    saveLabel,
  }: {
    onSave: () => void;
    saveLabel: string;
  }) => (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      <Input
        placeholder="Titulo da ideia..."
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        className="bg-background/50 touch-manipulation"
        autoFocus
      />
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as IdeaStatus }))}
          className="bg-background/50 border border-border rounded-md px-3 py-2 text-sm flex-1 touch-manipulation"
        >
          <option value="todo">A Fazer</option>
          <option value="analyzing">Em Analise</option>
          <option value="ready">Pronto</option>
        </select>
        <select
          value={form.priority}
          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as 'low' | 'medium' | 'high' }))}
          className="bg-background/50 border border-border rounded-md px-3 py-2 text-sm touch-manipulation"
        >
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baixa</option>
        </select>
      </div>
      <Input
        placeholder="Link (opcional)..."
        value={form.link}
        onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
        className="bg-background/50 touch-manipulation"
        type="url"
        inputMode="url"
      />
      <Textarea
        placeholder="Descricao (opcional)..."
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="bg-background/50 min-h-[80px] touch-manipulation"
      />
      <Input
        placeholder="Tags: automacao, scraping, ai..."
        value={form.tags}
        onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
        className="bg-background/50 touch-manipulation"
      />
      <div className="flex gap-2 flex-wrap">
        <Button onClick={onSave} disabled={!form.title.trim()} size="sm" className="touch-manipulation">
          <Check className="w-4 h-4 mr-1" />
          {saveLabel}
        </Button>
        <Button variant="ghost" onClick={cancelEdit} size="sm" className="touch-manipulation">
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
      </div>
    </div>
  );

  const IdeaCard = ({ item }: { item: BacklogItem }) => {
    const status = (item.status as IdeaStatus) || 'todo';
    const nextStatus: Record<IdeaStatus, IdeaStatus | null> = {
      todo: 'analyzing',
      analyzing: 'ready',
      ready: null,
    };

    const handleCardClick = (e: React.MouseEvent) => {
      // Previne que o card seja clicado quando interagir com botoes
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
        return;
      }
    };

    if (editingId === item.id) {
      return (
        <div 
          className="bg-card border-2 border-primary/50 rounded-xl p-4 relative z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <FormFields onSave={() => handleUpdate(item.id)} saveLabel="Salvar" />
        </div>
      );
    }

    return (
      <div
        draggable={!isTouch}
        onDragStart={() => !isTouch && setDraggingId(item.id)}
        onDragEnd={() => setDraggingId(null)}
        onClick={handleCardClick}
        className={`bg-card border ${STATUS_CONFIG[status].border} rounded-xl p-4 hover:shadow-lg transition-all group ${
          !isTouch ? 'cursor-move' : 'cursor-default'
        }`}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Header com grip para drag (desktop) ou sem (mobile) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {!isTouch && (
              <div className="mt-0.5 opacity-30 group-hover:opacity-60 cursor-grab active:cursor-grabbing">
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <h3 className="font-medium text-white text-sm leading-tight">{item.title}</h3>
          </div>
          <div className="flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 touch-manipulation" 
              onClick={() => startEdit(item)}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive touch-manipulation"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>
        )}

        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            <Link2 className="w-3 h-3 flex-shrink-0" />
            {item.link.replace(/^https?:\/\//, '').split('/')[0]}
          </a>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          {item.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {item.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[item.priority]}`}>
            {PRIORITY_DOTS[item.priority]}
          </Badge>

          {nextStatus[status] && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
              onClick={() => moveStatus(item.id, nextStatus[status]!)}
            >
              {status === 'todo' && 'Analisar'}
              {status === 'analyzing' && 'Pronto'}
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}

          {status === 'ready' && (
            <Button
              variant="default"
              size="sm"
              className="h-6 text-xs gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
              onClick={() => {
                alert('Futuro: converter em Task');
              }}
            >
              <Play className="w-3 h-3" />
              Criar Task
            </Button>
          )}
        </div>
      </div>
    );
  };

  const Column = ({
    status,
    title,
    items: columnItems,
  }: {
    status: IdeaStatus;
    title: string;
    items: BacklogItem[];
  }) => (
    <div
      className={`flex-1 min-w-[280px] max-w-[380px] ${STATUS_CONFIG[status].bg} rounded-xl border ${STATUS_CONFIG[status].border} flex flex-col`}
      onDragOver={(e) => {
        if (!isTouch) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        if (!isTouch && draggingId) {
          e.preventDefault();
          moveStatus(draggingId, status);
          setDraggingId(null);
        }
      }}
    >
      <div className={`p-3 border-b ${STATUS_CONFIG[status].border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          <Badge variant="secondary" className="text-xs">{columnItems.length}</Badge>
        </div>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-340px)]">
        {columnItems.map((item) => (
          <IdeaCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <span className="text-sm text-muted-foreground">
            {items.length} ideia{items.length !== 1 ? 's' : ''}
            {!isTouch && ' • arraste entre colunas'}
          </span>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm" className="touch-manipulation">
            <Plus className="w-4 h-4 mr-1" />
            Nova Ideia
          </Button>
        )}
      </div>

      {isAdding && (
        <div 
          className="bg-card border border-primary/50 rounded-xl p-4 relative z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <FormFields onSave={handleAdd} saveLabel="Adicionar" />
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-2 touch-pan-x">
        <Column status="todo" title={STATUS_CONFIG.todo.label} items={itemsByStatus.todo} />
        <Column status="analyzing" title={STATUS_CONFIG.analyzing.label} items={itemsByStatus.analyzing} />
        <Column status="ready" title={STATUS_CONFIG.ready.label} items={itemsByStatus.ready} />
      </div>
    </div>
  );
}
