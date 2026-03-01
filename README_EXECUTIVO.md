# README_EXECUTIVO — Mission Control v4

## Objetivo
Painel operacional para receber tasks, delegar para agentes, acompanhar runs e entregar resultado final no Telegram + registro completo no Mission Control.

---

## Acesso rápido
- Local: `http://127.0.0.1:3004`
- Produção: `https://missioncontrol.carvalhoai.com`

Rotas principais:
- `#/missions` — execução (tasks/runs)
- `#/tasks-done` — tarefas concluídas
- `#/tokens` — tokens reais por modelo (sem cache)

Health:
- `GET /health` -> `{ "ok": true }`

---

## Fluxo Telegram (Task: ...)
1. Usuário envia `Task: ...`
2. Sistema gera plano curto + agentes sugeridos
3. Envia botões: **Aprovado / Ajustar / Cancelar**
4. Se **Aprovado**: cria task/run no MC e executa
5. Envia feedback curto por etapa no Telegram
6. Faz revisão final (Ragha validator)
7. Entrega resumo final no Telegram + grava no MC

---

## Funcionalidades entregues
- Tasks + Runs reais com estados operacionais
- Ações de run: pause / stop / stopall / retry / reassign (somente em run terminal)
- Timeline de eventos por run
- Thread por run
- Agent profile editável + auditoria
- Tela **Tarefas Feitas**
- Tela **Controle Real de Tokens** (input/output reais, sem cache)

---

## Operação diária (PM2)
```bash
pm2 list
pm2 restart mission-control-v4 --update-env
pm2 restart mission-control-watch
pm2 logs mission-control-v4 --lines 200
```

---

## Qualidade atual
- `npm run build` ✅
- `npm run lint` ✅
- Fluxo principal E2E ✅

---

## Config crítica (.env)
- `GATEWAY_URL=http://127.0.0.1:18789`
- `GATEWAY_TOKEN=<token atual do OpenClaw>`
- `AUTH_MODE=totp|cloudflare|none`
- `INBOX_TOKEN=<token inbox>`
- `TELEGRAM_NOTIFY_TARGET=telegram:<chat_id>`
- `TELEGRAM_AUTO_APPROVE_CHAT_IDS=telegram:<chat_id>`
- `MIN_DONE_SUMMARY_CHARS=180` (resumo mínimo para permitir status `done`)

**Atenção:** se aparecer `401 Unauthorized` em spawn, sincronizar `GATEWAY_TOKEN` com `~/.openclaw/openclaw.json` e reiniciar com `--update-env`.

---

## Endpoints-chave
- `POST /api/inbox/telegram`
- `GET /api/tasks`
- `GET /api/tasks/done`
- `GET /api/runs`
- `POST /api/runs/:id/pause|stop|stopall|retry|reassign`
- `GET /api/events`
- `GET /api/audit-logs`
- `GET /api/tokens/live`
- `POST /api/tokens/live/reset`

---

## Próximo foco recomendado
- Impor resumo mínimo antes de marcar run como `done`
- Alertas de orçamento de tokens
- Gráfico temporal (hora/dia) na aba Tokens
