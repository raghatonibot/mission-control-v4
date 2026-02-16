/**
 * Mission Control v4.0 - Server Principal
 * Integração completa com OpenClaw
 * Autenticação TOTP exclusiva carvalhojose321@gmail.com
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const speakeasy = require('speakeasy');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3004;

// Configurações
const TOTP_SECRET = process.env.TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
const TOTP_USER = process.env.TOTP_USER || 'carvalhojose321@gmail.com';
const TOTP_ISSUER = process.env.TOTP_ISSUER || 'Carvalho AI';
const ALLOWED_EMAIL = 'carvalhojose321@gmail.com';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3004'],
  credentials: true
}));

// Sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'mission-control-v4-secret-' + uuidv4(),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000
  },
  name: 'mc4.sid'
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// BANCO DE DADOS EM MEMÓRIA
// ============================================
const db = {
  agents: {},
  activities: [],
  sessions: new Map(),
  authAttempts: new Map()
};

// ============================================
// OPENCLAW INTEGRATION
// ============================================

/**
 * Executa comando OpenClaw e retorna resultado
 */
async function runOpenClawCommand(command) {
  try {
    const openclawPath = 'C:\\Users\\seuca\\.openclaw\\openclaw.exe';
    const { stdout, stderr } = await execPromise(`"${openclawPath}" ${command}`, {
      cwd: process.env.OPENCLAW_WORKSPACE || 'C:\\Users\\seuca\\.openclaw\\workspace',
      timeout: 30000
    });
    
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    
    return { success: true, output: stdout, error: null };
  } catch (error) {
    console.error('OpenClaw command error:', error.message);
    return { success: false, output: null, error: error.message };
  }
}

/**
 * Lista todas as sessões ativas do OpenClaw
 */
async function listOpenClawSessions() {
  try {
    const result = await runOpenClawCommand('sessions list --json');
    if (!result.success) return [];
    
    const lines = result.output.trim().split('\n');
    const sessions = [];
    
    for (const line of lines) {
      try {
        const session = JSON.parse(line);
        sessions.push(session);
      } catch (e) {
        // Ignora linhas inválidas
      }
    }
    
    return sessions;
  } catch (error) {
    console.error('Error listing sessions:', error);
    return [];
  }
}

/**
 * Obtém histórico de uma sessão
 */
async function getSessionHistory(sessionKey, limit = 50) {
  try {
    const result = await runOpenClawCommand(`sessions history "${sessionKey}" --limit ${limit} --json`);
    if (!result.success) return [];
    
    const lines = result.output.trim().split('\n');
    const messages = [];
    
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        messages.push(msg);
      } catch (e) {
        // Ignora linhas inválidas
      }
    }
    
    return messages;
  } catch (error) {
    console.error('Error getting session history:', error);
    return [];
  }
}

/**
 * Spawn um novo subagente
 */
async function spawnSubagent(task, options = {}) {
  try {
    const label = options.label || `agent-${Date.now()}`;
    const model = options.model || 'kimi-for-coding';
    const agentId = options.agentId || 'main';
    
    const result = await runOpenClawCommand(
      `sessions spawn --task "${task.replace(/"/g, '\\"')}" --label "${label}" --model "${model}" --agent-id "${agentId}" --json`
    );
    
    return result;
  } catch (error) {
    console.error('Error spawning subagent:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================

function ensureAuth(req, res, next) {
  if (req.session.authenticated && req.session.email === ALLOWED_EMAIL) {
    return next();
  }
  
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  res.redirect('/login');
}

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = parseInt(process.env.AUTH_WINDOW_MS) || 60000;
  const maxAttempts = parseInt(process.env.AUTH_MAX_ATTEMPTS) || 5;
  
  const attempts = db.authAttempts.get(ip) || [];
  const recentAttempts = attempts.filter(time => now - time < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    return false;
  }
  
  recentAttempts.push(now);
  db.authAttempts.set(ip, recentAttempts);
  return true;
}

// ============================================
// ROTAS DE AUTENTICAÇÃO
// ============================================

app.get('/login', (req, res) => {
  if (req.session.authenticated && req.session.email === ALLOWED_EMAIL) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/auth/totp', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ 
      error: 'Muitas tentativas. Aguarde 1 minuto.' 
    });
  }
  
  const { code } = req.body;
  
  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Código inválido' });
  }
  
  // Verifica TOTP
  const verified = speakeasy.totp.verify({
    secret: TOTP_SECRET,
    encoding: 'base32',
    token: code,
    window: 2
  });
  
  if (verified) {
    req.session.authenticated = true;
    req.session.email = ALLOWED_EMAIL;
    req.session.loginTime = new Date().toISOString();
    req.session.sessionId = uuidv4();
    
    db.sessions.set(req.session.sessionId, {
      id: req.session.sessionId,
      email: ALLOWED_EMAIL,
      loginTime: req.session.loginTime,
      ip: clientIp
    });
    
    console.log(`✅ Login: ${ALLOWED_EMAIL} em ${new Date().toLocaleString('pt-BR')}`);
    
    return res.json({ 
      success: true, 
      redirect: '/',
      user: {
        email: ALLOWED_EMAIL,
        loginTime: req.session.loginTime
      }
    });
  }
  
  console.log(`❌ Tentativa falha: IP ${clientIp} - Código: ${code}`);
  res.status(401).json({ error: 'Não autorizado' });
});

