import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse, unwrap, unwrapOrNull, queryString } from '../../../core/http/api-response';
import { Device, CreateDevicePayload, DiscoverableDevice } from '../domain/device.model';

/** Acceso HTTP a los endpoints de dispositivos. */
@Injectable({ providedIn: 'root' })
export class DeviceApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(clientId?: number | string): Observable<Device[]> {
    return unwrap(
      this.http.get<ApiResponse<Device[]>>(`${this.base}/devices${queryString({ clientId })}`),
      []
    );
  }

  /** Sensores vistos por el edge y aún sin asignar: reclamables en una instalación. */
  discoverable(): Observable<DiscoverableDevice[]> {
    return unwrap(
      this.http.get<ApiResponse<DiscoverableDevice[]>>(`${this.base}/tech/devices/discoverable`),
      []
    );
  }

  create(payload: CreateDevicePayload): Observable<Device | null> {
    return unwrapOrNull(this.http.post<ApiResponse<Device>>(`${this.base}/devices`, payload));
  }

  update(id: number | string, payload: CreateDevicePayload): Observable<Device | null> {
    return unwrapOrNull(this.http.put<ApiResponse<Device>>(`${this.base}/devices/${id}`, payload));
  }

  remove(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.base}/devices/${id}`).pipe(
      catchError(() => of(undefined as void))
    );
  }
}
