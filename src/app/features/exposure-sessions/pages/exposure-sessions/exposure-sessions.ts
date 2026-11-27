import { UnitPipe } from '../../../../core/pipes/unit.pipe';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { DateTimePipe } from '../../../../core/pipes/datetime.pipe';
import { DosimetryFacade } from '../../../../contexts/personaldosimetry/application/dosimetry-facade';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import {
  ExposureSession,
  PersonalReading,
} from '../../../../contexts/personaldosimetry/domain/exposure-session.model';
import { User } from '../../../../contexts/iam/domain/user.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { translateDetail } from '../../../../core/http/backend-error';

/**
 * Historial de exposición de un operario, y el detalle de cada sesión.
 *
 * Es la respuesta a «¿por qué el sistema propuso mover a esta persona?»: la
 * bandeja de mitigación dice *qué* hacer, y esto muestra *con qué datos*.
 *
 * Tres cosas que la pantalla tiene que dejar claras, porque el dato es más
 * frágil de lo que parece:
 *
 *  - **No es una dosis certificada.** El backend llama a esto «índice
 *    operacional de demostración» y la unidad es `uT*s`. Se rotula la unidad
 *    que llega, sin convertirla.
 *  - **Cobertura incompleta = valor por debajo del real.** Si faltan tramos sin
 *    lecturas, decidir una rotación con ese acumulado es decidir a medias.
 *  - **Sin finalizar, el valor puede subir.** Mientras la sesión no esté
 *    finalizada siguen entrando lecturas atrasadas (`LATE`).
 *
 * Y un requisito que no se ve: **dosimetría tiene permisos propios**. Hace falta
 * un *membership* para el responsable y **otro para el operario consultado** —el
 * backend resuelve su organización por ahí—, o responde 403 en vez de una lista
 * vacía. Por eso el vacío se explica en vez de quedarse en blanco.
 */
@Component({
  selector: 'app-exposure-sessions',
  imports: [UnitPipe, TranslatePipe, DateTimePipe, FormsModule],
  templateUrl: './exposure-sessions.html',
  styleUrl: './exposure-sessions.scss',
})
export class ExposureSessions implements OnInit {
  private dosimetry = inject(DosimetryFacade);
  private sso = inject(SsoFacade);
  private route = inject(ActivatedRoute);
  protected lang = inject(LanguageService);
  private control = inject(SessionControlFacade);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);

  /** Jornada cuya finalización está en vuelo. */
  finalizing = signal<string | null>(null);

  loading = signal(false);
  workers = signal<User[]>([]);
  workerId = signal('');
  sessions = signal<ExposureSession[]>([]);

  /** Distingue «no hay sesiones» de «no se pudo consultar». */
  queried = signal(false);

  // ── Detalle ──────────────────────────────────────────────────────────────

  selected = signal<ExposureSession | null>(null);
  readings = signal<PersonalReading[]>([]);
  loadingReadings = signal(false);

  ordered = computed(() => this.dosimetry.byMostRecent(this.sessions()));

  lateCount = computed(() => this.readings().filter(r => r.status === 'LATE').length);

  ngOnInit(): void {
    this.sso.workers().subscribe(workers => {
      this.workers.set(workers);

      // El mapa de planta enlaza aquí con ?workerId=…, para no obligar a
      // volver a elegir a la persona que se acaba de mirar.
      const fromUrl = this.route.snapshot.queryParamMap.get('workerId');
      if (fromUrl && workers.some(w => String(w.id) === fromUrl)) {
        this.workerId.set(fromUrl);
        this.load();
      }
    });
  }

  onWorkerChange(): void {
    this.selected.set(null);
    this.readings.set([]);
    this.sessions.set([]);
    this.queried.set(false);
    if (Number(this.workerId())) this.load();
  }

  /** ¿Sigue abierta la ventana de conciliación (antes de su plazo)? */
  inReconciliation(session: ExposureSession): boolean {
    return !!session.reconciliationDeadline && new Date(session.reconciliationDeadline).getTime() > Date.now();
  }

  /**
   * Finaliza una jornada en CLOSING. Antes del plazo de conciliación, el SSO
   * confirma que el dosímetro ya entregó todas sus lecturas: lo que llegue
   * después no se sumará. Después del plazo basta con confirmar.
   */
  finalize(session: ExposureSession): void {
    const early = this.inReconciliation(session);
    const message = early ? this.lang.t('exp_finalizeEarlyConfirm') : this.lang.t('exp_finalizeConfirm');
    if (!this.confirmService.confirm(message)) return;
    this.finalizing.set(session.id);
    this.control.finalize(session.id, early).subscribe(result => {
      this.finalizing.set(null);
      if (!result.ok) {
        const detail = result.error.message ? ': ' + translateDetail(key => this.lang.t(key), result.error.message) : '';
        this.toast.error(this.lang.t('exp_finalizeFailed') + detail);
        return;
      }
      this.toast.success(this.lang.t('sc_finalized'));
      this.load();
    });
  }

  private load(): void {
    const id = Number(this.workerId());
    if (!id) return;
    this.loading.set(true);
    this.dosimetry.sessions(id).subscribe(page => {
      this.sessions.set(page.content);
      this.loading.set(false);
      this.queried.set(true);
    });
  }

  // ── Reglas que consulta la plantilla ─────────────────────────────────────

  severityOf(session: ExposureSession): string {
    return this.dosimetry.severityOf(session);
  }

  severityLabelKey(session: ExposureSession): string {
    return this.dosimetry.severityLabelKey(session);
  }

  stateLabelKey(session: ExposureSession): string {
    return this.dosimetry.sessionStateLabelKey(session);
  }

  hasGaps(session: ExposureSession): boolean {
    return this.dosimetry.hasGaps(session);
  }

  isProvisional(session: ExposureSession): boolean {
    return this.dosimetry.isProvisional(session);
  }

  // ── Detalle ──────────────────────────────────────────────────────────────

  select(session: ExposureSession): void {
    if (this.selected()?.id === session.id) {
      this.selected.set(null);
      this.readings.set([]);
      return;
    }
    this.selected.set(session);
    this.loadingReadings.set(true);
    this.dosimetry.readings(session.id).subscribe(page => {
      this.readings.set(page.content);
      this.loadingReadings.set(false);
    });
  }

  isSelected(session: ExposureSession): boolean {
    return this.selected()?.id === session.id;
  }
}
