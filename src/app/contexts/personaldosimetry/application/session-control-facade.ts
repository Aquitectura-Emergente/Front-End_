import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { SsoFacade } from '../../iam/application/sso-facade';
import { User } from '../../iam/domain/user.model';
import { JobPositionApi } from '../../plantconfiguration/infrastructure/job-position-api';
import { JobPosition } from '../../plantconfiguration/domain/job-position.model';
import { DeviceManagementApi } from '../../devicemanagement/infrastructure/device-management-api';
import { DeviceStatusView } from '../../devicemanagement/domain/device-status.model';
import { ExposureLimitApi } from '../infrastructure/exposure-limit-api';
import { ExposureSessionApi } from '../infrastructure/exposure-session-api';
import { SessionControlApi } from '../infrastructure/session-control-api';
import { ExposureSession } from '../domain/exposure-session.model';
import {
  CommandResult,
  OpenSessionPayload,
  SessionPhase,
  StartDefaults,
  StartValidationError,
  canFinalize,
  commandErrorTitleKey,
  defaultsFromLastSession,
  dosimeterProblem,
  positionsWithLimit,
  sessionPhase,
  validateStart,
} from '../domain/session-control.model';

/**
 * Control de jornadas desde el portal SSO (iniciar, cerrar y finalizar).
 *
 * Fachada propia para no editar `DosimetryFacade`. Solo **lee** con las APIs
 * existentes de otros (historial, límites, puestos, dispositivo) y escribe con
 * `SessionControlApi`, que es nueva.
 */
@Injectable({ providedIn: 'root' })
export class SessionControlFacade {
  private commands = inject(SessionControlApi);
  private sessions = inject(ExposureSessionApi);
  private limits = inject(ExposureLimitApi);
  private positions = inject(JobPositionApi);
  private devices = inject(DeviceManagementApi);
  private sso = inject(SsoFacade);

  // ── Órdenes ──────────────────────────────────────────────────────────────

  open(payload: OpenSessionPayload): Observable<CommandResult<ExposureSession>> {
    return this.commands.open(payload);
  }

  close(sessionId: string): Observable<CommandResult<ExposureSession>> {
    return this.commands.close(sessionId);
  }

  finalize(sessionId: string): Observable<CommandResult<ExposureSession>> {
    return this.commands.finalize(sessionId);
  }

  // ── Lecturas para el panel y el formulario ───────────────────────────────

  /** Estado actual de la jornada; `null` si no se pudo leer. */
  session(sessionId: string): Observable<ExposureSession | null> {
    return this.sessions.getById(sessionId);
  }

  workers(): Observable<User[]> {
    return this.sso.workers();
  }

  /** Puestos que admiten una jornada: los que tienen un límite **vigente ahora**. */
  startablePositions(now: number = Date.now()): Observable<JobPosition[]> {
    const organizationId = this.sso.organizationId();
    if (!organizationId) return of([]);
    return forkJoin([this.positions.list(), this.limits.list(organizationId)]).pipe(
      map(([positions, limits]) => {
        const allowed = positionsWithLimit(limits, now);
        return positions.filter(p => allowed.has(p.id));
      }),
    );
  }

  /** Dosímetro y puesto de la última jornada del operario, para prellenar. */
  lastSessionDefaults(workerId: number): Observable<StartDefaults> {
    return this.sessions.history(workerId, 0, 1).pipe(map(page => defaultsFromLastSession(page.content[0])));
  }

  /** Busca un dispositivo por serial; `null` si no existe o no es visible. */
  deviceBySerial(serial: string): Observable<DeviceStatusView | null> {
    return this.devices.status(serial.trim());
  }

  // ── Reglas que consulta la vista ─────────────────────────────────────────

  dosimeterProblem(device: DeviceStatusView): 'notDosimeter' | 'otherOrganization' | null {
    return dosimeterProblem(device, this.sso.organizationId());
  }

  validateStart(form: Partial<OpenSessionPayload>): StartValidationError {
    return validateStart(form);
  }

  phase(session: ExposureSession): SessionPhase {
    return sessionPhase(session);
  }

  canFinalize(session: ExposureSession, now: number = Date.now()): boolean {
    return canFinalize(session, now);
  }

  errorTitleKey(status: number): string {
    return commandErrorTitleKey(status);
  }
}
