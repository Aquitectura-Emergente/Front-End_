import { AnalyticsSummary, WeekStats, WorkerStats } from './analytics-summary.model';
import {
  analyticsCsv,
  analyticsCsvFileName,
  countAxis,
  csvCell,
  fullRangeLabel,
  isEmptyHistory,
  isoWeekNumber,
  shortRangeLabel,
  weekSpan,
  lastDaysPeriod,
  matchingQuickPeriod,
  plantToday,
  positionBars,
  sortWorkers,
  weeklySeries,
} from './analytics-view';
import { workerNameMap } from './worker-name';
import { PeriodInsights } from './period-insights.model';

// 2026-11-26 02:00 UTC = 2026-11-25 21:00 en Lima.
const LATE_EVENING_LIMA = new Date('2026-11-26T02:00:00Z');

function week(o: Partial<WeekStats> = {}): WeekStats {
  return {
    isoWeek: '2026-W47', weekStart: '2026-11-16', sessions: 20,
    avgFinalIndex: 8000, maxFinalIndex: 12360, sessionsNearLimit: 2, sessionsExceeded: 1, ...o,
  };
}

function worker(o: Partial<WorkerStats> = {}): WorkerStats {
  return {
    workerId: 14, sessions: 15, avgFinalIndex: 9728, maxFinalIndex: 12360, maxRatio: 1.03,
    sessionsAboveWarning: 7, sessionsNearLimit: 1, sessionsExceeded: 1, ...o,
  };
}

function summary(o: Partial<AnalyticsSummary> = {}): AnalyticsSummary {
  return {
    organizationId: 8, from: '2026-10-29', to: '2026-11-25', zone: 'America/Lima', unit: 'uT*s',
    methodId: 'MAGNETIC_TIME_INDEX_V1', isProjection: false, generatedAt: '2026-11-25T15:00:00Z',
    totals: {
      closedSessions: 60, workers: 4, sessionsAboveWarning: 9, sessionsNearLimit: 2, sessionsNearLimitPct: 3.33,
      sessionsExceeded: 1, sessionsExceededPct: 1.67, incompleteCoverageSessions: 1, nearLimitRatio: 0.9,
    },
    perWorker: [worker()],
    weeklyTrend: [week(), week({ isoWeek: '2026-W48', weekStart: '2026-11-23', sessions: 0,
      avgFinalIndex: undefined, maxFinalIndex: undefined, sessionsNearLimit: 0, sessionsExceeded: 0 })],
    topPositions: [{ positionId: 31, positionName: 'Prensa hidráulica', sessions: 15, avgFinalIndex: 9728,
      maxFinalIndex: 12360 }, { positionId: 32, sessions: 5, avgFinalIndex: 3000, maxFinalIndex: 4000 }],
    workersAboveWarning: [],
    projectedCriticalWorkers: [],
    recommendations: { rotation: 0, rescheduleTask: 6, estimatedBenefitIndex: 61234 },
    ...o,
  };
}

describe('periodo en hora de la planta', () => {
  // A las 21:00 de Lima ya es el día siguiente en UTC: el filtro no debe saltar.
  it('hoy es el dia de Lima, no el de UTC', () => {
    expect(plantToday(LATE_EVENING_LIMA)).toBe('2026-11-25');
  });

  it('los ultimos N dias son inclusivos y terminan hoy', () => {
    expect(lastDaysPeriod(7, LATE_EVENING_LIMA)).toEqual({ from: '2026-11-19', to: '2026-11-25' });
    expect(lastDaysPeriod(28, LATE_EVENING_LIMA)).toEqual({ from: '2026-10-29', to: '2026-11-25' });
    expect(lastDaysPeriod(90, LATE_EVENING_LIMA)).toEqual({ from: '2026-08-28', to: '2026-11-25' });
  });

  it('reconoce el atajo que coincide con el periodo', () => {
    expect(matchingQuickPeriod({ from: '2026-11-19', to: '2026-11-25' }, LATE_EVENING_LIMA)).toBe(7);
    expect(matchingQuickPeriod({ from: '2026-11-01', to: '2026-11-25' }, LATE_EVENING_LIMA)).toBeNull();
  });
});

