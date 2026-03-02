import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import express from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import os from 'os';

dotenv.config();

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS for iOS Shortcuts
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Hardening: avoid noisy stack traces for malformed JSON payloads.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'invalid_json_body' });
  }
  return next(err);
});

const PORT = process.env.PORT || 3004;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL || '';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || 'C:\\Users\\seuca\\.openclaw\\workspace';
const AUTH_SETUP_TOKEN = process.env.AUTH_SETUP_TOKEN || '';

const dataDir = path.resolve(__dirname, 'data');
const authFile = path.join(dataDir, 'auth.json');
const tasksFile = path.join(dataDir, 'tasks.json');
const runsFile = path.join(dataDir, 'runs.json');
const runEventsFile = path.join(dataDir, 'run-events.json');
const validatorsFile = path.join(dataDir, 'validators.json');
const agentsFile = path.join(dataDir, 'agents.json');
const inboxDraftsFile = path.join(dataDir, 'inbox-drafts.json');
const auditLogsFile = path.join(dataDir, 'audit-logs.json');
const cardNotesFile = path.join(dataDir, 'card-notes.json');
const tokenUsageStateFile = path.join(dataDir, 'token-usage-state.json');
const conversationsFile = path.join(dataDir, 'conversations.json');
const openclawSessionsDir = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
const routineUsageFile = process.env.ROUTINE_USAGE_FILE || path.join(WORKSPACE_ROOT, 'memory', 'routine-usage.jsonl');
const coreRoutingRulesFile = path.join(WORKSPACE_ROOT, 'mission-control', 'agents-core', 'routing-rules.json');
const tokenKillSwitchFile = path.join(WORKSPACE_ROOT, 'mission-control', 'data', 'token-kill-switch.flag');

function ensureAuthFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(authFile)) {
    const secret = speakeasy.generateSecret({ name: `Mission Control (${ALLOWED_EMAIL || 'admin'})` });
    fs.writeFileSync(authFile, JSON.stringify({ secret: secret.base32 }, null, 2));
  }
}

function getSecret() {
  ensureAuthFile();
  const content = fs.readFileSync(authFile, 'utf-8');
  const parsed = JSON.parse(content);
  return parsed.secret;
}

function signToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '12h' });
}

function isStrongJwtSecret(secret) {
  const s = String(secret || '');
  if (!s || s === 'change-me') return false;
  return s.length >= 32;
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const clean = String(raw || '').replace(/^\uFEFF/, '').trim();
    return clean ? JSON.parse(clean) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, value) {
  ensureAuthFile(); // also ensures dataDir exists
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, filePath);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const ACTIVE_RUN_STATUSES = ['queued', 'running', 'stopping', 'waiting', 'review'];

function sanitizeText(value) {
  if (typeof value !== 'string') return value;
  // Remove replacement chars / odd control chars that break kanban rendering.
  return value
    .replace(/\uFFFD+/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function findActiveSiblingRun(runs, taskId, agentId, excludeId) {
  return runs.find(
    (r) =>
      r.id !== excludeId &&
      r.taskId === taskId &&
      r.agentId === agentId &&
      ACTIVE_RUN_STATUSES.includes(String(r.status || ''))
  );
}

function normalizeRunsDataset(runs, tasks) {
  const taskIds = new Set((Array.isArray(tasks) ? tasks : []).map((t) => String(t.id)));
  const seen = new Set();
  let changed = false;
  const out = [];

  for (const run of Array.isArray(runs) ? runs : []) {
    if (!run || typeof run !== 'object') continue;

    const taskId = String(run.taskId || '');
    if (!taskId || !taskIds.has(taskId)) {
      // Drop orphan runs (typically orphan retries from deleted/missing tasks).
      changed = true;
      continue;
    }

    const dedupKey = `${taskId}::${String(run.agentId || '')}`;
    const status = String(run.status || '');
    if (ACTIVE_RUN_STATUSES.includes(status)) {
      if (seen.has(dedupKey)) {
        // Keep only the newest active card per task+agent.
        changed = true;
        continue;
      }
      seen.add(dedupKey);
    }

    const canonicalAgentId = mapCoreAgentToRuntime(String(run.agentId || '')) || String(run.agentId || '');
    const canonicalAgentName = canonicalAgentId
      ? (String(canonicalAgentId).charAt(0).toUpperCase() + String(canonicalAgentId).slice(1))
      : sanitizeText(run.agentName || '');

    const cleaned = {
      ...run,
      agentId: canonicalAgentId || run.agentId,
      taskTitle: sanitizeText(run.taskTitle || ''),
      summary: sanitizeText(run.summary || ''),
      lastError: sanitizeText(run.lastError || ''),
      agentName: sanitizeText(canonicalAgentName || run.agentName || ''),
    };

    if (
      cleaned.taskTitle !== run.taskTitle ||
      cleaned.summary !== run.summary ||
      cleaned.lastError !== run.lastError ||
      cleaned.agentName !== run.agentName
    ) {
      changed = true;
    }

    out.push(cleaned);
  }

  return { runs: out, changed };
}

function repairKanbanDataOnce() {
  const tasks = listTasks();
  const runs = listRuns();
  const normalized = normalizeRunsDataset(runs, tasks);
  if (normalized.changed) {
    saveRuns(normalized.runs);
  }
}

function listTasks() {
  return readJsonSafe(tasksFile, []);
}

function saveTasks(tasks) {
  writeJsonAtomic(tasksFile, tasks);
}

function listRuns() {
  return readJsonSafe(runsFile, []);
}

function deriveTaskRunStage(task, runs) {
  const related = runs.filter((r) => r.taskId === task.id);
  if (!related.length) return 'none';

  const has = (s) => related.some((r) => r.status === s);
  const allTerminal = related.every((r) => ['done', 'failed', 'stopped'].includes(String(r.status)));

  if (has('stopping')) return 'stopping';
  if (has('running')) return 'running';
  if (has('review')) return 'review';
  if (has('waiting')) return 'waiting';
  if (has('queued')) return 'queued';

  if (allTerminal && related.some((r) => r.status === 'done')) return 'done';
  if (allTerminal && related.every((r) => r.status === 'stopped')) return 'stopped';
  if (has('failed')) return 'failed';
  return 'mixed';
}

function withTaskRuntime(tasks) {
  const runs = listRuns();
  return tasks.map((t) => ({ ...t, runStage: deriveTaskRunStage(t, runs) }));
}

function saveRuns(runs) {
  writeJsonAtomic(runsFile, runs);
}

function appendRunEvent(runId, event) {
  const events = readJsonSafe(runEventsFile, []);
  events.push({ runId, at: Date.now(), ...event });
  writeJsonAtomic(runEventsFile, events);
}

function listRunEvents() {
  return readJsonSafe(runEventsFile, []);
}

function listValidators() {
  return readJsonSafe(validatorsFile, []);
}

function saveValidators(items) {
  writeJsonAtomic(validatorsFile, items);
}

function listAgentsConfig() {
  return readJsonSafe(agentsFile, []);
}

function saveAgentsConfig(items) {
  writeJsonAtomic(agentsFile, items);
}

function listInboxDrafts() {
  return readJsonSafe(inboxDraftsFile, []);
}

function saveInboxDrafts(items) {
  writeJsonAtomic(inboxDraftsFile, items);
}

function listAuditLogs() {
  return readJsonSafe(auditLogsFile, []);
}

function appendAuditLog(entry) {
  const rows = listAuditLogs();
  rows.unshift({ id: uid('audit'), at: Date.now(), ...entry });
  writeJsonAtomic(auditLogsFile, rows.slice(0, 5000));
}

function listCardNotes() {
  return readJsonSafe(cardNotesFile, []);
}

function listConversations() {
  return readJsonSafe(conversationsFile, []);
}

function saveConversations(items) {
  writeJsonAtomic(conversationsFile, items);
}

function getOrCreateConversation(agentId) {
  const id = String(agentId || '').toLowerCase();
  const all = listConversations();
  let conv = all.find((c) => String(c.agentId) === id);
  if (!conv) {
    const a = getAgentProfile(id) || { id, name: id, status: 'idle', avatar: '' };
    conv = {
      id: `conv-${id}`,
      agentId: id,
      agentName: a.name || id,
      agentAvatar: a.avatar || `/agents/${id}.svg?v=1`,
      agentStatus: ['active', 'idle', 'offline'].includes(String(a.status)) ? String(a.status) : 'idle',
      lastMessage: '',
      lastMessageTime: '',
      unreadCount: 0,
      messages: [],
    };
    all.unshift(conv);
    saveConversations(all);
  }
  return conv;
}

function upsertConversation(conv) {
  const all = listConversations();
  const idx = all.findIndex((c) => String(c.agentId) === String(conv.agentId));
  if (idx >= 0) all[idx] = conv;
  else all.unshift(conv);
  saveConversations(all.slice(0, 200));
}

function getConversationListWithFallback() {
  const stored = listConversations();
  const byAgent = new Map(stored.map((c) => [String(c.agentId), c]));
  const agents = listAgentsConfig();
  const out = agents.map((a) => {
    const id = String(a.id);
    const c = byAgent.get(id);
    if (c) return c;
    return {
      id: `conv-${id}`,
      agentId: id,
      agentName: a.name || id,
      agentAvatar: a.avatar || `/agents/${id}.svg?v=1`,
      agentStatus: ['active', 'idle', 'offline'].includes(String(a.status)) ? String(a.status) : 'idle',
      lastMessage: `Canal direto com ${a.name || id}`,
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      messages: [],
    };
  });
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickAssistantTextFromHistory(hist) {
  const msgs = Array.isArray(hist?.messages) ? hist.messages : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i];
    if (String(m?.role) !== 'assistant') continue;
    const parts = Array.isArray(m?.content) ? m.content : [];
    const textPart = parts.find((p) => String(p?.type) === 'text' && String(p?.text || '').trim());
    if (textPart) return String(textPart.text).trim();
  }
  return '';
}

function saveCardNotes(items) {
  writeJsonAtomic(cardNotesFile, items);
}

function normalizeEntityType(entityType) {
  const t = String(entityType || '').toLowerCase();
  if (t === 'mission') return 'run';
  if (t === 'run' || t === 'task') return t;
  return '';
}

function getCardNotes(entityType, entityId) {
  const t = normalizeEntityType(entityType);
  const id = String(entityId || '');
  const notes = listCardNotes().filter((n) => String(n?.entityType) === t && String(n?.entityId) === id);
  const comments = notes.filter((n) => n.kind === 'comment').sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  const findings = notes.filter((n) => n.kind === 'finding').sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  return { comments, findings };
}

function appendCardNote({ entityType, entityId, kind, text, author }) {
  const t = normalizeEntityType(entityType);
  if (!t) throw new Error('invalid_entity_type');
  const id = String(entityId || '').trim();
  if (!id) throw new Error('invalid_entity_id');
  const body = String(text || '').trim();
  if (!body) throw new Error('missing_text');

  const now = Date.now();
  const rows = listCardNotes();
  const note = {
    id: uid('note'),
    at: now,
    entityType: t,
    entityId: id,
    kind: kind === 'finding' ? 'finding' : 'comment',
    text: body.slice(0, 4000),
    author: String(author || 'system'),
  };
  rows.push(note);
  saveCardNotes(rows.slice(-10000));
  return note;
}

function getTokenUsageState() {
  const s = readJsonSafe(tokenUsageStateFile, null);
  if (s && Number.isFinite(Number(s.activatedAtMs))) return s;
  const fresh = { activatedAtMs: Date.now() };
  writeJsonAtomic(tokenUsageStateFile, fresh);
  return fresh;
}

function parseJsonlUsageSince(activatedAtMs) {
  const out = [];
  if (!fs.existsSync(openclawSessionsDir)) return out;

  const files = fs
    .readdirSync(openclawSessionsDir)
    .filter((name) => name.endsWith('.jsonl'));

  for (const name of files) {
    const full = path.join(openclawSessionsDir, name);
    let raw = '';
    try {
      raw = fs.readFileSync(full, 'utf-8');
    } catch {
      continue;
    }
    if (!raw) continue;

    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (row?.type !== 'message') continue;
      const msg = row?.message || {};
      if (msg?.role !== 'assistant') continue;
      const ts = new Date(String(row?.timestamp || msg?.timestamp || 0)).getTime();
      if (!Number.isFinite(ts) || ts < activatedAtMs) continue;

      const usage = msg?.usage || {};
      const input = Number(usage?.input || 0);
      const output = Number(usage?.output || 0);
      if (input <= 0 && output <= 0) continue;

      const userText = (() => {
        const c = msg?.content;
        if (!Array.isArray(c)) return '';
        return c.filter((x) => x?.type === 'text').map((x) => String(x?.text || '')).join(' ').trim();
      })();
      const taskClass = /\[cron:/i.test(userText) ? 'cron' : 'general';

      out.push({
        id: String(row?.id || `${name}:${ts}`),
        timestamp: ts,
        model: String(msg?.model || row?.model || 'unknown'),
        provider: String(msg?.provider || row?.provider || 'unknown'),
        agentId: 'main',
        runId: String(row?.runId || ''),
        taskId: String(row?.taskId || ''),
        taskClass,
        input,
        output,
      });
    }
  }

  return out;
}

function parseRoutineUsageSince(activatedAtMs) {
  const out = [];
  if (!fs.existsSync(routineUsageFile)) return out;

  let raw = '';
  try {
    raw = fs.readFileSync(routineUsageFile, 'utf-8');
  } catch {
    return out;
  }
  if (!raw) return out;

  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = new Date(String(row?.ts || 0)).getTime();
    if (!Number.isFinite(ts) || ts < activatedAtMs) continue;

    const input = Number(row?.tokens_in_est || 0);
    const output = Number(row?.tokens_out_est || 0);
    out.push({
      id: `routine:${ts}:${String(row?.task || '')}`,
      timestamp: ts,
      model: String(row?.model || 'ollama/qwen2.5:1.5b'),
      provider: 'ollama-local',
      task: String(row?.task || ''),
      taskClass: String(row?.task_class || `routine-${String(row?.task || 'unknown')}`),
      agentId: String(row?.agent_id || 'local-routine-agent'),
      runId: String(row?.run_id || ''),
      taskId: String(row?.task_id || ''),
      input,
      output,
      local: true,
    });
  }

  return out;
}

function getLiveTokenUsageTotals(filters = {}) {
  const state = getTokenUsageState();
  const hasStart = typeof filters?.startMs === 'number' && Number.isFinite(filters.startMs);
  const hasEnd = typeof filters?.endMs === 'number' && Number.isFinite(filters.endMs);
  const startMs = hasStart ? Number(filters.startMs) : Number(state.activatedAtMs);
  const endMs = hasEnd ? Number(filters.endMs) : Date.now();

  const rows = [
    ...parseJsonlUsageSince(startMs).map((r) => ({ ...r, source: 'remote' })),
    ...parseRoutineUsageSince(startMs).map((r) => ({ ...r, source: 'local', task: r.task || null })),
  ].filter((r) => Number(r.timestamp || 0) >= startMs && Number(r.timestamp || 0) <= endMs);

  const modelFilter = filters?.model ? String(filters.model).toLowerCase() : '';
  const providerFilter = filters?.provider ? String(filters.provider).toLowerCase() : '';
  const sourceFilter = filters?.source ? String(filters.source).toLowerCase() : '';
  const agentFilter = filters?.agentId ? String(filters.agentId).toLowerCase() : '';
  const runFilter = filters?.runId ? String(filters.runId).toLowerCase() : '';
  const taskFilter = filters?.taskId ? String(filters.taskId).toLowerCase() : '';
  const taskClassFilter = filters?.taskClass ? String(filters.taskClass).toLowerCase() : '';

  const filteredRows = rows.filter((r) => {
    const modelOk = modelFilter ? String(r.model || '').toLowerCase().includes(modelFilter) : true;
    const providerOk = providerFilter ? String(r.provider || '').toLowerCase().includes(providerFilter) : true;
    const sourceOk = sourceFilter ? String(r.source || '').toLowerCase() === sourceFilter : true;
    const agentOk = agentFilter ? String(r.agentId || '').toLowerCase().includes(agentFilter) : true;
    const runOk = runFilter ? String(r.runId || '').toLowerCase().includes(runFilter) : true;
    const taskOk = taskFilter ? String(r.taskId || '').toLowerCase().includes(taskFilter) : true;
    const taskClassOk = taskClassFilter ? String(r.taskClass || '').toLowerCase().includes(taskClassFilter) : true;
    return modelOk && providerOk && sourceOk && agentOk && runOk && taskOk && taskClassOk;
  });

  const dedup = new Map();
  for (const r of filteredRows) {
    if (!dedup.has(r.id)) dedup.set(r.id, r);
  }

  const perModel = new Map();
  let totalInput = 0;
  let totalOutput = 0;

  for (const r of dedup.values()) {
    totalInput += Number(r.input || 0);
    totalOutput += Number(r.output || 0);
    const key = String(r.model || 'unknown');
    const prev = perModel.get(key) || { model: key, provider: r.provider, source: r.source || 'remote', input: 0, output: 0, total: 0, messages: 0 };
    prev.input += Number(r.input || 0);
    prev.output += Number(r.output || 0);
    prev.total = prev.input + prev.output;
    prev.messages += 1;
    perModel.set(key, prev);
  }

  const models = [...perModel.values()].sort((a, b) => b.total - a.total);
  const eventsLimit = Math.max(1, Math.min(2000, Number(filters?.eventsLimit || 300)));
  const events = [...dedup.values()]
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
    .slice(0, eventsLimit)
    .map((r) => ({
      atMs: Number(r.timestamp || 0),
      at: new Date(Number(r.timestamp || 0)).toISOString(),
      model: String(r.model || 'unknown'),
      provider: String(r.provider || 'unknown'),
      source: String(r.source || 'remote'),
      agentId: String(r.agentId || ''),
      runId: String(r.runId || ''),
      taskId: String(r.taskId || ''),
      taskClass: String(r.taskClass || ''),
      input: Number(r.input || 0),
      output: Number(r.output || 0),
      total: Number(r.input || 0) + Number(r.output || 0),
    }));

  return {
    activatedAtMs: Number(state.activatedAtMs),
    activatedAt: new Date(Number(state.activatedAtMs)).toISOString(),
    window: {
      startMs,
      start: new Date(startMs).toISOString(),
      endMs,
      end: new Date(endMs).toISOString(),
    },
    totals: {
      input: totalInput,
      output: totalOutput,
      total: totalInput + totalOutput,
      messages: dedup.size,
    },
    models,
    events,
  };
}

