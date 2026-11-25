import {
  PositionStats,
  WeekStats,
  positionLabel,
  validatePeriod,
  weekHasData,
} from './analytics-summary.model';

describe('validatePeriod', () => {
  it('acepta un periodo correcto', () => {
    expect(validatePeriod({ from: '2026-11-04', to: '2026-11-25' })).toBeNull();
  });

  // Los extremos que faltan los completa el backend (28 días hasta hoy).
  it('acepta el periodo vacio o con un solo extremo', () => {
    expect(validatePeriod({})).toBeNull();
    expect(validatePeriod({ to: '2026-11-25' })).toBeNull();
    expect(validatePeriod({ from: '2026-11-04' })).toBeNull();
  });

  it('acepta un periodo de un solo dia', () => {
    expect(validatePeriod({ from: '2026-11-25', to: '2026-11-25' })).toBeNull();
  });

  it('rechaza un periodo invertido', () => {
    expect(validatePeriod({ from: '2026-11-25', to: '2026-11-24' })).toBe('order');
  });

  // Mismo tope que el backend: ChronoUnit.DAYS.between + 1 > 366.
  it('admite 366 dias exactos y rechaza 367', () => {
    expect(validatePeriod({ from: '2025-11-25', to: '2026-11-25' })).toBeNull();
    expect(validatePeriod({ from: '2025-11-24', to: '2026-11-25' })).toBe('range');
  });

  it('rechaza fechas mal formadas o inexistentes', () => {
    expect(validatePeriod({ from: '25/11/2026' })).toBe('format');
    expect(validatePeriod({ to: '2026-02-31' })).toBe('format');
  });
});

describe('weekHasData', () => {
  const week = (o: Partial<WeekStats> = {}): WeekStats => ({
    isoWeek: '2026-W48',
    weekStart: '2026-11-23',
    sessions: 8,
    avgFinalIndex: 6600,
    maxFinalIndex: 10560,
    sessionsNearLimit: 0,
    sessionsExceeded: 0,
    ...o,
  });

  it('una semana con jornadas tiene datos', () => {
    expect(weekHasData(week())).toBe(true);
  });

  // El backend lista las semanas vacías sin avg/max (campos omitidos).
  it('una semana vacia no tiene datos', () => {
    expect(weekHasData(week({ sessions: 0, avgFinalIndex: undefined, maxFinalIndex: undefined }))).toBe(false);
  });
});

describe('positionLabel', () => {
  const position = (o: Partial<PositionStats> = {}): PositionStats => ({
    positionId: 31,
    positionName: 'Prensa hidráulica',
    sessions: 15,
    avgFinalIndex: 9728,
    maxFinalIndex: 12360,
    ...o,
  });

  it('usa el nombre del puesto', () => {
    expect(positionLabel(position())).toBe('Prensa hidráulica');
  });

  // Si Plant Configuration no respondió, el nombre no llega.
  it('sin nombre muestra el id', () => {
    expect(positionLabel(position({ positionName: undefined }))).toBe('#31');
    expect(positionLabel(position({ positionName: '  ' }))).toBe('#31');
  });
});
