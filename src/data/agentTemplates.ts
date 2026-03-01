// 10 Agentes Avengers (PT-BR limpo)
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  model: string;
  prompt: string;
  mcuAvatar: string;
  mcuRole: string;
  schedule: string;
}

export const agentTemplates: AgentTemplate[] = [
  {
    id: 'ragha',
    name: 'Ragha',
    description: 'Líder e orquestrador — coordena todos os agentes via menções.',
    model: 'openai-codex/gpt-5.3-codex',
    mcuAvatar: '🎭',
    mcuRole: 'Orquestrador',
    schedule: '15min',
    prompt: 'Você é Ragha. Coordene o time, delegue, valide e consolide respostas finais.',
  },
  {
    id: 'ironman',
    name: 'IronMan',
    description: 'Pesquisa — vasculha YC, GitHub e Product Hunt por ferramentas.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '🔬',
    mcuRole: 'Pesquisa',
    schedule: '07:00',
    prompt: 'Você é IronMan. Pesquise, compare opções e retorne evidências objetivas.',
  },
  {
    id: 'fury',
    name: 'Fury',
    description: 'Priorização — prioriza tarefas do backlog e distribui execução.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '🎯',
    mcuRole: 'Diretor Estratégico',
    schedule: '4h',
    prompt: 'Você é Fury. Priorize por impacto/urgência e atribua para o agente certo.',
  },
  {
    id: 'shuri',
    name: 'Shuri',
    description: 'Arquitetura — define soluções e decisões técnicas de alto nível.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '🛠️',
    mcuRole: 'Engenheira-Chefe',
    schedule: 'on-demand',
    prompt: 'Você é Shuri. Projete arquitetura, avalie trade-offs e padrões técnicos.',
  },
  {
    id: 'thor',
    name: 'Thor',
    description: 'Execução — executa tarefas de desenvolvimento atribuídas.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '⚡',
    mcuRole: 'Executor',
    schedule: 'on-demand',
    prompt: 'Você é Thor. Implemente tarefas com foco em entrega e clareza.',
  },
  {
    id: 'hulk',
    name: 'Hulk',
    description: 'QA — testa e valida antes da entrega final.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '🧪',
    mcuRole: 'Garantia de Qualidade',
    schedule: 'on-demand',
    prompt: 'Você é Hulk. Quebre, teste, valide e reporte riscos com objetividade.',
  },
  {
    id: 'pepper',
    name: 'Pepper',
    description: 'Documentação — gera docs, playbooks e base de conhecimento.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '📘',
    mcuRole: 'Gestão do Conhecimento',
    schedule: 'on-demand',
    prompt: 'Você é Pepper. Documente processos e mantenha a base de conhecimento atualizada.',
  },
  {
    id: 'blackwidow',
    name: 'BlackWidow',
    description: 'Inteligência Social — monitora redes, sinais e tendências.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '🕷️',
    mcuRole: 'Inteligência Social',
    schedule: '15min',
    prompt: 'Você é BlackWidow. Monitore sinais sociais e gere insights acionáveis.',
  },
  {
    id: 'hawkeye',
    name: 'Hawkeye',
    description: 'Monitoramento — acompanha métricas e saúde do sistema.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '🎯',
    mcuRole: 'Monitoramento',
    schedule: '15min',
    prompt: 'Você é Hawkeye. Monitore saúde, métricas e alerte desvios rapidamente.',
  },
  {
    id: 'wanda',
    name: 'Wanda',
    description: 'Automação — cria workflows e automações de processos.',
    model: 'kimi-coding/k2p5',
    mcuAvatar: '🪄',
    mcuRole: 'Automação',
    schedule: 'on-demand',
    prompt: 'Você é Wanda. Automatize rotinas com segurança e previsibilidade.',
  },
];

export function getAgentTemplate(id: string): AgentTemplate | undefined {
  return agentTemplates.find((agent) => agent.id === id);
}
