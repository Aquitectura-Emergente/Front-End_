import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Alarms } from './alarms';
import { AlarmItem } from '../../../../contexts/alerts/domain/alarm.model';
import { environment } from '../../../../../environments/environment';

function alarm(overrides: Partial<AlarmItem> = {}): AlarmItem {
  return {
    id: 1,
    type: 'danger',
    icon: 'ph-warning-circle',
    title: 'Campo por encima del umbral',
    description: 'Sensor GP-SN-003',
    time: 'hace 2 h',
    resolved: false,
    resolvedAt: null,
    ...overrides,
  };
}

/**
 * El botón de resolver estuvo implementado en el componente pero sin markup que
 * lo invocara: el modal solo ofrecía "Cerrar". Estos tests fijan que vuelva a
 * aparecer, y solo cuando la alarma está sin resolver.
 */
describe('Alarms — acción de resolver', () => {
  let fixture: ComponentFixture<Alarms>;
  let component: Alarms;
  let http: HttpTestingController;

  const OPEN     = alarm({ id: 1, resolved: false });
  const RESOLVED = alarm({ id: 2, resolved: true, resolvedAt: '2026-10-23T11:00:00' });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Alarms],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Alarms);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/alarms`).flush({ data: [OPEN, RESOLVED] });
    http.expectOne(`${environment.apiUrl}/users`).flush({ data: [] });
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  function resolveButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.btn--resolve');
  }

  it('ofrece resolver cuando la alarma está sin resolver', async () => {
    component.openDetail(OPEN);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(resolveButton()).toBeTruthy();
  });

  it('no ofrece resolver cuando la alarma ya está resuelta', async () => {
    component.openDetail(RESOLVED);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(resolveButton()).toBeNull();
  });

  it('al pulsar, hace PATCH al endpoint de resolver y recarga la lista', async () => {
    component.openDetail(OPEN);
    fixture.detectChanges();
    await fixture.whenStable();

    resolveButton()!.click();

    const req = http.expectOne(`${environment.apiUrl}/alarms/${OPEN.id}/resolve`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ data: { ...OPEN, resolved: true, resolvedAt: '2026-10-23T12:00:00' } });

    // Cierra el modal y vuelve a pedir la lista.
    http.expectOne(`${environment.apiUrl}/alarms`).flush({ data: [] });
    await fixture.whenStable();

    expect(resolveButton()).toBeNull();
  });
});