function normalizeTaskPrefix(text) {
  const raw = String(text || '').trim();

  // Accept both:
  // - "Task: ..."
  // - "<url> Task: ..." (common on mobile when user pastes a link then writes Task:)
  const m = raw.match(/^(?:https?:\/\/\S+\s+)?task\s*:\s*([\s\S]+)$/i);
  if (!m) return null;
  return m[1].trim();
}

function listAvailableSkills() {
  try {
    const skillsRoot = path.resolve(WORKSPACE_ROOT, 'skills');
    if (!fs.existsSync(skillsRoot)) return [];

    const entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
    const out = [];

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const id = e.name;
      const skillDir = path.join(skillsRoot, id);
      const md = path.join(skillDir, 'SKILL.md');

      let name = id;
      let description = '';
      try {
        if (fs.existsSync(md)) {
          const raw = fs.readFileSync(md, 'utf-8');
          const mSummary = raw.match(/\nsummary:\s*\"([^\"]+)\"/i) || raw.match(/\nsummary:\s*'([^']+)'/i);
          if (mSummary) description = mSummary[1].trim();
          const mTitle = raw.match(/^#\s+(.+)$/m);
          if (mTitle) name = mTitle[1].trim();
          if (!description) {
            const mDesc = raw.match(/\n<description>([\s\S]*?)<\/description>/i);
            if (mDesc) description = mDesc[1].trim().slice(0, 180);
          }
        }
      } catch {
        // ignore
      }

      out.push({ id, name, description });
    }

    // Stable ordering
    out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return out;
  } catch {
    return [];
  }
}

function getAgentProfile(agentId) {
  const agents = listAgentsConfig();
  return agents.find((a) => a.id === agentId) || null;
}

function getAgentModel(agentId) {
  const cfg = getAgentProfile(String(agentId));
  const m = cfg?.model ? String(cfg.model) : '';
  return m || DEFAULT_MODEL;
}

function agentLabel(agentId) {
  const a = getAgentProfile(agentId);
  if (!a) return String(agentId);
  const emoji = a.emoji ? `${a.emoji} ` : '';
  return `${emoji}${a.name || a.id}`.trim();
}

const telegramModeFile = path.join(dataDir, 'telegram-agent-modes.json');
function listTelegramModes() { return readJsonSafe(telegramModeFile, []); }
function saveTelegramModes(items) { writeJsonAtomic(telegramModeFile, items); }
function getChatAgentMode(chatId) {
  const all = listTelegramModes();
  return all.find((m) => String(m.chatId) === String(chatId)) || null;
}
function setChatAgentMode(chatId, agentId) {
  const all = listTelegramModes();
  const now = new Date().toISOString();
  const idx = all.findIndex((m) => String(m.chatId) === String(chatId));
  const row = { chatId: String(chatId), agentId: String(agentId), updatedAt: now };
  if (idx >= 0) all[idx] = row;
  else all.unshift(row);
  saveTelegramModes(all.slice(0, 500));
}
function clearChatAgentMode(chatId) {
  const all = listTelegramModes();
  saveTelegramModes(all.filter((m) => String(m.chatId) !== String(chatId)));
}
function mapCoreAgentToRuntime(agentId) {
  const key = String(agentId || '').toLowerCase();
  const m = {
    ragha: 'ragha',
    main: 'main',
    ironman: 'ironman',
    fury: 'fury',
    shuri: 'shuri',
    thor: 'thor',
    hulk: 'hulk',
    pepper: 'pepper',
    blackwidow: 'blackwidow',
    hawkeye: 'hawkeye',
    wanda: 'wanda',
  };
  return m[key] || key;
}

function resolveAgentIdFromText(input) {
  const t = String(input || '').toLowerCase().trim();
  const map = {
    ragha: 'ragha',
    main: 'main',
    ironman: 'ironman',
    fury: 'fury',
    shuri: 'shuri',
    thor: 'thor',
    hulk: 'hulk',
    pepper: 'pepper',
    blackwidow: 'blackwidow',
    hawkeye: 'hawkeye',
    wanda: 'wanda'
  };
  return map[t] || null;
}

function makeQuickPlan(title) {
  const agentIds = pickAgentsFromText(title);
  const steps = [];

  steps.push('Entender o pedido e definir saÃ­da mÃ­nima.');
  if (agentIds.includes('ironman')) steps.push('IronMan: pesquisar sinais e extrair evidÃªncias objetivas.');
  if (agentIds.includes('blackwidow')) steps.push('BlackWidow: monitorar tendÃªncia e contexto social.');
  if (agentIds.includes('shuri')) steps.push('Shuri: definir arquitetura/abordagem tÃ©cnica.');
  if (agentIds.includes('thor')) steps.push('Thor: executar implementaÃ§Ã£o mÃ­nima viÃ¡vel.');
  if (agentIds.includes('hulk')) steps.push('Hulk: validar critÃ©rios de QA e evidÃªncia.');
  if (agentIds.includes('pepper')) steps.push('Pepper: consolidar documentaÃ§Ã£o e handoff.');
  steps.push('Ragha: consolidar entrega final e prÃ³ximo passo.');

  return { agentIds, steps: steps.slice(0, 6) };
}

const AUTH_MODE = process.env.AUTH_MODE || 'totp'; // totp | cloudflare | none
const WIP_LIMIT = Number(process.env.WIP_LIMIT || '2');
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'kimi-coding/k2p5';
const FIXED_TASK_MODEL = process.env.FIXED_TASK_MODEL || 'kilocode/z-ai/glm-5:free';
const DEFAULT_AGENT_ID = process.env.DEFAULT_AGENT_ID || 'ragha';
const INBOX_TOKEN = process.env.INBOX_TOKEN || '';
const TELEGRAM_NOTIFY_TARGET = process.env.TELEGRAM_NOTIFY_TARGET || '';
const TELEGRAM_AUTO_APPROVE_CHAT_IDS = (process.env.TELEGRAM_AUTO_APPROVE_CHAT_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
if (isProduction && AUTH_MODE === 'none') {
  throw new Error('SECURITY: AUTH_MODE=none is forbidden in production');
}
if (isProduction && !isStrongJwtSecret(JWT_SECRET)) {
  throw new Error('SECURITY: JWT_SECRET missing/weak (must be random and >= 32 chars)');
}

async function notifyTelegram(text) {
  if (!TELEGRAM_NOTIFY_TARGET) return;
  const raw = String(text || '');

  // User preference: hide automatic technical task-result spam in Telegram.
  if (/^Resultado da Task:/i.test(raw)) return;

  const normalized = raw
    .replace(/PrÃ³xima aÃ§Ã£o/g, 'Próxima ação')
    .replace(/aprovaÃ§Ã£o/g, 'aprovação')
    .replace(/revisÃ£o/g, 'revisão')
    .replace(/execuÃ§Ã£o/g, 'execução')
    .replace(/nÃ£o/g, 'não')
    .replace(/conteÃºdo/g, 'conteúdo')
    .replace(/evidÃªncia/g, 'evidência')
    .replace(/SaÃ­da/g, 'Saída')
    .replace(/mÃ­nimo/g, 'mínimo')
    .replace(/prÃ³xima/g, 'próxima')
    .replace(/TÃ­tulo/g, 'Título')
    .replace(/vÃ­deo/g, 'vídeo')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã£/g, 'ã')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã­/g, 'í');

  try {
    await toolsInvoke('message', { action: 'send', target: TELEGRAM_NOTIFY_TARGET, message: normalized });
  } catch {
    // ignore
  }
}

async function sendTelegramApprovalPrompt(chatId, task, risk = 'high') {
  try {
    const riskLine = risk === 'high' ? 'âš ï¸ Risco: alto (precisa aprovaÃ§Ã£o)\n' : 'âœ… Risco: baixo\n';
    await toolsInvoke('message', {
      action: 'send',
      target: String(chatId),
      message:
        `Task criada (aguardando aprovaÃ§Ã£o)\n` +
        riskLine +
        `ID: ${task.id}\n` +
        `TÃ­tulo: ${task.title}\n\n` +
        `Escolha:`,
      buttons: [
        [
          { text: 'Aprovado', callback_data: `approve:${task.id}` },
          { text: 'Ajustar', callback_data: `adjust:${task.id}` },
        ],
        [{ text: 'Cancelar', callback_data: `cancel:${task.id}` }],
      ],
    });
  } catch {
    // ignore
  }
}

async function sendTelegramTaskDraftPrompt(chatId, draft) {
  try {
    const plan = draft?.plan || makeQuickPlan(draft?.title || '');
    const agentsLine = Array.isArray(plan.agentIds) && plan.agentIds.length
      ? plan.agentIds.map(agentLabel).join(' â†’ ')
      : agentLabel(DEFAULT_AGENT_ID);

    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    const stepsText = steps.length ? steps.map((s) => `- ${s}`).join('\n') : '- (sem plano)';
    const risk = draft?.risk || classifyRisk(draft?.title || '');
    const riskLine = risk === 'high' ? 'âš ï¸ Risco: alto (vai pedir confirmaÃ§Ã£o extra)\n\n' : '';

    await toolsInvoke('message', {
      action: 'send',
      target: String(chatId),
      message:
        `Planejamento (resumo)\n` +
        `ID: ${draft.id}\n` +
        `TÃ­tulo: ${draft.title}\n\n` +
        riskLine +
        `Agentes: ${agentsLine}\n\n` +
        `${stepsText}\n\n` +
        `Escolha:`,
      buttons: [
        [
          { text: 'Aprovado', callback_data: `approve:${draft.id}` },
          { text: 'Ajustar', callback_data: `adjust:${draft.id}` },
        ],
        [{ text: 'Cancelar', callback_data: `cancel:${draft.id}` }],
      ],
    });
  } catch {
    // ignore
  }
}

async function sendTelegramHighRiskConfirmPrompt(chatId, draft) {
  try {
    await toolsInvoke('message', {
      action: 'send',
      target: String(chatId),
      message:
        `âš ï¸ ConfirmaÃ§Ã£o extra de risco\n` +
        `ID: ${draft.id}\n` +
        `TÃ­tulo: ${draft.title}\n\n` +
        `Esse pedido parece sensÃ­vel (produÃ§Ã£o/credenciais/destrutivo).\n` +
        `Confirma executar mesmo assim?`,
      buttons: [
        [
          { text: 'Confirmar alto risco', callback_data: `approve_high:${draft.id}`, style: 'danger' },
        ],
        [{ text: 'Cancelar', callback_data: `cancel:${draft.id}` }],
      ],
    });
  } catch {
    // ignore
  }
}

function authMiddleware(req, res, next) {
  if (AUTH_MODE === 'none') return next();

  // Cloudflare Access mode
  if (AUTH_MODE === 'cloudflare') {
    const email = String(
      req.headers['cf-access-authenticated-user-email'] ||
      req.headers['Cf-Access-Authenticated-User-Email'] ||
      req.headers['CF-Access-Authenticated-User-Email'] ||
      ''
    );
    if (ALLOWED_EMAIL && email && email.toLowerCase() === ALLOWED_EMAIL.toLowerCase()) {
      req.user = { email };
      return next();
    }
  }

  // Bearer token fallback (TOTP login)
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ ok: false, error: 'missing_token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'invalid_token' });
  }
}

const TOOL_POLICY = {
  // What the Mission Control backend itself is allowed to call via Gateway.
  // (This does NOT prevent subagents from calling tools inside their own sessions; for that we add auditing.)
  deny: ['gateway'],
};

async function toolsInvoke(tool, args = {}, action) {
  const t = String(tool || '');
  if (TOOL_POLICY.deny.includes(t)) {
    throw new Error(`tool_denied:${t}`);
  }

  const payload = action
    ? { tool: t, action, args, sessionKey: 'agent:main:main' }
    : { tool: t, args, sessionKey: 'agent:main:main' };

  const tokenNow = process.env.OPENCLAW_GATEWAY_TOKEN || GATEWAY_TOKEN || '';
  const baseHeaders = {
    'Content-Type': 'application/json',
    // Helps Gateway resolve channel policies (Telegram dmPolicy=pairing)
    'x-openclaw-message-channel': 'telegram',
  };

  const headerAttempts = [
    { ...baseHeaders, Authorization: `Bearer ${tokenNow}` },
    { ...baseHeaders, 'x-openclaw-gateway-token': tokenNow },
    { ...baseHeaders, 'x-gateway-token': tokenNow },
  ];

  let responseJson = null;
  let lastErr = null;

  for (const headers of headerAttempts) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const r = await fetch(`${GATEWAY_URL}/tools/invoke`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = body?.error?.message || body?.error || body?.message || r.statusText || 'request_failed';
        const e = new Error(String(msg));
        e.status = r.status;
        e.body = body;
        throw e;
      }

      responseJson = body;
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.response?.status;
      if (status !== 401) break;
    }
  }

  if (!responseJson) {
    const err = lastErr;
    const status = err?.status || err?.response?.status;
    const bodyMsg = err?.body?.error?.message || err?.body?.error || err?.body?.message || err?.response?.data?.error?.message || err?.response?.data?.error || err?.response?.data?.message || '';
    const details = [String(err?.message || 'request_failed'), status ? `status=${status}` : '', bodyMsg ? `detail=${bodyMsg}` : '']
      .filter(Boolean)
      .join(' | ');
    throw new Error(`toolsInvoke(${t}) failed: ${details}`);
  }

  const result = responseJson?.result;

  // Gateway /tools/invoke often returns { content: [{type:'text', text:'{...json...}'}], details: {...} }
  if (result && typeof result === 'object') {
    if (result.details && typeof result.details === 'object') return result.details;

    const text = result?.content?.[0]?.text;
    if (typeof text === 'string') {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        // ignore
      }
    }
  }

  return result;
}

app.get('/health', (_, res) => res.json({ ok: true, gatewayAuthReady, gatewayAuthLastError, frontendBuilt: fs.existsSync(path.join(__dirname, 'dist', 'index.html')) }));

const authVerifyAttempts = new Map();

app.get('/auth/setup', async (req, res) => {
  if (!ALLOWED_EMAIL) return res.status(400).json({ ok: false, error: 'ALLOWED_EMAIL not set' });

  const setupToken = String(req.headers['x-auth-setup-token'] || req.query.setupToken || '');
  if (!AUTH_SETUP_TOKEN) return res.status(503).json({ ok: false, error: 'auth_setup_disabled' });
  if (!setupToken || setupToken !== AUTH_SETUP_TOKEN) return res.status(401).json({ ok: false, error: 'invalid_setup_token' });

  const secret = getSecret();
  const otpauth = speakeasy.otpauthURL({
    secret,
    label: `Mission Control (${ALLOWED_EMAIL})`,
    issuer: 'Mission Control',
    encoding: 'base32',
  });
  const qr = await QRCode.toDataURL(otpauth);
  res.json({ ok: true, otpauth, qr });
});

app.post('/auth/verify', (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ ok: false, error: 'missing_fields' });
  if (ALLOWED_EMAIL && email !== ALLOWED_EMAIL) return res.status(403).json({ ok: false, error: 'email_not_allowed' });

  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  const key = `${String(email).toLowerCase()}|${ip}`;
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxAttempts = 5;
  const entry = authVerifyAttempts.get(key);
  if (entry && now < entry.resetAt && entry.count >= maxAttempts) {
    return res.status(429).json({ ok: false, error: 'too_many_attempts', retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) });
  }

  const secret = getSecret();
  const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 2 });
  if (!verified) {
    const next = !entry || now >= entry.resetAt
      ? { count: 1, resetAt: now + windowMs }
      : { count: entry.count + 1, resetAt: entry.resetAt };
    authVerifyAttempts.set(key, next);
    return res.status(401).json({ ok: false, error: 'invalid_code' });
  }

  authVerifyAttempts.delete(key);
  const token = signToken(email);
  res.json({ ok: true, token });
});

app.get('/api/chat/conversations', authMiddleware, (req, res) => {
  try {
    const data = getConversationListWithFallback();
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'chat_conversations_failed', detail: String(err?.message || err) });
  }
});

app.get('/api/chat/:agentId/history', authMiddleware, (req, res) => {
  try {
    const agentId = String(req.params.agentId || '').toLowerCase();
    if (!agentId) return res.status(400).json({ ok: false, error: 'missing_agent' });
    const agent = getAgentProfile(agentId);
    if (!agent) return res.status(404).json({ ok: false, error: 'agent_not_found' });

    const conv = getOrCreateConversation(agentId);
    return res.json({ ok: true, data: conv });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'chat_history_failed', detail: String(err?.message || err) });
  }
});

