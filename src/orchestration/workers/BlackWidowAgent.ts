// BlackWidow Agent - Inteligência Social
// INTEGRAÇÃO REAL: Reddit, Twitter, Instagram scraping

import { BaseAgent } from './BaseAgent.js';
import type { MessageBroker } from '../services/MessageBroker.js';
import type { AgentMessage } from '../types/AgentMessage.js';
import { scrapeSocialMedia, loginSocialMedia } from '../skills/socialMediaScraper.js';
import * as path from 'path';
import * as os from 'os';

const SKILLS_AVAILABLE = [
  'reddit-scraper-complete',
  'twitter-scraper-complete',
  'instagram-analyzer',
  'summarize'
];

// Keywords para monitoramento
const MONITOR_KEYWORDS = [
  'AI agent', 'automation', 'LLM', 'GPT-5', 'Claude',
  'breakthrough', 'new model', 'open source AI',
  'startup', 'funding', 'acquisition', 'MCP'
];

// Subreddits para monitorar
const MONITOR_SUBREDDITS = ['artificial', 'MachineLearning', 'OpenAI', 'LocalLLaMA', 'singularity'];

// Perfis do Twitter para monitorar
const MONITOR_ACCOUNTS = ['karpathy', 'ylecun', 'sama', 'OpenAI', 'AnthropicAI'];

export class BlackWidowAgent extends BaseAgent {
  constructor(broker: MessageBroker) {
    super({
      id: 'blackwidow',
      name: 'BlackWidow',
      description: 'Inteligência Social — monitora redes e tendências',
      skills: SKILLS_AVAILABLE,
      model: 'kimi-coding/k2p5',
      schedule: '15min',
      maxConcurrentTasks: 5
    }, broker);
  }

  async executeTask(payload: any, message: AgentMessage): Promise<any> {
    const { task, skill, params } = payload;

    switch (skill || this.inferSkill(task)) {
      case 'monitor-social':
        return await this.monitorSocial(params);
      
      case 'check-reddit':
        return await this.checkReddit(params);
      
      case 'check-twitter':
        return await this.checkTwitter(params);
      
      case 'analyze-instagram':
        return await this.analyzeInstagram(params);
      
      case 'analyze-sentiment':
        return await this.analyzeSentiment(params);
      
      case 'detect-trends':
        return await this.detectTrends(params);
      
      case 'login-instagram':
        return await this.loginInstagram(params);
      
      default:
        return await this.monitorSocial(params);
    }
  }

  private inferSkill(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('reddit')) return 'check-reddit';
    if (lowerTask.includes('twitter') || lowerTask.includes('x ')) return 'check-twitter';
    if (lowerTask.includes('instagram') || lowerTask.includes('ig ')) return 'analyze-instagram';
    if (lowerTask.includes('sentimento')) return 'analyze-sentiment';
    if (lowerTask.includes('trend')) return 'detect-trends';
    if (lowerTask.includes('login') && lowerTask.includes('instagram')) return 'login-instagram';
    
