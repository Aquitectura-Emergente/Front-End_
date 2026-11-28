import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NgApexchartsModule } from 'ng-apexcharts';

import { ExposureAnalytics } from './exposure-analytics';
import { AuthService } from '../../../../contexts/iam/application/auth.service';
import { ForecastingFacade } from '../../../../contexts/aiforecasting/application/forecasting-facade';
import { LanguageService } from '../../../../core/services/language.service';
import { AnalyticsSummary } from '../../../../contexts/aiforecasting/domain/analytics-summary.model';
import { lastDaysPeriod } from '../../../../contexts/aiforecasting/domain/analytics-view';
import { PeriodInsights } from '../../../../contexts/aiforecasting/domain/period-insights.model';
import { environment } from '../../../../../environments/environment';

/**
 * Sustituto de `apx-chart` con los mismos inputs. Las pruebas miran **qué datos
 * recibe** el gráfico (los huecos de las semanas vacías), no cómo ApexCharts
 * los pinta en SVG, que jsdom no sabe medir.
 */
@Component({ selector: 'apx-chart', template: '' })
class ApxChartStub {
  series = input<unknown>();
  chart = input<unknown>();
  xaxis = input<unknown>();
  yaxis = input<unknown>();
  stroke = input<unknown>();
  fill = input<unknown>();
  markers = input<unknown>();
  colors = input<unknown>();
  plotOptions = input<unknown>();
  grid = input<unknown>();
  dataLabels = input<unknown>();
  tooltip = input<unknown>();
  legend = input<unknown>();
}

class AuthStub {
  currentUser() {
    return { id: 3, role: 'sso_responsible', organizationId: 8 };
  }
  getToken() { return null; }
  get isLoggedIn() { return true; }
}

const SUMMARY_URL = `${environment.apiUrl}/v1/ai-forecasting/analytics/organizations/8/summary`;
const WORKERS = `${environment.apiUrl}/sso/workers`;

function url(from: string, to: string): string {
  return `${SUMMARY_URL}?from=${from}&to=${to}&zone=America%2FLima`;
}

const NAMES = [
  { id: 14, name: 'Carlos Rojas' },
  { id: 15, name: 'Lucía Mendoza' },
  { id: 16, name: 'Ana Quispe' },
  { id: 41, name: 'Pedro Huamán' },
];

function summary(o: Partial<AnalyticsSummary> = {}): AnalyticsSummary {
  return {
    organizationId: 8, from: '2026-10-29', to: '2026-11-25', zone: 'America/Lima', unit: 'uT*s',
    methodId: 'MAGNETIC_TIME_INDEX_V1', isProjection: false, generatedAt: '2026-11-25T15:00:00Z',
    totals: {
      closedSessions: 60, workers: 4, sessionsAboveWarning: 9, sessionsNearLimit: 2, sessionsNearLimitPct: 3.33,
      sessionsExceeded: 1, sessionsExceededPct: 1.67, incompleteCoverageSessions: 1, nearLimitRatio: 0.9,
    },
    perWorker: [
      { workerId: 14, sessions: 15, avgFinalIndex: 9728, maxFinalIndex: 12360, maxRatio: 1.03,
        sessionsAboveWarning: 7, sessionsNearLimit: 1, sessionsExceeded: 1 },
      { workerId: 15, sessions: 15, avgFinalIndex: 5200, maxFinalIndex: 10800, maxRatio: 0.9,
        sessionsAboveWarning: 2, sessionsNearLimit: 1, sessionsExceeded: 0 },
      { workerId: 16, sessions: 15, avgFinalIndex: 7000, maxFinalIndex: 8000, maxRatio: 0.67,
        sessionsAboveWarning: 0, sessionsNearLimit: 0, sessionsExceeded: 0 },
    ],
    weeklyTrend: [
      { isoWeek: '2026-W45', weekStart: '2026-11-02', sessions: 20, avgFinalIndex: 7000, maxFinalIndex: 12360,
        sessionsNearLimit: 1, sessionsExceeded: 1 },
      { isoWeek: '2026-W46', weekStart: '2026-11-09', sessions: 0, sessionsNearLimit: 0, sessionsExceeded: 0 },
      { isoWeek: '2026-W47', weekStart: '2026-11-16', sessions: 20, avgFinalIndex: 6600, maxFinalIndex: 10560,
        sessionsNearLimit: 1, sessionsExceeded: 0 },
    ],
    topPositions: [
      { positionId: 31, positionName: 'Prensa hidráulica', sessions: 15, avgFinalIndex: 9728, maxFinalIndex: 12360 },
      { positionId: 33, sessions: 15, avgFinalIndex: 3000, maxFinalIndex: 4000 },
    ],
    workersAboveWarning: [{ workerId: 14, sessionsAboveWarning: 7, lastAt: '2026-11-24T21:00:00Z' }],
    projectedCriticalWorkers: [{
      assessmentId: 'a-41', workerId: 41, sessionId: 'S-41', criticality: 'CRITICAL', currentIndex: 10900,
      projectedIndex: 21891, limitIndex: 12000, projectedRatio: 1.82425, estimatedExceedanceAt: '2026-11-25T16:47:00Z',
      recommendationType: 'RESCHEDULE_TASK', isProjection: true,
    }],
    recommendations: { rotation: 0, rescheduleTask: 6, estimatedBenefitIndex: 61234 },
    ...o,
  };
}

