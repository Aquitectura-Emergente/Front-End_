import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { By } from '@angular/platform-browser';

import { RISK_REFRESH_MS, RiskWorkers } from './risk-workers';
import { StartSessionDialog } from '../../components/start-session-dialog/start-session-dialog';
import { Assessment } from '../../../../contexts/aiforecasting/domain/assessment.model';
import { ExposureSession } from '../../../../contexts/personaldosimetry/domain/exposure-session.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { environment } from '../../../../../environments/environment';

const API = `${environment.apiUrl}/v1/ai-forecasting`;
const LIST = `${API}/projections/critical-workers`;
const WORKERS = `${environment.apiUrl}/sso/workers`;
const PD_SESSIONS = `${environment.apiUrl}/v1/personal-dosimetry/sessions`;

/** Confirmación controlable: los specs de este repo no abren `window.confirm`. */
class ConfirmStub {
  answer = true;
  asked: string[] = [];
  confirm(message: string): boolean {
    this.asked.push(message);
    return this.answer;
  }
}

function pdSession(o: Partial<ExposureSession> = {}): ExposureSession {
  return {
    id: 'S-300', organizationId: 8, workerId: 300, deviceId: 30, jobPositionId: 31, state: 'OPEN',
    methodId: 'MAGNETIC_TIME_INDEX_V1', unit: 'uT*s', accumulatedIndex: 11500, limitIndex: 12000,
    percentage: 95.83, warningRaised: true, limitExceeded: false, coveragePercentage: 100,
    coverageComplete: false, startedAt: '2026-11-10T08:00:00Z', outOfRangeReadings: 0, ...o,
  };
}

// Los dos avisos de la guía de Swagger del backend: 300 CRITICAL y 101 HIGH.
const CRITICAL = {
  id: 'a-300', organizationId: 8, workerId: 300, sessionId: 'S-300',
  status: 'RECOMMENDED', criticality: 'CRITICAL',
  projection: {
    currentIndex: 11500, limitIndex: 12000, accumulationRate: 0.798611, projectedIndexAtShiftEnd: 23000,
    remainingMargin: 500, consumedRatio: 0.958333, projectedRatio: 1.916667,
    estimatedExceedanceAt: '2026-11-10T12:10:26Z', shiftEnd: '2026-11-10T16:00:00Z', unit: 'uT*s',
  },
  recommendation: { type: 'RESCHEDULE_TASK', sourceWorkerId: 300, estimatedBenefitIndex: 11500, reason: 'worker=300' },
  redaction: { text: 'El operario 300 superaría su límite a las 12:10 UTC.', generatedBy: 'FALLBACK', generatedAt: '2026-11-10T12:00:00Z' },
  modelVersion: { modelId: 'LINEAR_RATE', version: '1', code: 'LINEAR_RATE_V1' },
  assessedAt: '2026-11-10T12:00:00Z', isProjection: true,
} as Assessment;

const HIGH = {
  ...CRITICAL,
  id: 'a-101', workerId: 101, sessionId: 'S-101', criticality: 'HIGH',
  projection: {
    ...CRITICAL.projection, currentIndex: 7200, accumulationRate: 0.5, projectedIndexAtShiftEnd: 14400,
    remainingMargin: 4800, consumedRatio: 0.6, projectedRatio: 1.2, estimatedExceedanceAt: '2026-11-10T14:40:00Z',
  },
  recommendation: { type: 'ROTATION', sourceWorkerId: 101, targetWorkerId: 200, estimatedBenefitIndex: 5760 },
  redaction: { text: 'Rotar al operario 101 con el 200.', generatedBy: 'LLM', generatedAt: '2026-11-10T12:00:00Z' },
} as Assessment;

function page(content: Assessment[], totalElements = content.length) {
  return { data: { content, page: 0, size: 50, totalElements, totalPages: 1, last: true } };
}

