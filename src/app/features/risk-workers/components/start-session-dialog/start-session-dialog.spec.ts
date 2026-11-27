import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StartSessionDialog } from './start-session-dialog';
import { AuthService } from '../../../../contexts/iam/application/auth.service';
import { ExposureSession } from '../../../../contexts/personaldosimetry/domain/exposure-session.model';
import { environment } from '../../../../../environments/environment';

const API = environment.apiUrl;
const SESSIONS = `${API}/v1/personal-dosimetry/sessions`;

class AuthStub {
  currentUser() {
    return { id: 3, role: 'sso_responsible', organizationId: 8 };
  }
  getToken() { return null; }
  get isLoggedIn() { return true; }
}

const WORKERS = [{ id: 14, name: 'Carlos Rojas' }, { id: 15, name: 'Lucía Mendoza' }];
const POSITIONS = [
  { id: 31, plantZoneId: 1, plantZoneName: 'Planta AF demo', name: 'Prensa hidráulica', createdAt: '2026-11-01T00:00:00Z' },
  { id: 32, plantZoneId: 1, plantZoneName: 'Planta AF demo', name: 'Soldadura', createdAt: '2026-11-01T00:00:00Z' },
  { id: 33, plantZoneId: 1, plantZoneName: 'Planta AF demo', name: 'Inspección', createdAt: '2026-11-01T00:00:00Z' },
];
const LIMITS = [
  // 31 vigente; 32 solo con una versión futura; 33 sin límite.
  { id: 1, organizationId: 8, jobPositionId: 31, version: 1, limitIndex: 12000, warningRatio: 0.8,
    methodId: 'MAGNETIC_TIME_INDEX_V1', unit: 'uT*s', effectiveFrom: '2026-01-01T00:00:00Z' },
  { id: 2, organizationId: 8, jobPositionId: 32, version: 1, limitIndex: 12000, warningRatio: 0.8,
    methodId: 'MAGNETIC_TIME_INDEX_V1', unit: 'uT*s', effectiveFrom: '2999-01-01T00:00:00Z' },
];

const DOSIMETERS = [
  { device: { id: 44, deviceId: 'AF-DEMO-DOS-01', deviceType: 'PERSONAL_DOSIMETER', organizationId: 8, connectivity: 'ONLINE' }, inSession: false },
  { device: { id: 45, deviceId: 'AF-DEMO-DOS-02', deviceType: 'PERSONAL_DOSIMETER', organizationId: 8, connectivity: 'OFFLINE' }, inSession: true },
];

function lastSession(o: Partial<ExposureSession> = {}): ExposureSession {
  return {
    id: 'S-prev', organizationId: 8, workerId: 14, deviceId: 30, jobPositionId: 31, state: 'CLOSED',
    methodId: 'MAGNETIC_TIME_INDEX_V1', unit: 'uT*s', accumulatedIndex: 9000, limitIndex: 12000, percentage: 75,
    warningRaised: false, limitExceeded: false, coveragePercentage: 100, coverageComplete: true,
    startedAt: '2026-11-24T13:00:00Z', outOfRangeReadings: 0, ...o,
  };
}

