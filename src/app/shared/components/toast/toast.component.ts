import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast-container" role="status" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}">
          <i class="ph {{ iconFor(toast.type) }} toast__icon" aria-hidden="true"></i>
          <span class="toast__msg">{{ toast.message }}</span>
          <button class="toast__close" type="button" aria-label="Dismiss" (click)="toastService.dismiss(toast.id)">
            <i class="ph ph-x" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  protected toastService = inject(ToastService);

  protected iconFor(type: string): string {
    return type === 'success' ? 'ph-check-circle'
      : type === 'error'     ? 'ph-x-circle'
      : type === 'warning'   ? 'ph-warning'
      : 'ph-info';
  }
}
