import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MutationResult, PageResponse } from '../../../core/http/api-response';
import { SsoFacade } from '../../iam/application/sso-facade';
import { ForecastingApi } from '../infrastructure/forecasting-api';
import { AnalyticsApi } from '../infrastructure/analytics-api';
import {
  Assessment,
  Criticality,
  CriticalityTone,
  RecommendationType,
  byUrgency,
  consumedPercent,
  criticalityChipClass,
  criticalityLabelKey,
  criticalityPillClass,
  criticalityTone,
  projectedPercent,
  projectsExceedance,
  ratioToPercent,
  recommendationLabelKey,
} from '../domain/assessment.model';
import {
  AnalyticsPeriod,
  AnalyticsSummary,
  PeriodValidationError,
  PositionStats,
  WeekStats,
  positionLabel,
  validatePeriod,
  weekHasData,
} from '../domain/analytics-summary.model';
import { WorkerNames, workerName, workerNameMap } from '../domain/worker-name';
import { limaDateTime, limaTime } from '../domain/lima-time';
import { analyticsCsv, analyticsCsvFileName } from '../domain/analytics-view';

/** Punto de entrada del contexto aiforecasting para la presentación. */
@Injectable({ providedIn: 'root' })
export class ForecastingFacade {
  private forecasting = inject(ForecastingApi);
  private analytics = inject(AnalyticsApi);
  private sso = inject(SsoFacade);
  private platformId = inject(PLATFORM_ID);

  // ── Proyecciones ─────────────────────────────────────────────────────────

  criticalWorkers(
    minCriticality?: Criticality,
    page = 0,
    size = 20,
  ): Observable<PageResponse<Assessment>> {
    return this.forecasting.criticalWorkers(minCriticality, page, size);
  }

  /** Como `criticalWorkers`, pero con `ok: false` si la llamada falla. */
  criticalWorkersResult(
    minCriticality?: Criticality,
    page = 0,
    size = 20,
  ): Observable<MutationResult<PageResponse<Assessment>>> {
    return this.forecasting.criticalWorkersResult(minCriticality, page, size);
  }

  /** `null` si el operario no tiene evaluación activa (404 del backend). */
  activeForWorker(workerId: number): Observable<Assessment | null> {
    return this.forecasting.activeForWorker(workerId);
  }

  // ── Analítica ────────────────────────────────────────────────────────────

  /**
   * Resumen de la organización del SSO autenticado. `null` sin organización
   * (cuenta mal configurada) o si la llamada falla.
   */
  summary(period: AnalyticsPeriod = {}): Observable<AnalyticsSummary | null> {
    const organizationId = this.sso.organizationId();
    if (!organizationId) return of(null);
    return this.analytics.summary(organizationId, period);
  }

  /**
   * Como `summary`, pero con `ok: false` si la llamada falla. Sin organización
   * no se llama al backend: la URL no se puede construir.
   */
  summaryResult(period: AnalyticsPeriod = {}): Observable<MutationResult<AnalyticsSummary>> {
    const organizationId = this.sso.organizationId();
    if (!organizationId) return of({ ok: false as const, error: 'no-organization' });
    return this.analytics.summaryResult(organizationId, period);
  }

  /**
   * Descarga el resumen como CSV, para la plantilla del reporte de cumplimiento.
   *
   * Con BOM UTF-8: sin él, Excel abre el archivo como ANSI y rompe las tildes de
   * los nombres («Lucía» → «LucÃ­a»).
   */
  downloadCsv(summary: AnalyticsSummary, names: WorkerNames): void {
    const blob = new Blob(['﻿', analyticsCsv(summary, names)], { type: 'text/csv;charset=utf-8' });
    this.saveAs(blob, analyticsCsvFileName(summary));
  }

  // ── Nombres de operarios ─────────────────────────────────────────────────

  /**
   * Mapa `workerId → nombre` con los operarios del SSO. Si la lista falla, el
   * mapa queda vacío y la vista cae a `#id`: un nombre no debe tumbar la página.
   */
  workerNames(): Observable<WorkerNames> {
    return this.sso.workers().pipe(
      map(workers => workerNameMap(workers)),
      catchError(() => of(new Map<number, string>() as WorkerNames)),
    );
  }

  workerName(workerId: number | null | undefined, names: WorkerNames): string {
    return workerName(workerId, names);
  }

  // ── Reglas que consulta la vista ─────────────────────────────────────────

  criticalityLabelKey(criticality: Criticality | undefined): string {
    return criticalityLabelKey(criticality);
  }

  criticalityTone(criticality: Criticality | undefined): CriticalityTone {
    return criticalityTone(criticality);
  }

  criticalityChipClass(criticality: Criticality | undefined): string {
    return criticalityChipClass(criticality);
  }

  criticalityPillClass(criticality: Criticality | undefined): string {
    return criticalityPillClass(criticality);
  }

  limaTime(iso: string | null | undefined): string {
    return limaTime(iso);
  }

  limaDateTime(iso: string | null | undefined): string {
    return limaDateTime(iso);
  }

  consumedPercent(assessment: Assessment): number | null {
    return consumedPercent(assessment);
  }

  projectedPercent(assessment: Assessment): number | null {
    return projectedPercent(assessment);
  }

  ratioToPercent(ratio: number | null | undefined): number | null {
    return ratioToPercent(ratio);
  }

  projectsExceedance(assessment: Assessment): boolean {
    return projectsExceedance(assessment);
  }

  recommendationLabelKey(type: RecommendationType): string {
    return recommendationLabelKey(type);
  }

  byUrgency(assessments: readonly Assessment[]): Assessment[] {
    return byUrgency(assessments);
  }

  validatePeriod(period: AnalyticsPeriod): PeriodValidationError {
    return validatePeriod(period);
  }

  weekHasData(week: WeekStats): boolean {
    return weekHasData(week);
  }

  positionLabel(position: PositionStats): string {
    return positionLabel(position);
  }

  /**
   * Guarda el blob como archivo. Tras `isPlatformBrowser` porque toca
   * `document` y `URL`, igual que `ComplianceReportFacade.saveAs`.
   */
  private saveAs(blob: Blob, filename: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
