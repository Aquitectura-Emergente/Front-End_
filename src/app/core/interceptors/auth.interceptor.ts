import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../contexts/iam/application/auth.service';
import { ToastService } from '../services/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const token = auth.getToken();

  // `ngrok-skip-browser-warning` evita la página intermedia que ngrok (plan
  // gratis) inyecta ante peticiones de navegador: sin este header, la API
  // detrás del túnel devolvería HTML de aviso en vez del JSON esperado.
  const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const authReq = req.clone({ setHeaders: headers });

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Skip the auth endpoints so a bad login/refresh doesn't trigger a bounce.
      const isAuthCall = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
      if (auth.isLoggedIn && !isAuthCall) {
        // Un 401 siempre es sesión perdida. El 403 es ambiguo y hay que mirar el
        // cuerpo: `SecurityConfig` responde con `Http403ForbiddenEntryPoint`, que
        // devuelve 403 **sin cuerpo** cuando no hay token válido, mientras que un
        // permiso insuficiente con sesión válida llega con el JSON de `ApiResponse`.
        // Tratarlos igual echaba al usuario del portal entero por un 403 de alcance
        // —dosimetría exige su propio membership, `device-management` exige ser de la
        // organización dueña—, y además se llevaba por delante las pantallas
        // siguientes: el /sso/limits deslogueaba y reports, plant-config y profile
        // ya salían como login.
        if (err.status === 401 || (err.status === 403 && !hasBody(err))) {
          toast.error('Your session has expired. Please sign in again.');
          auth.logout();
        } else if (err.status === 403) {
          toast.error("You don't have permission to view this section.");
        }
      }
      return throwError(() => err);
    }),
  );
};

/** Un 403 del entry point llega vacío; uno de autorización trae `ApiResponse`. */
function hasBody(err: HttpErrorResponse): boolean {
  const body = err.error;
  if (!body) return false;
  if (typeof body === 'string') return body.trim().length > 0;
  if (body instanceof Blob) return body.size > 0;
  if (typeof body === 'object') return Object.keys(body).length > 0;
  return true;
}
