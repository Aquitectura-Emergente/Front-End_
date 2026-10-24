import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MonitoringApi } from '../infrastructure/monitoring-api';
import { DashboardStats, LatestWorkOrder, Alert, ChartData } from '../domain/dashboard.model';
import { ClientRadiationPoint } from '../domain/radiation-map.model';
import { RadiationLevel, levelByValue, colorForLevel } from '../domain/radiation-level';

/**
 * Punto de entrada del contexto radiationmonitoring para la presentación.
 *
 * Expone el dashboard, el mapa y la clasificación por nivel. La clasificación
 * se ofrece aquí (y no copiada en cada componente) para que exista un único
 * sitio donde viven los umbrales de µT en el front.
 */
@Injectable({ providedIn: 'root' })
export class MonitoringFacade {
  private api = inject(MonitoringApi);

  stats(): Observable<DashboardStats | null> {
    return this.api.stats();
  }

  latestWorkOrders(): Observable<LatestWorkOrder[]> {
    return this.api.latestWorkOrders();
  }

  alerts(): Observable<Alert[]> {
    return this.api.alerts();
  }

  chartData(): Observable<ChartData | null> {
    return this.api.chartData();
  }

  radiationByClient(): Observable<ClientRadiationPoint[]> {
    return this.api.radiationMapByClient();
  }

  /** Fallback de clasificación: solo para lecturas que lleguen sin `level`. */
  levelFor(fieldUT: number): RadiationLevel {
    return levelByValue(fieldUT);
  }

  colorFor(level: RadiationLevel): string {
    return colorForLevel(level);
  }
}
