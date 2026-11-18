import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SsoApi } from '../infrastructure/sso-api';
import { AuthService } from './auth.service';
import { User } from '../domain/user.model';

/**
 * Punto de entrada del portal de SSO sobre sus propios operarios.
 *
 * Aparte de `UserFacade` a propósito: esa es la administración global de
 * cuentas, restringida a ADMIN. Esto solo alcanza a los operarios de la
 * organización del token, y es la única vista de personas que el responsable
 * tiene.
 */
@Injectable({ providedIn: 'root' })
export class SsoFacade {
  private api = inject(SsoApi);
  private auth = inject(AuthService);

  workers(): Observable<User[]> {
    return this.api.workers();
  }

  worker(id: number): Observable<User | null> {
    return this.api.worker(id);
  }

  /**
   * Organización del responsable autenticado.
   *
   * La necesitan los endpoints industriales que la llevan en la ruta. Llega en
   * la respuesta del login, así que no hace falta una petición extra. Es
   * `null` para admin y técnico, que no pertenecen a ninguna empresa — y por eso
   * el backend les niega lo industrial.
   */
  organizationId(): number | null {
    return this.auth.currentUser()?.organizationId ?? null;
  }
}
