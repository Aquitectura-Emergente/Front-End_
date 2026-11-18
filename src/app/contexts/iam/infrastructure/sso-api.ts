import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, unwrap, unwrapOrNull } from '../../../core/http/api-response';
import { User } from '../domain/user.model';

/**
 * Consultas del responsable de SSO sobre sus operarios.
 *
 * Ruta aparte (`/api/sso/**`) y no `/api/users`, porque son dos cosas distintas:
 * `/api/users` es la administración global de cuentas y está restringida a
 * ADMIN; esto solo devuelve los operarios de **la organización del token**, que
 * es lo único que el responsable puede ver (regla de `SsoService`).
 *
 * Sin `/v1` en la ruta: este contexto es del segmento hogar y nunca se versionó.
 */
@Injectable({ providedIn: 'root' })
export class SsoApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Operarios (rol WORKER) de la organización del responsable autenticado. */
  workers(): Observable<User[]> {
    return unwrap(this.http.get<ApiResponse<User[]>>(`${this.base}/sso/workers`), []);
  }

  worker(id: number): Observable<User | null> {
    return unwrapOrNull(this.http.get<ApiResponse<User>>(`${this.base}/sso/workers/${id}`));
  }
}
