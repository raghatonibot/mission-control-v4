import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ArrowLeft, MessageSquare, Save, Volume2, Wrench, Brain, Users, Activity } from 'lucide-react';

type AgentSkill = { id: string; name: string; description?: string; enabled?: boolean };
type AgentView = {
  id: string;
  name: string;
  emoji?: string;
  avatar?: string;
  role?: string;
  type?: string;
  status?: string;
  memberSince?: string;
  description?: string;
  currentTask?: string;
  lastActive?: string;
  systemDirective?: string;
  tone?: string;
  quirks?: string[] | string;
  emojiUsage?: string;
  formality?: string;
  skills?: AgentSkill[];
};
type AuditLog = { id: string; at?: number | string; action?: string; actor?: string; patch?: unknown };
type BadgeStatus = 'active' | 'idle' | 'offline' | 'running' | 'completed' | 'failed' | 'proposed';

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<AgentView | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Local state for form fields
  const [formData, setFormData] = useState({
    systemDirective: '',
    tone: 'professional',
    quirks: '',
    emojiUsage: 'rare',
    formality: 'professional',
  });

  // Load agent
  useEffect(() => {
    if (!id) return;
    api.agent(id)
      .then((res) => setAgent(res.data as AgentView))
      .catch(() => setAgent(null));

    api.auditLogs({ entityType: 'agent', entityId: id, limit: 50 })
      .then((res) => setAuditLogs((res.data || []) as AuditLog[]))
      .catch(() => setAuditLogs([]));
  }, [id]);

  // Initialize form data when agent loads
  useEffect(() => {
    if (agent) {
      setFormData({
        systemDirective: agent.systemDirective || '',
        tone: agent.tone || 'professional',
        quirks: Array.isArray(agent.quirks) ? agent.quirks.join(', ') : (agent.quirks || ''),
        emojiUsage: agent.emojiUsage || 'rare',
        formality: agent.formality || 'professional',
      });
    }
  }, [agent]);

  const agentStatus: BadgeStatus =
    agent?.status === 'active' ||
    agent?.status === 'idle' ||
    agent?.status === 'offline' ||
    agent?.status === 'running' ||
    agent?.status === 'completed' ||
    agent?.status === 'failed' ||
    agent?.status === 'proposed'
      ? agent.status
      : 'offline';

  if (!agent) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Agente não encontrado</p>
        <Link to="/agents" className="text-emerald-500 hover:underline mt-2 inline-block">
          Voltar para Agentes
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const payload = {
        systemDirective: formData.systemDirective,
        tone: formData.tone,
        quirks: formData.quirks,
        emojiUsage: formData.emojiUsage,
        formality: formData.formality,
      };
      const res = await api.updateAgent(id, payload as Record<string, unknown>);
      setAgent(res.data as AgentView);

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSkillToggle = async (skillId: string, enabled: boolean) => {
    if (!id) return;

    // Update local UI immediately
    const updatedSkills = (agent.skills || []).map((s: AgentSkill) => (s.id === skillId ? { ...s, enabled } : s));
    setAgent({ ...agent, skills: updatedSkills });

    // Persist as skillsAllowed[]
    const allowed = new Set((updatedSkills || []).filter((s: AgentSkill) => s.enabled).map((s: AgentSkill) => s.id));
    const payload = { skillsAllowed: Array.from(allowed) };
    const res = await api.updateAgent(id, payload);
    // backend returns the persisted agent; keep UI state consistent
    setAgent((prev) => ({ ...(prev || {}), ...(res.data as AgentView) }));
  };
  
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/agents"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Agentes
      </Link>
      
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-4 border-border">
            <AvatarImage src={agent.avatar} alt={agent.name} />
            <AvatarFallback className="bg-card text-2xl">{agent.emoji}</AvatarFallback>
          </Avatar>
          
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
              <span className="text-2xl">{agent.emoji}</span>
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
                {agent.type === 'autonomous' ? 'Autônomo' : agent.type === 'operator' ? 'Operador' : agent.type}
              </Badge>
              <StatusBadge status={agentStatus} />
            </div>
            <p className="text-muted-foreground">{agent.role}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Membro desde {agent.memberSince}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link to={`/chat/${agent.id}`}>
            <Button variant="outline" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat
            </Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'gap-2 transition-all',
              showSaved ? 'bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'
            )}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : showSaved ? (
              <>
                <Save className="w-4 h-4" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar alterações
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="bg-card border border-border flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="w-4 h-4" />
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="configuration" className="gap-2">
            <Volume2 className="w-4 h-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="memories" className="gap-2">
            <Brain className="w-4 h-4" />
            Memórias
          </TabsTrigger>
          <TabsTrigger value="relationships" className="gap-2">
            <Users className="w-4 h-4" />
            Relações
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="w-4 h-4" />
            Atividade
          </TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Sobre</h3>
              <p className="text-muted-foreground">{agent.description}</p>
              
              <div className="mt-6 space-y-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Tipo</Label>
                  <p className="text-foreground capitalize font-medium">{agent.type === 'autonomous' ? 'Autônomo' : agent.type === 'operator' ? 'Operador' : agent.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Status</Label>
                  <div className="mt-1">
                    <StatusBadge status={agentStatus} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Tarefa atual</Label>
                  <p className="text-foreground">{agent.currentTask || 'Sem tarefa ativa'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Última atividade</Label>
                  <p className="text-foreground">{agent.lastActive || 'Desconhecido'}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Personalidade</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Tom</Label>
                  <p className="text-foreground capitalize font-medium">{agent.tone || 'Não definido'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Formalidade</Label>
                  <p className="text-foreground capitalize font-medium">{agent.formality || 'Não definido'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Uso de emoji</Label>
                  <p className="text-foreground capitalize font-medium">{agent.emojiUsage || 'Não definido'}</p>
                </div>
                {Array.isArray(agent.quirks) && agent.quirks.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Traços</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {agent.quirks.map((quirk: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="bg-card">
                          {quirk}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Configuration Tab */}
        <TabsContent value="configuration" className="mt-6 space-y-6">
          {/* Voice Configuration */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Volume2 className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-foreground">Configuração de voz</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Defina a personalidade e o estilo de comunicação deste agente
            </p>
            
            <div className="space-y-6">
              {/* System Directive */}
              <div>
                <Label className="text-foreground font-medium mb-2 block">Diretiva do sistema</Label>
                <Textarea
                  value={formData.systemDirective}
                  onChange={(e) => setFormData({ ...formData, systemDirective: e.target.value })}
                  placeholder="Digite a diretiva do sistema deste agente..."
                  className="min-h-[120px] bg-background resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Isso define como o agente se comporta e responde
                </p>
              </div>
              
              {/* Tone */}
              <div>
                <Label className="text-foreground font-medium mb-2 block">Tom</Label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                >
                  <option value="creative">Criativo</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="enthusiastic">Entusiasmado</option>
                  <option value="analytical">Analítico</option>
                </select>
              </div>
              
              {/* Quirks */}
              <div>
                <Label className="text-foreground font-medium mb-2 block">Traços (separados por vírgula)</Label>
                <Input
                  value={formData.quirks}
                  onChange={(e) => setFormData({ ...formData, quirks: e.target.value })}
                  placeholder="Ex.: Direto, detalhista, pensa em checklist"
                  className="bg-background"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.quirks.split(',').map((quirk, idx) => (
                    quirk.trim() && (
                      <Badge key={idx} variant="secondary" className="bg-emerald-500/10 text-emerald-500">
                        {quirk.trim()}
                      </Badge>
                    )
                  ))}
                </div>
              </div>
              
              {/* Emoji Usage */}
              <div>
                <Label className="text-foreground font-medium mb-2 block">Uso de emoji</Label>
                <select
                  value={formData.emojiUsage}
                  onChange={(e) => setFormData({ ...formData, emojiUsage: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                >
                  <option value="frequent">Frequente</option>
                  <option value="occasional">Ocasional</option>
                  <option value="rare">Raro</option>
                  <option value="never">Nunca</option>
                </select>
              </div>
              
              {/* Formality */}
              <div>
                <Label className="text-foreground font-medium mb-2 block">Formalidade</Label>
                <select
                  value={formData.formality}
                  onChange={(e) => setFormData({ ...formData, formality: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                >
                  <option value="casual">Casual</option>
                  <option value="professional">Professional</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Skills & Capabilities */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-foreground">Skills & Capacidades</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Ative ou desative ferramentas e capacidades deste agente
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agent.skills?.map((skill: AgentSkill) => (
                <div
                  key={skill.id}
                  className="flex items-start justify-between p-4 rounded-lg bg-background/50 border border-border hover:border-emerald-500/30 transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{skill.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{skill.description}</p>
                  </div>
                  <Switch
                    checked={skill.enabled}
                    onCheckedChange={(checked) => handleSkillToggle(skill.id, checked)}
                    className="data-[state=checked]:bg-emerald-500 flex-shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
        
        {/* Memories Tab */}
        <TabsContent value="memories" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Memórias</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Este agente ainda não tem memórias armazenadas. As memórias são criadas automaticamente conforme ele interage e aprende.
            </p>
          </div>
        </TabsContent>
        
        {/* Relationships Tab */}
        <TabsContent value="relationships" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Relações</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Acompanhe como este agente interage com outros agentes do time.
            </p>
          </div>
        </TabsContent>
        
        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Histórico de atividade (auditoria)</h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem alterações auditadas para este agente.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="border border-border rounded-lg p-3 text-xs">
                    <div className="text-muted-foreground">
                      {log.at ? new Date(log.at).toLocaleString() : '-'} • {log.action} • {log.actor || 'system'}
                    </div>
                    <div className="text-foreground mt-1 line-clamp-3">
                      {JSON.stringify(log.patch || {}, null, 0)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


