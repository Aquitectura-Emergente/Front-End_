import { WorkOrderStatus } from './work-order-status';

/** Fila de orden de trabajo en el listado del panel. */
export interface WorkOrder {
  id: number;
  orderId: string;
  type: string;
  client: string;
  location: string;
  city: string;
  date: string;
  technician: string;
  technicianInitials: string;
  status: WorkOrderStatus;
}

/** Orden completa para el formulario de edición. */
export interface WorkOrderDetail {
  id: number;
  orderId: string;
  type: string;
  client: string;
  clientId?: number;
  location: string;
  city?: string;
  date: string;
  technician: string;
  technicianInitials: string;
  status: WorkOrderStatus;
  scheduledDate?: string;
  scheduledTime?: string;
  technicianId?: number;
  priority?: string;
  notes?: string;
  cancellationReason?: string;
}

export interface CreateWorkOrderPayload {
  type: string;
  client: string;
  clientId?: number;
  location: string;
  city?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  technicianId?: number;
  priority?: string;
  notes?: string;
}

export interface UpdateWorkOrderPayload {
  type?: string;
  client?: string;
  clientId?: number;
  location?: string;
  city?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  technicianId?: number;
  priority?: string;
  notes?: string;
}

/** Entrada del historial de servicios cerrados. */
export interface HistoryItem {
  id: number;
  orderId: string;
  completionDate: string;
  completionTime: string;
  client: string;
  site: string;
  serviceType: string;
  technician: string;
  technicianInitials: string;
  status: 'completed' | 'cancelled';
  workOrderId?: number;
}
