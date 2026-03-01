// Social Media Scraper Integration
// Wrapper para chamar o Python script do sistema de agentes

import { execAsync } from '../utils/execHelper.js';
import * as path from 'path';
import * as os from 'os';

const SKILL_PATH = path.join(os.homedir(), '.openclaw', 'workspace', 'skills', 'social-media-scraper-pro');
const SCRIPT_PATH = path.join(SKILL_PATH, 'social_media_scraper.py');

export interface ScrapedContent {
  success: boolean;
  platform: 'instagram' | 'twitter' | 'reddit' | 'unknown';
  url: string;
  method?: string;
  data?: {
    // Instagram
    type?: 'reel' | 'image' | 'post';
    shortcode?: string;
    author?: string;
    caption?: string;
    likes?: number;
    comments?: number;
    video_url?: string;
    image_url?: string;
    duration?: number;
    
    // Twitter
    username?: string;
    tweet_id?: string;
    text?: string;
    date?: string;
    
    // Reddit
    title?: string;
    subreddit?: string;
    score?: number;
    top_comments?: any[];
    
    // Common
    timestamp?: string;
    engagement?: {
      likes: number;
      comments: number;
      shares?: number;
    };
  };
  error?: string;
  limited?: boolean;
}

/**
 * Extrai conteúdo de uma URL de social media
 */
export async function scrapeSocialMedia(url: string): Promise<ScrapedContent> {
  console.log(`🌐 Scraping social media: ${url}`);
  
  try {
    // Chamar script Python
    const { stdout, stderr, exitCode } = await execAsync(
      `python "${SCRIPT_PATH}" --url "${url}"`,
      {
        cwd: SKILL_PATH,
        timeout: 60000  // 60 segundos para carregar página
      }
    );
    
    if (exitCode !== 0) {
      console.error(`[!] Scraper error: ${stderr}`);
      return {
        success: false,
        platform: detectPlatform(url),
        url,
        error: stderr || 'Unknown error'
      };
    }
    
    // Parse resultado JSON
    const result = JSON.parse(stdout) as ScrapedContent;
    
    console.log(`✅ Scraping completo via ${result.method || 'unknown'}`);
    
    if (result.limited) {
      console.log(`⚠️ Resultado limitado - pode precisar de login`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`[!] Scraper failed: ${error}`);
    return {
      success: false,
      platform: detectPlatform(url),
      url,
      error: String(error)
    };
  }
}

/**
 * Realiza login manual e salva sessão
 */
export async function loginSocialMedia(
  platform: 'instagram' | 'twitter',
  headed: boolean = true
): Promise<{ success: boolean; message: string }> {
  console.log(`🔐 Iniciando login para ${platform}...`);
  console.log(`⚠️ Um browser vai abrir. Faça login manualmente.`);
  
  try {
    const { stdout, stderr, exitCode } = await execAsync(
      `python "${SCRIPT_PATH}" --login ${platform} ${headed ? '--headed' : ''}`,
      {
        cwd: SKILL_PATH,
        timeout: 300000  // 5 minutos para login manual
      }
    );
    
    if (exitCode !== 0) {
      return {
        success: false,
        message: `Login falhou: ${stderr}`
      };
    }
    
    return {
      success: true,
      message: `Login salvo! Sessão persistida para ${platform}.`
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Erro: ${String(error)}`
    };
  }
}

/**
 * Detecta plataforma da URL
 */
function detectPlatform(url: string): ScrapedContent['platform'] {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
    return 'instagram';
  }
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return 'twitter';
  }
  if (lower.includes('reddit.com') || lower.includes('redd.it')) {
    return 'reddit';
  }
  return 'unknown';
}

/**
 * Verifica se a skill está instalada e funcionando
 */
export async function checkSocialScraper(): Promise<{ 
  installed: boolean; 
  pythonAvailable: boolean;
  playwrightAvailable: boolean;
}> {
  const fs = await import('fs');
  
  const installed = fs.existsSync(SCRIPT_PATH);
  let pythonAvailable = false;
  let playwrightAvailable = false;
  
  if (installed) {
    try {
      // Verificar Python
      const pythonCheck = await execAsync('python --version', { timeout: 5000 });
      pythonAvailable = pythonCheck.exitCode === 0;
      
      // Verificar Playwright
      if (pythonAvailable) {
        const pwCheck = await execAsync('python -c "import playwright"', { timeout: 5000 });
        playwrightAvailable = pwCheck.exitCode === 0;
      }
    } catch {
      // Ignore errors
    }
  }
  
  return { installed, pythonAvailable, playwrightAvailable };
}
