import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SsoWorkers } from './sso-workers';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import { MitigationFacade } from '../../../../contexts/occupationalhealth/application/mitigation-facade';
import { User, WorkerPayload } from '../../../../contexts/iam/domain/user.model';
import { MutationResult } from '../../../../core/http/api-response';
import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { PlantConfigFacade } from '../../../../contexts/plantconfiguration/application/plant-config-facade';
import { WorkerDefaults } from '../../../../contexts/personaldosimetry/domain/session-control.model';

class ControlStub {
  saved: Array<[number, WorkerDefaults]> = [];
  dosimeters() { return of([{ device: { id: 20, deviceId: 'EMSafe-DOS-01' }, inSession: false }]); }
  workerDefaults() { return of({ jobPositionId: 2, deviceId: null }); }
  changeWorkerDefaults(id: number, d: WorkerDefaults) { this.saved.push([id, d]); return of({ ok: true as const, data: d }); }
}

const ANA: User = {
  id: 12, name: 'Ana Quispe', initials: 'AQ', joinDate: '2026-10-01', role: 'Worker',
  email: 'ana@quantumdyn.com', status: 'active', organizationId: 8,
} as User;

class SsoStub {
  list: User[] = [ANA];
  created: WorkerPayload[] = [];
  updated: Array<[number, WorkerPayload]> = [];
  next: MutationResult<User> = { ok: true, data: ANA };
  workers() { return of(this.list); }
  createWorker(p: WorkerPayload) { this.created.push(p); return of(this.next); }
  updateWorker(id: number, p: WorkerPayload) { this.updated.push([id, p]); return of(this.next); }
}

describe('SsoWorkers', () => {
  let fixture: ComponentFixture<SsoWorkers>;
  let sso: SsoStub;
  let control: ControlStub;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    sso = new SsoStub();
    control = new ControlStub();
    await TestBed.configureTestingModule({
      imports: [SsoWorkers],
      providers: [
        { provide: SsoFacade, useValue: sso },
        { provide: MitigationFacade, useValue: { placements: () => of([]), isOnShift: () => false } },
        { provide: SessionControlFacade, useValue: control },
        { provide: PlantConfigFacade, useValue: { positions: () => of([{ id: 2, name: 'Prensas', plantZoneName: 'Planta' }]), zones: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SsoWorkers);
    fixture.detectChanges();
  });

  it('lista los operarios de la empresa', () => {
    expect(el().textContent).toContain('Ana Quispe');
  });

  it('da de alta un operario con los datos del formulario', () => {
    const page = fixture.componentInstance;
    page.openNew();
    page.form = { name: ' Luis Rojas ', email: 'luis@quantumdyn.com', phone: '', department: 'Prensas', password: 'segura123', positionId: '2', deviceId: '20' };
    page.save();
    expect(sso.created).toEqual([{ name: 'Luis Rojas', email: 'luis@quantumdyn.com', phone: '', department: 'Prensas', password: 'segura123' }]);
    expect(control.saved).toEqual([[12, { jobPositionId: 2, deviceId: 20 }]]);
    expect(page.editing()).toBeNull();
  });

  it('no envía un alta sin contraseña válida', () => {
    const page = fixture.componentInstance;
    page.openNew();
    page.form = { name: 'Luis', email: 'luis@quantumdyn.com', phone: '', department: '', password: '123', positionId: '', deviceId: '' };
    page.save();
    expect(sso.created).toEqual([]);
    expect(page.formError()).toBeTruthy();
  });

  it('muestra el motivo del backend si el alta falla', () => {
    const page = fixture.componentInstance;
    sso.next = { ok: false, error: 'Email already in use: luis@quantumdyn.com' };
    page.openNew();
    page.form = { name: 'Luis', email: 'luis@quantumdyn.com', phone: '', department: '', password: 'segura123', positionId: '', deviceId: '' };
    page.save();
    expect(page.formError()).toContain('already registered');
    expect(page.editing()).toBe('new');
  });

  it('al editar carga sus habituales y no los reescribe si no cambian', () => {
    const page = fixture.componentInstance;
    page.openEdit(ANA);
    expect(page.form.positionId).toBe('2');
    page.save();
    expect(sso.updated[0][0]).toBe(12);
    expect(control.saved).toEqual([]);
  });

  it('desactiva a un operario activo', () => {
    fixture.componentInstance.toggleActive(ANA);
    expect(sso.updated).toEqual([[12, { status: 'inactive' }]]);
  });
});