describe('isEmptyHistory', () => {
  it('sin jornadas cerradas el historico esta vacio', () => {
    expect(isEmptyHistory(summary())).toBe(false);
    expect(isEmptyHistory(summary({ totals: { ...summary().totals, closedSessions: 0 } }))).toBe(true);
  });
});

describe('rangos de semana', () => {
  it('una semana completa va de lunes a domingo', () => {
    expect(weekSpan('2026-11-16', { from: '2026-10-29', to: '2026-11-25' }))
      .toEqual({ start: '2026-11-16', end: '2026-11-22', partial: false });
  });

  // El periodo empieza un jueves y termina un miércoles: las dos puntas se recortan.
  it('recorta al tramo real las semanas que el periodo cubre en parte', () => {
    const period = { from: '2026-11-19', to: '2026-11-25' };
    expect(weekSpan('2026-11-16', period)).toEqual({ start: '2026-11-19', end: '2026-11-22', partial: true });
    expect(weekSpan('2026-11-23', period)).toEqual({ start: '2026-11-23', end: '2026-11-25', partial: true });
  });

  it('sin periodo no recorta', () => {
    expect(weekSpan('2026-11-16').partial).toBe(false);
  });

  it('etiqueta corta en ES y EN, sin año', () => {
    expect(shortRangeLabel('2026-11-16', '2026-11-22', 'es')).toBe('16–22 nov');
    expect(shortRangeLabel('2026-11-16', '2026-11-22', 'en')).toBe('Nov 16–22');
  });

  it('una semana que cruza de mes nombra los dos meses', () => {
    expect(shortRangeLabel('2026-11-30', '2026-12-06', 'es')).toBe('30 nov–6 dic');
    expect(shortRangeLabel('2026-11-30', '2026-12-06', 'en')).toBe('Nov 30–Dec 6');
  });

  it('un tramo de un solo dia no repite la fecha', () => {
    expect(shortRangeLabel('2026-11-25', '2026-11-25', 'es')).toBe('25 nov');
    expect(shortRangeLabel('2026-11-25', '2026-11-25', 'en')).toBe('Nov 25');
  });

  it('la etiqueta completa lleva el año, y los dos si la semana cruza de año', () => {
    expect(fullRangeLabel('2026-11-16', '2026-11-22', 'es')).toBe('16–22 nov 2026');
    expect(fullRangeLabel('2026-11-16', '2026-11-22', 'en')).toBe('Nov 16–22, 2026');
    expect(fullRangeLabel('2025-12-29', '2026-01-04', 'es')).toBe('29 dic 2025–4 ene 2026');
    expect(fullRangeLabel('2025-12-29', '2026-01-04', 'en')).toBe('Dec 29, 2025–Jan 4, 2026');
  });

  it('lee el numero de la semana ISO', () => {
    expect(isoWeekNumber('2026-W47')).toBe(47);
    expect(isoWeekNumber('2026-W01')).toBe(1);
    expect(isoWeekNumber('raro')).toBeNull();
  });
});

describe('weeklySeries', () => {
  const period = { from: summary().from, to: summary().to }; // 2026-10-29 → 2026-11-25

  it('rotula el eje con el tramo real de cada semana', () => {
    const s = weeklySeries(summary().weeklyTrend, { period, locale: 'es' });
    // W48 (23–29 nov) se corta en el 25, último día del periodo.
    expect(s.categories).toEqual(['16–22 nov', '23–25 nov']);
    expect(s.partial).toEqual([false, true]);
    expect(weeklySeries(summary().weeklyTrend, { period, locale: 'en' }).categories)
      .toEqual(['Nov 16–22', 'Nov 23–25']);
  });

  it('el tooltip lleva el rango con año, la semana ISO y si es parcial', () => {
    expect(weeklySeries(summary().weeklyTrend, { period, locale: 'es' }).tooltips).toEqual([
      '16–22 nov 2026 (semana 47)',
      '23–25 nov 2026 (semana 48, semana parcial)',
    ]);
    expect(weeklySeries(summary().weeklyTrend, { period, locale: 'en' }).tooltips).toEqual([
      'Nov 16–22, 2026 (week 47)',
      'Nov 23–25, 2026 (week 48, partial week)',
    ]);
  });

  it('una semana vacia es un hueco (null) en las lineas, no un 0', () => {
    const s = weeklySeries(summary().weeklyTrend, { period });
    expect(s.weekStarts).toEqual(['2026-11-16', '2026-11-23']);
    expect(s.avg).toEqual([8000, null]);
    expect(s.max).toEqual([12360, null]);
  });

  // Las barras son conteos: una semana sin jornadas tiene 0 cerca del límite.
  it('las barras de cerca del limite si cuentan 0', () => {
    expect(weeklySeries(summary().weeklyTrend).nearLimit).toEqual([2, 0]);
  });
});

