import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../../../core/http/api-response';
import { ExposureLimitApi } from '../infrastructure/exposure-limit-api';
import { ExposureSessionApi } from '../infrastructure/exposure-session-api';
import {
  ConfigureLimitPayload,
  ExposureLimit,
  LimitValidationError,
  currentByPosition,
  validateLimit,
  warningThreshold,
} from '../domain/exposure-limit.model';
import {
  ExposureSession,
  ExposureSeverity,
  PersonalReading,
  byMostRecent,
  hasGaps,
  isProvisional,
  severityLabelKey,
  severityOf,
  stateLabelKey as sessionStateLabelKey,
} from '../domain/exposure-session.model';

/** Punto de entrada del contexto personaldosimetry para la presentación. */
@Injectable({ providedIn: 'root' })
export class DosimetryFacade {
  private limitsApi = inject(ExposureLimitApi);
  private sessionsApi = inject(ExposureSessionApi);

  limits(organizationId: number): Observable<ExposureLimit[]> {
    return this.limitsApi.list(organizationId);
  }

  /**
   * Configura el límite de un puesto. **Crea una versión nueva**, no edita la
   * anterior: las jornadas ya cerradas siguen evaluadas con la que estaba en
   * vigor, que es lo que exige el RNF18.
   */
  configureLimit(
    organizationId: number,
    payload: ConfigureLimitPayload,
  ): Observable<ExposureLimit | null> {
    return this.limitsApi.configure(organizationId, payload);
  }

  // ── Reglas que consulta la vista ─────────────────────────────────────────

  /** Valida antes de enviar, con las mismas cotas que el backend. */
  validateLimit(payload: ConfigureLimitPayload): LimitValidationError {
    return validateLimit(payload);
  }

  /** Vigente de cada puesto; el resto son historial. */
  currentByPosition(limits: readonly ExposureLimit[]): ExposureLimit[] {
    return currentByPosition(limits);
  }

  warningThreshold(limit: ExposureLimit): number {
    return warningThreshold(limit);
  }

  // ── Sesiones de exposición ───────────────────────────────────────────────

  sessions(workerId: number, page = 0, size = 20): Observable<PageResponse<ExposureSession>> {
    return this.sessionsApi.history(workerId, page, size);
  }

  session(id: string): Observable<ExposureSession | null> {
    return this.sessionsApi.getById(id);
  }

  readings(id: string, page = 0, size = 50): Observable<PageResponse<PersonalReading>> {
    return this.sessionsApi.readings(id, page, size);
  }

  // ── Reglas de las sesiones ───────────────────────────────────────────────

  severityOf(session: ExposureSession): ExposureSeverity {
    return severityOf(session);
  }

  severityLabelKey(session: ExposureSession): string {
    return severityLabelKey(session);
  }

  sessionStateLabelKey(session: ExposureSession): string {
    return sessionStateLabelKey(session.state);
  }

  /** Cobertura incompleta: el acumulado está por debajo de lo real. */
  hasGaps(session: ExposureSession): boolean {
    return hasGaps(session);
  }

  /** Sin finalizar, el valor todavía puede subir con lecturas atrasadas. */
  isProvisional(session: ExposureSession): boolean {
    return isProvisional(session);
  }

  byMostRecent(sessions: readonly ExposureSession[]): ExposureSession[] {
    return byMostRecent(sessions);
  }
}
