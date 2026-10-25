import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, unwrap, unwrapOrNull } from '../../../core/http/api-response';
import { DashboardStats, LatestWorkOrder, Alert, ChartData } from '../domain/dashboard.model';
import { ClientRadiationPoint } from '../domain/radiation-map.model';

/** Acceso HTTP al dashboard y al mapa de radiación. */
@Injectable({ providedIn: 'root' })
export class MonitoringApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  stats(): Observable<DashboardStats | null> {
    return unwrapOrNull(this.http.get<ApiResponse<DashboardStats>>(`${this.base}/stats`));
  }

  latestWorkOrders(): Observable<LatestWorkOrder[]> {
    return unwrap(
      this.http.get<ApiResponse<LatestWorkOrder[]>>(`${this.base}/latest-work-orders`),
      []
    );
  }

  alerts(): Observable<Alert[]> {
    return unwrap(this.http.get<ApiResponse<Alert[]>>(`${this.base}/alerts`), []);
  }

  chartData(): Observable<ChartData | null> {
    return unwrapOrNull(this.http.get<ApiResponse<ChartData>>(`${this.base}/chart-data`));
  }

  radiationMapByClient(): Observable<ClientRadiationPoint[]> {
    return unwrap(
      this.http.get<ApiResponse<ClientRadiationPoint[]>>(`${this.base}/radiation-map/by-client`),
      []
    );
  }
}
