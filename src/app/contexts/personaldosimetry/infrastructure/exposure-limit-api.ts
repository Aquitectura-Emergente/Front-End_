import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  PageResponse,
  emptyPage,
  queryString,
  unwrap,
  unwrapOrNull, MutationResult, toResult } from '../../../core/http/api-response';
import { ConfigureLimitPayload, ExposureLimit } from '../domain/exposure-limit.model';

/**
 * Acceso HTTP a los límites de exposición.
 *
 * ⚠️ **Dosimetría tiene su propio sistema de permisos**, aparte de los roles de
 * IAM: exige una fila en su tabla de *memberships*. Un responsable de SSO sin
 * ella recibe **403 con «No dosimetry membership has been granted»**, aunque su
 * rol sea el correcto. Lo concede un ADMIN una sola vez con
 * `POST /v1/personal-dosimetry/memberships {userId, role:"SSO"}`.
 *
 * La organización va en la ruta y el backend comprueba que coincida con la del
 * token, así que **no sirve de nada mandar otra**.
 */
@Injectable({ providedIn: 'root' })
export class ExposureLimitApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Paginado: el backend devuelve `PageResponse`, no una lista suelta. */
  page(organizationId: number, page = 0, size = 50): Observable<PageResponse<ExposureLimit>> {
    const qs = queryString({ page, size });
    return unwrap(
      this.http.get<ApiResponse<PageResponse<ExposureLimit>>>(
        `${this.base}/v1/personal-dosimetry/organizations/${organizationId}/limits${qs}`
      ),
      emptyPage<ExposureLimit>(size)
    );
  }

  /** Atajo para la pantalla, que trabaja con la lista y no con la página. */
  list(organizationId: number): Observable<ExposureLimit[]> {
    return this.page(organizationId).pipe(map(p => p.content));
  }

  configure(
    organizationId: number,
    payload: ConfigureLimitPayload,
  ): Observable<MutationResult<ExposureLimit>> {
    return toResult(
      this.http.post<ApiResponse<ExposureLimit>>(
        `${this.base}/v1/personal-dosimetry/organizations/${organizationId}/limits`,
        payload
      )
    );
  }
}
