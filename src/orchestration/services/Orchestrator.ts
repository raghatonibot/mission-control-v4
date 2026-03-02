// Orchestrator Service - Lógica de delegação e consolidação

import { MessageBroker } from './MessageBroker.js';
import type { 
  AgentMessage, 
  AgentId, 
  TaskRequest, 
  TaskResponse,
  Priority 
} from '../types/AgentMessage.js';

export interface TaskAnalysis {
  intent: string;
  complexity: 'low' | 'medium' | 'high';
  domain: string;
  requiresResearch: boolean;
  requiresImplementation: boolean;
  requiresArchitecture: boolean;
  requiresQA: boolean;
  requiresDocs: boolean;
  suggestedAgents: AgentId[];
  priority: Priority;
  estimatedTime: number; // minutos
}

export interface OrchestrationResult {
  task: string;
  analysis: TaskAnalysis;
  agentsCalled: AgentId[];
  responses: Map<AgentId, TaskResponse>;
  consolidated: {
    summary: string;
    details: any;
    recommendations: string[];
    nextSteps: string[];
  };
  executionTime: number;
  timestamp: string;
}

export class Orchestrator {
  private broker: MessageBroker;
  private activeOrchestrations: Map<string, OrchestrationContext> = new Map();

  constructor(broker: MessageBroker) {
    this.broker = broker;
  }

