# PRD Unificado — Mission Control v4 (CarvalhoAI)

> Documento canônico para continuidade técnica no Claude Code.
> Objetivo: qualquer agente/dev que ler este arquivo entende **onde estamos**, **o que já funciona**, **o que está quebrado** e **qual o próximo passo exato**.

---

## 1) Visão do Produto

Mission Control v4 é o painel de orquestração de agentes da CarvalhoAI.

### Proposta de valor
- Centralizar **Tasks + Runs**.
- Delegar tarefas para agentes especializados.
- Controlar execução com estados operacionais reais.
- Dar visibilidade (timeline/eventos) e segurança (aprovação/risco).

### Objetivo de negócio
- Operar multiagente 24/7 com previsibilidade.
- Fechar o ciclo Telegram → aprovação → execução → feedback.

---

## 2) Escopo atual (estado real)

## ✅ Implementado
- Backend Node/Express local (`server.js`) com persistência JSON em `data/*.json`.
- Frontend React+Vite com páginas: Dashboard, Missions, Agents, AgentDetail, Events, Stage.
- Modelo operacional Tasks/Runs com status:
  - Task: `awaiting_approval | cancelled | backlog | ready | blocked | done`
  - Run: `queued | running | stopping | waiting | review | done | failed | stopped`
- Pipeline de aprovação via Telegram (draft + botões):
  - `Aprovado` / `Ajustar` / `Cancelar`
  - confirmação dupla para alto risco (`approve_high`).
- Auto-delegação por heurística (`pickAgentsFromText`) e criação de runs.
- WIP limit (`WIP_LIMIT`) + fila + retry automático (`AUTO_RETRY_MAX`, `AUTO_RETRY_DELAY_MS`).
- Ações de run: `stop`, `stopall`, `retry`.
- Polling de subagentes (`sessions_list`) e transição de estado.
- Eventos centralizados (`run-events.json`) e UI de timeline por run.
- Agent Profile com edição de configuração + `skillsAllowed`.
- Auditoria pós-execução de tools proibidas (`toolsDenied` / deny default).

## ⚠️ Parcial / em evolução
- Stage (“O Palco”) ainda usa muito conteúdo estático para feed/conversas.
- Verifier Ragha existe no backend, mas depende de `sessions_spawn` saudável.
- Estimativa de tokens é aproximada (char/4), não custo real por provider.

## ❌ Não concluído
- Thread de conversa agente↔agente 100% funcional na UI (estilo demo do vídeo).
- Mission Stage totalmente orientado por dados reais (hoje mistura parte real + parte visual).
- Auditoria formal versionada (diff before/after em entidade própria).

---

## 3) Arquitetura técnica

## Frontend
- Stack: React 19 + TypeScript + Vite 7 + Tailwind + shadcn/ui.
- Entrada: `src/main.tsx`, roteamento em `src/App.tsx`.
- API client: `src/lib/api.ts`.

## Backend
- `server.js` (Node ESM + Express).
- Integra OpenClaw Gateway via `POST /tools/invoke` (`toolsInvoke()`).
- Persistência por arquivo JSON:
  - `data/tasks.json`
  - `data/runs.json`
  - `data/run-events.json`
  - `data/agents.json`
  - `data/inbox-drafts.json`
  - `data/validators.json`
  - `data/auth.json`

## Automação auxiliar
- `watcher.js`: vigia run-events e envia resumo para Telegram.
- `scripts/test-inbox-e2e.mjs`: teste E2E do fluxo inbox/aprovação/risco.

---

## 4) Fluxos principais

## 4.1 Telegram Inbox (Task:)
1. Entrada em `POST /api/inbox/telegram`.
2. `Task:` vira **draft** em `inbox-drafts.json`.
3. Botões enviados: Aprovar/Ajustar/Cancelar.
4. Se risco alto: exige `approve_high`.
5. Aprovando: draft vira Task real + cria Runs por agentes detectados.
6. `tryStartQueuedRuns()` respeita WIP e dispara execução.

