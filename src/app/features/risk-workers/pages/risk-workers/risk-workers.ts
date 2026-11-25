import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { timeAgo } from '../../../../core/utils/time';
import { ForecastingFacade } from '../../../../contexts/aiforecasting/application/forecasting-facade';
import { Assessment, Criticality } from '../../../../contexts/aiforecasting/domain/assessment.model';
import { WorkerNames } from '../../../../contexts/aiforecasting/domain/worker-name';

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
 */
@Component({
  selector: 'app-risk-workers',
  imports: [TranslatePipe, DecimalPipe],
  templateUrl: './risk-workers.html',
  styleUrl: './risk-workers.scss',
})
export class RiskWorkers implements OnInit, OnDestroy {
  protected forecasting = inject(ForecastingFacade);
  protected lang = inject(LanguageService);

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

  ordered = computed(() => this.forecasting.byUrgency(this.assessments()));
  truncated = computed(() => this.total() > this.assessments().length);

  private refreshSub?: Subscription;
  private loadSub?: Subscription;
  private detailSub?: Subscription;
  private namesSub?: Subscription;

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
  }

  closeDetail(): void {
    this.detailSub?.unsubscribe();
    this.selected.set(null);
    this.detail.set(null);
    this.noActive.set(false);
    this.detailLoading.set(false);
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
    }
  }
}
