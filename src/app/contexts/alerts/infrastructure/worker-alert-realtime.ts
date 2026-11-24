import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { Client } from '@stomp/stompjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../iam/application/auth.service';
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
  private auth = inject(AuthService);

  forOrganization(organizationId: number): Observable<AlarmItem> {
    return new Observable<AlarmItem>(subscriber => {
      if (!isPlatformBrowser(this.platformId)) return;
      const client = new Client({
        brokerURL: environment.wsUrl,
        reconnectDelay: 4000,
        // Desde el backend 23673ce, `/ws` rechaza el CONNECT sin JWT
        // ("Missing bearer token"). Se lee en cada intento para que una
        // reconexión use el token vigente, como en `RealtimeService`.
        beforeConnect: () => {
          const token = this.auth.getToken();
          client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        },
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
