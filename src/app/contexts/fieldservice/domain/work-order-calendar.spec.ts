import { WorkOrder } from './work-order.model';
import { UNASSIGNED, groupByTechnician, hasConflict, isoDay, weekDays } from './work-order-calendar';

function order(id: number, date: string, technician: string, status: WorkOrder['status'] = 'pending'): WorkOrder {
  return {
    id, orderId: `WO-${id}`, type: 'Installation', client: 'ACME', location: '', city: '',
    date, technician, technicianInitials: technician.slice(0, 2).toUpperCase(), status,
  };
}

describe('weekDays', () => {
  it('va de lunes a domingo', () => {
    const days = weekDays(new Date(2026, 10, 13)); // viernes
    expect(days.map(isoDay)).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
  });

  it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(isoDay(weekDays(new Date(2026, 10, 15))[0])).toBe('2026-11-09');
  });
});

describe('groupByTechnician', () => {
  const days = weekDays(new Date(2026, 10, 13));

  it('agrupa por técnico y día e ignora lo que cae fuera de la semana', () => {
    const rows = groupByTechnician([
      order(1, '2026-11-10', 'Luis'),
      order(2, '2026-11-10', 'Luis'),
      order(3, '2026-11-12', 'Ana'),
      order(4, '2026-11-20', 'Ana'),
    ], days);
    expect(rows.map(r => r.technician)).toEqual(['Ana', 'Luis']);
    expect(rows[1].days['2026-11-10'].length).toBe(2);
    expect(rows[0].total).toBe(1);
  });

  it('deja las órdenes sin técnico al final', () => {
    const rows = groupByTechnician([order(1, '2026-11-10', ''), order(2, '2026-11-11', 'Zoe')], days);
    expect(rows.map(r => r.technician)).toEqual(['Zoe', UNASSIGNED]);
  });
});

describe('hasConflict', () => {
  it('marca dos órdenes abiertas del mismo técnico el mismo día', () => {
    expect(hasConflict([order(1, 'x', 'Luis'), order(2, 'x', 'Luis', 'in-progress')], 'Luis')).toBe(true);
  });

  it('no cuenta las cerradas ni las órdenes sin técnico', () => {
    expect(hasConflict([order(1, 'x', 'Luis'), order(2, 'x', 'Luis', 'completed')], 'Luis')).toBe(false);
    expect(hasConflict([order(1, 'x', ''), order(2, 'x', '')], UNASSIGNED)).toBe(false);
  });
});
