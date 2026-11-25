import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ForecastingFacade } from './forecasting-facade';
import { AuthService } from '../../iam/application/auth.service';
import { environment } from '../../../../environments/environment';
import { AnalyticsSummary } from '../domain/analytics-summary.model';
import { Assessment } from '../domain/assessment.model';
import { WorkerNames } from '../domain/worker-name';

const API = `${environment.apiUrl}/v1/ai-forecasting`;

// Espia a mano: los specs de este repo no importan utilidades de vitest.
class AuthStub {
  organizationId: number | null = 8;
  currentUser() {
    return { id: 3, role: 'sso_responsible', organizationId: this.organizationId };
  }
}

const ASSESSMENT = {
  id: 'a-300',
  organizationId: 8,
  workerId: 300,
  sessionId: 'S-300',
  status: 'RECOMMENDED',
  criticality: 'CRITICAL',
  projection: {
    currentIndex: 11500, limitIndex: 12000, accumulationRate: 0.8, projectedIndexAtShiftEnd: 23000,
    remainingMargin: 500, consumedRatio: 0.958333, projectedRatio: 1.916667,
    estimatedExceedanceAt: '2026-11-10T12:10:25Z', shiftEnd: '2026-11-10T16:00:00Z', unit: 'uT*s',
  },
  recommendation: { type: 'RESCHEDULE_TASK', sourceWorkerId: 300, estimatedBenefitIndex: 11500, reason: '…' },
  modelVersion: { modelId: 'LINEAR_RATE', version: '1', code: 'LINEAR_RATE_V1' },
  assessedAt: '2026-11-10T12:00:00Z',
  isProjection: true,
} as Assessment;

describe('ForecastingFacade', () => {
  let facade: ForecastingFacade;
  let http: HttpTestingController;
  let auth: AuthStub;

  beforeEach(() => {
    auth = new AuthStub();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    facade = TestBed.inject(ForecastingFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('criticalWorkers', () => {
    // El SSO no manda organizationId: el backend usa el del token.
    it('pide la pagina sin organizationId y desempaqueta data', () => {
      let result: Assessment[] = [];
      facade.criticalWorkers().subscribe(p => (result = p.content));

      http.expectOne(`${API}/projections/critical-workers?page=0&size=20`).flush({
        success: true,
        data: { content: [ASSESSMENT], page: 0, size: 20, totalElements: 1, totalPages: 1, last: true },
      });

      expect(result.map(a => a.workerId)).toEqual([300]);
    });

    it('envia la criticidad minima cuando se filtra', () => {
      facade.criticalWorkers('HIGH', 1, 10).subscribe();
      const req = http.expectOne(`${API}/projections/critical-workers?minCriticality=HIGH&page=1&size=10`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: { content: [], page: 1, size: 10, totalElements: 0, totalPages: 0, last: true } });
    });

    it('si falla degrada a pagina vacia', () => {
      let total = -1;
      facade.criticalWorkers().subscribe(p => (total = p.totalElements));
      http.expectOne(`${API}/projections/critical-workers?page=0&size=20`)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      expect(total).toBe(0);
    });
  });

  describe('activeForWorker', () => {
    it('devuelve la evaluacion activa', () => {
      let result: Assessment | null = null;
      facade.activeForWorker(300).subscribe(a => (result = a));
      http.expectOne(`${API}/projections/workers/300`).flush({ data: ASSESSMENT });
      expect(result!.criticality).toBe('CRITICAL');
    });

    // Operario sin evaluación activa: estado normal, la vista muestra «sin evaluación activa».
    it('un 404 se convierte en null', () => {
      let result: Assessment | null | undefined;
      facade.activeForWorker(200).subscribe(a => (result = a));
      http.expectOne(`${API}/projections/workers/200`)
        .flush({ success: false, message: 'Not found' }, { status: 404, statusText: 'Not Found' });
      expect(result).toBeNull();
    });
  });

  describe('summary', () => {
    it('usa la organizacion del SSO en la ruta y solo envia los filtros presentes', () => {
      let result: AnalyticsSummary | null = null;
      facade.summary({ from: '2026-11-04', to: '2026-11-25' }).subscribe(s => (result = s));

      http.expectOne(`${API}/analytics/organizations/8/summary?from=2026-11-04&to=2026-11-25`)
        .flush({ data: { organizationId: 8, from: '2026-11-04', to: '2026-11-25' } });

      expect(result!.organizationId).toBe(8);
    });

    it('sin periodo no envia query string', () => {
      facade.summary().subscribe();
      http.expectOne(`${API}/analytics/organizations/8/summary`).flush({ data: {} });
    });

    // Sin organización la URL no se puede construir: no se hace la llamada.
    it('sin organizacion devuelve null sin llamar al backend', () => {
      auth.organizationId = null;
      let result: AnalyticsSummary | null | undefined;
      facade.summary().subscribe(s => (result = s));
      http.expectNone(() => true);
      expect(result).toBeNull();
    });
  });

  describe('workerNames', () => {
    it('cruza los operarios del SSO con su id', () => {
      let names: WorkerNames = new Map();
      facade.workerNames().subscribe(n => (names = n));
      http.expectOne(`${environment.apiUrl}/sso/workers`).flush({
        data: [{ id: 300, name: 'Lucía Mendoza' }, { id: 14, name: 'Carlos Rojas' }],
      });
      expect(facade.workerName(300, names)).toBe('Lucía Mendoza');
      expect(facade.workerName(999, names)).toBe('#999');
    });

    it('si la lista falla, el mapa queda vacio y se muestra el id', () => {
      let names: WorkerNames | undefined;
      facade.workerNames().subscribe(n => (names = n));
      http.expectOne(`${environment.apiUrl}/sso/workers`)
        .flush(null, { status: 500, statusText: 'Server Error' });
      expect(names!.size).toBe(0);
      expect(facade.workerName(14, names!)).toBe('#14');
    });
  });
});
