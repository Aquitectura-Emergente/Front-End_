import { isCompanyClient, isManagedByPanel } from './user.model';

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

describe('isCompanyClient', () => {
  it('reconoce solo a los clientes de tipo empresa', () => {
    expect(isCompanyClient({ role: 'Client', clientType: 'company' })).toBe(true);
    expect(isCompanyClient({ role: 'Client', clientType: 'individual' })).toBe(false);
    expect(isCompanyClient({ role: 'Client' })).toBe(false);
    expect(isCompanyClient({ role: 'Admin', clientType: 'company' })).toBe(false);
  });
});
