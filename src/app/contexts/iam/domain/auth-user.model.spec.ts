import { WebRole, homeRouteFor, isWebRole } from './auth-user.model';

describe('isWebRole', () => {
  it('admite los tres roles del portal', () => {
    expect(isWebRole('admin')).toBe(true);
    expect(isWebRole('technician')).toBe(true);
    expect(isWebRole('sso_responsible')).toBe(true);
  });

  // CLIENT y WORKER entran por la app movil: el operario consulta su exposicion
  // desde el telefono, no desde el portal.
  it('rechaza los roles que entran por el movil', () => {
    expect(isWebRole('client')).toBe(false);
    expect(isWebRole('worker')).toBe(false);
  });

  it('rechaza cualquier cosa desconocida', () => {
    expect(isWebRole('')).toBe(false);
    expect(isWebRole('ADMIN')).toBe(false);
  });
});

describe('homeRouteFor', () => {
  // Esta tabla existe porque la decision estaba duplicada en tres sitios (los
  // dos ternarios del login y el del topbar) y al anadir el tercer rol uno de
  // ellos mandaba al responsable de SSO a /tech/profile, donde el techGuard lo
  // rechazaba y acababa de vuelta en el login.
  const cases: [WebRole, string][] = [
    ['admin', '/admin'],
    ['technician', '/tech'],
    ['sso_responsible', '/sso'],
  ];

  for (const [role, route] of cases) {
    it(`manda ${role} a ${route}`, () => {
      expect(homeRouteFor(role)).toBe(route);
    });
  }

  it('cubre todos los roles del portal, sin huecos', () => {
    const covered = cases.map(([role]) => role);
    const all: WebRole[] = ['admin', 'technician', 'sso_responsible'];
    expect(covered.sort()).toEqual(all.sort());
  });
});
