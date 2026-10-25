import { isOpen } from './work-order-status';

describe('isOpen', () => {
  it('considera abiertas las órdenes pendientes y en curso', () => {
    expect(isOpen('pending')).toBe(true);
    expect(isOpen('in-progress')).toBe(true);
  });

  it('no considera abiertas las órdenes ya cerradas', () => {
    expect(isOpen('completed')).toBe(false);
    expect(isOpen('cancelled')).toBe(false);
  });

  it('ante un estado desconocido no la considera abierta', () => {
    expect(isOpen('')).toBe(false);
    expect(isOpen('whatever')).toBe(false);
  });
});
