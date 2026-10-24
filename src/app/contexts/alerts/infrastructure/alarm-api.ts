import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse, unwrap, unwrapOrNull } from '../../../core/http/api-response';
import { AlarmItem, CreateAlarmPayload } from '../domain/alarm.model';

/** Acceso HTTP a los endpoints de alarmas. */
@Injectable({ providedIn: 'root' })
export class AlarmApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Observable<AlarmItem[]> {
    return unwrap(this.http.get<ApiResponse<AlarmItem[]>>(`${this.base}/alarms`), []);
  }

  create(payload: CreateAlarmPayload): Observable<AlarmItem | null> {
    return unwrapOrNull(this.http.post<ApiResponse<AlarmItem>>(`${this.base}/alarms`, payload));
  }

  resolve(id: number | string): Observable<AlarmItem | null> {
    return unwrapOrNull(
      this.http.patch<ApiResponse<AlarmItem>>(`${this.base}/alarms/${id}/resolve`, {})
    );
  }

  remove(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.base}/alarms/${id}`).pipe(
      catchError(() => of(undefined as void))
    );
  }
}
