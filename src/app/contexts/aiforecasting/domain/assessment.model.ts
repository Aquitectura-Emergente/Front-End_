/**
 * Evaluación preventiva de AI Forecasting: la proyección del índice de
 * exposición de un operario hasta el fin de su turno.
 *
 * **Es una proyección, no una decisión.** Si un operario excedió o no su límite
 * lo decide Personal Dosimetry; este contexto solo estima (`isProjection` es
 * siempre `true`). La pantalla debe rotularlo así y no presentarlo como un
 * hecho medido.
 *
 * La unidad es el índice `uT*s` (`MAGNETIC_TIME_INDEX_V1`), no una dosis: se
 * rotula la unidad que llega y nunca se traduce ni se reescala.
 *
 * Los campos opcionales se **omiten** en la respuesta, no llegan como `null`
 * (`default-property-inclusion=non_null` en el backend).
 */
export interface Assessment {
  id: string;
  organizationId: number;
  workerId: number;
  sessionId: string;
  status: AssessmentStatus;
  /** Falta solo mientras la evaluación está en `PROJECTED`. */
  criticality?: Criticality;
  projection: Projection;
  /** Solo la reciben las evaluaciones HIGH y CRITICAL. */
  recommendation?: Recommendation;
  /** Puede faltar en una evaluación recién proyectada. */
  redaction?: Redaction;
  modelVersion: ModelVersion;
  limitVersionId?: number;
  triggerEventId?: string;
  assessedAt: string;
  closedAt?: string;
  closeReason?: CloseReason;
  isProjection: boolean;
}

export type AssessmentStatus = 'PROJECTED' | 'ASSESSED' | 'RECOMMENDED' | 'CLOSED';
export type Criticality = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type CloseReason = 'SUPERSEDED' | 'SESSION_ENDED';
export type RecommendationType = 'ROTATION' | 'RESCHEDULE_TASK';
export type RedactionSource = 'LLM' | 'FALLBACK';

/** Proyección `LINEAR_RATE_V1`. Índices en `unit` (uT*s); ratios sobre el límite. */
export interface Projection {
  currentIndex: number;
  limitIndex: number;
  /** uT*s por segundo. */
  accumulationRate: number;
  projectedIndexAtShiftEnd: number;
  /** `limit − current`. Puede ser negativo si ya se pasó del límite. */
  remainingMargin: number;
  /** `current / limit` (1 = 100 %). */
  consumedRatio: number;
  /** `projected / limit` (1 = 100 %). */
  projectedRatio: number;
  /** Falta si no se proyecta ninguna excedencia. */
  estimatedExceedanceAt?: string;
  shiftEnd: string;
  unit: string;
}

export interface Recommendation {
  type: RecommendationType;
  sourceWorkerId: number;
  /** Falta en `RESCHEDULE_TASK`: reprogramar no tiene destino. */
  targetWorkerId?: number;
  sourcePositionId?: number;
  targetPositionId?: number;
  estimatedBenefitIndex?: number;
  /** Solo contiene IDs, nunca nombres. */
  reason?: string;
}

/** Explicación en lenguaje natural, de Gemini (`LLM`) o de la plantilla (`FALLBACK`). */
export interface Redaction {
  text: string;
  generatedBy: RedactionSource;
  generatedAt: string;
}

export interface ModelVersion {
  modelId: string;
  version: string;
  /** p. ej. `LINEAR_RATE_V1`. */
  code: string;
}

// ── Reglas que consulta la vista ───────────────────────────────────────────

/** Tono visual; coincide con las clases globales `chip--*` de `styles.scss`. */
export type CriticalityTone = 'success' | 'accent' | 'warning' | 'danger' | 'neutral';

const TONES: Record<Criticality, CriticalityTone> = {
  LOW: 'success',
  MODERATE: 'accent',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const RANK: Record<Criticality, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };

/**
 * Clave de traducción de la criticidad. Sin criticidad (evaluación aún en
 * `PROJECTED`) se usa `af_criticality_none` en vez de inventar un nivel.
 */
export function criticalityLabelKey(criticality: Criticality | undefined): string {
  return criticality ? `af_criticality_${criticality.toLowerCase()}` : 'af_criticality_none';
}

export function criticalityTone(criticality: Criticality | undefined): CriticalityTone {
  return criticality ? TONES[criticality] : 'neutral';
}

/** Clase CSS lista para la plantilla (`chip chip--danger`, …). */
export function criticalityChipClass(criticality: Criticality | undefined): string {
  const tone = criticalityTone(criticality);
  return tone === 'neutral' ? 'chip' : `chip chip--${tone}`;
}

/** Orden numérico de la criticidad; sin nivel cuenta como la más baja. */
export function criticalityRank(criticality: Criticality | undefined): number {
  return criticality ? RANK[criticality] : -1;
}

/**
 * Convierte un ratio del backend (1 = 100 %) en porcentaje con 2 decimales.
 * Devuelve `null` si el ratio no llegó, para que la vista pinte «—» y no un 0
 * que parezca un dato.
 */
export function ratioToPercent(ratio: number | null | undefined): number | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return Math.round(ratio * 10000) / 100;
}

/** Porcentaje del límite ya consumido. */
export function consumedPercent(assessment: Assessment): number | null {
  return ratioToPercent(assessment.projection?.consumedRatio);
}

/** Porcentaje del límite proyectado al fin del turno. */
export function projectedPercent(assessment: Assessment): number | null {
  return ratioToPercent(assessment.projection?.projectedRatio);
}

/** Se proyecta que cruzará el límite antes de terminar el turno. */
export function projectsExceedance(assessment: Assessment): boolean {
  return !!assessment.projection?.estimatedExceedanceAt;
}

export function recommendationLabelKey(type: RecommendationType): string {
  return `af_recommendation_${type.toLowerCase()}`;
}

/**
 * Más urgente primero: criticidad descendente y, a igualdad, la excedencia más
 * cercana; las que no proyectan excedencia van al final. Es el mismo orden que
 * aplica `critical-workers` en el backend; sirve para no depender del orden de
 * llegada al mezclar páginas.
 */
export function byUrgency(assessments: readonly Assessment[]): Assessment[] {
  return [...assessments].sort((a, b) => {
    const byLevel = criticalityRank(b.criticality) - criticalityRank(a.criticality);
    if (byLevel !== 0) return byLevel;
    const ea = a.projection?.estimatedExceedanceAt;
    const eb = b.projection?.estimatedExceedanceAt;
    if (ea && eb) return ea.localeCompare(eb);
    if (ea) return -1;
    if (eb) return 1;
    return 0;
  });
}
