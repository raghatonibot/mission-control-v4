// Pepper Agent - Gestão do Conhecimento e Documentação

import { BaseAgent } from './BaseAgent.js';
import type { MessageBroker } from '../services/MessageBroker.js';
import type { AgentMessage } from '../types/AgentMessage.js';

const SKILLS_AVAILABLE = [
  'smart-docs',
  'summarize',
  'wiki-docs',
  'video-frames'
];

export class PepperAgent extends BaseAgent {
  constructor(broker: MessageBroker) {
    super({
      id: 'pepper',
      name: 'Pepper',
      description: 'Documentação — gera docs e wikis após implementações',
      skills: SKILLS_AVAILABLE,
      model: 'kimi-coding/k2p5',
      maxConcurrentTasks: 3
    }, broker);
  }

  async executeTask(payload: any, message: AgentMessage): Promise<any> {
    const { task, skill, params } = payload;

    switch (skill || this.inferSkill(task)) {
      case 'generate-docs':
        return await this.generateDocs(params);
      
      case 'create-wiki':
        return await this.createWiki(params);
      
      case 'update-readme':
        return await this.updateReadme(params);
      
      case 'api-docs':
        return await this.generateAPIDocs(params);
      
      case 'changelog':
        return await this.generateChangelog(params);
      
      case 'summarize-content':
        return await this.summarizeContent(params);
      
      default:
        return await this.generateDocs(params);
    }
  }

  private inferSkill(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('wiki')) return 'create-wiki';
    if (lowerTask.includes('readme')) return 'update-readme';
    if (lowerTask.includes('api') || lowerTask.includes('endpoint')) return 'api-docs';
    if (lowerTask.includes('changelog') || lowerTask.includes('versão')) return 'changelog';
    if (lowerTask.includes('resum')) return 'summarize-content';
    
    return 'generate-docs';
  }

  private async generateDocs(params: any): Promise<any> {
    console.log(`📚 Pepper gerando documentação: ${params.topic}`);

    const docs = {
      title: params.title || `Documentação: ${params.topic}`,
      sections: [] as any[],
      examples: [] as any[],
      generated_at: new Date().toISOString()
    };

    // Seções padrão
    docs.sections = [
      { title: 'Visão Geral', content: params.overview || `Documentação para ${params.topic}` },
      { title: 'Instalação', content: this.generateInstallationSection(params) },
      { title: 'Uso', content: this.generateUsageSection(params) },
      { title: 'API Reference', content: this.generateAPIReference(params) },
      { title: 'Exemplos', content: 'Veja seção de exemplos abaixo' }
    ];

    // Gerar exemplos
    docs.examples = this.generateExamples(params);

    return docs;
  }

  private generateInstallationSection(params: any): string {
    const steps = [
      'Clone o repositório',
      'Execute `npm install`',
      'Configure as variáveis de ambiente',
      'Execute `npm run dev` para iniciar'
    ];
    return steps.join('\n');
  }

  private generateUsageSection(params: any): string {
    return `
## Uso Básico

\`\`\`typescript
import { ${params.moduleName || 'Module'} } from './${params.moduleName || 'module'}';

const instance = new ${params.moduleName || 'Module'}();
await instance.initialize();
\`\`\`
    `.trim();
  }

  private generateAPIReference(params: any): string {
    const methods = params.methods || [{ name: 'method', params: [], returns: 'void' }];
    
    return methods.map(m => `
### ${m.name}(${m.params?.join(', ') || ''})

Retorna: \`${m.returns || 'void'}\`

${m.description || ''}
    `.trim()).join('\n\n');
  }

  private generateExamples(params: any): any[] {
    return [
      {
        title: 'Exemplo Básico',
        code: '// TODO: Adicionar exemplo real',
        description: 'Uso simples do recurso'
      },
      {
        title: 'Exemplo Avançado',
        code: '// TODO: Adicionar exemplo avançado',
        description: 'Uso com configurações customizadas'
      }
    ];
  }

  private async createWiki(params: any): Promise<any> {
    console.log(`📚 Pepper criando wiki: ${params.title}`);

    // TODO: Integrar com GitHub Wiki API
    
    return {
      title: params.title,
      pages: [
        { name: 'Home', content: 'Página inicial' },
        { name: 'Getting Started', content: 'Como começar' },
        { name: 'FAQ', content: 'Perguntas frequentes' }
      ],
      message: 'Wiki estruturada. Integrar com GitHub para publicação.'
    };
  }

  private async updateReadme(params: any): Promise<any> {
    console.log(`📚 Pepper atualizando README...`);

    const readme = {
      sections: [
        '# ' + (params.projectName || 'Project'),
        '',
        params.description || 'Descrição do projeto',
        '',
        '## Instalação',
        '',
        '```bash\nnpm install\n```',
        '',
        '## Uso',
        '',
        '```typescript\n// exemplo de uso\n```',
        '',
        '## Contribuindo',
        '',
        'Veja [CONTRIBUTING.md](CONTRIBUTING.md)',
        '',
        '## Licença',
        '',
        '[MIT](LICENSE)'
      ]
    };

    return {
      content: readme.sections.join('\n'),
      updated_sections: ['Instalação', 'Uso']
    };
  }

  private async generateAPIDocs(params: any): Promise<any> {
    console.log(`📚 Pepper gerando docs de API...`);

    const endpoints = params.endpoints || [];

    return {
      base_url: params.baseUrl || 'http://localhost:3000',
      version: params.version || 'v1',
      endpoints: endpoints.map(e => ({
        method: e.method || 'GET',
        path: e.path,
        description: e.description,
        parameters: e.parameters || [],
        responses: e.responses || { '200': { description: 'Success' } }
      })),
      authentication: params.auth || 'Bearer token'
    };
  }

  private async generateChangelog(params: any): Promise<any> {
    console.log(`📚 Pepper gerando changelog...`);

    return {
      version: params.version || '1.0.0',
      date: new Date().toISOString().split('T')[0],
      changes: {
        added: params.added || [],
        changed: params.changed || [],
        deprecated: params.deprecated || [],
        removed: params.removed || [],
        fixed: params.fixed || [],
        security: params.security || []
      }
    };
  }

  private async summarizeContent(params: any): Promise<any> {
    console.log(`📚 Pepper resumindo conteúdo...`);

    const content = params.content || params.text || '';
    const maxLength = params.maxLength || 500;

    // Resumo simples (truncation + primeiras frases)
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    const summary = sentences.slice(0, 3).join(' ');

    return {
      original_length: content.length,
      summary_length: summary.length,
      summary: summary.length > maxLength 
        ? summary.substring(0, maxLength) + '...'
        : summary,
      key_points: this.extractKeyPoints(content)
    };
  }

  private extractKeyPoints(content: string): string[] {
    // Extrair pontos-chave (sentenças com palavras importantes)
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    const keyWords = ['importante', 'chave', 'principal', 'deve', 'recomendado'];
    
    return sentences
      .filter(s => keyWords.some(kw => s.toLowerCase().includes(kw)))
      .slice(0, 5)
      .map(s => s.trim());
  }
}