app.post('/api/chat/:agentId/send', authMiddleware, async (req, res) => {
  try {
    const agentId = String(req.params.agentId || '').toLowerCase();
    const content = String(req.body?.content || '').trim();
    if (!agentId) return res.status(400).json({ ok: false, error: 'missing_agent' });
    if (!content) return res.status(400).json({ ok: false, error: 'missing_content' });
    if (content.length > 6000) return res.status(400).json({ ok: false, error: 'content_too_long' });

    const agent = getAgentProfile(agentId);
    if (!agent) return res.status(404).json({ ok: false, error: 'agent_not_found' });

    const nowIso = new Date().toISOString();
    const conv = getOrCreateConversation(agentId);

    const userMsg = {
      id: uid('msg'),
      senderId: 'user',
      senderName: 'Você',
      content,
      timestamp: nowIso,
      isUser: true,
    };

    conv.messages = [...(Array.isArray(conv.messages) ? conv.messages : []), userMsg].slice(-300);
    conv.lastMessage = content;
    conv.lastMessageTime = nowIso;
    upsertConversation(conv);

    const model = getAgentModel(agentId);
    const task = [
      `Você é ${agent.name || agentId} (${agent.role || 'agente'}).`,
      'Converse de forma objetiva em português do Brasil.',
      'Responda como em um chat direto: curto, claro e útil.',
      `Mensagem do usuário: ${content}`,
    ].join('\n');

    const spawned = await toolsInvoke('sessions_spawn', {
      task,
      mode: 'run',
      cleanup: 'keep',
      model,
      runTimeoutSeconds: 120,
      timeoutSeconds: 120,
      label: `chat-${agentId}`,
    });

    const childSessionKey = String(spawned?.childSessionKey || '');
    let replyText = '';

    if (childSessionKey) {
      for (let i = 0; i < 12; i += 1) {
        await sleep(1500);
        const hist = await toolsInvoke('sessions_history', { sessionKey: childSessionKey, limit: 12, includeTools: false }).catch(() => null);
        replyText = pickAssistantTextFromHistory(hist);
        if (replyText) break;
      }
    }

    if (!replyText) {
      replyText = 'Recebi. Estou processando e já te devolvo o resultado completo.';
    }

    const agentMsg = {
      id: uid('msg'),
      senderId: agentId,
      senderName: agent.name || agentId,
      senderAvatar: agent.avatar || `/agents/${agentId}.svg?v=1`,
      content: replyText,
      timestamp: new Date().toISOString(),
      isUser: false,
    };

    const updated = getOrCreateConversation(agentId);
    updated.agentStatus = 'active';
    updated.messages = [...(Array.isArray(updated.messages) ? updated.messages : []), agentMsg].slice(-300);
    updated.lastMessage = replyText;
    updated.lastMessageTime = agentMsg.timestamp;
    upsertConversation(updated);

    return res.json({ ok: true, data: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'chat_send_failed', detail: String(err?.message || err) });
  }
});

app.get('/api/metrics', authMiddleware, async (req, res) => {
  try {
    const agents = await toolsInvoke('agents_list');
    const cron = await toolsInvoke('cron', { action: 'list' });

    const memoryDir = path.resolve(WORKSPACE_ROOT, 'memory');
    let memoryCount = 0;
    if (fs.existsSync(memoryDir)) {
      memoryCount = fs.readdirSync(memoryDir).filter((f) => f.endsWith('.md')).length;
    }

    res.json({
      ok: true,
      data: {
        agents: agents?.length || 0,
        cronJobs: cron?.jobs?.length || 0,
        memories: memoryCount,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'metrics_failed', detail: String(err?.message || err) });
  }
});

app.get('/api/agent-team/metrics', authMiddleware, (req, res) => {
  try {
    const metricsPath = path.resolve(WORKSPACE_ROOT, 'memory', 'agent-team-metrics.json');
    const healthPath = path.resolve(WORKSPACE_ROOT, 'memory', 'agent-team-health.json');
    const flagsPath = path.resolve(WORKSPACE_ROOT, 'memory', 'agent-team-flags.json');
    const queuePath = path.resolve(WORKSPACE_ROOT, 'data', 'task-queue.jsonl');
    const deadletterPath = path.resolve(WORKSPACE_ROOT, 'data', 'task-deadletter.jsonl');

    const metrics = readJsonSafe(metricsPath, {});
    const health = readJsonSafe(healthPath, {});
    const flags = readJsonSafe(flagsPath, {});

    const countJsonl = (filePath) => {
      if (!fs.existsSync(filePath)) return 0;
      const raw = fs.readFileSync(filePath, 'utf-8');
      return raw.split(/\r?\n/).filter((l) => String(l || '').trim().length > 0).length;
    };

    const queueDepth = Number(metrics?.queueDepth ?? metrics?.queue_depth ?? countJsonl(queuePath));
    const deadletter = Number(metrics?.deadletter ?? metrics?.dead_letter ?? countJsonl(deadletterPath));
    const retries = Number(metrics?.retryCount ?? metrics?.retries ?? 0);
    const alertState = String(metrics?.alertState || metrics?.alert || 'ok');

    res.json({
      ok: true,
      data: {
        queueDepth,
        retries,
        deadletter,
        alertState,
        health,
        flags,
        raw: metrics,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'agent_team_metrics_failed', detail: String(err?.message || err) });
  }
});

app.get('/api/skills', authMiddleware, (req, res) => {
  const skills = listAvailableSkills();
  res.json({ ok: true, data: skills });
});

// Etapa 6: Playbook operacional (SOP/SLA/KPI) por agente
app.get('/api/playbook', authMiddleware, (req, res) => {
  const playbookPath = path.join(WORKSPACE_ROOT, 'mission-control', 'agents-core', 'agents-core.json');
  const cfg = readJsonSafe(playbookPath, {});
  const out = {
    version: cfg?.playbook?.sopVersion || cfg?.version || 'v1',
    orchestrator: cfg?.orchestrator || 'ragha',
    agents: cfg?.playbook?.agents || {},
    handoffPolicy: cfg?.handoffPolicy || {},
  };
  return res.json({ ok: true, data: out });
});

app.get('/api/agents', authMiddleware, async (req, res) => {
  try {
    const agentsRaw = await toolsInvoke('agents_list');

    // toolsInvoke usually returns { ok, data }.
    const gatewayList = Array.isArray(agentsRaw)
      ? agentsRaw
      : (Array.isArray(agentsRaw?.data) ? agentsRaw.data : []);

    // Primary source of truth for names/personality/prompts
    const configList = listAgentsConfig();

    // If gateway returns something, merge it into config by id; otherwise just serve config.
    const gatewayById = new Map(
      gatewayList.map((entry, idx) => {
        const id = typeof entry === 'string' ? entry : entry?.id || `agent-${idx + 1}`;
        const name = typeof entry === 'string' ? entry : entry?.name || id;
        return [String(id), { id, name, ...((typeof entry === 'object' && entry) ? entry : {}) }];
      }),
    );

    const base = (Array.isArray(configList) && configList.length ? configList : []).map((a) => {
      const gw = gatewayById.get(String(a.id));
      return {
        ...a,
        // allow gateway to override lightweight runtime fields
        name: gw?.name || a.name,
        status: gw?.status || a.status,
        type: gw?.type || a.type,
      };
    });

    // Enrich status from Runs
    const runs = listRuns();
    const byAgent = new Map();
    for (const r of runs) {
      if (!r?.agentId) continue;
      const id = String(r.agentId);
      const prev = byAgent.get(id) || { running: 0, lastActive: null, currentTask: null };
      if (r.status === 'running') prev.running += 1;
      const t = r.lastUpdateAt || r.endedAt || r.startedAt || r.queuedAt || r.createdAt || null;
      if (t && (!prev.lastActive || String(t) > String(prev.lastActive))) {
        prev.lastActive = t;
        prev.currentTask = r.taskTitle || null;
      }
      byAgent.set(id, prev);
    }

    const availableSkills = listAvailableSkills();

    const agents = base.map((a) => {
      const meta = byAgent.get(String(a.id));
      const status = meta?.running ? 'active' : (a.status || 'idle');
      const allowed = Array.isArray(a.skillsAllowed) ? a.skillsAllowed : [];
      const skills = availableSkills.map((s) => ({ ...s, enabled: allowed.includes(s.id) }));
      return {
        ...a,
        status,
        lastActive: meta?.lastActive || a.lastActive,
        currentTask: meta?.currentTask || a.currentTask,
        skillsAllowed: allowed,
        skills,
      };
    });

    res.json({ ok: true, data: agents });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'agents_failed', detail: String(err?.message || err) });
  }
});

app.get('/api/agents/live', authMiddleware, (req, res) => {
  try {
    const agents = listAgentsConfig();
    const runs = listRuns();

    const byAgent = new Map();
    for (const a of agents) {
      byAgent.set(String(a.id), {
        id: String(a.id),
        name: a.name || a.id,
        emoji: a.emoji || 'ðŸ¤–',
        role: a.role || '',
        status: 'idle',
        currentRunId: null,
        currentTaskTitle: null,
        currentSessionKey: null,
        currentModel: null,
        runStage: 'idle',
        lastUpdateAt: null,
        queueCount: 0,
      });
    }

    const priority = { running: 5, stopping: 4, review: 3, waiting: 2, queued: 1, failed: 0, stopped: 0, done: 0 };

    for (const r of runs) {
      const aid = String(r?.agentId || '');
      if (!aid || !byAgent.has(aid)) continue;
      const row = byAgent.get(aid);

      if (String(r.status) === 'queued') row.queueCount += 1;

      const currentScore = priority[String(row.runStage || 'idle')] || -1;
      const score = priority[String(r.status || 'done')] || -1;

      if (score >= currentScore) {
        row.currentRunId = r.id || null;
        row.currentTaskTitle = r.taskTitle || null;
        row.currentSessionKey = r.sessionKey || null;
        row.currentModel = r.model || null;
        row.runStage = r.status || 'idle';
        row.lastUpdateAt = r.lastUpdateAt || r.queuedAt || null;
        row.status = (r.status === 'running' || r.status === 'stopping' || r.status === 'review' || r.status === 'waiting') ? 'active' : (r.status === 'queued' ? 'queued' : 'idle');
      }
    }

    const out = Array.from(byAgent.values());
    return res.json({ ok: true, data: out });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'agents_live_failed', detail: String(err?.message || err) });
  }
});

app.get('/api/agents/:id', authMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  const list = listAgentsConfig();
  const agent = (Array.isArray(list) ? list : []).find((a) => String(a.id) === id);
  if (!agent) return res.status(404).json({ ok: false, error: 'not_found' });

  // runtime enrich from runs
  const runs = listRuns();
  const latest = runs
    .filter((r) => String(r?.agentId || '') === id)
    .sort((a, b) => String(b?.lastUpdateAt || b?.queuedAt || '') .localeCompare(String(a?.lastUpdateAt || a?.queuedAt || '')))[0];

  const availableSkills = listAvailableSkills();
  const allowed = Array.isArray(agent.skillsAllowed) ? agent.skillsAllowed : [];

  const out = {
    ...agent,
    status: latest?.status === 'running' ? 'active' : (agent.status || 'idle'),
    lastActive: latest?.lastUpdateAt || latest?.endedAt || latest?.startedAt || latest?.queuedAt || agent.lastActive,
    currentTask: latest?.taskTitle || agent.currentTask,
    skillsAllowed: allowed,
    skills: availableSkills.map((s) => ({ ...s, enabled: allowed.includes(s.id) })),
  };

  res.json({ ok: true, data: out });
});

app.patch('/api/agents/:id', authMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  const patch = req.body || {};
  const list = listAgentsConfig();
  const items = Array.isArray(list) ? list : [];
  const idx = items.findIndex((a) => String(a.id) === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

  const allow = (k) => ['name','emoji','role','description','type','systemDirective','tone','quirks','emojiUsage','formality','skillsAllowed'].includes(k);
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!allow(k)) continue;
    clean[k] = v;
  }

  const availableSkills = listAvailableSkills().map((s) => s.id);
  const normalizedSkillsAllowed =
    'skillsAllowed' in clean
      ? (Array.isArray(clean.skillsAllowed) ? clean.skillsAllowed : [])
          .map((s) => String(s))
          .filter((s) => availableSkills.includes(s))
      : items[idx].skillsAllowed;

  const before = { ...items[idx] };

  items[idx] = {
    ...items[idx],
    ...clean,
    quirks: Array.isArray(clean.quirks) ? clean.quirks : (typeof clean.quirks === 'string' ? clean.quirks.split(',').map(s=>s.trim()).filter(Boolean) : items[idx].quirks),
    ...(normalizedSkillsAllowed !== undefined ? { skillsAllowed: normalizedSkillsAllowed } : {}),
  };

  saveAgentsConfig(items);
  appendAuditLog({
    entityType: 'agent',
    entityId: id,
    action: 'update',
    actor: req?.user?.email || 'system',
    before,
    after: items[idx],
    patch: clean,
  });

  res.json({ ok: true, data: items[idx] });
});

// Backward-compatible: keep /api/missions but it now returns Runs as "missions".
app.get('/api/missions', authMiddleware, async (req, res) => {
  try {
    const runs = listRuns();
    const missions = runs.map((r) => ({
      id: r.id,
      title: r.taskTitle,
      description: r.summary || '',
      agentId: r.agentId,
      agentName: r.agentName,
      agentAvatar: '',
      status: r.status === 'done' ? 'completed' : (r.status === 'failed' ? 'failed' : (r.status === 'running' ? 'running' : 'proposed')),
      priority: r.priority || 'medium',
      steps: 1,
      completedSteps: r.status === 'done' ? 1 : 0,
      createdAt: r.queuedAt || new Date().toISOString(),
      updatedAt: r.lastUpdateAt || r.queuedAt || new Date().toISOString(),
      approved: r.status !== 'queued',
    }));
    res.json({ ok: true, data: missions });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'missions_failed', detail: String(err?.message || err) });
  }
});

app.get('/api/events', authMiddleware, async (req, res) => {
  try {
    const runId = req.query.runId ? String(req.query.runId) : null;
    const limit = Math.max(1, Math.min(2000, Number(req.query.limit || 250)));

    const events = listRunEvents();
    const filtered = runId ? events.filter((e) => String(e?.runId || '') === runId) : events;

    // Sort newest first
    const sorted = [...filtered].sort((a, b) => (Number(b?.at || 0) - Number(a?.at || 0)));

    const now = Date.now();
    const last24h = sorted.filter((e) => Number(e?.at || 0) >= now - 24 * 60 * 60 * 1000);

    res.json({ ok: true, data: { total: sorted.length, last24h: last24h.length, events: sorted.slice(0, limit) } });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'events_failed', detail: String(err?.message || err) });
  }
});

app.get('/api/audit-logs', authMiddleware, (req, res) => {
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 200)));
  const entityType = req.query.entityType ? String(req.query.entityType) : null;
  const entityId = req.query.entityId ? String(req.query.entityId) : null;

  let rows = listAuditLogs();
  if (entityType) rows = rows.filter((r) => String(r?.entityType || '') === entityType);
  if (entityId) rows = rows.filter((r) => String(r?.entityId || '') === entityId);

  const sorted = [...rows].sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0));
  res.json({ ok: true, data: sorted.slice(0, limit) });
});

app.get('/api/cards/:entityType/:id/notes', authMiddleware, (req, res) => {
  const entityType = normalizeEntityType(req.params.entityType);
  const entityId = String(req.params.id || '');
  if (!entityType || !entityId) return res.status(400).json({ ok: false, error: 'invalid_entity' });

  return res.json({ ok: true, data: getCardNotes(entityType, entityId) });
});

app.post('/api/cards/:entityType/:id/comments', authMiddleware, (req, res) => {
  try {
    const note = appendCardNote({
      entityType: req.params.entityType,
      entityId: req.params.id,
      kind: 'comment',
      text: req.body?.text,
      author: req?.user?.email || 'system',
    });
    return res.json({ ok: true, data: note });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err?.message || err) });
  }
});

app.post('/api/cards/:entityType/:id/findings', authMiddleware, (req, res) => {
  try {
    const note = appendCardNote({
      entityType: req.params.entityType,
      entityId: req.params.id,
      kind: 'finding',
      text: req.body?.text,
      author: req?.user?.email || 'system',
    });
    return res.json({ ok: true, data: note });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err?.message || err) });
  }
});

function updateTaskStageFromRuns(taskId) {
  const tasks = listTasks();
  const idx = tasks.findIndex((t) => String(t.id) === String(taskId));
  if (idx === -1) return null;

  const stage = deriveTaskRunStage(tasks[idx], listRuns());
  const map = {
    queued: 'inbox',
    running: 'working',
    stopping: 'working',
    waiting: 'review',
    review: 'review',
    done: 'done',
    stopped: 'cancelled',
    failed: 'blocked',
  };
  tasks[idx] = { ...tasks[idx], status: map[stage] || tasks[idx].status || 'backlog', updatedAt: new Date().toISOString() };
  saveTasks(tasks);
  return tasks[idx];
}

