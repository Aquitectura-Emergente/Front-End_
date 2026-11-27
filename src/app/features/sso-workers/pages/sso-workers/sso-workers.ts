import { ChangeDetectorRef, Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { describeError } from '../../../../core/http/backend-error';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import { MitigationFacade } from '../../../../contexts/occupationalhealth/application/mitigation-facade';
import { User, WorkerPayload } from '../../../../contexts/iam/domain/user.model';
import { WorkerPlacement } from '../../../../contexts/occupationalhealth/domain/worker-shift.model';
import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { PlantConfigFacade } from '../../../../contexts/plantconfiguration/application/plant-config-facade';
import { JobPosition } from '../../../../contexts/plantconfiguration/domain/job-position.model';
import { PlantZone } from '../../../../contexts/plantconfiguration/domain/plant-zone.model';
import { DosimeterOption } from '../../../../contexts/devicemanagement/domain/device-status.model';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MutationResult } from '../../../../core/http/api-response';

/** Datos del formulario de alta o edición. */
interface WorkerForm {
  name: string;
  email: string;
  phone: string;
  department: string;
  password: string;
  /** Puesto y dosímetro habituales ('' = ninguno): prellenan «Iniciar jornada». */
  positionId: string;
  deviceId: string;
}

const EMPTY_FORM: WorkerForm = { name: '', email: '', phone: '', department: '', password: '', positionId: '', deviceId: '' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Los operarios de la organización del responsable de SSO: los ve, los da de
 * alta, edita sus datos y los activa o desactiva.
 *
 * Solo los suyos: el backend acota por la organización del token y nunca
 * devuelve ni deja tocar cuentas de otra empresa ni de otro rol. Al crear un
 * operario, el backend le da su acceso a la dosimetría personal, así que ya se
 * le puede iniciar una jornada.
 *
 * También fija su puesto y su dosímetro habituales, que prellenan «Iniciar
 * jornada»; son solo una sugerencia, cada jornada guarda los suyos.
 *
 * Se cruza con el turno abierto para poder decir de un vistazo quién está en
 * planta ahora mismo, que es lo primero que un responsable quiere saber.
 */
@Component({
  selector: 'app-sso-workers',
  imports: [TranslatePipe, FormsModule],
  templateUrl: './sso-workers.html',
  styleUrl: './sso-workers.scss',
})
export class SsoWorkers implements OnInit {
  private sso = inject(SsoFacade);
  private mitigation = inject(MitigationFacade);
  private toast = inject(ToastService);
  private lang = inject(LanguageService);
  private control = inject(SessionControlFacade);
  private plant = inject(PlantConfigFacade);
  private cdr = inject(ChangeDetectorRef);

  loading = signal(true);
  workers = signal<User[]>([]);
  placements = signal<WorkerPlacement[]>([]);
  positions = signal<JobPosition[]>([]);
  zones = signal<PlantZone[]>([]);
  dosimeters = signal<DosimeterOption[]>([]);
  /** Habituales al abrir la edición, para no guardarlos si no cambian. */
  private loadedDefaults = { positionId: '', deviceId: '' };

  onShiftCount = computed(() => this.placements().filter(p => this.mitigation.isOnShift(p)).length);

  /** null: formulario cerrado; 'new': alta; un operario: edición. */
  editing = signal<User | 'new' | null>(null);
  form: WorkerForm = { ...EMPTY_FORM };
  formError = signal<string | null>(null);
  saving = signal(false);
  showPassword = signal(false);

  ngOnInit(): void {
    this.reload();
    this.plant.positions().subscribe(p => this.positions.set(p));
    this.plant.zones().subscribe(z => this.zones.set(z));
    this.control.dosimeters().subscribe(d => this.dosimeters.set(d));
  }

  private reload(): void {
    this.loading.set(true);
    this.sso.workers().subscribe(workers => {
      this.workers.set(workers);
      this.mitigation.placements().subscribe(placements => {
        this.placements.set(placements);
        this.loading.set(false);
      });
    });
  }

  private placementOf(workerId: number): WorkerPlacement | undefined {
    return this.placements().find(p => p.workerId === workerId);
  }

  isOnShift(workerId: number): boolean {
    const placement = this.placementOf(workerId);
    return placement ? this.mitigation.isOnShift(placement) : false;
  }

  /** Zona donde está ahora, por su nombre. */
  zoneNameOf(workerId: number): string | null {
    const id = this.zoneOf(workerId);
    if (id == null) return null;
    return this.zones().find(z => z.id === id)?.name ?? `#${id}`;
  }

  zoneOf(workerId: number): number | null {
    return this.placementOf(workerId)?.shift?.currentPlantZoneId ?? null;
  }

  isNew(): boolean {
    return this.editing() === 'new';
  }

  openNew(): void {
    this.form = { ...EMPTY_FORM };
    this.showPassword.set(false);
    this.loadedDefaults = { positionId: '', deviceId: '' };
    this.formError.set(null);
    this.editing.set('new');
  }

  openEdit(worker: User): void {
    this.showPassword.set(false);
    this.form = {
      name: worker.name,
      email: worker.email,
      phone: worker.phone ?? '',
      department: worker.department ?? '',
      password: '',
      positionId: '',
      deviceId: '',
    };
    this.loadedDefaults = { positionId: '', deviceId: '' };
    this.formError.set(null);
    this.editing.set(worker);
    this.control.workerDefaults(worker.id).subscribe(defaults => {
      if (this.editing() !== worker) return;
      const loaded = {
        positionId: defaults?.jobPositionId != null ? String(defaults.jobPositionId) : '',
        deviceId: defaults?.deviceId != null ? String(defaults.deviceId) : '',
      };
      this.loadedDefaults = loaded;
      this.form = { ...this.form, ...loaded };
      // `form` no es una señal: sin zone.js hay que pedir el repintado.
      this.cdr.markForCheck();
    });
  }

  closeForm(): void {
    this.editing.set(null);
  }

  /** Validación previa al envío; la definitiva es la del backend. */
  private validate(): string | null {
    const f = this.form;
    if (!f.name.trim()) return 'val_nameRequired';
    if (!EMAIL.test(f.email.trim())) return 'val_emailRequired';
    if (this.isNew() && f.password.length < 8) return 'val_password8';
    if (!this.isNew() && f.password && f.password.length < 8) return 'val_password8';
    return null;
  }

  save(): void {
    const target = this.editing();
    if (!target) return;
    const invalid = this.validate();
    if (invalid) {
      this.formError.set(this.lang.t(invalid));
      return;
    }
    this.formError.set(null);
    const f = this.form;
    const payload: WorkerPayload = {
      name: f.name.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      department: f.department.trim(),
      ...(f.password ? { password: f.password } : {}),
    };
    this.saving.set(true);
    const account: Observable<MutationResult<User>> = target === 'new'
      ? this.sso.createWorker(payload)
      : this.sso.updateWorker(target.id, payload);
    // Primero la cuenta (el alta crea la membership); después, si cambiaron, los habituales.
    const request = account.pipe(switchMap(result => this.saveDefaults(result)));
    request.subscribe(result => {
      this.saving.set(false);
      if (!result.ok) {
        this.formError.set(describeError(key => this.lang.t(key), this.lang.t('wk_saveFailed'), result.error));
        return;
      }
      this.toast.success(this.lang.t(target === 'new' ? 'wk_created' : 'wk_updated'));
      this.closeForm();
      this.reload();
    });
  }

  private saveDefaults(result: MutationResult<User>): Observable<MutationResult<unknown>> {
    if (!result.ok) return of(result);
    const f = this.form;
    if (f.positionId === this.loadedDefaults.positionId && f.deviceId === this.loadedDefaults.deviceId) {
      return of(result);
    }
    return this.control.changeWorkerDefaults(result.data.id, {
      jobPositionId: f.positionId ? Number(f.positionId) : null,
      deviceId: f.deviceId ? Number(f.deviceId) : null,
    });
  }

  toggleActive(worker: User): void {
    const status = worker.status === 'active' ? 'inactive' : 'active';
    this.sso.updateWorker(worker.id, { status }).subscribe(result => {
      if (!result.ok) {
        this.toast.error(describeError(key => this.lang.t(key), this.lang.t('wk_saveFailed'), result.error));
        return;
      }
      this.workers.update(list => list.map(w => (w.id === worker.id ? { ...w, status } : w)));
      this.toast.success(this.lang.t(status === 'active' ? 'wk_activated' : 'wk_deactivated'));
    });
  }
}
