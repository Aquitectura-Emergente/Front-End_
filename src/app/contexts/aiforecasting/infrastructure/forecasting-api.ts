import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  PageResponse,
  emptyPage,
  queryString,
  unwrap,
  unwrapOrNull,
} from '../../../core/http/api-response';
import { Assessment, Criticality } from '../domain/assessment.model';

/**
 * Acceso HTTP a las proyecciones de AI Forecasting.
 *
 * El SSO entra con su `organization_id` de IAM: estas rutas **no** exigen
 * membresía de dosimetría. `organizationId` no se envía: para una organización
 * dueña el backend usa la del token, y mandar otra daría 403.
 */
@Injectable({ providedIn: 'root' })
export class ForecastingApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /**
   * Evaluaciones activas de la organización, de la más urgente a la menos:
   * criticidad descendente y luego excedencia estimada más cercana.
   */
  criticalWorkers(
    minCriticality?: Criticality,
    page = 0,
    size = 20,
  ): Observable<PageResponse<Assessment>> {
    const qs = queryString({ minCriticality, page, size });
    return unwrap(
      this.http.get<ApiResponse<PageResponse<Assessment>>>(
        `${this.base}/v1/ai-forecasting/projections/critical-workers${qs}`
      ),
      emptyPage<Assessment>(size)
    );
  }

  /**
   * Evaluación activa de un operario.
   *
   * Un operario **sin evaluación activa** responde 404, que aquí se convierte
   * en `null`: es un estado normal (no superó la advertencia en su jornada), no
   * un error, y la vista lo muestra como «sin evaluación activa».
   */
  activeForWorker(workerId: number): Observable<Assessment | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<Assessment>>(
        `${this.base}/v1/ai-forecasting/projections/workers/${workerId}`
      )
    );
  }
}
