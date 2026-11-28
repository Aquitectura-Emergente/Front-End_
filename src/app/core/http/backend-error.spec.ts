import { describeError, translateDetail } from './backend-error';

const t = (key: string) => `«${key}»`;

describe('describeError', () => {
  it('traduce los motivos conocidos del backend', () => {
    expect(describeError(t, 'No se pudo guardar', 'Email already in use: ana@x.com'))
      .toBe('No se pudo guardar: «err_emailInUse»');
    expect(describeError(t, 'No se pudo guardar', 'SSO access to this organization is required'))
      .toBe('No se pudo guardar: «err_noDosimetryAccess»');
  });

  it('muestra tal cual un motivo desconocido, sin perderlo', () => {
    expect(describeError(t, 'No se pudo guardar', 'Something odd')).toBe('No se pudo guardar: Something odd');
  });

  it('sin motivo deja solo el título', () => {
    expect(describeError(t, 'No se pudo guardar', '')).toBe('No se pudo guardar');
    expect(describeError(t, 'No se pudo guardar', 'Request failed')).toBe('No se pudo guardar');
  });
});

describe('translateDetail', () => {
  it('devuelve solo el detalle, traducido y en mayúscula inicial', () => {
    expect(translateDetail(k => (k === 'err_noLimit' ? 'el puesto no tiene límite' : k),
      'No effective limit exists for the job position')).toBe('El puesto no tiene límite');
    expect(translateDetail(t, 'Otro motivo')).toBe('Otro motivo');
  });
});
