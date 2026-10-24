/**
 * Estados de una orden de trabajo.
 *
 * El vocabulario es del dominio; las etiquetas y clases CSS se quedan en la
 * presentación a propósito, porque cada pantalla las rotula distinto (la
 * agenda del técnico usa 'IN PROGRESS' en mayúsculas y el resto 'In Progress').
 * Unificarlas cambiaría la interfaz, así que aquí solo vive el vocabulario.
 */
export type WorkOrderStatus = 'completed' | 'in-progress' | 'pending' | 'cancelled';

/** Estados en los que la orden sigue viva y admite acciones del técnico. */
export function isOpen(status: string): boolean {
  return status === 'pending' || status === 'in-progress';
}

/** Estados finales: ya no admiten cambios. */
export function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'cancelled';
}
