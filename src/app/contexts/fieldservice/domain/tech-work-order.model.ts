import { Device } from '../../iottelemetry/domain/device.model';
import { WorkOrderStatus } from './work-order-status';

/**
 * Sensor tal y como aparece *dentro* de una orden de trabajo.
 *
 * Su vocabulario de estado ('ok' | 'maintenance') es propio de la orden y no
 * coincide con `DeviceStatus` de iottelemetry: aquí describe el resultado de la
 * revisión, no el estado del sensor en la flota.
 */
export interface TechSensor {
  id: number;
  sensorId: string;
  location: string;
  status: 'ok' | 'maintenance';
}

export interface ActivityEntry {
  id: number;
  event: string;
  time: string;
}

export interface MaintenanceActionItem {
  id?: number;
  deviceId?: number | null;
  deviceName?: string;
  action: string;
  description?: string;
}

/** Orden de trabajo con todo el detalle que necesita el técnico en campo. */
export interface TechWorkOrder {
  id: number;
  orderId: string;
  type: string;
  status: WorkOrderStatus;
  client: string;
  clientId?: number;
  location: string;
  scheduledDate: string;
  scheduledTime: string;
  technicianId: number;
  priority: string;
  serviceType: string;
  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
  accessInstructions: string;
  requiredTools: string[];
  expectedSensors: number;
  assetId: string;
  sensors: TechSensor[];
  technicianNotes: string;
  completedAt?: string;
  cancellationReason?: string;
  activityLog: ActivityEntry[];
  evidence?: string[];
  maintenanceActions?: MaintenanceActionItem[];
  clientDevices?: Device[];
}

/**
 * Cuerpo del PATCH del ciclo de vida de la orden (estado, sensores, acciones,
 * evidencias). El backend decide qué aplicar según los campos presentes.
 */
export interface PatchTechWorkOrderBody {
  status?: string;
  technicianNotes?: string;
  cancellationReason?: string;
  sensors?: { sensorId: string; location: string; status: string }[];
  activityLogEntry?: { event: string; time: string };
  newDevices?: { name: string; type: string; serialNumber: string }[];
  // Instalación (discovery): reclamar sensores que el edge ya reporta.
  // El cliente y la ubicación los pone el backend desde la orden.
  claimedDevices?: { deviceId?: number; serialNumber?: string; name: string; type: string }[];
  deviceUpdates?: { deviceId: number; status: string; observation?: string }[];
  maintenanceActions?: { deviceId?: number | null; deviceName?: string; action: string; description?: string }[];
  evidence?: string[];
}
