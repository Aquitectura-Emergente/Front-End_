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
import { ExposureSession, PersonalReading } from '../domain/exposure-session.model';

/**
 * Acceso HTTP a las sesiones de exposición.
 *
 * **Dosimetría tiene permisos propios, aparte de los roles de IAM.** Todas
 * estas rutas exigen una fila en su tabla de *memberships*: sin ella responden
 * **403** con «No dosimetry membership has been granted» aunque el rol sea
 * SSO_RESPONSIBLE. Un ADMIN lo concede una vez con
 * `POST /v1/personal-dosimetry/memberships`.
 *
 * Y hay un segundo requisito que sorprende: **el historial exige que el propio
 * operario tenga membership**, porque `history()` resuelve la organización con
 * `memberships.findById(workerId)`. Un operario sin ella da 403 «Worker is
 * outside the authorized scope», no una lista vacía — por eso los fallos
 * degradan a página vacía y la pantalla lo explica en vez de romperse.
 */
@Injectable({ providedIn: 'root' })
export class ExposureSessionApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Historial paginado de un operario, de la sesión más reciente hacia atrás. */
  history(workerId: number, page = 0, size = 20): Observable<PageResponse<ExposureSession>> {
    const qs = queryString({ page, size });
    return unwrap(
      this.http.get<ApiResponse<PageResponse<ExposureSession>>>(
        `${this.base}/v1/personal-dosimetry/workers/${workerId}/sessions${qs}`
      ),
      emptyPage<ExposureSession>(size)
    );
  }

  getById(id: string): Observable<ExposureSession | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<ExposureSession>>(
        `${this.base}/v1/personal-dosimetry/sessions/${id}`
      )
    );
  }

  /**
   * Lecturas de una sesión, en orden de captura ascendente.
   *
   * El backend las ordena por `capturedFrom` —no por llegada—, así que una
   * lectura `LATE` aparece en su hueco temporal y no al final. Es lo que hace
   * legible el recorrido del turno.
   */
  readings(id: string, page = 0, size = 50): Observable<PageResponse<PersonalReading>> {
    const qs = queryString({ page, size });
    return unwrap(
      this.http.get<ApiResponse<PageResponse<PersonalReading>>>(
        `${this.base}/v1/personal-dosimetry/sessions/${id}/readings${qs}`
      ),
      emptyPage<PersonalReading>(size)
    );
  }
}