describe('countAxis', () => {
  // Con una sola jornada la barra no debe llenar el alto del gráfico.
  it('empieza en 0 y llega al menos a 5', () => {
    expect(countAxis([])).toEqual({ min: 0, max: 5, tickAmount: 5 });
    expect(countAxis([0, 1, 0])).toEqual({ min: 0, max: 5, tickAmount: 5 });
    expect(countAxis([4])).toEqual({ min: 0, max: 5, tickAmount: 5 });
  });

  it('deja una unidad de aire sobre el conteo mas alto, con marcas enteras', () => {
    expect(countAxis([5])).toEqual({ min: 0, max: 6, tickAmount: 6 });
    expect(countAxis([9, 2])).toEqual({ min: 0, max: 10, tickAmount: 10 });
  });

  // Más de 10 marcas serían ilegibles: pasos de un múltiplo entero, 5 marcas.
  it('con conteos altos redondea a un multiplo de 5 con pasos enteros', () => {
    expect(countAxis([10])).toEqual({ min: 0, max: 15, tickAmount: 5 });
    expect(countAxis([23])).toEqual({ min: 0, max: 25, tickAmount: 5 });
    const { max, tickAmount } = countAxis([37]);
    expect(max % tickAmount).toBe(0);
    expect(max).toBeGreaterThan(37);
  });
});

describe('positionBars', () => {
  it('usa el nombre del puesto o su id si no se conoce', () => {
    const bars = positionBars(summary().topPositions);
    expect(bars.labels).toEqual(['Prensa hidráulica', '#32']);
    expect(bars.avg).toEqual([9728, 3000]);
  });
});

describe('sortWorkers', () => {
  const list = [
    worker({ workerId: 1, avgFinalIndex: 5000, maxFinalIndex: 9000, sessionsAboveWarning: 1 }),
    worker({ workerId: 2, avgFinalIndex: 9000, maxFinalIndex: 9500, sessionsAboveWarning: 7 }),
    worker({ workerId: 3, avgFinalIndex: 7000, maxFinalIndex: 12000, sessionsAboveWarning: 1 }),
  ];
  const ids = (l: WorkerStats[]) => l.map(w => w.workerId);

  it('ordena por promedio, maximo o jornadas sobre la advertencia', () => {
    expect(ids(sortWorkers(list, 'avgFinalIndex', 'desc'))).toEqual([2, 3, 1]);
    expect(ids(sortWorkers(list, 'maxFinalIndex', 'desc'))).toEqual([3, 2, 1]);
    expect(ids(sortWorkers(list, 'avgFinalIndex', 'asc'))).toEqual([1, 3, 2]);
  });

  it('a igualdad desempata por workerId para que el orden sea estable', () => {
    expect(ids(sortWorkers(list, 'sessionsAboveWarning', 'desc'))).toEqual([2, 1, 3]);
  });

  it('no muta la lista original', () => {
    sortWorkers(list, 'avgFinalIndex', 'desc');
    expect(ids(list)).toEqual([1, 2, 3]);
  });
});

describe('csvCell', () => {
  it('escapa comas, comillas y saltos de linea', () => {
    expect(csvCell('Prensa, hidráulica')).toBe('"Prensa, hidráulica"');
    expect(csvCell('dijo "alto"')).toBe('"dijo ""alto"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  it('un valor ausente es una celda vacia, no 0', () => {
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(null)).toBe('');
  });

  // Inyección de fórmulas: Excel ejecutaría «=HYPERLINK(...)» al abrir el archivo.
  it('neutraliza textos que Excel interpretaria como formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+51 999')).toBe("'+51 999");
    expect(csvCell('@sum')).toBe("'@sum");
  });

  it('los numeros negativos siguen siendo numeros', () => {
    expect(csvCell(-500)).toBe('-500');
  });
});

