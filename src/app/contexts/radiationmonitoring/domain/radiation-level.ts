/**
 * Clasificación de un campo electromagnético medido en microtesla (µT).
 *
 * IMPORTANTE — el edge es la autoridad de la clasificación. Esta función es
 * solo un *fallback* para lecturas que lleguen sin `level`, igual que
 * `RadiationLevel.byValue()` en el backend. Si una lectura trae `level`, se
 * respeta tal cual y no se recalcula.
 *
 * Los umbrales (referencia ICNIRP 50 Hz) están duplicados a propósito en tres
 * sitios y deben cambiarse juntos:
 *   - emsafe-edge-flask/monitoring/domain/services.py
 *   - Back-End/.../radiationmonitoring/domain/services/RadiationLevel.java
 *   - este archivo
 */
export const CAUTION_THRESHOLD_UT = 100;
export const DANGER_THRESHOLD_UT  = 200;

export type RadiationLevel = 'safe' | 'caution' | 'danger';

export function levelByValue(fieldUT: number): RadiationLevel {
  if (fieldUT < CAUTION_THRESHOLD_UT) return 'safe';
  if (fieldUT < DANGER_THRESHOLD_UT)  return 'caution';
  return 'danger';
}

/** Color del marcador/badge para cada nivel. */
export function colorForLevel(level: RadiationLevel): string {
  if (level === 'safe')    return '#16a34a';
  if (level === 'caution') return '#d97706';
  return '#dc2626';
}
