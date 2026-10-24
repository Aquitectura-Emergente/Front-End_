import { initialsFrom, UNKNOWN_INITIALS } from './initials';

/**
 * Paridad con `Initials.java`. Si estos casos cambian aquí, el backend tiene
 * que cambiar con ellos (la regla está duplicada a propósito en los dos stacks).
 */
describe('initialsFrom', () => {
  it('toma la primera y la última palabra', () => {
    expect(initialsFrom('Juan Carlos Perez')).toBe('JP');
  });

  it('con dos palabras coincide con lo obvio', () => {
    expect(initialsFrom('Alex Thompson')).toBe('AT');
  });

  it('con una sola palabra devuelve las dos primeras letras', () => {
    expect(initialsFrom('Madonna')).toBe('MA');
  });

  it('con una palabra de una sola letra no se rompe', () => {
    expect(initialsFrom('X')).toBe('X');
  });

  it('ignora espacios de sobra al principio, al final y en medio', () => {
    expect(initialsFrom('  Juan   Carlos   Perez  ')).toBe('JP');
  });

  it('siempre devuelve mayúsculas', () => {
    expect(initialsFrom('juan perez')).toBe('JP');
  });

  it('degrada a un hueco cuando no hay nombre', () => {
    expect(initialsFrom(undefined)).toBe(UNKNOWN_INITIALS);
    expect(initialsFrom(null)).toBe(UNKNOWN_INITIALS);
    expect(initialsFrom('')).toBe(UNKNOWN_INITIALS);
    expect(initialsFrom('   ')).toBe(UNKNOWN_INITIALS);
  });

  it('ya no usa el algoritmo viejo de "inicial de cada palabra"', () => {
    // Antes del 2026-10-23 esto daba 'JC' y chocaba con el backend.
    expect(initialsFrom('Juan Carlos Perez')).not.toBe('JC');
  });
});
