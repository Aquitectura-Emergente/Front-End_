import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { ExposureSession } from '../../../../contexts/personaldosimetry/domain/exposure-session.model';
import {
  CommandError,
  StartValidationError,
} from '../../../../contexts/personaldosimetry/domain/session-control.model';
import { User } from '../../../../contexts/iam/domain/user.model';
import { JobPosition } from '../../../../contexts/plantconfiguration/domain/job-position.model';
import { DosimeterOption } from '../../../../contexts/devicemanagement/domain/device-status.model';
import { translateDetail } from '../../../../core/http/backend-error';

/** De dónde salió el dosímetro elegido, para decírselo al SSO. */
type DeviceSource = 'usual' | 'lastSession' | 'serial' | 'list';

/**
 * Modal «Iniciar jornada» (`POST /personal-dosimetry/sessions`).
 *
 * - **Operario**: los del SSO (`/sso/workers`).
 * - **Puesto**: solo los que tienen un límite vigente; el backend rechaza el
 *   resto con 422.
 * - **Dosímetro**: se elige de los dosímetros de la empresa (los que ya están
 *   en una jornada aparecen deshabilitados), se prellena con el de la última
 *   jornada del operario o se busca por serial.
 *
 * Sin `startedAt`: la jornada empieza a la hora del servidor. Un 409 o un 422 se
 * muestran con un título traducido y el mensaje del backend tal cual.
 */
@Component({
  selector: 'app-start-session-dialog',
  imports: [TranslatePipe],
  templateUrl: './start-session-dialog.html',
  styleUrl: './start-session-dialog.scss',
})
export class StartSessionDialog implements OnInit, OnDestroy {
  private control = inject(SessionControlFacade);
  private toast = inject(ToastService);
  protected lang = inject(LanguageService);

  /** Operario ya elegido (al abrir el diálogo desde el mapa de planta). */
  readonly initialWorkerId = input<number | null>(null);
  readonly started = output<ExposureSession>();
  readonly cancelled = output<void>();

  workers = signal<User[]>([]);
  positions = signal<JobPosition[]>([]);
  dosimeters = signal<DosimeterOption[]>([]);
  optionsLoading = signal(true);

  workerId = signal<number | null>(null);
  jobPositionId = signal<number | null>(null);
  deviceId = signal<number | null>(null);
  deviceLabel = signal('');
  deviceSource = signal<DeviceSource | null>(null);

  serial = signal('');
  serialBusy = signal(false);
  serialError = signal<string | null>(null);

  validation = signal<StartValidationError>(null);
  busy = signal(false);
  error = signal<CommandError | null>(null);

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(this.control.workers().subscribe(w => this.workers.set(w)));
    this.subs.push(this.control.dosimeters().subscribe(d => this.dosimeters.set(d)));
    const preselected = this.initialWorkerId();
    if (preselected) this.selectWorker(String(preselected));
    this.subs.push(this.control.startablePositions().subscribe(p => {
      this.positions.set(p);
      this.optionsLoading.set(false);
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  /**
   * Al elegir operario se prellenan su dosímetro y su puesto habituales o, si no
   * los tiene, los de su última jornada. El puesto solo si sigue teniendo límite
   * vigente: si no, el backend lo rechazaría y es mejor que el SSO elija otro.
   */
  selectWorker(value: string): void {
    const id = Number(value) || null;
    this.workerId.set(id);
    this.error.set(null);
    this.clearDevice();
    if (!id) return;
    this.subs.push(this.control.startSuggestion(id).subscribe(defaults => {
      if (this.workerId() !== id) return; // el SSO ya eligió a otro
      if (defaults.deviceId) {
        const known = this.dosimeters().find(d => d.device.id === defaults.deviceId);
        this.deviceId.set(defaults.deviceId);
        this.deviceLabel.set(known ? `${known.device.deviceId} (#${defaults.deviceId})` : `#${defaults.deviceId}`);
        this.deviceSource.set(defaults.deviceFrom ?? 'lastSession');
      }
      if (defaults.jobPositionId && this.positions().some(p => p.id === defaults.jobPositionId)) {
        this.jobPositionId.set(defaults.jobPositionId);
      }
    }));
  }

  /** Dosímetro elegido de la lista de la empresa. */
  selectDosimeter(value: string): void {
    const option = this.dosimeters().find(d => d.device.id === Number(value));
    this.serialError.set(null);
    if (!option) {
      this.clearDevice();
      return;
    }
    this.deviceId.set(option.device.id);
    this.deviceLabel.set(`${option.device.deviceId} (#${option.device.id})`);
    this.deviceSource.set('list');
  }

  /** Detalle del error del backend, traducido si es un caso conocido. */
  errorDetail(message: string): string {
    return translateDetail(key => this.lang.t(key), message);
  }

  selectPosition(value: string): void {
    this.jobPositionId.set(Number(value) || null);
  }

  /** Busca el dosímetro por serial y comprueba que sea un dosímetro de la empresa. */
  lookupSerial(): void {
    const serial = this.serial().trim();
    this.serialError.set(null);
    if (!serial) {
      this.serialError.set(this.lang.t('sc_serialRequired'));
      return;
    }
    this.serialBusy.set(true);
    this.subs.push(this.control.deviceBySerial(serial).subscribe(device => {
      this.serialBusy.set(false);
      if (!device) {
        this.serialError.set(this.lang.t('sc_serialNotFound'));
        return;
      }
      const problem = this.control.dosimeterProblem(device);
      if (problem) {
        this.serialError.set(this.lang.t(`sc_serial_${problem}`));
        return;
      }
      this.deviceId.set(device.id);
      this.deviceLabel.set(`${device.deviceId} (#${device.id})`);
      this.deviceSource.set('serial');
    }));
  }

  submit(): void {
    const form = {
      workerId: this.workerId() ?? undefined,
      jobPositionId: this.jobPositionId() ?? undefined,
      deviceId: this.deviceId() ?? undefined,
    };
    const invalid = this.control.validateStart(form);
    this.validation.set(invalid);
    if (invalid) return;

    this.busy.set(true);
    this.error.set(null);
    this.subs.push(this.control.open({
      workerId: form.workerId!,
      jobPositionId: form.jobPositionId!,
      deviceId: form.deviceId!,
    }).subscribe(result => {
      this.busy.set(false);
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      this.toast.success(this.lang.t('sc_started'));
      this.started.emit(result.data);
    }));
  }

  errorTitleKey(status: number): string {
    return this.control.errorTitleKey(status);
  }

  private clearDevice(): void {
    this.deviceId.set(null);
    this.deviceLabel.set('');
    this.deviceSource.set(null);
    this.serialError.set(null);
  }
}
