import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  MutationResult,
  queryString,
  toResult,
  unwrapOrNull,
} from '../../../core/http/api-response';
import { AnalyticsPeriod, AnalyticsSummary } from '../domain/analytics-summary.model';

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
