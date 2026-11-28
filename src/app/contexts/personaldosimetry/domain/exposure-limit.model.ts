/**
 * Límite de exposición ocupacional de un puesto de trabajo.
 *
 * Se configura **por puesto**, no por persona (RF18): el criterio depende de la
 * tarea, no de quién la hace. Un operario sin puesto no tiene límite aplicable
 * y su jornada no se puede evaluar.
 *
 * **Versionado, nunca editado.** Configurar de nuevo el mismo puesto crea una
 * versión con su propia fecha de vigencia; las jornadas ya cerradas siguen
 * evaluadas con la que estaba en vigor. Eso es lo que exige el RNF18, y por eso
 * la pantalla «añade» en vez de «editar».
 */
export interface ExposureLimit {
  id: number;
  organizationId: number;
  jobPositionId: number;
  version: number;
  limitIndex: number;
  warningRatio: number;
  methodId: string;
  unit: string;
  effectiveFrom: string;
  reference?: string | null;
}

export interface ConfigureLimitPayload {
  jobPositionId: number;
  limitIndex: number;
  warningRatio: number;
  /** ISO-8601 con zona. El backend lo recibe como `Instant`. */
  effectiveFrom: string;
  /** Norma o criterio del límite (obligatorio en el backend, hasta 250 caracteres). */
  reference: string;
}

/**
 * Referencias habituales de un límite de exposición a campo magnético. Se
 * guardan tal cual en la versión del límite, así que van sin traducir.
 */
export const LIMIT_REFERENCES: readonly string[] = [
  'ICNIRP 2010',
  'ICNIRP 1998',
  'IEEE C95.6',
  'Directiva 2013/35/UE',
  'Criterio interno de la empresa',
];

/** Lo que se guarda cuando el SSO no indica referencia (el backend la exige). */
export const UNSPECIFIED_LIMIT_REFERENCE = 'No especificada';

/**
 * Referencia que se envía: la elegida de la lista, la escrita en «Otra» o, si
 * no hay ninguna, «No especificada». Para el SSO es opcional.
 */
export function limitReference(choice: string, other: string): string {
  const value = choice === 'other' ? other.trim() : choice.trim();
  return value || UNSPECIFIED_LIMIT_REFERENCE;
}

/**
 * Valor para un `<input type="datetime-local">` con la hora local del navegador.
 * `toISOString()` daría la hora UTC, que el campo leería como local: en Lima
 * dejaría el límite vigente 5 horas en el futuro.
 */
export function localDateTimeInput(date: Date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Motivo por el que un límite no es válido, o null si lo es. */
export type LimitValidationError = 'limitIndex' | 'warningRatio' | 'jobPosition' | 'reference' | null;

/**
 * Valida antes de enviar, replicando las anotaciones del backend:
 * `limitIndex > 0` y `0 < warningRatio < 1`, **ambos extremos excluidos**.
 *
 * El 1 excluido no es un capricho: un umbral de advertencia igual al límite
 * avisaría en el mismo instante en que ya se ha superado, así que no avisaría
 * de nada. Y un 0 avisaría siempre.
 */
export function validateLimit(payload: ConfigureLimitPayload): LimitValidationError {
  if (!payload.jobPositionId) return 'jobPosition';
  if (!(payload.limitIndex > 0)) return 'limitIndex';
  if (!(payload.warningRatio > 0 && payload.warningRatio < 1)) return 'warningRatio';
  const reference = (payload.reference ?? '').trim();
  if (!reference || reference.length > 250) return 'reference';
  return null;
}

/** El valor absoluto en el que salta la advertencia, para mostrarlo junto al límite. */
export function warningThreshold(limit: ExposureLimit): number {
  return limit.limitIndex * limit.warningRatio;
}

/**
 * Versión vigente de cada puesto.
 *
 * El backend devuelve todas las versiones; la tabla muestra la última por
 * puesto y guarda el resto como historial. Se elige por `effectiveFrom` y, a
 * igualdad, por el número de versión más alto — el mismo criterio que usa
 * dosimetría al abrir una jornada.
 */
export function currentByPosition(limits: readonly ExposureLimit[]): ExposureLimit[] {
  const latest = new Map<number, ExposureLimit>();
  for (const limit of limits) {
    const previous = latest.get(limit.jobPositionId);
    if (!previous || isNewer(limit, previous)) latest.set(limit.jobPositionId, limit);
  }
  return [...latest.values()];
}

function isNewer(a: ExposureLimit, b: ExposureLimit): boolean {
  if (a.effectiveFrom !== b.effectiveFrom) return a.effectiveFrom > b.effectiveFrom;
  return a.version > b.version;
}
