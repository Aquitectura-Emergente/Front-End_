import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { TechWorkOrder } from '../../../contexts/fieldservice/domain/tech-work-order.model';
import { initialsFrom } from '../../../contexts/iam/domain/initials';

/**
 * Read-only work-order detail rendered as a centered modal.
 * Shared by the Admin and Technician History detail views.
 */
@Component({
  selector: 'app-work-order-detail-modal',
  imports: [TranslatePipe],
  templateUrl: './work-order-detail-modal.html',
  styleUrl: './work-order-detail-modal.scss',
})
export class WorkOrderDetailModal {
  order = input.required<TechWorkOrder>();
  close = output<void>();

  protected statusClass(status: string): string {
    return status === 'completed'  ? 'ems-tag ems-tag--safe'
      : status === 'in-progress' ? 'ems-tag ems-tag--info'
      : status === 'cancelled'   ? 'ems-tag'
      : 'ems-tag ems-tag--warning';
  }

  protected statusLabel(status: string): string {
    return status === 'completed'  ? 'Completed'
      : status === 'in-progress' ? 'In Progress'
      : status === 'cancelled'   ? 'Cancelled'
      : 'Pending';
  }

  protected typeIcon(type: string): string {
    return type === 'Installation' ? 'ph-plugs-connected'
      : type === 'Maintenance'    ? 'ph-wrench'
      : 'ph-package';
  }

  protected deviceStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'active': 'Active',
      'in-maintenance': 'In Maintenance',
      'requires-maintenance': 'Requires Maintenance',
      'unregistered': 'In Stock',
    };
    return map[status] ?? status;
  }

  protected initials(name: string | undefined): string {
    return initialsFrom(name);
  }
}
