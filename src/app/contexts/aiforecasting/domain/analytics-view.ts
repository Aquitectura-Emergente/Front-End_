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
import { PeriodInsights, affectedPositionLabel, byPriority } from './period-insights.model';

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

export type ChartLocale = 'en' | 'es';

const MONTHS: Record<ChartLocale, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Raya de rango (en dash), sin espacios: «16–22 nov». */
const DASH = '–';

interface Day { y: number; m: number; d: number; }

function toDay(iso: string): Day {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

/**
 * Tramo **real** de una semana dentro del periodo pedido.
 *
 * `weekStart` (lunes) y `from`/`to` ya son días de calendario en America/Lima:
 * el backend los calcula en `zone`. Por eso se opera con fechas `yyyy-MM-dd` y
 * no con instantes: no hay conversión de zona que pueda correr un día.
 *
 * Si el periodo empieza un jueves, la primera semana es «jueves–domingo»:
 * mostrar el lunes haría creer que esa semana tiene datos de días no pedidos.
 */
export function weekSpan(
  weekStart: string,
  period?: { from?: string; to?: string } | null,
): { start: string; end: string; partial: boolean } {
  const weekEnd = addDays(weekStart, 6);
  const start = period?.from && period.from > weekStart ? period.from : weekStart;
  const end = period?.to && period.to < weekEnd ? period.to : weekEnd;
  return { start, end, partial: start !== weekStart || end !== weekEnd };
}

/**
 * Rango corto para el eje X, sin año.
 * ES «16–22 nov» / «30 nov–6 dic»; EN «Nov 16–22» / «Nov 30–Dec 6».
 */
export function shortRangeLabel(start: string, end: string, locale: ChartLocale): string {
  const a = toDay(start);
  const b = toDay(end);
  const months = MONTHS[locale];
  const sameMonth = a.m === b.m && a.y === b.y;
  if (locale === 'es') {
    if (start === end) return `${a.d} ${months[a.m]}`;
    return sameMonth ? `${a.d}${DASH}${b.d} ${months[a.m]}` : `${a.d} ${months[a.m]}${DASH}${b.d} ${months[b.m]}`;
  }
  if (start === end) return `${months[a.m]} ${a.d}`;
  return sameMonth ? `${months[a.m]} ${a.d}${DASH}${b.d}` : `${months[a.m]} ${a.d}${DASH}${months[b.m]} ${b.d}`;
}

/**
 * Rango completo con año para el tooltip.
 * ES «16–22 nov 2026» / «29 dic 2025–4 ene 2026»; EN «Nov 16–22, 2026» /
 * «Dec 29, 2025–Jan 4, 2026».
 */
export function fullRangeLabel(start: string, end: string, locale: ChartLocale): string {
  const a = toDay(start);
  const b = toDay(end);
  const months = MONTHS[locale];
  if (a.y !== b.y) {
    return locale === 'es'
      ? `${a.d} ${months[a.m]} ${a.y}${DASH}${b.d} ${months[b.m]} ${b.y}`
      : `${months[a.m]} ${a.d}, ${a.y}${DASH}${months[b.m]} ${b.d}, ${b.y}`;
  }
  return locale === 'es'
    ? `${shortRangeLabel(start, end, locale)} ${a.y}`
    : `${shortRangeLabel(start, end, locale)}, ${a.y}`;
}

/** Número de la semana ISO a partir de `2026-W47` → 47. */
export function isoWeekNumber(isoWeek: string): number | null {
  const match = /W(\d{1,2})$/.exec(isoWeek);
  return match ? Number(match[1]) : null;
}

/** Palabras traducidas del tooltip; las da la vista con `LanguageService`. */
export interface WeekWords {
  /** «semana» / «week». */
  week: string;
  /** «semana parcial» / «partial week». */
  partial: string;
}

export interface WeeklySeriesOptions {
  /** Periodo resuelto del resumen, para recortar las semanas parciales. */
  period?: { from?: string; to?: string } | null;
  locale?: ChartLocale;
  words?: WeekWords;
}

export interface WeeklySeries {
  /** Etiqueta del eje X: el tramo real, p. ej. «16–22 nov». */
  categories: string[];
  /** Tooltip: «16–22 nov 2026 (semana 47)», o «(semana 47, semana parcial)». */
  tooltips: string[];
  /** La semana solo está cubierta en parte por el periodo. */
  partial: boolean[];
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

const DEFAULT_WORDS: Record<ChartLocale, WeekWords> = {
  es: { week: 'semana', partial: 'semana parcial' },
  en: { week: 'week', partial: 'partial week' },
};

export function weeklySeries(weeks: readonly WeekStats[], options: WeeklySeriesOptions = {}): WeeklySeries {
  const locale = options.locale ?? 'es';
  const words = options.words ?? DEFAULT_WORDS[locale];
  const spans = weeks.map(w => weekSpan(w.weekStart, options.period));
  return {
    categories: spans.map(s => shortRangeLabel(s.start, s.end, locale)),
    tooltips: weeks.map((w, i) => {
      const s = spans[i];
      const n = isoWeekNumber(w.isoWeek);
      const details = [n != null ? `${words.week} ${n}` : w.isoWeek, ...(s.partial ? [words.partial] : [])];
      return `${fullRangeLabel(s.start, s.end, locale)} (${details.join(', ')})`;
    }),
    partial: spans.map(s => s.partial),
    weekStarts: weeks.map(w => w.weekStart),
    avg: weeks.map(w => (weekHasData(w) ? w.avgFinalIndex! : null)),
    max: weeks.map(w => (weekHasData(w) && w.maxFinalIndex != null ? w.maxFinalIndex : null)),
    nearLimit: weeks.map(w => w.sessionsNearLimit),
  };
}

/**
 * Eje de conteos (jornadas cerca del límite): enteros, desde 0 y con aire
 * arriba, para que una sola jornada no llene el gráfico.
 *
 * El máximo es el conteo más alto + 1, y como mínimo 5. Hasta 10 hay una marca
 * por unidad; por encima se redondea a un múltiplo de 5 con 5 marcas, para que
 * cada paso siga siendo entero (ApexCharts reparte `max` en `tickAmount` partes).
 */
export function countAxis(counts: readonly number[]): { min: 0; max: number; tickAmount: number } {
  const highest = counts.reduce((m, c) => (Number.isFinite(c) && c > m ? c : m), 0);
  const top = Math.max(5, Math.ceil(highest) + 1);
  if (top <= 10) return { min: 0, max: top, tickAmount: top };
  const step = Math.ceil(top / 5);
  return { min: 0, max: step * 5, tickAmount: 5 };
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
export function analyticsCsv(summary: AnalyticsSummary, names: WorkerNames, insights?: PeriodInsights | null): string {
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
    ...(insights ? insightsCsvLines(insights, names) : []),
  ];
  // CRLF: el fin de línea que espera Excel y el que pide RFC 4180.
  return lines.join('\r\n') + '\r\n';
}

/**
 * Sección aparte con el análisis con IA, solo si ya se generó **para este
 * periodo**. Va al final y con su propio origen y aviso: es consultivo, no
 * forma parte del dato medido de las tablas anteriores.
 */
function insightsCsvLines(insights: PeriodInsights, names: WorkerNames): string[] {
  return [
    '',
    row(['aiInsights']),
    row(['generatedBy', 'model', 'generatedAt', 'from', 'to', 'zone', 'isAdvisory']),
    row([insights.generatedBy, insights.model, insights.generatedAt, insights.period.from, insights.period.to,
      insights.period.zone, insights.isAdvisory]),
    row(['resumen']),
    row([insights.resumen]),
    row(['hallazgos']),
    row(['nivel', 'texto']),
    ...insights.hallazgos.map(h => row([h.nivel, h.texto])),
    row(['recomendaciones']),
    row(['prioridad', 'accion', 'motivo', 'operariosAfectados', 'puestosAfectados']),
    ...byPriority(insights.recomendaciones).map(r => row([
      r.prioridad, r.accion, r.motivo,
      r.operariosAfectados.map(id => workerName(id, names)).join('; '),
      r.puestosAfectados.map(affectedPositionLabel).join('; '),
    ])),
    row(['calidadDatos']),
    row([insights.calidadDatos]),
    row(['disclaimer']),
    row([insights.disclaimer]),
  ];
}

export function analyticsCsvFileName(summary: AnalyticsSummary): string {
  return `emsafe-exposure-analytics-${summary.organizationId}-${summary.from}_${summary.to}.csv`;
}