  // Método principal - analisar e orquestrar
  async orchestrate(
    userMessage: string,
    sessionId: string,
    context?: any
  ): Promise<OrchestrationResult> {
    const orchestrationId = this.generateId();
    const startTime = Date.now();

    console.log(`🎭 Ragha analisando: "${userMessage.substring(0, 50)}..."`);

    try {
      // 1. Analisar a task
      const analysis = this.analyzeTask(userMessage, context);
      console.log(`🎭 Análise: ${analysis.intent} | Complexidade: ${analysis.complexity}`);
      console.log(`🎭 Agentes sugeridos: ${analysis.suggestedAgents.join(', ')}`);

      // 2. Criar contexto de orquestração
      const orchContext: OrchestrationContext = {
        id: orchestrationId,
        sessionId,
        analysis,
        pendingAgents: new Set(analysis.suggestedAgents),
        responses: new Map(),
        startTime
      };
      this.activeOrchestrations.set(orchestrationId, orchContext);

      // 3. Enviar tasks para os agentes (em paralelo quando possível)
      const agentPromises = analysis.suggestedAgents.map(agentId => 
        this.delegateToAgent(agentId, userMessage, analysis, sessionId, orchestrationId)
      );

      // 4. Aguardar todas as respostas (com timeout)
      const responses = await Promise.allSettled(
        agentPromises.map(p => this.withTimeout(p, this.calculateTimeout(analysis)))
      );

      // 5. Processar respostas
      analysis.suggestedAgents.forEach((agentId, index) => {
        const result = responses[index];
        if (result.status === 'fulfilled') {
          orchContext.responses.set(agentId, result.value);
          orchContext.pendingAgents.delete(agentId);
        } else {
          console.warn(`❌ Agente ${agentId} falhou:`, result.reason);
          orchContext.responses.set(agentId, {
            success: false,
            error: result.reason?.message || 'Timeout or error',
            agentId
          });
        }
      });

      // 6. Consoladar resultados
      const consolidated = this.consolidateResults(orchContext);

      // 7. Montar resultado final
      const result: OrchestrationResult = {
        task: userMessage,
        analysis,
        agentsCalled: analysis.suggestedAgents,
        responses: orchContext.responses,
        consolidated,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      // 8. Limpar contexto
      this.activeOrchestrations.delete(orchestrationId);

      console.log(`🎭 Orquestração completa em ${result.executionTime}ms`);
      return result;

    } catch (error) {
      console.error('❌ Erro na orquestração:', error);
      throw error;
    }
  }

  // Analisar task e determinar quais agentes chamar
  private analyzeTask(message: string, context?: any): TaskAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Análise de intenção
    let intent = 'general';
    let requiresResearch = false;
    let requiresImplementation = false;
    let requiresArchitecture = false;
    let requiresQA = false;
    let requiresDocs = false;
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    let domain = 'general';

    // Detectar pesquisa/inteligência
    if (this.matchesAny(lowerMessage, [
      'pesquisar', 'pesquise', 'buscar', 'ache', 'encontre',
      'trend', 'tendência', 'novidade', 'lançamento',
      'reddit', 'twitter', 'github', 'social',
      'o que o pessoal está falando', 'buzz', 'hype'
    ])) {
      requiresResearch = true;
      intent = 'research';
    }

    // Detectar implementação
    if (this.matchesAny(lowerMessage, [
      'implementar', 'criar', 'desenvolver', 'codar', 'fazer',
      'script', 'função', 'feature', 'sistema',
      'commit', 'push', 'pr', 'pull request'
    ])) {
      requiresImplementation = true;
      intent = 'implementation';
    }

    // Detectar arquitetura
    if (this.matchesAny(lowerMessage, [
      'arquitetura', 'design', 'estrutura', 'padrão', 'pattern',
      'como fazer', 'qual a melhor forma', 'decisão técnica',
      'qual tecnologia', 'stack', 'escolher'
    ])) {
      requiresArchitecture = true;
      intent = 'architecture';
    }

    // Detectar QA
    if (this.matchesAny(lowerMessage, [
      'testar', 'validar', 'revisar código', 'code review',
      'bug', 'erro', 'problema', 'funciona'
    ])) {
      requiresQA = true;
      intent = 'quality';
    }

    // Detectar documentação
    if (this.matchesAny(lowerMessage, [
      'documentar', 'docs', 'wiki', 'readme', 'changelog',
      'como usar', 'tutorial', 'guia'
    ])) {
      requiresDocs = true;
      intent = 'documentation';
    }

    // Detectar automação
    if (this.matchesAny(lowerMessage, [
      'automatizar', 'workflow', 'cron', 'agendar',
      'scraper', 'coletar dados', 'monitorar'
    ])) {
      intent = 'automation';
    }

    // Detectar complexidade
    if (this.matchesAny(lowerMessage, [
      'sistema completo', 'arquitetura', 'microserviço',
      'refatorar', 'migrar', 'integrar'
    ])) {
      complexity = 'high';
    } else if (this.matchesAny(lowerMessage, [
      'simples', 'rápido', 'pequeno', 'script básico'
    ])) {
      complexity = 'low';
    }

    // Determinar domínio
    if (lowerMessage.includes('frontend') || lowerMessage.includes('ui')) domain = 'frontend';
    else if (lowerMessage.includes('backend') || lowerMessage.includes('api')) domain = 'backend';
    else if (lowerMessage.includes('devops') || lowerMessage.includes('deploy')) domain = 'devops';
    else if (lowerMessage.includes('ai') || lowerMessage.includes('ml')) domain = 'ai';

    // Selecionar agentes
    const suggestedAgents: AgentId[] = [];

    if (requiresResearch) {
      suggestedAgents.push('ironman');
      if (intent === 'research' && lowerMessage.includes('social')) {
        suggestedAgents.push('blackwidow');
      }
    }

    if (requiresArchitecture) {
      suggestedAgents.push('shuri');
    }

    if (requiresImplementation) {
      if (!requiresArchitecture) {
        suggestedAgents.push('fury'); // Priorizar primeiro
      }
      suggestedAgents.push('thor');
      if (complexity !== 'low') {
        suggestedAgents.push('hulk'); // QA para tasks complexas
      }
    }

    if (requiresQA) {
      if (!suggestedAgents.includes('hulk')) {
        suggestedAgents.push('hulk');
      }
    }

    if (requiresDocs) {
      suggestedAgents.push('pepper');
    }

    // Se nenhum agente específico, chamar IronMan como default
    if (suggestedAgents.length === 0) {
      suggestedAgents.push('ironman');
    }

    // Determinar prioridade
    let priority: Priority = 'medium';
    if (this.matchesAny(lowerMessage, ['urgente', 'critical', 'agora', 'hj', 'hoje'])) {
      priority = 'high';
    } else if (this.matchesAny(lowerMessage, ['quando puder', 'depois', 'low priority'])) {
      priority = 'low';
    }

    return {
      intent,
      complexity,
      domain,
      requiresResearch,
      requiresImplementation,
      requiresArchitecture,
      requiresQA,
      requiresDocs,
      suggestedAgents,
      priority,
      estimatedTime: this.estimateTime(complexity, suggestedAgents.length)
    };
  }

  // Delegar para um agente específico
  private async delegateToAgent(
    agentId: AgentId,
    originalTask: string,
    analysis: TaskAnalysis,
    sessionId: string,
    orchestrationId: string
  ): Promise<TaskResponse> {
    console.log(`🎭 Delegando para @${agentId}...`);

    // Criar task específica para o agente
    const taskRequest: TaskRequest = {
      task: this.adaptTaskForAgent(originalTask, agentId, analysis),
      priority: analysis.priority,
      params: {
        originalTask,
        analysis,
        orchestrationId
      },
      sessionId
    };

    // Enviar e aguardar resposta
    return await this.broker.sendTaskAndWait(
      'ragha',
      agentId,
      taskRequest,
      this.calculateTimeout(analysis)
    );
  }

