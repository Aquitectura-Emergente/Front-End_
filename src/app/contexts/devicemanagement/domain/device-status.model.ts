import { DeviceType } from './device.model';

export type LifecycleStatus = 'IN_STOCK' | 'INSTALLED' | 'RETIRED';
export type Connectivity = 'ONLINE' | 'OFFLINE';

export const LIFECYCLE_STATUSES: readonly LifecycleStatus[] = ['IN_STOCK', 'INSTALLED', 'RETIRED'];

/**
 * Estado de un dispositivo en Device Management. `deviceId` es el serial, que
 * es la clave de todas las rutas `/api/v1/device-management/devices/{deviceId}`.
 */
export interface DeviceStatusView {
  id: number;
  deviceId: string;
  deviceType: DeviceType | null;
  lifecycleStatus: LifecycleStatus | null;
  operationalStatus: string | null;
  connectivity: Connectivity | null;
  connectivityChangedAt: string | null;
  connectivityEdgeNodeId: string | null;
  lastSeenAt: string | null;
  firmwareVersion: string | null;
  batteryLevel: number | null;
  organizationId: number | null;
  plantZoneId: number | null;
}

/** Un dispositivo retirado ya no vuelve atrás; el resto puede ir a cualquier otro estado. */
export function lifecycleTargets(current: LifecycleStatus | null): LifecycleStatus[] {
  const from = current ?? 'INSTALLED';
  if (from === 'RETIRED') return [];
  return LIFECYCLE_STATUSES.filter(s => s !== from);
}

/**
 * Solo se borra lo que no está instalado; un instalado primero pasa a stock o
 * se retira. El backend omite los nulos, así que un ciclo ausente llega como
 * `undefined` y tampoco se borra.
 */
export function canDelete(status: DeviceStatusView | null | undefined): boolean {
  return status?.lifecycleStatus != null && status.lifecycleStatus !== 'INSTALLED';
}
