import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { DosimeterOption } from '../../../../contexts/devicemanagement/domain/device-status.model';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { DateTimePipe } from '../../../../core/pipes/datetime.pipe';
import { AlarmFacade } from '../../../../contexts/alerts/application/alarm-facade';
import {
  AlarmItem,
  WorkerAlertStatus,
  upsertAlarm,
  workerAlertStatus,
} from '../../../../contexts/alerts/domain/alarm.model';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import { AuthService } from '../../../../contexts/iam/application/auth.service';
import { User } from '../../../../contexts/iam/domain/user.model';
import { DeviceManagementFacade } from '../../../../contexts/devicemanagement/application/device-management-facade';
import {
  DeviceConfigView,
  validateAlertThreshold,
} from '../../../../contexts/devicemanagement/domain/device-config.model';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';

/**
 * Alertas de exposición de los operarios de la planta (RF22, RF23).
 *
 * Desde el 2026-11-22 el backend crea solo estas alertas cuando Personal
 * Dosimetry confirma una excedencia (danger) o un aviso preventivo (warning), y
 * escala al SSO las de excedencia que el operario no acusa en 60 s. Esta página
 * las lista, las recibe en vivo por STOMP y deja escalar a mano antes de que
 * venza la ventana.
 *
 * Abajo está el umbral de alerta del dosímetro, que define el SSO
 * (`PUT /devices/{serial}/config/alert-threshold`): el backend lo empuja al
 * Edge industrial por MQTT (`iot/{id}/config`).
 */
@Component({
  selector: 'app-sso-alerts',
  imports: [TranslatePipe, DateTimePipe, FormsModule],
  templateUrl: './sso-alerts.html',
  styleUrl: './sso-alerts.scss',
})
export class SsoAlerts implements OnInit, OnDestroy {
  private alarms = inject(AlarmFacade);
  private sso = inject(SsoFacade);
  private auth = inject(AuthService);
  private devices = inject(DeviceManagementFacade);
  private toast = inject(ToastService);
  protected lang = inject(LanguageService);

  alerts = signal<AlarmItem[]>([]);
  workers = signal<User[]>([]);
  busy = signal(false);
  live = signal(false);
  onlyOpen = signal(true);

  visible = computed(() =>
    this.onlyOpen() ? this.alerts().filter(a => workerAlertStatus(a) !== 'resolved') : this.alerts()
  );
  pendingCount = computed(() => this.alerts().filter(a => workerAlertStatus(a) === 'pending').length);

  // Umbral del dosímetro: se elige de los dosímetros de la empresa o se busca por serial.
  private control = inject(SessionControlFacade);
  dosimeters = signal<DosimeterOption[]>([]);
  /** Dosímetro elegido en el selector ('' = ninguno). Independiente de la búsqueda. */
  picked = '';
  /** Texto del campo de búsqueda por serial. */
  serial = '';
  thresholdUT: number | null = null;
  config = signal<DeviceConfigView | null>(null);

  private liveSub?: Subscription;

  ngOnInit(): void {
    this.sso.workers().subscribe(workers => this.workers.set(workers));
    this.control.dosimeters().subscribe(d => this.dosimeters.set(d));
    this.load();

    const organizationId = this.sso.organizationId();
    if (organizationId) {
      this.liveSub = this.alarms.liveForOrganization(organizationId).subscribe(alarm => {
        this.live.set(true);
        const isNew = !this.alerts().some(a => a.id === alarm.id);
        this.alerts.set(upsertAlarm(this.alerts(), alarm));
        if (isNew) this.toast.error(`${this.workerName(alarm.workerId)}: ${alarm.title}`);
      });
    }
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
  }

  load(): void {
    this.alarms.organizationAlerts().subscribe(list => this.alerts.set(list));
  }

  status(alarm: AlarmItem): WorkerAlertStatus {
    return workerAlertStatus(alarm);
  }

  pillClass(alarm: AlarmItem): string {
    switch (workerAlertStatus(alarm)) {
      case 'pending': return alarm.type === 'danger' ? 'pill pill--danger' : 'pill pill--warn';
      case 'escalated': return 'pill pill--warn';
      case 'acknowledged': return 'pill';
      default: return 'pill pill--off';
    }
  }

  canEscalate(alarm: AlarmItem): boolean {
    return this.alarms.canEscalate(alarm);
  }

  /** El SSO se escala la alerta a sí mismo: deja constancia de que la tomó. */
  escalate(alarm: AlarmItem): void {
    const me = this.auth.currentUser()?.id;
    if (!me) return;
    this.busy.set(true);
    this.alarms.escalate(alarm.id, {
      ssoResponsibleId: me,
      reason: this.lang.t('al_manualReason'),
    }).subscribe(result => {
      this.busy.set(false);
      if (!result.ok) {
        this.toast.error(result.error || this.lang.t('al_escalateFailed'));
        return;
      }
      this.alerts.set(upsertAlarm(this.alerts(), result.data));
      this.toast.success(this.lang.t('al_escalated'));
    });
  }

  workerName(id: number | null | undefined): string {
    if (!id) return '—';
    return this.workers().find(w => w.id === id)?.name ?? `#${id}`;
  }

  // ── Umbral del dosímetro ──────────────────────────────────────────────

  /** Dosímetro elegido de la lista de la empresa: carga su umbral al momento. */
  pickDosimeter(serial: string): void {
    this.picked = serial;
    this.serial = '';
    if (serial) this.fetchConfig(serial);
    else this.config.set(null);
  }

  /** Búsqueda por serial: deja el selector en blanco. */
  loadConfig(): void {
    const serial = this.serial.trim();
    if (!serial) {
      this.toast.error(this.lang.t('dm_thr_serialRequired'));
      return;
    }
    this.picked = '';
    this.fetchConfig(serial);
  }

  private fetchConfig(serial: string): void {
    this.busy.set(true);
    this.devices.config(serial).subscribe(config => {
      this.busy.set(false);
      this.config.set(config);
      if (!config) {
        this.toast.error(this.lang.t('dm_thr_notFound'));
        return;
      }
      this.thresholdUT = config.alertThresholdUT;
    });
  }

  saveThreshold(): void {
    const config = this.config();
    if (!config) return;
    const error = validateAlertThreshold(this.thresholdUT);
    if (error) {
      this.toast.error(this.lang.t(error));
      return;
    }
    this.busy.set(true);
    this.devices.changeAlertThreshold(config.deviceId, this.thresholdUT!).subscribe(result => {
      this.busy.set(false);
      if (!result.ok) {
        this.toast.error(result.error || this.lang.t('dm_thr_failed'));
        return;
      }
      this.config.set(result.data);
      this.toast.success(this.lang.t('dm_thr_saved'));
    });
  }
}
