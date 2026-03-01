import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = process.env.PORT || '3004';
const INBOX_TOKEN = process.env.INBOX_TOKEN || '';
if (!INBOX_TOKEN) {
  console.error('FAIL: INBOX_TOKEN não configurado');
  process.exit(1);
}

const base = `http://127.0.0.1:${PORT}`;
const dataDir = path.resolve(process.cwd(), 'data');
const tasksFile = path.join(dataDir, 'tasks.json');
const runsFile = path.join(dataDir, 'runs.json');
const draftsFile = path.join(dataDir, 'inbox-drafts.json');

const tag = `E2E_${Date.now()}`;
const chatId = '5273431160';

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}
function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

async function postInbox(text) {
  const r = await fetch(`${base}/api/inbox/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-inbox-token': INBOX_TOKEN },
    body: JSON.stringify({ chatId, text }),
  });
  const data = await r.json().catch(() => ({}));
  return { okHttp: r.ok, status: r.status, data };
}

const createdTaskIds = new Set();

async function run() {
  const out = [];

  // 1) LOW risk: create draft -> approve => task + runs
  const lowTitle = `Task: revisar microcopy dashboard ${tag} LOW`;
  const lowCreate = await postInbox(lowTitle);
  out.push(['low.create', lowCreate]);
  if (!lowCreate.okHttp || !lowCreate.data?.draftId) throw new Error('low.create failed');
  const lowDraftId = lowCreate.data.draftId;

  const lowApprove = await postInbox(`approve:${lowDraftId}`);
  out.push(['low.approve', lowApprove]);
  if (!lowApprove.okHttp || !lowApprove.data?.taskId) throw new Error('low.approve failed');
  createdTaskIds.add(lowApprove.data.taskId);

  // 2) HIGH risk: create draft -> approve => awaiting_high_risk_confirmation -> approve_high => task + runs
  const highTitle = `Task: apagar produção e usar token secreto ${tag} HIGH`;
  const highCreate = await postInbox(highTitle);
  out.push(['high.create', highCreate]);
  if (!highCreate.okHttp || !highCreate.data?.draftId) throw new Error('high.create failed');
  const highDraftId = highCreate.data.draftId;

  const highApproveStep1 = await postInbox(`approve:${highDraftId}`);
  out.push(['high.approve.step1', highApproveStep1]);
  if (!highApproveStep1.okHttp || highApproveStep1.data?.action !== 'awaiting_high_risk_confirmation') {
    throw new Error('high.approve step1 should require second confirmation');
  }

  const highApproveStep2 = await postInbox(`approve_high:${highDraftId}`);
  out.push(['high.approve.step2', highApproveStep2]);
  if (!highApproveStep2.okHttp || !highApproveStep2.data?.taskId) throw new Error('high.approve step2 failed');
  createdTaskIds.add(highApproveStep2.data.taskId);

  // 3) ADJUST must recalc risk
  const adjCreate = await postInbox(`Task: organizar backlog ${tag} ADJ`);
  out.push(['adjust.create', adjCreate]);
  if (!adjCreate.okHttp || !adjCreate.data?.draftId) throw new Error('adjust.create failed');
  const adjDraftId = adjCreate.data.draftId;

  const adjClick = await postInbox(`adjust:${adjDraftId}`);
  out.push(['adjust.click', adjClick]);
  if (!adjClick.okHttp || adjClick.data?.action !== 'adjust') throw new Error('adjust.click failed');

  const adjText = await postInbox(`Task: apagar banco em produção com api key ${tag} ADJ-HIGH`);
  out.push(['adjust.text', adjText]);
  if (!adjText.okHttp || adjText.data?.action !== 'draft_adjusted') throw new Error('adjust.text failed');

  const draftsNow = readJson(draftsFile, []);
  const adjustedDraft = draftsNow.find((d) => d.id === adjDraftId);
  if (!adjustedDraft) throw new Error('adjusted draft not found');
  if (adjustedDraft.risk !== 'high') throw new Error(`risk not recalculated to high (got ${adjustedDraft.risk})`);

  const adjApprove = await postInbox(`approve:${adjDraftId}`);
  out.push(['adjust.approve', adjApprove]);
  if (!adjApprove.okHttp || adjApprove.data?.action !== 'awaiting_high_risk_confirmation') {
    throw new Error('adjust.approve should require high-risk confirmation');
  }

  // cancel adjusted draft to avoid more artifacts
  const adjCancel = await postInbox(`cancel:${adjDraftId}`);
  out.push(['adjust.cancel', adjCancel]);

  // Sanity: created tasks exist and have runs
  const tasks = readJson(tasksFile, []);
  const runs = readJson(runsFile, []);
  const missing = [...createdTaskIds].filter((id) => !tasks.some((t) => t.id === id));
  if (missing.length) throw new Error(`created task missing in tasks.json: ${missing.join(', ')}`);
  const noRuns = [...createdTaskIds].filter((id) => !runs.some((r) => r.taskId === id));
  if (noRuns.length) throw new Error(`created task without runs: ${noRuns.join(', ')}`);

  // Cleanup only test artifacts by tag
  const cleanedTasks = tasks.filter((t) => !String(t.title || '').includes(tag));
  writeJson(tasksFile, cleanedTasks);

  const runsAfterTaskCleanup = runs.filter((r) => !createdTaskIds.has(r.taskId) && !String(r.taskTitle || '').includes(tag));
  writeJson(runsFile, runsAfterTaskCleanup);

  const drafts = readJson(draftsFile, []);
  const cleanedDrafts = drafts.filter((d) => !String(d.title || '').includes(tag));
  writeJson(draftsFile, cleanedDrafts);

  console.log(JSON.stringify({ ok: true, tag, checks: out.map(([k, v]) => ({ step: k, http: v.status, action: v.data?.action || null })) }, null, 2));
}

run().catch((err) => {
  console.error('E2E_FAIL:', err.message || err);
  process.exit(1);
});
