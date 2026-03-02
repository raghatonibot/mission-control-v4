import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Bot, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { orchestrationApi } from '@/lib/orchestration-api';
import type { AgentStatus, PersistedTask, Alert, SessionStats } from '@/types/orchestration';

export function Orchestration() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [tasks, setTasks] = useState<PersistedTask[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('agents');

  const fetchData = async () => {
    try {
      const [agentsRes, alertsRes, statsRes] = await Promise.all([
        orchestrationApi.getAgentsStatus(),
        orchestrationApi.getAlerts(),
        orchestrationApi.getStats(),
      ]);

      setAgents(agentsRes.agents || []);
      setAlerts(alertsRes.alerts || []);
      setStats(statsRes);

      // Buscar tasks da sessão atual (ou todas)
      if (statsRes?.sessions?.sessions > 0) {
        // Simplificado: mostrando stats gerais
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Atualiza a cada 5s
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'busy':
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'offline':
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      online: 'bg-green-500/20 text-green-400 border-green-500/30',
      busy: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return variants[status] || 'bg-gray-500/20 text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const activeAgents = agents.filter(a => a.status !== 'offline');
  const busyAgents = agents.filter(a => a.status === 'busy');
  const unreadAlerts = alerts.filter(a => !a.read);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-500" />
            Orquestração Multi-Agente
          </h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real dos agentes Avengers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/20 text-green-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {activeAgents.length}/9 Ativos
          </Badge>
          {unreadAlerts.length > 0 && (
            <Badge variant="outline" className="bg-red-500/20 text-red-400">
              <AlertCircle className="w-3 h-3 mr-1" />
              {unreadAlerts.length} Alertas
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agentes Ativos</p>
                <p className="text-2xl font-bold text-foreground">{activeAgents.length}</p>
              </div>
              <Bot className="w-8 h-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ocupados</p>
                <p className="text-2xl font-bold text-foreground">{busyAgents.length}</p>
              </div>
              <Loader2 className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sessões</p>
                <p className="text-2xl font-bold text-foreground">{stats?.sessions?.sessions || 0}</p>
              </div>
              <Database className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas</p>
                <p className="text-2xl font-bold text-foreground">{unreadAlerts.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border-border">
          <TabsTrigger value="agents" className="data-[state=active]:bg-purple-500/20">
            <Bot className="w-4 h-4 mr-2" />
            Agentes ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-red-500/20">
            <AlertCircle className="w-4 h-4 mr-2" />
            Alertas ({alerts.length})
          </TabsTrigger>
          <TabsTrigger value="cron" className="data-[state=active]:bg-blue-500/20">
            <Clock className="w-4 h-4 mr-2" />
            Cron Jobs
          </TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent, idx) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-card/50 border-border hover:border-purple-500/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-border">
                          <Bot className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground capitalize">
                            {agent.id}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {agent.skills} skills
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusBadge(agent.status)}>
                        {getStatusIcon(agent.status)}
                        <span className="ml-1 capitalize">{agent.status}</span>
                      </Badge>
                    </div>

                    {agent.currentTask && (
                      <div className="mt-3 p-2 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Tarefa atual:</p>
                        <p className="text-sm text-foreground truncate">{agent.currentTask}</p>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Tasks: {agent.completedTasks}</span>
                      <span>Última: {agent.lastActivity ? new Date(agent.lastActivity).toLocaleTimeString() : 'Nunca'}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="mt-4">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Alertas do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500/50" />
                    <p>Nenhum alerta no momento</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${
                          alert.read 
                            ? 'bg-muted/30 border-border' 
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(alert.priority)}
                            <span className="font-medium text-foreground">{alert.type}</span>
                            <Badge variant="outline" className={getStatusBadge(alert.priority)}>
                              {alert.priority}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-foreground">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">Agente: {alert.agentId}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cron Tab */}
        <TabsContent value="cron" className="mt-4">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Tarefas Agendadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'blackwidow-monitor', cron: '*/15 * * * *', desc: 'Monitoramento social' },
                  { name: 'hawkeye-system-check', cron: '*/15 * * * *', desc: 'Verificação de sistema' },
                  { name: 'ironman-daily-research', cron: '0 7 * * *', desc: 'Pesquisa diária' },
                  { name: 'fury-prioritize', cron: '0 */4 * * *', desc: 'Priorização de tasks' },
                  { name: 'daily-standup', cron: '0 9 * * *', desc: 'Report diário' },
                ].map((task) => (
                  <div
                    key={task.name}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Play className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="font-medium text-foreground">{task.name}</p>
                        <p className="text-xs text-muted-foreground">{task.desc}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {task.cron}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>
    </div>
  );
}
