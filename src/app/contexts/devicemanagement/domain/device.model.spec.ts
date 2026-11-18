import { DEVICE_TYPES, EDITABLE_DEVICE_STATUSES, UNLINK_CLIENT, isEditableStatus, typeLabelFor } from './device.model';

describe('typeLabelFor', () => {
  it('da una etiqueta corta para cada tipo de dispositivo', () => {
    expect(DEVICE_TYPES.map(typeLabelFor)).toEqual(['Dosimeter', 'Sensor', 'Plug']);
  });
});

describe('estados editables', () => {
  it('no deja fijar a mano el estado en stock', () => {
    expect(EDITABLE_DEVICE_STATUSES).not.toContain('unregistered');
  });

  it('trata como no editables los estados en stock y los antiguos', () => {
    expect(isEditableStatus('active')).toBe(true);
    expect(isEditableStatus('unregistered')).toBe(false);
    expect(isEditableStatus('inactive')).toBe(false);
  });

  it('desvincula el cliente con 0, como espera el backend', () => {
    expect(UNLINK_CLIENT).toBe(0);
  });
});
