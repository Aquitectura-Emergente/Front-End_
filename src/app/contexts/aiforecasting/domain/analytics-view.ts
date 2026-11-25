import {
  AnalyticsPeriod,
  AnalyticsSummary,
  PositionStats,
  WeekStats,
  WorkerStats,
  positionLabel,
  weekHasData,
} from './analytics-summary.model';
import { PLANT_TIME_ZONE } from './lima-time';
import { WorkerNames, workerName } from './worker-name';

/**
 * Reglas puras de la pantalla de analítica: el periodo por días de la planta,
 * las series de los gráficos, el orden de la tabla por operario y el CSV.
 */

const DAY_MS = 86_400_000;

// ── Periodo ────────────────────────────────────────────────────────────────

/** Días por defecto, los mismos que usa el backend sin `from`. */
export const DEFAULT_PERIOD_DAYS = 28;

/** Atajos del filtro. */
export const QUICK_PERIODS = [7, 28, 90] as const;

/**
 * Hoy en la planta, como `yyyy-MM-dd`. Con la fecha del navegador, un SSO que
 * mira la pantalla a las 20:00 de Lima (01:00 UTC) pediría el día equivocado.
 * `en-CA` es el locale que formatea así (año-mes-día).
 */
export function plantToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: PLANT_TIME_ZONE });
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Los últimos `days` días **inclusivos** hasta hoy en Lima (7 días = hoy y 6 atrás). */
export function lastDaysPeriod(days: number, now: Date = new Date()): Required<Pick<AnalyticsPeriod, 'from' | 'to'>> {
  const to = plantToday(now);
  return { from: addDays(to, -(days - 1)), to };
}

/** Qué atajo coincide con el periodo actual, para marcarlo como activo. */
export function matchingQuickPeriod(period: AnalyticsPeriod, now: Date = new Date()): number | null {
  for (const days of QUICK_PERIODS) {
    const p = lastDaysPeriod(days, now);
    if (p.from === period.from && p.to === period.to) return days;
  }
  return null;
}

/** El periodo no tiene jornadas cerradas: el histórico está vacío. */
export function isEmptyHistory(summary: AnalyticsSummary): boolean {
  return summary.totals.closedSessions === 0;
}

// ── Gráficos ───────────────────────────────────────────────────────────────

export interface WeeklySeries {
  /** `W47`; la semana completa va en `weekStarts` para el tooltip. */
  categories: string[];
  weekStarts: string[];
  /**
   * `null` en las semanas sin jornadas: ApexCharts deja un **hueco** en la
   * línea. Un 0 dibujaría una caída a cero que nunca ocurrió.
   */
  avg: (number | null)[];
  max: (number | null)[];
  /** Conteo: una semana vacía sí tiene 0 jornadas cerca del límite. */
  nearLimit: number[];
}

export function weeklySeries(weeks: readonly WeekStats[]): WeeklySeries {
  return {
    categories: weeks.map(w => w.isoWeek.split('-')[1] ?? w.isoWeek),
    weekStarts: weeks.map(w => w.weekStart),
    avg: weeks.map(w => (weekHasData(w) ? w.avgFinalIndex! : null)),
    max: weeks.map(w => (weekHasData(w) && w.maxFinalIndex != null ? w.maxFinalIndex : null)),
    nearLimit: weeks.map(w => w.sessionsNearLimit),
  };
}

export interface PositionBars {
  labels: string[];
  avg: number[];
  max: number[];
}

/** Puestos en el orden del backend (promedio descendente), con su nombre visible. */
export function positionBars(positions: readonly PositionStats[]): PositionBars {
  return {
    labels: positions.map(positionLabel),
    avg: positions.map(p => p.avgFinalIndex),
    max: positions.map(p => p.maxFinalIndex),
  };
}

// ── Tabla por operario ─────────────────────────────────────────────────────

export type WorkerSortKey = 'avgFinalIndex' | 'maxFinalIndex' | 'sessionsAboveWarning';
export type SortDirection = 'asc' | 'desc';

/**
 * Ordena sin mutar. A igualdad, por `workerId` ascendente para que el orden sea
 * estable entre refrescos y la tabla no «baile».
 */
