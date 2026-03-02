# Mission Control v4

Centro de comando operacional para orquestração de tasks/runs com OpenClaw + feedback em tempo real no Telegram.

## O que está implementado (estado atual)

## 1) Orquestração de execução (Tasks + Runs)
- Tasks (`/api/tasks`) com ciclo de vida operacional.
- Runs (`/api/runs`) com estágios:
  - `queued`, `running`, `stopping`, `waiting`, `review`, `done`, `failed`, `stopped`.
- Ações funcionais:
  - pause (`/api/runs/:id/pause`)
  - stop (`/api/runs/:id/stop`)
  - stop all (`/api/runs/:id/stopall`)
  - retry (`/api/runs/:id/retry`)
  - reassign (`/api/runs/:id/reassign`) — somente para run terminal (`done|failed|stopped`)
- Thread por run (`/api/runs/:id/thread`) e eventos (`/api/events`).

## 2) Fluxo Telegram com aprovação
- Entrada por inbox: `POST /api/inbox/telegram`.
- Se mensagem começar com `Task:`:
  - cria rascunho interno,
  - gera planejamento curto,
  - sugere agentes,
  - envia botões no Telegram: **Aprovado / Ajustar / Cancelar**.
- Ajustar:
  - marca draft como aguardando ajuste,
  - próxima mensagem livre atualiza o draft e reenvia o prompt de aprovação.
- Cancelar:
  - remove draft, não envia para o Mission Control.
- Aprovado:
  - converte draft em task real,
  - cria/enfileira run,
  - envia feedback curto por etapa no Telegram.

## 3) Verificação pós-execução (Ragha validator)
- Após worker concluir, run vai para `review`.
- Dispara subagente validador (Ragha) para revisar saída.
- Finaliza run em `done` e grava `summary` final.
- Envia resultado final no Telegram com:
  - Task
  - Run
  - Resumo final

## 4) Agent Profile + Auditoria
- `GET /api/agents`, `GET/PATCH /api/agents/:id`.
- Auditoria em `GET /api/audit-logs`.
- Alterações de perfil ficam rastreáveis.

## 5) Novas telas de produto
- **Missões** (`#/missions`): tasks/runs operacionais.
- **Tarefas Feitas** (`#/tasks-done`): concluídas com agente, run, horário e resumo.
- **Controle Real de Tokens** (`#/tokens`):
  - total de `input/output` reais,
  - por modelo,
  - sem cache,
  - atualização contínua.

---

## Acesso

- Local: `http://127.0.0.1:3004`
- Rotas via hash router:
  - `http://127.0.0.1:3004/#/missions`
  - `http://127.0.0.1:3004/#/tasks-done`
  - `http://127.0.0.1:3004/#/tokens`
- Produção (túnel Cloudflare):
  - `https://missioncontrol.carvalhoai.com`

Health check:
- `GET /health` -> `{ "ok": true }`

---

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Express (Node)
- Persistência: JSON local em `./data`
- Orquestração: OpenClaw Gateway (`/tools/invoke`)
- Canal de feedback: Telegram via tool `message`

---

## Estrutura principal

- `server.js` — backend/API, orquestração de runs e integração Telegram
- `src/pages/` — telas
- `src/components/layout/Sidebar.tsx` — menu lateral
- `src/lib/api.ts` — client HTTP da UI
- `data/` — estado operacional persistido

Arquivos de estado relevantes (`data/`):
- `tasks.json`
- `runs.json`
- `run-events.json`
- `inbox-drafts.json`
- `audit-logs.json`
- `validators.json`
- `token-usage-state.json`

---

## Configuração (.env)

Use `.env.example` como base.

