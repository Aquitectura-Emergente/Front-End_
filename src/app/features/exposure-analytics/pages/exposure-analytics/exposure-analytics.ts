import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { ForecastingFacade } from '../../../../contexts/aiforecasting/application/forecasting-facade';
import {
  AnalyticsSummary,
  PeriodValidationError,
} from '../../../../contexts/aiforecasting/domain/analytics-summary.model';
import {
  DEFAULT_PERIOD_DAYS,
  QUICK_PERIODS,
  SortDirection,
  WorkerSortKey,
  isEmptyHistory,
  lastDaysPeriod,
  matchingQuickPeriod,
  positionBars,
  sortWorkers,
  weeklySeries,
} from '../../../../contexts/aiforecasting/domain/analytics-view';
import { PLANT_TIME_ZONE } from '../../../../contexts/aiforecasting/domain/lima-time';
import { WorkerNames } from '../../../../contexts/aiforecasting/domain/worker-name';

// Mismos tonos que --color-primary, --color-danger y --color-warning de
// styles.scss: ApexCharts necesita colores literales, como en el dashboard.
const PRIMARY = '#1a6eff';
const DANGER = '#f85149';
const WARNING = '#d29922';
const AXIS_LABELS = { style: { colors: '#6b7280', fontSize: '11px' } };

const integer = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US');

/**
 * Analítica de exposición de la organización
 * (`GET /analytics/organizations/{id}/summary`).
 *
 * Casi todo es **histórico medido** por Personal Dosimetry (jornadas `CLOSED`
 * del periodo). La excepción son los críticos proyectados: una foto de *ahora*
 * que no depende del periodo y que se rotula como «Proyección».
 *
 * La zona va fija en America/Lima, que es también la del backend: el periodo y
 * la agrupación por semana se interpretan en la hora de la planta.
 */
@Component({
  selector: 'app-exposure-analytics',
  imports: [TranslatePipe, DecimalPipe, RouterLink, NgApexchartsModule],
  templateUrl: './exposure-analytics.html',
  styleUrl: './exposure-analytics.scss',
})
export class ExposureAnalytics implements OnInit, OnDestroy {
  protected forecasting = inject(ForecastingFacade);
  protected lang = inject(LanguageService);

  readonly zone = PLANT_TIME_ZONE;
  readonly quickPeriods = QUICK_PERIODS;

  from = signal('');
  to = signal('');
  /** Atajo activo: se fija al pulsarlo y se borra si se editan las fechas a mano. */
  quick = signal<number | null>(DEFAULT_PERIOD_DAYS);
  periodError = signal<PeriodValidationError>(null);

  summary = signal<AnalyticsSummary | null>(null);
  loading = signal(false);
  error = signal(false);
  names = signal<WorkerNames>(new Map());

  sortKey = signal<WorkerSortKey>('avgFinalIndex');
  sortDir = signal<SortDirection>('desc');

  empty = computed(() => {
    const s = this.summary();
    return !!s && isEmptyHistory(s);
  });

  workers = computed(() => {
    const s = this.summary();
    return s ? sortWorkers(s.perWorker, this.sortKey(), this.sortDir()) : [];
  });

  // ── Tendencia semanal: líneas de promedio y máximo + barras de «cerca» ─────

  private weekly = computed(() => weeklySeries(this.summary()?.weeklyTrend ?? []));

  trendSeries = computed<ApexAxisChartSeries>(() => {
    const w = this.weekly();
    return [
      { name: this.lang.t('ea_trend_avg'), type: 'line', data: w.avg },
      { name: this.lang.t('ea_trend_max'), type: 'line', data: w.max },
      { name: this.lang.t('ea_trend_nearLimit'), type: 'column', data: w.nearLimit },
    ];
  });

  trendXAxis = computed<ApexXAxis>(() => ({
    categories: this.weekly().categories,
    labels: AXIS_LABELS,
    axisBorder: { show: false },
    axisTicks: { show: false },
  }));

  trendYAxis = computed<ApexYAxis[]>(() => {
    const avg = this.lang.t('ea_trend_avg');
    const unit = this.summary()?.unit ?? '';
    return [
      { seriesName: avg, title: { text: unit }, labels: { ...AXIS_LABELS, formatter: integer } },
      // El máximo comparte el eje del promedio: misma unidad y misma escala.
      { seriesName: avg, show: false, labels: { formatter: integer } },
      {
        seriesName: this.lang.t('ea_trend_nearLimit'),
        opposite: true,
        min: 0,
        forceNiceScale: true,
        decimalsInFloat: 0,
        title: { text: this.lang.t('ea_trend_sessions') },
        labels: { ...AXIS_LABELS, formatter: integer },
      },
    ];
  });

  trendTooltip = computed<ApexTooltip>(() => ({
    theme: 'light',
    shared: true,
    intersect: false,
    x: { formatter: (_v: number, opts?: { dataPointIndex: number }) => {
      const i = opts?.dataPointIndex ?? 0;
      const w = this.weekly();
      return `${w.categories[i] ?? ''} · ${w.weekStarts[i] ?? ''}`;
    } },
    y: { formatter: (v: number) => integer(v) },
  }));