    return 'monitor-social';
  }

  private async monitorSocial(params: any = {}): Promise<any> {
    console.log(`🕷️ BlackWidow monitorando redes...`);

    const results = {
      timestamp: new Date().toISOString(),
      alerts: [] as any[],
      reddit: null as any,
      twitter: null as any,
      instagram: null as any
    };

    // Verificar Reddit (REAL)
    try {
      console.log('   📡 Buscando Reddit...');
      results.reddit = await this.checkReddit({ 
        subreddits: params.subreddits || MONITOR_SUBREDDITS,
        keywords: params.keywords || MONITOR_KEYWORDS
      });
    } catch (error) {
      console.warn('Reddit check failed:', error);
    }

    // Verificar Twitter (REAL)
    try {
      console.log('   📡 Buscando Twitter...');
      results.twitter = await this.checkTwitter({
        accounts: params.accounts || MONITOR_ACCOUNTS,
        keywords: params.keywords || MONITOR_KEYWORDS
      });
    } catch (error) {
      console.warn('Twitter check failed:', error);
    }

    // Detectar alertas
    results.alerts = this.detectAlerts(results);

    // Enviar alertas críticos para Ragha
    for (const alert of results.alerts) {
      if (alert.priority === 'high' || alert.priority === 'critical') {
        await this.sendAlert(
          `BlackWidow: ${alert.message}`,
          alert.priority,
          alert
        );
      }
    }

    return results;
  }

  private async checkReddit(params: any): Promise<any> {
    console.log(`🕷️ BlackWidow verificando Reddit...`);

    const subreddits = params.subreddits || MONITOR_SUBREDDITS;
    const keywords = params.keywords || MONITOR_KEYWORDS;
    const matches: any[] = [];
    let totalChecked = 0;

    for (const subreddit of subreddits.slice(0, 3)) {
      try {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (CarvalhoAI Research Bot 1.0)'
          }
        });

        if (!response.ok) continue;

        const data = await response.json();
        const posts = data.data?.children || [];
        
        for (const child of posts) {
          const p = child.data;
          totalChecked++;
          
          const text = `${p.title} ${p.selftext || ''}`.toLowerCase();
          const foundKeywords = keywords.filter((k: string) => 
            text.includes(k.toLowerCase())
          );
          
          if (foundKeywords.length > 0) {
            matches.push({
              id: p.id,
              subreddit,
              title: p.title,
              author: p.author,
              score: p.score,
              keywords_found: foundKeywords,
              url: `https://reddit.com${p.permalink}`,
              created_utc: p.created_utc
            });
          }
        }

        await new Promise(r => setTimeout(r, 1500));
        
      } catch (error) {
        console.error(`   ❌ Erro em r/${subreddit}:`, error);
      }
    }

    return {
      source: 'reddit',
      subreddits_checked: subreddits.length,
      posts_checked: totalChecked,
      total_matches: matches.length,
      matches: matches.slice(0, 10),
      keywords,
      note: 'DADOS REAIS via Reddit JSON API'
    };
  }

  private async checkTwitter(params: any): Promise<any> {
    console.log(`🕷️ BlackWidow verificando Twitter...`);

    const accounts = params.accounts || MONITOR_ACCOUNTS.slice(0, 3);
    const keywords = params.keywords || MONITOR_KEYWORDS;
    const allMatches: any[] = [];

    for (const username of accounts) {
      try {
        const nitterInstances = [
          'https://nitter.net',
          'https://nitter.poast.org'
        ];

        let tweets: any[] = [];

        for (const instance of nitterInstances) {
          try {
            const response = await fetch(`${instance}/${username}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0'
              },
              signal: AbortSignal.timeout(8000)
            });

            if (response.ok) {
              const html = await response.text();
              const tweetTexts = html.match(/class="tweet-content[^"]*"[^>]*>([^\u003c]*(?:<[^/][^\u003e]*>[^\u003c]*)*)<\/div/g);
              
              if (tweetTexts) {
                tweets = tweetTexts.slice(0, 5).map((t, i) => ({
                  id: `${username}-${i}`,
                  text: t.replace(/<[^>]+>/g, '').trim(),
                  author: username
                }));
                break;
              }
            }
          } catch {
            continue;
          }
        }

        for (const tweet of tweets) {
          const text = tweet.text.toLowerCase();
          const foundKeywords = keywords.filter((k: string) => 
            text.includes(k.toLowerCase())
          );
          
          if (foundKeywords.length > 0) {
            allMatches.push({
              ...tweet,
              keywords_found: foundKeywords
            });
          }
        }

        await new Promise(r => setTimeout(r, 2000));
        
      } catch (error) {
        console.error(`   ❌ Erro em @${username}:`, error);
      }
    }

    return {
      source: 'twitter',
      accounts_checked: accounts.length,
      total_matches: allMatches.length,
      matches: allMatches,
      keywords,
      note: 'DADOS REAIS via Nitter'
    };
  }

  private async analyzeInstagram(params: any): Promise<any> {
    console.log(`🕷️ BlackWidow analisando Instagram (Social Scraper Pro)...`);

    const url = params.url || params.instagramUrl;
    
    if (!url) {
      return { 
        success: false,
        error: 'URL do Instagram não fornecida' 
      };
    }

    try {
      console.log(`   📸 Chamando Social Media Scraper...`);
      const result = await scrapeSocialMedia(url);
      
      return {
        source: 'instagram',
        url,
        ...result,
        note: result.limited 
          ? 'Dados limitados - faça login com: "Ragha, faça login no Instagram"'
          : 'Extração completa via Social Scraper Pro'
      };

    } catch (error) {
      return {
        source: 'instagram',
        url,
        success: false,
        error: String(error)
      };
    }
  }

  private async loginInstagram(params: any): Promise<any> {
    console.log(`🕷️ BlackWidow configurando login do Instagram...`);

    try {
      const result = await loginSocialMedia('instagram', true);
      
      return {
        source: 'instagram',
        action: 'login',
        ...result
      };
    } catch (error) {
      return {
        source: 'instagram',
        action: 'login',
        success: false,
        error: String(error)
      };
    }
  }

  private async analyzeSentiment(params: any): Promise<any> {
    console.log(`🕷️ BlackWidow analisando sentimento...`);

    const positiveWords = ['bom', 'ótimo', 'excelente', 'incrivel', 'amazing', 'great', 'love', 'good', 'best', 'awesome'];
    const negativeWords = ['ruim', 'péssimo', 'horrível', 'bad', 'terrible', 'hate', 'fail', 'worst', 'suck', 'awful'];

    const text = params.text?.toLowerCase() || '';
    
    let positive = 0;
    let negative = 0;

    for (const word of positiveWords) {
      if (text.includes(word)) positive++;
    }
    for (const word of negativeWords) {
      if (text.includes(word)) negative++;
    }

    const total = positive + negative;
    const sentiment = total === 0 ? 'neutral' : 
                     positive > negative ? 'positive' : 'negative';

    return {
      sentiment,
      confidence: total > 0 ? Math.max(positive, negative) / total : 0,
      positive_count: positive,
      negative_count: negative,
      analyzed_text_length: text.length
    };
  }

  private async detectTrends(params: any): Promise<any> {
    console.log(`🕷️ BlackWidow detectando tendências...`);

    const redditData = await this.checkReddit({ 
      subreddits: ['artificial', 'MachineLearning'],
      maxPosts: 10 
    });

    const wordCount: Record<string, number> = {};
    const commonWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were']);

    for (const match of redditData.matches || []) {
      const words = match.title.toLowerCase().split(/\s+/);
      for (const word of words) {
        const clean = word.replace(/[^a-z]/g, '');
        if (clean.length > 3 && !commonWords.has(clean)) {
          wordCount[clean] = (wordCount[clean] || 0) + 1;
        }
      }
    }

    const trends = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    return {
      trends,
      analyzed_posts: redditData.posts_checked || 0,
      source: 'reddit'
    };
  }

  private detectAlerts(results: any): any[] {
    const alerts = [];

    if (results.reddit?.total_matches > 3) {
      alerts.push({
        priority: 'medium',
        source: 'reddit',
        message: `Alta atividade no Reddit: ${results.reddit.total_matches} posts relevantes`,
        count: results.reddit.total_matches
      });
    }

    if (results.twitter?.total_matches > 0) {
      alerts.push({
        priority: 'high',
        source: 'twitter',
        message: `${results.twitter.total_matches} tweets relevantes de contas monitoradas`,
        count: results.twitter.total_matches
      });
    }

    return alerts;
  }
}
