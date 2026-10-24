import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AlarmApi } from '../infrastructure/alarm-api';
import { AlarmItem, CreateAlarmPayload, canResolve } from '../domain/alarm.model';

/** Punto de entrada del contexto alerts para la presentación. */
@Injectable({ providedIn: 'root' })
export class AlarmFacade {
  private api = inject(AlarmApi);

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