describe('StartSessionDialog', () => {
  let fixture: ComponentFixture<StartSessionDialog>;
  let component: StartSessionDialog;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const render = () => fixture.detectChanges();

  function select(selector: string, value: string): void {
    const s = el().querySelector<HTMLSelectElement>(selector)!;
    s.value = value;
    s.dispatchEvent(new Event('change'));
    render();
  }

  function chooseWorker(id: number, last: ExposureSession[] = [lastSession()], usual: object = {}): void {
    select('.field-worker', String(id));
    http.expectOne(`${API}/v1/personal-dosimetry/workers/${id}/defaults`).flush({ data: usual });
    http.expectOne(`${API}/v1/personal-dosimetry/workers/${id}/sessions?page=0&size=1`).flush({
      data: { content: last, page: 0, size: 1, totalElements: last.length, totalPages: 1, last: true },
    });
    render();
  }

  function lookup(serial: string): ReturnType<HttpTestingController['expectOne']> {
    const input = el().querySelector<HTMLInputElement>('.field-serial')!;
    input.value = serial;
    input.dispatchEvent(new Event('input'));
    el().querySelector<HTMLButtonElement>('.btn--lookup')!.click();
    return http.expectOne(`${API}/v1/device-management/devices/${serial}`);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StartSessionDialog],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: new AuthStub() },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(StartSessionDialog);
    component = fixture.componentInstance;
    render();
    http.expectOne(`${API}/sso/workers`).flush({ data: WORKERS });
    http.expectOne(`${API}/v1/device-management/organizations/8/dosimeters`).flush({ data: DOSIMETERS });
    http.expectOne(`${API}/v1/plant-config/job-positions`).flush({ data: POSITIONS });
    http.expectOne(`${API}/v1/personal-dosimetry/organizations/8/limits?page=0&size=50`).flush({
      data: { content: LIMITS, page: 0, size: 50, totalElements: 2, totalPages: 1, last: true },
    });
    render();
  });

  afterEach(() => http.verify());

  it('solo ofrece los puestos con un limite vigente', () => {
    const options = Array.from(el().querySelectorAll('.field-position option')).map(o => o.textContent!.trim());
    expect(options).toEqual(['—', 'Prensa hidráulica (Planta AF demo)']);
  });

  it('prellena el dosimetro y el puesto con la ultima jornada del operario', () => {
    chooseWorker(14);
    expect(el().querySelector('.device__chosen')!.textContent).toContain('#30');
    expect(el().querySelector('.device__chosen')!.textContent).toContain('from the last shift');
    expect(component.jobPositionId()).toBe(31);
  });

  it('el puesto y el dosimetro habituales mandan sobre la ultima jornada', () => {
    chooseWorker(14, [lastSession()], { deviceId: 44 });
    expect(component.deviceId()).toBe(44);
    expect(component.jobPositionId()).toBe(31);
    expect(el().querySelector('.device__chosen')!.textContent).toContain('AF-DEMO-DOS-01 (#44)');
    expect(el().querySelector('.device__chosen')!.textContent).toContain('usual dosimeter');
  });

  it('sin jornada previa no prellena nada', () => {
    chooseWorker(15, []);
    expect(el().querySelector('.device__chosen')).toBeNull();
    expect(component.jobPositionId()).toBeNull();
  });

  // Un puesto que perdió su límite vigente no se prellena: el backend lo rechazaría.
  it('no prellena un puesto que ya no tiene limite vigente', () => {
    chooseWorker(14, [lastSession({ jobPositionId: 33 })]);
    expect(component.jobPositionId()).toBeNull();
    expect(component.deviceId()).toBe(30);
  });

  it('busca el dosimetro por serial y lo usa al iniciar, sin startedAt', () => {
    chooseWorker(14, []);
    select('.field-position', '31');
    lookup('AF-DEMO-DOS-01').flush({
      data: { id: 44, deviceId: 'AF-DEMO-DOS-01', deviceType: 'PERSONAL_DOSIMETER', organizationId: 8 },
    });
    render();
    expect(el().querySelector('.device__chosen')!.textContent).toContain('AF-DEMO-DOS-01 (#44)');

    let started: ExposureSession | undefined;
    component.started.subscribe(s => (started = s));
    el().querySelector<HTMLButtonElement>('.btn--submit')!.click();
    const req = http.expectOne(SESSIONS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ workerId: 14, jobPositionId: 31, deviceId: 44 });
    expect('startedAt' in req.request.body).toBe(false);
    req.flush({ data: lastSession({ id: 'S-new', state: 'OPEN' }) }, { status: 201, statusText: 'Created' });
    expect(started!.id).toBe('S-new');
  });

  it('elige el dosimetro de la lista de la empresa; los que estan en jornada no se pueden elegir', () => {
    const options = Array.from(el().querySelectorAll<HTMLOptionElement>('.field-dosimeter option'));
    expect(options.map(o => o.textContent!.trim())).toEqual([
      'Choose a company dosimeter', 'AF-DEMO-DOS-01 · online', 'AF-DEMO-DOS-02 · in a shift',
    ]);
    expect(options[2].disabled).toBe(true);

    select('.field-dosimeter', '44');
    expect(component.deviceId()).toBe(44);
    expect(el().querySelector('.device__chosen')!.textContent).toContain('chosen from the list');
  });

  it('rechaza un serial que no es un dosimetro personal', () => {
    lookup('GP-SN-003').flush({ data: { id: 5, deviceId: 'GP-SN-003', deviceType: 'FIXED_SENSOR', organizationId: 8 } });
    render();
    expect(el().querySelector('.serial-error')!.textContent!.trim()).toBe('That device is not a personal dosimeter.');
    expect(component.deviceId()).toBeNull();
  });

  it('avisa si el serial no existe', () => {
    lookup('NOPE').flush({ message: 'Device not found: NOPE' }, { status: 404, statusText: 'Not Found' });
    render();
    expect(el().querySelector('.serial-error')!.textContent!.trim()).toBe('No device found with that serial.');
  });

  it('no envia el formulario incompleto', () => {
    chooseWorker(14, []);
    select('.field-position', '31');
    el().querySelector<HTMLButtonElement>('.btn--submit')!.click();
    render();
    http.expectNone(SESSIONS);
    expect(el().textContent).toContain('Choose a dosimeter.');
  });

  describe('errores del backend', () => {
    function submitPrefilled() {
      chooseWorker(14);
      el().querySelector<HTMLButtonElement>('.btn--submit')!.click();
      return http.expectOne(SESSIONS);
    }

    it('un 409 conocido muestra el titulo y el motivo traducido', () => {
      submitPrefilled().flush(
        { success: false, message: 'Worker or dosimeter already has a conflicting assignment' },
        { status: 409, statusText: 'Conflict' },
      );
      render();
      const alert = el().querySelector('.command-error')!;
      expect(alert.querySelector('strong')!.textContent!.trim()).toBe('Conflict with the current state');
      expect(alert.querySelector('.command-error__message')!.textContent!.trim())
        .toBe('The operator or the dosimeter already has a shift in progress. Close it first.');
    });

    it('un 422 desconocido muestra el titulo traducido y el mensaje tal cual', () => {
      submitPrefilled().flush(
        { success: false, message: 'Worker has no dosimetry membership' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      render();
      const alert = el().querySelector('.command-error')!;
      expect(alert.querySelector('strong')!.textContent!.trim()).toBe('A dosimetry rule was not met');
      expect(alert.querySelector('.command-error__message')!.textContent!.trim())
        .toBe('Worker has no dosimetry membership');
    });
  });
});
