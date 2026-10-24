import {
  levelByValue, colorForLevel,
  CAUTION_THRESHOLD_UT, DANGER_THRESHOLD_UT,
} from './radiation-level';

/**
 * Umbrales ICNIRP 50 Hz en microtesla. Duplicados en el edge (Python) y en el
 * backend (Java); estos tests fijan el contrato del lado del front.
 */
describe('levelByValue', () => {
  it('clasifica por debajo del umbral de precaución como seguro', () => {
    expect(levelByValue(0)).toBe('safe');
    expect(levelByValue(50)).toBe('safe');
    expect(levelByValue(99.9)).toBe('safe');
  });

  it('el umbral de precaución es inclusivo', () => {
    expect(levelByValue(CAUTION_THRESHOLD_UT)).toBe('caution');
    expect(levelByValue(100)).toBe('caution');
  });

  it('clasifica entre ambos umbrales como precaución', () => {
    expect(levelByValue(150)).toBe('caution');
    expect(levelByValue(199.9)).toBe('caution');
  });

  it('el umbral de peligro es inclusivo', () => {
    expect(levelByValue(DANGER_THRESHOLD_UT)).toBe('danger');
    expect(levelByValue(200)).toBe('danger');
  });

  it('clasifica por encima del umbral de peligro como peligro', () => {
    expect(levelByValue(275)).toBe('danger');
    expect(levelByValue(10000)).toBe('danger');
  });

  it('mantiene los umbrales acordados con el edge y el backend', () => {
    expect(CAUTION_THRESHOLD_UT).toBe(100);
    expect(DANGER_THRESHOLD_UT).toBe(200);
  });
});

describe('colorForLevel', () => {
  it('da un color distinto por nivel', () => {
    expect(colorForLevel('safe')).toBe('#16a34a');
    expect(colorForLevel('caution')).toBe('#d97706');
    expect(colorForLevel('danger')).toBe('#dc2626');
  });
});
