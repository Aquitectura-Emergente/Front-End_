import {
  Assessment,
  Projection,
  byUrgency,
  consumedPercent,
  criticalityChipClass,
  criticalityLabelKey,
  criticalityRank,
  criticalityTone,
  projectedPercent,
  projectsExceedance,
  ratioToPercent,
  recommendationLabelKey,
} from './assessment.model';

function projection(o: Partial<Projection> = {}): Projection {
  return {
    currentIndex: 7200,
    limitIndex: 12000,
    accumulationRate: 0.5,
    projectedIndexAtShiftEnd: 14400,
    remainingMargin: 4800,
    consumedRatio: 0.6,
    projectedRatio: 1.2,
    estimatedExceedanceAt: '2026-11-10T14:40:00Z',
    shiftEnd: '2026-11-10T16:00:00Z',
    unit: 'uT*s',
    ...o,
  };
}

// Caso del operario 101 de la guía de Swagger del backend (docs/ai-forecasting.md).
function assessment(o: Partial<Assessment> = {}): Assessment {
  return {
    id: 'a-101',
    organizationId: 8,
    workerId: 101,
    sessionId: 'S-101',
    status: 'RECOMMENDED',
    criticality: 'HIGH',
    projection: projection(),
    modelVersion: { modelId: 'LINEAR_RATE', version: '1', code: 'LINEAR_RATE_V1' },
    assessedAt: '2026-11-10T12:00:00Z',
    isProjection: true,
    ...o,
  };
}

describe('criticidad', () => {
  it('cada nivel tiene su clave de traduccion', () => {
    expect(criticalityLabelKey('LOW')).toBe('af_criticality_low');
    expect(criticalityLabelKey('CRITICAL')).toBe('af_criticality_critical');
  });

  // Una evaluacion en PROJECTED no trae criticidad: no hay que inventarle una.
  it('sin criticidad usa una clave propia en vez de suponer LOW', () => {
    expect(criticalityLabelKey(undefined)).toBe('af_criticality_none');
    expect(criticalityTone(undefined)).toBe('neutral');
    expect(criticalityChipClass(undefined)).toBe('chip');
  });

  it('el color sube con la criticidad y CRITICAL es el unico rojo', () => {
    expect(criticalityTone('LOW')).toBe('success');
    expect(criticalityTone('MODERATE')).toBe('accent');
    expect(criticalityTone('HIGH')).toBe('warning');
    expect(criticalityTone('CRITICAL')).toBe('danger');
    expect(criticalityChipClass('CRITICAL')).toBe('chip chip--danger');
  });

  it('el rango ordena los niveles y sin nivel queda por debajo de LOW', () => {
    expect(criticalityRank('CRITICAL')).toBeGreaterThan(criticalityRank('HIGH'));
    expect(criticalityRank('HIGH')).toBeGreaterThan(criticalityRank('MODERATE'));
    expect(criticalityRank('MODERATE')).toBeGreaterThan(criticalityRank('LOW'));
    expect(criticalityRank(undefined)).toBeLessThan(criticalityRank('LOW'));
  });
});

describe('porcentajes', () => {
  it('convierte el ratio del backend en porcentaje', () => {
    expect(consumedPercent(assessment())).toBe(60);
    expect(projectedPercent(assessment())).toBe(120);
  });

  it('redondea a 2 decimales', () => {
    // 1.824250 del ejemplo de la analítica del backend.
    expect(ratioToPercent(1.82425)).toBe(182.43);
    expect(ratioToPercent(0.958333)).toBe(95.83);
  });

  // Un 0 parecería un dato real; la vista debe poder pintar «—».
  it('sin ratio devuelve null, no 0', () => {
    expect(ratioToPercent(undefined)).toBeNull();
    expect(ratioToPercent(null)).toBeNull();
    expect(ratioToPercent(Number.NaN)).toBeNull();
  });

  it('acepta un consumo por encima del 100 %', () => {
    expect(consumedPercent(assessment({ projection: projection({ consumedRatio: 1.03 }) }))).toBe(103);
  });
});

describe('projectsExceedance', () => {
  it('con fecha estimada proyecta excedencia', () => {
    expect(projectsExceedance(assessment())).toBe(true);
  });

  // El backend omite el campo (non_null) cuando no hay excedencia proyectada.
  it('sin el campo no proyecta excedencia', () => {
    const p = projection();
    delete p.estimatedExceedanceAt;
    expect(projectsExceedance(assessment({ projection: p }))).toBe(false);
  });
});

describe('recommendationLabelKey', () => {
  it('genera la clave de cada tipo', () => {
    expect(recommendationLabelKey('ROTATION')).toBe('af_recommendation_rotation');
    expect(recommendationLabelKey('RESCHEDULE_TASK')).toBe('af_recommendation_reschedule_task');
  });
});

describe('byUrgency', () => {
  const noExceedance = projection();
  delete noExceedance.estimatedExceedanceAt;

  const high = assessment({ id: 'high', criticality: 'HIGH' });
  const critical = assessment({
    id: 'critical',
    criticality: 'CRITICAL',
    projection: projection({ estimatedExceedanceAt: '2026-11-10T12:10:00Z' }),
  });
  const highSooner = assessment({
    id: 'high-sooner',
    criticality: 'HIGH',
    projection: projection({ estimatedExceedanceAt: '2026-11-10T13:00:00Z' }),
  });
  const highNoExceedance = assessment({ id: 'high-none', criticality: 'HIGH', projection: noExceedance });
  const moderate = assessment({ id: 'moderate', criticality: 'MODERATE' });

  it('ordena igual que critical-workers: criticidad y luego excedencia mas cercana', () => {
    const ids = byUrgency([moderate, highNoExceedance, high, critical, highSooner]).map(a => a.id);
    expect(ids).toEqual(['critical', 'high-sooner', 'high', 'high-none', 'moderate']);
  });

  it('no muta la lista original', () => {
    const list = [moderate, critical];
    byUrgency(list);
    expect(list.map(a => a.id)).toEqual(['moderate', 'critical']);
  });
});
