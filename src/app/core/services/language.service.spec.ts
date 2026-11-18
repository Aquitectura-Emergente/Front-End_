import { TRANSLATIONS } from './language.service';

describe('TRANSLATIONS', () => {
  it('inglés y español tienen las mismas claves', () => {
    const en = Object.keys(TRANSLATIONS.en);
    const es = new Set(Object.keys(TRANSLATIONS.es));
    expect(en.filter(k => !es.has(k))).toEqual([]);
    expect([...es].filter(k => !(k in TRANSLATIONS.en))).toEqual([]);
  });

  it('cubre todos los tipos de auditoría de Device Management', () => {
    const types = ['REGISTERED', 'CONFIG_CHANGED', 'LINKED', 'CONNECTIVITY_CHANGED', 'LIFECYCLE_CHANGED', 'ZONE_CHANGED',
      'PLUG_COMMAND', 'PLUG_STATE', 'DEVICE_TYPE_MISMATCH', 'DEVICE_LENT'];
    for (const t of types) {
      expect(TRANSLATIONS.es['dm_audit_' + t]).toBeTruthy();
    }
  });
});
