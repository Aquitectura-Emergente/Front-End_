import { AlarmItem, canEscalate, canResolve, upsertAlarm, workerAlertStatus } from './alarm.model';

function alarm(overrides: Partial<AlarmItem> = {}): AlarmItem {
  return {
    id: 1,
    type: 'danger',
    icon: 'ph-warning-circle',
    title: 'Campo por encima del umbral',
    description: '',
    time: '2026-10-23 10:00',
    resolved: false,
    resolvedAt: null,
    ...overrides,
  };
}

describe('canResolve', () => {
  it('permite resolver una alarma abierta', () => {
    expect(canResolve(alarm())).toBe(true);
  });

  it('no permite resolver una alarma ya resuelta', () => {
    expect(canResolve(alarm({ resolved: true, resolvedAt: '2026-10-23 11:00' }))).toBe(false);
  });
});

describe('workerAlertStatus', () => {
  it('una alerta sin marcas está pendiente de acuse', () => {
    expect(workerAlertStatus(alarm({ workerId: 7 }))).toBe('pending');
  });

  it('el escalamiento pesa más que el acuse', () => {
    expect(workerAlertStatus(alarm({ workerId: 7, acknowledgedAt: 'a', escalatedAt: 'b' }))).toBe('escalated');
    expect(workerAlertStatus(alarm({ workerId: 7, acknowledgedAt: 'a' }))).toBe('acknowledged');
  });

  it('resuelta es el estado final', () => {
    expect(workerAlertStatus(alarm({ workerId: 7, escalatedAt: 'b', resolved: true }))).toBe('resolved');
  });
});

describe('canEscalate', () => {
  it('se puede escalar una alerta de operario abierta, aunque no esté acusada (regla 10)', () => {
    expect(canEscalate(alarm({ workerId: 7 }))).toBe(true);
  });

  it('no se escala una alarma de cliente, una ya escalada ni una resuelta', () => {
    expect(canEscalate(alarm())).toBe(false);
    expect(canEscalate(alarm({ workerId: 7, escalatedAt: 'b' }))).toBe(false);
    expect(canEscalate(alarm({ workerId: 7, resolved: true }))).toBe(false);
  });
});

describe('upsertAlarm', () => {
  it('agrega la nueva arriba y reemplaza la que ya estaba', () => {
    const list = [alarm({ id: 2 }), alarm({ id: 1 })];
    expect(upsertAlarm(list, alarm({ id: 3 })).map(a => a.id)).toEqual([3, 2, 1]);
    const updated = upsertAlarm(list, alarm({ id: 1, acknowledgedAt: 'a' }));
    expect(updated.map(a => a.id)).toEqual([2, 1]);
    expect(updated[1].acknowledgedAt).toBe('a');
  });
});
