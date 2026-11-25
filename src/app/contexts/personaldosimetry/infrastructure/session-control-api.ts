import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response';
import { ExposureSession } from '../domain/exposure-session.model';
import { CommandResult, OpenSessionPayload } from '../domain/session-control.model';

/**
 * Órdenes sobre jornadas de dosimetría: abrir, cerrar y finalizar.
 *
 * Archivo aparte de `ExposureSessionApi` (consultas, de otro responsable) para
 * no editarlo. Exige membresía **SSO** de dosimetría en la empresa del
 * dosímetro; sin ella las tres rutas responden 403.
 *
 * No usa `toResult` porque la pantalla necesita el **estado HTTP** además del
 * mensaje: un 409 (conflicto de estado) y un 422 (regla de dominio) llevan
 * títulos distintos, y el mensaje del backend se muestra tal cual debajo.
 */
@Injectable({ providedIn: 'root' })
export class SessionControlApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/personal-dosimetry/sessions`;

  /** Abre la jornada. Sin `startedAt`: empieza a la hora del servidor. */
  open(payload: OpenSessionPayload): Observable<CommandResult<ExposureSession>> {
    return command(this.http.post<ApiResponse<ExposureSession>>(this.base, payload));
  }

  /**
   * Pide el cierre: la jornada pasa a `CLOSING`. **Sin `endedAt`**: el backend
   * usa su hora, que siempre contiene las lecturas ya aceptadas.
   */
  close(sessionId: string): Observable<CommandResult<ExposureSession>> {
    return command(this.http.post<ApiResponse<ExposureSession>>(`${this.base}/${sessionId}/close`, {}));
  }

  /**
   * Congela la jornada (`CLOSED`). `deliveryConfirmed` va fijo en `false` y no
   * es un parámetro: el portal nunca confirma la entrega, solo finaliza cuando
   * venció el plazo de reconciliación.
   */
  finalize(sessionId: string): Observable<CommandResult<ExposureSession>> {
    return command(
      this.http.post<ApiResponse<ExposureSession>>(`${this.base}/${sessionId}/finalize`, { deliveryConfirmed: false })
    );
  }
}

function command<T>(obs: Observable<ApiResponse<T>>): Observable<CommandResult<T>> {
  return obs.pipe(
    map(r => ({ ok: true as const, data: r.data })),
    catchError((err: HttpErrorResponse) =>
      of({
        ok: false as const,
        error: {
          status: err?.status ?? 0,
          message: (err?.error as { message?: string } | null)?.message || err?.message || '',
        },
      })
    ),
  );
}
