import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse, PageResponse, unwrap, unwrapOrNull, emptyPage, queryString,
} from '../../../core/http/api-response';
import {
  WorkOrder, WorkOrderDetail, CreateWorkOrderPayload, UpdateWorkOrderPayload, HistoryItem,
} from '../domain/work-order.model';
import { TechWorkOrder } from '../domain/tech-work-order.model';

/** Acceso HTTP a las órdenes de trabajo y al historial, lado administración. */
@Injectable({ providedIn: 'root' })
export class WorkOrderApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(status?: string, type?: string, search?: string): Observable<WorkOrder[]> {
    return unwrap(
      this.http.get<ApiResponse<WorkOrder[]>>(
        `${this.base}/work-orders${queryString({ status, type, search })}`
      ),
      []
    );
  }

  listPaged(
    status?: string, type?: string, search?: string, page = 0, size = 10, sort?: string
  ): Observable<PageResponse<WorkOrder>> {
    return this.http.get<ApiResponse<PageResponse<WorkOrder>>>(
      `${this.base}/work-orders/paged${queryString({ page, size, status, type, search, sort })}`
    ).pipe(
      map(r => r.data),
      catchError(() => of(emptyPage<WorkOrder>(size)))
    );
  }

  byId(id: number | string): Observable<WorkOrderDetail | null> {
    return unwrapOrNull(this.http.get<ApiResponse<WorkOrderDetail>>(`${this.base}/work-orders/${id}`));
  }

  /** Detalle completo de solo lectura (admin), usado por la vista de historial. */
  fullDetail(id: number | string): Observable<TechWorkOrder | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<TechWorkOrder>>(`${this.base}/work-orders/${id}/detail`)
    );
  }

  create(payload: CreateWorkOrderPayload): Observable<WorkOrder | null> {
    return unwrapOrNull(this.http.post<ApiResponse<WorkOrder>>(`${this.base}/work-orders`, payload));
  }

  update(id: number | string, payload: UpdateWorkOrderPayload): Observable<WorkOrder | null> {
    return unwrapOrNull(
      this.http.put<ApiResponse<WorkOrder>>(`${this.base}/work-orders/${id}`, payload)
    );
  }

  remove(id: number | string, reason?: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/work-orders/${id}${queryString({ reason })}`
    ).pipe(
      catchError(() => of(undefined as void))
    );
  }

  history(status?: string, search?: string): Observable<HistoryItem[]> {
    return unwrap(
      this.http.get<ApiResponse<HistoryItem[]>>(`${this.base}/history${queryString({ status, search })}`),
      []
    );
  }

  historyPaged(
    status?: string, search?: string, page = 0, size = 10
  ): Observable<PageResponse<HistoryItem>> {
    return this.http.get<ApiResponse<PageResponse<HistoryItem>>>(
      `${this.base}/history/paged${queryString({ page, size, status, search })}`
    ).pipe(
      map(r => r.data),
      catchError(() => of(emptyPage<HistoryItem>(size)))
    );
  }
}
