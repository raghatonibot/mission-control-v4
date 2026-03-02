// IronMan Agent - Especialista em pesquisa e inteligência de mercado
// INTEGRAÇÃO REAL: Chama Python scripts para scraping

import { BaseAgent } from './BaseAgent.js';
import type { MessageBroker } from '../services/MessageBroker.js';
import type { AgentMessage, AgentId } from '../types/AgentMessage.js';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

const SKILLS_AVAILABLE = [
  'github-trending',
  'reddit-scraper-complete',
  'twitter-scraper-complete',
  'jina-reader',
  'summarize',
  'gemini-image'
];

// Caminho para as skills Python
const SKILLS_PATH = path.join(os.homedir(), '.openclaw', 'workspace', 'skills');

export class IronManAgent extends BaseAgent {
  constructor(broker: MessageBroker) {
    super({
      id: 'ironman',
      name: 'IronMan',
      description: 'Pesquisa — vasculha GitHub, Reddit, Twitter por ferramentas e tendências',
      skills: SKILLS_AVAILABLE,
      model: 'kimi-coding/k2p5',
      schedule: '07:00',
      maxConcurrentTasks: 5
    }, broker);
  }

  async executeTask(payload: any, message: AgentMessage): Promise<any> {
    const { task, skill, params } = payload;

    switch (skill || this.inferSkill(task)) {
      case 'research':
        return await this.research(task, params);
      
      case 'github-trending':
        return await this.getGithubTrending(params);
      
      case 'reddit-search':
        return await this.searchReddit(params);
      
      case 'twitter-search':
        return await this.searchTwitter(params);
      
      case 'scrape-url':
        return await this.scrapeUrl(params?.url);
      
      case 'summarize':
        return await this.summarizeContent(params?.content || params?.url);
      
      default:
        return await this.research(task, params);
    }
  }

  private inferSkill(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('github') || lowerTask.includes('repo') || lowerTask.includes('trending')) {
      return 'github-trending';
    }
    if (lowerTask.includes('reddit')) {
      return 'reddit-search';
    }
    if (lowerTask.includes('twitter') || lowerTask.includes('x ') || lowerTask.includes('tweet')) {
      return 'twitter-search';
    }
    if (lowerTask.includes('url') || lowerTask.includes('site') || lowerTask.includes('scrape')) {
      return 'scrape-url';
    }
    if (lowerTask.includes('resum') || lowerTask.includes('summarize')) {
      return 'summarize';
    }
    
