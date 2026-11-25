import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PageResponse } from '../../../core/http/api-response';
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

/** Punto de entrada del contexto aiforecasting para la presentación. */
@Injectable({ providedIn: 'root' })
export class ForecastingFacade {
  private forecasting = inject(ForecastingApi);
  private analytics = inject(AnalyticsApi);
  private sso = inject(SsoFacade);

  // ── Proyecciones ─────────────────────────────────────────────────────────

  criticalWorkers(
    minCriticality?: Criticality,
    page = 0,
    size = 20,
  ): Observable<PageResponse<Assessment>> {
    return this.forecasting.criticalWorkers(minCriticality, page, size);
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
}
