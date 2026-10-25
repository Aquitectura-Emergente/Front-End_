import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response';
import { AuthUser, LoginResponse, WebRole, isWebRole } from '../domain/auth-user.model';

export { type AuthUser } from '../domain/auth-user.model';

const STORAGE_KEY  = 'emsafe_user';
const TOKEN_KEY    = 'emsafe_token';

/**
 * Sesión del portal web: login, logout y el usuario actual como signal.
 *
 * El token y el usuario se persisten en localStorage, siempre tras la guarda
 * `isPlatformBrowser` (los restos de SSR siguen en el repo aunque el build de
 * esta rama ya sea SPA estática).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http       = inject(HttpClient);
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private base       = environment.apiUrl;

  private _user = signal<AuthUser | null>(this.loadFromStorage());
  readonly currentUser = this._user.asReadonly();

  get isLoggedIn(): boolean { return this._user() !== null; }
  get role(): WebRole | null { return this._user()?.role ?? null; }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string) {
    return this.http.post<ApiResponse<LoginResponse>>(
      `${this.base}/auth/login`,
      { email, password }
    ).pipe(
      map(res => {
        const lr = res.data;

        // El portal web es solo para admin y técnico; CLIENT entra por el móvil.
        if (!isWebRole(lr.role)) return false;

        const user: AuthUser = {
          id:           lr.userId,
          email:        lr.email,
          name:         lr.name,
          initials:     lr.initials,
          role:         lr.role,
          technicianId: lr.technicianId ?? undefined,
        };

        this._user.set(user);
        this.saveToStorage(user, lr.token);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  logout(): void {
    this._user.set(null);
    this.clearStorage();
    this.router.navigate(['/login']);
  }

  /** Update the in-memory + persisted current user (e.g. after a profile edit). */
  updateCurrentUser(partial: Partial<AuthUser>): void {
    const current = this._user();
    if (!current) return;
    const updated = { ...current, ...partial };
    this._user.set(updated);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  }

  private loadFromStorage(): AuthUser | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private saveToStorage(user: AuthUser, token: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
  }

  private clearStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}
