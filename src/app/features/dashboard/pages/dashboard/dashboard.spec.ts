import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { Dashboard } from './dashboard';
import { DeviceFacade } from '../../../../contexts/devicemanagement/application/device-facade';
import { MonitoringFacade } from '../../../../contexts/radiationmonitoring/application/monitoring-facade';
import { Reading } from '../../../../contexts/devicemanagement/domain/reading.model';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let readings$: Subject<Reading>;

  beforeEach(async () => {
    readings$ = new Subject<Reading>();
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      // Lee de MonitoringFacade/WorkOrderFacade al construirse: hace falta
      // HttpClient (interceptado) y el router por los RouterLink de la vista.
      // El WebSocket se sustituye por un Subject para no abrir conexiones reales.
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DeviceFacade, useValue: { readings: () => readings$.asObservable() } },
      ],
    }).compileComponents();
  });

  it('should create', async () => {
    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('vuelve a pedir estadísticas y alertas al llegar lecturas en vivo', async () => {
    vi.useFakeTimers();
    try {
      const monitoring = TestBed.inject(MonitoringFacade);
      const stats  = vi.spyOn(monitoring, 'stats').mockReturnValue(of(null));
      const alerts = vi.spyOn(monitoring, 'alerts').mockReturnValue(of([]));
      vi.spyOn(monitoring, 'chartData').mockReturnValue(of(null));

      fixture = TestBed.createComponent(Dashboard);
      fixture.detectChanges();
      expect(stats).toHaveBeenCalledTimes(1);
      expect(alerts).toHaveBeenCalledTimes(1);

      readings$.next({ serialNumber: 'SN-1', field_uT: 12 });
      vi.advanceTimersByTime(1500);

      expect(stats).toHaveBeenCalledTimes(2);
      expect(alerts).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
