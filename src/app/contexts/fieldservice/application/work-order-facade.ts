import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../../../core/http/api-response';
import { WorkOrderApi } from '../infrastructure/work-order-api';
import {
  WorkOrder, WorkOrderDetail, CreateWorkOrderPayload, UpdateWorkOrderPayload, HistoryItem,
} from '../domain/work-order.model';
import { TechWorkOrder } from '../domain/tech-work-order.model';

/**
 * Punto de entrada del contexto fieldservice, lado administración.
 *
 * El lado del técnico vive en `TechWorkOrderFacade`: son dos recorridos
 * distintos sobre el mismo agregado y el backend los separa en `/work-orders`
 * y `/tech/work-orders`.
 */
@Injectable({ providedIn: 'root' })
export class WorkOrderFacade {
  private api = inject(WorkOrderApi);

  paged(
    status?: string, type?: string, search?: string, page = 0, size = 10, sort?: string
  ): Observable<PageResponse<WorkOrder>> {
    return this.api.listPaged(status, type, search, page, size, sort);
  }

  byId(id: number | string): Observable<WorkOrderDetail | null> {
    return this.api.byId(id);
  }

  fullDetail(id: number | string): Observable<TechWorkOrder | null> {
    return this.api.fullDetail(id);
  }

  create(payload: CreateWorkOrderPayload): Observable<WorkOrder | null> {
    return this.api.create(payload);
  }

  update(id: number | string, payload: UpdateWorkOrderPayload): Observable<WorkOrder | null> {
    return this.api.update(id, payload);
  }

  cancel(id: number | string, reason?: string): Observable<void> {
    return this.api.remove(id, reason);
  }

  history(status?: string, search?: string): Observable<HistoryItem[]> {
    return this.api.history(status, search);
  }
}
