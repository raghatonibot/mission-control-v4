import type { Agent } from '@/types/agent';
import type { Run } from '@/types/run';
import type { Task } from '@/types/task';
import type { Conversation } from '@/types/chat';

const API_URL = import.meta.env.VITE_API_URL || '';

type JsonMap = Record<string, unknown>;

function decodeMojibake(input: string): string {
  if (!input) return input;
  let out = String(input);
  if (/[ÃÂâ€™œž˜]/.test(out)) {
    try { out = decodeURIComponent(escape(out)); } catch {}
  }
  return out
    .replace(/\uFFFD/g, '')
    .replace(/ã~¢|â€¢|Ã¢â‚¬Â¢/g, '•')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeEncodingDeep<T>(value: T): T {
  if (typeof value === 'string') return decodeMojibake(value) as T;
  if (Array.isArray(value)) return value.map((v) => normalizeEncodingDeep(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeEncodingDeep(v);
    }
    return out as T;
  }
  return value;
}

export function getToken() {
  return localStorage.getItem('mc_token');
}

export function setToken(token: string) {
  localStorage.setItem('mc_token', token);
}

export function clearToken() {
  localStorage.removeItem('mc_token');
}

async function request<T>(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const raw = await res.text();

  let data: JsonMap = {};
  if (raw) {
    try {
      data = JSON.parse(raw) as JsonMap;
    } catch {
      const snippet = raw.slice(0, 200).replace(/\s+/g, ' ').trim();
      throw new Error(`invalid_json_response:${res.status}:${snippet}`);
    }
  }

  if (!res.ok) {
    throw new Error(String(data?.error || `request_failed_${res.status}`));
  }

  return normalizeEncodingDeep(data as T);
}

export const api = {
  authSetup: () => request<{ ok: true; otpauth: string; qr: string }>('/auth/setup'),
  authVerify: (email: string, code: string) =>
    request<{ ok: true; token: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  metrics: () => request<{ ok: true; data: { agents: number; cronJobs: number; memories: number } }>('/api/metrics'),
  agentTeamMetrics: () => request<{ ok: true; data: JsonMap }>('/api/agent-team/metrics'),
  agents: () => request<{ ok: true; data: Agent[] }>('/api/agents'),
  agentsLive: () => request<{ ok: true; data: JsonMap[] }>('/api/agents/live'),
  agent: (id: string) => request<{ ok: true; data: JsonMap }>(`/api/agents/${id}`),
  updateAgent: (id: string, payload: JsonMap) =>
    request<{ ok: true; data: JsonMap }>(`/api/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  skills: () => request<{ ok: true; data: JsonMap[] }>('/api/skills'),
  missions: () => request<{ ok: true; data: JsonMap[] }>('/api/missions'),
  events: (params?: { runId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.runId) q.set('runId', params.runId);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<{ ok: true; data: { total: number; last24h: number; events: unknown[] } }>(`/api/events${qs ? `?${qs}` : ''}`);
  },

  chatConversations: () => request<{ ok: true; data: Conversation[] }>('/api/chat/conversations'),
  chatHistory: (agentId: string) => request<{ ok: true; data: Conversation }>(`/api/chat/${agentId}/history`),
  chatSend: (agentId: string, content: string) =>
    request<{ ok: true; data: Conversation }>(`/api/chat/${agentId}/send`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // v2: tasks/runs
  tasks: () => request<{ ok: true; data: Task[] }>('/api/tasks'),
  doneTasks: () => request<{ ok: true; data: JsonMap[] }>('/api/tasks/done'),
  tokenUsageLive: (params?: { start?: string; end?: string; model?: string; provider?: string; source?: 'local' | 'remote' | ''; agentId?: string; runId?: string; taskId?: string; taskClass?: string; eventsLimit?: number }) => {
    const q = new URLSearchParams();
    if (params?.start) q.set('start', params.start);
    if (params?.end) q.set('end', params.end);
    if (params?.model) q.set('model', params.model);
    if (params?.provider) q.set('provider', params.provider);
    if (params?.source) q.set('source', params.source);
    if (params?.agentId) q.set('agentId', params.agentId);
    if (params?.runId) q.set('runId', params.runId);
    if (params?.taskId) q.set('taskId', params.taskId);
    if (params?.taskClass) q.set('taskClass', params.taskClass);
    if (params?.eventsLimit) q.set('eventsLimit', String(params.eventsLimit));
    const qs = q.toString();
    return request<{ ok: true; data: JsonMap }>(`/api/tokens/live${qs ? `?${qs}` : ''}`);
  },
  tokenUsageReset: () => request<{ ok: true; data: JsonMap }>('/api/tokens/live/reset', { method: 'POST' }),
  createTask: (payload: { title: string; description?: string; priority?: string; source?: 'ui' | 'telegram'; autoRun?: boolean }) =>
    request<{ ok: true; data: JsonMap }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTask: (id: string, payload: Partial<{ title: string; description: string; priority: string; status: string }>) =>
    request<{ ok: true; data: JsonMap }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  startTask: (id: string) => request<{ ok: true; data: JsonMap }>(`/api/tasks/${id}/start`, { method: 'POST' }),
  runs: () => request<{ ok: true; data: Run[] }>('/api/runs'),
  runThread: (id: string, limit = 80) => request<{ ok: true; data: JsonMap[] }>(`/api/runs/${id}/thread?limit=${limit}`),
  createRun: (payload: { taskId: string; agentId: string }) =>
    request<{ ok: true; data: JsonMap }>('/api/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  stopRun: (id: string) => request<{ ok: true }>('/api/runs/' + id + '/stop', { method: 'POST' }),
  stopRunAll: (id: string) => request<{ ok: true }>('/api/runs/' + id + '/stopall', { method: 'POST' }),
  pauseRun: (id: string) => request<{ ok: true }>('/api/runs/' + id + '/pause', { method: 'POST' }),
  retryRun: (id: string) => request<{ ok: true; data: JsonMap }>('/api/runs/' + id + '/retry', { method: 'POST' }),
  workflowRunAction: (id: string, action: 'approve' | 'adjust' | 'cancel' | 'pause' | 'approved' | 'refazer' | 'complete') =>
    request<{ ok: true; data: JsonMap }>('/api/workflow/runs/' + id + '/action', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  reassignRun: (id: string, agentId: string) =>
    request<{ ok: true; data: JsonMap }>('/api/runs/' + id + '/reassign', {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    }),
  decide: (payload: { entityType: 'mission' | 'task' | 'run'; id: string; decision: 'approve' | 'reject'; reason?: string }) =>
    request<{ ok: true; data: JsonMap }>('/api/decisions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cardNotes: (entityType: 'mission' | 'task' | 'run', id: string) =>
    request<{ ok: true; data: { comments: JsonMap[]; findings: JsonMap[] } }>(`/api/cards/${entityType}/${id}/notes`),
  addCardComment: (entityType: 'mission' | 'task' | 'run', id: string, text: string) =>
    request<{ ok: true; data: JsonMap }>(`/api/cards/${entityType}/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  addCardFinding: (entityType: 'mission' | 'task' | 'run', id: string, text: string) =>
    request<{ ok: true; data: JsonMap }>(`/api/cards/${entityType}/${id}/findings`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  memory: () => request<{ ok: true; data: { daily: string[]; longTerm: string } }>('/api/memory'),
  auditLogs: (params?: { entityType?: string; entityId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.entityType) q.set('entityType', params.entityType);
    if (params?.entityId) q.set('entityId', params.entityId);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<{ ok: true; data: JsonMap[] }>(`/api/audit-logs${qs ? `?${qs}` : ''}`);
  },
};



