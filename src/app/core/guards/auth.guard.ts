import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../contexts/iam/application/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.currentUser()?.role === 'admin') return true;
  return router.createUrlTree(['/login']);
};

export const techGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.currentUser()?.role === 'technician') return true;
  return router.createUrlTree(['/login']);
};

/**
 * Portal del responsable de SSO (segmento industrial).
 *
 * El ADMIN **no entra aquí**, y no es un olvido: el backend exige una
 * organización asignada para todo lo industrial —`PlantConfigurationAccessPolicy`
 * lo dice explícitamente, «ni siquiera siendo ADMIN»— y la cuenta de admin no
 * tiene ninguna. Dejarlo pasar solo le mostraría una pantalla con 403 en cada
 * llamada.
 */
export const ssoGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.currentUser()?.role === 'sso_responsible') return true;
  return router.createUrlTree(['/login']);
};
