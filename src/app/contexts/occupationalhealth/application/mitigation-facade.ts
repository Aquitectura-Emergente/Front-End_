import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { MitigationActionApi } from '../infrastructure/mitigation-action-api';
import { WorkerShiftApi } from '../infrastructure/worker-shift-api';
import { SsoApi } from '../../iam/infrastructure/sso-api';
import {
  ApproveMitigationPayload,
  MitigationAction,
  RegisterRelocationPayload,
  RejectMitigationPayload,
  RelocationValidationError,
  isPending,
  needsTarget,
  stateLabelKey,
  validateRelocation,
  workerIds,
} from '../domain/mitigation-action.model';
import {
  StartShiftPayload,
  WorkerPlacement,
  WorkerShift,
  ZoneOccupancy,
  canCloseShift,
  canStartShift,
  groupByZone,
  isOnShift,
  positionsOfZone,
} from '../domain/worker-shift.model';

/** Clave única por intento de reubicación. Ver `registerRelocation`. */
function relocationKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `reloc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Punto de entrada del contexto occupationalhealth para la presentación. */
@Injectable({ providedIn: 'root' })
export class MitigationFacade {
  private actions = inject(MitigationActionApi);
  private shifts = inject(WorkerShiftApi);
  private sso = inject(SsoApi);

  // ── Medidas de mitigación ────────────────────────────────────────────────

  pending(): Observable<MitigationAction[]> {
    return this.actions.list({ state: 'PROPOSED' });
  }

  all(filters: { state?: string; workerId?: number; from?: string; to?: string } = {}):
    Observable<MitigationAction[]> {
    return this.actions.list(filters);
  }

  approve(id: number, payload: ApproveMitigationPayload): Observable<MitigationAction | null> {
    return this.actions.approve(id, payload);
  }

  reject(id: number, payload: RejectMitigationPayload): Observable<MitigationAction | null> {
    return this.actions.reject(id, payload);
  }

  /**
   * Reubica a un operario por decisión propia del SSO, sin medida previa.
   *
   * **La clave de idempotencia se genera aquí**, no en la pantalla: es parte de
   * cómo se habla con este endpoint, no una decisión de la vista. Se usa
   * `randomUUID` cuando existe y una marca de tiempo con aleatorio cuando no
   * (`crypto.randomUUID` exige contexto seguro, y en `http://localhost` lo hay,
   * pero no se da por supuesto).
   */
  registerRelocation(payload: RegisterRelocationPayload): Observable<MitigationAction | null> {
    return this.actions.registerRelocation(payload, relocationKey());
  }

  // ── Turnos ───────────────────────────────────────────────────────────────

  startShift(workerId: number, payload: StartShiftPayload): Observable<WorkerShift | null> {
    return this.shifts.start(workerId, payload);
  }

  closeShift(workerId: number): Observable<boolean> {
    return this.shifts.closeCurrent(workerId);
  }

  /** Solo se abre un turno a quien no lo tiene, y se cierra a quien sí. */
  canStartShift(placement: WorkerPlacement): boolean {
    return canStartShift(placement);
  }

  canCloseShift(placement: WorkerPlacement): boolean {
    return canCloseShift(placement);
  }

  positionsOfZone<T extends { plantZoneId: number }>(
    positions: readonly T[],
    plantZoneId: number | null,
  ): T[] {
    return positionsOfZone(positions, plantZoneId);
  }

  validateRelocation(payload: Partial<RegisterRelocationPayload>): RelocationValidationError {
    return validateRelocation(payload);
  }

  // ── Reglas que consulta la vista ─────────────────────────────────────────

  isPending(action: MitigationAction): boolean {
    return isPending(action);
  }

  /** Si falta destino, el formulario de aprobación debe pedir zona y puesto. */
  needsTarget(action: MitigationAction): boolean {
    return needsTarget(action);
  }

  workerIds(action: MitigationAction): number[] {
    return workerIds(action);
  }

  stateLabelKey(action: MitigationAction): string {
    return stateLabelKey(action.state);
  }

  // ── Mapa de la planta ────────────────────────────────────────────────────

  /**
   * Dónde está cada operario ahora mismo.
   *
   * Hace una llamada por operario, porque el backend no expone «el turno de
   * todos»: solo `/workers/{id}/shifts/current`. Para una planta son unas pocas
   * peticiones y van en paralelo; si algún día hay cientos de operarios, esto
   * pide un endpoint agregado en el backend y no más paralelismo aquí.
   *
   * Un 404 —operario sin turno abierto— llega como `null` y se trata como un
   * caso normal, no como un error.
   */
  placements(): Observable<WorkerPlacement[]> {
    return this.sso.workers().pipe(
      switchMap(workers => {
        if (workers.length === 0) return of([] as WorkerPlacement[]);
        return forkJoin(
          workers.map(w =>
            this.shifts.current(w.id).pipe(
              map((shift: WorkerShift | null) => ({
                workerId: w.id,
                name: w.name,
                initials: w.initials,
                shift,
              }))
            )
          )
        );
      })
    );
  }

  groupByZone(
    placements: readonly WorkerPlacement[],
    zones: readonly { id: number; name: string }[],
  ): { occupancy: ZoneOccupancy[]; unassigned: WorkerPlacement[] } {
    return groupByZone(placements, zones);
  }

  isOnShift(placement: WorkerPlacement): boolean {
    return isOnShift(placement);
  }
}
