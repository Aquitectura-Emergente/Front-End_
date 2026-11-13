import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  queryString,
  unwrap,
  unwrapOrNull,
} from '../../../core/http/api-response';
import { JobPosition, JobPositionPayload } from '../domain/job-position.model';

/** Acceso HTTP a los puestos de trabajo. */
@Injectable({ providedIn: 'root' })
export class JobPositionApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Todos los de la organización, o los de una zona si se pasa `plantZoneId`. */
  list(plantZoneId?: number): Observable<JobPosition[]> {
    const qs = queryString({ plantZoneId });
    return unwrap(
      this.http.get<ApiResponse<JobPosition[]>>(`${this.base}/v1/plant-config/job-positions${qs}`),
      []
    );
  }

  getById(id: number): Observable<JobPosition | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<JobPosition>>(`${this.base}/v1/plant-config/job-positions/${id}`)
    );
  }

  create(payload: JobPositionPayload): Observable<JobPosition | null> {
    return unwrapOrNull(
      this.http.post<ApiResponse<JobPosition>>(
        `${this.base}/v1/plant-config/job-positions`,
        payload
      )
    );
  }

  update(id: number, payload: JobPositionPayload): Observable<JobPosition | null> {
    return unwrapOrNull(
      this.http.put<ApiResponse<JobPosition>>(
        `${this.base}/v1/plant-config/job-positions/${id}`,
        payload
      )
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/v1/plant-config/job-positions/${id}`).pipe(
      catchError(() => of(undefined as void))
    );
  }
}
