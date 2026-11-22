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
import {
  ComplianceReport,
  ComplianceReportSummary,
  GenerateReportPayload,
} from '../domain/compliance-report.model';

/** Acceso HTTP a los reportes de cumplimiento. */
@Injectable({ providedIn: 'root' })
export class ComplianceReportApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  generate(payload: GenerateReportPayload): Observable<ComplianceReport | null> {
    return unwrapOrNull(
      this.http.post<ApiResponse<ComplianceReport>>(
        `${this.base}/v1/occupational-health/compliance-reports`,
        payload
      )
    );
  }

  /**
   * El historial de la organización, el más reciente primero. Con `workerId`
   * se acota a un operario.
   */
  list(workerId?: number): Observable<ComplianceReportSummary[]> {
    const qs = queryString({ workerId });
    return unwrap(
      this.http.get<ApiResponse<ComplianceReportSummary[]>>(
        `${this.base}/v1/occupational-health/compliance-reports${qs}`
      ),
      []
    );
  }

  getById(id: number): Observable<ComplianceReport | null> {
    return unwrapOrNull(
      this.http.get<ApiResponse<ComplianceReport>>(
        `${this.base}/v1/occupational-health/compliance-reports/${id}`
      )
    );
  }

  /**
   * Descarga el PDF.
   *
   * Devuelve un `Blob` y no el sobre `ApiResponse`: este endpoint responde
   * **bytes crudos**, así que hay que pedirlo con `responseType: 'blob'`. Con el
   * valor por defecto, Angular intentaría interpretarlo como JSON y fallaría al
   * parsear un archivo binario.
   *
   * Verificado contra el backend: 13 KB con cabecera `%PDF-`.
   */
  export(id: number, format = 'pdf'): Observable<Blob | null> {
    const qs = queryString({ format });
    return this.http
      .get(`${this.base}/v1/occupational-health/compliance-reports/${id}/export${qs}`, {
        responseType: 'blob',
      })
      .pipe(catchError(() => of(null)));
  }
}
