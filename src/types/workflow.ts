/**
 * Workflow State Machine - Mission Control
 * 
 * Estados: inbox -> working -> review -> done
 * Transições válidas:
 * - inbox -> working (aprovar)
 * - working -> working (pausar/retomar)
 * - working -> review (concluir)
 * - review -> working (refazer)
 * - review -> done (aprovar_final)
 * - Qualquer estado -> cancelado (cancelar)
 */

export type WorkflowStatus = 'inbox' | 'working' | 'review' | 'done' | 'cancelled';

export interface WorkflowState {
  taskId: string;
  status: WorkflowStatus;
  previousStatus?: WorkflowStatus;
  buttons: WorkflowButtons;
  createdAt: string;
  updatedAt: string;
  auditLog: AuditEntry[];
}

export interface WorkflowButtons {
  primary?: string;      // Botão principal (ação primária)
  secondary?: string;    // Botão secundário
  cancel?: boolean;      // Se tem opção cancelar
}

export interface AuditEntry {
  id: string;
  action: string;
  from: WorkflowStatus;
  to: WorkflowStatus;
  actor: string;         // 'telegram' | 'kanban' | 'system'
  timestamp: string;
  details?: string;
}

// Botões por estado
export const STATUS_BUTTONS: Record<WorkflowStatus, WorkflowButtons> = {
  inbox: {
    primary: 'Aprovar',
    secondary: 'Ajustar',
    cancel: true,
  },
  working: {
    primary: 'Pausar',
    secondary: 'Concluir',
    cancel: true,
  },
  review: {
    primary: 'Aprovado',
    secondary: 'Refazer',
    cancel: true,
  },
  done: {
    // Sem botões - estado terminal
  },
  cancelled: {
    // Sem botões - estado terminal
  },
};

// Transições válidas
export const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  inbox: ['working', 'cancelled'],
  working: ['review', 'working', 'cancelled'],
  review: ['working', 'done', 'cancelled'],
  done: [],  // Estado terminal
  cancelled: [],  // Estado terminal
};

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getButtonsForStatus(status: WorkflowStatus): WorkflowButtons {
  return STATUS_BUTTONS[status] || {};
}

// Mapeamento RunStatus <-> WorkflowStatus
export function runStatusToWorkflow(runStatus: string): WorkflowStatus {
  switch (runStatus) {
    case 'queued':
      return 'inbox';
    case 'running':
    case 'stopping':
      return 'working';
    case 'review':
    case 'waiting':
      return 'review';
    case 'done':
      return 'done';
    case 'failed':
    case 'stopped':
      return 'cancelled';
    default:
      return 'inbox';
  }
}

export function workflowToRunStatus(workflowStatus: WorkflowStatus): string {
  switch (workflowStatus) {
    case 'inbox':
      return 'queued';
    case 'working':
      return 'running';
    case 'review':
      return 'review';
    case 'done':
      return 'done';
    case 'cancelled':
      return 'stopped';
    default:
      return 'queued';
  }
}
