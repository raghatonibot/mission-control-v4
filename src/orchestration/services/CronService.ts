// Cron Service - Agendamento de tarefas automáticas

import cron from 'node-cron';
import { MessageBroker } from './MessageBroker.js';
import type { AgentManager } from '../workers/AgentManager.js';
import type { AgentId } from '../types/AgentMessage.js';

export interface ScheduledTask {
  name: string;
  agentId: AgentId;
  cronExpression: string;
  task: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export class CronService {
  private broker: MessageBroker;
  private manager: AgentManager;
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private taskConfigs: Map<string, ScheduledTask> = new Map();

  constructor(broker: MessageBroker, manager: AgentManager) {
    this.broker = broker;
    this.manager = manager;
  }

  // Iniciar todos os crons
  startAll(): void {
    console.log('⏰ Iniciando Cron Service...');

    // BlackWidow: A cada 15 minutos
    this.scheduleTask({
      name: 'blackwidow-monitor',
      agentId: 'blackwidow',
      cronExpression: '*/15 * * * *',
      task: 'monitor-social',
      enabled: true
    });

    // Hawkeye: A cada 15 minutos
    this.scheduleTask({
      name: 'hawkeye-system-check',
      agentId: 'hawkeye',
      cronExpression: '*/15 * * * *',
      task: 'system-check',
      enabled: true
    });

    // IronMan: Todo dia às 07:00
    this.scheduleTask({
      name: 'ironman-daily-research',
      agentId: 'ironman',
      cronExpression: '0 7 * * *',
      task: 'research daily trends',
      enabled: true
    });

    // Fury: A cada 4 horas
    this.scheduleTask({
      name: 'fury-prioritize',
      agentId: 'fury',
      cronExpression: '0 */4 * * *',
      task: 'review and prioritize backlog',
      enabled: true
    });

    // Standup: Todo dia às 09:00
    this.scheduleTask({
      name: 'daily-standup',
      agentId: 'ragha',
      cronExpression: '0 9 * * *',
      task: 'daily standup report',
      enabled: true
    });

    console.log(`⏰ ${this.tasks.size} tarefas agendadas`);
    this.printSchedule();
  }

  // Agendar uma tarefa
  scheduleTask(config: ScheduledTask): void {
    if (!cron.validate(config.cronExpression)) {
      console.error(`❌ Expressão cron inválida: ${config.cronExpression}`);
      return;
    }

    const scheduledTask = cron.schedule(config.cronExpression, async () => {
      console.log(`⏰ Executando: ${config.name}`);
      
      try {
        await this.executeTask(config);
        config.lastRun = new Date();
      } catch (error) {
        console.error(`❌ Erro na tarefa ${config.name}:`, error);
      }
    }, {
      scheduled: config.enabled
    });

    this.tasks.set(config.name, scheduledTask);
    this.taskConfigs.set(config.name, config);

    // Calcular próxima execução
    config.nextRun = this.calculateNextRun(config.cronExpression);

    console.log(`⏰ Agendado: ${config.name} (${config.cronExpression})`);
  }

  // Executar tarefa
  private async executeTask(config: ScheduledTask): Promise<void> {
    // Verificar se agente está ativo
    const agentStatus = this.manager.getAgentStatus(config.agentId);
    if (!agentStatus || agentStatus.status === 'offline') {
      console.warn(`⚠️ Agente ${config.agentId} offline, não executando ${config.name}`);
      return;
    }

    // Enviar task para o agente
    await this.broker.send({
      from: 'ragha',
      to: config.agentId,
      type: 'task',
      payload: {
        task: config.task,
        source: 'cron',
        scheduledAt: new Date().toISOString()
      },
      sessionId: `cron-${config.name}`
    });

    // Se for o Ragha (standup), processar diferente
    if (config.agentId === 'ragha') {
      await this.generateStandupReport();
    }
  }

  // Gerar relatório de standup
  private async generateStandupReport(): Promise<void> {
    console.log('📊 Gerando relatório de standup...');

    const status = this.manager.getAllStatus();
    const alerts = await this.getPendingAlerts();

    const report = {
      timestamp: new Date().toISOString(),
      agents: status,
      alerts: alerts,
      summary: {
        activeAgents: status.filter(s => s.status !== 'offline').length,
        busyAgents: status.filter(s => s.status === 'busy').length,
        totalAlerts: alerts.length
      }
    };

    console.log('📊 Standup Report:', JSON.stringify(report, null, 2));

    // Enviar alerta se houver algo crítico
    if (alerts.some(a => a.priority === 'critical')) {
      await this.broker.sendAlert(
        'ragha',
        'ALERTAS CRÍTICOS detectados no standup!',
        'critical',
        report
      );
    }
  }

  // Obter alertas pendentes (mock por enquanto)
  private async getPendingAlerts(): Promise<any[]> {
    // TODO: Integrar com sistema de alertas real
    return [];
  }

  // Parar todas as tarefas
  stopAll(): void {
    console.log('⏰ Parando Cron Service...');
    
    for (const [name, task] of this.tasks) {
      task.stop();
      console.log(`⏰ Parado: ${name}`);
    }
    
    this.tasks.clear();
  }

  // Parar tarefa específica
  stopTask(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.stop();
      console.log(`⏰ Parado: ${name}`);
    }
  }

  // Iniciar tarefa específica
  startTask(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.start();
      console.log(`⏰ Iniciado: ${name}`);
    }
  }

  // Listar todas as tarefas
  listTasks(): ScheduledTask[] {
    return Array.from(this.taskConfigs.values());
  }

  // Verificar status
  getStatus(): any {
    return {
      running: this.tasks.size,
      tasks: Array.from(this.taskConfigs.entries()).map(([name, config]) => ({
        name,
        agentId: config.agentId,
        cronExpression: config.cronExpression,
        enabled: config.enabled,
        lastRun: config.lastRun,
        nextRun: config.nextRun
      }))
    };
  }

  // Imprimir agenda
  private printSchedule(): void {
    console.log('\n📅 Agenda de Tarefas:');
    console.log('─────────────────────────────────────');
    
    for (const [name, config] of this.taskConfigs) {
      const next = config.nextRun ? config.nextRun.toLocaleString('pt-BR') : 'N/A';
      console.log(`${name.padEnd(25)} | ${config.cronExpression.padEnd(15)} | Próx: ${next}`);
    }
    
    console.log('─────────────────────────────────────\n');
  }

  // Calcular próxima execução
  private calculateNextRun(cronExpression: string): Date {
    // Simplificado: adiciona 1 minuto para testes
    // Em produção, usar biblioteca como cron-parser
    const now = new Date();
    
    if (cronExpression === '*/15 * * * *') {
      now.setMinutes(now.getMinutes() + 15);
    } else if (cronExpression === '0 */4 * * *') {
      now.setHours(now.getHours() + 4);
    } else if (cronExpression === '0 7 * * *') {
      now.setDate(now.getDate() + 1);
      now.setHours(7, 0, 0, 0);
    } else if (cronExpression === '0 9 * * *') {
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
    }
    
    return now;
  }
}
