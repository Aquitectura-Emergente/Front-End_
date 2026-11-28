/**
 * Medida de mitigación: lo que el responsable de SSO decide cuando un operario
 * se acerca a su límite de exposición.
 *
 * Las propone el sistema —una excedencia confirmada por dosimetría, o una
 * rotación sugerida por el agente de IA— y **solo una persona las aprueba**. El
 * informe lo trata como una firma con consecuencias, y por eso el ADMIN queda
 * fuera de decidir aunque pueda administrar el catálogo de la planta.
 *
 * Los campos opcionales se **omiten** en la respuesta, no llegan como `null`
 * (`default-property-inclusion=non_null` en el backend).
 */
export interface MitigationAction {
  id: number;
  type: string;
  state: MitigationState;
  origin: string;
  priority: string;
  justification?: string | null;
  outcome?: string | null;
  supersededById?: number | null;
  trigger?: MitigationTrigger | null;
  decision?: MitigationDecision | null;
  affectedWorkers: AffectedWorker[];
  history: MitigationTransition[];
  createdAt: string;
}

/** Estados que publica el backend. `SUPERSEDED` llegó en la V21. */
export type MitigationState =
  | 'PROPOSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPLIED'
  | 'NOT_VIABLE'
  | 'SUPERSEDED';

export interface MitigationTrigger {
  kind?: string | null;
  sessionId?: string | null;
  suggestionId?: string | null;
  detectedAt?: string | null;
}

export interface MitigationDecision {
  decidedBy?: number | null;
  decidedAt?: string | null;
  reason?: string | null;
}

/**
 * Operario al que toca la medida.
 *
 * **Los nombres son los de `AffectedWorkerResource`, no los del turno.** Aquí
 * son `fromPositionId` / `toPositionId` / `toZoneId`; en `WorkerShift` los
 * mismos datos se llaman `currentJobPositionId` / `currentPlantZoneId`. Es una
 * divergencia de vocabulario del backend entre dos DTOs del mismo contexto, y
 * tipar estos campos con los nombres del turno dejó `needsTarget` roto:
 * leía propiedades que nunca llegan, así que el formulario de aprobación pedía
 * zona y puesto **siempre**, incluso cuando la propuesta ya traía destino.
 * Verificado contra el backend el 2026-11-13.
 *
 * No hay `fromZoneId`: el backend solo guarda el puesto de origen.
 */
export interface AffectedWorker {
  workerId: number;
  fromPositionId?: number | null;
  toPositionId?: number | null;
  toZoneId?: number | null;
  doseAtDecision?: DoseSnapshot | null;
}

/**
 * Foto de la dosis en el momento de decidir.
 *
 * Ojo con la unidad: este camino manda `uT.h` y `PROVISIONAL-TWA-V1`, distintos
 * de los `uT*s` y `MAGNETIC_TIME_INDEX_V1` de una sesión de dosimetría. Son dos
 * métodos de cálculo distintos, así que **se rotula lo que llega**.
 */
export interface DoseSnapshot {
  value?: number | null;
  unit?: string | null;
  methodId?: string | null;
  limit?: number | null;
  percentage?: number | null;
}

export interface MitigationTransition {
  fromState?: string | null;
  toState?: string | null;
  actorId?: number | null;
  at?: string | null;
}

export interface ApproveMitigationPayload {
  reason?: string;
  toPositionId?: number;
  toZoneId?: number;
}

export interface RejectMitigationPayload {
  /** Obligatorio: el backend lo valida con `@NotBlank`. */
  reason: string;
}

/**
 * Reubicación que el SSO decide por su cuenta, sin que nadie la proponga.
 *
 * Es la otra mitad de la bandeja: las medidas de `PROPOSED` las origina el
 * sistema, pero el responsable también puede mover a alguien porque lo ve en el
 * mapa. El backend la registra **ya aplicada** (`POST /relocations` devuelve 201
 * con la medida en su estado final), así que no pasa por aprobar.
 *
 * Los tres ids son `@NotNull` en `RegisterRelocationRequest`; la justificación
 * es libre, pero aquí se pide igualmente — ver `validateRelocation`.
 */
export interface RegisterRelocationPayload {
  workerId: number;
  toZoneId: number;
  toPositionId: number;
  justification?: string;
}

/** Motivo por el que un formulario de reubicación todavía no se puede enviar. */
export type RelocationValidationError =
  | 'relocation_worker_required'
  | 'relocation_zone_required'
  | 'relocation_position_required'
  | null;

/**
 * Valida la reubicación antes de enviarla.
 *
 * El backend solo exige los tres ids, pero **la justificación no se valida
 * aquí a propósito**: mover a una persona de puesto es una decisión que queda
 * auditada, y el informe la quiere motivada, pero `justification` es libre en
 * el DTO y poner un `@NotBlank` del lado del cliente mentiría sobre el
 * contrato. La pantalla la pide; el dominio no la impone.
 */
export function validateRelocation(
  payload: Partial<RegisterRelocationPayload>,
): RelocationValidationError {
  if (!payload.workerId) return 'relocation_worker_required';
  if (!payload.toZoneId) return 'relocation_zone_required';
  if (!payload.toPositionId) return 'relocation_position_required';
  return null;
}

/**
 * Solo una medida en `PROPOSED` se puede decidir.
 *
 * El resto ya tiene desenlace, y el backend responde 409 al intentarlo. Esto
 * evita ofrecer los botones de aprobar y rechazar sobre algo ya resuelto.
 */
export function isPending(action: MitigationAction): boolean {
  return action.state === 'PROPOSED';
}

/**
 * Una excedencia dice que hay que mover al operario, pero **no a dónde**: ese
 * dato lo pone la persona al aprobar. Una rotación sugerida por la IA sí
 * propone destino.
 *
 * Cuando falta el destino, el formulario de aprobación tiene que pedir zona y
 * puesto; si no, el backend rechaza la aprobación por incompleta.
 */
/** Medidas que cambian al operario de puesto. Reprogramar la tarea no lo mueve. */
export function movesWorker(action: Pick<MitigationAction, 'type'>): boolean {
  return action.type !== 'RESCHEDULING';
}

export function needsTarget(action: MitigationAction): boolean {
  if (!isPending(action) || !movesWorker(action)) return false;
  return action.affectedWorkers.some(w => !w.toPositionId || !w.toZoneId);
}

/** Operarios distintos que toca la medida. Una rotación es un intercambio: son dos. */
export function workerIds(action: MitigationAction): number[] {
  return [...new Set(action.affectedWorkers.map(w => w.workerId))];
}

/** Clave de traducción del estado, para no repartir el `switch` por las plantillas. */
export function stateLabelKey(state: MitigationState): string {
  return `mit_state_${state.toLowerCase()}`;
}
