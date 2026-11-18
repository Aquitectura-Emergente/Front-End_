import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../../contexts/iam/application/auth.service';
import { ToastService } from '../services/toast.service';

// Espias a mano: los specs de este repo no importan utilidades de vitest.
class AuthStub {
  isLoggedIn = true;
  logouts = 0;
  getToken() { return 'un-token'; }
  logout() { this.logouts++; }
}

class ToastStub {
  messages: string[] = [];
  error(msg: string) { this.messages.push(msg); }
  success() {} info() {} warning() {}
}

let auth: AuthStub;
let toast: ToastStub;

function provoke(err: HttpErrorResponse, url = 'http://localhost:8080/api/sso/workers') {
  const req = new HttpRequest('GET', url);
  const next: HttpHandlerFn = () => throwError(() => err);
  TestBed.runInInjectionContext(() => authInterceptor(req, next))
    .subscribe({ next: () => {}, error: () => {} });
}

beforeEach(() => {
  auth = new AuthStub();
  toast = new ToastStub();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
    ],
  });
});

describe('authInterceptor: cuando cerrar sesion', () => {
  it('cierra sesion con un 401', () => {
    provoke(new HttpErrorResponse({ status: 401, error: null }));
    expect(auth.logouts).toBe(1);
  });

  // SecurityConfig usa Http403ForbiddenEntryPoint, que responde 403 SIN cuerpo
  // cuando no hay token valido. Ese es el unico 403 que significa sesion perdida.
  it('cierra sesion con un 403 sin cuerpo, que es el del entry point', () => {
    provoke(new HttpErrorResponse({ status: 403, error: null }));
    expect(auth.logouts).toBe(1);
  });

  it('trata un cuerpo vacio en blanco igual que la ausencia de cuerpo', () => {
    provoke(new HttpErrorResponse({ status: 403, error: '   ' }));
    expect(auth.logouts).toBe(1);
  });

  // Un permiso insuficiente con sesion valida llega con el JSON de ApiResponse.
  // Echar al usuario del portal por esto era el bug: /sso/limits deslogueaba y
  // arrastraba a reports, plant-config y profile, que ya salian como login.
  it('NO cierra sesion con un 403 de autorizacion, que trae ApiResponse', () => {
    provoke(new HttpErrorResponse({
      status: 403,
      error: { success: false, message: 'Access denied' },
    }));
    expect(auth.logouts).toBe(0);
    expect(toast.messages).toEqual(["You don't have permission to view this section."]);
  });

  it('no toca la sesion en un login fallido', () => {
    provoke(new HttpErrorResponse({ status: 403, error: null }),
      'http://localhost:8080/api/auth/login');
    expect(auth.logouts).toBe(0);
    expect(toast.messages).toEqual([]);
  });

  it('no hace nada si no habia sesion', () => {
    auth.isLoggedIn = false;
    provoke(new HttpErrorResponse({ status: 401, error: null }));
    expect(auth.logouts).toBe(0);
    expect(toast.messages).toEqual([]);
  });

  it('ignora los errores que no son de autenticacion', () => {
    provoke(new HttpErrorResponse({ status: 404, error: { message: 'not found' } }));
    expect(auth.logouts).toBe(0);
    expect(toast.messages).toEqual([]);
  });

  // El mapa de planta pregunta el turno de cada operario y el backend responde
  // 404 para quien no tiene ninguno. Es el caso normal, no un error de sesion.
  it('deja pasar el 404 del operario sin turno', () => {
    provoke(new HttpErrorResponse({ status: 404, error: null }),
      'http://localhost:8080/api/v1/occupational-health/workers/15/shifts/current');
    expect(auth.logouts).toBe(0);
  });
});
