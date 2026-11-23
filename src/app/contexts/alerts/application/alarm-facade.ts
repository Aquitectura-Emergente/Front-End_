import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MutationResult } from '../../../core/http/api-response';
import { AlarmApi } from '../infrastructure/alarm-api';
import { WorkerAlertRealtime } from '../infrastructure/worker-alert-realtime';
import { AlarmItem, CreateAlarmPayload, EscalateAlarmPayload, canEscalate, canResolve } from '../domain/alarm.model';

/** Punto de entrada del contexto alerts para la presentación. */
@Injectable({ providedIn: 'root' })
export class AlarmFacade {
  private api = inject(AlarmApi);
  private realtime = inject(WorkerAlertRealtime);

  /** Alertas de operario de la organización del SSO (portal del SSO). */
  organizationAlerts(): Observable<AlarmItem[]> {
    return this.api.organization();
  }

  /** Las mismas alertas, en vivo, a medida que se crean, acusan o escalan. */
  liveForOrganization(organizationId: number): Observable<AlarmItem> {
    return this.realtime.forOrganization(organizationId);
  }

  escalate(id: number, payload: EscalateAlarmPayload): Observable<MutationResult<AlarmItem>> {
    return this.api.escalate(id, payload);
  }

  canEscalate(alarm: AlarmItem): boolean {
    return canEscalate(alarm);
  }

  all(): Observable<AlarmItem[]> {
    return this.api.list();
  }

  create(payload: CreateAlarmPayload): Observable<AlarmItem | null> {
    return this.api.create(payload);
  }

  resolve(id: number | string): Observable<AlarmItem | null> {
    return this.api.resolve(id);
  }

  remove(id: number | string): Observable<void> {
    return this.api.remove(id);
  }

  /** Regla de dominio: una alarma ya resuelta no se vuelve a resolver. */
  canResolve(alarm: AlarmItem): boolean {
    return canResolve(alarm);
  }
}