const NAMES = [
  { id: 300, name: 'Lucía Mendoza' },
  { id: 101, name: 'Carlos Rojas' },
  { id: 200, name: 'Ana Quispe' },
];

describe('RiskWorkers', () => {
  let fixture: ComponentFixture<RiskWorkers>;
  let component: RiskWorkers;
  let http: HttpTestingController;
  let confirm: ConfirmStub;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(el().querySelectorAll('tr.row'));
  }

  function render(): void {
    fixture.detectChanges();
  }

  /** Monta la página y responde a las dos llamadas iniciales. */
  function start(list: object | 'error' = page([HIGH, CRITICAL])): void {
    fixture = TestBed.createComponent(RiskWorkers);
    component = fixture.componentInstance;
    render();
    http.expectOne(WORKERS).flush({ data: NAMES });
    const req = http.expectOne(`${LIST}?page=0&size=50`);
    if (list === 'error') req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    else req.flush(list);
    render();
  }

  beforeEach(async () => {
    confirm = new ConfirmStub();
    await TestBed.configureTestingModule({
      imports: [RiskWorkers],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  /** Abre el detalle de una fila y responde a la evaluación activa y a su jornada. */
  function openDetail(row: number, assessment: Assessment, session: ExposureSession | 'skip' = pdSession()): void {
    rows()[row].click();
    render();
    http.expectOne(`${API}/projections/workers/${assessment.workerId}`).flush({ data: assessment });
    if (session !== 'skip') {
      http.expectOne(`${PD_SESSIONS}/${assessment.sessionId}`).flush({ data: session });
    }
    render();
  }

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  describe('lista', () => {
    it('muestra cada operario con su nombre, de la mas urgente a la menos', () => {
      start();
      const names = rows().map(r => r.querySelector('.worker')!.textContent!.trim());
      // Llegan en otro orden: la página no depende del orden de llegada.
      expect(names).toEqual(['Lucía Mendoza', 'Carlos Rojas']);
    });

    it('pinta el chip de criticidad, los porcentajes y la hora de Lima', () => {
      start();
      const [critical, high] = rows();

      const chip = critical.querySelector('.criticality')!;
      expect(chip.textContent!.trim()).toBe('Critical');
      expect(chip.classList).toContain('pill--danger');
      expect(high.querySelector('.criticality')!.classList).toContain('pill--warn');

      expect(high.querySelector('.percent')!.textContent).toContain('60%');
      expect(high.querySelector('.percent')!.textContent).toContain('120%');
      // La barra proyectada se topa en 100 % y se pinta como excedida.
      const projected = high.querySelector<HTMLElement>('.bar__projected')!;
      expect(projected.style.width).toBe('100%');
      expect(projected.classList).toContain('bar__projected--over');
      expect(high.querySelector<HTMLElement>('.bar__consumed')!.style.width).toBe('60%');

      // 14:40 UTC = 09:40 en Lima.
      expect(high.querySelector('.exceedance')!.textContent!.trim()).toBe('09:40 AM');
    });

    it('muestra la recomendacion con el destino de la rotacion', () => {
      start();
      const [critical, high] = rows();
      expect(critical.querySelector('.recommendation')!.textContent).toContain('Reschedule task');
      expect(high.querySelector('.recommendation')!.textContent).toContain('Rotation');
      expect(high.querySelector('.recommendation')!.textContent).toContain('Ana Quispe');
    });

    it('sin excedencia proyectada muestra un guion', () => {
      const noExceedance = { ...HIGH, projection: { ...HIGH.projection } };
      delete noExceedance.projection.estimatedExceedanceAt;
      start(page([noExceedance]));
      expect(rows()[0].querySelector('.exceedance')!.textContent!.trim()).toBe('—');
    });

    it('indica hace cuanto se evaluo', () => {
      const recent = { ...HIGH, assessedAt: new Date(Date.now() - 5 * 60_000).toISOString() };
      start(page([recent]));
      expect(rows()[0].querySelector('.ago')!.textContent!.trim()).toBe('5 min ago');
    });

    it('un operario que el SSO no conoce se muestra por su id', () => {
      start(page([{ ...HIGH, workerId: 999 }]));
      expect(rows()[0].querySelector('.worker')!.textContent!.trim()).toBe('#999');
    });
  });

  describe('filtro', () => {
    it('pide la criticidad minima elegida', () => {
      start();
      const select = el().querySelector<HTMLSelectElement>('.filter__select')!;
      select.value = 'HIGH';
      select.dispatchEvent(new Event('change'));

      http.expectOne(`${LIST}?minCriticality=HIGH&page=0&size=50`).flush(page([CRITICAL]));
      render();
      expect(rows().length).toBe(1);
    });

    it('volver a «Todas» quita el filtro de la peticion', () => {
      start();
      component.setMinCriticality('CRITICAL');
      http.expectOne(`${LIST}?minCriticality=CRITICAL&page=0&size=50`).flush(page([CRITICAL]));
      component.setMinCriticality('');
      http.expectOne(`${LIST}?page=0&size=50`).flush(page([HIGH, CRITICAL]));
    });

    it('el boton Actualizar vuelve a pedir la lista', () => {
      start();
      el().querySelector<HTMLButtonElement>('.btn--refresh')!.click();
      http.expectOne(`${LIST}?page=0&size=50`).flush(page([]));
    });
  });

  describe('detalle', () => {
    it('al hacer clic pide la evaluacion activa y muestra la proyeccion completa', () => {
      start();
      openDetail(1, HIGH, pdSession({ id: 'S-101', workerId: 101 }));

      const panel = el().querySelector('.detail')!;
      expect(panel.textContent).toContain('Carlos Rojas');
      expect(panel.textContent).toContain('Projection');
      expect(panel.textContent).toContain('7,200 uT*s');           // actual
      expect(panel.textContent).toContain('12,000 uT*s');          // límite
      expect(panel.querySelector('.rate')!.textContent).toContain('0.5 uT*s/s');
      expect(panel.textContent).toContain('14,400 uT*s');          // proyectado
      expect(panel.textContent).toContain('4,800 uT*s');           // margen
      expect(panel.textContent).toContain('Nov 10, 11:00 AM');     // fin de turno (16:00 UTC)
      expect(panel.textContent).toContain('swap with Ana Quispe');
      expect(panel.textContent).toContain('Rotar al operario 101 con el 200.');
    });

    it('etiqueta la explicacion como IA o Plantilla segun generatedBy', () => {
      start();
      openDetail(1, HIGH, pdSession({ id: 'S-101', workerId: 101 }));
      expect(el().querySelector('.redaction-tag')!.textContent!.trim()).toBe('AI');

      component.closeDetail();
      render();
      openDetail(0, CRITICAL);
      expect(el().querySelector('.redaction-tag')!.textContent!.trim()).toBe('Template');
    });

    it('si el operario ya no tiene evaluacion activa (404) lo dice', () => {
      start();
      rows()[0].click();
      render();
      http.expectOne(`${API}/projections/workers/300`)
        .flush({ success: false, message: 'Not found' }, { status: 404, statusText: 'Not Found' });
      http.expectOne(`${PD_SESSIONS}/S-300`).flush({ data: pdSession() });
      render();
      expect(el().querySelector('.no-active')!.textContent!.trim()).toBe('This worker has no active assessment.');
    });

    it('un segundo clic en la misma fila cierra el detalle', () => {
      start();
      openDetail(0, CRITICAL);
      rows()[0].click();
      render();
      expect(el().querySelector('.detail')).toBeNull();
    });
  });

  // ── F4: jornada de dosimetría ──────────────────────────────────────────────

  describe('cerrar jornada', () => {
    const inFuture = () => new Date(Date.now() + 30 * 60_000).toISOString();

    it('pide confirmacion y, si se cancela, no llama al backend', () => {
      start();
      openDetail(0, CRITICAL);
      confirm.answer = false;
      el().querySelector<HTMLButtonElement>('.btn--close-session')!.click();
      expect(confirm.asked[0]).toContain('Lucía Mendoza');
      http.expectNone(`${PD_SESSIONS}/S-300/close`);
    });

    it('cierra sin endedAt y muestra «Procesando lecturas» con el plazo en hora de Lima', () => {
      start();
      openDetail(0, CRITICAL);
      el().querySelector<HTMLButtonElement>('.btn--close-session')!.click();

      const req = http.expectOne(`${PD_SESSIONS}/S-300/close`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      expect('endedAt' in req.request.body).toBe(false);
      req.flush({ data: pdSession({
        state: 'CLOSING', endedAt: '2026-11-25T19:00:00Z', reconciliationDeadline: '2026-11-25T19:30:00Z',
      }) });
      // Refresca la lista al cerrar.
      http.expectOne(`${LIST}?page=0&size=50`).flush(page([HIGH, CRITICAL]));
      render();

      expect(el().querySelector('.processing')!.textContent).toContain('Processing readings');
      // 19:30 UTC = 14:30 en Lima.
      expect(el().querySelector('.provisional')!.textContent).toContain('provisional');
      expect(el().querySelector('.provisional')!.textContent).toContain('Nov 25, 02:30 PM (Lima)');
      expect(el().querySelector('.list-delay')!.textContent).toContain('up to 1 minute');
    });

    it('un error del backend se muestra con titulo y mensaje', () => {
      start();
      openDetail(0, CRITICAL);
      el().querySelector<HTMLButtonElement>('.btn--close-session')!.click();
      http.expectOne(`${PD_SESSIONS}/S-300/close`).flush(
        { success: false, message: 'Session end time is immutable' },
        { status: 409, statusText: 'Conflict' },
      );
      render();
      expect(el().querySelector('.command-error strong')!.textContent!.trim()).toBe('Conflict with the current state');
      expect(el().querySelector('.command-error__message')!.textContent!.trim()).toBe('Session end time is immutable');
    });

    it('antes del plazo «Finalizar» esta deshabilitado y dice desde cuando se podra', () => {
      start();
      const deadline = inFuture();
      openDetail(0, CRITICAL, pdSession({ state: 'CLOSING', reconciliationDeadline: deadline }));

      const button = el().querySelector<HTMLButtonElement>('.btn--finalize')!;
      expect(button.disabled).toBe(true);
      expect(el().querySelector('.finalize-from')!.textContent).toContain('Can be finalized from');
      // Ni forzándolo desde código se envía antes de tiempo.
      component.finalizeSession();
      http.expectNone(`${PD_SESSIONS}/S-300/finalize`);
    });
  });

  describe('finalizar jornada', () => {
    const past = '2026-11-25T14:30:00Z';

    it('pasado el plazo finaliza con deliveryConfirmed: false y muestra «Jornada cerrada»', () => {
      start();
      openDetail(0, CRITICAL, pdSession({ state: 'CLOSING', reconciliationDeadline: past }));

      const button = el().querySelector<HTMLButtonElement>('.btn--finalize')!;
      expect(button.disabled).toBe(false);
      expect(el().querySelector('.finalize-from')).toBeNull();
      button.click();

      const req = http.expectOne(`${PD_SESSIONS}/S-300/finalize`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ deliveryConfirmed: false });
      req.flush({ data: pdSession({
        state: 'CLOSED', reconciliationDeadline: past, finalizedAt: '2026-11-25T15:00:00Z',
        accumulatedIndex: 11800, percentage: 98.33, coveragePercentage: 97.5, coverageComplete: false,
      }) });
      http.expectOne(`${LIST}?page=0&size=50`).flush(page([HIGH]));
      render();

      expect(el().querySelector('.closed')!.textContent).toContain('Shift closed');
      expect(el().querySelector('.final-index')!.textContent).toContain('11,800 uT*s');
      expect(el().querySelector('.coverage')!.textContent!.trim()).toBe('97.5%');
      expect(el().querySelector('.incomplete')!.textContent).toContain('Incomplete coverage');
    });

    it('con cobertura completa no avisa', () => {
      start();
      openDetail(0, CRITICAL, pdSession({ state: 'CLOSED', coveragePercentage: 100, coverageComplete: true }));
      expect(el().querySelector('.closed')).not.toBeNull();
      expect(el().querySelector('.incomplete')).toBeNull();
      expect(el().querySelector('.btn--finalize')).toBeNull();
    });
  });

  describe('iniciar jornada', () => {
    it('el boton de la cabecera abre el modal y, al iniciar, se cierra y refresca la lista', () => {
      start();
      el().querySelector<HTMLButtonElement>('.btn--start')!.click();
      render();
      const dialog = fixture.debugElement.query(By.directive(StartSessionDialog));
      expect(dialog).not.toBeNull();
      // El modal pide sus opciones; sin organización en la sesión de prueba solo pide operarios.
      http.expectOne(WORKERS).flush({ data: [] });

      (dialog.componentInstance as StartSessionDialog).started.emit(pdSession({ id: 'S-new' }));
      http.expectOne(`${LIST}?page=0&size=50`).flush(page([HIGH, CRITICAL]));
      render();
      expect(fixture.debugElement.query(By.directive(StartSessionDialog))).toBeNull();
    });

    it('cancelar cierra el modal sin refrescar', () => {
      start();
      el().querySelector<HTMLButtonElement>('.btn--start')!.click();
      render();
      http.expectOne(WORKERS).flush({ data: [] });
      el().querySelector<HTMLButtonElement>('.btn--cancel')!.click();
      render();
      expect(fixture.debugElement.query(By.directive(StartSessionDialog))).toBeNull();
      http.expectNone(`${LIST}?page=0&size=50`);
    });
  });

  describe('estados', () => {
    it('vacio: no hay operarios en riesgo', () => {
      start(page([]));
      expect(el().querySelector('.empty')!.textContent!.trim()).toBe('No workers at risk');
      expect(el().querySelector('table')).toBeNull();
    });

    it('cargando: mientras no llega la primera respuesta', () => {
      fixture = TestBed.createComponent(RiskWorkers);
      render();
      expect(el().querySelector('.loading-state')).not.toBeNull();
      http.expectOne(WORKERS).flush({ data: [] });
      http.expectOne(`${LIST}?page=0&size=50`).flush(page([]));
    });

    // Un fallo no puede parecer «no hay nadie en riesgo».
    it('error: lo muestra en vez del estado vacio', () => {
      start('error');
      expect(el().querySelector('[role="alert"]')!.textContent).toContain('Could not load the projections.');
      expect(el().querySelector('.empty')).toBeNull();
    });

    it('un refresco fallido conserva la lista anterior y avisa', () => {
      start();
      component.load(true);
      http.expectOne(`${LIST}?page=0&size=50`).flush(null, { status: 500, statusText: 'Server Error' });
      render();
      expect(rows().length).toBe(2);
      expect(el().querySelector('[role="status"]')!.textContent).toContain('The last refresh failed');
    });
  });

  describe('refresco automatico', () => {
    it('vuelve a pedir la lista cada 60 s y se detiene al destruir la pagina', () => {
      vi.useFakeTimers();
      start();

      vi.advanceTimersByTime(RISK_REFRESH_MS);
      http.expectOne(`${LIST}?page=0&size=50`).flush(page([HIGH, CRITICAL]));

      fixture.destroy();
      vi.advanceTimersByTime(RISK_REFRESH_MS * 3);
      http.expectNone(`${LIST}?page=0&size=50`);
    });

    it('cancela una peticion en curso al destruir la pagina', () => {
      start();
      component.load();
      const pending = http.expectOne(`${LIST}?page=0&size=50`);
      fixture.destroy();
      expect(pending.cancelled).toBe(true);
    });
  });
});
