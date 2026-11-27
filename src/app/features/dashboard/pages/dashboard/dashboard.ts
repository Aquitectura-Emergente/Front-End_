import { Component, DestroyRef, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, debounceTime, of, startWith, switchMap } from 'rxjs';
import { NgApexchartsModule } from 'ng-apexcharts';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MonitoringFacade } from '../../../../contexts/radiationmonitoring/application/monitoring-facade';
import { WorkOrderFacade } from '../../../../contexts/fieldservice/application/work-order-facade';
import { DeviceFacade } from '../../../../contexts/devicemanagement/application/device-facade';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ThemeService } from '../../../../core/services/theme.service';
import { axisLabels, chartTokens, gridOptions } from '../../../../core/utils/chart-theme';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-dashboard',
  imports: [NgApexchartsModule, TranslatePipe, DecimalPipe, RouterLink, PageHeader, EmptyState],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  protected lang = inject(LanguageService);
  private theme = inject(ThemeService);
  private monitoring     = inject(MonitoringFacade);
  private workOrderFacade = inject(WorkOrderFacade);
  private deviceFacade   = inject(DeviceFacade);
  private platformId = inject(PLATFORM_ID);

  /** Emite al iniciar y, en el navegador, tras cada ráfaga de lecturas en vivo (/topic/readings). */
  private refresh$: Observable<unknown> = (isPlatformBrowser(this.platformId)
    ? this.deviceFacade.readings().pipe(debounceTime(1500), startWith(null))
    : of(null)
  );

  stats = toSignal(this.refresh$.pipe(switchMap(() => this.monitoring.stats())));
  latestOrders = toSignal(this.monitoring.latestWorkOrders());
  alerts = toSignal(this.refresh$.pipe(switchMap(() => this.monitoring.alerts())));
  private destroyRef = inject(DestroyRef);

  // Charts only render once data has loaded — fixes blank charts when
  // navigating back to the dashboard (the chart mounts with data present).
  protected chartsReady = signal(false);

  // Colores y tipografía de los gráficos según el tema activo.
  protected chart = computed(() => {
    this.theme.darkMode();
    return chartTokens();
  });
  protected grid = computed(() => gridOptions(this.chart()));
  protected tooltip = computed(() => ({ theme: this.chart().dark ? 'dark' : 'light' }));
  protected readonly noLabels = { enabled: false };
  protected readonly legend = { show: false };
  protected readonly skeletonBars = [40, 65, 30, 80, 55, 70, 45, 90, 60, 35, 75, 50];

  // Actividad del sistema: la serie real del backend, sin desagregaciones estimadas.
  serviceHistorySeries: { name: string; data: number[] }[] = [{ name: 'Activity', data: [] }];
  serviceHistoryChart = { type: 'bar', height: 320, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' } as const;
  private categories = signal<string[]>([]);
  serviceHistoryXAxis = computed(() => ({
    categories: this.categories(),
    labels: axisLabels(this.chart()),
    axisBorder: { show: true, color: this.chart().border },
    axisTicks: { show: true, color: this.chart().border },
  }));
  serviceHistoryYAxis = computed(() => ({ labels: axisLabels(this.chart()), tickAmount: 4 }));
  serviceHistoryPlotOptions = { bar: { borderRadius: 1, columnWidth: '55%' } };

  // Tendencia del campo medio
  radiationTrendsSeries: { name: string; data: number[] }[] = [{ name: 'µT', data: [] }];
  radiationTrendsChart = {
    type: 'area',
    height: 150,
    toolbar: { show: false },
    background: 'transparent',
    zoom: { enabled: false },
    selection: { enabled: false },
    animations: { enabled: false },
    sparkline: { enabled: false },
  } as const;
  radiationTrendsXAxis = { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } };
  radiationTrendsYAxis = computed(() => ({
    labels: { ...axisLabels(this.chart()), formatter: (v: number) => v.toFixed(0) },
    tickAmount: 3,
  }));
  radiationTrendsStroke = { curve: 'straight' as const, width: 1.5 };
  radiationTrendsFill = { type: 'solid', opacity: 0.08 };
  radiationTooltip = computed(() => ({
    theme: this.chart().dark ? 'dark' : 'light',
    y: { formatter: (v: number) => `${v.toFixed(1)} µT` },
  }));
  radiationTrendsMarkers = { size: 0 };

  ngOnInit(): void {
    this.refresh$.pipe(switchMap(() => this.monitoring.chartData()), takeUntilDestroyed(this.destroyRef)).subscribe(c => {
      if (!c) return;
      this.serviceHistorySeries = [{ name: this.lang.t('dash_serviceHistory'), data: c.systemActivity.series }];
      this.categories.set(c.systemActivity.categories);
      this.radiationTrendsSeries = [{ name: 'Avg radiation (µT)', data: c.radiationTrends.series }];
      this.chartsReady.set(true);
    });
  }

  // Exports the Work Orders History (the 'History' section), not the live orders.
  exportReport(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.workOrderFacade.history().subscribe(records => {
      if (!records.length) return;
      const headers = ['Order ID', 'Completion Date', 'Completion Time', 'Client', 'Site', 'Service Type', 'Technician', 'Status'];
      const csv = [
        headers.join(','),
        ...records.map(h =>
          [h.orderId, h.completionDate, h.completionTime, h.client, h.site, h.serviceType, h.technician, h.status]
            .map(v => `"${v ?? ''}"`)
            .join(',')
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'work-orders-history.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
