import { formatDateTime, timeAgo } from './time';

describe('timeAgo', () => {
  const now = Date.parse('2026-01-10T12:00:00Z');

  it('usa minutos, horas o días según la distancia', () => {
    expect(timeAgo('2026-01-10T11:55:00Z', now)).toBe('5 min');
    expect(timeAgo('2026-01-10T09:00:00Z', now)).toBe('3 h');
    expect(timeAgo('2026-01-07T12:00:00Z', now)).toBe('3 d');
  });

  it('muestra un guion sin fecha', () => {
    expect(timeAgo(null, now)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });
});
