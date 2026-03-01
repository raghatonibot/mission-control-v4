// API Routes - Endpoints para integração com Mission Control

import { Router } from 'express';
import type { MessageBroker, AgentManager, Orchestrator, SessionManager, CronService } from '../index.js';

export function createAPIRoutes(
  broker: MessageBroker,
  manager: AgentManager,
  orchestrator: Orchestrator,
  sessionManager: SessionManager,
  cronService: CronService
): Router {
  const router = Router();

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        broker: 'connected',
        agents: manager.isActive() ? 'running' : 'stopped',
        cron: cronService.getStatus().running > 0 ? 'running' : 'stopped'
      }
    });
  });

  // Status de todos os agentes
  router.get('/agents/status', (req, res) => {
    const status = manager.getAllStatus();
    res.json({
      timestamp: new Date().toISOString(),
      agents: status
    });
  });

  // Status de agente específico
  router.get('/agents/:agentId/status', (req, res) => {
    const { agentId } = req.params;
    const status = manager.getAgentStatus(agentId as any);
    
    if (!status) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }
    
    res.json(status);
  });

  // Enviar mensagem para Ragha (orquestração)
  router.post('/orchestrate', async (req, res) => {
    try {
      const { message, sessionId, context } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Mensagem obrigatória' });
      }

      const result = await orchestrator.orchestrate(
        message,
        sessionId || `session-${Date.now()}`,
        context
      );

      res.json(result);
    } catch (error) {
      console.error('Erro na orquestração:', error);
      res.status(500).json({
        error: 'Erro ao processar mensagem',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Enviar mensagem direta para agente
  router.post('/agents/:agentId/message', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { message, sessionId } = req.body;

      const response = await broker.sendTaskAndWait(
        'ragha',
        agentId as any,
        {
          task: message,
          priority: 'medium',
          sessionId: sessionId || `direct-${Date.now()}`
        },
        300000 // 5 min timeout
      );

      res.json(response);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      res.status(500).json({
        error: 'Erro ao enviar mensagem',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Obter histórico de sessão
  router.get('/sessions/:sessionId/history', (req, res) => {
    const { sessionId } = req.params;
    const { limit } = req.query;
    
    const history = sessionManager.getMessageHistory(
      sessionId,
      limit ? parseInt(limit as string) : 50
    );
    
    res.json({
      sessionId,
      messages: history
    });
  });

  // Obter contexto de sessão
  router.get('/sessions/:sessionId/context', (req, res) => {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    res.json({
      sessionId,
      context: session.context,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    });
  });

  // Atualizar contexto de sessão
  router.post('/sessions/:sessionId/context', (req, res) => {
    const { sessionId } = req.params;
    const { context } = req.body;
    
    sessionManager.updateSessionContext(sessionId, context);
    
    res.json({ success: true });
  });

  // Obter alertas
  router.get('/alerts', (req, res) => {
    const { priority, unread } = req.query;
    
    let alerts;
    if (unread === 'true') {
      alerts = sessionManager.getUnreadAlerts(priority as any);
    } else {
      // TODO: Implementar getAllAlerts
      alerts = sessionManager.getUnreadAlerts();
    }
    
    res.json({
      count: alerts.length,
      alerts
    });
  });

  // Marcar alerta como lido
  router.post('/alerts/:alertId/read', (req, res) => {
    const { alertId } = req.params;
    sessionManager.markAlertAsRead(alertId);
    res.json({ success: true });
  });

  // Obter tasks de sessão
  router.get('/sessions/:sessionId/tasks', (req, res) => {
    const { sessionId } = req.params;
    const tasks = sessionManager.getTasks(sessionId);
    
    res.json({
      sessionId,
      tasks
    });
  });

  // Obter agenda de crons
  router.get('/cron/schedule', (req, res) => {
    const tasks = cronService.listTasks();
    res.json({
      tasks
    });
  });

  // Controlar cron (start/stop)
  router.post('/cron/:taskName/:action', (req, res) => {
    const { taskName, action } = req.params;
    
    if (action === 'start') {
      cronService.startTask(taskName);
    } else if (action === 'stop') {
      cronService.stopTask(taskName);
    } else {
      return res.status(400).json({ error: 'Ação inválida (use start ou stop)' });
    }
    
    res.json({ success: true, task: taskName, action });
  });

  // Estatísticas gerais
  router.get('/stats', (req, res) => {
    const sessionStats = sessionManager.getStats();
    const agentStatus = manager.getAllStatus();
    const cronStatus = cronService.getStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      sessions: sessionStats,
      agents: {
        total: agentStatus.length,
        active: agentStatus.filter(a => a.status !== 'offline').length,
        busy: agentStatus.filter(a => a.status === 'busy').length
      },
      cron: cronStatus,
      broker: broker.getStats()
    });
  });

  return router;
}
