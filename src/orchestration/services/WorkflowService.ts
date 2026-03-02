import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
const workflowFile = path.join(dataDir, 'workflow-states.json');

interface WorkflowState {
  taskId: string;
  status: 'inbox' | 'working' | 'review' | 'done' | 'cancelled';
  previousStatus?: string;
  buttons: {
    primary?: string;
    secondary?: string;
    cancel?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  auditLog: {
    id: string;
    action: string;
    from: string;
    to: string;
    actor: string;
    timestamp: string;
    details?: string;
  }[];
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readJsonSafe(filePath: string, fallback: any = null): any {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const clean = String(raw || '').replace(/^\uFEFF/, '').trim();
    return clean ? JSON.parse(clean) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath: string, value: any): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, filePath);
}

// Botões por estado
const STATUS_BUTTONS: Record<string, any> = {
  inbox: { primary: 'Aprovar', secondary: 'Ajustar', cancel: true },
  working: { primary: 'Pausar', secondary: 'Concluir', cancel: true },
  review: { primary: 'Aprovado', secondary: 'Refazer', cancel: true },
  done: {},
  cancelled: {},
};

// Transições válidas
const VALID_TRANSITIONS: Record<string, string[]> = {
  inbox: ['working', 'cancelled'],
  working: ['review', 'working', 'cancelled'],
  review: ['working', 'done', 'cancelled'],
  done: [],
  cancelled: [],
};

function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function getButtonsForStatus(status: string): any {
  return STATUS_BUTTONS[status] || {};
}

// Map run status -> workflow status
function runStatusToWorkflow(runStatus: string): string {
  switch (runStatus) {
    case 'queued': return 'inbox';
    case 'running':
    case 'stopping': return 'working';
    case 'review':
    case 'waiting': return 'review';
    case 'done': return 'done';
    case 'failed':
    case 'stopped': return 'cancelled';
    default: return 'inbox';
  }
}

// Map workflow status -> run status
function workflowToRunStatus(workflowStatus: string): string {
  switch (workflowStatus) {
    case 'inbox': return 'queued';
    case 'working': return 'running';
    case 'review': return 'review';
    case 'done': return 'done';
    case 'cancelled': return 'stopped';
    default: return 'queued';
  }
}

// Lista todos os estados de workflow
export function listWorkflowStates(): WorkflowState[] {
  return readJsonSafe(workflowFile, []);
}

// Salva estados de workflow
function saveWorkflowStates(states: WorkflowState[]): void {
  writeJsonAtomic(workflowFile, states);
}

// Pega estado de uma task
export function getWorkflowState(taskId: string): WorkflowState | null {
  const states = listWorkflowStates();
  return states.find((s) => s.taskId === taskId) || null;
}

// Cria novo estado de workflow para uma task
export function createWorkflowState(taskId: string, actor: string = 'system'): WorkflowState {
  const states = listWorkflowStates();
  const now = new Date().toISOString();
  
  const state: WorkflowState = {
    taskId,
    status: 'inbox',
    buttons: getButtonsForStatus('inbox'),
    createdAt: now,
    updatedAt: now,
    auditLog: [{
      id: uid('audit'),
      action: 'created',
      from: 'none',
      to: 'inbox',
      actor,
      timestamp: now,
    }],
  };
  
  states.unshift(state);
  saveWorkflowStates(states);
  return state;
}

// Executa transição de estado (idempotente)
export function transitionWorkflow(
  taskId: string,
  action: string,
  actor: string = 'system'
): { ok: boolean; state?: WorkflowState; error?: string } {
  const states = listWorkflowStates();
  const idx = states.findIndex((s) => s.taskId === taskId);
  
  if (idx === -1) {
    // Se não existe, cria novo
    const newState = createWorkflowState(taskId, actor);
    return transitionWorkflow(taskId, action, actor);
  }
  
  const current = states[idx];
  const now = new Date().toISOString();
  
  // Mapear ação para transição
  let targetStatus: string | null = null;
  
  switch (action) {
    case 'approve':
    case 'start':
      if (current.status === 'inbox') targetStatus = 'working';
      break;
    case 'adjust':
      // Ajustar volta para inbox (pendente ajuste)
      if (current.status === 'inbox') targetStatus = 'inbox'; // Mantém mas não transição
      break;
    case 'pause':
      if (current.status === 'working') targetStatus = 'working'; // Mantém mas pode ter semantics diferente
      break;
    case 'resume':
      if (current.status === 'working') targetStatus = 'working';
      break;
    case 'complete':
    case 'finish':
      if (current.status === 'working') targetStatus = 'review';
      break;
    case 'rework':
    case 'refazer':
      if (current.status === 'review') targetStatus = 'working';
      break;
    case 'approve_final':
    case 'approved':
      if (current.status === 'review') targetStatus = 'done';
      break;
    case 'cancel':
    case 'cancelar':
      targetStatus = 'cancelled';
      break;
    default:
      return { ok: false, error: `unknown_action:${action}` };
  }
  
  // Se targetStatus é null, ação não é válida para o estado atual
  if (!targetStatus) {
    return { ok: false, error: `invalid_action_for_status:${action}:${current.status}` };
  }
  
  // Verifica se transição é válida
  if (!canTransition(current.status, targetStatus)) {
    return { ok: false, error: `invalid_transition:${current.status}->${targetStatus}` };
  }
  
  // Idempotência: se já está no estado alvo, retorna sucesso sem alterar
  if (current.status === targetStatus) {
    return { ok: true, state: current };
  }
  
  // Executa transição
  const previousStatus = current.status;
  const newButtons = getButtonsForStatus(targetStatus);
  
  const newAuditEntry = {
    id: uid('audit'),
    action,
    from: previousStatus,
    to: targetStatus,
    actor,
    timestamp: now,
  };
  
  states[idx] = {
    ...current,
    status: targetStatus as any,
    previousStatus,
    buttons: newButtons,
    updatedAt: now,
    auditLog: [...current.auditLog, newAuditEntry],
  };
  
  saveWorkflowStates(states);
  return { ok: true, state: states[idx] };
}

// Sincroniza estado do workflow com base no status do Run
export function syncWorkflowFromRun(taskId: string, runStatus: string): WorkflowState | null {
  const workflowStatus = runStatusToWorkflow(runStatus);
  const states = listWorkflowStates();
  const idx = states.findIndex((s) => s.taskId === taskId);
  
  const now = new Date().toISOString();
  
  if (idx === -1) {
    // Cria novo se não existe
    return createWorkflowState(taskId, 'system');
  }
  
  const current = states[idx];
  
  // Se o estado do workflow já está sincronizado, retorna
  if (current.status === workflowStatus) {
    return current;
  }
  
  // Atualiza para novo status (se transição válida)
  if (canTransition(current.status, workflowStatus)) {
    const newButtons = getButtonsForStatus(workflowStatus);
    states[idx] = {
      ...current,
      status: workflowStatus as any,
      previousStatus: current.status,
      buttons: newButtons,
      updatedAt: now,
      auditLog: [...current.auditLog, {
        id: uid('audit'),
        action: 'sync_from_run',
        from: current.status,
        to: workflowStatus,
        actor: 'system',
        timestamp: now,
        details: `run_status:${runStatus}`,
      }],
    };
    saveWorkflowStates(states);
    return states[idx];
  }
  
  return current;
}

// Pega botões para renderizar no Telegram/Kanban
export function getWorkflowButtons(taskId: string): { primary?: string; secondary?: string; cancel?: boolean } {
  const state = getWorkflowState(taskId);
  if (!state) {
    return getButtonsForStatus('inbox');
  }
  return state.buttons;
}
