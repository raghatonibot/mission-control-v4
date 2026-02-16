# Mission Control v4.0

Dashboard integrado OpenClaw para monitoramento de agentes IA.

## 🚀 Características

- ✅ Integração completa com OpenClaw
- ✅ Autenticação TOTP (Google Authenticator)
- ✅ Monitoramento em tempo real via WebSocket
- ✅ Visualização de prompts e conversas
- ✅ Controle de spawn/terminate de agentes
- ✅ Dashboard dark theme profissional

## 📋 Requisitos

- Node.js 18+
- OpenClaw instalado e configurado
- Google Authenticator (para TOTP)

## 🔧 Instalação

```bash
# 1. Instalar dependências do backend
npm install

# 2. Instalar dependências do frontend
cd frontend
npm install
cd ..

# 3. Configurar ambiente
cp .env.example .env
# Editar .env com suas configurações
```

## 🔐 Configuração TOTP

1. Configure o Google Authenticator com a secret do arquivo `.env`
2. Ou gere uma nova secret:
   ```bash
   node -e "console.log(require('speakeasy').generateSecret({length: 20}).base32)"
   ```

## 🚀 Execução

### Desenvolvimento
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Produção
```bash
# Build do frontend
cd frontend
npm run build
cd ..

# Start servidor
npm start
```

## 🌐 Deploy

### Usando PM2
```bash
npm install -g pm2
pm2 start server.js --name "mission-control-v4"
pm2 startup
pm2 save
```

### Usando Docker
```bash
docker build -t mission-control-v4 .
docker run -p 3004:3004 mission-control-v4
```

## 📁 Estrutura

```
mission-control-v4/
├── server.js              # Backend Node.js
├── package.json           # Dependências backend
├── .env                   # Configurações
├── .env.example           # Exemplo de config
├── frontend/              # React + TypeScript
│   ├── src/
│   │   ├── pages/         # Páginas
│   │   ├── components/    # Componentes
│   │   └── ...
│   └── package.json
└── openclaw-integration/  # Módulos de integração
```

## 🔌 APIs

### Autenticação
- `POST /auth/totp` - Login com código TOTP
- `GET /logout` - Logout
- `GET /api/auth/status` - Status da sessão

### OpenClaw
- `GET /api/sessions` - Lista sessões ativas
- `GET /api/sessions/:key/history` - Histórico da sessão
- `POST /api/agents/spawn` - Cria subagente
- `GET /api/system/status` - Status do sistema

### WebSocket
Conecte em `ws://localhost:3004`

Eventos:
- `agent:spawned` - Novo agente criado
- `agent:terminated` - Agente encerrado
- `sessions:change` - Mudança nas sessões

## 🛡️ Segurança

- TOTP exclusivo para carvalhojose321@gmail.com
- Sessões de 24 horas
- Rate limiting de login
- WebSocket autenticado

## 📄 Licença

MIT - Carvalho AI