app.post('/api/workflow/runs/:id/action', authMiddleware, async (req, res) => {
  const id = String(req.params.id || '');
  const action = String(req.body?.action || '').toLowerCase();
  const actor = req?.user?.email || 'system';
  const now = new Date().toISOString();

  const runs = listRuns();
  const idx = runs.findIndex((r) => String(r.id) === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'run_not_found' });

  const run = runs[idx];
  const current = String(run.status || 'queued');

  const nextByAction = {
    approve: 'running',
    ajustar: 'queued',
    adjust: 'queued',
    cancel: 'stopped',
    cancelar: 'stopped',
    pause: 'stopping',
    approved: 'done',
    aprovar: 'done',
    refazer: 'running',
    rework: 'running',
    complete: 'review',
  };
  const next = nextByAction[action];
  if (!next) return res.status(400).json({ ok: false, error: 'invalid_action' });

  const allowed = {
    queued: ['approve', 'adjust', 'ajustar', 'cancel', 'cancelar'],
    running: ['pause', 'cancel', 'cancelar', 'complete'],
    stopping: ['cancel', 'cancelar', 'complete'],
    waiting: ['approved', 'aprovar', 'refazer', 'rework', 'cancel', 'cancelar'],
    review: ['approved', 'aprovar', 'refazer', 'rework', 'cancel', 'cancelar'],
    done: [],
    stopped: [],
    failed: ['refazer', 'rework'],
  };

  if (!(allowed[current] || []).includes(action)) {
    return res.status(400).json({ ok: false, error: 'invalid_transition', status: current, action });
  }

  if (current === next) {
    return res.json({ ok: true, data: run, idempotent: true });
  }

  runs[idx] = {
    ...run,
    status: next,
    lastUpdateAt: now,
    ...(next === 'done' || next === 'stopped' ? { endedAt: now } : {}),
  };
  saveRuns(runs);
  appendRunEvent(id, { type: 'workflow_action', action, from: current, to: next, actor });

  const updatedTask = updateTaskStageFromRuns(run.taskId);
  return res.json({ ok: true, data: runs[idx], task: updatedTask || null });
});

app.post('/api/decisions', authMiddleware, (req, res) => {
  const entityType = normalizeEntityType(req.body?.entityType);
  const id = String(req.body?.id || '');
  const decision = String(req.body?.decision || '').toLowerCase();
  const reason = String(req.body?.reason || '').trim();

  if (!entityType || !id || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }

  const now = new Date().toISOString();
  const actor = req?.user?.email || 'system';

  if (entityType === 'task') {
    const tasks = listTasks();
    const idx = tasks.findIndex((t) => String(t.id) === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

    const before = { ...tasks[idx] };
    tasks[idx] = {
      ...tasks[idx],
      approved: decision === 'approve',
      status: decision === 'approve' ? 'ready' : 'blocked',
      updatedAt: now,
    };
    saveTasks(tasks);

    appendAuditLog({ entityType: 'task', entityId: id, action: decision, actor, reason, before, after: tasks[idx] });
    return res.json({ ok: true, data: tasks[idx] });
  }

  const runs = listRuns();
  const idx = runs.findIndex((r) => String(r.id) === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

  const before = { ...runs[idx] };
  const currentStatus = String(before.status || '');
  if (!['review', 'waiting'].includes(currentStatus)) {
    return res.status(400).json({ ok: false, error: 'invalid_status_for_decision', status: currentStatus });
  }

  runs[idx] = {
    ...runs[idx],
    status: decision === 'approve' ? 'done' : 'failed',
    endedAt: now,
    lastUpdateAt: now,
    ...(decision === 'reject' ? { lastError: reason || 'rejected_by_human' } : {}),
  };
  saveRuns(runs);
  appendRunEvent(id, { type: 'human_decision', decision, reason: reason || undefined, from: actor });

  const tasks = listTasks();
  const taskIdx = tasks.findIndex((t) => String(t.id) === String(runs[idx].taskId));
  if (taskIdx !== -1) {
    tasks[taskIdx] = {
      ...tasks[taskIdx],
      status: decision === 'approve' ? 'done' : 'blocked',
      updatedAt: now,
    };
    saveTasks(tasks);
  }

  appendAuditLog({ entityType: entityType === 'run' ? 'run' : 'mission', entityId: id, action: decision, actor, reason, before, after: runs[idx] });
  return res.json({ ok: true, data: runs[idx] });
});

app.get('/api/tasks', authMiddleware, (req, res) => {
  const tasks = listTasks();
  res.json({ ok: true, data: withTaskRuntime(tasks) });
});

app.get('/api/tasks/done', authMiddleware, (req, res) => {
  const tasks = withTaskRuntime(listTasks());
  const runs = listRuns();

  const out = tasks
    .filter((t) => String(t.runStage || '') === 'done')
    .map((t) => {
      const related = runs.filter((r) => String(r.taskId) === String(t.id));
      const latestDone = related
        .filter((r) => String(r.status) === 'done')
        .sort((a, b) => new Date(String(b.lastUpdateAt || b.queuedAt || 0)).getTime() - new Date(String(a.lastUpdateAt || a.queuedAt || 0)).getTime())[0];

      return {
        ...t,
        completedAt: latestDone?.lastUpdateAt || latestDone?.queuedAt || null,
        finalRunId: latestDone?.id || null,
        finalAgentId: latestDone?.agentId || null,
        finalAgentName: latestDone?.agentName || null,
        finalSummary: latestDone?.summary || '',
      };
    })
    .sort((a, b) => new Date(String(b.completedAt || b.updatedAt || b.createdAt || 0)).getTime() - new Date(String(a.completedAt || a.updatedAt || a.createdAt || 0)).getTime());

  res.json({ ok: true, data: out });
});

function isTokenKillSwitchOn() {
  return fs.existsSync(tokenKillSwitchFile);
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function estimateDailyTokensFromRuns() {
  const today = getTodayIsoDate();
  const runs = listRuns();
  return runs
    .filter((r) => String(r.queuedAt || '').slice(0, 10) === today)
    .reduce((acc, r) => acc + Number(r.tokensOutEst || 0), 0);
}

function estimateTaskTokensFromRuns(taskId) {
  const runs = listRuns();
  return runs
    .filter((r) => String(r.taskId) === String(taskId))
    .reduce((acc, r) => acc + Number(r.tokensOutEst || 0), 0);
}

function evaluateRunTokenGuard(run) {
  const DAILY_TOKEN_LIMIT = Number(process.env.DAILY_TOKEN_LIMIT || 120000);
  const TASK_TOKEN_LIMIT = Number(process.env.TASK_TOKEN_LIMIT || 30000);

  if (isTokenKillSwitchOn()) {
    return { ok: false, kind: 'kill_switch', detail: 'token_kill_switch_on' };
  }

  const dailySpent = estimateDailyTokensFromRuns();
  if (dailySpent >= DAILY_TOKEN_LIMIT) {
    return { ok: false, kind: 'daily_limit', detail: `daily_limit_reached:${dailySpent}/${DAILY_TOKEN_LIMIT}` };
  }

  const taskSpent = estimateTaskTokensFromRuns(run?.taskId);
  if (taskSpent >= TASK_TOKEN_LIMIT) {
    return { ok: false, kind: 'task_limit', detail: `task_limit_reached:${taskSpent}/${TASK_TOKEN_LIMIT}` };
  }

  return {
    ok: true,
    limits: { daily: DAILY_TOKEN_LIMIT, task: TASK_TOKEN_LIMIT },
    spent: { daily: dailySpent, task: taskSpent },
  };
}

app.get('/api/tokens/live', authMiddleware, (req, res) => {
  try {
    const parseTs = (v) => {
      if (!v) return null;
      const n = Number(v);
      if (Number.isFinite(n)) return n;
      const t = new Date(String(v)).getTime();
      return Number.isFinite(t) ? t : null;
    };

    const startMs = parseTs(req.query.start);
    const endMs = parseTs(req.query.end);
    const usage = getLiveTokenUsageTotals({
      startMs,
      endMs,
      model: req.query.model ? String(req.query.model) : '',
      provider: req.query.provider ? String(req.query.provider) : '',
      source: req.query.source ? String(req.query.source) : '',
      agentId: req.query.agentId ? String(req.query.agentId) : '',
      runId: req.query.runId ? String(req.query.runId) : '',
      taskId: req.query.taskId ? String(req.query.taskId) : '',
      taskClass: req.query.taskClass ? String(req.query.taskClass) : '',
      eventsLimit: req.query.eventsLimit ? Number(req.query.eventsLimit) : 300,
    });
    res.json({ ok: true, data: usage });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'token_usage_failed', detail: String(err?.message || err) });
  }
});

app.post('/api/tokens/live/reset', authMiddleware, (req, res) => {
  const now = Date.now();
  writeJsonAtomic(tokenUsageStateFile, { activatedAtMs: now });
  res.json({ ok: true, data: { activatedAtMs: now, activatedAt: new Date(now).toISOString() } });
});

app.get('/api/tokens/guard', authMiddleware, (req, res) => {
  const DAILY_TOKEN_LIMIT = Number(process.env.DAILY_TOKEN_LIMIT || 120000);
  const TASK_TOKEN_LIMIT = Number(process.env.TASK_TOKEN_LIMIT || 30000);
  return res.json({
    ok: true,
    data: {
      killSwitchOn: isTokenKillSwitchOn(),
      limits: { daily: DAILY_TOKEN_LIMIT, task: TASK_TOKEN_LIMIT },
      spentToday: estimateDailyTokensFromRuns(),
    },
  });
});

app.post('/api/tokens/guard/kill-switch', authMiddleware, (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  fs.mkdirSync(path.dirname(tokenKillSwitchFile), { recursive: true });
  if (enabled) {
    fs.writeFileSync(tokenKillSwitchFile, `on ${new Date().toISOString()}`);
  } else if (fs.existsSync(tokenKillSwitchFile)) {
    fs.unlinkSync(tokenKillSwitchFile);
  }
  return res.json({ ok: true, data: { killSwitchOn: isTokenKillSwitchOn() } });
});

function inboxAuth(req, res, next) {
  if (!INBOX_TOKEN) return res.status(500).json({ ok: false, error: 'inbox_token_not_set' });
  const tok = String(req.headers['x-inbox-token'] || '');
  if (!tok || tok !== INBOX_TOKEN) return res.status(401).json({ ok: false, error: 'invalid_inbox_token' });
  return next();
}

function extractXUrl(text) {
  const t = String(text || '');
  const m = t.match(/https?:\/\/x\.com\/[^\s]+/i);
  return m ? m[0] : null;
}

async function extractXPostEvidence(url, runId) {
  const script = path.resolve(WORKSPACE_ROOT, 'scripts', 'x_tweet_extract.py');
  if (!fs.existsSync(script)) return null;

  const outPath = path.resolve('C:\\tmp', `x-tweet-extract_${String(runId || 'run')}.json`);

  try {
    await execFileAsync('python', [script, String(url), outPath], { timeout: 60_000, windowsHide: true });
    const raw = fs.readFileSync(outPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { outPath, data: parsed };
  } catch {
    return null;
  }
}

function formatXEvidence(e) {
  const d = e?.data || {};
  const lines = [];
  if (d.url_norm) lines.push(`URL limpo: ${d.url_norm}`);
  if (d.author || d.handle) lines.push(`Autor: ${[d.author, d.handle].filter(Boolean).join(' ')}`);
  if (d.text) lines.push(`Texto: ${d.text}`);
  if (Array.isArray(d.images) && d.images.length) lines.push(`Imagens: ${d.images.join(' ')}`);
  if (d.has_video) lines.push('VÃ­deo: sim');
  return lines.join('\n');
}

function pickAgentsFromText(text) {
  const t = String(text || '').toLowerCase();
  const agents = [];

  // 1) Preferir regras declarativas do agents-core (etapa 3)
  const rulesCfg = readJsonSafe(coreRoutingRulesFile, null);
  const rules = Array.isArray(rulesCfg?.rules) ? rulesCfg.rules : [];
  for (const r of rules) {
    const when = String(r?.when || '').trim();
    const assign = Array.isArray(r?.assign) ? r.assign : [];
    if (!when || !assign.length) continue;
    try {
      const re = new RegExp(when, 'i');
      if (!re.test(t)) continue;
      for (const a of assign) agents.push(resolveAgentIdFromText(String(a)) || mapCoreAgentToRuntime(String(a)));
    } catch {
      // regra invÃ¡lida: ignora
    }
  }

  // 2) Fallback heurÃ­stico
  if (/(pesquisa|analisar|refer[eÃª]ncia|link|x\.com|twitter|trend|benchmark|comparar|reddit|github|intel|artigo)/.test(t)) agents.push('ironman');
  if (/(tweet|thread|post no x|twitter post|social|tend[Ãªe]ncia)/.test(t)) agents.push('blackwidow');
  if (/(arquitetura|design|trade[- ]?off|decis[aÃ£]o t[eÃ©]cnica)/.test(t)) agents.push('shuri');
  if (/(implementar|codar|endpoint|server|react|vite|build|typescript|tsc|api|backend|frontend|gateway|infra|bug|fix)/.test(t)) agents.push('thor');
  if (/(qa|teste|validar|quality)/.test(t)) agents.push('hulk');
  if (/(newsletter|resumo semanal|digest|boletim|documentar|sop|handoff)/.test(t)) agents.push('pepper');
  if (/(monitoramento|m[Ã©e]trica|health|alerta|incidente)/.test(t)) agents.push('hawkeye');
  if (/(autom[aÃ£]c[aÃ£]o|workflow|rotina|script)/.test(t)) agents.push('wanda');

  // 3) defaults do routing-rules
  const defaults = Array.isArray(rulesCfg?.default) ? rulesCfg.default : [];
  if (agents.length === 0 && defaults.length) {
    for (const a of defaults) agents.push(resolveAgentIdFromText(String(a)) || mapCoreAgentToRuntime(String(a)));
  }

  // 4) Fallback final + orquestrador
  if (agents.length === 0) agents.push(DEFAULT_AGENT_ID);
  if (!agents.includes('ragha')) agents.push('ragha');

  return Array.from(new Set(agents));
}

function classifyRisk(text) {
  const t = String(text || '').toLowerCase();

  // Risk B: restricted â€” only destructive/credentials/production-impact patterns.
  const highPatterns = [
    /\b(apagar|deletar|excluir|remover|destroy|wipe|formatar|resetar|truncate|drop database)\b/,
    /\b(token|api key|apikey|senha|password|secret|credencial|chave privada|private key)\b/,
    /\b(produ[cÃ§][aÃ£]o|prod|deploy|publicar|push to main|migrar banco|migration)\b/,
    /\b(rm\s+-rf|del\s+\/s|format\s+[a-z]:|reg\s+delete)\b/,
  ];

  if (highPatterns.some((re) => re.test(t))) return 'high';
  return 'low';
}

function parseTelegramCallback(text) {
  const raw = String(text || '').trim();
  const m1 = raw.match(/^callback_data:\s*(approve|approve_high|adjust|cancel):(.+)$/i);
  if (m1) return { action: m1[1].toLowerCase(), taskId: m1[2].trim() };
  const m2 = raw.match(/^(approve|approve_high|adjust|cancel):(.+)$/i);
  if (m2) return { action: m2[1].toLowerCase(), taskId: m2[2].trim() };
  return null;
}

function parseTaskAdjustment(text) {
  const raw = String(text || '').trim();
  const m = raw.match(/^adjust:(task_[a-z0-9]+)\s+([\s\S]+)$/i);
  if (!m) return null;
  return { taskId: m[1], newText: m[2].trim() };
}

// Telegram -> Mission Control (Task: ... -> draft -> approve/adjust/cancel)
app.post('/api/inbox/telegram', inboxAuth, async (req, res) => {
  const { chatId, messageId, text } = req.body || {};
  if (!chatId || !text) return res.status(400).json({ ok: false, error: 'missing_fields' });

  const chat = String(chatId);
  const rawText = String(text || '').trim();

  // 0) Agent conversation mode commands
  const enterMode = rawText.match(/^entrar\s+modo\s+([a-z0-9_-]+)$/i);
  if (enterMode) {
    const agentId = resolveAgentIdFromText(enterMode[1]);
    if (!agentId) {
      await notifyTelegram('Agente invÃ¡lido. Use: Ragha, ironman, fury, shuri, thor, hulk, pepper, blackwidow, hawkeye, wanda.');
      return res.json({ ok: true, action: 'mode_invalid' });
    }
    setChatAgentMode(chat, agentId);
    await notifyTelegram(`Modo agente ativo: ${agentLabel(agentId)}.\nTudo que vocÃª mandar agora vai para esse agente atÃ© "Sair modo agente".`);
    return res.json({ ok: true, action: 'mode_enter', agentId });
  }

  if (/^sair\s+modo\s+agente$/i.test(rawText)) {
    clearChatAgentMode(chat);
    await notifyTelegram('Modo agente desativado.');
    return res.json({ ok: true, action: 'mode_exit' });
  }

  // 1) Inline button callbacks from Telegram arrive as text.
  const cb = parseTelegramCallback(rawText);
  if (cb?.taskId) {
    // Prefer drafts (not yet in the site) then fallback to existing tasks.
    const drafts = listInboxDrafts();
    const draft = drafts.find((d) => d.id === cb.taskId);

    if (draft) {
      if (cb.action === 'cancel') {
        saveInboxDrafts(drafts.filter((d) => d.id !== draft.id));
        await notifyTelegram(`Cancelar: ok. NÃ£o enviei para o site.\nID: ${draft.id}`);
        return res.json({ ok: true, action: 'cancel', draftId: draft.id });
      }

      if (cb.action === 'adjust') {
        draft.status = 'awaiting_adjustment';
        draft.updatedAt = new Date().toISOString();
        saveInboxDrafts(drafts);
        await notifyTelegram(`Ajustar: manda o ajuste em texto livre agora (uma Ãºnica mensagem).\nID: ${draft.id}`);
        return res.json({ ok: true, action: 'adjust', draftId: draft.id });
      }

      if (cb.action === 'approve' || cb.action === 'approve_high') {
        const risk = draft.risk || classifyRisk(draft.title);

        // High risk requires double confirmation.
        if (risk === 'high' && cb.action !== 'approve_high') {
          draft.status = 'awaiting_high_risk_confirmation';
          draft.risk = 'high';
          draft.updatedAt = new Date().toISOString();
          saveInboxDrafts(drafts);
          await sendTelegramHighRiskConfirmPrompt(chat, draft);
          return res.json({ ok: true, action: 'awaiting_high_risk_confirmation', draftId: draft.id });
        }

        // Move draft -> task (now it reaches the site)
        const tasks = listTasks();
        const now = new Date().toISOString();
        const task = {
          id: draft.id,
          title: String(draft.title).slice(0, 200),
          description: '',
          priority: 'medium',
          status: 'backlog',
          createdAt: draft.createdAt || now,
          updatedAt: now,
          source: 'telegram',
          approved: true,
          risk,
          chatId: chat,
          sourceMessageId: messageId ? String(messageId) : undefined,
        };
        tasks.unshift(task);
        saveTasks(tasks);

        // Remove draft
        saveInboxDrafts(drafts.filter((d) => d.id !== draft.id));

        const plan = draft.plan || makeQuickPlan(task.title);
        const agentIds = Array.isArray(plan.agentIds) && plan.agentIds.length ? plan.agentIds : pickAgentsFromText(task.title);

        await notifyTelegram(`Aprovado. Enviando pro site e delegando.\nTask: ${task.title}`);
        await notifyTelegram(`Deleguei a task para: ${agentIds.map(agentLabel).join(' â†’ ')}`);

        // Create runs
        const runs = listRuns();
        const now2 = new Date().toISOString();
        const createdRuns = [];
        for (const agentId of [...agentIds].reverse()) {
          const run = {
            id: uid('run'),
            taskId: task.id,
            taskTitle: task.title,
            agentId: String(agentId),
            agentName: String(agentId).charAt(0).toUpperCase() + String(agentId).slice(1),
            model: getAgentModel(agentId),
            status: 'queued',
            priority: task.priority || 'medium',
            queuedAt: now2,
            lastUpdateAt: now2,
            summary: task.description || '',
            logs: [],
            outputs: [],
            attempt: 1,
            retryCount: 0,
          };
          runs.unshift(run);
          createdRuns.push(run);
          appendRunEvent(run.id, { type: 'created', taskId: task.id, agentId, from: 'telegram-approve' });
        }
        saveRuns(runs);
        await tryStartQueuedRuns();

        return res.json({ ok: true, action: cb.action, taskId: task.id, runs: createdRuns });
      }

      return res.status(400).json({ ok: false, error: 'unknown_callback_action' });
    }

    // Fallback: existing task callbacks (legacy)
    const tasks = listTasks();
    const task = tasks.find((t) => t.id === cb.taskId);
    if (!task) {
      await notifyTelegram(`Esse ID nÃ£o existe mais (provÃ¡vel draft expirado/cancelado). Envie a Task: novamente.`);
      return res.status(404).json({ ok: false, error: 'task_not_found' });
    }

    const taskRuns = listRuns().filter((r) => String(r.taskId) === String(task.id));
    const activeRun = taskRuns.find((r) => ['queued', 'running', 'stopping', 'waiting', 'review'].includes(String(r.status || '')));

    if (cb.action === 'cancel') {
      if (activeRun) {
        const runs = listRuns();
        const ridx = runs.findIndex((r) => String(r.id) === String(activeRun.id));
        if (ridx !== -1) {
          runs[ridx] = { ...runs[ridx], status: 'stopped', endedAt: new Date().toISOString(), lastUpdateAt: new Date().toISOString() };
          saveRuns(runs);
          appendRunEvent(activeRun.id, { type: 'workflow_action', action: 'cancel', from: activeRun.status, to: 'stopped', actor: 'telegram' });
        }
      }
      task.status = 'cancelled';
      task.updatedAt = new Date().toISOString();
      saveTasks(tasks);
      await notifyTelegram(`Cancelado: ${task.id}`);
      return res.json({ ok: true, action: 'cancel', taskId: task.id });
    }

    if (cb.action === 'adjust') {
      task.status = 'awaiting_adjustment';
      task.updatedAt = new Date().toISOString();
      saveTasks(tasks);
      await notifyTelegram(`Ajustar: mande o ajuste em texto livre agora.\nID: ${task.id}`);
      return res.json({ ok: true, action: 'adjust', taskId: task.id });
    }

    if (cb.action === 'approve') {
      task.approved = true;
      task.status = 'backlog';
      task.updatedAt = new Date().toISOString();
      saveTasks(tasks);
      if (activeRun) {
        const runs = listRuns();
        const ridx = runs.findIndex((r) => String(r.id) === String(activeRun.id));
        if (ridx !== -1 && String(runs[ridx].status) === 'queued') {
          runs[ridx] = { ...runs[ridx], status: 'running', lastUpdateAt: new Date().toISOString() };
          saveRuns(runs);
          appendRunEvent(activeRun.id, { type: 'workflow_action', action: 'approve', from: 'queued', to: 'running', actor: 'telegram' });
        }
      }
      await notifyTelegram(`Aprovado: ${task.id}`);
      return res.json({ ok: true, action: 'approve', taskId: task.id });
    }

    return res.status(400).json({ ok: false, error: 'unknown_callback_action' });
  }

  // 2) If user previously clicked "Ajustar", next free-text message becomes the new title.
  const drafts = listInboxDrafts();
  const pending = drafts.find((d) => d.chatId === chat && d.status === 'awaiting_adjustment');
  if (pending) {
    const adjusted = normalizeTaskPrefix(rawText) || rawText;
    pending.title = String(adjusted).slice(0, 200);
    pending.plan = makeQuickPlan(pending.title);
    pending.risk = classifyRisk(pending.title);
    pending.status = 'awaiting_approval';
    pending.updatedAt = new Date().toISOString();
    saveInboxDrafts(drafts);
    await sendTelegramTaskDraftPrompt(chat, pending);
    return res.json({ ok: true, action: 'draft_adjusted', id: pending.id });
  }

  // 3) Conversation vs Task
  const normalized = normalizeTaskPrefix(rawText);

  // 3.1) Direct agent-targeted one-shot: "ironman: ..."
  const directAgent = rawText.match(/^([a-z0-9_-]+)\s*:\s*([\s\S]+)$/i);
  if (!normalized && directAgent) {
    const forcedAgentId = resolveAgentIdFromText(directAgent[1]);
    const ask = String(directAgent[2] || '').trim();
    if (forcedAgentId && ask) {
      const tasks = listTasks();
      const now = new Date().toISOString();
      const task = {
        id: uid('task'),
        title: String(ask).slice(0, 200),
        description: '',
        priority: 'medium',
        status: 'backlog',
        createdAt: now,
        updatedAt: now,
        source: 'telegram-agent-target',
        approved: true,
        chatId: chat,
        sourceMessageId: messageId ? String(messageId) : undefined,
      };
      tasks.unshift(task);
      saveTasks(tasks);

      const runs = listRuns();
      const run = {
        id: uid('run'),
        taskId: task.id,
        taskTitle: task.title,
        agentId: String(forcedAgentId),
        agentName: String(forcedAgentId).charAt(0).toUpperCase() + String(forcedAgentId).slice(1),
        model: getAgentModel(forcedAgentId),
        status: 'queued',
        priority: task.priority || 'medium',
        queuedAt: now,
        lastUpdateAt: now,
        summary: '',
        logs: [],
        outputs: [],
        attempt: 1,
        retryCount: 0,
      };
      runs.unshift(run);
      saveRuns(runs);
      appendRunEvent(run.id, { type: 'created', taskId: task.id, agentId: forcedAgentId, from: 'telegram-agent-target' });
      await notifyTelegram(`Delegado para ${agentLabel(forcedAgentId)}.`);
      await tryStartQueuedRuns();
      return res.json({ ok: true, action: 'direct_agent', taskId: task.id, runId: run.id, agentId: forcedAgentId });
    }
  }

  // 3.2) Conversation mode relay: if mode active, route any free text to selected agent
  if (!normalized) {
    const mode = getChatAgentMode(chat);
    if (mode?.agentId && rawText) {
      const forcedAgentId = String(mode.agentId);
      const tasks = listTasks();
      const now = new Date().toISOString();
      const task = {
        id: uid('task'),
        title: String(rawText).slice(0, 200),
        description: '',
        priority: 'medium',
        status: 'backlog',
        createdAt: now,
        updatedAt: now,
        source: 'telegram-agent-mode',
        approved: true,
        chatId: chat,
        sourceMessageId: messageId ? String(messageId) : undefined,
      };
      tasks.unshift(task);
      saveTasks(tasks);

      const runs = listRuns();
      const run = {
        id: uid('run'),
        taskId: task.id,
        taskTitle: task.title,
        agentId: forcedAgentId,
        agentName: String(forcedAgentId).charAt(0).toUpperCase() + String(forcedAgentId).slice(1),
        model: getAgentModel(forcedAgentId),
        status: 'queued',
        priority: task.priority || 'medium',
        queuedAt: now,
        lastUpdateAt: now,
        summary: '',
        logs: [],
        outputs: [],
        attempt: 1,
        retryCount: 0,
      };
      runs.unshift(run);
      saveRuns(runs);
      appendRunEvent(run.id, { type: 'created', taskId: task.id, agentId: forcedAgentId, from: 'telegram-agent-mode' });
      await tryStartQueuedRuns();
      return res.json({ ok: true, action: 'mode_routed', taskId: task.id, runId: run.id, agentId: forcedAgentId });
    }

    // Conversation without task/mode: ignore.
    return res.json({ ok: true, ignored: true });
  }

  // 4) Create draft ONLY (does not hit the site until approved)
  const now = new Date().toISOString();
  const draft = {
    id: uid('task'),
    chatId: chat,
    sourceMessageId: messageId ? String(messageId) : undefined,
    title: String(normalized).slice(0, 200),
    risk: classifyRisk(normalized),
    status: 'awaiting_approval',
    createdAt: now,
    updatedAt: now,
    plan: makeQuickPlan(normalized),
  };
  drafts.unshift(draft);
  saveInboxDrafts(drafts.slice(0, 200));

  await sendTelegramTaskDraftPrompt(chat, draft);
  return res.json({ ok: true, draftId: draft.id, awaiting: 'approval' });
});

// Approve/Cancel a telegram-created task (and optionally start a run)
app.post('/api/inbox/tasks/:id/approve', inboxAuth, async (req, res) => {
  const id = req.params.id;
  const { approved = true, agentId = DEFAULT_AGENT_ID } = req.body || {};

  const tasks = listTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

  const now = new Date().toISOString();
  tasks[idx] = {
    ...tasks[idx],
    approved: Boolean(approved),
    status: approved ? 'backlog' : 'cancelled',
    updatedAt: now,
  };
  saveTasks(tasks);

  if (approved) {
    await notifyTelegram(`Task aprovada no Telegram: ${tasks[idx].title}`);
    const runs = listRuns();
    const now2 = new Date().toISOString();
    const task = tasks[idx];
    const run = {
      id: uid('run'),
      taskId: task.id,
      taskTitle: task.title,
      agentId: String(agentId),
      agentName: String(agentId).charAt(0).toUpperCase() + String(agentId).slice(1),
      model: getAgentModel(agentId),
      status: 'queued',
      priority: task.priority || 'medium',
      queuedAt: now2,
      lastUpdateAt: now2,
      summary: task.description || '',
      logs: [],
      outputs: [],
      attempt: 1,
      retryCount: 0,
    };
    runs.unshift(run);
    saveRuns(runs);
    appendRunEvent(run.id, { type: 'created', taskId: task.id, agentId, from: 'telegram' });
    await tryStartQueuedRuns();
  }

  res.json({ ok: true, data: tasks[idx] });
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  const { title, description = '', priority = 'medium', source = 'ui', autoRun } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: 'missing_title' });

  const tasks = listTasks();
  const now = new Date().toISOString();
  const task = {
    id: uid('task'),
    title: String(title).slice(0, 200),
    description: String(description || '').slice(0, 4000),
    priority,
    status: 'backlog',
    createdAt: now,
    updatedAt: now,
    source: String(source || 'ui'),
    approved: source === 'telegram' ? false : true,
  };
  tasks.unshift(task);
  saveTasks(tasks);

  // Auto-run for UI-created tasks (respects WIP via /api/runs)
  const shouldAutoRun = source !== 'telegram' && (autoRun === true || autoRun === undefined);
  if (shouldAutoRun) {
    try {
      const runs = listRuns();
      const now2 = new Date().toISOString();
      const run = {
        id: uid('run'),
        taskId: task.id,
        taskTitle: task.title,
        agentId: DEFAULT_AGENT_ID,
        agentName: String(DEFAULT_AGENT_ID).charAt(0).toUpperCase() + String(DEFAULT_AGENT_ID).slice(1),
        model: getAgentModel(DEFAULT_AGENT_ID),
        status: 'queued',
        priority: task.priority || 'medium',
        queuedAt: now2,
        lastUpdateAt: now2,
        summary: task.description || '',
        logs: [],
        outputs: [],
        attempt: 1,
        retryCount: 0,
      };
      runs.unshift(run);
      saveRuns(runs);
      appendRunEvent(run.id, { type: 'created', taskId: task.id, agentId: DEFAULT_AGENT_ID, auto: true });
      await notifyTelegram(`Task criada no painel: ${task.title}\nRun enfileirada: ${run.id}`);
      await tryStartQueuedRuns();
    } catch (err) {
      // keep task created even if run spawn fails
    }
  }

  res.json({ ok: true, data: task });
});

