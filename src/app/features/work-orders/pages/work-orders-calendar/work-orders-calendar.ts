import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LowerCasePipe } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { WorkOrderFacade } from '../../../../contexts/fieldservice/application/work-order-facade';
import { WorkOrder } from '../../../../contexts/fieldservice/domain/work-order.model';
import { TechWorkOrder } from '../../../../contexts/fieldservice/domain/tech-work-order.model';
import {
  UNASSIGNED, groupByTechnician, hasConflict, isoDay, weekDays,
} from '../../../../contexts/fieldservice/domain/work-order-calendar';
import { WorkOrderDetailModal } from '../../../../shared/components/work-order-detail-modal/work-order-detail-modal';

/** Agenda semanal de instalaciones, mantenimientos y recolecciones por técnico. */
@Component({
  selector: 'app-work-orders-calendar',
  imports: [TranslatePipe, FormsModule, RouterLink, LowerCasePipe, WorkOrderDetailModal],
  templateUrl: './work-orders-calendar.html',
  styleUrl: './work-orders-calendar.scss',
})
export class WorkOrdersCalendar implements OnInit {
  private facade = inject(WorkOrderFacade);

  readonly unassigned = UNASSIGNED;
  readonly types = ['Installation', 'Maintenance', 'Collection'];
  readonly today = isoDay(new Date());

  loading = signal(true);
  orders  = signal<WorkOrder[]>([]);
  anchor  = signal(new Date());
  type    = signal('all');
  hideCancelled = signal(true);
  selected = signal<TechWorkOrder | null>(null);

  days = computed(() => weekDays(this.anchor()));

  rows = computed(() => {
    const ty = this.type();
    const list = this.orders().filter(o =>
      (ty === 'all' || o.type === ty) && !(this.hideCancelled() && o.status === 'cancelled')
    );
    return groupByTechnician(list, this.days());
  });

  conflicts = computed(() =>
    this.rows().reduce((n, r) => n + this.days().filter(d => hasConflict(r.days[isoDay(d)], r.technician)).length, 0)
  );

  rangeLabel = computed(() => {
    const d = this.days();
    const fmt = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(d[0])} – ${fmt(d[6])}, ${d[6].getFullYear()}`;
  });

  ngOnInit(): void {
    this.facade.all().subscribe(list => {
      this.orders.set(list);
      this.loading.set(false);
    });
  }

  shiftWeek(weeks: number): void {
    const a = this.anchor();
    this.anchor.set(new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * weeks));
  }

  goToday(): void {
    this.anchor.set(new Date());
  }

  key(d: Date): string {
    return isoDay(d);
  }

  conflict(orders: WorkOrder[] | undefined, technician: string): boolean {
    return hasConflict(orders, technician);
  }

  dayLabel(d: Date): string {
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  }

  open(o: WorkOrder): void {
    this.facade.fullDetail(o.id).subscribe(detail => this.selected.set(detail));
  }
}
