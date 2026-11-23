/**
 * Alarma gestionable: se crea, se resuelve y se borra desde el panel.
 *
 * No confundir con el `Alert` de radiationmonitoring, que es un aviso de solo
 * lectura del feed del dashboard. Esta sí tiene ciclo de vida.
 */
export interface AlarmItem {
  id: number;
  type: 'danger' | 'info' | 'success' | 'warning';
  icon: string;
  title: string;
  description: string;
  time: string;
  resolved: boolean;
  resolvedAt: string | null;
  recipientType?: string;
  clientName?: string;
  sensor?: string;

  // ── Alerta de operario (backend V23; creación automática desde el 2026-11-22) ──
  // Ausentes en una alarma de cliente: el backend omite los nulos.
  organizationId?: number | null;
  workerId?: number | null;
  sessionId?: string | null;
  acknowledgedAt?: string | null;
  escalatedAt?: string | null;
  ssoResponsibleId?: number | null;
  escalationReason?: string | null;
}

/** Cuerpo de `POST /api/alarms/{id}/escalate`. */
export interface EscalateAlarmPayload {
  ssoResponsibleId: number;
  reason?: string;
}

/**
 * En qué punto está una alerta de operario, de la más avanzada a la menos:
 * resuelta, escalada al SSO, acusada por el operario o pendiente de acuse.
 */
export type WorkerAlertStatus = 'resolved' | 'escalated' | 'acknowledged' | 'pending';

export function workerAlertStatus(alarm: AlarmItem): WorkerAlertStatus {
  if (alarm.resolved) return 'resolved';
  if (alarm.escalatedAt) return 'escalated';
  if (alarm.acknowledgedAt) return 'acknowledged';
  return 'pending';
}

/**
 * El SSO puede escalar una alerta de operario que siga abierta y sin escalar.
 * No exige acuse previo: escalar sin acuse es justo el caso de la regla 10.
 */
export function canEscalate(alarm: AlarmItem): boolean {
  return !!alarm.workerId && !alarm.resolved && !alarm.escalatedAt;
}

/**
 * Inserta o reemplaza una alerta que llegó en vivo, manteniendo el orden de la
 * más reciente a la más antigua (el mismo del backend).
 */
export function upsertAlarm(list: AlarmItem[], incoming: AlarmItem): AlarmItem[] {
  const rest = list.filter(a => a.id !== incoming.id);
  return [incoming, ...rest].sort((a, b) => b.id - a.id);
}

export interface CreateAlarmPayload {
  type: 'danger' | 'info' | 'success' | 'warning';
  icon?: string;
  title: string;
  description?: string;
  recipientType?: 'all' | 'specific';
  clientIds?: number[];
  sensor?: string;
}

export type AlarmType = AlarmItem['type'];

/**
 * Una alarma ya resuelta no se vuelve a resolver.
 *
 * El modal de detalle pregunta esto para decidir si ofrece el botón. El backend
 * también lo valida; aquí evita ofrecer una acción que iba a fallar.
 */
export function canResolve(alarm: AlarmItem): boolean {
  return !alarm.resolved;
}
