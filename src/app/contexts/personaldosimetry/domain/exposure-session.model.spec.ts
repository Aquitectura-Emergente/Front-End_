import {
  ExposureSession,
  byMostRecent,
  hasGaps,
  isProvisional,
  severityLabelKey,
  severityOf,
  stateLabelKey,
} from './exposure-session.model';

function session(over: Partial<ExposureSession> = {}): ExposureSession {
  return {
    id: 'aaaa-1111',
    organizationId: 7,
    workerId: 16,
    deviceId: 3,
    jobPositionId: 1,
    limitVersionId: 2,
    state: 'OPEN',
    methodId: 'MAGNETIC_TIME_INDEX_V1',
    unit: 'uT*s',
    accumulatedIndex: 98.5,
    limitIndex: 200,
    percentage: 49.25,
    warningRaised: false,
    limitExceeded: false,
    coveragePercentage: 100,
    coverageComplete: true,
    startedAt: '2026-11-13T06:00:00Z',
    outOfRangeReadings: 0,
    ...over,
  };
}

describe('severityOf', () => {
  // Se decide con las banderas del backend y no recalculando el porcentaje: el
  // cruce del aviso depende del warningRatio del limite vigente del puesto, que
  // la sesion no trae. Recalcularlo seria un cuarto duplicado de esa regla.
  it('excedido manda sobre el aviso', () => {
    expect(severityOf(session({ warningRaised: true, limitExceeded: true }))).toBe('exceeded');
  });

  it('aviso sin exceder', () => {
    expect(severityOf(session({ warningRaised: true }))).toBe('warning');
  });

  it('sin banderas es normal', () => {
    expect(severityOf(session())).toBe('normal');
  });

  // Un porcentaje alto NO basta para marcar aviso: el umbral es del limite, no
  // del 100%. Esta es justo la tentacion que la regla evita.
  it('no deduce el aviso del porcentaje', () => {
    expect(severityOf(session({ percentage: 95 }))).toBe('normal');
  });

  it('la clave de traduccion sigue a la gravedad', () => {
    expect(severityLabelKey(session({ limitExceeded: true }))).toBe('exp_severity_exceeded');
  });
});

describe('stateLabelKey', () => {
  // CLOSING es un estado real y visible: la sesion dejo de medir pero aun espera
  // lecturas atrasadas, asi que el indice todavia puede subir.
  it('cubre los tres estados', () => {
    expect(stateLabelKey('OPEN')).toBe('exp_state_open');
    expect(stateLabelKey('CLOSING')).toBe('exp_state_closing');
    expect(stateLabelKey('CLOSED')).toBe('exp_state_closed');
  });
});

describe('hasGaps', () => {
  it('cobertura completa no tiene huecos', () => {
    expect(hasGaps(session())).toBe(false);
  });

  // Con tramos sin lecturas el acumulado esta por debajo de lo real, y decidir
  // una rotacion con eso seria decidir con datos a medias.
  it('cobertura incompleta avisa', () => {
    expect(hasGaps(session({ coverageComplete: false, coveragePercentage: 72.5 }))).toBe(true);
  });
});

describe('isProvisional', () => {
  it('sin finalizar es provisional', () => {
    expect(isProvisional(session())).toBe(true);
  });

  it('finalizada es definitiva', () => {
    expect(isProvisional(session({ finalizedAt: '2026-11-13T15:00:00Z' }))).toBe(false);
  });

  // El campo se omite cuando es nulo (default-property-inclusion=non_null), asi
  // que la comprobacion tiene que ser por verdad y nunca `=== null`.
  it('trata el campo ausente como provisional', () => {
    const s = session();
    delete (s as Partial<ExposureSession>).finalizedAt;
    expect(isProvisional(s)).toBe(true);
  });
});

describe('byMostRecent', () => {
  it('ordena de mas reciente a mas antigua', () => {
    const ordered = byMostRecent([
      session({ id: 'vieja', startedAt: '2026-11-10T06:00:00Z' }),
      session({ id: 'nueva', startedAt: '2026-11-13T06:00:00Z' }),
      session({ id: 'media', startedAt: '2026-11-12T06:00:00Z' }),
    ]);
    expect(ordered.map(s => s.id)).toEqual(['nueva', 'media', 'vieja']);
  });

  it('no muta la lista recibida', () => {
    const list = [
      session({ id: 'a', startedAt: '2026-11-10T06:00:00Z' }),
      session({ id: 'b', startedAt: '2026-11-13T06:00:00Z' }),
    ];
    byMostRecent(list);
    expect(list.map(s => s.id)).toEqual(['a', 'b']);
  });
});
