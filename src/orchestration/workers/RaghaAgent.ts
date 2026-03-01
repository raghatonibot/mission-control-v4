// Ragha Agent - O Orquestrador Principal

import { BaseAgent } from './BaseAgent.js';
import { Orchestrator } from '../services/Orchestrator.js';
import type { MessageBroker } from '../services/MessageBroker.js';
import type { AgentMessage, AgentId } from '../types/AgentMessage.js';

export class RaghaAgent extends BaseAgent {
  private orchestrator: Orchestrator;

  constructor(broker: MessageBroker) {
    super({
      id: 'ragha',
      name: 'Ragha',
      description: 'Líder e Orquestrador — coordena todos os agentes via delegação automática',
      skills: [
        'clawhub',
        'find-skills', 
        'self-improvement',
        'orchestration',
        'delegation'
      ],
      model: 'openai-codex/gpt-5.3-codex',
      schedule: '15min',
      maxConcurrentTasks: 10
    }, broker);

    this.orchestrator = new Orchestrator(broker);
  }

  async executeTask(payload: any, message: AgentMessage): Promise<any> {
    const { task, skill, params } = payload;

    // Se for um comando direto para Ragha (não orquestração)
    if (skill === 'status') {
      return await this.getSystemStatus();
    }

    if (skill === 'alerts') {
      return await this.getPendingAlerts();
    }

    if (skill === 'direct-message') {
      // Mensagem direta do usuário - orquestrar!
      return await this.handleUserMessage(task || payload.message, message.sessionId, params);
    }

    // Por padrão, tratar como mensagem do usuário
    return await this.handleUserMessage(task || payload.message || 'Comando não especificado', message.sessionId, params);
  }

  // Método principal - receber mensagem do usuário e orquestrar
  async handleUserMessage(
    message: string, 
    sessionId: string, 
    context?: any
  ): Promise<any> {
    console.log(`🎭 Ragha recebeu: "${message.substring(0, 60)}..."`);

    // Verificar se é um comando direto a outro agente
    const directMention = this.parseDirectMention(message);
    if (directMention) {
      console.log(`🎭 Menção direta detectada: @${directMention.agentId}`);
      return await this.handleDirectDelegation(directMention, sessionId);
    }

    // Orquestração automática
    console.log(`🎭 Iniciando orquestração automática...`);
    
    const result = await this.orchestrator.orchestrate(message, sessionId, context);

    // Formatar resposta para o usuário
    return this.formatResponseForUser(result);
  }

  // Verificar se usuário mencionou agente diretamente (@IronMan, etc.)
  private parseDirectMention(message: string): { agentId: AgentId; cleanMessage: string } | null {
    const mentionMatch = message.match(/@(\w+)/);
    if (!mentionMatch) return null;

    const possibleId = mentionMatch[1].toLowerCase();
    const validAgents: AgentId[] = ['ironman', 'fury', 'shuri', 'thor', 'hulk', 'pepper', 'blackwidow', 'hawkeye', 'wanda'];
    
    if (validAgents.includes(possibleId as AgentId)) {
      const cleanMessage = message.replace(/@\w+/, '').trim();
      return { agentId: possibleId as AgentId, cleanMessage };
    }

    return null;
  }

  // Delegar diretamente para um agente (sem orquestração completa)
  private async handleDirectDelegation(
    mention: { agentId: AgentId; cleanMessage: string },
    sessionId: string
  ): Promise<any> {
    console.log(`🎭 Delegando diretamente para @${mention.agentId}`);

    const response = await this.broker.sendTaskAndWait(
      'ragha',
      mention.agentId,
      {
        task: mention.cleanMessage,
        priority: 'medium'
      },
      300000 // 5 min timeout
    );

    return {
      delegated_to: mention.agentId,
      response: response.success ? response.data : { error: response.error },
      note: `Delegado diretamente para @${mention.agentId} (sem orquestração completa)`
    };
  }

  // Formatar resultado da orquestração para o usuário
  private formatResponseForUser(result: any): any {
    const parts: string[] = [];

    // Header
    parts.push(`🎭 Orquestração completa (${result.executionTime}ms)`);
    parts.push('');

    // Agentes chamados
    parts.push(`📋 Agentes: ${result.agentsCalled.map((a: string) => `@${a}`).join(', ')}`);
    parts.push('');

    // Respostas individuais
    for (const [agentId, response] of result.responses) {
      const emoji = this.getAgentEmoji(agentId);
      const name = this.getAgentName(agentId);
      
      if (response.success) {
        parts.push(`${emoji} **${name}**: ${this.summarizeForDisplay(agentId, response.data)}`);
      } else {
        parts.push(`${emoji} **${name}**: ❌ ${response.error || 'Erro'}`);
      }
    }

    parts.push('');

    // Consolidação
    if (result.consolidated.summary) {
      parts.push(`📝 **Resumo**: ${result.consolidated.summary}`);
    }

    // Recomendações
    if (result.consolidated.recommendations?.length > 0) {
      parts.push('');
      parts.push('💡 **Recomendações**:');
      for (const rec of result.consolidated.recommendations) {
        parts.push(`   • ${rec}`);
      }
    }

    // Próximos passos
    if (result.consolidated.nextSteps?.length > 0) {
      parts.push('');
      parts.push('🚀 **Próximos Passos**:');
      for (const step of result.consolidated.nextSteps) {
        parts.push(`   • ${step}`);
      }
    }

    return {
      formatted: parts.join('\n'),
      raw: result,
      forDisplay: true
    };
  }

  // Obter emoji para cada agente
  private getAgentEmoji(agentId: AgentId): string {
    const emojis: Record<AgentId, string> = {
      ragha: '🎭',
      ironman: '🔬',
      fury: '🎯',
      shuri: '🛠️',
      thor: '⚡',
      hulk: '💪',
      pepper: '📚',
      blackwidow: '🕷️',
      hawkeye: '🎯',
      wanda: '🔮'
    };
    return emojis[agentId] || '🤖';
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

  private summarizeForDisplay(agentId: AgentId, data: any): string {
    if (!data) return 'Completo';

    switch (agentId) {
      case 'ironman':
        const reddit = data.sources?.reddit?.total_posts || 0;
        const twitter = data.sources?.twitter?.total_tweets || 0;
        return `${reddit} posts Reddit, ${twitter} tweets`;
      
      case 'shuri':
        return `${data.components?.length || 0} componentes arquitetados`;
      
      case 'thor':
        return data.pr_url ? 'PR criado' : 'Implementado';
      
      case 'hulk':
        return data.approval ? '✅ Aprovado' : '❌ Falhou';
      
      case 'fury':
        return `${data.summary?.critical || 0} critical`;
      
      default:
        return 'Completo';
    }
  }

  // Obter status do sistema
  private async getSystemStatus(): Promise<any> {
    // Isso seria integrado com o AgentManager
    return {
      message: 'Status do sistema',
      note: 'Integrar com AgentManager para status real dos agentes'
    };
  }

  // Obter alertas pendentes
  private async getPendingAlerts(): Promise<any> {
    return {
      message: 'Alertas pendentes',
      note: 'Integrar com sistema de alertas'
    };
  }
}