## 4.2 Execução de Run
1. Run `queued` → `running`.
2. Backend tenta `sessions_spawn` (subagente).
3. Salva `sessionKey` se sucesso.
4. Poller verifica término de sessão:
   - `running` → `review` → `done` (via verifier) ou fallback.
5. Em erro de spawn:
   - agenda retry automático até limite;
   - depois marca `failed`.

## 4.3 Controle operacional
- `stop`: cancelamento cooperativo via `sessions_send`.
- `stopall`: idem + kill em cascata solicitado ao worker.
- timeout de stop força `stopped` para liberar fila.

---

## 5) Contrato de API (resumo)

## Auth
- `GET /auth/setup`
- `POST /auth/verify`

## Core
- `GET /api/metrics`
- `GET /api/skills`
- `GET /api/agents`
- `GET /api/agents/:id`
- `PATCH /api/agents/:id`

## Missões
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/start`

## Runs
- `GET /api/runs`
- `POST /api/runs`
- `POST /api/runs/:id/stop`
- `POST /api/runs/:id/stopall`
- `POST /api/runs/:id/retry`

## Eventos/Memória
- `GET /api/events`
- `GET /api/memory`

## Inbox
- `POST /api/inbox/telegram`
- `POST /api/inbox/tasks/:id/approve`

---

## 6) Configuração / Ambiente

Base `.env.example`:
- `PORT=3004`
- `GATEWAY_URL=http://127.0.0.1:18789`
- `GATEWAY_TOKEN=...`
- `WORKSPACE_ROOT=C:\Users\seuca\.openclaw\workspace`
- `AUTH_MODE=cloudflare|totp|none`
- `WIP_LIMIT=2`
- `DEFAULT_MODEL=kimi-coding/k2p5`
- `VITE_AUTH_DISABLED=1`

Também usados no backend:
- `ALLOWED_EMAIL`, `JWT_SECRET`
- `INBOX_TOKEN`
- `TELEGRAM_NOTIFY_TARGET`
- `TELEGRAM_AUTO_APPROVE_CHAT_IDS`
- `SUBAGENT_POLL_MS`, `STOP_TIMEOUT_MS`
- `AUTO_RETRY_MAX`, `AUTO_RETRY_DELAY_MS`

---

## 7) Dados e tipos

## Task (resumo)
- `id, title, description, priority, status, risk, runStage, createdAt, updatedAt`

## Run (resumo)
- `id, taskId, taskTitle, agentId, model, status, priority`
- `queuedAt, startedAt, endedAt, lastUpdateAt, stopRequestedAt`
- `attempt, retryCount, nextRetryAt, lastError, sessionKey`
- `summary, outputs, tokensOutEst`

## Agent (resumo)
- `id, name, emoji, role, description, type, status`
- `systemDirective, tone, quirks, emojiUsage, formality`
- `skillsAllowed, toolsDenied, model`

---

## 8) O que já foi usado (stack/ferramentas)

- **Runtime:** Node.js + Express.
- **Frontend:** React/TS/Vite/Tailwind/shadcn.
- **Persistência:** JSON file store.
- **Integração de automação:** OpenClaw `tools/invoke`.
- **Canais:** Telegram (`message` tool) para aprovação e feedback.
- **Orquestração:** `sessions_spawn`, `sessions_send`, `sessions_list`, `sessions_history`.
- **Operação local:** PM2 (processos `mission-control-v4` e `mission-control-watch`, conforme memória operacional).

---

## 9) Estado atual do projeto (checkpoint para Claude Code)

## Feito hoje (arquivos com alteração no dia)
- `server.js`
- `src/lib/api.ts`
- `src/lib/runStage.ts`
- `src/pages/missions/TasksBoard.tsx`
- `src/pages/missions/RunsKanban.tsx`
- `src/pages/Missions.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/AgentDetail.tsx`
- `src/pages/Events.tsx`
- `src/types/{agent,task,run}.ts`
- `scripts/test-inbox-e2e.mjs`
- `data/{tasks,runs,run-events,inbox-drafts,agents}.json`

