/**
 * Horas en la zona de la planta.
 *
 * El backend manda instantes UTC (`2026-11-10T14:40:00Z`). El SSO decide con la
 * hora de la planta, no con la de su navegador, así que se fija `America/Lima`
 * (la misma zona por defecto de la analítica del backend).
 *
 * Locale `en-US` como el pipe `dt`: la interfaz se traduce, el formato de fecha
 * del repo no.
 */
export const PLANT_TIME_ZONE = 'America/Lima';

const TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit', minute: '2-digit', timeZone: PLANT_TIME_ZONE,
};

const DATE_TIME: Intl.DateTimeFormatOptions = {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: PLANT_TIME_ZONE,
};

function format(iso: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  // Ausente → «—»: el backend omite los campos nulos (p. ej. sin excedencia).
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', options);
}

/** Solo la hora en Lima, p. ej. `09:40 AM`. */
export function limaTime(iso: string | null | undefined): string {
  return format(iso, TIME);
}

/** Día y hora en Lima, p. ej. `Nov 10, 09:40 AM`. */
export function limaDateTime(iso: string | null | undefined): string {
  return format(iso, DATE_TIME);
}
