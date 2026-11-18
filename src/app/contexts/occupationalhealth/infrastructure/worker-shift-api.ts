import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  queryString,
  unwrap,
  unwrapOrNull,
} from '../../../core/http/api-response';
import { StartShiftPayload, WorkerShift } from '../domain/worker-shift.model';

/** Acceso HTTP a los turnos de un operario. */
@Injectable({ providedIn: 'root' })
export class WorkerShiftApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /**
   * Turno abierto, o `null` si no tiene.
   *
   * **El backend responde 404 cuando no hay turno**, no una lista vacía.
   * `unwrapOrNull` lo degrada a `null`, así que la ausencia llega como un caso
   * normal: es lo que permite pintar al operario como «fuera de planta» en vez
   * de romper el mapa. Verificado en vivo.
   */
  current(workerId: number): Observable<WorkerShift | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<WorkerShift>>(
        `${this.base}/v1/occupational-health/workers/${workerId}/shifts/current`
      )
    );
  }

  /** Historial por rango. `from` y `to` son obligatorios en el backend. */
  history(workerId: number, from: string, to: string): Observable<WorkerShift[]> {
    const qs = queryString({ from, to });
    return unwrap(
      this.http.get<ApiResponse<WorkerShift[]>>(
        `${this.base}/v1/occupational-health/workers/${workerId}/shifts${qs}`
      ),
      []
    );
  }

  /**
   * Abre el turno de un operario. Responde **201** con el turno creado.
   *
   * Solo el responsable de SSO puede hacerlo (`assertCanDecide`), y la
   * organización la pone el backend a partir del token: no se envía.
   */
  start(workerId: number, payload: StartShiftPayload): Observable<WorkerShift | null> {
    return unwrapOrNull(
      this.http.post<ApiResponse<WorkerShift>>(
        `${this.base}/v1/occupational-health/workers/${workerId}/shifts`,
        payload
      )
    );
  }

  /**
   * Cierra el turno abierto del operario.
   *
   * El cuerpo de la respuesta viene **sin datos** (`ApiResponse.ok(mensaje,
   * null)`), así que no hay nada que desempaquetar: lo útil es si falló o no.
   * Devuelve `true` si se cerró.
   */
  closeCurrent(workerId: number): Observable<boolean> {
    return this.http
      .post<ApiResponse<void>>(
        `${this.base}/v1/occupational-health/workers/${workerId}/shifts/current/close`,
        {}
      )
      .pipe(
        map(() => true),
        catchError(() => of(false))
      );
  }
}