  readonly trendChart: ApexChart = {
    type: 'line',
    height: 300,
    toolbar: { show: false },
    background: 'transparent',
    zoom: { enabled: false },
    animations: { enabled: false },
  };
  // Líneas sin interpolar entre huecos; marcadores para que una semana aislada
  // entre dos vacías siga viéndose.
  readonly trendStroke: ApexStroke = { width: [2, 2, 0], curve: 'straight', dashArray: [0, 5, 0] };
  readonly trendMarkers: ApexMarkers = { size: [4, 3, 0] };
  readonly trendColors = [PRIMARY, DANGER, WARNING];
  readonly trendPlotOptions: ApexPlotOptions = { bar: { columnWidth: '35%', borderRadius: 3 } };

  // ── Puestos: barras horizontales ───────────────────────────────────────────

  private positions = computed(() => positionBars(this.summary()?.topPositions ?? []));

  positionSeries = computed<ApexAxisChartSeries>(() => [
    { name: this.lang.t('ea_trend_avg'), data: this.positions().avg },
    { name: this.lang.t('ea_trend_max'), data: this.positions().max },
  ]);

  positionXAxis = computed<ApexXAxis>(() => ({
    categories: this.positions().labels,
    labels: { ...AXIS_LABELS, formatter: (v: string) => integer(Number(v)) },
    axisBorder: { show: false },
    axisTicks: { show: false },
  }));

  positionChart = computed<ApexChart>(() => ({
    type: 'bar',
    // Alto por puesto: con 10 puestos las etiquetas no se solapan.
    height: 80 + 44 * Math.max(1, this.positions().labels.length),
    toolbar: { show: false },
    background: 'transparent',
    animations: { enabled: false },
  }));

  readonly positionPlotOptions: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 3, barHeight: '70%' } };
  readonly positionColors = [PRIMARY, DANGER];
  readonly positionTooltip: ApexTooltip = { theme: 'light', y: { formatter: (v: number) => integer(v) } };
  readonly positionYAxis: ApexYAxis = { labels: { style: { colors: '#6b7280', fontSize: '12px' }, maxWidth: 220 } };

  readonly grid: ApexGrid = { borderColor: '#f0f2f5', xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } };
  readonly dataLabels: ApexDataLabels = { enabled: false };
  readonly legend: ApexLegend = { position: 'top', horizontalAlign: 'right', fontSize: '12px' };

  private loadSub?: Subscription;
  private namesSub?: Subscription;

  ngOnInit(): void {
    const period = lastDaysPeriod(DEFAULT_PERIOD_DAYS);
    this.from.set(period.from);
    this.to.set(period.to);
    this.namesSub = this.forecasting.workerNames().subscribe(names => this.names.set(names));
    this.load();
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.namesSub?.unsubscribe();
  }

  // ── Periodo ──────────────────────────────────────────────────────────────

  setFrom(value: string): void {
    this.from.set(value);
    this.quick.set(matchingQuickPeriod({ from: value, to: this.to() }));
  }

  setTo(value: string): void {
    this.to.set(value);
    this.quick.set(matchingQuickPeriod({ from: this.from(), to: value }));
  }

  useLastDays(days: number): void {
    const period = lastDaysPeriod(days);
    this.from.set(period.from);
    this.to.set(period.to);
    this.quick.set(days);
    this.load();
  }

  /**
   * Valida antes de llamar: un periodo inválido daría 400 en el backend, y la
   * pantalla prefiere decir por qué sin hacer la petición.
   */
  load(): void {
    const period = { from: this.from() || undefined, to: this.to() || undefined, zone: this.zone };
    const invalid = this.forecasting.validatePeriod(period);
    this.periodError.set(invalid);
    this.loadSub?.unsubscribe();
    if (invalid) {
      // No se deja a la vista el resumen de otro periodo bajo un filtro que no
      // le corresponde.
      this.summary.set(null);
      this.error.set(false);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.summary.set(null);
    this.loadSub = this.forecasting.summaryResult(period).subscribe(result => {
      this.loading.set(false);
      if (!result.ok) {
        this.error.set(true);
        return;
      }
      this.summary.set(result.data);
    });
  }

  // ── Tabla por operario ───────────────────────────────────────────────────

  /** Un clic ordena de mayor a menor; otro en la misma columna invierte. */
  sortBy(key: WorkerSortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('desc');
    }
  }

  ariaSort(key: WorkerSortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  sortIcon(key: WorkerSortKey): string {
    if (this.sortKey() !== key) return 'ph ph-caret-up-down';
    return this.sortDir() === 'asc' ? 'ph ph-caret-up' : 'ph ph-caret-down';
  }

  // ── Presentación ─────────────────────────────────────────────────────────

  workerName(id: number | null | undefined): string {
    return this.forecasting.workerName(id, this.names());
  }

  pct(value: number | null | undefined): string {
    return value == null ? '—' : `${value}%`;
  }

  exportCsv(): void {
    const s = this.summary();
    if (s) this.forecasting.downloadCsv(s, this.names());
  }
}
