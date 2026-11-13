import { isManagedByPanel } from './user.model';

describe('isManagedByPanel', () => {
  it('deja fuera a los operarios', () => {
    expect(isManagedByPanel({ role: 'Worker' })).toBe(false);
  });

  it('incluye al responsable de SSO y a los roles de siempre', () => {
    for (const role of ['Admin', 'Technician', 'Client', 'SsoResponsible'] as const) {
      expect(isManagedByPanel({ role })).toBe(true);
    }
  });
});
