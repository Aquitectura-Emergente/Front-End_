/**
 * Sesión de exposición de un operario: lo que su dosímetro acumuló durante un
 * turno.
 *
 * **Ojo con la unidad y con la palabra «dosis».** El backend documenta
 * `ExposureIndex` como *«Operational demonstration index. It does not represent
 * a certified occupational dose»*, y la unidad que viaja es `uT*s`, no µT·h. Lo
 * que se muestra es un índice de demostración, así que la pantalla **rotula la
 * unidad que llega** y nunca la traduce ni la reescala.
 *
 * Los campos opcionales se **omiten** en la respuesta, no llegan como `null`
 * (`default-property-inclusion=non_null` en el backend).
 */
export interface ExposureSession {
  id: string;
  organizationId: number;
  workerId: number;
  deviceId: number;
  jobPositionId?: number | null;
  limitVersionId?: number | null;
  state: ExposureSessionState;
  methodId: string;
  unit: string;
  accumulatedIndex: number;
  limitIndex: number;
  /** Porcentaje del límite ya consumido. Lo calcula el backend. */
  percentage: number;
  warningRaised: boolean;
  limitExceeded: boolean;
  /** Porcentaje del turno realmente cubierto por lecturas. */
  coveragePercentage: number;
  coverageComplete: boolean;
  startedAt: string;
  endedAt?: string | null;
  reconciliationDeadline?: string | null;
  finalizedAt?: string | null;
  outOfRangeReadings: number;
}

/**
 * `CLOSING` es un estado real, no un detalle interno: la sesión dejó de medir
 * pero aún espera lecturas atrasadas hasta su `reconciliationDeadline`. Hasta
 * que no se finaliza, el índice puede subir.
 */
export type ExposureSessionState = 'OPEN' | 'CLOSING' | 'CLOSED';

/** Lectura individual del dosímetro dentro de una sesión. */
export interface PersonalReading {
  id: string;
  sessionId: string;
  deviceId: number;
  bootId: string;
  sequence: number;
  fieldMicrotesla: number;
  unit: string;
  capturedFrom: string;
  capturedTo: string;
  receivedAt: string;
  /** `LATE` es una lectura que llegó después de cerrar la sesión. */
  status: PersonalReadingStatus;
}

export type PersonalReadingStatus = 'ACCEPTED' | 'LATE';

/**
 * Gravedad de una sesión, para pintarla sin repartir condiciones por la
 * plantilla.
 *
 * Se decide con las **banderas que manda el backend**, no recalculando el
 * porcentaje: el cruce del aviso depende del `warningRatio` del límite vigente
 * de ese puesto, que la sesión no trae. Reconstruirlo aquí sería un cuarto
 * duplicado de una regla que ya está en dosimetría.
 */
export type ExposureSeverity = 'exceeded' | 'warning' | 'normal';

export function severityOf(session: ExposureSession): ExposureSeverity {
  if (session.limitExceeded) return 'exceeded';
  if (session.warningRaised) return 'warning';
  return 'normal';
}

/** Clase CSS y clave de traducción salen del mismo sitio que la gravedad. */
export function severityLabelKey(session: ExposureSession): string {
  return `exp_severity_${severityOf(session)}`;
}

export function stateLabelKey(state: ExposureSessionState): string {
  return `exp_state_${state.toLowerCase()}`;
}

/**
 * Una sesión con cobertura incompleta **no es de fiar todavía**.
 *
 * Si faltan tramos sin lecturas, el índice acumulado está por debajo de lo real
 * y decidir con él una rotación sería decidir con datos a medias. Es un aviso
 * que el responsable tiene que ver, y el motivo de que `coveragePercentage`
 * exista en la respuesta.
 */
export function hasGaps(session: ExposureSession): boolean {
  return !session.coverageComplete;
}

/**
 * Sesión que aún puede cambiar de valor.
 *
 * Mientras no esté finalizada, siguen entrando lecturas atrasadas —`LATE`— y el
 * acumulado sube. Sirve para avisar de que lo que se ve no es definitivo.
 */
export function isProvisional(session: ExposureSession): boolean {
  return !session.finalizedAt;
}

/**
 * Ordena de más reciente a más antigua.
 *
 * El backend ya devuelve el historial en ese orden
 * (`findByOrganizationIdAndWorkerIdOrderByStartedAtDesc`), pero la pantalla
 * mezcla páginas al paginar y no debe depender del orden de llegada.
 */
export function byMostRecent(sessions: readonly ExposureSession[]): ExposureSession[] {
  return [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
