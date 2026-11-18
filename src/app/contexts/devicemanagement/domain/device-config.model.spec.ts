import { validateOperationalConfig } from './device-config.model';

describe('validateOperationalConfig', () => {
  it('acepta valores dentro de los límites del backend', () => {
    expect(validateOperationalConfig({ samplingIntervalMs: 1000, inactivityTimeoutS: 300 })).toBeNull();
    expect(validateOperationalConfig({ samplingIntervalMs: 100 })).toBeNull();
    expect(validateOperationalConfig({ inactivityTimeoutS: 86_400 })).toBeNull();
  });

  it('exige al menos un valor', () => {
    expect(validateOperationalConfig({})).toBe('dm_cfg_nothingToSave');
  });

  it('rechaza un muestreo fuera de 100 ms – 1 h', () => {
    expect(validateOperationalConfig({ samplingIntervalMs: 99 })).toBe('dm_cfg_samplingRange');
    expect(validateOperationalConfig({ samplingIntervalMs: 3_600_001 })).toBe('dm_cfg_samplingRange');
  });

  it('rechaza una inactividad fuera de 10 s – 24 h', () => {
    expect(validateOperationalConfig({ inactivityTimeoutS: 9 })).toBe('dm_cfg_inactivityRange');
    expect(validateOperationalConfig({ inactivityTimeoutS: 1.5 })).toBe('dm_cfg_inactivityRange');
  });
});
