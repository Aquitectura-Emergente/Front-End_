import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { Client } from '@stomp/stompjs';
import { environment } from '../../../../environments/environment';
import { AlarmItem } from '../domain/alarm.model';

/**
 * Alertas de operario en vivo por STOMP (backend `WorkerAlertNotifier`,
 * 2026-11-22).
 *
 * El backend publica cada alerta al crearla, acusarla y escalarla en
 * `/topic/organizations/{organizationId}/alerts`, con el mismo payload que
 * `GET /api/alarms/organization`. La app del operario usa
 * `/topic/workers/{workerId}/alerts`.
 *
 * Un `Client` propio por suscripción, que se cierra al desuscribirse: la página
 * de alertas abre y cierra el canal con su ciclo de vida. SSR-safe, como
 * `RealtimeService`.
 */
@Injectable({ providedIn: 'root' })
export class WorkerAlertRealtime {
  private platformId = inject(PLATFORM_ID);

  forOrganization(organizationId: number): Observable<AlarmItem> {
    return new Observable<AlarmItem>(subscriber => {
      if (!isPlatformBrowser(this.platformId)) return;
      const client = new Client({
        brokerURL: environment.wsUrl,
        reconnectDelay: 4000,
        onConnect: () => {
          client.subscribe(`/topic/organizations/${organizationId}/alerts`, message => {
            try {
              subscriber.next(JSON.parse(message.body) as AlarmItem);
            } catch {
              /* frame mal formado: se ignora */
            }
          });
        },
      });
      client.activate();
      return () => void client.deactivate();
    });
  }
}
