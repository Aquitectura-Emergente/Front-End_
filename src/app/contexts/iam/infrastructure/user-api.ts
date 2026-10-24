import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse, unwrap, unwrapOrNull, queryString } from '../../../core/http/api-response';
import { User, CreateUserPayload, UpdateUserPayload, UserProfile } from '../domain/user.model';

/** Acceso HTTP a los endpoints de usuarios del contexto iam. */
@Injectable({ providedIn: 'root' })
export class UserApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(role?: string): Observable<User[]> {
    return unwrap(
      this.http.get<ApiResponse<User[]>>(`${this.base}/users${queryString({ role })}`),
      []
    );
  }

  byId(id: number | string): Observable<User | null> {
    return unwrapOrNull(this.http.get<ApiResponse<User>>(`${this.base}/users/${id}`));
  }

  create(payload: CreateUserPayload): Observable<User | null> {
    return unwrapOrNull(this.http.post<ApiResponse<User>>(`${this.base}/users`, payload));
  }

  update(id: number | string, payload: UpdateUserPayload): Observable<User | null> {
    return unwrapOrNull(this.http.put<ApiResponse<User>>(`${this.base}/users/${id}`, payload));
  }

  remove(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${id}`).pipe(
      catchError(() => of(undefined as void))
    );
  }

  profile(): Observable<UserProfile | null> {
    return unwrapOrNull(this.http.get<ApiResponse<UserProfile>>(`${this.base}/users/profile`));
  }

  changePassword(id: number | string, currentPassword: string, newPassword: string): Observable<boolean> {
    return this.http.patch<void>(`${this.base}/users/${id}/password`, { currentPassword, newPassword }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}