## Situação operacional observada
- Pipeline de aprovação Telegram está funcional.
- Runs são criadas e exibidas corretamente no Kanban.
- Existem falhas recorrentes de spawn com `Request failed with status code 404` em parte dos runs.
- Retry automático já está ativo e funcionando.

## Leitura de maturidade
- **Produto:** ~70% do caminho para o “Mission Control funcional”.
- **Confiabilidade:** gargalo principal está na integração `sessions_spawn`/gateway (não na UI).

---

## 10) Gap vs vídeo analisado

## Já alinhado
- Dashboard com métricas.
- Board de tarefas/runs.
- Perfis de agentes e skills.
- Narrativa de missão e orquestração.

## Faltando para equivaler e superar
1. Thread visual agente↔agente totalmente real-time e legível.
2. Stage consolidado com dados reais (não feed mockado).
3. Auditoria forte de configuração (histórico de mudanças dedicado).
4. Robustez total de spawn/subagent (eliminar 404 intermitente).

---

## 11) Plano de implementação imediato (ordem executiva)

## P0 — travas de execução (fazer primeiro)
1. Corrigir causa raiz do `404` no `toolsInvoke('sessions_spawn')`.
2. Telemetria detalhada de erro no backend (status/body/tool/payload sanitizado).
3. Circuit-breaker para não floodar retry em erro de configuração.

## P1 — funcionalidades do vídeo (funcionais de verdade)
1. Agent Threads reais (timeline + conversa + tool trace por run).
2. Stage 100% conectado ao backend (sem mock local).
3. Actions operacionais completas no Stage (retry/pause/cancel/reassign).

## P2 — governança
1. Audit log estruturado (`audit_logs.json` ou tabela futura).
2. Versionamento de perfil de agente.
3. Métricas operacionais/SLA no dashboard.

---

## 12) Critério de pronto (DoD)

Um build é considerado pronto quando:
- Todo run criado pode: iniciar, parar, falhar, retry, concluir com estados consistentes.
- Timeline mostra eventos reais do ciclo completo.
- Stage reflete o mesmo estado canônico de `runs.json`.
- Alteração de perfil do agente impacta execução subsequente.
- Sem falha silenciosa: erro sempre aparece em `run-events` + UI.

---

## 13) Como subir e validar rapidamente

## Subir
1. Backend: `node server.js` (ou PM2).
2. Frontend: `npm run dev` (ou build+serve já integrado ao backend via `dist`).

## Validar rápido
1. Criar Task pelo painel.
2. Confirmar criação de Run em `queued/running`.
3. Testar `Parar` e `Retry` no Kanban.
4. Enviar `Task:` via inbox Telegram e aprovar por botão.
5. Conferir eventos em `/events` e `data/run-events.json`.

## E2E
- Executar `scripts/test-inbox-e2e.mjs` para fluxo completo de draft/aprovação/alto risco/ajuste.

---

## 14) Riscos técnicos atuais

- Dependência alta do gateway e política de `sessions_spawn`.
- Persistência em JSON funciona para MVP, mas limita concorrência e auditoria robusta.
- Stage ainda com partes mockadas pode mascarar estado real se não sincronizar 100%.

---

## 15) Próximo passo recomendado para Claude Code (ação direta)

1. Abrir `server.js` e isolar o bloco `toolsInvoke + startRun + retry`.
2. Instrumentar logs de erro com granularidade (status/http body/tool).
3. Reproduzir erro 404 com task mínima.
4. Corrigir contrato de chamada ou rota gateway.
5. Reexecutar E2E e validar pipeline completo sem 404.
6. Só depois disso avançar Stage/Threads visuais.

---

## 16) TL;DR executivo

- Missão e estrutura do Mission Control estão corretas.
- Fluxo Telegram→aprovação→run já existe e funciona.
- Principal bloqueio hoje: confiabilidade de spawn (404 intermitente).
- Assim que estabilizar spawn, o resto (threads/stage real) vira implementação direta.

---

**Arquivo canônico criado em:** `C:\Users\seuca\mission-control-v4\PRD_MISSION_CONTROL_UNIFICADO.md`
