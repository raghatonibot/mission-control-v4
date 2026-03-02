import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bookmark, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  Clock, 
  User, 
  Tag,
  CheckSquare,
  Play,
  Image as ImageIcon,
  Loader2,
  Search,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';

interface StashItem {
  id: string;
  url: string;
  source: string;
  extractedAt: string;
  rawData: any;
  analysis: {
    title: string;
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    tags: string[];
    contentType?: string;
    estimatedTime?: string;
    difficulty?: string;
  };
  thumbnailUrl?: string;
  author?: string;
  status: string;
}

export function Stash() {
  const [items, setItems] = useState<StashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StashItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStash = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stash');
      const result = await response.json();
      if (result.ok) {
        setItems(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch stash:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStash();
    // Poll every 10 seconds
    const interval = setInterval(fetchStash, 10000);
    return () => clearInterval(interval);
  }, [fetchStash]);

  const addToStash = async () => {
    if (!newUrl.trim()) return;
    
    try {
      setAdding(true);
      const response = await fetch('/api/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), source: 'instagram' }),
      });
      
      const result = await response.json();
      
      if (result.ok) {
        setNewUrl('');
        setItems(prev => [result.data, ...prev]);
        toast({
          title: 'Salvo no Stash!',
          description: result.message === 'Already stashed' 
            ? 'Este link já estava salvo.' 
            : 'Conteúdo analisado e salvo com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao salvar',
          description: result.error || 'Não foi possível salvar este link.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const response = await fetch(`/api/stash/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
        toast({ title: 'Item removido' });
      }
    } catch (err) {
      toast({
        title: 'Erro ao remover',
        description: String(err),
        variant: 'destructive',
      });
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.analysis?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.analysis?.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTag = !selectedTag || item.analysis?.tags?.includes(selectedTag);
    
    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(items.flatMap(item => item.analysis?.tags || [])));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Meu Stash</h1>
            <Badge variant="secondary" className="text-xs">
              {items.length} items
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStash} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Add URL */}
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Cole o link do Instagram (reel, post ou carrossel)..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addToStash()}
            className="flex-1"
          />
          <Button onClick={addToStash} disabled={adding || !newUrl.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nos stashes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex gap-1">
              <Filter className="h-4 w-4 text-muted-foreground mt-2" />
              <div className="flex gap-1 flex-wrap">
                {allTags.slice(0, 5).map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <ScrollArea className="flex-1 p-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhum item no stash</p>
            <p className="text-sm">Cole um link do Instagram acima para começar!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <Card 
                key={item.id} 
                className="cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => setSelectedItem(item)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(item.extractedAt)}
                        {item.author && (
                          <>
                            <span className="mx-1">•</span>
                            <User className="h-3 w-3" />
                            @{item.author}
                          </>
                        )}
                      </p>
                      <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                        {item.analysis?.title || 'Sem título'}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteItem(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted rounded-md overflow-hidden mb-3">
                    {item.thumbnailUrl ? (
                      <>
                        <img 
                          src={item.thumbnailUrl} 
                          alt={item.analysis?.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '';
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white opacity-80" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {item.analysis?.summary || 'Sem descrição'}
                  </p>

                  {/* Tags */}
                  {item.analysis?.tags && item.analysis.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {item.analysis.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">
                          {tag}
                        </Badge>
                      ))}
                      {item.analysis.tags.length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          +{item.analysis.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                    {item.analysis?.estimatedTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.analysis.estimatedTime}
                      </span>
                    )}
                    {item.analysis?.difficulty && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {item.analysis.difficulty}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-start gap-2">
                  <Bookmark className="h-5 w-5 text-primary mt-1" />
                  <span className="line-clamp-2">{selectedItem.analysis?.title}</span>
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                {/* Thumbnail */}
                {selectedItem.thumbnailUrl && (
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                    <img 
                      src={selectedItem.thumbnailUrl} 
                      alt={selectedItem.analysis?.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <a 
                        href={selectedItem.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-full text-sm font-medium hover:bg-white transition-colors"
                      >
                        <Play className="h-4 w-4" />
                        Ver no Instagram
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Resumo</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.analysis?.summary}
                  </p>
                </div>

                <Separator className="my-4" />

                {/* Key Points */}
                {selectedItem.analysis?.keyPoints && selectedItem.analysis.keyPoints.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Pontos-chave
                    </h4>
                    <ul className="space-y-1">
                      {selectedItem.analysis.keyPoints.map((point, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-primary">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {selectedItem.analysis?.actionItems && selectedItem.analysis.actionItems.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Action Items
                    </h4>
                    <ul className="space-y-1">
                      {selectedItem.analysis.actionItems.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <input type="checkbox" className="mt-1" readOnly />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tags */}
                {selectedItem.analysis?.tags && selectedItem.analysis.tags.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Tags</h4>
                    <div className="flex gap-2 flex-wrap">
                      {selectedItem.analysis.tags.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                  <p>Salvo em: {new Date(selectedItem.extractedAt).toLocaleString('pt-BR')}</p>
                  <p className="mt-1">URL: <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{selectedItem.url}</a></p>
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedItem(null)}>
                  Fechar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    deleteItem(selectedItem.id);
                    setSelectedItem(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remover
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Stash;
