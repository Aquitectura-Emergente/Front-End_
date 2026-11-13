import { WorkOrder } from './work-order.model';
import { isOpen } from './work-order-status';

/** Fila del calendario: las órdenes de un técnico agrupadas por día (`yyyy-mm-dd`). */
export interface TechnicianRow {
  technician: string;
  initials: string;
  days: Record<string, WorkOrder[]>;
  total: number;
}

export const UNASSIGNED = '';

/** `yyyy-mm-dd` en hora local, sin pasar por UTC. */
export function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Los siete días (lunes a domingo) de la semana que contiene `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/**
 * Agrupa por técnico las órdenes que caen en `days`. Las órdenes sin técnico
 * van en una fila propia, al final, para que no se pierdan de vista.
 */
export function groupByTechnician(orders: WorkOrder[], days: Date[]): TechnicianRow[] {
  const keys = new Set(days.map(isoDay));
  const rows = new Map<string, TechnicianRow>();
  for (const o of orders) {
    const day = (o.date ?? '').slice(0, 10);
    if (!keys.has(day)) continue;
    const tech = o.technician?.trim() || UNASSIGNED;
    let row = rows.get(tech);
    if (!row) {
      row = { technician: tech, initials: o.technicianInitials ?? '', days: {}, total: 0 };
      rows.set(tech, row);
    }
    (row.days[day] ??= []).push(o);
    row.total++;
  }
  return [...rows.values()].sort((a, b) =>
    a.technician === UNASSIGNED ? 1 : b.technician === UNASSIGNED ? -1 : a.technician.localeCompare(b.technician)
  );
}

/** Un técnico con más de una orden abierta el mismo día es un posible conflicto de agenda. */
export function hasConflict(orders: WorkOrder[] | undefined, technician: string): boolean {
  return technician !== UNASSIGNED && (orders ?? []).filter(o => isOpen(o.status)).length > 1;
}
