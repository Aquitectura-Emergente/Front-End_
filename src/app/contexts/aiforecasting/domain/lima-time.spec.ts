import { limaDateTime, limaTime } from './lima-time';

describe('hora de Lima', () => {
  // Lima es UTC-5 todo el año (sin horario de verano).
  it('convierte el instante UTC a la hora de la planta', () => {
    expect(limaTime('2026-11-10T14:40:00Z')).toBe('09:40 AM');
    expect(limaDateTime('2026-11-10T14:40:00Z')).toBe('Nov 10, 09:40 AM');
  });

  it('cambia de dia cuando en UTC ya es el siguiente', () => {
    expect(limaDateTime('2026-11-11T03:00:00Z')).toBe('Nov 10, 10:00 PM');
  });

  // El backend omite estimatedExceedanceAt cuando no hay excedencia proyectada.
  it('sin valor muestra un guion', () => {
    expect(limaTime(undefined)).toBe('—');
    expect(limaDateTime(null)).toBe('—');
  });

  it('un valor ilegible se muestra tal cual', () => {
    expect(limaTime('mañana')).toBe('mañana');
  });
});
