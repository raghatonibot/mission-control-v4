# STEP 4 — E2E + Deploy Checklist

## Gate técnico
- [x] Build: `npm run build`
- [x] Lint: `npm run lint`
- [x] Health backend: `GET /health` -> `{ "ok": true }`

## E2E funcional (manual)
- [x] Criar Task
- [x] Iniciar Run
- [x] Pausar Run
- [x] Cancelar Run
- [x] Reassign Run
- [x] Abrir Thread do Run e validar endpoint
- [x] Alterar Agent Profile e validar audit log

### Evidência rápida (execução real)
- Task: `task_mlwxkcpm_oumpoj`
- Run: `run_mlwxkcqh_3i01h7`
- Reassign: `run_mlwxkcqh_3i01h7 -> run_mlwxkdfa_xe916i`
- Thread endpoint: `ok=true`, itens=`0` (válido sem sessão ativa)
- Audit logs (gabriel): `ok=true`, update recente detectado

## Deploy local (Cloudflare tunnel stack)
- [x] Build produção atualizado em `dist/`
- [x] Reiniciar processo Node (`pm2 restart mission-control-v4` + `mission-control-watch`)
- [x] Validar `http://127.0.0.1:3004/health`
- [x] Validar rotas UI principais (`/`, `/missions`, `/stage`)
- [x] Smoke final remoto via domínio (`https://missioncontrol.carvalhoai.com/health`)

## Critério de conclusão
- Todos os itens de E2E funcional e Deploy local marcados.
- **Status: CONCLUÍDO**
