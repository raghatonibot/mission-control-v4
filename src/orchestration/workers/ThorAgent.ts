// Thor Agent - Executor de tarefas de desenvolvimento

import { BaseAgent } from './BaseAgent.js';
import type { MessageBroker } from '../services/MessageBroker.js';
import type { AgentMessage } from '../types/AgentMessage.js';

const SKILLS_AVAILABLE = [
  'github',
  'coding-agent',
  'skill-creator',
  'code-from-image',
  'Agent Browser'
];

export class ThorAgent extends BaseAgent {
  constructor(broker: MessageBroker) {
    super({
      id: 'thor',
      name: 'Thor',
      description: 'Execução — implementa features, cria código, faz commits',
      skills: SKILLS_AVAILABLE,
      model: 'kimi-coding/k2p5',
      maxConcurrentTasks: 3
    }, broker);
  }

  async executeTask(payload: any, message: AgentMessage): Promise<any> {
    const { task, skill, params } = payload;

    switch (skill || this.inferSkill(task)) {
      case 'implement':
        return await this.implementFeature(task, params);
      
      case 'create-script':
        return await this.createScript(params);
      
      case 'github-commit':
        return await this.githubCommit(params);
      
      case 'github-pr':
        return await this.createPullRequest(params);
      
      case 'test-locally':
        return await this.testLocally(params);
      
      case 'create-skill':
        return await this.createSkill(params);
      
      default:
        return await this.implementFeature(task, params);
    }
  }

  private inferSkill(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('commit') || lowerTask.includes('push')) {
      return 'github-commit';
    }
    if (lowerTask.includes('pr') || lowerTask.includes('pull request')) {
      return 'github-pr';
    }
    if (lowerTask.includes('script') || lowerTask.includes('automation')) {
      return 'create-script';
    }
    if (lowerTask.includes('skill')) {
      return 'create-skill';
    }
    if (lowerTask.includes('test')) {
      return 'test-locally';
    }
    
    return 'implement';
  }

  private async implementFeature(task: string, params: any): Promise<any> {
    console.log(`⚡ Thor implementando: ${task}`);

    // Implementação real usando coding-agent ou execução direta
    const result = {
      task,
      status: 'implemented',
      files_created: [] as string[],
      files_modified: [] as string[],
      commit_hash: null as string | null,
      pr_url: null as string | null,
      notes: [] as string[]
    };

    try {
      // 1. Criar/modificar arquivos
      if (params.files) {
        for (const file of params.files) {
          // TODO: Implementar criação real de arquivos
          result.files_created.push(file.path);
        }
      }

      // 2. Fazer commit se solicitado
      if (params.commit) {
        const commitResult = await this.githubCommit({
          message: params.commitMessage || `feat: ${task}`,
          files: [...result.files_created, ...result.files_modified]
        });
        result.commit_hash = commitResult.hash;
      }

      // 3. Criar PR se solicitado
      if (params.createPR) {
        const prResult = await this.createPullRequest({
          title: params.prTitle || task,
          body: params.prBody || `Implementação de: ${task}`
        });
        result.pr_url = prResult.url;
      }

      result.notes.push('Implementação concluída com sucesso');

    } catch (error) {
      result.notes.push(`Erro: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }

    return result;
  }

  private async createScript(params: any): Promise<any> {
    console.log(`⚡ Thor criando script: ${params.name}`);

    // Criar um script Node.js/Python
    const scriptContent = this.generateScript(params);
    
    return {
      name: params.name,
      language: params.language || 'javascript',
      content: scriptContent,
      usage: `node ${params.name}.js` // ou python, etc.
    };
  }

  private generateScript(params: any): string {
    // Template básico - em produção, usar LLM para gerar
    const template = `
#!/usr/bin/env node
/**
 * ${params.description || params.name}
 * Gerado por Thor Agent
 */

async function main() {
  console.log('Executando ${params.name}...');
  
  // TODO: Implementar lógica
  ${params.logic || '// sua lógica aqui'}
  
  console.log('Concluído!');
}

main().catch(console.error);
`;
    return template.trim();
  }

  private async githubCommit(params: any): Promise<any> {
    console.log(`⚡ Thor fazendo commit: ${params.message}`);

    // Usar GitHub CLI
    try {
      const { execSync } = await import('child_process');
      
      // Add files
      if (params.files && params.files.length > 0) {
        execSync(`git add ${params.files.join(' ')}`, { encoding: 'utf8' });
      } else {
        execSync('git add -A', { encoding: 'utf8' });
      }

      // Commit
      const result = execSync(`git commit -m "${params.message}"`, { 
        encoding: 'utf8',
        cwd: params.cwd || process.cwd()
      });

      // Push
      execSync('git push', { encoding: 'utf8' });

      return {
        success: true,
        message: params.message,
        output: result,
        hash: this.extractCommitHash(result)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git command failed'
      };
    }
  }

  private async createPullRequest(params: any): Promise<any> {
    console.log(`⚡ Thor criando PR: ${params.title}`);

    try {
      const { execSync } = await import('child_process');
      
      const result = execSync(
        `gh pr create --title "${params.title}" --body "${params.body || ''}"`,
        { encoding: 'utf8' }
      );

      return {
        success: true,
        title: params.title,
        url: this.extractPRUrl(result),
        output: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create PR'
      };
    }
  }

  private async testLocally(params: any): Promise<any> {
    console.log(`⚡ Thor testando localmente...`);

    // Rodar testes
    try {
      const { execSync } = await import('child_process');
      
      const result = execSync('npm test', { 
        encoding: 'utf8',
        cwd: params.cwd || process.cwd()
      });

      return {
        success: true,
        output: result,
        tests_passed: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tests failed',
        tests_passed: false
      };
    }
  }

  private async createSkill(params: any): Promise<any> {
    console.log(`⚡ Thor criando skill: ${params.name}`);

    // Criar estrutura de skill
    const skillStructure = {
      name: params.name,
      description: params.description,
      version: '1.0.0',
      entry: 'index.ts',
      files: [
        'SKILL.md',
        'index.ts',
        'package.json'
      ]
    };

    return {
      skill: skillStructure,
      message: `Skill ${params.name} estruturada. Use @Shuri para arquitetura detalhada.`
    };
  }

  private extractCommitHash(output: string): string | null {
    const match = output.match(/\[([a-f0-9]+)/);
    return match ? match[1] : null;
  }

  private extractPRUrl(output: string): string | null {
    const match = output.match(/https:\/\/github\.com\/[^\s]+/);
    return match ? match[0] : null;
  }
}
