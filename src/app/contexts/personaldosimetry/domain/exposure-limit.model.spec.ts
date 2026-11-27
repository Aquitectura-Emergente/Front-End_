import {
  ConfigureLimitPayload,
  ExposureLimit,
  currentByPosition,
  limitReference,
  localDateTimeInput,
  validateLimit,
  warningThreshold,
} from './exposure-limit.model';

function payload(o: Partial<ConfigureLimitPayload> = {}): ConfigureLimitPayload {
  return {
    jobPositionId: 1,
    limitIndex: 12000,
    warningRatio: 0.8,
    effectiveFrom: '2026-11-13T00:00:00Z',
    reference: 'ICNIRP 2010',
    ...o,
  };
}

function limit(o: Partial<ExposureLimit> = {}): ExposureLimit {
  return {
    id: 1,
    organizationId: 1,
    jobPositionId: 1,
    version: 1,
    limitIndex: 12000,
    warningRatio: 0.8,
    methodId: 'MAGNETIC_TIME_INDEX_V1',
    unit: 'uT*s',
    effectiveFrom: '2026-11-01T00:00:00Z',
    ...o,
  };
}

describe('validateLimit', () => {
  it('acepta un limite correcto', () => {
    expect(validateLimit(payload())).toBeNull();
  });

  it('exige un puesto', () => {
    expect(validateLimit(payload({ jobPositionId: 0 }))).toBe('jobPosition');
  });

  it('exige limitIndex mayor que cero', () => {
    expect(validateLimit(payload({ limitIndex: 0 }))).toBe('limitIndex');
    expect(validateLimit(payload({ limitIndex: -1 }))).toBe('limitIndex');
  });

  // Los dos extremos van excluidos en el backend (@DecimalMin/@DecimalMax con
  // inclusive=false). Con 1 el aviso saltaria en el mismo instante en que ya se
  // ha superado el limite, o sea no avisaria; con 0 avisaria siempre.
  it('excluye los dos extremos de warningRatio', () => {
    expect(validateLimit(payload({ warningRatio: 0 }))).toBe('warningRatio');
    expect(validateLimit(payload({ warningRatio: 1 }))).toBe('warningRatio');
    expect(validateLimit(payload({ warningRatio: 0.0001 }))).toBeNull();
    expect(validateLimit(payload({ warningRatio: 0.9999 }))).toBeNull();
  });
});

describe('warningThreshold', () => {
  it('es el limite por la proporcion de aviso', () => {
    expect(warningThreshold(limit())).toBe(9600);
  });
});

describe('currentByPosition', () => {
  it('con una sola version la devuelve tal cual', () => {
    expect(currentByPosition([limit()]).map(l => l.id)).toEqual([1]);
  });

  it('se queda con la vigencia mas reciente de cada puesto', () => {
    const viejo = limit({ id: 1, version: 1, effectiveFrom: '2026-11-01T00:00:00Z' });
    const nuevo = limit({ id: 2, version: 2, effectiveFrom: '2026-12-01T00:00:00Z' });
    expect(currentByPosition([viejo, nuevo]).map(l => l.id)).toEqual([2]);
  });

  // Mismo criterio que usa dosimetria al abrir una jornada: a igualdad de
  // fecha, gana el numero de version mas alto.
  it('a igual fecha gana la version mas alta', () => {
    const v1 = limit({ id: 1, version: 1 });
    const v3 = limit({ id: 3, version: 3 });
    expect(currentByPosition([v3, v1]).map(l => l.id)).toEqual([3]);
  });

  it('no mezcla puestos distintos', () => {
    const p1 = limit({ id: 1, jobPositionId: 1 });
    const p2 = limit({ id: 2, jobPositionId: 2 });
    const current = currentByPosition([p1, p2]);
    expect(current).toHaveLength(2);
    expect(current.map(l => l.jobPositionId).sort()).toEqual([1, 2]);
  });
});

describe('referencia del limite', () => {
  it('es obligatoria y de hasta 250 caracteres, como pide el backend', () => {
    expect(validateLimit(payload({ reference: '  ' }))).toBe('reference');
    expect(validateLimit(payload({ reference: 'x'.repeat(251) }))).toBe('reference');
    expect(validateLimit(payload({ reference: 'x'.repeat(250) }))).toBeNull();
  });
});

describe('localDateTimeInput', () => {
  it('da la hora local, no la UTC, para que el limite entre en vigor ahora', () => {
    const now = new Date();
    const back = new Date(localDateTimeInput(now));
    expect(Math.abs(back.getTime() - now.getTime())).toBeLessThan(60_000);
  });
});

describe('limitReference', () => {
  it('es opcional: sin elegir nada se guarda «No especificada»', () => {
    expect(limitReference('', '')).toBe('No especificada');
    expect(limitReference('other', '   ')).toBe('No especificada');
  });

  it('usa la elegida de la lista o la escrita en «Otra»', () => {
    expect(limitReference('ICNIRP 2010', '')).toBe('ICNIRP 2010');
    expect(limitReference('other', ' RM 123-2025-MINSA ')).toBe('RM 123-2025-MINSA');
  });
});
