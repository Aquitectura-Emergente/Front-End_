import { Pager } from '../../../../shared/ui/pager/pager';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import {
  Component, inject, signal, computed,
  OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, PLATFORM_ID, effect
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { MonitoringFacade } from '../../../../contexts/radiationmonitoring/application/monitoring-facade';
import { ClientRadiationPoint, ClientDeviceReading } from '../../../../contexts/radiationmonitoring/domain/radiation-map.model';
import { DeviceFacade } from '../../../../contexts/devicemanagement/application/device-facade';
import { loadLeaflet } from '../../../../core/maps/leaflet';

@Component({
  selector: 'app-map-radiation',
  imports: [TranslatePipe, PageHeader, EmptyState, Pager],
  templateUrl: './map-radiation.html',
  styleUrl: './map-radiation.scss',
})
export class MapRadiation implements OnInit, AfterViewInit, OnDestroy {
  private monitoring   = inject(MonitoringFacade);
  private deviceFacade = inject(DeviceFacade);
  private platformId = inject(PLATFORM_ID);
  private rtSub?: Subscription;

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  clientPoints = signal<ClientRadiationPoint[]>([]);
  loading      = signal(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private L: any = null;
  private mapReady   = false;
  private dataLoaded = false;

  // Stats based on individual sensor readings (one per device), classified by level.
  safeCount    = computed(() => this.allDeviceReadings().filter(r => r.level === 'safe').length);
  cautionCount = computed(() => this.allDeviceReadings().filter(r => r.level === 'caution').length);
  dangerCount  = computed(() => this.allDeviceReadings().filter(r => r.level === 'danger').length);

  // Flatten all device readings for table. The level comes from the backend
  // (edge-computed, smart edge); monitoring.levelFor is only a fallback.
  allDeviceReadings = computed(() => {
    const rows: Array<ClientDeviceReading & { clientName: string }> = [];
    for (const cp of this.clientPoints()) {
      for (const d of cp.devices) {
        rows.push({ ...d, clientName: cp.clientName, level: d.level ?? this.monitoring.levelFor(d.latestValue) });
      }
    }
    return rows.sort((a, b) => b.latestValue - a.latestValue);
  });

  // Table pagination
  readonly mapPageSize = 10;
  mapCurrentPage = signal(0);
  mapTotalPages  = computed(() => Math.ceil(this.allDeviceReadings().length / this.mapPageSize));
  pagedRows      = computed(() => {
    const start = this.mapCurrentPage() * this.mapPageSize;
    return this.allDeviceReadings().slice(start, start + this.mapPageSize);
  });

  mapGoToPage(page: number): void {
    if (page >= 0 && page < this.mapTotalPages()) this.mapCurrentPage.set(page);
  }

  mapPagesArray(): number[] {
    return Array.from({ length: this.mapTotalPages() }, (_, i) => i);
  }

  mapMin(a: number, b: number): number { return Math.min(a, b); }

  constructor() {
    effect(() => {
      const pts = this.clientPoints();
      if (pts.length > 0 && this.mapReady && this.L) {
        this.renderMarkers(pts);
      }
    });
  }

  ngOnInit(): void {
    this.monitoring.radiationByClient().subscribe(list => {
      this.clientPoints.set(list);
      this.loading.set(false);
      this.dataLoaded = true;
      if (this.mapReady && this.L && list.length > 0) {
        this.renderMarkers(list);
      }
    });

    // Live updates: re-fetch the aggregated map when new readings arrive (browser only).
    if (isPlatformBrowser(this.platformId)) {
      this.rtSub = this.deviceFacade.readings().pipe(debounceTime(1500)).subscribe(() => {
        this.monitoring.radiationByClient().subscribe(list => {
          this.clientPoints.set(list);
          if (this.mapReady && this.L && list.length > 0) this.renderMarkers(list);
        });
      });
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    loadLeaflet().then(L => {
      this.L = L;
      this.initMap(L);
      this.mapReady = true;
      if (this.dataLoaded && this.clientPoints().length > 0) {
        this.renderMarkers(this.clientPoints());
      }
    });
  }

  ngOnDestroy(): void {
    this.rtSub?.unsubscribe();
    if (this.map) { this.map.remove(); this.map = null; }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private initMap(L: any): void {
    if (!this.mapContainer?.nativeElement) return;
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [-12.05, -77.05],
      zoom: 11,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);

    // In production the stylesheet loads asynchronously, so the container can
    // have size 0 when the map initializes → tiles render blank. Recompute the
    // map size once layout/CSS has settled.
    this.fixMapSize();
  }

  private fixMapSize(): void {
    [0, 200, 500].forEach(delay =>
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, delay)
    );
  }

  private renderMarkers(pts: ClientRadiationPoint[]): void {
    if (!this.map || !this.L) return;

    this.map.eachLayer((layer: any) => {
      if (!(layer instanceof this.L.TileLayer)) this.map.removeLayer(layer);
    });

    const validPts = pts.filter(p => p.latitude && p.longitude);
    if (validPts.length === 0) return;

    validPts.forEach(cp => {
      const icon  = this.L.divIcon({
        className: '',
        html: `<span class="ems-map-marker ems-map-marker--${cp.level}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const devRows = cp.devices
        .map(d => {
          const lvl = d.level ?? this.monitoring.levelFor(d.latestValue);
          return `
          <tr>
            <td>${d.deviceLocation}</td>
            <td class="ems-map-popup__val ems-map-popup__val--${lvl}">${d.latestValue.toFixed(1)} µT</td>
          </tr>`;
        })
        .join('');

      const popup = `
        <div class="ems-map-popup">
          <div class="ems-map-popup__title">${cp.clientName}</div>
          <div class="ems-map-popup__sub">${cp.location ?? ''}</div>
          <div class="ems-map-popup__peak ems-map-popup__peak--${cp.level}">Pico: ${cp.maxValue.toFixed(1)} µT</div>
          <div class="ems-map-popup__label">Sensores instalados (${cp.devices.length})</div>
          <table class="ems-map-popup__table">
            <thead><tr><th>Zona / Área</th><th>Lectura</th></tr></thead>
            <tbody>${devRows}</tbody>
          </table>
        </div>`;

      this.L.marker([cp.latitude, cp.longitude], { icon })
        .addTo(this.map)
        .bindPopup(popup, { maxWidth: 320 });
    });

    const bounds = this.L.latLngBounds(validPts.map(p => [p.latitude, p.longitude]));
    this.map.fitBounds(bounds, { padding: [60, 60] });
  }

  getStatusLabelKey(level: string): string {
    return `map_${level}`;
  }

  formatValue(value: number): string { return value.toFixed(1); }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
