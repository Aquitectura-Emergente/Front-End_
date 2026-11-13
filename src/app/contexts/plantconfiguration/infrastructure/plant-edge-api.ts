import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  queryString,
  unwrap,
  unwrapOrNull,
} from '../../../core/http/api-response';
import { PlantEdge, PlantEdgePayload } from '../domain/plant-edge.model';

/**
 * Acceso HTTP a los nodos edge de planta.
 *
 * El verbo del alta es `declare` y no `create` a propósito: el nodo físico ya
 * existe y lo instala el técnico; aquí solo se registra su serial para poder
 * atribuir las lecturas a una zona. Es el nombre que usa el backend.
 *
 * Activar y desactivar son `PATCH` sin cuerpo, no un `PUT` del estado: son
 * transiciones de dominio, no la edición libre de un campo.
 */
@Injectable({ providedIn: 'root' })
export class PlantEdgeApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Observable<PlantEdge[]> {
    return unwrap(
      this.http.get<ApiResponse<PlantEdge[]>>(`${this.base}/v1/plant-config/edges`),
      []
    );
  }

  declare(payload: PlantEdgePayload): Observable<PlantEdge | null> {
    return unwrapOrNull(
      this.http.post<ApiResponse<PlantEdge>>(`${this.base}/v1/plant-config/edges`, payload)
    );
  }

  /**
   * El serial va como **query param**, no en el cuerpo: el backend lo declara
   * `@RequestParam`. Mandarlo en el body devuelve 400 por parámetro ausente.
   */
  updateSerial(id: number, serialNumber: string): Observable<PlantEdge | null> {
    const qs = queryString({ serialNumber });
    return unwrapOrNull(
      this.http.patch<ApiResponse<PlantEdge>>(
        `${this.base}/v1/plant-config/edges/${id}/serial${qs}`,
        {}
      )
    );
  }

  activate(id: number): Observable<PlantEdge | null> {
    return unwrapOrNull(
      this.http.patch<ApiResponse<PlantEdge>>(
        `${this.base}/v1/plant-config/edges/${id}/activate`,
        {}
      )
    );
  }

  deactivate(id: number): Observable<PlantEdge | null> {
    return unwrapOrNull(
      this.http.patch<ApiResponse<PlantEdge>>(
        `${this.base}/v1/plant-config/edges/${id}/deactivate`,
        {}
      )
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/v1/plant-config/edges/${id}`).pipe(
      catchError(() => of(undefined as void))
    );
  }
}
