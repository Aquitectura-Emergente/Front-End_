import { ExposureLimit } from './exposure-limit.model';
import { ExposureSession } from './exposure-session.model';
import {
  canFinalize,
  commandErrorTitleKey,
  defaultsFromLastSession,
  suggestStart,
  dosimeterProblem,
  effectiveLimits,
  positionsWithLimit,
  sessionPhase,
  validateStart,
} from './session-control.model';

const NOW = Date.parse('2026-11-25T15:00:00Z');

function session(o: Partial<ExposureSession> = {}): ExposureSession {
  return {
    id: 'S-1', organizationId: 8, workerId: 14, deviceId: 30, jobPositionId: 31, state: 'CLOSING',
    methodId: 'MAGNETIC_TIME_INDEX_V1', unit: 'uT*s', accumulatedIndex: 9000, limitIndex: 12000, percentage: 75,
    warningRaised: false, limitExceeded: false, coveragePercentage: 98.5, coverageComplete: false,
    startedAt: '2026-11-25T08:00:00Z', endedAt: '2026-11-25T14:00:00Z',
    reconciliationDeadline: '2026-11-25T14:30:00Z', outOfRangeReadings: 0, ...o,
  };
}

function limit(o: Partial<ExposureLimit> = {}): ExposureLimit {
  return {
    id: 1, organizationId: 8, jobPositionId: 31, version: 1, limitIndex: 12000, warningRatio: 0.8,
    methodId: 'MAGNETIC_TIME_INDEX_V1', unit: 'uT*s', effectiveFrom: '2026-11-01T00:00:00Z', ...o,
  };
}

describe('sessionPhase', () => {
  it('CLOSING es «procesando lecturas», no cerrada', () => {
    expect(sessionPhase(session({ state: 'OPEN' }))).toBe('open');
    expect(sessionPhase(session({ state: 'CLOSING' }))).toBe('processing');
    expect(sessionPhase(session({ state: 'CLOSED' }))).toBe('closed');
  });
});

describe('canFinalize', () => {
  // Antes del plazo el backend respondería 409 con deliveryConfirmed=false.
  it('no se puede finalizar antes del plazo de reconciliacion', () => {
    expect(canFinalize(session({ reconciliationDeadline: '2026-11-25T15:30:00Z' }), NOW)).toBe(false);
  });

  it('se puede finalizar en el plazo exacto y despues', () => {
    expect(canFinalize(session({ reconciliationDeadline: '2026-11-25T15:00:00Z' }), NOW)).toBe(true);
    expect(canFinalize(session(), NOW)).toBe(true);
  });

  it('solo una jornada en CLOSING se finaliza', () => {
    expect(canFinalize(session({ state: 'OPEN' }), NOW)).toBe(false);
    expect(canFinalize(session({ state: 'CLOSED' }), NOW)).toBe(false);
  });

  it('sin plazo no se puede finalizar', () => {
    expect(canFinalize(session({ reconciliationDeadline: undefined }), NOW)).toBe(false);
  });
});

describe('limites vigentes', () => {
  // Una versión programada para mañana no sirve para abrir una jornada hoy.
  it('descarta las versiones que todavia no entraron en vigor', () => {
    const limits = [
      limit({ id: 1, jobPositionId: 31, version: 1 }),
      limit({ id: 2, jobPositionId: 31, version: 2, effectiveFrom: '2026-12-01T00:00:00Z' }),
      limit({ id: 3, jobPositionId: 32, version: 1, effectiveFrom: '2026-12-01T00:00:00Z' }),
    ];
    expect(effectiveLimits(limits, NOW).map(l => l.id)).toEqual([1]);
    expect([...positionsWithLimit(limits, NOW)]).toEqual([31]);
  });

  it('elige la version mas reciente ya vigente de cada puesto', () => {
    const limits = [limit({ id: 1, version: 1 }), limit({ id: 2, version: 2, effectiveFrom: '2026-11-20T00:00:00Z' })];
    expect(effectiveLimits(limits, NOW).map(l => l.id)).toEqual([2]);
  });
});

describe('defaultsFromLastSession', () => {
  it('prellena dosimetro y puesto con la ultima jornada', () => {
    expect(defaultsFromLastSession(session())).toEqual({ deviceId: 30, jobPositionId: 31 });
  });

  it('sin jornada previa no prellena nada', () => {
    expect(defaultsFromLastSession(undefined)).toEqual({});
    expect(defaultsFromLastSession(null)).toEqual({});
  });
});

describe('validateStart', () => {
  it('exige operario, puesto y dosimetro, en ese orden', () => {
    expect(validateStart({})).toBe('worker');
    expect(validateStart({ workerId: 14 })).toBe('position');
    expect(validateStart({ workerId: 14, jobPositionId: 31 })).toBe('device');
    expect(validateStart({ workerId: 14, jobPositionId: 31, deviceId: 30 })).toBeNull();
  });
});

describe('dosimeterProblem', () => {
  it('acepta un dosimetro personal de la organizacion', () => {
    expect(dosimeterProblem({ deviceType: 'PERSONAL_DOSIMETER', organizationId: 8 }, 8)).toBeNull();
  });

  it('rechaza otros tipos de dispositivo y otras organizaciones', () => {
    expect(dosimeterProblem({ deviceType: 'FIXED_SENSOR', organizationId: 8 }, 8)).toBe('notDosimeter');
    expect(dosimeterProblem({ deviceType: 'PERSONAL_DOSIMETER', organizationId: 9 }, 8)).toBe('otherOrganization');
    expect(dosimeterProblem({ deviceType: 'PERSONAL_DOSIMETER', organizationId: null }, 8)).toBe('otherOrganization');
  });
});

describe('commandErrorTitleKey', () => {
  it('el titulo depende del estado HTTP', () => {
    expect(commandErrorTitleKey(409)).toBe('sc_err_409');
    expect(commandErrorTitleKey(422)).toBe('sc_err_422');
    expect(commandErrorTitleKey(500)).toBe('sc_err_generic');
    expect(commandErrorTitleKey(0)).toBe('sc_err_generic');
  });
});

describe('suggestStart', () => {
  it('lo habitual manda y lo que falte sale de la ultima jornada', () => {
    expect(suggestStart({ deviceId: 44, jobPositionId: null }, { deviceId: 30, jobPositionId: 31 }))
      .toEqual({ deviceId: 44, jobPositionId: 31, deviceFrom: 'usual' });
  });

  it('sin habituales usa la ultima jornada', () => {
    expect(suggestStart(null, { deviceId: 30, jobPositionId: 31 }))
      .toEqual({ deviceId: 30, jobPositionId: 31, deviceFrom: 'lastSession' });
  });

  it('sin nada no sugiere dosimetro', () => {
    expect(suggestStart({}, {})).toEqual({ deviceId: undefined, jobPositionId: undefined, deviceFrom: undefined });
  });
});