describe('ExposureAnalytics', () => {
  let fixture: ComponentFixture<ExposureAnalytics>;
  let component: ExposureAnalytics;
  let http: HttpTestingController;
  const period28 = lastDaysPeriod(28);

  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.trim() ?? null;
  const render = () => fixture.detectChanges();

  /** Monta la página y responde a la carga inicial (últimos 28 días). */
  function start(response: object | 'error' = { data: summary() }): void {
    fixture = TestBed.createComponent(ExposureAnalytics);
    component = fixture.componentInstance;
    render();
    http.expectOne(WORKERS).flush({ data: NAMES });
    const req = http.expectOne(url(period28.from, period28.to));
    if (response === 'error') req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    else req.flush(response);
    render();
  }

  function charts(): ApxChartStub[] {
    return fixture.debugElement.queryAll(By.directive(ApxChartStub)).map(d => d.componentInstance);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExposureAnalytics],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: new AuthStub() },
      ],
    })
      .overrideComponent(ExposureAnalytics, {
        remove: { imports: [NgApexchartsModule] },
        add: { imports: [ApxChartStub] },
      })
      .compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('filtro de periodo', () => {
    it('por defecto pide los ultimos 28 dias en America/Lima', () => {
      start();
      expect(el().querySelector<HTMLInputElement>('.period__from')!.value).toBe(period28.from);
      expect(el().querySelector<HTMLInputElement>('.period__to')!.value).toBe(period28.to);
      expect(el().querySelector('.btn--quick.is-active')!.textContent).toContain('28');
    });

    it('los botones rapidos piden 7 y 90 dias', () => {
      start();
      const [b7, , b90] = Array.from(el().querySelectorAll<HTMLButtonElement>('.btn--quick'));

      b7.click();
      const p7 = lastDaysPeriod(7);
      http.expectOne(url(p7.from, p7.to)).flush({ data: summary() });

      b90.click();
      const p90 = lastDaysPeriod(90);
      http.expectOne(url(p90.from, p90.to)).flush({ data: summary() });
      render();
      expect(el().querySelector('.btn--quick.is-active')!.textContent).toContain('90');
    });

    it('aplica fechas elegidas a mano', () => {
      start();
      component.setFrom('2026-11-01');
      component.setTo('2026-11-15');
      render();
      expect(el().querySelector('.btn--quick.is-active')).toBeNull();
      el().querySelector<HTMLButtonElement>('.btn--apply')!.click();
      http.expectOne(url('2026-11-01', '2026-11-15')).flush({ data: summary() });
    });

    // validatePeriod corre antes de llamar: no se pide un periodo que daría 400.
    it('un periodo invertido no llama al backend y lo explica', () => {
      start();
      component.setFrom('2026-11-20');
      component.setTo('2026-11-10');
      component.load();
      render();
      http.expectNone(() => true);
      expect(text('.period-error')).toBe('The start date is after the end date.');
      expect(el().querySelector('.kpis')).toBeNull();
    });

    it('un periodo de mas de 366 dias tampoco se pide', () => {
      start();
      component.setFrom('2025-01-01');
      component.setTo('2026-11-25');
      component.load();
      render();
      http.expectNone(() => true);
      expect(text('.period-error')).toBe('The period cannot exceed 366 days.');
    });
  });

  describe('indicadores', () => {
    it('muestra las tarjetas de totales', () => {
      start();
      expect(text('.kpi--sessions .kpi__value')).toBe('60');
      expect(text('.kpi--workers .kpi__value')).toBe('4');
      expect(text('.kpi--near .kpi__value')).toBe('3.33%');
      expect(text('.kpi--exceeded .kpi__value')).toBe('1.67%');
      expect(text('.kpi--coverage .kpi__value')).toBe('1');
    });

    it('avisa de la calidad de datos si hay cobertura incompleta', () => {
      start();
      expect(text('.coverage-warning')).toContain('incomplete coverage');
      expect(el().querySelector('.kpi--coverage')!.classList).toContain('kpi--warn');
    });

    it('sin cobertura incompleta no hay aviso', () => {
      const s = summary();
      start({ data: { ...s, totals: { ...s.totals, incompleteCoverageSessions: 0 } } });
      expect(el().querySelector('.coverage-warning')).toBeNull();
    });

    it('muestra el resumen de recomendaciones', () => {
      start();
      expect(text('.rec-rotation')).toBe('0');
      expect(text('.rec-reschedule')).toBe('6');
      expect(text('.rec-benefit')).toBe('61,234 µT·s');
    });
  });

  describe('graficos', () => {
    it('la tendencia semanal deja un hueco (null) en la semana sin jornadas', () => {
      start();
      const [trend] = charts();
      const series = trend.series() as { name: string; type: string; data: (number | null)[] }[];
      expect(series.map(s => s.type)).toEqual(['line', 'line', 'column']);
      expect(series[0].data).toEqual([7000, null, 6600]);   // promedio
      expect(series[1].data).toEqual([12360, null, 10560]); // máximo
      expect(series[2].data).toEqual([1, 0, 1]);            // cerca del límite
      expect((trend.xaxis() as { categories: string[] }).categories).toEqual(['Nov 2–8', 'Nov 9–15', 'Nov 16–22']);
    });

    it('en espanol rotula el eje con el rango en castellano', () => {
      TestBed.inject(LanguageService).toggle(); // en → es
      start();
      const [trend] = charts();
      expect((trend.xaxis() as { categories: string[] }).categories).toEqual(['2–8 nov', '9–15 nov', '16–22 nov']);
      const series = trend.series() as { name: string; data: (number | null)[] }[];
      expect(series.map(s => s.name)).toEqual(['Índice final promedio', 'Índice final máximo', 'Jornadas cerca del límite']);
      // El hueco de la semana vacía no depende del idioma.
      expect(series[0].data).toEqual([7000, null, 6600]);
    });

    it('el tooltip muestra el rango con año y la semana ISO', () => {
      start();
      const [trend] = charts();
      const x = (trend.tooltip() as { x: { formatter: (v: number, o: { dataPointIndex: number }) => string } }).x;
      expect(x.formatter(0, { dataPointIndex: 2 })).toBe('Nov 16–22, 2026 (week 47)');
    });

    it('recorta y marca como parcial la semana que el periodo cubre en parte', () => {
      start({ data: summary({ from: '2026-11-05', to: '2026-11-19' }) });
      const [trend] = charts();
      // W45 (2–8) empieza el 5; W47 (16–22) termina el 19.
      expect((trend.xaxis() as { categories: string[] }).categories).toEqual(['Nov 5–8', 'Nov 9–15', 'Nov 16–19']);
      const x = (trend.tooltip() as { x: { formatter: (v: number, o: { dataPointIndex: number }) => string } }).x;
      expect(x.formatter(0, { dataPointIndex: 0 })).toBe('Nov 5–8, 2026 (week 45, partial week)');
      expect(x.formatter(0, { dataPointIndex: 1 })).toBe('Nov 9–15, 2026 (week 46)');
    });

    it('el eje de jornadas usa enteros desde 0 y no deja que 1 jornada llene el grafico', () => {
      start();
      const [trend] = charts();
      const counts = (trend.yaxis() as { min?: number; max?: number; tickAmount?: number; opposite?: boolean }[])[2];
      expect(counts.opposite).toBe(true);
      expect(counts.min).toBe(0);
      expect(counts.max).toBe(5);       // el conteo más alto es 1: máx(5, 1 + 1)
      expect(counts.tickAmount).toBe(5); // una marca por unidad: 0, 1, 2, 3, 4, 5
    });

    it('las barras son angostas y semitransparentes para no tapar las lineas', () => {
      start();
      const [trend] = charts();
      expect((trend.fill() as { opacity: number[] }).opacity).toEqual([1, 1, 0.35]);
      expect((trend.plotOptions() as { bar: { columnWidth: string } }).bar.columnWidth).toBe('18%');
    });

    it('los puestos se pintan como barras horizontales con su nombre o su id', () => {
      start();
      const [, positions] = charts();
      expect((positions.plotOptions() as { bar: { horizontal: boolean } }).bar.horizontal).toBe(true);
      expect((positions.xaxis() as { categories: string[] }).categories).toEqual(['Prensa hidráulica', '#33']);
    });
  });

  describe('tabla por operario', () => {
    const order = () =>
      Array.from(el().querySelectorAll('.worker-row .worker')).map(e => e.textContent!.trim());

    it('muestra los nombres y por defecto ordena por promedio descendente', () => {
      start();
      expect(order()).toEqual(['Carlos Rojas', 'Ana Quispe', 'Lucía Mendoza']);
      expect(el().querySelector('th[aria-sort="descending"]')!.textContent).toContain('Average');
    });

    it('ordena por maximo y por jornadas sobre la advertencia', () => {
      start();
      el().querySelector<HTMLButtonElement>('.sort--max')!.click();
      render();
      expect(order()).toEqual(['Carlos Rojas', 'Lucía Mendoza', 'Ana Quispe']);

      el().querySelector<HTMLButtonElement>('.sort--warning')!.click();
      render();
      expect(order()).toEqual(['Carlos Rojas', 'Lucía Mendoza', 'Ana Quispe']);
    });

    it('un segundo clic en la misma columna invierte el orden', () => {
      start();
      el().querySelector<HTMLButtonElement>('.sort--avg')!.click();
      render();
      expect(order()).toEqual(['Lucía Mendoza', 'Ana Quispe', 'Carlos Rojas']);
      expect(el().querySelector('th[aria-sort="ascending"]')).not.toBeNull();
    });
  });

  describe('listas', () => {
    it('lista los operarios sobre la advertencia', () => {
      start();
      expect(text('.above-warning li')).toContain('Carlos Rojas');
      expect(text('.above-warning li')).toContain('7 shifts');
    });

    it('rotula los criticos proyectados como proyeccion y enlaza a operarios en riesgo', () => {
      start();
      const panel = el().querySelector('.projected')!;
      expect(panel.textContent).toContain('Projection');
      expect(panel.querySelector('.projected-row')!.textContent).toContain('Pedro Huamán');
      expect(panel.querySelector('.projected-row')!.textContent).toContain('182.43%');
      expect(panel.querySelector('a.risk-link')!.getAttribute('href')).toBe('/sso/risk-workers');
    });
  });

  describe('exportar CSV', () => {
    it('descarga el resumen con los nombres de los operarios', () => {
      start();
      const facade = TestBed.inject(ForecastingFacade);
      const download = vi.spyOn(facade, 'downloadCsv').mockImplementation(() => {});
      el().querySelector<HTMLButtonElement>('.btn--export')!.click();
      expect(download).toHaveBeenCalledTimes(1);
      const [sent, names] = download.mock.calls[0];
      expect(sent.organizationId).toBe(8);
      expect(names.get(14)).toBe('Carlos Rojas');
    });

    it('sin datos el boton esta deshabilitado', () => {
      const s = summary();
      start({ data: { ...s, totals: { ...s.totals, closedSessions: 0 } } });
      expect(el().querySelector<HTMLButtonElement>('.btn--export')!.disabled).toBe(true);
    });
  });

  describe('analisis con IA', () => {
    const INSIGHTS_URL = `${environment.apiUrl}/v1/ai-forecasting/analytics/organizations/8/insights`;
    const insightsUrl = (from: string, to: string, refresh = false) =>
      `${INSIGHTS_URL}?from=${from}&to=${to}&zone=America%2FLima${refresh ? '&refresh=true' : ''}`;

    function insights(o: Partial<PeriodInsights> = {}): PeriodInsights {
      return {
        organizationId: 8, generatedBy: 'LLM', model: 'gemini-2.5-flash', generatedAt: '2026-11-25T23:46:49Z',
        period: { from: period28.from, to: period28.to, zone: 'America/Lima' }, isAdvisory: true,
        disclaimer: 'Análisis generado por IA (Gemini). Las cifras deben ser validadas por el SSO.',
        resumen: 'Se cerraron 60 jornadas de 4 operarios; 1 superó el límite.',
        hallazgos: [
          { texto: 'Puesto con mayor índice: Prensa hidráulica.', nivel: 'INFO' },
          { texto: '1 jornada superó el límite: Carlos Rojas.', nivel: 'CRITICO' },
          { texto: 'Proyección HIGH de Lucía Mendoza.', nivel: 'ATENCION' },
        ],
        recomendaciones: [
          { accion: 'Reforzar la capacitación.', motivo: 'Cobertura incompleta.', prioridad: 'BAJA',
            operariosAfectados: [], puestosAfectados: [] },
          { accion: 'Revisar el blindaje del puesto.', motivo: 'Mayor índice promedio.', prioridad: 'MEDIA',
            operariosAfectados: [], puestosAfectados: [{ positionId: 31, positionName: 'Prensa hidráulica' }, { positionId: 7 }] },
          { accion: 'Reprogramar las tareas restantes.', motivo: 'Proyección CRITICAL.', prioridad: 'ALTA',
            operariosAfectados: [15, 999], puestosAfectados: [] },
        ],
        calidadDatos: '1 de 60 jornadas tiene cobertura incompleta.',
        ...o,
      };
    }

    function generate(response: object = { data: insights() }): void {
      el().querySelector<HTMLButtonElement>('.btn--generate')!.click();
      http.expectOne(insightsUrl(period28.from, period28.to)).flush(response);
      render();
    }

    // Cada llamada puede gastar cuota de Gemini.
    it('no se genera al entrar en la pagina', () => {
      start();
      http.expectNone(req => req.url.startsWith(INSIGHTS_URL));
      expect(el().querySelector('.insights__body')).toBeNull();
      expect(el().querySelector('.btn--generate')).not.toBeNull();
    });

    it('el boton pide por POST el mismo periodo del filtro y sin refresh', () => {
      start();
      el().querySelector<HTMLButtonElement>('.btn--generate')!.click();
      const req = http.expectOne(insightsUrl(period28.from, period28.to));
      expect(req.request.method).toBe('POST');
      expect(req.request.urlWithParams).not.toContain('refresh');
      req.flush({ data: insights() });
    });

    it('Regenerar envia refresh=true', () => {
      start();
      generate();
      el().querySelector<HTMLButtonElement>('.btn--regenerate')!.click();
      http.expectOne(insightsUrl(period28.from, period28.to, true)).flush({ data: insights() });
    });

    it('mientras carga avisa y deshabilita el boton', () => {
      start();
      el().querySelector<HTMLButtonElement>('.btn--generate')!.click();
      render();
      expect(el().querySelector('.insights__loading')!.textContent).toContain('The AI is analysing the period');
      expect(el().querySelector<HTMLButtonElement>('.btn--generate')!.disabled).toBe(true);
      http.expectOne(insightsUrl(period28.from, period28.to)).flush({ data: insights() });
    });

    it('con Gemini: etiqueta IA (Gemini), modelo, hora de Lima, resumen y disclaimer', () => {
      start();
      generate();
      expect(el().querySelector('.source')!.textContent!.trim()).toBe('AI (Gemini)');
      expect(el().querySelector('.model')!.textContent!.trim()).toBe('gemini-2.5-flash');
      // 23:46 UTC = 18:46 en Lima.
      expect(el().querySelector('.generated-at')!.textContent).toContain('Nov 25, 06:46 PM (Lima)');
      expect(el().querySelector('.insights__summary')!.textContent!.trim())
        .toBe('Se cerraron 60 jornadas de 4 operarios; 1 superó el límite.');
      expect(el().querySelector('.disclaimer')!.textContent).toContain('validadas por el SSO');
    });

    it('con reglas: etiqueta Reglas automaticas y sin modelo', () => {
      start();
      const fallback = insights({ generatedBy: 'FALLBACK' });
      delete fallback.model;
      generate({ data: fallback });
      expect(el().querySelector('.source')!.textContent!.trim()).toBe('Automatic rules');
      expect(el().querySelector('.model')).toBeNull();
    });

    it('colorea los hallazgos por nivel', () => {
      start();
      generate();
      const tones = Array.from(el().querySelectorAll('.finding')).map(f =>
        ['finding--danger', 'finding--warn', 'finding--neutral'].find(c => f.classList.contains(c)));
      expect(tones).toEqual(['finding--neutral', 'finding--danger', 'finding--warn']);
    });

    it('ordena las recomendaciones por prioridad y nombra operarios y puestos', () => {
      start();
      generate();
      const recs = Array.from(el().querySelectorAll('.ai-rec'));
      expect(recs.map(r => r.querySelector('.priority')!.textContent!.trim())).toEqual(['High', 'Medium', 'Low']);
      expect(recs[0].querySelector('.workers-affected')!.textContent).toContain('Lucía Mendoza, #999');
      expect(recs[1].querySelector('.positions-affected')!.textContent!.replace(/\s+/g, ' '))
        .toContain('Prensa hidráulica, #7');
      expect(recs[0].querySelector('.priority')!.classList).toContain('pill--danger');
    });

    it('muestra la calidad de datos como aviso solo si viene', () => {
      start();
      generate();
      expect(el().querySelector('.data-quality')!.textContent).toContain('1 de 60 jornadas');

      const clean = insights();
      delete clean.calidadDatos;
      el().querySelector<HTMLButtonElement>('.btn--regenerate')!.click();
      http.expectOne(insightsUrl(period28.from, period28.to, true)).flush({ data: clean });
      render();
      expect(el().querySelector('.data-quality')).toBeNull();
    });

    it('un error muestra el mensaje y Reintentar repite la peticion', () => {
      start();
      el().querySelector<HTMLButtonElement>('.btn--generate')!.click();
      http.expectOne(insightsUrl(period28.from, period28.to)).flush(null, { status: 500, statusText: 'Server Error' });
      render();
      expect(el().querySelector('.insights__error')!.textContent).toContain('Could not generate the analysis.');

      el().querySelector<HTMLButtonElement>('.btn--insights-retry')!.click();
      http.expectOne(insightsUrl(period28.from, period28.to)).flush({ data: insights() });
      render();
      expect(el().querySelector('.insights__error')).toBeNull();
      expect(el().querySelector('.insights__summary')).not.toBeNull();
    });

    it('un 403 dice «sin permiso» y no ofrece Reintentar', () => {
      start();
      el().querySelector<HTMLButtonElement>('.btn--generate')!.click();
      http.expectOne(insightsUrl(period28.from, period28.to))
        .flush({ success: false, message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
      render();
      expect(el().querySelector('.insights__error')!.textContent).toContain('No permission');
      expect(el().querySelector('.btn--insights-retry')).toBeNull();
    });

    it('si cambia el periodo despues de generar, lo marca como de otro periodo', () => {
      start();
      generate();
      expect(el().querySelector('.insights__stale')).toBeNull();

      el().querySelectorAll<HTMLButtonElement>('.btn--quick')[0].click(); // 7 días
      const p7 = lastDaysPeriod(7);
      http.expectOne(url(p7.from, p7.to)).flush({ data: summary({ from: p7.from, to: p7.to }) });
      render();

      expect(el().querySelector('.insights__stale')!.textContent).toContain('another period');
      expect(el().querySelector('.insights__stale')!.textContent).toContain(`${period28.from} → ${period28.to}`);
      // Se ofrece generar el del periodo nuevo, no regenerar el viejo.
      expect(el().querySelector('.btn--regenerate')).toBeNull();
      el().querySelector<HTMLButtonElement>('.btn--generate')!.click();
      http.expectOne(insightsUrl(p7.from, p7.to)).flush({
        data: insights({ period: { from: p7.from, to: p7.to, zone: 'America/Lima' } }),
      });
      render();
      expect(el().querySelector('.insights__stale')).toBeNull();
    });

    it('el CSV incluye el analisis solo si es del periodo actual', () => {
      start();
      const facade = TestBed.inject(ForecastingFacade);
      const download = vi.spyOn(facade, 'downloadCsv').mockImplementation(() => {});

      el().querySelector<HTMLButtonElement>('.btn--export')!.click();
      expect(download.mock.calls[0][2]).toBeNull();

      generate();
      el().querySelector<HTMLButtonElement>('.btn--export')!.click();
      expect(download.mock.calls[1][2]!.resumen).toContain('60 jornadas');

      el().querySelectorAll<HTMLButtonElement>('.btn--quick')[0].click();
      const p7 = lastDaysPeriod(7);
      http.expectOne(url(p7.from, p7.to)).flush({ data: summary({ from: p7.from, to: p7.to }) });
      render();
      el().querySelector<HTMLButtonElement>('.btn--export')!.click();
      expect(download.mock.calls[2][2]).toBeNull();
    });
  });

  describe('estados', () => {
    it('cargando: mientras no llega la respuesta', () => {
      fixture = TestBed.createComponent(ExposureAnalytics);
      render();
      expect(el().querySelector('.loading-state')).not.toBeNull();
      http.expectOne(WORKERS).flush({ data: [] });
      http.expectOne(url(period28.from, period28.to)).flush({ data: summary() });
    });

    it('vacio: no hay jornadas cerradas, pero los criticos proyectados siguen a la vista', () => {
      const s = summary();
      start({ data: { ...s, totals: { ...s.totals, closedSessions: 0 }, perWorker: [], weeklyTrend: [] } });
      expect(text('.empty')).toBe('No closed shifts in this period');
      expect(el().querySelector('.kpis')).toBeNull();
      expect(charts().length).toBe(0);
      // Los críticos son una foto de ahora: no dependen del periodo.
      expect(el().querySelector('.projected-row')).not.toBeNull();
    });

    it('error: lo muestra y Reintentar vuelve a pedir', () => {
      start('error');
      expect(text('[role="alert"]')).toContain('Could not load the analytics.');
      expect(el().querySelector('.empty')).toBeNull();

      el().querySelector<HTMLButtonElement>('.btn--retry')!.click();
      http.expectOne(url(period28.from, period28.to)).flush({ data: summary() });
      render();
      expect(el().querySelector('.kpis')).not.toBeNull();
    });
  });
});
