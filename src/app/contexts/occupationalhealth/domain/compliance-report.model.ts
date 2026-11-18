/**
 * Reporte de cumplimiento: la evidencia exportable de la exposición de un
 * operario o de una zona en un periodo (RF31).
 *
 * Lo que de verdad importa de este reporte no es la cifra, sino **si se puede
 * sostener en una auditoría**. Por eso el backend devuelve tres señales de
 * trazabilidad —`evidenceVerified`, `fullyTraceable` y `entriesWithoutSource`—
 * y el `digestValue` con su algoritmo: el RNF18 exige poder reconstruir el
 * acumulado desde las lecturas de origen con 0 diferencias.
 *
 * El listado (`GET` de la colección) devuelve {@link ComplianceReportSummary},
 * **sin las entradas ni las señales de trazabilidad**: calcularlas obliga a
 * recorrer las entradas de cada reporte. Se obtienen al abrir uno por id.
 */
export interface ComplianceReport {
  id: number;
  scope: ReportScope;
  subjectWorkerId?: number | null;
  periodFrom: string;
  periodTo: string;
  version: number;
  digestAlgorithm?: string | null;
  digestValue?: string | null;
  evidenceVerified: boolean;
  fullyTraceable: boolean;
  entriesWithoutSource: number;
  fileReference?: string | null;
  exportedAt?: string | null;
  generatedBy?: number | null;
  generatedAt?: string | null;
  entries?: ReportEntry[];
}

export type ReportScope = 'WORKER' | 'PLANT_ZONE';

/**
 * Fila del historial de reportes.
 *
 * Es un subconjunto estricto de `ComplianceReport`: los campos de trazabilidad
 * (`evidenceVerified`, `fullyTraceable`, `entriesWithoutSource`) y `entries`
 * **no viajan** en el listado, así que no se pueden pintar aquí los avisos de
 * auditoría — hay que abrir el reporte.
 */
export interface ComplianceReportSummary {
  id: number;
  scope: ReportScope;
  subjectWorkerId?: number | null;
  periodFrom: string;
  periodTo: string;
  version: number;
  generatedAt?: string | null;
  exportedAt?: string | null;
}

export interface ReportEntry {
  id: number;
  sessionId?: string | null;
  entryDate?: string | null;
  finalDose?: DoseSnapshot | null;
  zone?: ZoneAggregate | null;
  sources?: ReportSource[];
}

export interface DoseSnapshot {
  value?: number | null;
  unit?: string | null;
  limit?: number | null;
  methodId?: string | null;
}

export interface ZoneAggregate {
  zoneId?: number | null;
  average?: number | null;
  max?: number | null;
  readingCount?: number | null;
}

export interface ReportSource {
  type: string;
  ref: string;
}

export interface GenerateReportPayload {
  scope: ReportScope;
  workerId?: number;
  /** `YYYY-MM-DD`: el backend lo recibe como `LocalDate`. */
  from: string;
  to: string;
}

/** Motivo por el que no se puede pedir el reporte, o null si se puede. */
export type ReportRequestError = 'scope' | 'worker' | 'period' | null;

/**
 * Valida antes de pedirlo, con las reglas que el backend impone.
 *
 * El ámbito `WORKER` exige un operario: sin él el reporte no tiene sujeto y el
 * backend lo rechaza. Y el periodo tiene que estar ordenado — un `from`
 * posterior al `to` devolvería un reporte vacío que parece correcto, que es
 * peor que un error.
 */
export function validateReportRequest(payload: GenerateReportPayload): ReportRequestError {
  if (payload.scope !== 'WORKER' && payload.scope !== 'PLANT_ZONE') return 'scope';
  if (payload.scope === 'WORKER' && !payload.workerId) return 'worker';
  if (!payload.from || !payload.to || payload.from > payload.to) return 'period';
  return null;
}

/** Aviso de trazabilidad, o null si el reporte se sostiene en una auditoría. */
export type TraceabilityWarning = 'untraceable' | 'unverified' | null;

/**
 * Por qué un reporte no es defendible.
 *
 * Se mira primero la trazabilidad y después la verificación, porque son dos
 * problemas de distinta gravedad: sin trazas no se puede reconstruir el cálculo
 * —el reporte no vale—, mientras que sin verificar solo significa que nadie ha
 * contrastado todavía el digest.
 */
export function traceabilityWarning(report: ComplianceReport): TraceabilityWarning {
  if (!report.fullyTraceable || report.entriesWithoutSource > 0) return 'untraceable';
  if (!report.evidenceVerified) return 'unverified';
  return null;
}

/** Un reporte sin avisos es el que se puede entregar a una auditoría. */
export function isAuditReady(report: ComplianceReport): boolean {
  return traceabilityWarning(report) === null;
}

/** Nombre del archivo al descargar, para no dejar «descarga.pdf». */
export function exportFileName(report: ComplianceReport): string {
  const subject = report.scope === 'WORKER' ? `worker-${report.subjectWorkerId ?? 'NA'}` : 'plant';
  return `emsafe-${subject}-${report.periodFrom}_${report.periodTo}-v${report.version}.pdf`;
}
