/**
 * Lectura emitida por el backend (espejo de `ReadingDto`).
 *
 * El campo viaja siempre en microtesla (`field_uT`) de extremo a extremo:
 * ESP32 → edge → backend → web/móvil. `level` lo calcula el edge, que es la
 * autoridad de la clasificación; el backend no reclasifica.
 */
export interface Reading {
  id?: number;
  serialNumber: string;
  deviceDbId?: number;
  deviceName?: string;
  field_uT?: number;
  level?: string;
  message?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  clientId?: number;
  clientName?: string;
  recordedAt?: string;
}
