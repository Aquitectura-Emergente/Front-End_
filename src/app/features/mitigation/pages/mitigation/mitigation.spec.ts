import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Mitigation } from './mitigation';
import { MitigationFacade } from '../../../../contexts/occupationalhealth/application/mitigation-facade';
import { PlantConfigFacade } from '../../../../contexts/plantconfiguration/application/plant-config-facade';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import { MitigationAction } from '../../../../contexts/occupationalhealth/domain/mitigation-action.model';

const EXCEEDED = {
  id: 7, type: 'RELOCATION', state: 'PROPOSED', origin: 'LIMIT_EXCEEDED', priority: 'HIGH',
  justification: 'Occupational limit exceeded on session 632e692d-588d-4b33-b4df-f2923217c41c',
  affectedWorkers: [{ workerId: 18, fromPositionId: 3, doseAtDecision: { value: 6540, unit: 'uT*s', percentage: 218 } }],
  history: [], createdAt: '2026-11-27T16:10:28',
} as unknown as MitigationAction;

describe('Mitigation · presentacion', () => {
  let fixture: ComponentFixture<Mitigation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mitigation],
      providers: [
        { provide: PlantConfigFacade, useValue: { snapshot: () => of({ zones: [], positions: [{ id: 3, name: 'Prensa' }] }) } },
        { provide: SsoFacade, useValue: { workers: () => of([{ id: 18, name: 'Fabricio Lopez' }]) } },
        {
          provide: MitigationFacade,
          useValue: {
            list: () => of([EXCEEDED]), actions: () => of([EXCEEDED]), pending: () => of([EXCEEDED]),
            workerIds: (a: MitigationAction) => a.affectedWorkers.map(w => w.workerId),
            needsTarget: () => false, stateLabelKey: () => 'mit_state_PROPOSED', isPending: () => true,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Mitigation);
  });

  it('cuenta el motivo en palabras, sin el id de la jornada', () => {
    const page = fixture.componentInstance;
    expect(page.reason(EXCEEDED)).toBe('Exceeded their exposure limit (218 %).');
    expect(page.typeLabel(EXCEEDED)).toBe('Relocation');
    expect(page.originLabel(EXCEEDED)).toBe('Limit exceeded');
  });

  it('nombra al operario y su puesto en vez de su id', () => {
    const page = fixture.componentInstance;
    page.workers.set([{ id: 18, name: 'Fabricio Lopez' } as never]);
    page.positions.set([{ id: 3, name: 'Prensa' } as never]);
    expect(page.personLabel(EXCEEDED, 18)).toBe('Fabricio Lopez · Prensa');
    expect(page.peopleOf(EXCEEDED)).toBe('Fabricio Lopez');
  });

  it('la justificacion escrita por el SSO se muestra tal cual', () => {
    const manual = { ...EXCEEDED, origin: 'MANUAL', justification: 'Mantenimiento del transformador' } as MitigationAction;
    expect(fixture.componentInstance.reason(manual)).toBe('Mantenimiento del transformador');
  });
});
