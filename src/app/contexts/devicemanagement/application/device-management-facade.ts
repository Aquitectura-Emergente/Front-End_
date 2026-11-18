import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, mergeMap, reduce } from 'rxjs/operators';
import { MutationResult, PageResponse } from '../../../core/http/api-response';
import { DeviceManagementApi } from '../infrastructure/device-management-api';
import { DeviceStatusView, LifecycleStatus } from '../domain/device-status.model';
import { DeviceConfigView, OperationalConfigPayload } from '../domain/device-config.model';
import { AuditEntryView } from '../domain/device-audit.model';
import { ReadingRouting, TelemetryReadingView } from '../domain/telemetry-reading.model';
import { EdgeNodeView } from '../domain/edge-node.model';

/** Peticiones de estado en paralelo al armar el inventario. */
const STATUS_CONCURRENCY = 6;

/**
 * Estado, configuración, ciclo de vida, auditoría y telemetría de cada
 * dispositivo, más los nodos Edge. Lo usa solo el admin.
 */
@Injectable({ providedIn: 'root' })
export class DeviceManagementFacade {
  private api = inject(DeviceManagementApi);

  status(deviceId: string): Observable<DeviceStatusView | null> {
    return this.api.status(deviceId);
  }

  /**
   * Estado de varios dispositivos, indexado por serial. `/api/devices` todavía
   * no trae tipo, ciclo de vida ni conectividad, así que se piden uno a uno.
   */
  statuses(deviceIds: string[]): Observable<Map<string, DeviceStatusView>> {
    const ids = [...new Set(deviceIds.filter(Boolean))];
    if (!ids.length) return of(new Map());
    return from(ids).pipe(
      mergeMap(id => this.api.status(id).pipe(map(s => [id, s] as const)), STATUS_CONCURRENCY),
      reduce((acc, [id, s]) => (s ? acc.set(id, s) : acc), new Map<string, DeviceStatusView>())
    );
  }

  config(deviceId: string): Observable<DeviceConfigView | null> {
    return this.api.config(deviceId);
  }

  changeOperationalConfig(
    deviceId: string,
    payload: OperationalConfigPayload
  ): Observable<MutationResult<DeviceConfigView>> {
    return this.api.changeOperationalConfig(deviceId, payload);
  }

  changeLifecycle(deviceId: string, status: LifecycleStatus): Observable<MutationResult<DeviceStatusView>> {
    return this.api.changeLifecycle(deviceId, status);
  }

  audit(deviceId: string, page = 0, size = 20): Observable<PageResponse<AuditEntryView>> {
    return this.api.audit(deviceId, page, size);
  }

  telemetry(deviceId: string, routing?: ReadingRouting, limit = 50): Observable<TelemetryReadingView[]> {
    return this.api.telemetry(deviceId, routing, limit);
  }

  edges(): Observable<EdgeNodeView[]> {
    return this.api.edges();
  }
}
