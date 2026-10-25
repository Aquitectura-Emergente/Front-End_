/** Tarjetas de resumen del panel de administración. */
export interface DashboardStats {
  totalSensors: number;
  sensorsDelta: string;
  activeClients: number;
  clientsDelta: string;
  pendingTasks: number;
  tasksStatus: string;
  criticalAlerts: number;
  alertsStatus: string;
  avgCompletionHours: number;
  currentRadiationAvg: number;
  safetyThreshold: number;
}

/** Fila reducida de orden de trabajo que se muestra en el dashboard. */
export interface LatestWorkOrder {
  id: number;
  orderId: string;
  siteLocation: string;
  technician: string;
  status: 'completed' | 'in-progress' | 'pending';
  date: string;
}

/** Aviso del feed del dashboard (distinto de la alarma gestionable de `alerts`). */
export interface Alert {
  id: number;
  type: 'danger' | 'info' | 'success';
  icon: string;
  title: string;
  description: string;
  time: string;
}

export interface ChartData {
  systemActivity: { series: number[]; categories: string[] };
  radiationTrends: { series: number[] };
  regional: { series: number[]; categories: string[] };
}
