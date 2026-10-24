import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../../../core/http/api-response';
import { TechWorkOrderApi } from '../infrastructure/tech-work-order-api';
import { HistoryItem } from '../domain/work-order.model';
import { TechWorkOrder, PatchTechWorkOrderBody } from '../domain/tech-work-order.model';
import { WorkOrderStatus, isOpen, isTerminal } from '../domain/work-order-status';

/** Punto de entrada del contexto fieldservice para el portal del técnico. */
@Injectable({ providedIn: 'root' })
export class TechWorkOrderFacade {
  private api = inject(TechWorkOrderApi);

  all(): Observable<TechWorkOrder[]> {
    return this.api.list();
  }

  byId(id: string | number): Observable<TechWorkOrder | null> {
    return this.api.byId(id);
  }

  patch(id: number | string, body: PatchTechWorkOrderBody): Observable<TechWorkOrder | null> {
    return this.api.patch(id, body);
  }

  updateStatus(id: number | string, status: WorkOrderStatus): Observable<TechWorkOrder | null> {
    return this.api.updateStatus(id, status);
  }

  history(status?: string, search?: string): Observable<HistoryItem[]> {
    return this.api.history(status, search);
  }

  historyPaged(
    status?: string, search?: string, page = 0, size = 10
  ): Observable<PageResponse<HistoryItem>> {
    return this.api.historyPaged(status, search, page, size);
  }

  isOpen(status: string): boolean {
    return isOpen(status);
  }

  isTerminal(status: string): boolean {
    return isTerminal(status);
  }
}
