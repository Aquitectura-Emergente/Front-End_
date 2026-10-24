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

/** Una alarma resuelta ya no admite resolverse de nuevo. */
export function canResolve(alarm: AlarmItem): boolean {
  return !alarm.resolved;
}
