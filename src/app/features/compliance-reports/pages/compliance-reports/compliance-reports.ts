import { UnitPipe } from '../../../../core/pipes/unit.pipe';
import { DecimalPipe } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { DateTimePipe } from '../../../../core/pipes/datetime.pipe';
import { ComplianceReportFacade } from '../../../../contexts/occupationalhealth/application/compliance-report-facade';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import {
  ComplianceReport,
  ComplianceReportSummary,
  ReportScope,
} from '../../../../contexts/occupationalhealth/domain/compliance-report.model';
import { User } from '../../../../contexts/iam/domain/user.model';
import { ToastService } from '../../../../core/services/toast.service';
import { ActivityService } from '../../../../core/services/activity.service';
import { LanguageService } from '../../../../core/services/language.service';

/**
 * Reportes de cumplimiento exportables (RF31).
 *
 * Lo que importa de un reporte no es la cifra, sino **si se sostiene en una
 * auditoría**: por eso la pantalla destaca la trazabilidad y el digest antes que
 * los números. Un reporte con entradas sin origen no se puede defender, y
 * decirlo es más útil que mostrarlo como si fuera válido.
 *
 * El historial viene del servidor y está acotado a la organización del token,
 * así que se ve igual desde cualquier equipo. Las filas son resúmenes: los
 * avisos de trazabilidad solo se pueden pintar al abrir un reporte.
 */
@Component({
  selector: 'app-compliance-reports',
  imports: [UnitPipe, TranslatePipe, DateTimePipe, FormsModule, DecimalPipe],
  templateUrl: './compliance-reports.html',
  styleUrl: './compliance-reports.scss',
})
export class ComplianceReports implements OnInit {
  private facade = inject(ComplianceReportFacade);
  private sso = inject(SsoFacade);
  private toast = inject(ToastService);
  private activity = inject(ActivityService);
  protected lang = inject(LanguageService);

  workers = signal<User[]>([]);
  report = signal<ComplianceReport | null>(null);
  history = signal<ComplianceReportSummary[]>([]);
  busy = signal(false);

  formScope: ReportScope = 'WORKER';
  formWorkerId = '';
  formFrom = '';
  formTo = '';

  ngOnInit(): void {
    this.sso.workers().subscribe(workers => {
      this.workers.set(workers);
      if (!this.formWorkerId) this.formWorkerId = String(workers[0]?.id ?? '');
    });
    this.loadHistory();

    // Por defecto, la última semana: es el periodo que se consulta siempre.
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    this.formTo = today.toISOString().slice(0, 10);
    this.formFrom = weekAgo.toISOString().slice(0, 10);
  }

  generate(): void {
    const payload = {
      scope: this.formScope,
      workerId: this.formScope === 'WORKER' ? Number(this.formWorkerId) || undefined : undefined,
      from: this.formFrom,
      to: this.formTo,
    };

    const error = this.facade.validate(payload);
    if (error) {
      this.toast.error(this.lang.t(`rep_invalid_${error}`));
      return;
    }

    this.busy.set(true);
    this.facade.generate(payload).subscribe(report => {
      this.busy.set(false);
      if (!report) {
        this.toast.error(this.lang.t('rep_failed'));
        return;
      }
      this.report.set(report);
      this.loadHistory();
      this.activity.log('Compliance report generated', `#${report.id}`);
      this.toast.success(this.lang.t('rep_generated'));
    });
  }

  private loadHistory(): void {
    this.facade.list().subscribe(reports => this.history.set(reports));
  }

  open(id: number): void {
    this.busy.set(true);
    this.facade.getById(id).subscribe(report => {
      this.busy.set(false);
      if (!report) {
        this.toast.error(this.lang.t('rep_notFound'));
        return;
      }
      this.report.set(report);
    });
  }

  download(): void {
    const report = this.report();
    if (!report) return;
    this.busy.set(true);
    this.facade.download(report).subscribe(blob => {
      this.busy.set(false);
      if (!blob) this.toast.error(this.lang.t('rep_exportFailed'));
    });
  }

  /** Clave del aviso de trazabilidad, o null si el reporte se puede auditar. */
  warningKey(): string | null {
    const report = this.report();
    if (!report) return null;
    switch (this.facade.traceabilityWarning(report)) {
      case 'untraceable': return 'rep_warn_untraceable';
      case 'unverified': return 'rep_warn_unverified';
      default: return null;
    }
  }

  isAuditReady(): boolean {
    const report = this.report();
    return report ? this.facade.isAuditReady(report) : false;
  }

  workerName(id: number | null | undefined): string {
    if (!id) return '—';
    return this.workers().find(w => w.id === id)?.name ?? `#${id}`;
  }


  /** Primeros 8 caracteres del id de la jornada (el completo queda en el título). */
  shortRef(id: string | null | undefined): string {
    if (!id) return '—';
    return id.length > 12 && id.charAt(8) === '-' ? id.slice(0, 8) : id;
  }
}
