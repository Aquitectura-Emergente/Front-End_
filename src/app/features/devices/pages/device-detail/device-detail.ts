import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe, LowerCasePipe } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ActivityService } from '../../../../core/services/activity.service';
import { formatDateTime, timeAgo } from '../../../../core/utils/time';
import { PageResponse, emptyPage } from '../../../../core/http/api-response';
import { DeviceFacade } from '../../../../contexts/devicemanagement/application/device-facade';
import { DeviceManagementFacade } from '../../../../contexts/devicemanagement/application/device-management-facade';
import { Device } from '../../../../contexts/devicemanagement/domain/device.model';
import {
  DeviceStatusView, LifecycleStatus, lifecycleTargets,
} from '../../../../contexts/devicemanagement/domain/device-status.model';
import {
  DeviceConfigView, INACTIVITY_S, SAMPLING_MS, validateOperationalConfig,
} from '../../../../contexts/devicemanagement/domain/device-config.model';
import { AuditEntryView } from '../../../../contexts/devicemanagement/domain/device-audit.model';
import {
  READING_ROUTINGS, ReadingRouting, TelemetryReadingView,
} from '../../../../contexts/devicemanagement/domain/telemetry-reading.model';

type Tab = 'config' | 'lifecycle' | 'audit' | 'telemetry';

const AUDIT_PAGE_SIZE = 20;

@Component({
  selector: 'app-device-detail',
  imports: [TranslatePipe, FormsModule, RouterLink, DecimalPipe, LowerCasePipe],
  templateUrl: './device-detail.html',
  styleUrl: './device-detail.scss',
})
export class DeviceDetail implements OnInit {
  private route    = inject(ActivatedRoute);
  private devices  = inject(DeviceFacade);
  private dm       = inject(DeviceManagementFacade);
  private toast    = inject(ToastService);
  private lang     = inject(LanguageService);
  private activity = inject(ActivityService);

  readonly samplingLimits = SAMPLING_MS;
  readonly inactivityLimits = INACTIVITY_S;
  readonly routings = READING_ROUTINGS;

  loading  = signal(true);
  device   = signal<Device | null>(null);
  status   = signal<DeviceStatusView | null>(null);
  config   = signal<DeviceConfigView | null>(null);
  tab      = signal<Tab>('config');

  // Configuración operativa
  formSampling: number | null = null;
  formInactivity: number | null = null;
  savingConfig = signal(false);

  // Ciclo de vida
  lifecycleTarget = signal<LifecycleStatus | null>(null);
  savingLifecycle = signal(false);

  // Auditoría y telemetría
  audit     = signal<PageResponse<AuditEntryView>>(emptyPage<AuditEntryView>(AUDIT_PAGE_SIZE));
  auditPage = signal(0);
  telemetry = signal<TelemetryReadingView[]>([]);
  routing: ReadingRouting | '' = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.devices.byId(id).subscribe(d => {
      this.device.set(d);
      if (!d?.serialNumber) {
        this.loading.set(false);
        return;
      }
      this.dm.status(d.serialNumber).subscribe(s => {
        this.status.set(s);
        this.loading.set(false);
      });
      this.loadConfig();
    });
  }

  private get serial(): string {
    return this.device()?.serialNumber ?? '';
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'audit') this.loadAudit(this.auditPage());
    if (tab === 'telemetry') this.loadTelemetry();
  }

  private loadConfig(): void {
    this.dm.config(this.serial).subscribe(c => {
      this.config.set(c);
      this.formSampling = c?.samplingIntervalMs ?? null;
      this.formInactivity = c?.inactivityTimeoutS ?? null;
    });
  }

  saveConfig(): void {
    const c = this.config();
    // Solo se envía lo que cambió; el backend deja igual lo que llega vacío.
    const payload = {
      samplingIntervalMs: this.formSampling != null && this.formSampling !== c?.samplingIntervalMs
        ? this.formSampling : undefined,
      inactivityTimeoutS: this.formInactivity != null && this.formInactivity !== c?.inactivityTimeoutS
        ? this.formInactivity : undefined,
    };
    const error = validateOperationalConfig(payload);
    if (error) {
      this.toast.error(this.lang.t(error));
      return;
    }
    this.savingConfig.set(true);
    this.dm.changeOperationalConfig(this.serial, payload).subscribe(r => {
      this.savingConfig.set(false);
      if (!r.ok) {
        this.toast.error(r.error);
        return;
      }
      this.config.set(r.data);
      this.activity.log('Device configuration updated', this.serial);
      this.toast.success(this.lang.t('dm_cfg_saved'));
    });
  }

  targets(): LifecycleStatus[] {
    return lifecycleTargets(this.status()?.lifecycleStatus ?? null);
  }

  changeLifecycle(): void {
    const target = this.lifecycleTarget();
    if (!target) return;
    this.savingLifecycle.set(true);
    this.dm.changeLifecycle(this.serial, target).subscribe(r => {
      this.savingLifecycle.set(false);
      if (!r.ok) {
        this.toast.error(r.error);
        return;
      }
      this.status.set(r.data);
      this.lifecycleTarget.set(null);
      this.activity.log('Device lifecycle changed', `${this.serial} → ${target}`);
      this.toast.success(this.lang.t('dm_lc_saved'));
    });
  }

  loadAudit(page: number): void {
    this.auditPage.set(page);
    this.dm.audit(this.serial, page, AUDIT_PAGE_SIZE).subscribe(p => this.audit.set(p));
  }

  loadTelemetry(): void {
    this.dm.telemetry(this.serial, this.routing || undefined).subscribe(r => this.telemetry.set(r));
  }

  lifecycleKey(status: LifecycleStatus | null | undefined): string {
    return status ? 'dm_lc_' + status : 'dm_unknown';
  }

  ago(iso: string | null | undefined): string {
    return timeAgo(iso);
  }

  when(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }
}
