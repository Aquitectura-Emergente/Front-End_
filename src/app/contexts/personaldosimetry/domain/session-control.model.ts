import { ExposureLimit, currentByPosition } from './exposure-limit.model';
import { ExposureSession } from './exposure-session.model';

/**
 * Reglas del control de jornadas desde el portal: abrir, cerrar y finalizar.
 *
 * Una jornada cerrada **no termina al cerrarla**. `close` la deja en `CLOSING`:
 * todavía entran las lecturas atrasadas del intervalo y el índice puede subir.
 * Solo `finalize` la congela (`CLOSED`), y sin ese paso la jornada no entra en
 * la analítica ni en el reporte de cumplimiento.
 *
 * El portal finaliza **siempre con `deliveryConfirmed: false`**: el backend solo
 * lo acepta pasado `reconciliationDeadline` (fin + 30 min). Confirmar la entrega
 * antes de tiempo dejaría las lecturas atrasadas como `LATE`, fuera del
 * resultado, y el índice final quedaría por debajo de la exposición real.
 */

export interface OpenSessionPayload {
  workerId: number;
  deviceId: number;
  jobPositionId: number;
  // Sin `startedAt` a propósito: la jornada empieza cuando la abre el SSO.
}

/** Fase visible de una jornada en el panel. */
export type SessionPhase = 'open' | 'processing' | 'closed';

export function sessionPhase(session: ExposureSession): SessionPhase {
  switch (session.state) {
    case 'OPEN': return 'open';
    case 'CLOSING': return 'processing';
    default: return 'closed';
  }
}

/**
 * Se puede finalizar desde el portal: la jornada espera reconciliación y ya
 * venció su plazo. Antes del plazo el backend respondería 409.
 */
export function canFinalize(session: ExposureSession, now: number = Date.now()): boolean {
  if (session.state !== 'CLOSING' || !session.reconciliationDeadline) return false;
  const deadline = Date.parse(session.reconciliationDeadline);
  return Number.isFinite(deadline) && now >= deadline;
}

/**
 * Límite vigente de cada puesto **a esta hora**.
 *
 * `currentByPosition` elige la última versión de cada puesto, pero no mira si
 * ya entró en vigor. El backend exige un límite con `effectiveFrom` anterior al
 * inicio de la jornada, así que una versión programada para mañana no sirve hoy:
 * se descartan antes de elegir.
 */
export function effectiveLimits(limits: readonly ExposureLimit[], now: number = Date.now()): ExposureLimit[] {
  return currentByPosition(limits.filter(l => Date.parse(l.effectiveFrom) <= now));
}

/** Ids de los puestos que tienen un límite vigente: los únicos que admite `POST /sessions`. */
export function positionsWithLimit(limits: readonly ExposureLimit[], now: number = Date.now()): Set<number> {
  return new Set(effectiveLimits(limits, now).map(l => l.jobPositionId));
}

/** Valores para prellenar el formulario a partir de la última jornada del operario. */
export interface StartDefaults {
  deviceId?: number;
  jobPositionId?: number;
}

export function defaultsFromLastSession(last: ExposureSession | null | undefined): StartDefaults {
  if (!last) return {};
  return { deviceId: last.deviceId, jobPositionId: last.jobPositionId ?? undefined };
}

export type StartValidationError = 'worker' | 'position' | 'device' | null;

export function validateStart(form: Partial<OpenSessionPayload>): StartValidationError {
  if (!form.workerId) return 'worker';
  if (!form.jobPositionId) return 'position';
  if (!form.deviceId) return 'device';
  return null;
}

/**
 * El dispositivo buscado por serial sirve como dosímetro de esta organización.
 * Lo demás (activo, sin otra jornada) lo valida el backend, que es quien manda.
 */
export function dosimeterProblem(
  device: { deviceType?: string | null; organizationId?: number | null },
  organizationId: number | null,
): 'notDosimeter' | 'otherOrganization' | null {
  if (device.deviceType !== 'PERSONAL_DOSIMETER') return 'notDosimeter';
  if (organizationId == null || device.organizationId !== organizationId) return 'otherOrganization';
  return null;
}

/** Fallo de una orden: el estado HTTP elige el título; el mensaje del backend se muestra tal cual. */
export interface CommandError {
  status: number;
  message: string;
}

export type CommandResult<T> = { ok: true; data: T } | { ok: false; error: CommandError };

export function commandErrorTitleKey(status: number): string {
  switch (status) {
    case 409: return 'sc_err_409';
    case 422: return 'sc_err_422';
    case 400: return 'sc_err_400';
    case 403: return 'sc_err_403';
    case 404: return 'sc_err_404';
    default: return 'sc_err_generic';
  }
}