app.post('/logout', (req, res) => {
  if (req.session.sessionId) {
    db.sessions.delete(req.session.sessionId);
  }
  
  req.session.destroy((err) => {
    if (err) console.error('Erro no logout:', err);
    res.json({ success: true });
  });
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: !!(req.session.authenticated && req.session.email === ALLOWED_EMAIL),
    user: req.session.email === ALLOWED_EMAIL ? {
      email: ALLOWED_EMAIL,
      loginTime: req.session.loginTime
    } : null
  });
});

// ============================================
// ROTAS PROTEGIDAS - API
// ============================================

app.get('/', ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API - Sessões OpenClaw
app.get('/api/sessions', ensureAuth, async (req, res) => {
  try {
    const sessions = await listOpenClawSessions();
    res.json({ sessions, count: sessions.length });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar sessões' });
  }
});

// API - Histórico de sessão
app.get('/api/sessions/:sessionKey/history', ensureAuth, async (req, res) => {
  try {
    const { sessionKey } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const history = await getSessionHistory(sessionKey, limit);
    res.json({ sessionKey, history, count: history.length });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter histórico' });
  }
});

// API - Spawn subagente
app.post('/api/agents/spawn', ensureAuth, async (req, res) => {
  try {
    const { task, label, model } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'Tarefa é obrigatória' });
    }
    
    const result = await spawnSubagent(task, { label, model });
    
    if (result.success) {
      broadcast({
        type: 'agent:spawned',
        data: {
          label: label || 'unnamed',
          task: task.substring(0, 100),
          timestamp: new Date().toISOString()
        }
      });
      
      res.json({ success: true, result: result.output });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API - Status do sistema
app.get('/api/system/status', ensureAuth, async (req, res) => {
  try {
    const sessions = await listOpenClawSessions();
    const activeSessions = sessions.filter(s => 
      s.displayName && !s.displayName.includes('cron')
    );
    
    res.json({
      timestamp: new Date().toISOString(),
      openclaw: {
        connected: true,
        totalSessions: sessions.length,
        activeSessions: activeSessions.length
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '4.0.0'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WEBSOCKET SERVER
// ============================================

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.authenticated) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws, req) => {
  console.log('🔗 Nova conexão WebSocket');
  
  ws.authenticated = false;
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'auth') {
        // Verifica sessão no WebSocket
        if (data.sessionId) {
          ws.authenticated = true;
          ws.send(JSON.stringify({ type: 'auth:success' }));
        }
        return;
      }
      
      if (!ws.authenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'Não autorizado' }));
        return;
      }
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      
      if (data.type === 'request:sessions') {
        const sessions = await listOpenClawSessions();
        ws.send(JSON.stringify({ 
          type: 'sessions:update', 
          data: sessions 
        }));
      }
      
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Conexão WebSocket fechada');
  });
});

// Heartbeat
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// ============================================
// POLLING OPENCLAW
// ============================================

let lastSessions = [];

setInterval(async () => {
  try {
    const sessions = await listOpenClawSessions();
    
    // Detecta novas sessões
    const currentIds = new Set(sessions.map(s => s.sessionId));
    const lastIds = new Set(lastSessions.map(s => s.sessionId));
    
    const newSessions = sessions.filter(s => !lastIds.has(s.sessionId));
    const removedSessions = lastSessions.filter(s => !currentIds.has(s.sessionId));
    
    if (newSessions.length > 0 || removedSessions.length > 0) {
      broadcast({
        type: 'sessions:change',
        data: {
          new: newSessions,
          removed: removedSessions,
          all: sessions
        }
      });
    }
    
    lastSessions = sessions;
  } catch (error) {
    console.error('Polling error:', error);
  }
}, 5000);

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
  console.log(`
🚀 Mission Control v4.0 - OpenClaw Integrated
🌐 URL: https://missioncontrol.carvalhoai.com
🔐 Autenticação: TOTP (${TOTP_USER})
🔌 Porta: ${PORT}

📋 Comandos úteis:
   npm run dev     - Modo desenvolvimento
   npm start       - Produção

🤖 Integração OpenClaw ativa!
`);
});

module.exports = { app, db, broadcast };