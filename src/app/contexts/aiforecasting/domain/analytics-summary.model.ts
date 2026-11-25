import { Criticality, RecommendationType } from './assessment.model';

/**
 * Resumen analítico de una organización
 * (`GET /v1/ai-forecasting/analytics/organizations/{id}/summary`).
 *
 * Mezcla dos naturalezas que la pantalla debe distinguir:
 *  - el **histórico** (`totals`, `perWorker`, `weeklyTrend`, `topPositions`,
 *    `workersAboveWarning`) es dato **medido** por Personal Dosimetry
 *    (`isProjection = false`), solo de jornadas `CLOSED`;
 *  - `projectedCriticalWorkers` es una **proyección** y una foto de *ahora*: no
 *    depende del periodo pedido.
 *
 * Los campos opcionales se **omiten** en la respuesta, no llegan como `null`.
 */
export interface AnalyticsSummary {
  organizationId: number;
  /** Primer día del periodo (inclusivo), `yyyy-MM-dd` en `zone`. */
  from: string;
  /** Último día del periodo (inclusivo), `yyyy-MM-dd` en `zone`. */
  to: string;
  zone: string;
  unit: string;
  methodId: string;
  isProjection: boolean;
  generatedAt: string;
  totals: AnalyticsTotals;
  perWorker: WorkerStats[];
  weeklyTrend: WeekStats[];
  topPositions: PositionStats[];
  workersAboveWarning: WarningWorker[];
  projectedCriticalWorkers: ProjectedCritical[];
  recommendations: RecommendationTotals;
}

export interface AnalyticsTotals {
  closedSessions: number;
  workers: number;
  sessionsAboveWarning: number;
  sessionsNearLimit: number;
  /** Falta si el periodo no tiene jornadas. */
  sessionsNearLimitPct?: number;
  sessionsExceeded: number;
  /** Falta si el periodo no tiene jornadas. */
  sessionsExceededPct?: number;
  incompleteCoverageSessions: number;
  /** Umbral de «cerca del límite» (índice final / límite), p. ej. 0.90. */
  nearLimitRatio: number;
}

export interface WorkerStats {
  workerId: number;
  sessions: number;
  avgFinalIndex: number;
  maxFinalIndex: number;
  /** Mayor índice final / límite del operario. */
  maxRatio: number;
  sessionsAboveWarning: number;
  sessionsNearLimit: number;
  sessionsExceeded: number;
}

export interface WeekStats {
  /** Semana ISO, p. ej. `2026-W47`. */
  isoWeek: string;
  /** Lunes de la semana, `yyyy-MM-dd`. */
  weekStart: string;
  sessions: number;
  /** Falta en una semana sin jornadas. */
  avgFinalIndex?: number;
  /** Falta en una semana sin jornadas. */
  maxFinalIndex?: number;
  sessionsNearLimit: number;
  sessionsExceeded: number;
}

export interface PositionStats {
  positionId: number;
  /** Falta si Plant Configuration no conoce el puesto o no respondió. */
  positionName?: string;
  sessions: number;
  avgFinalIndex: number;
  maxFinalIndex: number;
}

export interface WarningWorker {
  workerId: number;
  sessionsAboveWarning: number;
  /** Fin de la última jornada sobre la advertencia. */
  lastAt: string;
}

export interface ProjectedCritical {
  assessmentId: string;
  workerId: number;
  sessionId: string;
  /** Solo HIGH o CRITICAL. */
  criticality: Extract<Criticality, 'HIGH' | 'CRITICAL'>;
  currentIndex: number;
  projectedIndex: number;
  limitIndex: number;
  projectedRatio: number;
  estimatedExceedanceAt?: string;
  recommendationType?: RecommendationType;
  targetWorkerId?: number;
  isProjection: boolean;
}

export interface RecommendationTotals {
  rotation: number;
  rescheduleTask: number;
  /** Suma de `estimatedBenefitIndex`, en uT*s. */
  estimatedBenefitIndex: number;
}

/** Filtro del resumen. Sin valores, el backend usa los últimos 28 días en America/Lima. */
export interface AnalyticsPeriod {
  from?: string;
  to?: string;
  zone?: string;
}

// ── Reglas que consulta la vista ───────────────────────────────────────────

/** Mismo tope que `AnalyticsSummaryQueryHandler.MAX_RANGE_DAYS`. */
export const MAX_PERIOD_DAYS = 366;

/** `'order'`: `from` posterior a `to`; `'range'`: más de 366 días; `'format'`: fecha inválida. */
export type PeriodValidationError = 'format' | 'order' | 'range' | null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(day: string): number | null {
  if (!ISO_DATE.test(day)) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  // Rechaza fechas que Date normaliza en silencio (p. ej. 2026-02-31).
  return new Date(ms).toISOString().slice(0, 10) === day ? ms : null;
}

/**
 * Valida el periodo antes de pedirlo, con las mismas reglas que el backend
 * (que respondería 400). Los extremos son opcionales: el que falta lo completa
 * el servidor. Los días son inclusivos: del 1 al 1 es un periodo de un día.
 */
export function validatePeriod(period: AnalyticsPeriod): PeriodValidationError {
  const from = period.from ? parseDay(period.from) : undefined;
  const to = period.to ? parseDay(period.to) : undefined;
  if (from === null || to === null) return 'format';
  if (from === undefined || to === undefined) return null;
  if (from > to) return 'order';
  const days = Math.round((to - from) / 86_400_000) + 1;
  return days > MAX_PERIOD_DAYS ? 'range' : null;
}

/** La semana tiene jornadas; una vacía no trae promedio ni máximo. */
export function weekHasData(week: WeekStats): boolean {
  return week.sessions > 0 && week.avgFinalIndex != null;
}

/**
 * Nombre visible del puesto. Si Plant Configuration no lo resolvió, se muestra
 * su id en vez de dejar la fila en blanco.
 */
export function positionLabel(position: PositionStats): string {
  return position.positionName?.trim() || `#${position.positionId}`;
}
