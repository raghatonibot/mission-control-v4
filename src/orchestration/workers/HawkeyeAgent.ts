// Hawkeye Agent - Monitoramento de sistema e métricas

import { BaseAgent } from './BaseAgent.js';
import type { MessageBroker } from '../services/MessageBroker.js';
import type { AgentMessage } from '../types/AgentMessage.js';

const SKILLS_AVAILABLE = [
  'model-usage',
  'healthcheck',
  'log-analyzer',
  'Agent Browser'
];

export class HawkeyeAgent extends BaseAgent {
  private metrics: Map<string, any> = new Map();

  constructor(broker: MessageBroker) {
    super({
      id: 'hawkeye',
      name: 'Hawkeye',
      description: 'Monitoramento — métricas e saúde do sistema',
      skills: SKILLS_AVAILABLE,
      model: 'kimi-coding/k2p5',
      schedule: '15min',
      maxConcurrentTasks: 10
    }, broker);
  }

  async executeTask(payload: any, message: AgentMessage): Promise<any> {
    const { task, skill, params } = payload;

    switch (skill || this.inferSkill(task)) {
      case 'system-check':
        return await this.systemCheck(params);
      
      case 'check-model-usage':
        return await this.checkModelUsage(params);
      
      case 'health-check':
        return await this.healthCheck(params);
      
      case 'analyze-logs':
        return await this.analyzeLogs(params);
      
      case 'check-service':
        return await this.checkService(params);
      
      default:
        return await this.systemCheck(params);
    }
  }

  private inferSkill(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('token') || lowerTask.includes('custo') || lowerTask.includes('usage')) {
      return 'check-model-usage';
    }
    if (lowerTask.includes('health') || lowerTask.includes('segurança')) {
      return 'health-check';
    }
    if (lowerTask.includes('log') || lowerTask.includes('erro')) {
      return 'analyze-logs';
    }
    if (lowerTask.includes('serviço') || lowerTask.includes('url')) {
      return 'check-service';
    }
    
    return 'system-check';
  }

  private async systemCheck(params: any = {}): Promise<any> {
    console.log(`🎯 Hawkeye executando system check...`);

    const report = {
      timestamp: new Date().toISOString(),
      overall_status: 'ok' as 'ok' | 'warning' | 'critical',
      checks: {} as any,
      alerts: [] as any[]
    };

    // Check 1: Uso de tokens
    try {
      report.checks.model_usage = await this.checkModelUsage();
      if (report.checks.model_usage.alert) {
        report.alerts.push(report.checks.model_usage.alert);
        report.overall_status = 'warning';
      }
    } catch (error) {
      report.checks.model_usage = { error: error instanceof Error ? error.message : 'Failed' };
    }

    // Check 2: Health do sistema
    try {
      report.checks.health = await this.healthCheck();
      if (report.checks.health.vulnerabilities > 0) {
        report.alerts.push({
          priority: 'high',
          message: `${report.checks.health.vulnerabilities} vulnerabilidades detectadas`
        });
        report.overall_status = 'warning';
      }
    } catch (error) {
      report.checks.health = { error: error instanceof Error ? error.message : 'Failed' };
    }

    // Check 3: Logs de erro
    try {
      report.checks.logs = await this.analyzeLogs();
      if (report.checks.logs.errors > 0) {
        report.alerts.push({
          priority: report.checks.logs.errors > 10 ? 'critical' : 'medium',
          message: `${report.checks.logs.errors} erros nos logs`
        });
        if (report.checks.logs.errors > 10) {
          report.overall_status = 'critical';
        }
      }
    } catch (error) {
      report.checks.logs = { error: error instanceof Error ? error.message : 'Failed' };
    }

    // Check 4: Status de serviços
    try {
      report.checks.services = await this.checkAllServices();
    } catch (error) {
      report.checks.services = { error: error instanceof Error ? error.message : 'Failed' };
    }

    // Enviar alertas críticos
    for (const alert of report.alerts) {
      if (alert.priority === 'critical') {
        await this.sendAlert(
          `Hawkeye CRITICAL: ${alert.message}`,
          'critical',
          alert
        );
      }
    }

    return report;
  }

  private async checkModelUsage(params: any = {}): Promise<any> {
    console.log(`🎯 Hawkeye verificando uso de tokens...`);

    // TODO: Integrar com tracking real de tokens
    // Por enquanto, retorna mock

    const dailyBudget = params.dailyBudget || 50; // R$50/dia
    const currentUsage = 12.50; // Mock

    const result = {
      daily_budget: dailyBudget,
      current_usage: currentUsage,
      percentage: (currentUsage / dailyBudget) * 100,
      status: currentUsage > dailyBudget * 0.8 ? 'warning' : 'ok',
      alert: null as any
    };

    if (result.percentage > 80) {
      result.alert = {
        priority: result.percentage > 100 ? 'critical' : 'high',
        message: `Uso de tokens em ${result.percentage.toFixed(1)}% do orçamento diário`
      };
    }

    return result;
  }

  private async healthCheck(params: any = {}): Promise<any> {
    console.log(`🎯 Hawkeye executando health check...`);

    // TODO: Integrar com healthcheck skill real
    
    return {
      timestamp: new Date().toISOString(),
      checks_performed: ['ports', 'permissions'],
      vulnerabilities: 0,
      recommendations: []
    };
  }

  private async analyzeLogs(params: any = {}): Promise<any> {
    console.log(`🎯 Hawkeye analisando logs...`);

    // TODO: Integrar com log-analyzer skill real
    
    const logFile = params.logFile || './logs/app.log';
    const pattern = params.pattern || 'ERROR|FATAL';

    // Mock de análise
    return {
      log_file: logFile,
      pattern,
      errors: 0,
      warnings: 2,
      last_errors: []
    };
  }

  private async checkService(params: any): Promise<any> {
    console.log(`🎯 Hawkeye verificando serviço: ${params.url}`);

    const url = params.url;
    
    try {
      // Usar fetch para verificar
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });

      return {
        url,
        status: response.status,
        ok: response.ok,
        response_time: 0, // TODO: medir tempo real
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        url,
        status: 0,
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkAllServices(): Promise<any> {
    const services = [
      { name: 'Mission Control', url: 'http://localhost:3004/health' },
      { name: 'OpenClaw Gateway', url: 'http://localhost:18789/' }
    ];

    const results = [];
    for (const service of services) {
      const check = await this.checkService({ url: service.url });
      results.push({ ...service, ...check });
    }

    return {
      services_checked: services.length,
      services_up: results.filter(r => r.ok).length,
      services_down: results.filter(r => !r.ok).length,
      details: results
    };
  }
}
