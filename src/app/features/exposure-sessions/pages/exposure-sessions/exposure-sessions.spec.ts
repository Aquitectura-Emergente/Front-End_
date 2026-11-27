import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ExposureSessions } from './exposure-sessions';
import { DosimetryFacade } from '../../../../contexts/personaldosimetry/application/dosimetry-facade';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ExposureSession } from '../../../../contexts/personaldosimetry/domain/exposure-session.model';

function closing(deadlineFromNowMs: number): ExposureSession {
  return {
    id: 'S-1', state: 'CLOSING', workerId: 18,
    reconciliationDeadline: new Date(Date.now() + deadlineFromNowMs).toISOString(),
  } as unknown as ExposureSession;
}

describe('ExposureSessions · finalizar', () => {
  let fixture: ComponentFixture<ExposureSessions>;
  const finalized: Array<[string, boolean]> = [];
  let confirmed = true;

  beforeEach(async () => {
    finalized.length = 0;
    confirmed = true;
    await TestBed.configureTestingModule({
      imports: [ExposureSessions],
      providers: [
        provideRouter([]),
        { provide: SsoFacade, useValue: { workers: () => of([]), organizationId: () => 8 } },
        {
          provide: DosimetryFacade,
          useValue: { sessions: () => of({ content: [] }), byMostRecent: (s: ExposureSession[]) => s },
        },
        {
          provide: SessionControlFacade,
          useValue: { finalize: (id: string, early: boolean) => { finalized.push([id, early]); return of({ ok: true, data: {} }); } },
        },
        { provide: ConfirmService, useValue: { confirm: () => confirmed } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ExposureSessions);
    fixture.detectChanges();
  });

  it('antes del plazo finaliza confirmando que el dosimetro entrego todo', () => {
    fixture.componentInstance.finalize(closing(10 * 60_000));
    expect(finalized).toEqual([['S-1', true]]);
  });

  it('pasado el plazo finaliza sin esa confirmacion', () => {
    fixture.componentInstance.finalize(closing(-60_000));
    expect(finalized).toEqual([['S-1', false]]);
  });

  it('si el SSO no confirma, no hace nada', () => {
    confirmed = false;
    fixture.componentInstance.finalize(closing(10 * 60_000));
    expect(finalized).toEqual([]);
  });
});
