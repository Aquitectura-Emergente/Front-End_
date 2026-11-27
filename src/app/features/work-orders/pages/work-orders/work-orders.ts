import { Component, inject, HostListener, signal, OnInit, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MonitoringFacade } from '../../../../contexts/radiationmonitoring/application/monitoring-facade';
import { ThemeService } from '../../../../core/services/theme.service';
import { axisLabels, chartTokens, gridOptions } from '../../../../core/utils/chart-theme';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { Pager } from '../../../../shared/ui/pager/pager';
import { NgApexchartsModule } from 'ng-apexcharts';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { WorkOrderFacade } from '../../../../contexts/fieldservice/application/work-order-facade';
import { WorkOrder } from '../../../../contexts/fieldservice/domain/work-order.model';
import { ToastService } from '../../../../core/services/toast.service';
import { ActivityService } from '../../../../core/services/activity.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-work-orders',
  imports: [NgApexchartsModule, TranslatePipe, RouterLink, FormsModule, PageHeader, EmptyState, Pager],
  templateUrl: './work-orders.html',
})
export class WorkOrders implements OnInit {
  protected lang    = inject(LanguageService);
  private workOrderFacade = inject(WorkOrderFacade);
  private toast     = inject(ToastService);
  private activity  = inject(ActivityService);
  private router    = inject(Router);
  private monitoring = inject(MonitoringFacade);
  private theme     = inject(ThemeService);

  orders = signal<WorkOrder[]>([]);
  loading = signal(true);

  // Filter signals
  searchQuery    = signal('');
  selectedType   = signal('all');
  selectedStatus = signal('all');
  // Sort: 'date' = closest scheduled date first; 'created' = newest added first
  sortBy         = signal('date');

  // Pagination signals
  currentPage    = signal(0);
  totalPages     = signal(0);
  totalElements  = signal(0);
  readonly pageSize = 10;

  openMenuIndex: number | null = null;

  // Delete confirm modal (now also captures the cancellation/deletion reason,
  // which is recorded in History as a Cancelled entry by the backend).
  showDeleteModal  = signal(false);
  deleteOrderId: number | string | null = null;
  deleteReason = '';

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    const status = this.selectedStatus() !== 'all' ? this.selectedStatus() : undefined;
    const type   = this.selectedType()   !== 'all' ? this.selectedType()   : undefined;
    const search = this.searchQuery().trim() || undefined;
    this.workOrderFacade.paged(status, type, search, this.currentPage(), this.pageSize, this.sortBy()).subscribe(response => {
      this.orders.set(response.content);
      this.totalPages.set(response.totalPages);
      this.totalElements.set(response.totalElements);
      this.loading.set(false);
    });
  }

  applyFilters(): void {
    this.currentPage.set(0);
    this.loadOrders();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
      this.loadOrders();
    }
  }

  getPagesArray(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  @HostListener('document:click')
  closeMenu(): void {
    this.openMenuIndex = null;
  }

  toggleMenu(index: number, event: Event): void {
    event.stopPropagation();
    this.openMenuIndex = this.openMenuIndex === index ? null : index;
  }

  editOrder(id: number | string, event: Event): void {
    event.stopPropagation();
    this.openMenuIndex = null;
    this.router.navigate(['/admin/work-orders/edit', id]);
  }

  openDeleteModal(id: number | string, event: Event): void {
    event.stopPropagation();
    this.deleteOrderId = id;
    this.deleteReason = '';
    this.showDeleteModal.set(true);
    this.openMenuIndex = null;
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deleteOrderId = null;
  }

  confirmDelete(): void {
    if (!this.deleteOrderId || !this.deleteReason) return;
    const reason = this.deleteReason;
    this.workOrderFacade.cancel(this.deleteOrderId, reason).subscribe(() => {
      this.activity.log('Work order deleted', `Reason: ${reason}`);
      this.toast.success('Work order deleted successfully');
      this.closeDeleteModal();
      this.loadOrders();
    });
  }

  // Actividad por ciudad: datos reales de /chart-data (antes eran valores fijos).
  private chartTheme = computed(() => {
    this.theme.darkMode();
    return chartTokens();
  });
  private regional = toSignal(this.monitoring.chartData().pipe(map((c) => c?.regional ?? null)), { initialValue: null });
  regionalSeries = computed(() => [{ name: this.lang.t('nav_workOrders'), data: this.regional()?.series ?? [] }]);
  regionalChart = { type: 'bar', height: 180, toolbar: { show: false }, background: 'transparent' } as const;
  regionalXAxis = computed(() => ({
    categories: this.regional()?.categories ?? [],
    labels: axisLabels(this.chartTheme()),
    axisBorder: { show: true, color: this.chartTheme().border },
    axisTicks: { show: false },
  }));
  regionalYAxis = computed(() => ({ labels: axisLabels(this.chartTheme()), tickAmount: 3 }));
  regionalPlotOptions = { bar: { borderRadius: 1, columnWidth: '40%' } };
  regionalColors = computed(() => [this.chartTheme().series[0]]);
  regionalGrid = computed(() => gridOptions(this.chartTheme()));
  regionalDataLabels = { enabled: false };
  regionalTooltip = computed(() => ({ theme: this.chartTheme().dark ? 'dark' : 'light' }));
}
