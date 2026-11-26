import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  MutationResult,
  queryString,
  toResult,
  unwrapOrNull,
} from '../../../core/http/api-response';
import { AnalyticsPeriod, AnalyticsSummary } from '../domain/analytics-summary.model';
import { InsightsResult, PeriodInsights } from '../domain/period-insights.model';

/**
 * Acceso HTTP a la analítica de exposición.
 *
 * A diferencia de las proyecciones, aquí `organizationId` va **en la ruta** y el
 * backend comprueba que coincida con la del token (otra → 403).
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /**
   * Resumen del periodo. `from` y `to` son días (`yyyy-MM-dd`), no instantes;
   * los que falten los completa el servidor (últimos 28 días, America/Lima).
   */
  summary(organizationId: number, period: AnalyticsPeriod = {}): Observable<AnalyticsSummary | null> {
    const qs = queryString({ from: period.from, to: period.to, zone: period.zone });
    return unwrapOrNull(
      this.http.get<ApiResponse<AnalyticsSummary>>(
        `${this.base}/v1/ai-forecasting/analytics/organizations/${organizationId}/summary${qs}`
      )
    );
  }

  /**
   * Análisis con IA del periodo. Es `POST` porque puede llamar a Gemini (coste),
   * aunque no crea nada. El backend lo cachea 10 min por periodo; `refresh`
   * solo se envía al regenerar, para no gastar cuota sin que el SSO lo pida.
   *
   * Devuelve el estado HTTP además del mensaje: un 403 se muestra distinto.
   */
  insightsResult(
    organizationId: number,
    period: AnalyticsPeriod = {},
    refresh = false,
  ): Observable<InsightsResult> {
    const qs = queryString({
      from: period.from,
      to: period.to,
      zone: period.zone,
      refresh: refresh ? 'true' : undefined,
    });
    return this.http
      .post<ApiResponse<PeriodInsights>>(
        `${this.base}/v1/ai-forecasting/analytics/organizations/${organizationId}/insights${qs}`,
        null
      )
      .pipe(
        map(r => ({ ok: true as const, data: r.data })),
        catchError((err: HttpErrorResponse) =>
          of({
            ok: false as const,
            status: err?.status ?? 0,
            message: (err?.error as { message?: string } | null)?.message || err?.message || '',
          })
        ),
      );
  }

  /**
   * Igual que `summary`, pero **sin tragarse el error**: la pantalla tiene que
   * distinguir «no hay jornadas en el periodo» de «no se pudo consultar».
   */
  summaryResult(
    organizationId: number,
    period: AnalyticsPeriod = {},
  ): Observable<MutationResult<AnalyticsSummary>> {
    const qs = queryString({ from: period.from, to: period.to, zone: period.zone });
    return toResult(
      this.http.get<ApiResponse<AnalyticsSummary>>(
        `${this.base}/v1/ai-forecasting/analytics/organizations/${organizationId}/summary${qs}`
      )
    );
  }
}