describe('analyticsCsv', () => {
  const names = workerNameMap([{ id: 14, name: 'Rojas, Carlos' }]);
  const csv = analyticsCsv(summary(), names);
  const lines = csv.split('\r\n');

  it('incluye las cuatro tablas con su cabecera', () => {
    expect(lines).toContain('totals');
    expect(lines).toContain('60,4,9,2,3.33,1,1.67,1,0.9');
    expect(lines).toContain('perWorker');
    expect(lines).toContain('14,"Rojas, Carlos",15,9728,12360,1.03,7,1,1');
    expect(lines).toContain('weeklyTrend');
    expect(lines).toContain('2026-W47,2026-11-16,20,8000,12360,2,1');
    expect(lines).toContain('topPositions');
    expect(lines).toContain('31,Prensa hidráulica,15,9728,12360');
  });

  it('deja vacios los campos que el backend omitio', () => {
    expect(lines).toContain('2026-W48,2026-11-23,0,,,0,0');
    expect(lines).toContain('32,,5,3000,4000');
  });

  it('lleva el periodo, la zona y la unidad en la cabecera', () => {
    expect(lines).toContain('from,2026-10-29');
    expect(lines).toContain('zone,America/Lima');
    expect(lines).toContain('unit,uT*s');
  });

  it('usa CRLF y termina en salto de linea', () => {
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('sin analisis con IA no agrega esa seccion', () => {
    expect(lines).not.toContain('aiInsights');
  });

  it('con analisis con IA agrega resumen, hallazgos y recomendaciones aparte', () => {
    const insights: PeriodInsights = {
      organizationId: 8, generatedBy: 'FALLBACK', generatedAt: '2026-11-25T23:46:49Z',
      period: { from: '2026-10-29', to: '2026-11-25', zone: 'America/Lima' }, isAdvisory: true,
      disclaimer: 'Análisis generado con reglas automáticas (IA no disponible).',
      resumen: 'Se cerraron 60 jornadas, 1 superó el límite.',
      hallazgos: [{ texto: '1 jornada superó el límite: Carlos Rojas.', nivel: 'CRITICO' }],
      recomendaciones: [
        { accion: 'Capacitar', motivo: 'Cobertura incompleta', prioridad: 'BAJA', operariosAfectados: [],
          puestosAfectados: [] },
        { accion: 'Reprogramar tareas', motivo: 'Proyección CRITICAL', prioridad: 'ALTA', operariosAfectados: [14, 99],
          puestosAfectados: [{ positionId: 1, positionName: 'Prensa hidráulica' }, { positionId: 7 }] },
      ],
      calidadDatos: '1 de 60 jornadas tiene cobertura incompleta.',
    };
    const withAi = analyticsCsv(summary(), names, insights).split('\r\n');
    const start = withAi.indexOf('aiInsights');
    // Va después de las tablas medidas, no mezclado con ellas.
    expect(start).toBeGreaterThan(withAi.indexOf('topPositions'));
    expect(withAi).toContain('FALLBACK,,2026-11-25T23:46:49Z,2026-10-29,2026-11-25,America/Lima,true');
    // El resumen lleva una coma: va entre comillas.
    expect(withAi).toContain('"Se cerraron 60 jornadas, 1 superó el límite."');
    expect(withAi).toContain('CRITICO,1 jornada superó el límite: Carlos Rojas.');
    // Ordenadas por prioridad, con operarios por nombre (o #id) y puestos por nombre (o #id).
    const recs = withAi.slice(withAi.indexOf('recomendaciones') + 2, withAi.indexOf('calidadDatos'));
    expect(recs[0]).toBe('ALTA,Reprogramar tareas,Proyección CRITICAL,"Rojas, Carlos; #99",Prensa hidráulica; #7');
    expect(recs[1]).toBe('BAJA,Capacitar,Cobertura incompleta,,');
    expect(withAi).toContain('1 de 60 jornadas tiene cobertura incompleta.');
    expect(withAi).toContain('Análisis generado con reglas automáticas (IA no disponible).');
  });

  it('el nombre del archivo identifica organizacion y periodo', () => {
    expect(analyticsCsvFileName(summary())).toBe('emsafe-exposure-analytics-8-2026-10-29_2026-11-25.csv');
  });
});
