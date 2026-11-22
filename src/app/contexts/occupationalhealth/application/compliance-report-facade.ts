import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ComplianceReportApi } from '../infrastructure/compliance-report-api';
import {
  ComplianceReport,
  ComplianceReportSummary,
  GenerateReportPayload,
  ReportRequestError,
  TraceabilityWarning,
  exportFileName,
  isAuditReady,
  traceabilityWarning,
  validateReportRequest,
} from '../domain/compliance-report.model';

/**
 * Punto de entrada de los reportes de cumplimiento.
 *
 * El historial sale del servidor (`list()`), acotado a la organización del
 * token. Antes se guardaban los últimos ids en `localStorage` porque el backend
 * no exponía la colección; ese apaño se retiró al añadir el listado y con él la
 * limitación de que el historial solo existiera en un navegador.
 */
@Injectable({ providedIn: 'root' })
export class ComplianceReportFacade {
  private api = inject(ComplianceReportApi);
  private platformId = inject(PLATFORM_ID);

  generate(payload: GenerateReportPayload): Observable<ComplianceReport | null> {
    return this.api.generate(payload);
  }

  /** El historial de la organización, el más reciente primero. */
  list(workerId?: number): Observable<ComplianceReportSummary[]> {
    return this.api.list(workerId);
  }

  getById(id: number): Observable<ComplianceReport | null> {
    return this.api.getById(id);
  }

  /** Dispara la descarga del PDF con un nombre de archivo legible. */
  download(report: ComplianceReport): Observable<Blob | null> {
    return this.api.export(report.id).pipe(
      tap(blob => { if (blob) this.saveAs(blob, exportFileName(report)); })
    );
  }

  // ── Reglas que consulta la vista ─────────────────────────────────────────

  validate(payload: GenerateReportPayload): ReportRequestError {
    return validateReportRequest(payload);
  }

  traceabilityWarning(report: ComplianceReport): TraceabilityWarning {
    return traceabilityWarning(report);
  }

  isAuditReady(report: ComplianceReport): boolean {
    return isAuditReady(report);
  }

  /**
   * Guarda el blob como archivo.
   *
   * Tras `isPlatformBrowser` porque toca `document` y `URL`, igual que hacen
   * Leaflet y `localStorage` en este repo: los archivos de SSR siguen presentes
   * aunque el build ya sea SPA estática.
   */
  private saveAs(blob: Blob, filename: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    // Liberar el objeto: si no, el blob se queda en memoria hasta recargar.
    URL.revokeObjectURL(url);
  }
}
