/** Sensor registrado en la plataforma. */
export interface Device {
  id: number;
  name: string;
  type: string;
  location: string;
  status: 'active' | 'unregistered' | 'requires-maintenance' | 'in-maintenance';
  serialNumber: string;
  installDate: string;
  createdAt: string;
  client?: string;
  clientId?: number;
  clientName?: string;
}

/** Clase de dispositivo que maneja Device Management. */
export type DeviceType = 'PERSONAL_DOSIMETER' | 'FIXED_SENSOR' | 'SMART_PLUG';

export const DEVICE_TYPES: readonly DeviceType[] = ['PERSONAL_DOSIMETER', 'FIXED_SENSOR', 'SMART_PLUG'];

/** Etiqueta corta que se guarda en `type` y que siguen usando las apps cliente. */
export function typeLabelFor(deviceType: DeviceType): string {
  switch (deviceType) {
    case 'PERSONAL_DOSIMETER': return 'Dosimeter';
    case 'FIXED_SENSOR': return 'Sensor';
    case 'SMART_PLUG': return 'Plug';
  }
}

/**
 * Alta y edición por `/api/devices`. El backend ignora `deviceType` al editar y
 * solo desvincula el cliente con `clientId = 0` (`null` lo deja como estaba).
 */
export interface CreateDevicePayload {
  name: string;
  type: string;
  location?: string;
  status?: string;
  serialNumber?: string;
  installDate?: string;
  clientId?: number | null;
  deviceType?: DeviceType;
}

export const UNLINK_CLIENT = 0;

/**
 * Dispositivo registrado en stock (sin cliente) que el técnico puede reclamar
 * en una instalación. El backend ya no crea seriales desconocidos: primero el
 * admin registra el serial y, si el equipo ya está reportando, trae su última
 * lectura.
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
 * Estado operativo del sensor. No confundir con el de usuario: aquí "active"
 * significa *instalado y operando*, mientras que en iam significa *cuenta
 * habilitada*. Son vocabularios distintos y no deben unificarse.
 */
export type DeviceStatus = Device['status'];

/** Estados que el admin puede fijar a mano; `unregistered` lo decide el backend. */
export const EDITABLE_DEVICE_STATUSES: readonly DeviceStatus[] = ['active', 'requires-maintenance', 'in-maintenance'];
