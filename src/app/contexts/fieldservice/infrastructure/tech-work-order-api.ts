import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse, PageResponse, unwrap, unwrapOrNull, emptyPage, queryString,
} from '../../../core/http/api-response';
import { HistoryItem } from '../domain/work-order.model';
import { TechWorkOrder, PatchTechWorkOrderBody } from '../domain/tech-work-order.model';

/** Acceso HTTP a las órdenes y el historial del técnico (`/tech/**`). */
@Injectable({ providedIn: 'root' })
export class TechWorkOrderApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Observable<TechWorkOrder[]> {
    return unwrap(
      this.http.get<ApiResponse<TechWorkOrder[]>>(`${this.base}/tech/work-orders`),
      []
    );
  }

  byId(id: string | number): Observable<TechWorkOrder | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<TechWorkOrder>>(`${this.base}/tech/work-orders/${id}`)
    );
  }

  /** PATCH del ciclo de vida: estado, sensores, acciones y evidencias. */
  patch(id: number | string, body: PatchTechWorkOrderBody): Observable<TechWorkOrder | null> {
    return unwrapOrNull(
      this.http.patch<ApiResponse<TechWorkOrder>>(`${this.base}/tech/work-orders/${id}`, body)
    );
  }

  historyPaged(
    status?: string, search?: string, page = 0, size = 10
  ): Observable<PageResponse<HistoryItem>> {
    return this.http.get<ApiResponse<PageResponse<HistoryItem>>>(
      `${this.base}/tech/history/paged${queryString({ page, size, status, search })}`
    ).pipe(
      map(r => r.data),
      catchError(() => of(emptyPage<HistoryItem>(size)))
    );
  }
}
