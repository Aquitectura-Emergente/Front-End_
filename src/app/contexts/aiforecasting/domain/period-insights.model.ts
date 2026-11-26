import { AnalyticsPeriod } from './analytics-summary.model';
import { RedactionSource } from './assessment.model';

/**
 * Análisis con IA de un periodo
 * (`POST /v1/ai-forecasting/analytics/organizations/{id}/insights`).
 *
 * Es una lectura **consultiva** del resumen analítico: no cambia criticidades,
 * evaluaciones ni recomendaciones del motor (`isAdvisory` siempre `true`). La
 * redacta Gemini (`LLM`) o, si no está disponible, reglas deterministas
 * (`FALLBACK`), con la misma estructura en ambos casos.
 *
 * Los textos (`resumen`, `texto`, `accion`, `motivo`) **ya traen los nombres**
 * de los operarios, resueltos en el backend: a Gemini solo le llegan seudónimos.
 * `operariosAfectados`, en cambio, son `workerId` y el portal los nombra.
 *
 * Los campos opcionales se **omiten** en la respuesta, no llegan como `null`.
 */
export interface PeriodInsights {
  organizationId: number;
  generatedBy: RedactionSource;
  /** Solo con `LLM`, p. ej. `gemini-2.5-flash`. */
  model?: string;
  generatedAt: string;
  period: InsightsPeriod;
  isAdvisory: boolean;
  disclaimer: string;
  resumen: string;
  hallazgos: Hallazgo[];
  recomendaciones: Recomendacion[];
  /** Cobertura incompleta o pocos datos; falta si no hay nada que advertir. */
  calidadDatos?: string;
}

/** Periodo **resuelto** por el backend (días inclusivos en `zone`). */
export interface InsightsPeriod {
  from: string;
  to: string;
  zone: string;
}

export type HallazgoNivel = 'INFO' | 'ATENCION' | 'CRITICO';
export type Prioridad = 'ALTA' | 'MEDIA' | 'BAJA';

export interface Hallazgo {
  texto: string;
  nivel: HallazgoNivel;
}

export interface Recomendacion {
  accion: string;
  motivo: string;
  prioridad: Prioridad;
  operariosAfectados: number[];
  puestosAfectados: PuestoAfectado[];
}

export interface PuestoAfectado {
  positionId: number;
  /** Falta si Plant Configuration no conoce el puesto. */
  positionName?: string;
}

/**
 * Resultado de pedir el análisis. Lleva el **estado HTTP** además del mensaje:
 * un 403 se muestra como «Sin permiso» y el resto como un error con Reintentar.
 */
export type InsightsResult =
  | { ok: true; data: PeriodInsights }
  | { ok: false; status: number; message: string };

// ── Reglas que consulta la vista ───────────────────────────────────────────

const PRIORITY_RANK: Record<Prioridad, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

/** De más a menos prioritaria; a igual prioridad se conserva el orden del backend. */
export function byPriority(recommendations: readonly Recomendacion[]): Recomendacion[] {
  return recommendations
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (PRIORITY_RANK[a.r.prioridad] ?? 9) - (PRIORITY_RANK[b.r.prioridad] ?? 9) || a.i - b.i)
    .map(x => x.r);
}

/** Clase `pill` del portal SSO: ALTA rojo, MEDIA ámbar, BAJA neutro. */
export function priorityPillClass(priority: Prioridad): string {
  switch (priority) {
    case 'ALTA': return 'pill pill--danger';
    case 'MEDIA': return 'pill pill--warn';
    default: return 'pill pill--off';
  }
}

/** Tono del hallazgo: CRITICO rojo, ATENCION ámbar, INFO neutro. */
export function findingTone(level: HallazgoNivel): 'danger' | 'warn' | 'neutral' {
  switch (level) {
    case 'CRITICO': return 'danger';
    case 'ATENCION': return 'warn';
    default: return 'neutral';
  }
}

export function findingLabelKey(level: HallazgoNivel): string {
  return `ai_level_${level.toLowerCase()}`;
}

export function priorityLabelKey(priority: Prioridad): string {
  return `ai_priority_${priority.toLowerCase()}`;
}

/** «IA (Gemini)» o «Reglas automáticas». */
export function insightsSourceKey(generatedBy: RedactionSource): string {
  return generatedBy === 'LLM' ? 'ai_source_llm' : 'ai_source_fallback';
}

/** Puesto por su nombre, o su id si Plant Configuration no lo conoce. */
export function affectedPositionLabel(position: PuestoAfectado): string {
  return position.positionName?.trim() || `#${position.positionId}`;
}

/**
 * El análisis corresponde al periodo que se está viendo. Si el SSO cambió el
 * filtro después de generarlo, la pantalla lo marca como «de otro periodo» en
 * vez de presentarlo como lectura del periodo actual.
 */
export function insightsMatchPeriod(insights: PeriodInsights, period: AnalyticsPeriod | null): boolean {
  if (!period) return false;
  return insights.period.from === period.from && insights.period.to === period.to;
}
