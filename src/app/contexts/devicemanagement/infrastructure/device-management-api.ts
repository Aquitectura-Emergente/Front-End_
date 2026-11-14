import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  MutationResult,
  PageResponse,
  emptyPage,
  queryString,
  toResult,
  unwrap,
  unwrapOrNull,
} from '../../../core/http/api-response';
import { DeviceStatusView, LifecycleStatus } from '../domain/device-status.model';
import { DeviceConfigView, OperationalConfigPayload } from '../domain/device-config.model';
import { AuditEntryView } from '../domain/device-audit.model';
import { ReadingRouting, TelemetryReadingView } from '../domain/telemetry-reading.model';
import { EdgeNodeView } from '../domain/edge-node.model';

/**
 * Acceso HTTP a `/api/v1/device-management`. Los dispositivos se identifican
 * por serial (`deviceId`), no por el id numérico de `/api/devices`.
 */
@Injectable({ providedIn: 'root' })
export class DeviceManagementApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/device-management`;

  private device(deviceId: string): string {
    return `${this.base}/devices/${encodeURIComponent(deviceId)}`;
  }

  status(deviceId: string): Observable<DeviceStatusView | null> {
    return unwrapOrNull(this.http.get<ApiResponse<DeviceStatusView>>(this.device(deviceId)));
  }

  config(deviceId: string): Observable<DeviceConfigView | null> {
    return unwrapOrNull(this.http.get<ApiResponse<DeviceConfigView>>(`${this.device(deviceId)}/config`));
  }

  changeOperationalConfig(
    deviceId: string,
    payload: OperationalConfigPayload
  ): Observable<MutationResult<DeviceConfigView>> {
    return toResult(
      this.http.put<ApiResponse<DeviceConfigView>>(`${this.device(deviceId)}/config/operational`, payload)
    );
  }

  changeLifecycle(deviceId: string, status: LifecycleStatus): Observable<MutationResult<DeviceStatusView>> {
    return toResult(
      this.http.put<ApiResponse<DeviceStatusView>>(`${this.device(deviceId)}/lifecycle`, { status })
    );
  }

  audit(deviceId: string, page = 0, size = 20): Observable<PageResponse<AuditEntryView>> {
    return unwrap(
      this.http.get<ApiResponse<PageResponse<AuditEntryView>>>(
        `${this.device(deviceId)}/audit${queryString({ page, size })}`
      ),
      emptyPage<AuditEntryView>(size)
    );
  }

  telemetry(deviceId: string, routing?: ReadingRouting, limit = 50): Observable<TelemetryReadingView[]> {
    return unwrap(
      this.http.get<ApiResponse<TelemetryReadingView[]>>(
        `${this.device(deviceId)}/telemetry${queryString({ routing, limit })}`
      ),
      []
    );
  }

  edges(): Observable<EdgeNodeView[]> {
    return unwrap(this.http.get<ApiResponse<EdgeNodeView[]>>(`${this.base}/edges`), []);
  }
}
