import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { UserApi } from '../infrastructure/user-api';
import { initialsFrom } from '../domain/initials';
import { User, CreateUserPayload, UpdateUserPayload, UserProfile } from '../domain/user.model';

/**
 * Punto de entrada del contexto iam para la capa de presentación.
 *
 * Las pantallas hablan con esta fachada, nunca con `UserApi` ni con HttpClient
 * directamente. El filtrado por rol se hace en cliente (las pantallas piden
 * todos los usuarios y filtran), que es como funcionaba el DataService original.
 */
@Injectable({ providedIn: 'root' })
export class UserFacade {
  private api = inject(UserApi);

  all(): Observable<User[]> {
    return this.api.list();
  }

  byId(id: number | string): Observable<User | null> {
    return this.api.byId(id);
  }

  create(payload: CreateUserPayload): Observable<User | null> {
    return this.api.create(payload);
  }

  update(id: number | string, payload: UpdateUserPayload): Observable<User | null> {
    return this.api.update(id, payload);
  }

  remove(id: number | string): Observable<void> {
    return this.api.remove(id);
  }

  profile(): Observable<UserProfile | null> {
    return this.api.profile();
  }

  changePassword(id: number | string, currentPassword: string, newPassword: string): Observable<boolean> {
    return this.api.changePassword(id, currentPassword, newPassword);
  }

  /** Regla de dominio: iniciales del avatar. Única copia en el front. */
  initialsOf(name: string | undefined | null): string {
    return initialsFrom(name);
  }
}