app.post('/api/pipeline/intake', authMiddleware, async (req, res) => {
  const { title, description = '', source = 'ui', priority } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: 'missing_title' });

  const risk = classifyRisk(title);
  const plan = makeQuickPlan(title);
  const chosenPriority = priority || (risk === 'high' ? 'critical' : 'medium');

  const tasks = listTasks();
  const now = new Date().toISOString();
  const task = {
    id: uid('task'),
    title: String(title).slice(0, 200),
    description: String(description || '').slice(0, 4000),
    priority: chosenPriority,
    status: 'backlog',
    createdAt: now,
    updatedAt: now,
    source: String(source || 'ui'),
    approved: true,
    risk,
    routePlan: plan,
  };
  tasks.unshift(task);
  saveTasks(tasks);

  const agentIds = Array.from(new Set(Array.isArray(plan.agentIds) ? plan.agentIds : [DEFAULT_AGENT_ID])).slice(0, 4);
  const runs = listRuns();
  const queued = [];
  for (const agentId of agentIds) {
    const run = {
      id: uid('run'),
      taskId: task.id,
      taskTitle: task.title,
      agentId: String(agentId),
      agentName: String(agentId).charAt(0).toUpperCase() + String(agentId).slice(1),
      model: getAgentModel(agentId),
      status: 'queued',
      priority: task.priority || 'medium',
      queuedAt: now,
      lastUpdateAt: now,
      summary: task.description || '',
      logs: [],
      outputs: [],
      attempt: 1,
      retryCount: 0,
    };
    runs.unshift(run);
    appendRunEvent(run.id, { type: 'created', taskId: task.id, agentId: String(agentId), from: 'pipeline-intake' });
    queued.push(run);
  }
  saveRuns(runs);

  await tryStartQueuedRuns();

  return res.json({ ok: true, data: { task, risk, plan, queuedRuns: queued } });
});

app.patch('/api/tasks/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const patch = req.body || {};
  const tasks = listTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

  const now = new Date().toISOString();
  tasks[idx] = {
    ...tasks[idx],
    ...('title' in patch ? { title: String(patch.title || '').slice(0, 200) } : {}),
    ...('description' in patch ? { description: String(patch.description || '').slice(0, 4000) } : {}),
    ...('priority' in patch ? { priority: patch.priority } : {}),
    ...('status' in patch ? { status: patch.status } : {}),
    updatedAt: now,
  };
  saveTasks(tasks);
  res.json({ ok: true, data: tasks[idx] });
});

app.post('/api/tasks/:id/start', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const tasks = listTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ ok: false, error: 'task_not_found' });

  const runs = listRuns();
  const existing = runs.find((r) => r.taskId === id && ACTIVE_RUN_STATUSES.includes(String(r.status || '')));
  if (existing) return res.json({ ok: true, data: existing, dedup: true });

  const now = new Date().toISOString();
  const run = {
    id: uid('run'),
    taskId: task.id,
    taskTitle: task.title,
    agentId: DEFAULT_AGENT_ID,
    agentName: String(DEFAULT_AGENT_ID).charAt(0).toUpperCase() + String(DEFAULT_AGENT_ID).slice(1),
    model: getAgentModel(DEFAULT_AGENT_ID),
    status: 'queued',
    priority: task.priority || 'medium',
    queuedAt: now,
    lastUpdateAt: now,
    summary: task.description || '',
    logs: [],
    outputs: [],
    attempt: 1,
    retryCount: 0,
  };

  runs.unshift(run);
  saveRuns(runs);
  appendRunEvent(run.id, { type: 'created', taskId: task.id, agentId: DEFAULT_AGENT_ID, from: 'task-start' });

  await notifyTelegram(`Task iniciada no painel: ${task.title}`);
  await tryStartQueuedRuns();

  const updated = listRuns().find((x) => x.id === run.id) || run;
  return res.json({ ok: true, data: updated });
});

function runningCount(runs) {
  return runs.filter((r) => r.status === 'running').length;
}

