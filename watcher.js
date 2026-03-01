import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';
const TELEGRAM_NOTIFY_TARGET = process.env.TELEGRAM_NOTIFY_TARGET || '';

const dataDir = path.resolve(__dirname, 'data');
const runEventsFile = path.join(dataDir, 'run-events.json');
const stateFile = path.join(dataDir, 'watch-state.json');

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, value) {
  if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, filePath);
}

async function toolsInvoke(tool, args = {}, action) {
  const payload = action ? { tool, action, args } : { tool, args };
  const resp = await axios.post(`${GATEWAY_URL}/tools/invoke`, payload, {
    headers: {
      Authorization: `Bearer ${GATEWAY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
  return resp.data.result;
}

async function sendTelegram(message) {
  if (!TELEGRAM_NOTIFY_TARGET) return;
  await toolsInvoke('message', { action: 'send', target: TELEGRAM_NOTIFY_TARGET, message: String(message) });
}

function formatEvent(e) {
  const at = e.at ? new Date(e.at).toLocaleString('pt-BR', { hour12: false }) : '';
  const prefix = at ? `[${at}] ` : '';

  if (e.type === 'created') {
    const origin = e.from ? ` (${e.from})` : (e.auto ? ' (auto)' : '');
    return `${prefix}Run criada${origin}: ${e.runId}`;
  }
  if (e.type === 'status' && e.status === 'running') return `${prefix}Run iniciou: ${e.runId}`;
  if (e.type === 'stopped') return `${prefix}Run parada: ${e.runId}`;
  if (e.type === 'spawn') return `${prefix}Subagente spawnado: ${e.runId}`;
  if (e.type === 'spawn_error') return `${prefix}Erro ao spawnar subagente: ${e.runId}`;
  if (e.type === 'retry_of') return `${prefix}Run retry: ${e.runId}`;
  return `${prefix}${e.type}: ${e.runId}`;
}

async function tick() {
  const events = readJsonSafe(runEventsFile, []);
  const state = readJsonSafe(stateFile, { lastIndex: 0 });
  const lastIndex = Number(state.lastIndex || 0);

  if (!Array.isArray(events) || events.length <= lastIndex) return;

  const newEvents = events.slice(lastIndex);

  // Coalesce: send at most 1 telegram message per tick, max 10 lines
  const lines = newEvents.slice(0, 10).map((ev) => formatEvent(ev));
  const msg = lines.join('\n');

  try {
    await sendTelegram(msg);
    writeJsonAtomic(stateFile, { lastIndex: lastIndex + newEvents.length, lastAt: new Date().toISOString() });
  } catch {
    // do not advance cursor on failure
  }
}

async function main() {
  // Small startup notice
  try {
    await sendTelegram('Vigia 24/7 do Mission Control: ON');
  } catch {}

  // Poll loop (2s)
  setInterval(() => {
    tick().catch(() => {});
  }, 2000);
}

main();
