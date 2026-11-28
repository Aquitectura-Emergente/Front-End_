import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { PlantMap } from './plant-map';
import { MitigationFacade } from '../../../../contexts/occupationalhealth/application/mitigation-facade';
import { PlantConfigFacade } from '../../../../contexts/plantconfiguration/application/plant-config-facade';
import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { WorkerPlacement } from '../../../../contexts/occupationalhealth/domain/worker-shift.model';

const LINKED = { workerId: 12, name: 'Ana', initials: 'AN', shift: { exposureSessionId: 'S-1' } } as unknown as WorkerPlacement;
const MANUAL = { workerId: 13, name: 'Luis', initials: 'LU', shift: { exposureSessionId: null } } as unknown as WorkerPlacement;

describe('PlantMap', () => {
  let fixture: ComponentFixture<PlantMap>;
  const closedSessions: string[] = [];
  const closedShifts: number[] = [];

  beforeEach(async () => {
    closedSessions.length = 0;
    closedShifts.length = 0;
    await TestBed.configureTestingModule({
      imports: [PlantMap],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlantConfigFacade, useValue: { snapshot: () => of({ zones: [], positions: [] }) } },
        {
          provide: MitigationFacade,
          useValue: {
            placements: () => of([]),
            groupByZone: () => ({ occupancy: [], unassigned: [] }),
            canCloseShift: () => true,
            closeShift: (id: number) => { closedShifts.push(id); return of(true); },
          },
        },
        {
          provide: SessionControlFacade,
          useValue: { close: (id: string) => { closedSessions.push(id); return of({ ok: true, data: {} }); } },
        },
        { provide: ConfirmService, useValue: { confirm: () => true } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlantMap);
    fixture.detectChanges();
  });

  it('cerrar desde el mapa cierra la jornada vinculada, que cierra el turno', () => {
    fixture.componentInstance.closeShift(LINKED);
    expect(closedSessions).toEqual(['S-1']);
    expect(closedShifts).toEqual([]);
  });

  it('un turno abierto a mano, sin jornada, solo se cierra', () => {
    fixture.componentInstance.closeShift(MANUAL);
    expect(closedSessions).toEqual([]);
    expect(closedShifts).toEqual([13]);
  });

  it('iniciar jornada abre el dialogo con el operario ya elegido', () => {
    fixture.componentInstance.openStart(LINKED);
    expect(fixture.componentInstance.startFor()).toBe(LINKED);
    fixture.componentInstance.closeStart();
    expect(fixture.componentInstance.startFor()).toBeNull();
  });
});