async function startRun(run) {
  // Update run status
  const runs = listRuns();
  const idx = runs.findIndex((x) => x.id === run.id);
  if (idx === -1) return;

  const now = new Date().toISOString();
  const attempt = Number(runs[idx]?.attempt || 1);
  runs[idx] = { ...runs[idx], status: 'running', startedAt: now, lastUpdateAt: now, nextRetryAt: undefined, lastError: undefined, attempt };
  saveRuns(runs);
  appendRunEvent(run.id, { type: 'status', status: 'running', attempt });

  const agentIdForRun = String(runs[idx].agentId || 'agent');

  // Feedback curtÃ­ssimo
  await notifyTelegram(`${agentLabel(agentIdForRun)} comeÃ§ou...`);

  // Auto-extract evidence for X links (so agents don't hallucinate)
  try {
    const xUrl = extractXUrl(runs[idx].taskTitle);
    if (xUrl) {
      const evidence = await extractXPostEvidence(xUrl, run.id);
      if (evidence?.data) {
        const runsE = listRuns();
        const idxE = runsE.findIndex((x) => x.id === run.id);
        if (idxE !== -1) {
          const prev = String(runsE[idxE].summary || '');
          const formatted = formatXEvidence(evidence);
          runsE[idxE] = {
            ...runsE[idxE],
            taskTitle: evidence.data.url_norm ? `${evidence.data.url_norm} â€” ${runsE[idxE].taskTitle}` : runsE[idxE].taskTitle,
            summary: [prev, formatted].filter(Boolean).join('\n\n'),
            lastUpdateAt: new Date().toISOString(),
          };
          saveRuns(runsE);
        }
      }
    }
  } catch {
    // ignore extraction errors
  }

  // MVP integration: spawn subagent via OpenClaw (best-effort)
  try {
    const agentTemplates = [
      { id: 'ragha', name: 'Ragha' },
      { id: 'ironman', name: 'IronMan' },
      { id: 'fury', name: 'Fury' },
      { id: 'shuri', name: 'Shuri' },
      { id: 'thor', name: 'Thor' },
      { id: 'hulk', name: 'Hulk' },
      { id: 'pepper', name: 'Pepper' },
      { id: 'blackwidow', name: 'BlackWidow' },
      { id: 'hawkeye', name: 'Hawkeye' },
      { id: 'wanda', name: 'Wanda' },
    ];

    const agent = agentTemplates.find((a) => a.id === runs[idx].agentId) || agentTemplates[0];

    const agentCfg = getAgentProfile(String(runs[idx].agentId)) || {};
    const allowedSkills = Array.isArray(agentCfg.skillsAllowed) ? agentCfg.skillsAllowed : [];
    const skillRefs = allowedSkills
      .map((s) => `- ${WORKSPACE_ROOT}\\skills\\${s}\\SKILL.md`)
      .join('\n');

    await notifyTelegram(`[${agent.id}] coletando conteÃºdo`);

    const taskText = `MissÃ£o\n\nTask: ${runs[idx].taskTitle}\n\nInstruÃ§Ãµes:\n- Assista/abra o post completo\n- Extraia o nÃºcleo da ideia\n- Gere um plano de aÃ§Ã£o com etapas definidas (P0/P1)\n- Entregue um briefing claro e acionÃ¡vel\n\nCONTRATO DE SAÃDA (obrigatÃ³rio):\n[ACHADOS]\n- 3 a 5 bullets objetivos\n[EVIDENCIAS]\n- links, trechos, sinais observÃ¡veis (sem inventar)\n[RESUMO]\n- 1 parÃ¡grafo final com conclusÃ£o prÃ¡tica\n\nContexto:\n${runs[idx].summary || ''}\n\nTwitter/X (stealth):\n- Perfil persistente jÃ¡ logado: C:\\tmp\\stealth-x-profile\n- Cookies exportados (se precisar): C:\\tmp\\x-cookies.json\n- NÃ£o peÃ§a senha.\n\nInstagram:\n- SessÃ£o pode estar logada no browser host\n- Se houver bloqueio/challenge, reportar claramente\n\nSkills permitidas para este agente (use APENAS estas; se vazio, nÃ£o use tools):\n${skillRefs || '(nenhuma)'}\n\nRegra anti-alucinaÃ§Ã£o:\n- Se vocÃª nÃ£o conseguir acessar o conteÃºdo/entrada, NÃƒO invente. Diga "nÃ£o consegui acessar" e peÃ§a o print/trecho.\n`;

    await notifyTelegram(`[${agent.id}] executando`);

    const result = await toolsInvoke('sessions_spawn', {
      task: taskText,
      label: `${agent.name}:${runs[idx].id}`,
      // NOTE: Do not pass agentId here unless it's explicitly allowlisted in Gateway.
      // Passing agentId currently yields: forbidden (allowed: none)
      model: getAgentModel(runs[idx].agentId),
      runTimeoutSeconds: 60 * 20,
      cleanup: 'keep',
    });

    // Store handle if provided
    const runs2 = listRuns();
    const idx2 = runs2.findIndex((x) => x.id === run.id);
    if (String(result?.status || '').toLowerCase() === 'error') {
      throw new Error(`spawn_failed: ${String(result?.error || 'unknown_error')}`);
    }

    const childKey = result?.childSessionKey || result?.sessionKey || result?.key || null;

    // If we can't get a child session key, treat as failure (otherwise run gets stuck in running)
    if (!childKey) {
      throw new Error('spawn_failed: no childSessionKey (pairing/policy)');
    }

    if (idx2 !== -1) {
      runs2[idx2] = { ...runs2[idx2], sessionKey: childKey || runs2[idx2].sessionKey, lastUpdateAt: new Date().toISOString() };
      saveRuns(runs2);
    }

    appendRunEvent(run.id, { type: 'spawn', result: { sessionKey: childKey } });
    await notifyTelegram(`${agentLabel(agent.id)} comeÃ§ou a executar...`);
  } catch (err) {
    const errorText = String(err?.message || err);
    appendRunEvent(run.id, { type: 'spawn_error', error: errorText });

    const runsErr = listRuns();
    const idxErr = runsErr.findIndex((x) => x.id === run.id);
    if (idxErr !== -1) {
      const nowErr = new Date().toISOString();
      const currentRetry = Number(runsErr[idxErr].retryCount || 0);
      const nonRetryable = /Tool not available: sessions_spawn|status=404|status=401|unauthorized|tool not available/i.test(errorText);
      const canRetry = !nonRetryable && currentRetry < AUTO_RETRY_MAX;

      if (canRetry) {
        const nextRetryAt = new Date(Date.now() + AUTO_RETRY_DELAY_MS).toISOString();
        runsErr[idxErr] = {
          ...runsErr[idxErr],
          status: 'queued',
          endedAt: undefined,
          lastUpdateAt: nowErr,
          retryCount: currentRetry + 1,
          attempt: Number(runsErr[idxErr].attempt || 1) + 1,
          nextRetryAt,
          lastError: errorText,
        };
        saveRuns(runsErr);
        appendRunEvent(run.id, {
          type: 'retry_scheduled',
          retryCount: currentRetry + 1,
          max: AUTO_RETRY_MAX,
          nextRetryAt,
          error: errorText,
        });
        await notifyTelegram(`âš ï¸ ${agentLabel(runsErr[idxErr].agentId)} falhou. Retry ${currentRetry + 1}/${AUTO_RETRY_MAX} em ${Math.ceil(AUTO_RETRY_DELAY_MS / 1000)}s.`);
      } else {
        const authBlocked = /status=401|unauthorized/i.test(errorText);
        runsErr[idxErr] = {
          ...runsErr[idxErr],
          status: 'failed',
          endedAt: nowErr,
          lastUpdateAt: nowErr,
          lastError: errorText,
          failureKind: authBlocked ? 'blocked_auth' : (nonRetryable ? 'spawn_error_gateway_config' : 'spawn_error_runtime'),
        };
        saveRuns(runsErr);
        appendRunEvent(run.id, {
          type: 'status',
          status: 'failed',
          retryCount: currentRetry,
          max: AUTO_RETRY_MAX,
          failureKind: nonRetryable ? 'gateway_config' : 'runtime',
        });
        await notifyTelegram(`âŒ Run falhou ao spawnar subagente: ${run.id}\nErro: ${errorText}`);
      }
    }

    await tryStartQueuedRuns();
  }
}

async function tryStartQueuedRuns() {
  if (!gatewayAuthReady) return;
  const runs = listRuns();
  const slots = Math.max(0, WIP_LIMIT - runningCount(runs));
  if (slots <= 0) return;

  const nowTs = Date.now();
  const queued = runs
    .filter((r) => {
      if (r.status !== 'queued') return false;
      if (!r.nextRetryAt) return true;
      const t = Date.parse(String(r.nextRetryAt));
      return Number.isFinite(t) ? t <= nowTs : true;
    })
    .sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt)));

  for (const r of queued.slice(0, slots)) {
    const guard = evaluateRunTokenGuard(r);
    if (!guard.ok) {
      const runs2 = listRuns();
      const idx = runs2.findIndex((x) => x.id === r.id);
      if (idx !== -1) {
        const now = new Date().toISOString();
        runs2[idx] = {
          ...runs2[idx],
          status: 'failed',
          endedAt: now,
          lastUpdateAt: now,
          failureKind: guard.kind === 'kill_switch' ? 'blocked_kill_switch' : 'blocked_budget',
          lastError: String(guard.detail || 'token_guard_blocked'),
        };
        saveRuns(runs2);
        appendRunEvent(r.id, { type: 'token_guard_blocked', reason: guard.detail || guard.kind });
      }
      continue;
    }

    await startRun(r);
  }
}

app.get('/api/runs', authMiddleware, (req, res) => {
  const runs = listRuns();
  res.json({ ok: true, data: runs });
});

app.post('/api/runs', authMiddleware, async (req, res) => {
  const { taskId, agentId } = req.body || {};
  if (!taskId || !agentId) return res.status(400).json({ ok: false, error: 'missing_fields' });

  const tasks = listTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return res.status(404).json({ ok: false, error: 'task_not_found' });

  const runs = listRuns();
  const now = new Date().toISOString();

  const run = {
    id: uid('run'),
    taskId: task.id,
    taskTitle: task.title,
    agentId: String(agentId),
    agentName: String(agentId).charAt(0).toUpperCase() + String(agentId).slice(1),
    model: getAgentModel(agentId),
    status: 'queued',
    priority: task.priority || 'medium',
    queuedAt: now,
    lastUpdateAt: now,
    summary: task.description || '',
    logs: [],
    outputs: [],
    attempt: 1,
    retryCount: 0,
  };

  runs.unshift(run);
  saveRuns(runs);
  appendRunEvent(run.id, { type: 'created', taskId: task.id, agentId });

  // Auto-queue with WIP limit
  await tryStartQueuedRuns();

  const updatedRuns = listRuns();
  const updated = updatedRuns.find((x) => x.id === run.id) || run;
  res.json({ ok: true, data: updated });
});

app.get('/api/runs/:id/thread', authMiddleware, async (req, res) => {
  const id = String(req.params.id || '');
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 80)));

  const run = listRuns().find((r) => String(r.id) === id);
  if (!run) return res.status(404).json({ ok: false, error: 'not_found' });
  if (!run.sessionKey) return res.json({ ok: true, data: [] });

  try {
    const hist = await toolsInvoke('sessions_history', { sessionKey: run.sessionKey, limit, includeTools: true });
    const msgs = Array.isArray(hist) ? hist : hist?.messages || [];
    const mapped = msgs.map((m) => ({
      role: m?.role || m?.type || 'unknown',
      content: typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content || ''),
      at: m?.at || m?.createdAt || null,
    }));
    return res.json({ ok: true, data: mapped });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'thread_failed', detail: String(err?.message || err) });
  }
});

// Etapa 5: thread auditÃ¡vel por task (eventos + notas + evidÃªncias)
app.get('/api/tasks/:id/thread', authMiddleware, (req, res) => {
  const taskId = String(req.params.id || '');
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)));

  const task = listTasks().find((t) => String(t.id) === taskId);
  if (!task) return res.status(404).json({ ok: false, error: 'task_not_found' });

  const runs = listRuns().filter((r) => String(r.taskId) === taskId);
  const runIds = new Set(runs.map((r) => String(r.id)));

  const runEvents = listRunEvents()
    .filter((e) => runIds.has(String(e?.runId || '')))
    .map((e) => {
      const run = runs.find((r) => String(r.id) === String(e.runId));
      return {
        at: Number(e?.at || Date.now()),
        source: 'run_event',
        taskId,
        runId: String(e?.runId || ''),
        agentId: run?.agentId || null,
        type: String(e?.type || 'event'),
        text: e?.error ? String(e.error) : (e?.type ? `run:${e.type}` : 'run:event'),
        evidence: {
          result: e?.result || null,
          retryCount: e?.retryCount || null,
          nextRetryAt: e?.nextRetryAt || null,
        },
      };
    });

  const taskNotes = listCardNotes()
    .filter((n) => String(n?.entityType) === 'task' && String(n?.entityId) === taskId)
    .map((n) => ({
      at: Number(n?.at || Date.now()),
      source: 'note_task',
      taskId,
      runId: null,
      agentId: String(n?.author || 'system'),
      type: String(n?.kind || 'comment'),
      text: String(n?.text || ''),
      evidence: null,
    }));

  const runNotes = listCardNotes()
    .filter((n) => String(n?.entityType) === 'run' && runIds.has(String(n?.entityId || '')))
    .map((n) => {
      const run = runs.find((r) => String(r.id) === String(n?.entityId || ''));
      return {
        at: Number(n?.at || Date.now()),
        source: 'note_run',
        taskId,
        runId: String(n?.entityId || ''),
        agentId: run?.agentId || String(n?.author || 'system'),
        type: String(n?.kind || 'comment'),
        text: String(n?.text || ''),
        evidence: null,
      };
    });

  const runSnapshots = runs.map((r) => ({
    at: Date.parse(String(r.lastUpdateAt || r.endedAt || r.startedAt || r.queuedAt || new Date().toISOString())),
    source: 'run_snapshot',
    taskId,
    runId: String(r.id),
    agentId: String(r.agentId || ''),
    type: 'status',
    text: `status=${String(r.status || '')} attempt=${Number(r.attempt || 0)} retry=${Number(r.retryCount || 0)}`,
    evidence: {
      sessionKey: r.sessionKey || null,
      failureKind: r.failureKind || null,
      lastError: r.lastError || null,
      outputs: Array.isArray(r.outputs) ? r.outputs.length : 0,
    },
  }));

  const thread = [...runEvents, ...taskNotes, ...runNotes, ...runSnapshots]
    .sort((a, b) => Number(a.at || 0) - Number(b.at || 0))
    .slice(-limit);

  return res.json({ ok: true, data: { taskId, total: thread.length, thread } });
});

app.post('/api/runs/:id/stop', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const runs = listRuns();
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

  const sessionKey = runs[idx]?.sessionKey || null;
  appendRunEvent(id, { type: 'stop_requested', sessionKey: sessionKey || undefined });

  const now = new Date().toISOString();

  // If there's a live worker session, mark as "stopping" and send cooperative cancel signal.
  if (sessionKey) {
    runs[idx] = { ...runs[idx], status: 'stopping', stopRequestedAt: now, lastUpdateAt: now };
    saveRuns(runs);
    appendRunEvent(id, { type: 'status', status: 'stopping' });
    await notifyTelegram(`Run parando: ${id}`);

    try {
      await toolsInvoke('sessions_send', {
        sessionKey,
        message:
          'CANCELAMENTO SOLICITADO PELO HUMANO. Pare agora. Se tiver subagents, mate todos ("/subagents kill all"). Responda apenas com STATUS: cancelled e encerre.',
      });
      appendRunEvent(id, { type: 'stop_signal_sent', sessionKey });
    } catch (err) {
      appendRunEvent(id, { type: 'stop_signal_error', sessionKey, error: String(err?.message || err) });
    }

    // Do NOT mark stopped yet; poller will confirm session ended.
    await tryStartQueuedRuns();
    return res.json({ ok: true });
  }

  // No session key yet: stop immediately.
  runs[idx] = { ...runs[idx], status: 'stopped', endedAt: now, lastUpdateAt: now };
  saveRuns(runs);
  appendRunEvent(id, { type: 'stopped' });
  await notifyTelegram(`Run parada: ${id}`);

  await tryStartQueuedRuns();
  res.json({ ok: true });
});

app.post('/api/runs/:id/stopall', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const runs = listRuns();
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

  const sessionKey = runs[idx]?.sessionKey || null;
  appendRunEvent(id, { type: 'stopall_requested', sessionKey: sessionKey || undefined });

  const now = new Date().toISOString();

  if (sessionKey) {
    runs[idx] = { ...runs[idx], status: 'stopping', stopRequestedAt: now, lastUpdateAt: now };
    saveRuns(runs);
    appendRunEvent(id, { type: 'status', status: 'stopping' });
    await notifyTelegram(`Run parando (tudo): ${id}`);

    try {
      await toolsInvoke('sessions_send', {
        sessionKey,
        message:
          'CANCELAMENTO TOTAL SOLICITADO PELO HUMANO. Mate TODOS os subagents agora ("/subagents kill all") e encerre imediatamente. Responda apenas com STATUS: cancelled e encerre.',
      });
      appendRunEvent(id, { type: 'stopall_signal_sent', sessionKey });
    } catch (err) {
      appendRunEvent(id, { type: 'stopall_signal_error', sessionKey, error: String(err?.message || err) });
    }

    await tryStartQueuedRuns();
    return res.json({ ok: true });
  }

  runs[idx] = { ...runs[idx], status: 'stopped', endedAt: now, lastUpdateAt: now };
  saveRuns(runs);
  appendRunEvent(id, { type: 'stopped' });
  await notifyTelegram(`Run parada: ${id}`);

  await tryStartQueuedRuns();
  res.json({ ok: true });
});

