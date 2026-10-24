import { AlarmItem, canResolve } from './alarm.model';

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