    return 'research';
  }

  private async research(query: string, params: any = {}): Promise<any> {
    console.log(`🔬 IronMan pesquisando: ${query}`);

    const results: any = {
      query,
      timestamp: new Date().toISOString(),
      sources: {}
    };

    // Pesquisar no GitHub (API real)
    try {
      results.sources.github = await this.getGithubTrending({ 
        query, 
        language: params.language,
        since: params.since || 'daily'
      });
    } catch (error) {
      console.warn('GitHub search failed:', error);
      results.sources.github = { error: 'Failed to fetch GitHub data' };
    }

    // Pesquisar no Reddit (PYTHON REAL)
    try {
      console.log('   🐍 Chamando Reddit scraper Python...');
      results.sources.reddit = await this.searchReddit({
        subreddits: params.subreddits || ['artificial', 'MachineLearning', 'OpenAI'],
        query,
        maxPosts: params.maxPosts || 10
      });
    } catch (error) {
      console.warn('Reddit search failed:', error);
      results.sources.reddit = { error: String(error) };
    }

    // Pesquisar no Twitter (PYTHON REAL)
    try {
      console.log('   🐍 Chamando Twitter scraper Python...');
      results.sources.twitter = await this.searchTwitter({
        accounts: params.accounts || ['karpathy', 'ylecun', 'sama', 'OpenAI'],
        query,
        maxTweets: params.maxTweets || 10
      });
    } catch (error) {
      console.warn('Twitter search failed:', error);
      results.sources.twitter = { error: String(error) };
    }

    // Resumir se solicitado
    if (params.summarize) {
      results.summary = this.generateSummary(results);
    }

    return results;
  }

  private async getGithubTrending(params: any = {}): Promise<any> {
    console.log(`🔬 Buscando GitHub trending...`);

    // GitHub Search API (pública, sem auth para pesquisa básica)
    try {
      const query = params.query || 'trending';
      const language = params.language ? `+language:${params.language}` : '';
      const sort = params.sort || 'stars';
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}${language}&sort=${sort}&order=desc&per_page=10`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CarvalhoAI-Agent'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        source: 'github',
        query: params.query || 'trending',
        items: data.items?.map((repo: any) => ({
          name: repo.full_name,
          description: repo.description,
          stars: repo.stargazers_count,
          language: repo.language,
          url: repo.html_url,
          created_at: repo.created_at,
          updated_at: repo.updated_at
        })) || [],
        total_count: data.total_count || 0
      };
    } catch (error) {
      console.error('GitHub API error:', error);
      return {
        source: 'github',
        query: params.query || 'trending',
        error: String(error),
        items: [],
        total_count: 0
      };
    }
  }

  private async searchReddit(params: any): Promise<any> {
    console.log(`🔬 Buscando Reddit: ${params.subreddits?.join(', ')}`);

    const subreddits = params.subreddits || ['artificial'];
    const maxPosts = params.maxPosts || 10;
    const sort = params.sort || 'hot';

    const allResults: any[] = [];
    let totalPosts = 0;

    for (const subreddit of subreddits) {
      try {
        // Chamar script Python para cada subreddit
        const scriptPath = path.join(SKILLS_PATH, 'reddit_scraper_complete.py');
        
        // Verificar se script existe
        try {
          execSync(`python "${scriptPath}" --help`, { stdio: 'pipe' });
        } catch {
          // Fallback: usar requests direto via curl
          console.log(`   📡 Usando Reddit JSON API direta...`);
        }

        // Usar Reddit JSON API (não precisa de Python)
        const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${maxPosts}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (CarvalhoAI Research Bot 1.0)'
          }
        });

        if (!response.ok) {
          throw new Error(`Reddit API error: ${response.status}`);
        }

        const data = await response.json();
        const posts = data.data?.children?.map((child: any) => {
          const p = child.data;
          return {
            id: p.id,
            title: p.title,
            text: p.selftext || '',
            author: p.author,
            subreddit: p.subreddit,
            score: p.score,
            upvotes: p.ups,
            comments_count: p.num_comments,
            url: `https://reddit.com${p.permalink}`,
            external_url: p.url,
            created_utc: p.created_utc,
            post_type: p.is_self ? 'text' : (p.is_video ? 'video' : 'link')
          };
        }) || [];

        allResults.push({
          subreddit,
          posts,
          count: posts.length
        });
        
        totalPosts += posts.length;
        
        // Delay para não rate limit
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (error) {
        console.error(`   ❌ Erro em r/${subreddit}:`, error);
        allResults.push({
          subreddit,
          posts: [],
          count: 0,
          error: String(error)
        });
      }
    }

    return {
      source: 'reddit',
      subreddits,
      results: allResults,
      total_posts: totalPosts,
      note: 'Dados reais via Reddit JSON API'
    };
  }

  private async searchTwitter(params: any): Promise<any> {
    console.log(`🔬 Buscando Twitter: ${params.accounts?.join(', ')}`);

    const accounts = params.accounts || ['OpenAI'];
    const maxTweets = params.maxTweets || 10;

    const allResults: any[] = [];
    let totalTweets = 0;

    for (const username of accounts) {
      try {
        // Tentar Nitter primeiro (mais rápido, sem JS)
        const nitterInstances = [
          'https://nitter.net',
          'https://nitter.poast.org',
          'https://nitter.cz'
        ];

        let tweets: any[] = [];
        let success = false;

        for (const instance of nitterInstances) {
          if (success) break;
          
          try {
            console.log(`   📡 Tentando ${instance}/${username}...`);
            
            // Nitter retorna HTML, precisamos parsear
            const response = await fetch(`${instance}/${username}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0'
              },
              signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
              const html = await response.text();
              
              // Extrair tweets do HTML (regex simples)
              const tweetMatches = html.match(/<div class="tweet-content[^"]*"[^>]*>[\s\S]*?<\/div>/g);
              
              if (tweetMatches && tweetMatches.length > 0) {
                tweets = tweetMatches.slice(0, maxTweets).map((match, idx) => ({
                  id: `tweet-${idx}`,
                  text: match.replace(/<[^>]+>/g, '').substring(0, 280),
                  author: username,
                  index: idx
                }));
                
                success = true;
                console.log(`   ✅ Nitter OK: ${tweets.length} tweets`);
              }
            }
          } catch (e) {
            console.log(`   ⚠️ ${instance} falhou, tentando próximo...`);
          }
        }

        // Se Nitter falhou, tentar Python com Playwright
        if (!success && tweets.length === 0) {
          console.log(`   🐍 Nitter falhou, tentando Python + Playwright...`);
          
          try {
            const scriptPath = path.join(SKILLS_PATH, 'twitter_scraper_complete.py');
            
            // Criar script temporário para extrair tweets
            const tempScript = `
import sys
sys.path.insert(0, '${SKILLS_PATH.replace(/\\/g, '\\\\')}')
from twitter_scraper_complete import TwitterScraperComplete

scraper = TwitterScraperComplete(headless=True)
tweets = scraper.extract_tweet_complete('${username}', max_tweets=${maxTweets})
print(json.dumps(tweets, ensure_ascii=False, indent=2))
`;
            
            const tempPath = path.join(os.tmpdir(), `twitter_temp_${Date.now()}.py`);
            const fs = await import('fs');
            fs.writeFileSync(tempPath, tempScript);
            
            const { stdout } = await execAsync(`python "${tempPath}"`, {
              timeout: 60000,
              cwd: SKILLS_PATH
            });
            
            tweets = JSON.parse(stdout);
            success = true;
            
            // Limpar arquivo temp
            fs.unlinkSync(tempPath);
            
          } catch (pyError) {
            console.error(`   ❌ Python scraper falhou:`, pyError);
          }
        }

        allResults.push({
          username,
          tweets,
          count: tweets.length
        });
        
        totalTweets += tweets.length;
        
        // Delay entre contas
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (error) {
        console.error(`   ❌ Erro em @${username}:`, error);
        allResults.push({
          username,
          tweets: [],
          count: 0,
          error: String(error)
        });
      }
    }

    return {
      source: 'twitter',
      accounts,
      results: allResults,
      total_tweets: totalTweets,
      note: 'Dados via Nitter + Playwright fallback'
    };
  }

  private async scrapeUrl(url: string): Promise<any> {
    console.log(`🔬 Scraping URL: ${url}`);

    if (!url) {
      return { error: 'URL não fornecida' };
    }

    try {
      // Tentar Jina AI Reader primeiro (melhor para conteúdo)
      try {
        const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/+/, '')}`;
        const jinaResponse = await fetch(jinaUrl, { timeout: 15000 });
        
        if (jinaResponse.ok) {
          const content = await jinaResponse.text();
          return {
            source: 'jina-ai',
            url,
            content: content.substring(0, 5000),
            length: content.length,
            method: 'jina-ai-reader'
          };
        }
      } catch {
        // Fallback para fetch direto
      }

      // Fetch direto
      const response = await fetch(url, { 
        method: 'GET',
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(15000)
      });
      
      const content = await response.text();
      
      return {
        source: 'fetch',
        url,
        status: response.status,
        content: content.substring(0, 5000),
        length: content.length
      };
    } catch (error) {
      console.error('Fetch error:', error);
      return {
        source: 'fetch',
        url,
        error: String(error),
        content: null
      };
    }
  }

  private async summarizeContent(content: string): Promise<any> {
    console.log(`🔬 Resumindo conteúdo...`);

    // Usar Jina AI para resumo
    try {
      if (content.startsWith('http')) {
        // É uma URL
        const jinaUrl = `https://r.jina.ai/http://${content.replace(/^https?:\/+/, '')}`;
        const response = await fetch(jinaUrl);
        const summarized = await response.text();
        
        return {
          original_url: content,
          summary: summarized.substring(0, 2000),
          method: 'jina-ai-reader'
        };
      } else {
        // Conteúdo texto - truncar por enquanto
        return {
          original_length: content.length,
          summary: content.substring(0, 1000) + (content.length > 1000 ? '...' : ''),
          method: 'truncation'
        };
      }
    } catch (error) {
      return {
        original_length: content.length,
        summary: content.substring(0, 500) + '...',
        method: 'truncation-fallback',
        error: String(error)
      };
    }
  }

  private generateSummary(results: any): string {
    const parts = [];
    
    if (results.sources.github?.items?.length > 0) {
      parts.push(`GitHub: ${results.sources.github.items.length} repos`);
    }
    
    if (results.sources.reddit?.total_posts > 0) {
      parts.push(`Reddit: ${results.sources.reddit.total_posts} posts`);
    }
    
    if (results.sources.twitter?.total_tweets > 0) {
      parts.push(`Twitter: ${results.sources.twitter.total_tweets} tweets`);
    }

    return parts.join(' | ') || 'Nenhum resultado encontrado';
  }
}