app.post('/api/runs/:id/retry', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const runs = listRuns();
  const run = runs.find((r) => r.id === id);
  if (!run) return res.status(404).json({ ok: false, error: 'not_found' });

  const tasks = listTasks();
  const taskExists = tasks.some((t) => String(t.id) === String(run.taskId));
  if (!taskExists) {
    return res.status(409).json({ ok: false, error: 'orphan_run_task_missing', taskId: run.taskId });
  }

  // Dedup: if there's already an active run for same task+agent, don't create another card
  const existing = findActiveSiblingRun(runs, run.taskId, run.agentId, id);

  if (existing) {
    appendRunEvent(existing.id, { type: 'retry_dedup', of: run.id });
    return res.json({ ok: true, data: existing, dedup: true });
  }

  const now = new Date().toISOString();
  const clone = {
    ...run,
    id: uid('run'),
    status: 'queued',
    queuedAt: now,
    startedAt: undefined,
    endedAt: undefined,
    sessionKey: undefined,
    lastUpdateAt: now,
    attempt: Number(run.attempt || 1) + 1,
    retryCount: Number(run.retryCount || 0) + 1,
    nextRetryAt: undefined,
    lastError: undefined,
  };

  runs.unshift(clone);
  saveRuns(runs);
  appendRunEvent(clone.id, { type: 'retry_of', of: run.id });

  await tryStartQueuedRuns();
  const updated = listRuns().find((x) => x.id === clone.id) || clone;
  res.json({ ok: true, data: updated });
});

// Pause = stop cooperativo, mantendo semÃ¢ntica de produto para o Stage
app.post('/api/runs/:id/pause', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const runs = listRuns();
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

  const run = runs[idx];
  if (run.status !== 'running' && run.status !== 'queued' && run.status !== 'review' && run.status !== 'waiting') {
    return res.status(400).json({ ok: false, error: 'invalid_status_for_pause', status: run.status });
  }

  const sessionKey = run?.sessionKey || null;
  const now = new Date().toISOString();

  runs[idx] = { ...run, status: 'stopping', stopRequestedAt: now, lastUpdateAt: now };
  saveRuns(runs);
  appendRunEvent(id, { type: 'pause_requested', sessionKey: sessionKey || undefined });
  appendRunEvent(id, { type: 'status', status: 'stopping' });

  if (sessionKey) {
    try {
      await toolsInvoke('sessions_send', {
        sessionKey,
        message:
          'PAUSE SOLICITADO PELO HUMANO. Pare a execuÃ§Ã£o agora com seguranÃ§a e responda STATUS: paused.',
      });
      appendRunEvent(id, { type: 'pause_signal_sent', sessionKey });
    } catch (err) {
      appendRunEvent(id, { type: 'pause_signal_error', sessionKey, error: String(err?.message || err) });
    }
  }

  await notifyTelegram(`Run em pausa (solicitada): ${id}`);
  await tryStartQueuedRuns();
  return res.json({ ok: true });
});

app.post('/api/runs/:id/reassign', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const { agentId } = req.body || {};
  if (!agentId) return res.status(400).json({ ok: false, error: 'missing_agentId' });

  const runs = listRuns();
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' });

  const run = runs[idx];
  const terminal = ['done', 'failed', 'stopped'].includes(String(run.status));
  if (!terminal) {
    return res.status(400).json({ ok: false, error: 'reassign_requires_terminal_run', status: run.status });
  }

  const now = new Date().toISOString();
  const reassigned = {
    ...run,
    id: uid('run'),
    agentId: String(agentId),
    agentName: String(agentId).charAt(0).toUpperCase() + String(agentId).slice(1),
    model: getAgentModel(agentId),
    status: 'queued',
    queuedAt: now,
    startedAt: undefined,
    endedAt: undefined,
    stopRequestedAt: undefined,
    sessionKey: undefined,
    lastUpdateAt: now,
    attempt: 1,
    retryCount: 0,
    nextRetryAt: undefined,
    lastError: undefined,
  };

  runs.unshift(reassigned);
  saveRuns(runs);
  appendRunEvent(reassigned.id, { type: 'reassigned_from', fromRunId: run.id, fromAgentId: run.agentId, toAgentId: String(agentId) });

  await notifyTelegram(`Run reatribuÃ­da: ${run.id} -> ${reassigned.id} (${run.agentId} -> ${String(agentId)})`);
  await tryStartQueuedRuns();

  const updated = listRuns().find((x) => x.id === reassigned.id) || reassigned;
  return res.json({ ok: true, data: updated });
});

app.get('/api/memory', authMiddleware, async (req, res) => {
  try {
    const memoryDir = path.resolve(WORKSPACE_ROOT, 'memory');
    const memoryFile = path.resolve(WORKSPACE_ROOT, 'MEMORY.md');
    const daily = fs.existsSync(memoryDir)
      ? fs.readdirSync(memoryDir).filter((f) => f.endsWith('.md'))
      : [];

    const longTerm = fs.existsSync(memoryFile) ? fs.readFileSync(memoryFile, 'utf-8') : '';
    res.json({ ok: true, data: { daily, longTerm } });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'memory_failed', detail: String(err?.message || err) });
  }
});