Variáveis críticas:
- `PORT=3004`
- `GATEWAY_URL=http://127.0.0.1:18789`
- `GATEWAY_TOKEN=<token atual do OpenClaw>`
- `AUTH_MODE=totp|cloudflare|none`
- `ALLOWED_EMAIL=<email autorizado no modo cloudflare>`
- `JWT_SECRET=<segredo jwt>`
- `WORKSPACE_ROOT=C:\\Users\\seuca\\.openclaw\\workspace`
- `INBOX_TOKEN=<token inbox para /api/inbox/telegram>`
- `TELEGRAM_NOTIFY_TARGET=telegram:<chat_id>`
- `TELEGRAM_AUTO_APPROVE_CHAT_IDS=telegram:<chat_id>,...`
- `SUBAGENT_POLL_MS=4000`
- `MIN_DONE_SUMMARY_CHARS=180` (mínimo de resumo validado para permitir `status=done`; abaixo disso o run finaliza como `failed`)
- `VITE_AUTH_DISABLED=1` (se auth já for protegido por Cloudflare Access)

### Observação importante (Gateway token)
Se aparecer `401 Unauthorized` em `sessions_spawn`, normalmente é token divergente entre:
- `mission-control-v4/.env` (`GATEWAY_TOKEN`)
- `~/.openclaw/openclaw.json` (`gateway.auth.token`)

Após ajustar, reinicie com:
- `pm2 restart mission-control-v4 --update-env`

---

## Rodando localmente

Instalação:
```bash
npm install
```

Build/Lint:
```bash
npm run lint
npm run build
```

Dev frontend:
```bash
npm run dev
```

Backend (produção local):
```bash
node server.js
```

---

## PM2 (operação atual)

Processos esperados:
- `mission-control-v4`
- `mission-control-watch`

Comandos úteis:
```bash
pm2 list
pm2 restart mission-control-v4 --update-env
pm2 restart mission-control-watch
pm2 logs mission-control-v4 --lines 200
```

---

## API principal (resumo)

Auth/health:
- `GET /health`
- `POST /auth/verify`

Core:
- `GET /api/metrics`
- `GET /api/skills`
- `GET /api/agents`
- `GET /api/agents/:id`
- `PATCH /api/agents/:id`
- `GET /api/missions`
- `GET /api/events`
- `GET /api/audit-logs`
- `GET /api/memory`

Tasks/Runs:
- `GET /api/tasks`
- `GET /api/tasks/done`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/start`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/:id/thread`
- `POST /api/runs/:id/stop`
- `POST /api/runs/:id/stopall`
- `POST /api/runs/:id/retry`
- `POST /api/runs/:id/pause`
- `POST /api/runs/:id/reassign`

Telegram Inbox:
- `POST /api/inbox/telegram`
- `POST /api/inbox/tasks/:id/approve`

Token real (sem cache):
- `GET /api/tokens/live`
- `POST /api/tokens/live/reset`

---

## Controle Real de Tokens (como funciona)

Objetivo: mostrar **somente tokens reais** (`input/output`), ignorando cache.

Fonte:
- Leitura direta dos JSONL de sessão do OpenClaw em:
  - `~/.openclaw/agents/main/sessions/*.jsonl`

Lógica:
- Considera mensagens `assistant` com bloco `usage`.
- Soma somente:
  - `usage.input`
  - `usage.output`
- Ignora:
  - `cacheRead`
  - `cacheWrite`

Janela temporal:
- Começa em `token-usage-state.json` (`activatedAtMs`).
- Pode resetar pela UI (botão) ou API (`POST /api/tokens/live/reset`).

---

## Critérios de qualidade atuais

- Build: `npm run build` ✅
- Lint: `npm run lint` ✅
- Fluxo E2E principal validado:
  - task -> run -> pause/stop/reassign -> review -> done -> feedback Telegram

---

## Próximos incrementos recomendados

- Exigir resumo mínimo antes de marcar `done`.
- Persistir ledger de custo em moeda por modelo (além de tokens).
- Gráficos de tendência de tokens (hora/dia) na tela `#/tokens`.
- Alertas de orçamento (limite diário/semanal).

---

## Segurança operacional

- Não expor `INBOX_TOKEN`, `GATEWAY_TOKEN`, `JWT_SECRET` em commits.
- `AUTH_MODE=none` só com proteção upstream (Cloudflare Access).
- Manter gateway em loopback/tailnet e token forte.
