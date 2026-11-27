import { isCompanyClient } from './user.model';

describe('isCompanyClient', () => {
  it('reconoce solo a los clientes de tipo empresa', () => {
    expect(isCompanyClient({ role: 'Client', clientType: 'company' })).toBe(true);
    expect(isCompanyClient({ role: 'Client', clientType: 'individual' })).toBe(false);
    expect(isCompanyClient({ role: 'Client' })).toBe(false);
    expect(isCompanyClient({ role: 'Admin', clientType: 'company' })).toBe(false);
  });
});
