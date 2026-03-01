// Fury Agent - Diretor Estratégico de Priorização

import { BaseAgent } from './BaseAgent.js';
import type { MessageBroker } from '../services/MessageBroker.js';
import type { AgentMessage } from '../types/AgentMessage.js';

const SKILLS_AVAILABLE = [
  'notion-tasks',
  'priority-matrix',
  'model-usage',
  'github',
  'gh-issues'
];

export class FuryAgent extends BaseAgent {
  constructor(broker: MessageBroker) {
    super({
      id: 'fury',
      name: 'Fury',
      description: 'Priorização — prioriza tasks do backlog e distribui para execução',
      skills: SKILLS_AVAILABLE,
      model: 'kimi-coding/k2p5',
      schedule: '4h',
      maxConcurrentTasks: 3
    }, broker);
  }

  async executeTask(payload: any, message: AgentMessage): Promise<any> {
    const { task, skill, params } = payload;

    switch (skill || this.inferSkill(task)) {
      case 'prioritize':
        return await this.prioritizeTasks(params);
      
      case 'assign-task':
        return await this.assignTask(params);
      
      case 'review-backlog':
        return await this.reviewBacklog(params);
      
      case 'check-github-issues':
        return await this.checkGitHubIssues(params);
      
      default:
        return await this.prioritizeTasks(params);
    }
  }

  private inferSkill(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('assign') || lowerTask.includes('atribuir')) {
      return 'assign-task';
    }
    if (lowerTask.includes('backlog') || lowerTask.includes('revisar')) {
      return 'review-backlog';
    }
    if (lowerTask.includes('github') || lowerTask.includes('issue')) {
      return 'check-github-issues';
    }
    
    return 'prioritize';
  }

  private async prioritizeTasks(params: any): Promise<any> {
    console.log(`🎯 Fury priorizando tasks...`);

    const tasks = params.tasks || [];
    const prioritized = [];

    for (const task of tasks) {
      const analysis = this.analyzeTask(task);
      prioritized.push({
        ...task,
        ...analysis,
        assigned_to: this.suggestAssignee(analysis)
      });
    }

    // Ordenar por prioridade
    prioritized.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return {
      total_tasks: tasks.length,
      prioritized,
      summary: {
        critical: prioritized.filter(t => t.priority === 'critical').length,
        high: prioritized.filter(t => t.priority === 'high').length,
        medium: prioritized.filter(t => t.priority === 'medium').length,
        low: prioritized.filter(t => t.priority === 'low').length
      },
      assignments: this.groupByAssignee(prioritized)
    };
  }

  private analyzeTask(task: any): any {
    // Análise baseada em matriz de prioridade
    const impact = task.impact || 'medium';
    const urgency = task.urgency || 'medium';

    // Matriz de Eisenhower
    let priority = 'low';
    let quadrant = '';

    if (impact === 'high' && urgency === 'high') {
      priority = 'critical';
      quadrant = 'DO_FIRST';
    } else if (impact === 'high' && urgency === 'low') {
      priority = 'high';
      quadrant = 'SCHEDULE';
    } else if (impact === 'low' && urgency === 'high') {
      priority = 'medium';
      quadrant = 'DELEGATE';
    } else {
      priority = 'low';
      quadrant = 'ELIMINATE';
    }

    // Ajustes baseados em complexidade
    if (task.complexity === 'high' && priority === 'critical') {
      // Tasks críticas complexas precisam de arquiteto
      task.needs_architect = true;
    }

    return {
      priority,
      quadrant,
      impact,
      urgency,
      estimated_effort: this.estimateEffort(task),
      risks: this.identifyRisks(task)
    };
  }

  private suggestAssignee(analysis: any): string {
    if (analysis.needs_architect) {
      return '@Shuri';
    }
    if (analysis.quadrant === 'DELEGATE') {
      return '@Thor'; // Execução direta
    }
    if (analysis.complexity === 'low') {
      return '@Thor';
    }
    if (analysis.priority === 'critical') {
      return '@Shuri → @Thor → @Hulk'; // Pipeline completo
    }
    return '@Thor';
  }

  private estimateEffort(task: any): string {
    const complexity = task.complexity || 'medium';
    const efforts = {
      low: '1-2 horas',
      medium: '4-8 horas',
      high: '1-3 dias'
    };
    return efforts[complexity] || 'Indefinido';
  }

  private identifyRisks(task: any): string[] {
    const risks = [];
    
    if (task.complexity === 'high') {
      risks.push('Complexidade pode aumentar prazo');
    }
    if (!task.requirements) {
      risks.push('Requisitos não claros');
    }
    if (task.dependencies?.length > 0) {
      risks.push(`Depende de ${task.dependencies.length} task(s)`);
    }

    return risks;
  }

  private groupByAssignee(tasks: any[]): any {
    const groups = {};
    for (const task of tasks) {
      const assignee = task.assigned_to;
      if (!groups[assignee]) {
        groups[assignee] = [];
      }
      groups[assignee].push(task);
    }
    return groups;
  }

  private decideAssignee(task: any): string | null {
    // Converter para string se for objeto
    const taskStr = typeof task === 'string' ? task : JSON.stringify(task);
    if (!taskStr || taskStr === '{}') return 'thor';
    
    const lower = taskStr.toLowerCase();
    if (lower.includes('pesquis') || lower.includes('buscar')) return 'ironman';
    if (lower.includes('arquitet') || lower.includes('design')) return 'shuri';
    if (lower.includes('implement') || lower.includes('codar') || lower.includes('script')) return 'thor';
    if (lower.includes('test') || lower.includes('validar') || lower.includes('qa')) return 'hulk';
    if (lower.includes('document') || lower.includes('doc') || lower.includes('wiki')) return 'pepper';
    if (lower.includes('monitor') || lower.includes('scrap')) return 'blackwidow';
    if (lower.includes('automat') || lower.includes('workflow')) return 'wanda';
    return 'thor';
  }

  private async assignTask(params: any): Promise<any> {
    // Extrair texto da task (pode vir em diferentes formatos)
    const taskText = typeof params === 'string' ? params : 
                     params.task ? (typeof params.task === 'string' ? params.task : JSON.stringify(params.task)) :
                     JSON.stringify(params);
    
    console.log(`🎯 Fury atribuindo task: ${taskText.substring(0, 100)}...`);

    // Se não especificou para quem atribuir, decidir baseado na task
    const assignee = params.to || this.decideAssignee(taskText);
    
    if (!assignee) {
      return {
        assigned: false,
        error: 'Não foi possível determinar para quem atribuir',
        task: params.task
      };
    }

    // Enviar mensagem para o agente
    await this.broker.send({
      from: 'fury',
      to: assignee,
      type: 'task',
      payload: {
        task: params.task,
        priority: params.priority || 'medium',
        context: params.context
      },
      sessionId: params.sessionId || 'system'
    });

    return {
      assigned: true,
      to: params.to,
      task: params.task,
      timestamp: new Date().toISOString()
    };
  }

  private async reviewBacklog(params: any): Promise<any> {
    console.log(`🎯 Fury revisando backlog...`);

    // TODO: Integrar com Notion ou outro sistema de tasks
    
    return {
      message: 'Backlog review not yet implemented',
      recommendation: 'Integrar com Notion API ou sistema de tasks'
    };
  }

  private async checkGitHubIssues(params: any): Promise<any> {
    console.log(`🎯 Fury verificando GitHub issues...`);

    // TODO: Integrar com GitHub API
    
    return {
      repo: params.repo,
      open_issues: 0,
      bugs: 0,
      features: 0
    };
  }
}