  // Adaptar task para o contexto do agente
  private adaptTaskForAgent(task: string, agentId: AgentId, analysis: TaskAnalysis): string {
    const adaptations: Record<AgentId, string> = {
      ragha: task,
      ironman: `Pesquisar: ${task}`,
      fury: `Priorizar e atribuir: ${task}`,
      shuri: `Arquitetar/Design: ${task}`,
      thor: `Implementar: ${task}`,
      hulk: `Testar/Validar: ${task}`,
      pepper: `Documentar: ${task}`,
      blackwidow: `Monitorar redes sobre: ${task}`,
      hawkeye: `Verificar status/métricas: ${task}`,
      wanda: `Criar automação para: ${task}`
    };

    return adaptations[agentId] || task;
  }

  // Consoladar resultados de múltiplos agentes
  private consolidateResults(context: OrchestrationContext): any {
    const responses = Array.from(context.responses.entries());
    const successful = responses.filter(([_, r]) => r.success);
    const failed = responses.filter(([_, r]) => !r.success);

    // Gerar sumário
    const summaryParts: string[] = [];
    
    for (const [agentId, response] of successful) {
      const agentName = this.getAgentName(agentId);
      if (response.data) {
        summaryParts.push(`${agentName}: ${this.summarizeResponse(agentId, response.data)}`);
      }
    }

    // Recomendações
    const recommendations: string[] = [];
    
    if (context.analysis.requiresImplementation && !context.responses.has('thor')) {
      recommendations.push('@Thor ainda não implementou - considerar escalonar');
    }

    if (context.analysis.requiresQA && !context.responses.has('hulk')) {
      recommendations.push('Testes pendentes - @Hulk deve validar antes de deploy');
    }

    // Próximos passos
    const nextSteps: string[] = [];
    
    if (context.analysis.requiresArchitecture && context.responses.has('shuri')) {
      nextSteps.push('@Thor: Implementar conforme arquitetura aprovada por @Shuri');
    }

    if (context.analysis.requiresImplementation && context.responses.has('thor')) {
      nextSteps.push('@Hulk: Validar implementação');
    }

    if (context.analysis.requiresDocs && !context.responses.has('pepper')) {
      nextSteps.push('@Pepper: Documentar após aprovação');
    }

    return {
      summary: summaryParts.join(' | ') || 'Processamento completo',
      details: Object.fromEntries(context.responses),
      stats: {
        total: responses.length,
        success: successful.length,
        failed: failed.length
      },
      recommendations,
      nextSteps
    };
  }

  // Resumir resposta de um agente
  private summarizeResponse(agentId: AgentId, data: any): string {
    switch (agentId) {
      case 'ironman':
        const sources = [];
        if (data.sources?.reddit?.total_posts > 0) sources.push(`${data.sources.reddit.total_posts} posts Reddit`);
        if (data.sources?.twitter?.total_tweets > 0) sources.push(`${data.sources.twitter.total_tweets} tweets`);
        return sources.join(', ') || 'Pesquisa completa';
      
      case 'shuri':
        return `Arquitetura proposta: ${data.components?.length || 0} componentes`;
      
      case 'thor':
        return data.commit_hash ? `Implementado (${data.commit_hash.substring(0, 7)})` : 'Implementado';
      
      case 'hulk':
        return data.approval ? '✅ Aprovado' : `❌ ${data.summary?.failed || 0} falhas`;
      
      case 'fury':
        return `${data.summary?.critical || 0} critical, ${data.summary?.high || 0} high priority`;
      
      default:
        return 'Completo';
    }
  }

  // Utilitários
  private matchesAny(text: string, patterns: string[]): boolean {
    return patterns.some(p => text.includes(p));
  }

  private getAgentName(agentId: AgentId): string {
    const names: Record<AgentId, string> = {
      ragha: 'Ragha',
      ironman: 'IronMan',
      fury: 'Fury',
      shuri: 'Shuri',
      thor: 'Thor',
      hulk: 'Hulk',
      pepper: 'Pepper',
      blackwidow: 'BlackWidow',
      hawkeye: 'Hawkeye',
      wanda: 'Wanda'
    };
    return names[agentId] || agentId;
  }

  private calculateTimeout(analysis: TaskAnalysis): number {
    // Base: 2 minutos + 1 minuto por agente + complexidade
    const base = 120000;
    const perAgent = 60000 * analysis.suggestedAgents.length;
    const complexity = analysis.complexity === 'high' ? 180000 : 
                      analysis.complexity === 'medium' ? 60000 : 0;
    
    return base + perAgent + complexity;
  }

  private estimateTime(complexity: string, numAgents: number): number {
    const base = complexity === 'high' ? 30 : complexity === 'medium' ? 10 : 5;
    return base * numAgents;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  private generateId(): string {
    return `orch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Contexto interno de orquestração
interface OrchestrationContext {
  id: string;
  sessionId: string;
  analysis: TaskAnalysis;
  pendingAgents: Set<AgentId>;
  responses: Map<AgentId, TaskResponse>;
  startTime: number;
}
