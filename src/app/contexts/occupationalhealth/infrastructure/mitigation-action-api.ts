import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  queryString,
  unwrap,
  unwrapOrNull,
} from '../../../core/http/api-response';
import {
  ApproveMitigationPayload,
  MitigationAction,
  RegisterRelocationPayload,
  RejectMitigationPayload,
} from '../domain/mitigation-action.model';

/** Acceso HTTP a las medidas de mitigación. */
@Injectable({ providedIn: 'root' })
export class MitigationActionApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Filtros opcionales: `state`, `workerId`, `from` y `to` (fechas ISO). */
  list(filters: { state?: string; workerId?: number; from?: string; to?: string } = {}):
    Observable<MitigationAction[]> {
    const qs = queryString({ ...filters });
    return unwrap(
      this.http.get<ApiResponse<MitigationAction[]>>(
        `${this.base}/v1/occupational-health/mitigation-actions${qs}`
      ),
      []
    );
  }

  getById(id: number): Observable<MitigationAction | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<MitigationAction>>(
        `${this.base}/v1/occupational-health/mitigation-actions/${id}`
      )
    );
  }

  /**
   * `POST` y no `PATCH` del estado: aprobar ejecuta una transición de dominio
   * con efectos —reasigna turnos y publica eventos—, no es editar un campo.
   */
  approve(id: number, payload: ApproveMitigationPayload): Observable<MitigationAction | null> {
    return unwrapOrNull(
      this.http.post<ApiResponse<MitigationAction>>(
        `${this.base}/v1/occupational-health/mitigation-actions/${id}/approve`,
        payload
      )
    );
  }

  /** El motivo es obligatorio: el backend lo valida con `@NotBlank`. */
  reject(id: number, payload: RejectMitigationPayload): Observable<MitigationAction | null> {
    return unwrapOrNull(
      this.http.post<ApiResponse<MitigationAction>>(
        `${this.base}/v1/occupational-health/mitigation-actions/${id}/reject`,
        payload
      )
    );
  }

  /**
   * Registra una reubicación decidida directamente por el SSO.
   *
   * **Manda `Idempotency-Key`.** El endpoint lo acepta como cabecera opcional y
   * el backend envuelve la operación en `idempotency.runOnce(...)`: sin ella, un
   * doble clic o un reintento del navegador mueve al operario dos veces y deja
   * dos medidas aplicadas. Con ella, la segunda llamada devuelve la primera.
   */
  registerRelocation(
    payload: RegisterRelocationPayload,
    idempotencyKey: string,
  ): Observable<MitigationAction | null> {
    return unwrapOrNull(
      this.http.post<ApiResponse<MitigationAction>>(
        `${this.base}/v1/occupational-health/mitigation-actions/relocations`,
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
    );
  }
}
