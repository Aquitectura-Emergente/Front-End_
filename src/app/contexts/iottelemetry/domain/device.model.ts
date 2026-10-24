/** Sensor registrado en la plataforma. */
export interface Device {
  id: number;
  name: string;
  type: string;
  location: string;
  status: 'active' | 'inactive' | 'in-maintenance' | 'requires-maintenance' | 'collecting' | 'unregistered';
  serialNumber: string;
  installDate: string;
  createdAt: string;
  client?: string;
  clientId?: number;
  clientName?: string;
}

export interface CreateDevicePayload {
  name: string;
  type: string;
  location?: string;
  status?: string;
  serialNumber?: string;
  installDate?: string;
  clientId?: number | null;
}

/**
 * Sensor que el edge ya está reportando pero que aún no tiene cliente asignado.
 *
 * El backend los crea con `Device.unregistered(serial)` para no perder datos
 * cuando llega un serial desconocido; el técnico los reclama durante una
 * instalación.
 */
export interface DiscoverableDevice {
  deviceId: number;
  serialNumber: string;
  name: string;
  type: string;
  field_uT?: number;
  level?: string;
  lastSeen?: string;
  readingCount: number;
}

/**
 * Estado del sensor. No confundir con el de usuario: aquí "active" significa
 * *instalado y reportando*, mientras que en iam significa *cuenta habilitada*.
 * Son vocabularios distintos y no deben unificarse.
 */
export type DeviceStatus = Device['status'];

/** Un sensor sin cliente no tiene coordenadas ni topic por cliente. */
export function isUnregistered(device: Device): boolean {
  return device.status === 'unregistered';
}
