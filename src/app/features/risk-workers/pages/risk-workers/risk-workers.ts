import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { timeAgo } from '../../../../core/utils/time';
import { ForecastingFacade } from '../../../../contexts/aiforecasting/application/forecasting-facade';
import { Assessment, Criticality } from '../../../../contexts/aiforecasting/domain/assessment.model';
import { WorkerNames } from '../../../../contexts/aiforecasting/domain/worker-name';
import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { ExposureSession } from '../../../../contexts/personaldosimetry/domain/exposure-session.model';
import { CommandError, SessionPhase } from '../../../../contexts/personaldosimetry/domain/session-control.model';
import { StartSessionDialog } from '../../components/start-session-dialog/start-session-dialog';

/** Cada cuánto se vuelve a pedir la lista mientras la página está abierta. */
export const RISK_REFRESH_MS = 60_000;

/**
 * Una página basta: el backend solo lista evaluaciones **activas** (una por
 * jornada abierta), así que en una planta son pocas. Si algún día hay más, la
 * pantalla lo avisa con «Mostrando N de M» en vez de cortarlas sin decirlo.
 */
const PAGE_SIZE = 50;

type CriticalityFilter = Criticality | '';

/**
 * Operarios en riesgo: las proyecciones activas de AI Forecasting, de la más
 * urgente a la menos (`GET /projections/critical-workers`).
 *
 * **Todo lo que se ve aquí es una proyección**, no una excedencia medida: quien
 * decide si se excedió el límite es Personal Dosimetry. La pantalla lo rotula
 * así en la cabecera y en el detalle.
 *
 * Se refresca sola cada 60 s mientras está abierta. Un refresco que falla
 * **no borra la lista**: se conserva la última y se avisa de que puede estar
 * desactualizada, porque vaciarla haría creer que ya no hay nadie en riesgo.
 *
 * Desde aquí el SSO también controla la jornada de dosimetría (F4): la inicia
 * desde la cabecera y la cierra y finaliza desde el detalle. Cerrar deja la
 * jornada en `CLOSING` («procesando lecturas»); finalizar solo se habilita
 * pasado `reconciliationDeadline` y siempre con `deliveryConfirmed: false`.
 */
