import { displayUnit } from './unit.pipe';

describe('displayUnit', () => {
  it('escribe micro y el producto como se leen', () => {
    expect(displayUnit('uT*s')).toBe('µT·s');
    expect(displayUnit('uT')).toBe('µT');
    expect(displayUnit('uT*s/s')).toBe('µT·s/s');
  });

  it('deja igual lo que no reconoce y no falla sin unidad', () => {
    expect(displayUnit('%')).toBe('%');
    expect(displayUnit(null)).toBe('');
  });
});
