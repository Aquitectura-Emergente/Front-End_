import { DeviceStatusView, canDelete, lifecycleTargets } from './device-status.model';

function view(lifecycleStatus: DeviceStatusView['lifecycleStatus']): DeviceStatusView {
  return {
    id: 1, deviceId: 'SN-1', deviceType: 'FIXED_SENSOR', lifecycleStatus, operationalStatus: 'active',
    connectivity: null, connectivityChangedAt: null, connectivityEdgeNodeId: null, lastSeenAt: null,
    firmwareVersion: null, batteryLevel: null, organizationId: null, plantZoneId: null,
  };
}

describe('lifecycleTargets', () => {
  it('desde stock puede instalarse o retirarse', () => {
    expect(lifecycleTargets('IN_STOCK')).toEqual(['INSTALLED', 'RETIRED']);
  });

  it('un retirado no tiene salida', () => {
    expect(lifecycleTargets('RETIRED')).toEqual([]);
  });

  it('sin estado se trata como instalado, igual que el backend', () => {
    expect(lifecycleTargets(null)).toEqual(['IN_STOCK', 'RETIRED']);
  });
});

describe('canDelete', () => {
  it('bloquea el borrado de un dispositivo instalado', () => {
    expect(canDelete(view('INSTALLED'))).toBe(false);
  });

  it('permite borrar en stock o retirado', () => {
    expect(canDelete(view('IN_STOCK'))).toBe(true);
    expect(canDelete(view('RETIRED'))).toBe(true);
  });

  it('sin estado conocido no se borra', () => {
    expect(canDelete(null)).toBe(false);
    expect(canDelete(view(null))).toBe(false);
  });

  it('un ciclo de vida omitido por el backend (campo ausente) tampoco se borra', () => {
    const { lifecycleStatus: _omitted, ...rest } = view('IN_STOCK');
    expect(canDelete(rest as DeviceStatusView)).toBe(false);
  });
});