export function sortWorkers(
  workers: readonly WorkerStats[],
  key: WorkerSortKey,
  direction: SortDirection,
): WorkerStats[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...workers].sort((a, b) => (a[key] - b[key]) * sign || a.workerId - b.workerId);
}

// ── CSV ────────────────────────────────────────────────────────────────────

type Cell = string | number | boolean | null | undefined;

/**
 * Una celda CSV segura.
 *
 * - Ausente → vacía: el backend omite los nulos y un 0 sería un dato inventado.
 * - Comillas, comas y saltos de línea se escapan (RFC 4180).
 * - **Inyección de fórmulas:** un texto que empieza por `= + - @` lo ejecutaría
 *   Excel al abrir el archivo. Los nombres vienen de cuentas de usuario, así que
 *   se neutralizan con un apóstrofo. Los números no: un margen negativo es un
 *   número, no una fórmula.
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(cells: Cell[]): string {
  return cells.map(csvCell).join(',');
}

/**
 * CSV del resumen para la plantilla del reporte de cumplimiento.
 *
 * Varias tablas en un archivo, cada una con un título y su cabecera, separadas
 * por una línea vacía. Las cabeceras son los nombres de campo del backend, en
 * inglés y sin traducir, para que la plantilla no dependa del idioma de la
 * interfaz. Índices en `unit` (uT*s), sin convertir.
 */
export function analyticsCsv(summary: AnalyticsSummary, names: WorkerNames): string {
  const t = summary.totals;
  const lines: string[] = [
    row(['EMSafe exposure analytics']),
    row(['organizationId', summary.organizationId]),
    row(['from', summary.from]),
    row(['to', summary.to]),
    row(['zone', summary.zone]),
    row(['unit', summary.unit]),
    row(['methodId', summary.methodId]),
    row(['isProjection', summary.isProjection]),
    row(['generatedAt', summary.generatedAt]),
    '',
    row(['totals']),
    row(['closedSessions', 'workers', 'sessionsAboveWarning', 'sessionsNearLimit', 'sessionsNearLimitPct',
      'sessionsExceeded', 'sessionsExceededPct', 'incompleteCoverageSessions', 'nearLimitRatio']),
    row([t.closedSessions, t.workers, t.sessionsAboveWarning, t.sessionsNearLimit, t.sessionsNearLimitPct,
      t.sessionsExceeded, t.sessionsExceededPct, t.incompleteCoverageSessions, t.nearLimitRatio]),
    '',
    row(['perWorker']),
    row(['workerId', 'workerName', 'sessions', 'avgFinalIndex', 'maxFinalIndex', 'maxRatio',
      'sessionsAboveWarning', 'sessionsNearLimit', 'sessionsExceeded']),
    ...summary.perWorker.map(w => row([w.workerId, workerName(w.workerId, names), w.sessions, w.avgFinalIndex,
      w.maxFinalIndex, w.maxRatio, w.sessionsAboveWarning, w.sessionsNearLimit, w.sessionsExceeded])),
    '',
    row(['weeklyTrend']),
    row(['isoWeek', 'weekStart', 'sessions', 'avgFinalIndex', 'maxFinalIndex', 'sessionsNearLimit',
      'sessionsExceeded']),
    ...summary.weeklyTrend.map(w => row([w.isoWeek, w.weekStart, w.sessions, w.avgFinalIndex, w.maxFinalIndex,
      w.sessionsNearLimit, w.sessionsExceeded])),
    '',
    row(['topPositions']),
    row(['positionId', 'positionName', 'sessions', 'avgFinalIndex', 'maxFinalIndex']),
    ...summary.topPositions.map(p => row([p.positionId, p.positionName, p.sessions, p.avgFinalIndex,
      p.maxFinalIndex])),
  ];
  // CRLF: el fin de línea que espera Excel y el que pide RFC 4180.
  return lines.join('\r\n') + '\r\n';
}

export function analyticsCsvFileName(summary: AnalyticsSummary): string {
  return `emsafe-exposure-analytics-${summary.organizationId}-${summary.from}_${summary.to}.csv`;
}
