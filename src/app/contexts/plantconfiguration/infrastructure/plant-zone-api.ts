import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse, unwrap, unwrapOrNull } from '../../../core/http/api-response';
import { PlantZone, PlantZonePayload } from '../domain/plant-zone.model';

/**
 * Acceso HTTP a las zonas de planta.
 *
 * Primer contexto del front que vive bajo `/api/v1/**`: el resto del portal
 * consume rutas sin versionar (`/api/alarms`, `/api/devices`). Los contextos
 * industriales sí la llevan, así que el prefijo `v1` va explícito en cada ruta.
 *
 * El backend acota por organización a partir del token
 * (`PlantConfigurationAccessPolicy`), así que **no se envía ningún
 * `organizationId`**: la regla RF03 prohíbe expresamente aceptarlo del cliente
 * como autorización.
 */
@Injectable({ providedIn: 'root' })
export class PlantZoneApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Observable<PlantZone[]> {
    return unwrap(
      this.http.get<ApiResponse<PlantZone[]>>(`${this.base}/v1/plant-config/zones`),
      []
    );
  }

  getById(id: number): Observable<PlantZone | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<PlantZone>>(`${this.base}/v1/plant-config/zones/${id}`)
    );
  }

  create(payload: PlantZonePayload): Observable<PlantZone | null> {
    return unwrapOrNull(
      this.http.post<ApiResponse<PlantZone>>(`${this.base}/v1/plant-config/zones`, payload)
    );
  }

  update(id: number, payload: PlantZonePayload): Observable<PlantZone | null> {
    return unwrapOrNull(
      this.http.put<ApiResponse<PlantZone>>(`${this.base}/v1/plant-config/zones/${id}`, payload)
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/v1/plant-config/zones/${id}`).pipe(
      catchError(() => of(undefined as void))
    );
  }
}
