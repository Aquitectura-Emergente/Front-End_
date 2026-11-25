import { AnalyticsSummary, WeekStats, WorkerStats } from './analytics-summary.model';
import {
  analyticsCsv,
  analyticsCsvFileName,
  csvCell,
  isEmptyHistory,
  lastDaysPeriod,
  matchingQuickPeriod,
  plantToday,
  positionBars,
  sortWorkers,
  weeklySeries,
} from './analytics-view';
import { workerNameMap } from './worker-name';

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

describe('weeklySeries', () => {
  it('una semana vacia es un hueco (null) en las lineas, no un 0', () => {
    const s = weeklySeries(summary().weeklyTrend);
    expect(s.categories).toEqual(['W47', 'W48']);
    expect(s.weekStarts).toEqual(['2026-11-16', '2026-11-23']);
    expect(s.avg).toEqual([8000, null]);
    expect(s.max).toEqual([12360, null]);
  });

  // Las barras son conteos: una semana sin jornadas tiene 0 cerca del límite.
  it('las barras de cerca del limite si cuentan 0', () => {
    expect(weeklySeries(summary().weeklyTrend).nearLimit).toEqual([2, 0]);
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

  it('el nombre del archivo identifica organizacion y periodo', () => {
    expect(analyticsCsvFileName(summary())).toBe('emsafe-exposure-analytics-8-2026-10-29_2026-11-25.csv');
  });
});
