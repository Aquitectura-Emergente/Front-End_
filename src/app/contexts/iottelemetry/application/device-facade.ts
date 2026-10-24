import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DeviceApi } from '../infrastructure/device-api';
import { RealtimeService } from '../infrastructure/realtime.service';
import { Device, CreateDevicePayload, DiscoverableDevice } from '../domain/device.model';
import { Reading } from '../domain/reading.model';

/**
 * Punto de entrada del contexto iottelemetry para la presentación.
 *
 * Reúne el CRUD de dispositivos (HTTP) y los flujos en vivo (STOMP), que son
 * dos caras de lo mismo: el estado de la flota de sensores.
 */
@Injectable({ providedIn: 'root' })
export class DeviceFacade {
  private api      = inject(DeviceApi);
  private realtime = inject(RealtimeService);

  all(): Observable<Device[]> {
    return this.api.list();
  }

  ofClient(clientId: number | string): Observable<Device[]> {
    return this.api.list(clientId);
  }

  discoverable(): Observable<DiscoverableDevice[]> {
    return this.api.discoverable();
  }

  create(payload: CreateDevicePayload): Observable<Device | null> {
    return this.api.create(payload);
  }

  update(id: number | string, payload: CreateDevicePayload): Observable<Device | null> {
    return this.api.update(id, payload);
  }

  remove(id: number | string): Observable<void> {
    return this.api.remove(id);
  }

  /** Cada lectura nueva, de cualquier sensor. */
  readings(): Observable<Reading> {
    return this.realtime.readings();
  }

  /** Altas de sensores aún sin cliente (descubrimiento durante la instalación). */
  discoveries(): Observable<Reading> {
    return this.realtime.discovery();
  }
}
