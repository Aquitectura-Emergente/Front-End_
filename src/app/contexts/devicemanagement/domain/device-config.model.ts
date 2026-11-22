/**
 * Configuración versionada del dispositivo. El umbral lo define el
 * responsable de SSO de la planta; muestreo e inactividad, el admin.
 */
export interface DeviceConfigView {
  deviceId: string;
  configVersion: number;
  alertThresholdUT: number;
  definedBy: 'SSO_RESPONSIBLE' | 'SYSTEM_DEFAULT';
  samplingIntervalMs: number;
  inactivityTimeoutS: number;
  updatedAt: string | null;
}

export interface OperationalConfigPayload {
  samplingIntervalMs?: number;
  inactivityTimeoutS?: number;
}

/** Cuerpo de `PUT /devices/{deviceId}/config/alert-threshold` (solo el SSO). */
export interface AlertThresholdPayload {
  alertThresholdUT: number;
}

/**
 * Devuelve la clave del error del umbral, o null si es válido. El backend
 * exige un número positivo; aquí solo se evita mandar algo que va a fallar.
 */
export function validateAlertThreshold(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return 'dm_thr_required';
  if (value <= 0) return 'dm_thr_positive';
  return null;
}

/** Límites que valida el backend. */
export const SAMPLING_MS = { min: 100, max: 3_600_000 } as const;
export const INACTIVITY_S = { min: 10, max: 86_400 } as const;

/** Devuelve la clave del error de validación, o null si los valores son válidos. */
export function validateOperationalConfig(p: OperationalConfigPayload): string | null {
  const s = p.samplingIntervalMs;
  const i = p.inactivityTimeoutS;
  if (s == null && i == null) return 'dm_cfg_nothingToSave';
  if (s != null && (!Number.isInteger(s) || s < SAMPLING_MS.min || s > SAMPLING_MS.max)) return 'dm_cfg_samplingRange';
  if (i != null && (!Number.isInteger(i) || i < INACTIVITY_S.min || i > INACTIVITY_S.max)) return 'dm_cfg_inactivityRange';
  return null;
}