@Component({
  selector: 'app-risk-workers',
  imports: [TranslatePipe, DecimalPipe, StartSessionDialog],
  templateUrl: './risk-workers.html',
  styleUrl: './risk-workers.scss',
})
export class RiskWorkers implements OnInit, OnDestroy {
  protected forecasting = inject(ForecastingFacade);
  protected control = inject(SessionControlFacade);
  protected lang = inject(LanguageService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  readonly filters: { value: CriticalityFilter; labelKey: string }[] = [
    { value: '', labelKey: 'af_filter_all' },
    { value: 'MODERATE', labelKey: 'af_filter_moderate' },
    { value: 'HIGH', labelKey: 'af_filter_high' },
    { value: 'CRITICAL', labelKey: 'af_filter_critical' },
  ];

  assessments = signal<Assessment[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal(false);
  minCriticality = signal<CriticalityFilter>('');
  names = signal<WorkerNames>(new Map());
  /** Reloj de «hace X min»: avanza con cada carga, no en cada render. */
  now = signal(Date.now());

  /** Fila elegida y su evaluación activa recién pedida al backend. */
  selected = signal<Assessment | null>(null);
  detail = signal<Assessment | null>(null);
  detailLoading = signal(false);
  noActive = signal(false);

  /** Jornada de dosimetría de la evaluación abierta en el detalle. */
  session = signal<ExposureSession | null>(null);
  sessionLoading = signal(false);
  sessionBusy = signal(false);
  sessionError = signal<CommandError | null>(null);
  /** Tras cerrar o finalizar: el operario tarda hasta 1 min en salir de la lista. */
  sessionChanged = signal(false);

  startOpen = signal(false);

  ordered = computed(() => this.forecasting.byUrgency(this.assessments()));
  truncated = computed(() => this.total() > this.assessments().length);

  sessionPhase = computed<SessionPhase | null>(() => {
    const s = this.session();
    return s ? this.control.phase(s) : null;
  });

  /** Se reevalúa con el reloj de la página, que avanza en cada refresco (≤ 60 s). */
  finalizable = computed(() => {
    const s = this.session();
    return !!s && this.control.canFinalize(s, this.now());
  });

  private refreshSub?: Subscription;
  private loadSub?: Subscription;
  private detailSub?: Subscription;
  private namesSub?: Subscription;
  private sessionSub?: Subscription;
  private commandSub?: Subscription;

  ngOnInit(): void {
    this.namesSub = this.forecasting.workerNames().subscribe(names => this.names.set(names));
    this.load();
    this.refreshSub = interval(RISK_REFRESH_MS).subscribe(() => this.load(true));
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.loadSub?.unsubscribe();
    this.detailSub?.unsubscribe();
    this.namesSub?.unsubscribe();
    this.sessionSub?.unsubscribe();
    this.commandSub?.unsubscribe();
  }

  /**
   * Pide la lista. `silent` es el refresco automático: no vuelve a mostrar el
   * «cargando» para que la tabla no parpadee cada minuto.
   */
  load(silent = false): void {
    if (!silent) this.loading.set(true);
    // Una carga nueva reemplaza a la anterior: si el SSO cambia de filtro dos
    // veces seguidas, no debe pintarse la respuesta del filtro viejo.
    this.loadSub?.unsubscribe();
    this.loadSub = this.forecasting
      .criticalWorkersResult(this.minCriticality() || undefined, 0, PAGE_SIZE)
      .subscribe(result => {
        this.loading.set(false);
        this.now.set(Date.now());
        if (!result.ok) {
          this.error.set(true);
          return;
        }
        this.error.set(false);
        this.assessments.set(result.data.content);
        this.total.set(result.data.totalElements);
        this.syncSelection(result.data.content);
      });
  }

  setMinCriticality(value: string): void {
    this.minCriticality.set(value as CriticalityFilter);
    this.load();
  }

  /** Abre el detalle de una fila; un segundo clic en la misma lo cierra. */
  select(assessment: Assessment): void {
    if (this.selected()?.id === assessment.id) {
      this.closeDetail();
      return;
    }
    this.selected.set(assessment);
    this.detail.set(null);
    this.noActive.set(false);
    this.detailLoading.set(true);
    this.detailSub?.unsubscribe();
    // Se pide la evaluación activa en vez de reutilizar la fila: entre un
    // refresco y otro pudo reemplazarse (SUPERSEDED) o dejar de existir.
    this.detailSub = this.forecasting.activeForWorker(assessment.workerId).subscribe(active => {
      this.detailLoading.set(false);
      if (active) this.detail.set(active);
      else this.noActive.set(true);
    });
    this.loadSession(assessment.sessionId);
  }

  closeDetail(): void {
    this.detailSub?.unsubscribe();
    this.sessionSub?.unsubscribe();
    this.commandSub?.unsubscribe();
    this.selected.set(null);
    this.detail.set(null);
    this.noActive.set(false);
    this.detailLoading.set(false);
    this.resetSession();
  }

  // ── Jornada de dosimetría ────────────────────────────────────────────────

  /**
   * Cierra la jornada de la evaluación (`POST /close` sin `endedAt`). Pide
   * confirmación: no se deshace, y el operario deja de medir en ese instante.
   */
  closeSession(): void {
    const session = this.session();
    const row = this.selected();
    if (!session || !row || this.sessionBusy()) return;
    const message = `${this.lang.t('sc_closeConfirm')} ${this.workerName(row.workerId)}`;
    if (!this.confirm.confirm(message)) return;
    this.runCommand(this.control.close(session.id), 'sc_closed');
  }

  /** Finaliza con `deliveryConfirmed: false`; solo pasado el plazo de reconciliación. */
  finalizeSession(): void {
    const session = this.session();
    if (!session || this.sessionBusy() || !this.control.canFinalize(session, Date.now())) return;
    this.runCommand(this.control.finalize(session.id), 'sc_finalized');
  }

  openStart(): void {
    this.startOpen.set(true);
  }

  /** Jornada iniciada desde el modal: se cierra y se refresca la lista. */
  onStarted(): void {
    this.startOpen.set(false);
    this.load(true);
  }

  private runCommand(command: ReturnType<SessionControlFacade['close']>, successKey: string): void {
    this.sessionBusy.set(true);
    this.sessionError.set(null);
    this.commandSub?.unsubscribe();
    this.commandSub = command.subscribe(result => {
      this.sessionBusy.set(false);
      if (!result.ok) {
        this.sessionError.set(result.error);
        return;
      }
      this.session.set(result.data);
      this.sessionChanged.set(true);
      this.toast.success(this.lang.t(successKey));
      this.load(true);
    });
  }

  private loadSession(sessionId: string): void {
    this.resetSession();
    this.sessionLoading.set(true);
    this.sessionSub?.unsubscribe();
    this.sessionSub = this.control.session(sessionId).subscribe(session => {
      this.sessionLoading.set(false);
      this.session.set(session);
    });
  }

  private resetSession(): void {
    this.session.set(null);
    this.sessionLoading.set(false);
    this.sessionBusy.set(false);
    this.sessionError.set(null);
    this.sessionChanged.set(false);
  }

  isSelected(assessment: Assessment): boolean {
    return this.selected()?.id === assessment.id;
  }

  // ── Presentación ─────────────────────────────────────────────────────────

  workerName(id: number | null | undefined): string {
    return this.forecasting.workerName(id, this.names());
  }

  /** «hace 5 min» / «5 min ago», según el idioma. */
  ago(iso: string | null | undefined): string {
    const value = timeAgo(iso, this.now());
    if (value === '—') return value;
    if (value === 'now') return this.lang.t('af_justNow');
    return `${this.lang.t('af_agoPrefix')}${value}${this.lang.t('af_agoSuffix')}`;
  }

  /** Ancho de la barra: el porcentaje topado a 100 para no salirse del riel. */
  barWidth(percent: number | null): number {
    if (percent == null) return 0;
    return Math.max(0, Math.min(100, percent));
  }

  percentLabel(percent: number | null): string {
    return percent == null ? '—' : `${percent}%`;
  }

  /**
   * Si la lista se refresca con el detalle abierto, el panel sigue a la misma
   * jornada con sus cifras nuevas. Si ya no aparece, se deja como estaba: el
   * SSO lo cierra cuando termine de leerlo.
   */
  private syncSelection(list: readonly Assessment[]): void {
    const selected = this.selected();
    if (!selected || this.detailLoading()) return;
    const fresh = list.find(a => a.workerId === selected.workerId);
    if (fresh) {
      this.selected.set(fresh);
      this.detail.set(fresh);
      this.noActive.set(false);
      // Otra jornada del mismo operario (se cerró y abrió otra): su estado es otro.
      if (fresh.sessionId !== this.session()?.id && !this.sessionLoading() && !this.sessionBusy()) {
        this.loadSession(fresh.sessionId);
      }
    }
  }
}
