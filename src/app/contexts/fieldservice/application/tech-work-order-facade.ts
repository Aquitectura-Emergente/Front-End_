import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../../../core/http/api-response';
import { TechWorkOrderApi } from '../infrastructure/tech-work-order-api';
import { HistoryItem } from '../domain/work-order.model';
import { TechWorkOrder, PatchTechWorkOrderBody } from '../domain/tech-work-order.model';
import { isOpen } from '../domain/work-order-status';

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

  historyPaged(
    status?: string, search?: string, page = 0, size = 10
  ): Observable<PageResponse<HistoryItem>> {
    return this.api.historyPaged(status, search, page, size);
  }

  /** Regla de dominio: la orden sigue viva y admite acciones del técnico. */
  isOpen(status: string): boolean {
    return isOpen(status);
  }
}