// Anti-cache headers for index.html
app.use((req, res, next) => {
  if (req.path === '/index.html' || req.path === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// Static files
// IMPORTANT: We want rapid iteration on UI; disable caching for built assets too (Cloudflare can be aggressive).
app.use(
  '/assets',
  express.static(path.join(__dirname, 'dist', 'assets'), {
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    },
  }),
);
const distDir = path.join(__dirname, 'dist');
const distIndex = path.join(distDir, 'index.html');
app.use(express.static(distDir));

// SPA fallback - serve index.html for any non-file request
app.use((req, res, next) => {
  if (req.path.includes('.')) {
    return next();
  }

  if (!fs.existsSync(distIndex)) {
    return res.status(503).json({ ok: false, error: 'frontend_not_built', detail: 'dist/index.html ausente' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(distIndex);
});

// Background: poll spawned subagent sessions and close runs when they finish
const SUBAGENT_POLL_MS = Number(process.env.SUBAGENT_POLL_MS || 4000);
const STOP_TIMEOUT_MS = Number(process.env.STOP_TIMEOUT_MS || 60_000);
const AUTO_RETRY_MAX = Number(process.env.AUTO_RETRY_MAX || 2);
const AUTO_RETRY_DELAY_MS = Number(process.env.AUTO_RETRY_DELAY_MS || 15_000);

// "Enforcement" inside MC: audit tool usage after the fact (since we can't hard-block tools inside isolated subagent sessions from here).
const DEFAULT_SUBAGENT_TOOL_DENY = ['cron', 'gateway', 'nodes'];
const MIN_DONE_SUMMARY_CHARS = Number(process.env.MIN_DONE_SUMMARY_CHARS || 120);
const SEND_TASK_TELEGRAM_UPDATES = String(process.env.SEND_TASK_TELEGRAM_UPDATES || '0') === '1';

function estimateTokensFromText(text) {
  const s = String(text || '');
  return Math.max(0, Math.ceil(s.length / 4));
}

function hasMinimumSummary(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length >= MIN_DONE_SUMMARY_CHARS;
}

function requiresEvidenceForTask(taskTitle) {
  const t = String(taskTitle || '').toLowerCase();
  return /https?:\/\/(?:www\.)?(x\.com|twitter\.com|instagram\.com)\//.test(t);
}

function hasEvidenceForRun(run) {
  const summary = String(run?.summary || '').toLowerCase();
  const taskTitle = String(run?.taskTitle || '').toLowerCase();
  const outputs = Array.isArray(run?.outputs) ? run.outputs : [];
  const outputText = outputs.map((o) => String(o?.content || '')).join('\n').toLowerCase();

  const hasLinkSignal = /(x\.com|twitter\.com|instagram\.com|pbs\.twimg\.com|cdninstagram|reel|post)/.test(`${taskTitle}\n${summary}\n${outputText}`);
  const hasContentSignal = /(texto:|autor:|url limpo:|imagens:|vÃ­deo:|video:|caption|transcri)/.test(`${summary}\n${outputText}`);

  return hasLinkSignal && hasContentSignal;
}

function buildStandardTaskResult(summary, status, nextAction) {
  return `Resultado da Task: ${String(summary || '').trim()} Status: ${status}. PrÃ³xima aÃ§Ã£o: ${String(nextAction || 'seguir para prÃ³xima task').trim()}`;
}

function extractAssistantMaterialFromMessages(msgs) {
  const arr = Array.isArray(msgs) ? msgs : [];
  const parts = [];
  for (const m of arr) {
    if (String(m?.role || '') !== 'assistant') continue;
    const c = m?.content;
    if (typeof c === 'string' && c.trim()) parts.push(c.trim());
    if (Array.isArray(c)) {
      for (const x of c) {
        if (typeof x?.text === 'string' && x.text.trim()) parts.push(x.text.trim());
      }
    }
  }
  return parts.join('\n\n').trim();
}

function hasSocialEvidenceInText(text, taskTitle) {
  const blob = `${String(taskTitle || '')}\n${String(text || '')}`.toLowerCase();
  const hasLinkSignal = /(instagram\.com|x\.com|twitter\.com|reel|post)/.test(blob);
  const hasContentSignal = /(autor|caption|texto|imagens|vÃ­deo|video|likes|coment|officeoptout|clara|rag)/.test(blob);
  return hasLinkSignal && hasContentSignal;
}

async function gatewayPreflight() {
  try {
    const token = process.env.OPENCLAW_GATEWAY_TOKEN || GATEWAY_TOKEN || '';
    if (!token) throw new Error('missing_OPENCLAW_GATEWAY_TOKEN');

    await toolsInvoke('agents_list', {});
    await toolsInvoke('sessions_spawn', {
      task: 'smoke auth check',
      mode: 'run',
      cleanup: 'delete',
      runTimeoutSeconds: 90,
    });

    gatewayAuthReady = true;
    gatewayAuthLastError = '';
    return true;
  } catch (err) {
    gatewayAuthReady = false;
    gatewayAuthLastError = String(err?.message || err);
    console.error(`GATEWAY_PREFLIGHT_FAIL ${gatewayAuthLastError}`);
    return false;
  }
}

let pollBusy = false;
let gatewayAuthReady = false;
let gatewayAuthLastError = '';

async function pollSubagentsOnce() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const runs = listRuns();

    // Ask gateway for sessions list once
    let sessions = [];
    try {
      sessions = await toolsInvoke('sessions_list', { limit: 200 });
    } catch {
      sessions = [];
    }

    // 0) Stop timeout: if a run is stuck in stopping, force-stop it (unblocks WIP)
    const stopping = runs.filter((r) => r.status === 'stopping' && r.sessionKey);
    for (const r of stopping) {
      const stillThere = Array.isArray(sessions)
        ? sessions.some((s) => s?.sessionKey === r.sessionKey || s?.key === r.sessionKey)
        : false;

      if (!stillThere) continue; // normal path: handled below when session disappears

      const stopAt = r.stopRequestedAt ? Date.parse(String(r.stopRequestedAt)) : NaN;
      if (!Number.isFinite(stopAt)) continue;

      if (Date.now() - stopAt < STOP_TIMEOUT_MS) continue;

      // One last cooperative signal, then force-stop in our system.
      try {
        await toolsInvoke('sessions_send', {
          sessionKey: r.sessionKey,
          message:
            'TIMEOUT DE CANCELAMENTO. Encerre AGORA. Mate TODOS os subagents ("/subagents kill all") e finalize. Responda STATUS: cancelled e encerre.',
        });
        appendRunEvent(r.id, { type: 'stop_timeout_signal_sent', sessionKey: r.sessionKey });
      } catch (err) {
        appendRunEvent(r.id, { type: 'stop_timeout_signal_error', sessionKey: r.sessionKey, error: String(err?.message || err) });
      }

      const nowIso = new Date().toISOString();
      const runsT = listRuns();
      const idxT = runsT.findIndex((x) => x.id === r.id);
      if (idxT !== -1 && runsT[idxT].status === 'stopping') {
        runsT[idxT] = { ...runsT[idxT], status: 'stopped', endedAt: nowIso, lastUpdateAt: nowIso };
        saveRuns(runsT);
        appendRunEvent(r.id, { type: 'stop_timeout', timeoutMs: STOP_TIMEOUT_MS });
        appendRunEvent(r.id, { type: 'status', status: 'stopped' });
        await notifyTelegram(`Run parada (timeout): ${r.id}`);
        await tryStartQueuedRuns();
      }
    }

    // 1) Close finished worker runs (e.g., Marina) and spawn Ragha validation
    const activeWorkers = runs.filter((r) => (r.status === 'running' || r.status === 'stopping') && r.sessionKey);
    for (const r of activeWorkers) {
      const stillThere = Array.isArray(sessions)
        ? sessions.some((s) => s?.sessionKey === r.sessionKey || s?.key === r.sessionKey)
        : false;

      if (stillThere) continue;

      const now = new Date().toISOString();
      const runs2 = listRuns();
      const idx = runs2.findIndex((x) => x.id === r.id);
      if (idx === -1) continue;

      // If the run is stopping, confirm stop and do not treat as "done".
      if (runs2[idx].status === 'stopping') {
        runs2[idx] = {
          ...runs2[idx],
          status: 'stopped',
          endedAt: now,
          lastUpdateAt: now,
        };
        saveRuns(runs2);
        appendRunEvent(r.id, { type: 'status', status: 'stopped' });
        await notifyTelegram(`Run parada (confirmada): ${r.id}`);
        await tryStartQueuedRuns();
        continue;
      }

      if (runs2[idx].status !== 'running') continue;

      // Fetch worker output (best-effort) + audit tool usage
      let workerText = '';
      let workerMaterial = '';
      try {
        const hist = await toolsInvoke('sessions_history', { sessionKey: r.sessionKey, limit: 80, includeTools: true });
        const msgs = Array.isArray(hist) ? hist : hist?.messages || [];
        workerText = JSON.stringify(msgs, null, 2);
        workerMaterial = extractAssistantMaterialFromMessages(msgs);

        // Audit: detect forbidden tools in the transcript (post-hoc enforcement)
        // We keep this conservative to avoid false positives (e.g. a normal message with field "name").
        const usedTools = [];

        for (const m of msgs) {
          const role = String(m?.role || '');
          const kind = String(m?.kind || m?.type || '');

          // Case A: tool message
          if (role === 'tool' || kind === 'tool') {
            const toolName = m?.tool || m?.name || m?.toolName || m?.id || m?.tool_id || null;
            if (toolName) usedTools.push(String(toolName));
          }

          // Case B: content array with tool_use blocks
          const content = m?.content;
          if (Array.isArray(content)) {
            for (const c of content) {
              const cType = String(c?.type || '');
              if (cType === 'tool_use') {
                const toolName = c?.name || c?.tool || c?.toolName || null;
                if (toolName) usedTools.push(String(toolName));
              }
            }
          }
        }

        const uniqTools = Array.from(new Set(usedTools.map((x) => String(x))));
        const agentCfg = getAgentProfile(runs2[idx].agentId);
        const deny = Array.isArray(agentCfg?.toolsDenied) && agentCfg.toolsDenied.length ? agentCfg.toolsDenied.map(String) : DEFAULT_SUBAGENT_TOOL_DENY;

        const violations = uniqTools.filter((x) => deny.includes(String(x)));
        if (violations.length) {
          appendRunEvent(r.id, { type: 'tool_violation', tools: violations, deny, usedTools: uniqTools, sessionKey: r.sessionKey });
          await notifyTelegram(`âš ï¸ tool_violation (auditoria): ${r.id}\nAgente: ${runs2[idx].agentId}\nTools: ${violations.join(', ')}`);
        }

        // Cost-ish: token estimate based on transcript size (rough, but stable)
        const tokensOutEst = estimateTokensFromText(workerText);
        appendRunEvent(r.id, {
          type: 'usage_estimate',
          model: runs2[idx].model,
          tokensOutEst,
        });

        // persist on run for quick UI stats
        runs2[idx] = { ...runs2[idx], tokensOutEst, lastUpdateAt: new Date().toISOString() };
        saveRuns(runs2);
      } catch {
        workerText = '';
      }

      const minMaterial = String(workerMaterial || '').trim();
      const needsSocialEvidence = requiresEvidenceForTask(runs2[idx].taskTitle);
      const hasSocialEvidence = hasSocialEvidenceInText(minMaterial, runs2[idx].taskTitle);

      if (!minMaterial || minMaterial.length < 80) {
        runs2[idx] = {
          ...runs2[idx],
          status: 'failed',
          endedAt: now,
          lastUpdateAt: now,
          lastError: 'SaÃ­da vazia/insuficiente do agente.',
          failureKind: 'empty_output',
          outputs: workerText ? [{ type: 'sessions_history', sessionKey: r.sessionKey, content: workerText }] : (runs2[idx].outputs || []),
        };
        saveRuns(runs2);
        appendRunEvent(r.id, { type: 'status', status: 'failed', failureKind: 'empty_output' });
        await notifyTelegram(`Resultado da Task: Agente retornou saÃ­da vazia para esta execuÃ§Ã£o. Status: failed. PrÃ³xima aÃ§Ã£o: reexecutar com captura obrigatÃ³ria de evidÃªncia antes da revisÃ£o.`);
        await tryStartQueuedRuns();
        continue;
      }

      if (needsSocialEvidence && !hasSocialEvidence) {
        runs2[idx] = {
          ...runs2[idx],
          status: 'failed',
          endedAt: now,
          lastUpdateAt: now,
          lastError: 'EvidÃªncia social insuficiente na saÃ­da do agente.',
          failureKind: 'no_evidence',
          outputs: workerText ? [{ type: 'sessions_history', sessionKey: r.sessionKey, content: workerText }] : (runs2[idx].outputs || []),
        };
        saveRuns(runs2);
        appendRunEvent(r.id, { type: 'status', status: 'failed', failureKind: 'no_evidence' });
        await notifyTelegram(`Resultado da Task: A execuÃ§Ã£o nÃ£o trouxe evidÃªncia real do conteÃºdo social solicitado. Status: failed. PrÃ³xima aÃ§Ã£o: reexecutar com browser/snapshot obrigatÃ³rio para o link.`);
        await tryStartQueuedRuns();
        continue;
      }

      runs2[idx] = {
        ...runs2[idx],
        status: 'review',
        lastUpdateAt: now,
        outputs: workerText ? [{ type: 'sessions_history', sessionKey: r.sessionKey, content: workerText }] : (runs2[idx].outputs || []),
      };
      saveRuns(runs2);
      appendRunEvent(r.id, { type: 'status', status: 'review' });
      await notifyTelegram(`${agentLabel(r.agentId)} concluiu. Entrando em revisÃ£o.`);

      // Spawn Ragha validation as a separate subagent (doesn't create a new Run card)
      await notifyTelegram(`${agentLabel('ragha')} revisando e resumindo...`);
      try {
        const validateTask = `VocÃª Ã© o Ragha. Valide e resuma a entrega do agente ${r.agentId}.

Regras:
- Validar se existe conteÃºdo Ãºtil e evidÃªncia real
- Se faltou evidÃªncia/saÃ­da, declarar isso explicitamente
- SaÃ­da FINAL obrigatÃ³ria em uma linha no formato:
Resultado da Task: <resumo direto em 1â€“3 frases>. Status: <done|failed>. PrÃ³xima aÃ§Ã£o: <1 linha>.

Contexto do pedido:
${r.taskTitle}

Entrega do agente (sessions_history):
${workerText || '(sem histÃ³rico disponÃ­vel)'}
`;

        const spawned = await toolsInvoke('sessions_spawn', {
          task: validateTask,
          label: `Ragha-validate:${r.id}`,
          model: '' + FIXED_TASK_MODEL + '',
          runTimeoutSeconds: 60 * 10,
          cleanup: 'keep',
        });

        const key = spawned?.childSessionKey || spawned?.sessionKey || spawned?.key || null;
        if (key) {
          const validators = listValidators();
          validators.unshift({ key, forRunId: r.id, taskId: r.taskId, spawnedAt: new Date().toISOString() });
          saveValidators(validators.slice(0, 50));
          appendRunEvent(r.id, { type: 'verifier_spawned', sessionKey: key });
        }
      } catch {
        // fallback: verifier unavailable => fail run (do not mark done without validated summary)
        const runsF = listRuns();
        const idxF = runsF.findIndex((x) => x.id === r.id);
        if (idxF !== -1 && runsF[idxF].status === 'review') {
          const nowF = new Date().toISOString();
          runsF[idxF] = {
            ...runsF[idxF],
            status: 'failed',
            endedAt: nowF,
            lastUpdateAt: nowF,
            lastError: 'ValidaÃ§Ã£o final indisponÃ­vel (verifier_spawn_error).',
            failureKind: 'verifier_spawn_error',
          };
          saveRuns(runsF);
          appendRunEvent(r.id, { type: 'verifier_spawn_error' });
          appendRunEvent(r.id, { type: 'status', status: 'failed' });
        }
      }

      await tryStartQueuedRuns();
    }

    // 2) If Ragha validator finished, post briefing to Telegram
    const validators = listValidators();
    if (validators.length) {
      const keep = [];
      for (const v of validators) {
        const stillThere = Array.isArray(sessions)
          ? sessions.some((s) => s?.sessionKey === v.key || s?.key === v.key)
          : false;

        if (stillThere) {
          keep.push(v);
          continue;
        }

        // Session ended: fetch its history and extract last assistant text
        try {
          const hist = await toolsInvoke('sessions_history', { sessionKey: v.key, limit: 60, includeTools: false });
          const msgs = Array.isArray(hist) ? hist : hist?.messages || [];
          const last = [...msgs].reverse().find((m) => typeof m?.content === 'string' && m?.role === 'assistant');
          const brief = last?.content || '';

          // Finalize run after verifier ends (only if minimum summary exists)
          const runsV = listRuns();
          const idxV = runsV.findIndex((x) => x.id === v.forRunId);
          const summaryCandidate = String(brief || runsV[idxV]?.summary || '').trim();
          const summaryOk = hasMinimumSummary(summaryCandidate);

          if (idxV !== -1 && runsV[idxV].status === 'review') {
            const nowV = new Date().toISOString();
            const needsEvidence = requiresEvidenceForTask(runsV[idxV].taskTitle);
            const evidenceOk = hasEvidenceForRun(runsV[idxV]);
            const outputEmpty = !String(runsV[idxV]?.outputs?.[0]?.content || '').trim();
            const okFinal = summaryOk && (!needsEvidence || evidenceOk);

            let failureKind;
            if (!okFinal) {
              if (outputEmpty) failureKind = 'empty_output';
              else if (!summaryOk) failureKind = 'insufficient_summary';
              else if (needsEvidence && !evidenceOk) failureKind = 'no_evidence';
              else failureKind = 'validation_failed';
            }

            const shouldRework = !okFinal && !runsV[idxV]?.reworkAttempted;
            const nextStatus = okFinal ? 'done' : (shouldRework ? 'review' : 'failed');

            runsV[idxV] = {
              ...runsV[idxV],
              status: nextStatus,
              endedAt: nextStatus === 'failed' || nextStatus === 'done' ? nowV : undefined,
              lastUpdateAt: nowV,
              summary: summaryCandidate || runsV[idxV].summary,
              lastError: okFinal ? undefined : (
                failureKind === 'insufficient_summary'
                  ? `Resumo insuficiente (< ${MIN_DONE_SUMMARY_CHARS} chars).`
                  : failureKind === 'no_evidence'
                    ? 'EvidÃªncia insuficiente para task com link social.'
                    : failureKind === 'empty_output'
                      ? 'SaÃ­da vazia do agente.'
                      : 'Falha de validaÃ§Ã£o.'
              ),
              failureKind,
            };
            saveRuns(runsV);
            appendRunEvent(v.forRunId, {
              type: 'verifier_result',
              ok: okFinal,
              preview: String(summaryCandidate || '').slice(0, 240),
              minSummaryChars: MIN_DONE_SUMMARY_CHARS,
              needsEvidence,
              evidenceOk,
              failureKind,
            });
            appendRunEvent(v.forRunId, { type: 'status', status: nextStatus, failureKind });
            await tryStartQueuedRuns();
          }

          const runFinal = listRuns().find((x) => x.id === v.forRunId);
          const taskTitleFinal = String(runFinal?.taskTitle || 'Task');
          const summaryFinal = String(summaryCandidate || '').trim();
          const needsEvidence = requiresEvidenceForTask(taskTitleFinal);
          const hasEvidence = hasEvidenceForRun(runFinal || {});

          // Auto-rework: one guided correction cycle before failing.
          if ((!summaryOk || (needsEvidence && !hasEvidence)) && !runFinal?.reworkAttempted) {
            try {
              const histOut = Array.isArray(runFinal?.outputs) ? runFinal.outputs.map((o) => String(o?.content || '')).join('\n') : '';
              const reworkTask = `RefaÃ§a apenas o resumo final com qualidade.

Contexto original:
${taskTitleFinal}

Material bruto:
${histOut || '(sem material)'}

ObrigatÃ³rio:
- mÃ­nimo de ${MIN_DONE_SUMMARY_CHARS} caracteres
- incluir evidÃªncias observÃ¡veis (link/trecho/sinal)
- formato exato em uma linha:
Resultado da Task: <resumo direto em 1â€“3 frases>. Status: <done|failed>. PrÃ³xima aÃ§Ã£o: <1 linha>.`;

              const rework = await toolsInvoke('sessions_spawn', {
                task: reworkTask,
                label: `Ragha-rework:${v.forRunId}`,
                model: '' + FIXED_TASK_MODEL + '',
                runTimeoutSeconds: 60 * 6,
                cleanup: 'keep',
              });
              const reworkKey = rework?.childSessionKey || rework?.sessionKey || rework?.key || null;
              if (reworkKey) {
                const validators2 = listValidators();
                validators2.unshift({ key: reworkKey, forRunId: v.forRunId, taskId: v.taskId, spawnedAt: new Date().toISOString(), rework: true });
                saveValidators(validators2.slice(0, 50));

                const runsR = listRuns();
                const idxR = runsR.findIndex((x) => x.id === v.forRunId);
                if (idxR !== -1) {
                  runsR[idxR] = { ...runsR[idxR], reworkAttempted: true, lastUpdateAt: new Date().toISOString() };
                  saveRuns(runsR);
                }

                appendRunEvent(v.forRunId, { type: 'rework_spawned', needsSummary: !summaryOk, needsEvidence: needsEvidence && !hasEvidence });
                continue;
              }
            } catch {
              // fallthrough to normal fail handling below
            }
          }

          if (summaryOk && (!needsEvidence || hasEvidence) && summaryFinal) {
            const std = buildStandardTaskResult(summaryFinal, 'done', 'seguir para execução do próximo passo');
            if (SEND_TASK_TELEGRAM_UPDATES) await notifyTelegram(std);
          } else {
            const failReason = !summaryOk ? `resumo abaixo do mÃ­nimo (${MIN_DONE_SUMMARY_CHARS} chars)` : 'faltou evidÃªncia real para link social';
            await notifyTelegram(`${agentLabel('ragha')} revisÃ£o insuficiente.\nTask: ${taskTitleFinal}\nRun: ${v.forRunId}\nMotivo: ${failReason}.`);
          }
        } catch {
          // ignore
        }
      }
      saveValidators(keep);
    }

    // Tick retries even without other events.
    await tryStartQueuedRuns();
  } finally {
    pollBusy = false;
  }
}

setInterval(() => {
  pollSubagentsOnce().catch(() => {});
}, SUBAGENT_POLL_MS);

setInterval(() => {
  if (!gatewayAuthReady) {
    gatewayPreflight().catch(() => {});
  }
}, 60_000);

// Stash feature - save and analyze Instagram/social media content
const stashFile = path.join(dataDir, 'stash.json');

function listStash() {
  return readJsonSafe(stashFile, []);
}

function saveStash(items) {
  writeJsonAtomic(stashFile, items);
}

async function analyzeInstagramWithSkill(url) {
  try {
    const skillPath = path.join(WORKSPACE_ROOT, 'skills', 'social-media-scraper-pro', 'social_media_scraper.py');
    if (!fs.existsSync(skillPath)) {
      return { success: false, error: 'Skill not found' };
    }

    const { stdout, stderr } = await execFileAsync('python', [skillPath, '--url', url, '--json'], {
      timeout: 60000,
      cwd: path.dirname(skillPath),
    });

    if (stderr && !stdout) {
      return { success: false, error: stderr };
    }

    try {
      const result = JSON.parse(stdout);
      return result;
    } catch (e) {
      return { success: false, error: 'Invalid JSON from skill', raw: stdout };
    }
  } catch (err) {
    return { success: false, error: String(err?.message || err) };
  }
}

async function generateStashAnalysis(data, url) {
  // Use AI to generate structured analysis like stashR
  const task = `
Analise este conteúdo do Instagram e gere uma análise estruturada no estilo stashR:

URL: ${url}
Dados brutos: ${JSON.stringify(data, null, 2)}

Gere um JSON com este formato:
{
  "title": "Título resumido do post",
  "summary": "Resumo em 2-3 frases do conteúdo",
  "keyPoints": ["ponto 1", "ponto 2", "ponto 3"],
  "actionItems": ["ação 1", "ação 2"],
  "tags": ["tag1", "tag2"],
  "contentType": "reel|post|carousel",
  "estimatedTime": "ex: 5 min",
  "difficulty": "Beginner|Intermediate|Advanced"
}

Seja objetivo e prático. Foque no que o usuário pode aprender/aplicar.`;

  try {
    const result = await toolsInvoke('sessions_spawn', {
      task,
      mode: 'run',
      cleanup: 'delete',
      runTimeoutSeconds: 60,
    });

    // Parse result
    const childKey = result?.childSessionKey || result?.sessionKey;
    if (!childKey) return null;

    // Wait a bit and get history
    await new Promise(r => setTimeout(r, 3000));
    const hist = await toolsInvoke('sessions_history', { sessionKey: childKey, limit: 10 });
    const msgs = Array.isArray(hist) ? hist : hist?.messages || [];
    const assistantMsg = msgs.reverse().find(m => m?.role === 'assistant');

    if (assistantMsg?.content) {
      // Try to extract JSON from the response
      const content = String(assistantMsg.content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    return null;
  } catch (e) {
    console.error('Analysis generation failed:', e);
    return null;
  }
}

// POST /api/stash - Create new stash item
app.post('/api/stash', authMiddleware, async (req, res) => {
  try {
    const { url, source = 'instagram' } = req.body || {};
    if (!url) return res.status(400).json({ ok: false, error: 'missing_url' });

    // Validate Instagram URL
    if (!/instagram\.com\/(p|reel|tv)\//.test(url)) {
      return res.status(400).json({ ok: false, error: 'invalid_instagram_url' });
    }

    // Check if already stashed
    const existing = listStash();
    const alreadyExists = existing.find(s => s.url === url);
    if (alreadyExists) {
      return res.json({ ok: true, data: alreadyExists, message: 'Already stashed' });
    }

    // Extract data using skill
    console.log(`[Stash] Extracting: ${url}`);
    const extraction = await analyzeInstagramWithSkill(url);

    // Generate AI analysis
    const analysis = await generateStashAnalysis(extraction, url);

    const now = new Date().toISOString();
    const stashItem = {
      id: uid('stash'),
      url,
      source,
      extractedAt: now,
      rawData: extraction,
      analysis: analysis || {
        title: extraction?.data?.caption?.slice(0, 60) || 'Untitled',
        summary: extraction?.data?.caption || 'No summary available',
        keyPoints: [],
        actionItems: [],
        tags: [],
        contentType: extraction?.type || 'unknown',
      },
      thumbnailUrl: extraction?.data?.image_url || extraction?.data?.thumbnail,
      author: extraction?.data?.author,
      status: 'analyzed',
    };

    existing.unshift(stashItem);
    saveStash(existing.slice(0, 500)); // Keep last 500 items

    res.json({ ok: true, data: stashItem });
  } catch (err) {
    console.error('[Stash] Error:', err);
    res.status(500).json({ ok: false, error: 'stash_failed', detail: String(err?.message || err) });
  }
});

// GET /api/stash - List stash items
app.get('/api/stash', authMiddleware, (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const tag = req.query.tag ? String(req.query.tag) : null;

    let items = listStash();

    if (tag) {
      items = items.filter(s => s.analysis?.tags?.includes(tag));
    }

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);

    res.json({
      ok: true,
      data: paginated,
      meta: { total, limit, offset, hasMore: offset + limit < total }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'stash_list_failed', detail: String(err?.message || err) });
  }
});

// GET /api/stash/:id - Get single stash item
app.get('/api/stash/:id', authMiddleware, (req, res) => {
  try {
    const items = listStash();
    const item = items.find(s => s.id === req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'stash_get_failed', detail: String(err?.message || err) });
  }
});

// DELETE /api/stash/:id - Delete stash item
app.delete('/api/stash/:id', authMiddleware, (req, res) => {
  try {
    const items = listStash();
    const filtered = items.filter(s => s.id !== req.params.id);
    if (filtered.length === items.length) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    saveStash(filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'stash_delete_failed', detail: String(err?.message || err) });
  }
});

// POST /api/stash/ios - Add stash item from iOS Shortcuts (pre-extracted data)
app.post('/api/stash/ios', async (req, res) => {
  try {
    const { url, source = 'instagram', title, description, thumbnailUrl, videoUrl, contentType, author } = req.body || {};

    if (!url) {
      return res.status(400).json({ ok: false, error: 'missing_url' });
    }

    // Check if already stashed
    const existing = listStash();
    const alreadyExists = existing.find(s => s.url === url);
    if (alreadyExists) {
      return res.json({ ok: true, data: alreadyExists, message: 'Already stashed' });
    }

    // Create stash item with pre-extracted data
    const now = new Date().toISOString();
    const stashItem = {
      id: uid('stash'),
      url,
      source,
      extractedAt: now,
      rawData: {
        success: true,
        platform: source,
        url,
        data: {
          title: title || '',
          description: description || '',
          thumbnailUrl: thumbnailUrl || '',
          videoUrl: videoUrl || '',
          author: author || '',
          type: contentType || 'unknown'
        }
      },
      analysis: {
        title: title || description?.slice(0, 60) || 'Sem título',
        summary: description || 'Sem descrição',
        keyPoints: [],
        actionItems: [],
        tags: [],
        contentType: contentType || 'unknown',
      },
      thumbnailUrl: thumbnailUrl,
      author: author,
      status: 'pending_analysis', // Will be analyzed by AI later
    };

    // Trigger async AI analysis
    generateStashAnalysis(stashItem.rawData, url).then(analysis => {
      if (analysis) {
        const items = listStash();
        const idx = items.findIndex(s => s.id === stashItem.id);
        if (idx !== -1) {
          items[idx].analysis = analysis;
          items[idx].status = 'analyzed';
          saveStash(items);
        }
      }
    }).catch(() => {});

    existing.unshift(stashItem);
    saveStash(existing.slice(0, 500));

    // Notify Telegram
    await notifyTelegram(`📥 **Novo item no Stash**\n${title || 'Sem título'}\n${url}`);

    res.json({ ok: true, data: stashItem });
  } catch (err) {
    console.error('[Stash iOS] Error:', err);
    res.status(500).json({ ok: false, error: 'stash_ios_failed', detail: String(err?.message || err) });
  }
});

repairKanbanDataOnce();

app.listen(PORT, '127.0.0.1', async () => {
  console.log(`Mission Control server running on port ${PORT}`);
  await gatewayPreflight();
});












